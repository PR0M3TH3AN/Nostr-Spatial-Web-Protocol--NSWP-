/**
 * People's own models, fetched and checked before anything draws one (protocol/05-looks.md, "A model of your own").
 *
 * A model is a stranger's file. So it is fetched by its hash only from the file hosts on the viewer's own list
 * (`fetchByHash`, file-hosts.ts), taken only if its bytes have that hash, read and counted by `readGlb` against
 * `LOOK_BUDGET` (or a world's lower one), and only then handed to Three.js: with VRM's required extensions taken
 * off its list, since the kit has already read what it uses of them. Nothing in it runs. One copy per hash, for
 * everyone wearing the same file.
 *
 * What is drawn is fitted: its top at the height its wearer chose, its feet on the floor, its middle under its
 * wearer, facing -z like every figure the kit draws.
 */
import { AVATAR_KIND, decodeNaddr, DEFAULT_RELAYS, glbJson, LOOK_BUDGET, LOOK_MODELS_AT_ONCE, LOOK_NOTE_LIMIT, queryRelays, verifyEvent, type NostrEvent, lookFacing, readGlb, withoutRequired, type GlbCount, type LookModel, type ModelBudget } from "@nswp/core";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { fetchByHashSaying, keptElsewhere, onFileHostsChange, type FileHostsOptions } from "./file-hosts.js";
import { arrival } from "./index.js";
import { arrivedSettings, reportSettings } from "./settings.js";
import { askWell } from "./relay-book.js";

/** What a world lets a look's model be, from its manifest's `avatar`: never more than `LOOK_BUDGET`. */
export function lookBudget(world?: { maxFileSizeMb?: number; maxTriangles?: number } | null): ModelBudget {
  const mb = world?.maxFileSizeMb;
  const tris = world?.maxTriangles;
  return {
    ...LOOK_BUDGET,
    bytes: typeof mb === "number" && Number.isFinite(mb) && mb >= 0 ? Math.min(LOOK_BUDGET.bytes, Math.floor(mb * 1_000_000)) : LOOK_BUDGET.bytes,
    triangles: typeof tris === "number" && Number.isFinite(tris) && tris >= 0 ? Math.min(LOOK_BUDGET.triangles, Math.floor(tris)) : LOOK_BUDGET.triangles,
  };
}

export interface LookModelsOptions extends FileHostsOptions {
  /** Fetch an address's bytes. For tests; left out, the browser's own. */
  fetchBytes?: (url: string) => Promise<Uint8Array | null>;
  /** Whose own file hosts are used: the signed-in viewer's key, or null for a guest. Left out, whoever arrived. */
  viewer?: () => string | null;
}

/** Why a model isn't drawn, for tests and for a person's card. */
export type LookRefusal = "elsewhere" | "missing" | "refused" | "unreadable";

export interface LookModels {
  /** A model's bytes, checked, read and counted against `budget`. Null where any of that fails. */
  bytes(model: LookModel, budget?: ModelBudget): Promise<{ bytes: Uint8Array; count: GlbCount } | null>;
  /** The model as Three.js draws it: fitted to its height, feet at 0, facing -z. A new copy each time. Null where it fails. */
  object(model: LookModel, budget?: ModelBudget): Promise<THREE.Object3D | null>;
  /** Why the last try at this model came to nothing, or null if it came, or hasn't been tried. */
  why(model: Pick<LookModel, "sha256">): LookRefusal | null;
}

const AGAIN_MS = 4000;

export function createLookModels(opts: LookModelsOptions = {}): LookModels {
  const viewer = opts.viewer ?? (() => arrival.identity()?.pubkey ?? null);
  const hosts: FileHostsOptions = { ...(opts.relays ? { relays: opts.relays } : {}), ...(opts.query ? { query: opts.query } : {}), ...(opts.now ? { now: opts.now } : {}) };
  /** Each file once, by its hash and the budget it was read against. */
  const files = new Map<string, Promise<{ bytes: Uint8Array; count: GlbCount } | null>>();
  const scenes = new Map<string, Promise<THREE.Object3D | null>>();
  const refusals = new Map<string, LookRefusal>();
  onFileHostsChange(() => {
    // The viewer's list arrived, or they changed where they load files from: anything kept elsewhere is asked again.
    for (const [sha, why] of refusals)
      if (why === "elsewhere") {
        refusals.delete(sha);
        for (const key of [...files.keys()]) if (key.startsWith(sha)) files.delete(key);
        for (const key of [...scenes.keys()]) if (key.startsWith(sha)) scenes.delete(key);
      }
  });
  const keyOf = (model: LookModel, budget: ModelBudget) => `${model.sha256}:${budget.bytes}:${budget.triangles}`;
  const forgetSoon = <T>(kept: Map<string, Promise<T>>, key: string, asked: Promise<T>) =>
    setTimeout(() => {
      if (kept.get(key) === asked) kept.delete(key);
    }, AGAIN_MS);

  const bytes: LookModels["bytes"] = (model, budget = LOOK_BUDGET) => {
    const key = keyOf(model, budget);
    let got = files.get(key);
    if (!got) {
      const asking = fetchByHashSaying(model.sha256, model.url, { most: budget.bytes, viewer: viewer(), hosts, ...(opts.fetchBytes ? { fetchBytes: opts.fetchBytes } : {}) }).then(({ bytes: b, wrong }) => {
        if (!b) {
          if (keptElsewhere(model.url)) refusals.set(model.sha256, "elsewhere");
          else {
            refusals.set(model.sha256, wrong ? "refused" : "missing");
            // Nothing came: asked again a little later. Something wrong came: asking again would get the same.
            if (!wrong) forgetSoon(files, key, asking);
          }
          return null;
        }
        const read = readGlb(b, budget);
        if (!read.ok) {
          refusals.set(model.sha256, "refused");
          return null;
        }
        refusals.delete(model.sha256);
        return { bytes: b, count: read.count };
      });
      got = asking;
      files.set(key, got);
    }
    return got;
  };

  const scene = (model: LookModel, budget: ModelBudget): Promise<THREE.Object3D | null> => {
    const key = keyOf(model, budget);
    let got = scenes.get(key);
    if (!got) {
      got = bytes(model, budget).then(async (checked) => {
        if (!checked) {
          scenes.delete(key);
          return null;
        }
        const plain = withoutRequired(checked.bytes);
        const json = glbJson(checked.bytes);
        if (!plain || !json) return null;
        try {
          const read = await new GLTFLoader().parseAsync(plain.buffer.slice(plain.byteOffset, plain.byteOffset + plain.byteLength) as ArrayBuffer, "");
          const root = read.scene;
          // Facing -z, as the kit draws everyone.
          if (lookFacing(json) === "+z") root.rotation.y = Math.PI;
          // Drawn as the kit's plain material in its own colour and picture: a world has no surroundings for a
          // metal to mirror, so a file's metal (glTF's default, where it says nothing) would be drawn black.
          root.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
              const std = m as THREE.MeshStandardMaterial;
              if (!std.isMeshStandardMaterial) continue;
              std.metalness = 0;
              std.metalnessMap = null;
              std.roughness = Math.max(std.roughness, 0.6);
              std.needsUpdate = true;
            }
          });
          root.userData.lookClips = read.animations;
          return root;
        } catch {
          refusals.set(model.sha256, "unreadable");
          return null;
        }
      });
      scenes.set(key, got);
    }
    return got;
  };

  return {
    bytes,
    async object(model, budget = LOOK_BUDGET) {
      const root = await scene(model, budget);
      if (!root) return null;
      // A copy for each wearer, sharing what it is drawn with. Skinned meshes keep their own skeletons.
      const copy = clone(root);
      copy.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(copy);
      const tall = box.max.y - box.min.y;
      const holder = new THREE.Group();
      if (!(tall > 0) || !Number.isFinite(tall)) return null;
      const scale = model.height / tall;
      copy.scale.multiplyScalar(scale);
      copy.updateMatrixWorld(true);
      const fitted = new THREE.Box3().setFromObject(copy);
      const centre = fitted.getCenter(new THREE.Vector3());
      copy.position.x -= centre.x;
      copy.position.z -= centre.z;
      copy.position.y -= fitted.min.y;
      holder.add(copy);
      holder.userData.lookClips = root.userData.lookClips ?? [];
      holder.userData.lookHeight = model.height;
      return holder;
    },
    why: (model) => refusals.get(model.sha256) ?? null,
  };
}

/**
 * This visitor's own look note, to hand to the room (`JoinOptions.avatar`): the one their arrival named, read from
 * relays, really signed by the key their pass names, and small enough to hand on. Null for a guest, for someone who
 * came plain, and where none is found.
 */
export async function ownLookNote(opts: { relays?: string[]; query?: typeof queryRelays; now?: () => number; naddr?: string | null; author?: string | null } = {}): Promise<NostrEvent | null> {
  const naddr = opts.naddr === undefined ? arrival.avatar() : opts.naddr;
  const author = opts.author === undefined ? (arrival.identity()?.pubkey ?? null) : opts.author;
  if (!naddr || !author) return null;
  let at: ReturnType<typeof decodeNaddr>;
  try {
    at = decodeNaddr(naddr);
  } catch {
    return null;
  }
  if (at.kind !== AVATAR_KIND || at.pubkey !== author) return null;
  const relays = [...new Set([...(at.relays ?? []).filter((r) => r.startsWith("wss://")).slice(0, 3), ...(opts.relays ?? DEFAULT_RELAYS)])];
  const got = await askWell({ kinds: [AVATAR_KIND], authors: [author], "#d": [at.identifier], limit: 4 }, { own: [], usual: relays, ...(opts.query ? { query: opts.query } : {}), timeoutMs: 4000, ...(opts.now ? { now: opts.now } : {}) }).catch(() => null);
  const newest = (got?.events ?? []).filter((e) => e.kind === AVATAR_KIND && e.pubkey === author && verifyEvent(e) && e.tags.some((t) => t[0] === "d" && t[1] === at.identifier)).sort((a, b) => b.created_at - a.created_at)[0];
  return newest && JSON.stringify(newest).length <= LOOK_NOTE_LIMIT ? newest : null;
}

const MODELS_KEY = "nswp:models";
let showing: boolean | null = null;
const modelWatchers = new Set<() => void>();
const keepModels = (on: boolean): void => {
  try {
    if (on) globalThis.localStorage?.removeItem(MODELS_KEY);
    else globalThis.localStorage?.setItem(MODELS_KEY, "off");
  } catch {
    /* for this page only */
  }
};
/** Whether this visitor sees people's own models. On, unless they turned it off here or where they came from: it travels. */
export function showsModels(): boolean {
  if (showing !== null) return showing;
  const came = arrivedSettings().models;
  let kept: string | null = null;
  try {
    kept = globalThis.localStorage?.getItem(MODELS_KEY) ?? null;
  } catch {
    /* nothing kept */
  }
  showing = came ?? kept !== "off";
  if (came !== undefined) keepModels(showing);
  reportSettings("models", () => ({ models: showsModels() }));
  return showing;
}
export function setShowsModels(on: boolean): void {
  showsModels();
  showing = on;
  keepModels(on);
  for (const fn of modelWatchers) fn();
}
export function onModelsChange(fn: () => void): () => void {
  modelWatchers.add(fn);
  return () => void modelWatchers.delete(fn);
}
/** For tests: forget the switch, so it is read afresh. */
export function forgetModelsSwitch(): void {
  showing = null;
}

/** What a world says of people's own models: its manifest's `avatar`, as far as choosing who is drawn needs it. */
export interface WorldLooks {
  formats: readonly string[];
  dress?: "own";
}

/** Whether a world draws people's own models at all: it names a format, and doesn't dress everyone itself. */
export function worldDrawsModels(world: WorldLooks | null | undefined): boolean {
  return !!world && world.dress !== "own" && (world.formats.includes("vrm") || world.formats.includes("glb"));
}

/**
 * Who is drawn as their own model, and why each of the others isn't (protocol/05-looks.md, "A model of your own").
 * In this order: someone who wears none (`none`); a world that draws none, dresses everyone itself, or doesn't draw
 * that format (`world`); a viewer who turned models off (`off`); a viewer who chose that person's simple look
 * (`person`); and beyond the nearest `most`, everyone else (`crowd`). Whoever is left is drawn (`draw`), if their
 * file then passes. The nearest come first; two as near as each other keep the order they were given in.
 */
export function chooseLooks<K>(
  people: readonly { key: K; format?: string | null; metres: number; simple?: boolean }[],
  world: WorldLooks | null | undefined,
  shows: boolean,
  most: number = LOOK_MODELS_AT_ONCE,
): Map<K, "draw" | "none" | "world" | "off" | "person" | "crowd"> {
  const out = new Map<K, "draw" | "none" | "world" | "off" | "person" | "crowd">();
  const draws = worldDrawsModels(world);
  const may: { key: K; metres: number }[] = [];
  for (const p of people) {
    if (!p.format) out.set(p.key, "none");
    else if (!draws || !world!.formats.includes(p.format)) out.set(p.key, "world");
    else if (!shows) out.set(p.key, "off");
    else if (p.simple) out.set(p.key, "person");
    else may.push({ key: p.key, metres: Number.isFinite(p.metres) ? p.metres : Infinity });
  }
  may.sort((a, b) => a.metres - b.metres);
  may.forEach((p, i) => out.set(p.key, i < Math.max(0, most) ? "draw" : "crowd"));
  return out;
}
