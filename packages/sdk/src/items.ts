/**
 * Fetching an item and getting it ready to draw (protocol/17-items.md).
 *
 *   const items = createItems();
 *   const lantern = await items.describe("37303:<maker>:brass-lantern");   // its maker's signed description
 *   const model = lantern && (await items.model(lantern));                 // something to add to a scene
 *
 * An item is something a stranger made. So nothing of it is trusted until it has been checked:
 *
 * - its description is taken only with a real signature by the maker its coordinate names;
 * - its model is taken only if its bytes have the hash the description gives, and are no larger than this allows;
 * - what comes out of the file is counted, and one with too much in it is not drawn.
 *
 * Whatever fails, there is a plain marker of the item's own size to draw instead: a visitor is never left
 * holding nothing because a file was missing.
 *
 * Fetching a model tells the place that keeps it the visitor's address, as fetching a picture does. A visitor
 * who would rather not has one switch for all items (`showsItems`).
 */
import { DEFAULT_RELAYS, ITEM_KIND, itemCoordinate, parseItem, queryRelays, verifyEvent, type Item } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { askWell } from "./relay-book.js";
import { arrivedSettings, reportSettings } from "./settings.js";

export const ITEM_BUDGET = {
  /** The most a model file may weigh, in bytes. */
  bytes: 2_000_000,
  /** The most triangles, meshes and materials a model may have. */
  triangles: 20_000,
  meshes: 40,
  materials: 16,
  /** The longest side of any picture a model's surfaces may use, in pixels. */
  texture: 1024,
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

export interface ItemsOptions {
  relays?: string[];
  query?: typeof queryRelays;
  /** Fetch a file's bytes. For tests; left out, the browser's own. */
  fetchBytes?: (url: string) => Promise<Uint8Array | null>;
  now?: () => number;
}

export interface Items {
  /** An item's description, by its coordinate: from relays, really signed by the maker it names. Null if there is none. */
  describe(coordinate: string): Promise<Item | null>;
  /** What is known of one already, with nothing asked. */
  known(coordinate: string): Item | null;
  /**
   * Something to draw for an item: its own model where every check passes, and a plain marker of its size where
   * one doesn't, or where the visitor has items turned off. Each call gives a copy of its own.
   */
  model(item: Item): Promise<THREE.Object3D>;
  /** A plain marker of an item's size. */
  marker(item: Pick<Item, "size">): THREE.Object3D;
}

/** Fetch a file's bytes, giving up on one that says it is too large, or turns out to be. */
async function fetchWithin(url: string, most: number): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" });
    if (!res.ok) return null;
    const stated = Number(res.headers.get("content-length") ?? 0);
    if (stated > most) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length <= most ? bytes : null;
  } catch {
    return null;
  }
}

/** Count what a loaded model holds, and say whether it is within what may be drawn. */
export function withinBudget(root: THREE.Object3D): boolean {
  let triangles = 0;
  let meshes = 0;
  const materials = new Set<THREE.Material>();
  let ok = true;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    const g = mesh.geometry;
    triangles += Math.floor((g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3);
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(m);
      for (const value of Object.values(m as unknown as Record<string, unknown>)) {
        const image = (value as THREE.Texture | null)?.isTexture ? ((value as THREE.Texture).image as { width?: number; height?: number } | null) : null;
        if (image && Math.max(image.width ?? 0, image.height ?? 0) > ITEM_BUDGET.texture) ok = false;
      }
    }
  });
  return ok && meshes > 0 && meshes <= ITEM_BUDGET.meshes && triangles <= ITEM_BUDGET.triangles && materials.size <= ITEM_BUDGET.materials;
}

/** Scale and place a model so that it stands inside the box its description gives, on that box's floor. */
export function fitToSize(root: THREE.Object3D, size: readonly [number, number, number]): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(root);
  const has = box.getSize(new THREE.Vector3());
  const scale = Math.min(size[0] / (has.x || 1), size[1] / (has.y || 1), size[2] / (has.z || 1));
  const holder = new THREE.Group();
  root.scale.multiplyScalar(Number.isFinite(scale) && scale > 0 ? scale : 1);
  const fitted = new THREE.Box3().setFromObject(root);
  const centre = fitted.getCenter(new THREE.Vector3());
  root.position.x -= centre.x;
  root.position.z -= centre.z;
  root.position.y -= fitted.min.y;
  holder.add(root);
  return holder;
}

export function createItems(opts: ItemsOptions = {}): Items {
  const query = opts.query ?? queryRelays;
  const now = opts.now ?? (() => Date.now());
  const fetchBytes = opts.fetchBytes ?? ((url: string) => fetchWithin(url, ITEM_BUDGET.bytes));
  const described = new Map<string, Promise<Item | null>>();
  const settled = new Map<string, Item | null>();
  const models = new Map<string, Promise<THREE.Object3D | null>>();

  const marker = (item: Pick<Item, "size">): THREE.Object3D => {
    const [w, h, d] = item.size;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0x9aa7b4, wireframe: true }));
    box.position.y = h / 2;
    const holder = new THREE.Group();
    holder.add(box);
    return holder;
  };

  /** The model itself, once: fetched, checked against its hash, read, counted and fitted. Null where any of that fails. */
  const load = (item: Item): Promise<THREE.Object3D | null> => {
    const key = `${item.model.sha256}:${item.size.join(",")}`;
    let made = models.get(key);
    if (!made) {
      made = (async () => {
        const bytes = await fetchBytes(item.model.url);
        if (!bytes || bytes.length > ITEM_BUDGET.bytes || bytesToHex(sha256(bytes)) !== item.model.sha256) return null;
        try {
          const read = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "");
          // Lights and cameras a file brings are not an item's to add to someone's world.
          const extra: THREE.Object3D[] = [];
          read.scene.traverse((o) => {
            if ((o as THREE.Light).isLight || (o as THREE.Camera).isCamera) extra.push(o);
          });
          for (const o of extra) o.removeFromParent();
          return withinBudget(read.scene) ? fitToSize(read.scene, item.size) : null;
        } catch {
          return null;
        }
      })();
      models.set(key, made);
    }
    return made;
  };

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
    async model(item) {
      if (!showsItems()) return marker(item);
      const made = await load(item);
      return made ? made.clone(true) : marker(item);
    },
    marker,
  };
}
