/**
 * Signing from inside a world (protocol/10-identity.md, "Signing from a
 * world").
 *
 * A world never holds its visitor's key. It embeds a hidden signer served
 * by the visitor's own client, and asks it. This is the world's side of
 * that: the embed, the question, and the check on what comes back.
 *
 *   const signer = worldSigner();
 *   signer.unlock();                                   // from a press: opens the client's own window
 *   const note = await signer.sign({ kind: 1, content: "Hello" });   // null if locked or refused
 *
 * What a world can learn from it: whether it is unlocked, and then whose key
 * it holds. What it can never get: the key, a password, or a reason for a
 * refusal. Nothing is asked of the visitor here. The window that unlocks it
 * is the client's own page, which this page can't read.
 */
import { cleanOrigin, cleanSlot, fitsInSave, isWhatWasAsked, looksLikeSave, readSignerReply, signerAddresses, signerAt, signerMessage, toLocal, verifyEvent, verifyRoomPass, WORLD_TAG, type NostrEvent, type SignerReply, type SignerRequest } from "@nswp/core";

/** "none": the visitor has no client here that offers one. "locked": there is one, and it hasn't been unlocked for this world. */
export type SignerState = "none" | "locked" | "unlocked";

export interface WorldSigner {
  readonly state: SignerState;
  /** Whose key it holds, once unlocked. */
  readonly pubkey: string | null;
  /** What the client calls them, once unlocked, or null. Their own choice of name, not a fact. */
  readonly name: string | null;
  /** Where their picture is, as their sign-in address read it from their own profile, or null. For their own card. */
  readonly picture: string | null;
  /** What they wrote about themselves there, or null. Their own words. */
  readonly about: string | null;
  /**
   * Whether the signer will still be unlocked for this world the next time its page is loaded: true, false, or
   * null where it is locked or doesn't say. False means this visit only: the visitor is asked again next time.
   */
  readonly remembered: boolean | null;
  /** The visitor's client, as a host to name in words, or null. */
  readonly host: string | null;
  /**
   * True when a signer was named for this visitor (in the arrival, or
   * outright) and has had time to answer, and hasn't: it couldn't be
   * loaded, or the browser kept it out. Then there is something to say.
   */
  readonly unanswered: boolean;
  /** True while it is being asked again because the visitor pressed for it (`retry`), and hasn't answered yet. */
  readonly asking: boolean;
  /**
   * Where the signer is being asked for on this page, when that is a
   * development server's copy and not the real address: something to name
   * when it didn't answer. Null on a real site.
   */
  readonly copy: string | null;
  /**
   * Open the client's window, where the visitor unlocks it for this world.
   * Call it from a press: a browser opens a window for nothing else. False
   * if there is no signer, or no window could be opened.
   */
  unlock(): boolean;
  /**
   * Load the signer again and ask it once more: for one that was named and said nothing. False if there is nothing
   * to ask again (none was named, or it has answered).
   */
  retry(): boolean;
  /** Lock it again for this world. The visitor's own doing, from the world's menu. */
  lock(): void;
  /** Ask for a note to be signed. Null if it is locked, or it refused, or what came back wasn't what was asked. */
  sign(note: { kind: number; content: string; tags?: string[][] }): Promise<NostrEvent | null>;
  /**
   * Ask for a room pass for this world, for the session key whose public key is given
   * (protocol/10-identity.md, "A pass from the signer"). Null if it is locked, or it refused, or it is a signer
   * that makes none, or what came back isn't a pass by the key it holds, for this site and that session.
   */
  pass(session: string): Promise<NostrEvent | null>;
  /**
   * Ask for something to be kept for this world, in a slot (protocol/12-saves.md). What comes back is a signed
   * save that only the visitor can read: this page sends it to their relays. Null if it is locked, or it
   * refused, or it is a signer that keeps nothing, or what came back isn't a save by the key it holds.
   */
  save(slot: string, data: string): Promise<NostrEvent | null>;
  /** Where this world's save in a slot is kept: the `d` to ask a relay for. Null as for `save`. */
  find(slot: string): Promise<string | null>;
  /** Have a save opened. Null if it isn't this world's, or isn't theirs, or as for `save`. */
  open(event: NostrEvent): Promise<{ slot: string; data: string; at: number } | null>;
  /** Be told when its state changes. Returns how to stop. */
  onChange(fn: () => void): () => void;
  /**
   * Wait until it has said whether it is unlocked, or `ms` have passed. A signer that remembers this world
   * says so a moment after the page loads: this is how to not decide anything before it has.
   */
  whenAnswered(ms: number): Promise<void>;
  dispose(): void;
}

export interface WorldSignerOptions {
  /** The visitor's Airlock: usually `portal.airlockFor()`. The signer is beside it. */
  airlock?: string | null | undefined;
  /**
   * Or where the visitor's client said their signer is: usually
   * `arrival.signer()`. Its `signer/` and `connect/` pages are under that
   * address. Given, it is used in place of the Airlock's.
   */
  under?: string | null | undefined;
  /**
   * Or the signer and its window, named outright: for a site that isn't a
   * world, whose visitor arrived from no client. Both must be https
   * addresses on one origin.
   */
  at?: { signer: string; window: string };
  /** This page's query string, for tests (`signer=test` asks the client's window for a throwaway identity). */
  search?: string;
}

const NONE: WorldSigner = {
  state: "none",
  pubkey: null,
  name: null,
  picture: null,
  about: null,
  remembered: null,
  host: null,
  unanswered: false,
  asking: false,
  retry: () => false,
  copy: null,
  unlock: () => false,
  lock() {},
  sign: async () => null,
  pass: async () => null,
  save: async () => null,
  find: async () => null,
  open: async () => null,
  onChange: () => () => {},
  whenAnswered: async () => {},
  dispose() {},
};

/** A signer and its window named outright: both https, on one origin. Null for anything else. */
function namedAddresses(at: { signer: string; window: string }): { origin: string; signer: string; window: string } | null {
  try {
    const signer = new URL(at.signer);
    const win = new URL(at.window);
    if (signer.protocol !== "https:" || win.origin !== signer.origin) return null;
    return { origin: signer.origin, signer: signer.href, window: win.href };
  } catch {
    return null;
  }
}

/** A signer for this page, from the visitor's client. With no client, or off a browser, one that is always "none". */
export function createWorldSigner(opts: WorldSignerOptions): WorldSigner {
  const real = opts.at ? namedAddresses(opts.at) : (signerAt(opts.under) ?? signerAddresses(opts.airlock));
  if (!real || typeof document === "undefined") return NONE;
  const test = new URLSearchParams(opts.search ?? location.search).get("signer") === "test";
  const watchers = new Set<() => void>();
  const pending = new Map<string, { asked?: { kind: number; content: string; tags: string[][] }; session?: string; done: (e: NostrEvent | null) => void; timer: ReturnType<typeof setTimeout> }>();
  /** Questions about saves, each with what its answer must be. A signer that keeps nothing says nothing: then there is none. */
  const kept = new Map<string, { answer: (reply: SignerReply | null) => void; timer: ReturnType<typeof setTimeout> }>();
  const askAbout = <T>(request: SignerRequest, read: (reply: SignerReply) => T | null): Promise<T | null> =>
    new Promise((done) => {
      const timer = setTimeout(() => {
        kept.delete(request.id);
        done(null);
      }, 8000);
      kept.set(request.id, { answer: (reply) => done(reply ? read(reply) : null), timer });
      tell(request);
    });
  let state: SignerState = "none";
  let pubkey: string | null = null;
  let name: string | null = null;
  let picture: string | null = null;
  let about: string | null = null;
  let remembered: boolean | null = null;
  // Where the signer and the window really are: the client's own addresses, or their copies on a development server.
  let origin = "";
  let windowAt = "";
  let frame: HTMLIFrameElement | null = null;
  let disposed = false;
  /** A signer someone named, as against one only looked for beside an Airlock that may have none. */
  const named = !!opts.at || !!signerAt(opts.under);
  /**
   * It has had the time a signer takes to load and answer. A signer that checks something before its first
   * answer (BitLogin's asks the visitor's relays whether this world was taken back, when it hasn't for days)
   * can take five seconds over it: ten is allowed before it is called silent.
   */
  let waited = false;
  /** The visitor pressed to have it asked again, and it hasn't answered yet. */
  let asking = false;
  /** How many times its frame has been loaded again because it said nothing. Once by itself; then on a press. */
  let again = 0;
  let waiting: ReturnType<typeof setTimeout> | undefined;
  /** Where the frame was sent, to send it there again. */
  let signerUrl = "";
  const reload = () => {
    if (frame && signerUrl) frame.src = signerUrl;
  };
  /**
   * Give it the time, and say so when it runs out. A frame that never loaded (a moment without a network, a
   * browser that was busy) answers nothing however long it is waited for, so the first time the time runs out it
   * is loaded once more, quietly, before anyone is told it is silent.
   */
  const wait = () => {
    waited = false;
    clearTimeout(waiting);
    waiting = setTimeout(() => {
      if (state !== "none" || disposed) return;
      if (again === 0) {
        again = 1;
        reload();
        return wait();
      }
      waited = true;
      asking = false;
      changed();
    }, 10_000);
  };
  wait();
  /** Whether the signer has answered at all. Until it has, it is asked again a few times. */
  let answered = false;
  const firstAnswer = new Set<() => void>();
  let n = 0;
  const changed = () => {
    for (const fn of watchers) fn();
  };
  const tell = (message: Parameters<typeof signerMessage>[0]) => frame?.contentWindow?.postMessage(signerMessage(message), origin);

  const onMessage = (e: MessageEvent) => {
    // Only the signer itself is listened to: that frame, at that address.
    if (!frame || e.source !== frame.contentWindow || e.origin !== origin) return;
    const reply = readSignerReply(e.data);
    if (!reply) return;
    if (reply.t === "ready") {
      asking = false;
      if (state === "none") state = "locked";
      tell({ t: "state", id: `s${++n}` });
      return changed();
    }
    if (reply.t === "state") {
      answered = true;
      asking = false;
      state = reply.unlocked ? "unlocked" : "locked";
      pubkey = reply.unlocked ? (reply.pubkey ?? null) : null;
      name = reply.unlocked ? (reply.name ?? null) : null;
      picture = reply.unlocked ? (reply.picture ?? null) : null;
      about = reply.unlocked ? (reply.about ?? null) : null;
      remembered = reply.unlocked ? (reply.remembered ?? null) : null;
      for (const go of [...firstAnswer]) go();
      return changed();
    }
    const question = kept.get(reply.id);
    if (question) {
      kept.delete(reply.id);
      clearTimeout(question.timer);
      return question.answer(reply.t === "refused" ? null : reply);
    }
    const waiting = pending.get(reply.id);
    if (!waiting) return;
    pending.delete(reply.id);
    clearTimeout(waiting.timer);
    // Only a signed note answers these: an answer about a save that nothing here asked for is dropped.
    if (reply.t !== "signed") return waiting.done(null);
    // What comes back is checked like anything else that arrives: a real signature, by the key it said it holds,
    // on the note that was asked for, marked for this world.
    const signed = reply.event;
    // A pass is checked as a pass from anyone is, and then for whose it is: the key this signer holds, for this
    // site, speaking for the session that was named. Its name and picture are its holder's own to say.
    if (waiting.session) {
      const checked = verifyRoomPass(signed, { origin: location.origin, session: waiting.session });
      return waiting.done(checked.ok && checked.value.pubkey === pubkey ? signed : null);
    }
    if (!waiting.asked) return waiting.done(null);
    const marked = Array.isArray(signed?.tags) && signed.tags.some((t) => t[0] === WORLD_TAG && t[1] === cleanOrigin(location.origin));
    waiting.done(verifyEvent(signed) && signed.pubkey === pubkey && marked && isWhatWasAsked(waiting.asked, signed) ? signed : null);
  };

  void (async () => {
    try {
      // A client's own addresses are followed to their copies on a development server. One named outright is used
      // as it is: whoever named it meant that one.
      const there = opts.at ? async (address: string) => address : toLocal;
      signerUrl = await there(real.signer);
      windowAt = await there(real.window);
      origin = new URL(signerUrl).origin;
      if (disposed) return;
      frame = document.createElement("iframe");
      frame.title = "Signer";
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      // It has nothing to show and is never seen. It is allowed nothing the page could lend it.
      frame.setAttribute("allow", "");
      frame.referrerPolicy = "no-referrer";
      frame.style.cssText = "position:fixed;left:-10px;top:-10px;width:1px;height:1px;border:0;visibility:hidden;pointer-events:none";
      addEventListener("message", onMessage);
      // A signer says nothing to a page whose address it doesn't know, and not every browser tells it. So it is
      // asked: once the frame has loaded, and a few times more in case its script wasn't listening yet.
      frame.addEventListener("load", () => {
        for (const after of [0, 400, 1200, 3000]) {
          setTimeout(() => {
            if (!answered && !disposed) tell({ t: "state", id: `s${++n}` });
          }, after);
        }
      });
      frame.src = signerUrl;
      document.body.append(frame);
    } catch {
      /* no signer: it stays "none" */
    }
  })();

  return {
    get state() {
      return state;
    },
    get pubkey() {
      return pubkey;
    },
    get name() {
      return name;
    },
    get picture() {
      return picture;
    },
    get about() {
      return about;
    },
    get remembered() {
      return remembered;
    },
    get unanswered() {
      return named && waited && state === "none" && !disposed;
    },
    get asking() {
      return asking && state === "none" && !disposed;
    },
    retry() {
      if (!named || state !== "none" || disposed || !frame) return false;
      again++;
      asking = true;
      reload();
      wait();
      changed();
      return true;
    },
    get copy() {
      return origin && origin !== real.origin ? origin : null;
    },
    // The signer's real address, never a development server's copy of it: it is what the visitor should recognise.
    get host() {
      try {
        return new URL(real.origin).host;
      } catch {
        return null;
      }
    },
    unlock() {
      if (state === "none" || !windowAt) return false;
      try {
        // A window of its own, never a tab the visitor would lose the world behind. It must keep its link to this
        // page: that is how it finds the signer here. So no "noopener".
        const opened = window.open(`${windowAt}${test ? "?signer=test" : ""}`, "nswp-connect", "popup,width=460,height=660");
        return !!opened;
      } catch {
        return false;
      }
    },
    lock() {
      if (state === "unlocked") tell({ t: "lock", id: `l${++n}` });
    },
    sign(note) {
      if (state !== "unlocked" || !frame) return Promise.resolve(null);
      const asked = { kind: note.kind, content: note.content, tags: note.tags ?? [] };
      const id = `q${++n}`;
      return new Promise((done) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          done(null);
        }, 8000);
        pending.set(id, { asked, done, timer });
        tell({ t: "sign", id, event: asked });
      });
    },
    pass(session) {
      if (state !== "unlocked" || !frame) return Promise.resolve(null);
      const id = `p${++n}`;
      return new Promise((done) => {
        // A signer that makes no passes says nothing at all to this: then there is none.
        const timer = setTimeout(() => {
          pending.delete(id);
          done(null);
        }, 8000);
        pending.set(id, { session, done, timer });
        tell({ t: "pass", id, session });
      });
    },
    save(slot, data) {
      if (state !== "unlocked" || !frame || !cleanSlot(slot) || !fitsInSave(data)) return Promise.resolve(null);
      // The world can't read what comes back, and doesn't need to: it checks that it is a save, really signed, by
      // the key this signer holds.
      return askAbout({ t: "save", id: `s${++n}`, slot, data }, (reply) => (reply.t === "signed" && verifyEvent(reply.event) && looksLikeSave(reply.event, pubkey) ? reply.event : null));
    },
    find(slot) {
      if (state !== "unlocked" || !frame || !cleanSlot(slot)) return Promise.resolve(null);
      return askAbout({ t: "find", id: `f${++n}`, slot }, (reply) => (reply.t === "found" ? reply.d : null));
    },
    open(event) {
      if (state !== "unlocked" || !frame || !verifyEvent(event) || !looksLikeSave(event, pubkey)) return Promise.resolve(null);
      return askAbout({ t: "open", id: `o${++n}`, event }, (reply) => (reply.t === "opened" ? { slot: reply.slot, data: reply.data, at: reply.at } : null));
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
    whenAnswered(ms) {
      if (answered || disposed) return Promise.resolve();
      return new Promise((done) => {
        const go = () => {
          clearTimeout(timer);
          firstAnswer.delete(go);
          done();
        };
        const timer = setTimeout(go, ms);
        firstAnswer.add(go);
      });
    },
    dispose() {
      disposed = true;
      for (const go of [...firstAnswer]) go();
      clearTimeout(waiting);
      removeEventListener("message", onMessage);
      frame?.remove();
      frame = null;
      for (const w of pending.values()) {
        clearTimeout(w.timer);
        w.done(null);
      }
      pending.clear();
      for (const k of kept.values()) {
        clearTimeout(k.timer);
        k.answer(null);
      }
      kept.clear();
      state = "none";
    },
  };
}
