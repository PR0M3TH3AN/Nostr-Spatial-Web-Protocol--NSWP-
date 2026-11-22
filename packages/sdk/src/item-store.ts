/**
 * Fetching an item, with nothing drawn (protocol/17-items.md): its description, and each file it names, as bytes
 * that have been checked. This is the part every engine shares. What draws a world takes a model's bytes from
 * here and makes of them what it draws with: Three.js in `items.ts`, Godot in its addon.
 *
 * An item is something a stranger made. So nothing of it is handed on until it has been checked:
 *
 * - its description is taken only with a real signature by the maker its coordinate names;
 * - each file is taken only if its bytes have the hash the description gives, and are no larger than allowed;
 * - a model is read and counted first (`readGlb` in the core): one with too much in it, or one that names
 *   anything outside itself, is not handed on at all.
 *
 * Fetching a file tells the place that keeps it the visitor's address. So a file is asked for by its hash, only
 * from file hosts on the visitor's own list (`fetchByHash`, file-hosts.ts): the address an item gives is a hint.
 * One kept only somewhere else is not fetched unless the visitor turned on loading files from anywhere, and the
 * item is drawn as its marker. A visitor who would rather nothing were fetched has one switch for all items
 * (`showsItems`).
 */
import { DEFAULT_RELAYS, ITEM_KIND, itemCoordinate, MODEL_BUDGET, parseItem, queryRelays, readGlb, SCRIPT_LIMITS, verifyEvent, type GlbCount, type Item } from "@nswp/core";
import { fetchByHashSaying, keptElsewhere, onFileHostsChange } from "./file-hosts.js";
import { arrival } from "./index.js";
import { askWell } from "./relay-book.js";
import { arrivedSettings, reportSettings } from "./settings.js";

/** The most an item's files may be: its models (the core's `MODEL_BUDGET`, the same for every engine), and a sound. */
export const ITEM_BUDGET = {
  ...MODEL_BUDGET,
  /** The most one of an item's sounds may weigh, in bytes. */
  sound: 150_000,
} as const;

const ITEMS_KEY = "nswp:items";
const watchers = new Set<() => void>();
let shown: boolean | null = null;

const keep = (on: boolean): void => {
  try {
    if (on) globalThis.localStorage?.removeItem(ITEMS_KEY);
    else globalThis.localStorage?.setItem(ITEMS_KEY, "off");
  } catch {
    /* a private window: for this page only */
  }
};

/**
 * Whether this visitor has items drawn, and run, at all. Theirs to set; on unless they turned it off, here or
 * where they came from: it goes with them from world to world, as their other settings do
 * (protocol/11-the-visitors-console.md, "Settings that travel").
 */
export function showsItems(): boolean {
  if (shown !== null) return shown;
  const came = arrivedSettings().items;
  let kept: string | null = null;
  try {
    kept = globalThis.localStorage?.getItem(ITEMS_KEY) ?? null;
  } catch {
    /* nothing kept */
  }
  shown = came ?? kept !== "off";
  if (came !== undefined) keep(shown);
  reportSettings("items", () => ({ items: showsItems() }));
  return shown;
}

/** Turn every item off, or on again, for this visitor: nothing of anyone's is fetched, drawn or run while it is off. */
export function setShowsItems(on: boolean): void {
  showsItems();
  shown = on;
  keep(on);
  for (const fn of watchers) fn();
}

/** For tests: forget what was read, so the next look reads it afresh. */
export function forgetItemsSwitch(): void {
  shown = null;
}

export function onItemsChange(fn: () => void): () => void {
  watchers.add(fn);
  return () => void watchers.delete(fn);
}

export interface ItemStoreOptions {
  relays?: string[];
  query?: typeof queryRelays;
  /** Fetch a file's bytes, at one address. For tests; left out, the browser's own. */
  fetchBytes?: (url: string) => Promise<Uint8Array | null>;
  /**
   * Whose own file hosts are used: the signed-in viewer's key, or null for a guest. Left out, whoever the visitor
   * arrived as.
   */
  viewer?: () => string | null;
  now?: () => number;
}

/** A model file and its box: an item's own, or one of the things it sends out. */
export interface ModelNamed {
  model: { url: string; sha256: string };
  size: [number, number, number];
}

export interface ItemStore {
  /** An item's description, by its coordinate: from relays, really signed by the maker it names. Null if there is none. */
  describe(coordinate: string): Promise<Item | null>;
  /** What is known of one already, with nothing asked. */
  known(coordinate: string): Item | null;
  /**
   * A model's bytes, once: fetched, checked against its hash, read and counted. Null where any of that fails, or
   * the visitor has items turned off: whatever draws the world then draws a plain marker of the thing's size.
   */
  modelBytes(named: ModelNamed): Promise<{ bytes: Uint8Array; count: GlbCount } | null>;
  /** One of an item's own sounds, as its bytes: fetched and checked against its hash. Null if there is none, or it failed. */
  sound(item: Item, name: string): Promise<Uint8Array | null>;
  /** An item's script, as its text: fetched and checked against its hash. Null if it has none, or it failed. */
  script(item: Item): Promise<string | null>;
  /**
   * Whether a file of this item didn't come because it is kept somewhere the visitor doesn't load files from:
   * what its card says, beside its marker.
   */
  elsewhere(item: Pick<Item, "model" | "script">): boolean;
}

/** How long after a file failed to come it may be asked for again: a bad moment on the network isn't for the rest of the visit. */
const AGAIN_MS = 4000;

/** Count what a loaded model holds, and say whether it is within what may be drawn. */
export function createItemStore(opts: ItemStoreOptions = {}): ItemStore {
  const query = opts.query ?? queryRelays;
  const now = opts.now ?? (() => Date.now());
  const viewer = opts.viewer ?? (() => arrival.identity()?.pubkey ?? null);
  const hosts = { ...(opts.relays ? { relays: opts.relays } : {}), query, now };
  /** Files that didn't come, and whose own address is somewhere the visitor doesn't load files from. */
  const refused = new Set<string>();
  const described = new Map<string, Promise<Item | null>>();
  const settled = new Map<string, Item | null>();
  const files = new Map<string, Promise<Uint8Array | null>>();
  const models = new Map<string, Promise<{ bytes: Uint8Array; count: GlbCount } | null>>();
  /** Let something that didn't come be asked for again, a little later: unless it has been already. */
  const forgetSoon = <T>(kept: Map<string, Promise<T>>, key: string, asked: Promise<T>): void => {
    setTimeout(() => {
      if (kept.get(key) === asked) kept.delete(key);
    }, AGAIN_MS);
  };
  /** A file of an item's, once: fetched, and taken only if it is what its description promised. */
  const file = (named: { url: string; sha256: string }, most: number): Promise<Uint8Array | null> => {
    let got = files.get(named.sha256);
    if (!got) {
      const asking: Promise<Uint8Array | null> = fetchByHashSaying(named.sha256, named.url, { most, viewer: viewer(), hosts, ...(opts.fetchBytes ? { fetchBytes: opts.fetchBytes } : {}) })
        .then(({ bytes, wrong }) => {
          // Nothing came: it is asked for again another time. Something came that is too big, or isn't what the
          // description promised: that is kept as refused, since asking again would get the same file. One kept
          // only somewhere the visitor doesn't load files from is kept as refused until their list or switch changes.
          if (bytes) refused.delete(named.sha256);
          else if (keptElsewhere(named.url)) refused.add(named.sha256);
          else if (!wrong) forgetSoon(files, named.sha256, asking);
          return bytes;
        })
        .catch(() => (forgetSoon(files, named.sha256, asking), null));
      got = asking;
      files.set(named.sha256, got);
    }
    return got;
  };
  // The visitor's list arrived, or they changed what they load: what was refused for where it is kept is asked for afresh.
  onFileHostsChange(() => {
    for (const sha of refused) {
      files.delete(sha);
      models.delete(sha);
    }
    refused.clear();
  });
  return {
    describe(coordinateIn) {
      const coordinate = itemCoordinate(coordinateIn);
      if (!coordinate) return Promise.resolve(null);
      let found = described.get(coordinate);
      if (!found) {
        const [, maker, ...rest] = coordinate.split(":");
        found = askWell({ kinds: [ITEM_KIND], authors: [maker!], "#d": [rest.join(":")], limit: 4 }, { own: [], usual: opts.relays ?? DEFAULT_RELAYS, query, timeoutMs: 4000, now })
          .then((got) => {
            const newest = got.events.filter((e) => e.kind === ITEM_KIND && e.pubkey === maker && verifyEvent(e)).sort((a, b) => b.created_at - a.created_at)[0];
            const item = newest ? parseItem(newest) : null;
            return item && item.id === coordinate ? item : null;
          })
          .catch(() => null)
          .then((item) => {
            settled.set(coordinate, item);
            // One that wasn't found is asked for again another time: a relay may only have been slow.
            if (!item) described.delete(coordinate);
            return item;
          });
        described.set(coordinate, found);
      }
      return found;
    },
    known: (coordinate) => settled.get(itemCoordinate(coordinate)) ?? null,
    modelBytes(named) {
      if (!showsItems()) return Promise.resolve(null);
      let got = models.get(named.model.sha256);
      if (!got) {
        const asking: Promise<{ bytes: Uint8Array; count: GlbCount } | null> = file(named.model, ITEM_BUDGET.bytes).then((bytes) => {
          // Counted before anything that draws sees it, and refused if it names anything outside itself.
          const read = bytes ? readGlb(bytes) : null;
          // No file at all is forgotten with the file, so both are asked for again together.
          if (!bytes && !refused.has(named.model.sha256)) forgetSoon(models, named.model.sha256, asking);
          return bytes && read?.ok ? { bytes, count: read.count } : null;
        });
        got = asking;
        models.set(named.model.sha256, got);
      }
      return got;
    },
    async sound(item, name) {
      const named = item.sounds[name];
      return named && showsItems() ? file(named, ITEM_BUDGET.sound) : null;
    },
    elsewhere: (item) => [item.model, item.script].some((f) => !!f && refused.has(f.sha256)),
    async script(item) {
      if (!item.script || !showsItems()) return null;
      const bytes = await file(item.script, SCRIPT_LIMITS.bytes);
      try {
        return bytes ? new TextDecoder("utf-8", { fatal: true }).decode(bytes) : null;
      } catch {
        return null;
      }
    },
  };
}
