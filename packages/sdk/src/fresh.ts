/**
 * Noticing that the world a visitor is in has been updated since they opened it.
 *
 * A browser that asks before using a kept copy (core/fresh.ts) gets the latest
 * world every time a page is loaded. It does nothing for a page that is
 * already open: a tab left for an hour, or one a browser brought back whole
 * when the visitor pressed Back, goes on running what it loaded. So the page
 * asks, itself: has what I was made from changed?
 *
 * It asks about the page and its own script, and nothing else, with the
 * question a browser asks when it checks a copy (a HEAD request to its own
 * site). The answer is a mark the host puts on each file, which changes when
 * the file does. No mark, no answer: on a host that gives none, this does
 * nothing.
 *
 * What it does about it is as gentle as it can be. A visitor coming back to
 * the tab, who isn't in the middle of anything, is given the latest there and
 * then: the page loads again, and puts them back where they stood. Anyone
 * else (in a room, in a headset, writing something) is told, and reloads when
 * they choose.
 *
 *   const fresh = watchFresh({ busy: () => inARoom(), onStale: () => controls.say("…") });
 *   // fresh.stale, fresh.reload()
 */

export interface Fresh {
  /** The site has been updated since this page was loaded. */
  readonly stale: boolean;
  /**
   * Ask now. `returning` is true when the visitor has just come back to the page (it became visible, or a browser
   * brought it back from memory): then, if it is stale and they aren't busy, it is loaded again at once.
   * Resolves to whether it is stale.
   */
  check(returning?: boolean): Promise<boolean>;
  /** Load the page again, for the latest. */
  reload(): void;
  stop(): void;
}

export interface FreshOptions {
  /** The mark of what this page was made from, or null if the host gives none. Left out: the page's and its script's own. */
  stamp?: () => Promise<string | null>;
  /** Whether the visitor is in the middle of something a reload would break: in a room, in a headset, writing. */
  busy?: () => boolean;
  /** The site was updated and the page wasn't loaded again: say so. Called once. */
  onStale?: () => void;
  /** Load the page again. Left out: `location.reload()`. */
  reload?: () => void;
  /** The time now, in milliseconds. For tests. */
  now?: () => number;
  /** For tests: watch nothing by itself, and wait to be asked. */
  manual?: boolean;
}

/**
 * Load the page again, having first asked for it afresh. A plain reload asks the site whether the page has
 * changed, and where its HTML hasn't, the browser goes on with the copy it kept and the headers that copy came
 * with: the page's content rules among them, however they have changed since. Asking for the page outright
 * replaces that copy, headers and all, so the page that then loads is under the rules its site sends today.
 * (Every page is also marked so that it changes with its rules, core `stampPage`: this is for a page that isn't.)
 */
export function reloadAfresh(): void {
  let gone = false;
  const go = () => {
    if (gone) return;
    gone = true;
    location.reload();
  };
  try {
    void fetch(location.href, { cache: "reload", credentials: "same-origin" }).then(go, go);
    // Not waited on for long: a site that is slow to answer is still loaded again.
    setTimeout(go, 4000);
  } catch {
    go();
  }
}

/** No more often than this, however often they come and go. */
const LEAST_MS = 30_000;
/** While the page is in front of them, this often. */
const EVERY_MS = 10 * 60_000;

/** The mark a host puts on a file, asked for the way a browser asks about a copy it kept. Null if it gives none. */
async function markOf(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return null;
    const mark = res.headers.get("etag") ?? res.headers.get("last-modified");
    return mark ? `${mark}` : null;
  } catch {
    return null;
  }
}

/** The page's own mark, and its first script's: either changing means the world did. */
async function pageStamp(): Promise<string | null> {
  const page = `${location.origin}${location.pathname}`;
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src], script[src]')?.src ?? "";
  const marks = await Promise.all([markOf(page), script && new URL(script).origin === location.origin ? markOf(script) : null]);
  // Both, or it is no answer: half an answer would call a world updated when a request merely failed.
  return marks.every((m) => m !== null) || (!script && marks[0]) ? marks.join("|") : null;
}

export function watchFresh(o: FreshOptions = {}): Fresh {
  const stamp = o.stamp ?? pageStamp;
  const now = o.now ?? (() => Date.now());
  const reload = o.reload ?? reloadAfresh;
  let first: string | null | undefined;
  let stale = false;
  let told = false;
  let asked = -Infinity;
  let asking: Promise<boolean> | null = null;
  let stopped = false;

  const check = (returning = false): Promise<boolean> => {
    if (stopped) return Promise.resolve(stale);
    if (stale) {
      // Known already. Coming back to it with nothing in hand is the moment to take the latest.
      if (returning && !o.busy?.()) reload();
      return Promise.resolve(true);
    }
    if (asking) return asking;
    if (now() - asked < LEAST_MS && first !== undefined) return Promise.resolve(false);
    asked = now();
    asking = stamp()
      .catch(() => null)
      .then((mark) => {
        asking = null;
        if (stopped) return stale;
        if (first === undefined) {
          first = mark;
          return false;
        }
        // No mark then or now is no answer, not a change.
        if (first === null || mark === null || mark === first) return false;
        stale = true;
        if (returning && !o.busy?.()) reload();
        else if (!told) {
          told = true;
          o.onStale?.();
        }
        return true;
      });
    return asking;
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") void check(true);
  };
  const onShow = (e: PageTransitionEvent) => {
    // Brought back from memory by Back or Forward: it may be hours old.
    if (e.persisted) void check(true);
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  if (!o.manual && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisible);
    addEventListener("pageshow", onShow);
    timer = setInterval(() => {
      if (document.visibilityState === "visible") void check(false);
    }, EVERY_MS);
    void check(false);
  }
  return {
    get stale() {
      return stale;
    },
    check,
    reload,
    stop() {
      stopped = true;
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
        removeEventListener("pageshow", onShow);
      }
    },
  };
}
