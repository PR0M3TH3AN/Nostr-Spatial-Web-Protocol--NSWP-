/**
 * The one presence of a world drawn by an engine that isn't JavaScript's: who is here, what each holds, and the
 * things in play (docs/other-engines.md).
 *
 * It is the very presence a Three.js world has (presence.ts), on a scene with nothing in it to draw
 * (engine-world.ts). The parts of this script for items and for people both go through it, as a Three.js world's
 * do, which is why what a visitor holds is told to the room, and why what someone else's item sends out reaches
 * them: none of that is written again here.
 */
import { cleanItemsRule, ENTRY_PLACES_LEAST, entryPlaces, pickEntryPlace, type EntryPlace } from "@nswp/core";
import * as THREE from "three";
import { engineParts } from "./engine-menu.js";
import { addFramePart, engineWorld } from "./engine-world.js";
import { arrival } from "./index.js";
import type { ItemBoxOptions } from "./item-box.js";
import type { ItemStore } from "./item-store.js";
import { createItems, type Items } from "./items.js";
import { createPresence, type Presence } from "./presence.js";

/** What this world does with items, as its engine said: nothing, until it says. */
const said = { rule: "none", scripts: false as boolean | ItemBoxOptions, relays: undefined as string[] | undefined };
let store: Items | null = null;
let presence: Presence | null = null;
/** The places of the entry point the visitor arrived by, as the engine gave them (`entryPlace`), for stepping them aside. */
let arrivedBy: EntryPlace[] | null = null;
const watchers = new Set<() => void>();

/**
 * What fetches and checks everything an item names. Made when first needed, by which time its relays are known.
 * It can also make a model of an item for the page to draw: the Bag tab's pictures are drawn by the page, in
 * every world (item-preview.ts). What is in the world itself is the engine's to draw, from the checked bytes.
 */
export function engineItemStore(): Items {
  return (store ??= createItems(said.relays?.length ? { relays: said.relays } : {}));
}

/** The world's engine says what it does with items (`NSWP.items`). Until then nothing carried is fetched, drawn or run. */
export function engineAllowsItems(rule: unknown, scripts: boolean | ItemBoxOptions, relays?: string[]): string {
  said.rule = cleanItemsRule(rule);
  said.scripts = scripts;
  if (relays?.length && !store) said.relays = relays;
  return said.rule;
}

/** Be told when who is here, what anyone holds or how the visitor is may have changed. */
export function onEnginePresence(fn: () => void): void {
  watchers.add(fn);
}

/** The presence, made when first asked for. Null until the world has its menu. */
export function enginePresence(): Presence | null {
  if (presence) return presence;
  const parts = engineParts();
  if (!parts) return null;
  const world = engineWorld();
  const { controls, sounds } = parts;
  // What this script holds of a thing is where it is and which way it faces: the engine has its shape.
  const nothing = async (): Promise<THREE.Group> => new THREE.Group();
  const shapeless = {
    describe: (id: string) => engineItemStore().describe(id),
    known: (id: string) => engineItemStore().known(id),
    modelBytes: (named: Parameters<ItemStore["modelBytes"]>[0]) => engineItemStore().modelBytes(named),
    sound: (...a: Parameters<ItemStore["sound"]>) => engineItemStore().sound(...a),
    script: (...a: Parameters<ItemStore["script"]>) => engineItemStore().script(...a),
    model: nothing,
    sent: nothing,
    marker: () => new THREE.Group(),
    clips: () => [],
  } as unknown as Items;
  presence = createPresence({
    scene: world.scene,
    camera: world.camera,
    rig: world.rig,
    // No headset session is this script's to start: the engine says whether its visitor is in one.
    renderer: {
      xr: {
        get isPresenting() {
          return world.presenting;
        },
        getSession: () => null,
      },
    },
    controllers: [],
    items: shapeless,
    itemsRule: () => said.rule,
    get itemScripts() {
      return said.scripts;
    },
    sounds,
    theme: () => ({ accent: controls.theme.accent, motion: controls.theme.motion }),
    deferredPlay: true,
    // The engine brings the thing in hand up to the eye, and says when it is there.
    sighting: () => world.sighting,
    // Where they arrived, for stepping them aside if they join and find themselves inside someone: the move reaches
    // the engine as a frame's `nudge`, applied when the engine says they are neither stepping nor turning.
    arrival: () => (arrivedBy ? { places: arrivedBy, moving: () => world.moving } : null),
    look: () => arrival.look(),
    identity: () => arrival.identity(),
    onChange: () => {
      for (const fn of watchers) fn();
    },
  });
  const made = presence;
  // Once a frame, before any part says what to draw: people are moved to where they now are, and things fly on.
  addFramePart((_said, dt) => {
    made.update(dt);
    return {};
  });
  return presence;
}

/**
 * Where the visitor should arrive (protocol/01-worlds.md, "Places to arrive"; `NSWP.entryPlace`): `json` is the
 * places of the entry point they came by, as the engine's scene has them (`places`: each `position` [x, y, z] and
 * `yaw`, its own spot first; only places a visitor may stand on), and `least` if the world is for meeting people (8).
 * Fewer than the least are filled with a ring round the first. Returns JSON with `index` and the `place` to stand
 * them on, picked with whoever is in the room the visitor has joined, if any; and keeps the places, so that if they
 * join and find themselves inside someone the kit steps them aside (a frame's `nudge`).
 */
export function entryPlace(json?: string): string {
  let said: { places?: unknown; least?: unknown } = {};
  try {
    said = typeof json === "string" ? (JSON.parse(json) as typeof said) : {};
  } catch {
    said = {};
  }
  const given = (Array.isArray(said.places) ? said.places : []).filter(
    (p): p is EntryPlace => !!p && typeof p === "object" && Array.isArray((p as EntryPlace).position) && (p as EntryPlace).position.length === 3 && (p as EntryPlace).position.every((n) => typeof n === "number" && Number.isFinite(n)) && typeof (p as EntryPlace).yaw === "number",
  );
  if (!given.length) return JSON.stringify({ index: -1, place: null });
  const least = typeof said.least === "number" && Number.isInteger(said.least) && said.least > 0 && said.least <= 64 ? said.least : ENTRY_PLACES_LEAST;
  const places = entryPlaces({ ...given[0]!, places: given.slice(1) }, least);
  arrivedBy = places;
  const others = ((presence?.info() as { head?: number[] }[] | undefined) ?? []).flatMap((p) => (Array.isArray(p.head) && p.head.length === 3 ? [[p.head[0]!, p.head[2]!] as [number, number]] : []));
  const index = pickEntryPlace(places, others);
  return JSON.stringify({ index, place: places[index] ?? null });
}
