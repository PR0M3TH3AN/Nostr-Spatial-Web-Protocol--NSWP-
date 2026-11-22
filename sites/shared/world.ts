/**
 * What every world in sites/ runs on: the stage, arriving, doors, moving, the
 * controls, the room, and the preview picture. A world supplies its colours,
 * where its doors stand, and a `build` function that models what is in it.
 *
 * Works in a browser (click or tap), with a keyboard (W, A, S, D), and in any
 * WebXR headset: every action is one `select`, so a trigger, a pinch, and
 * gaze-and-pinch all work. `?xr=emulate` pretends to be a Meta Quest 3.
 * `window.__nswpTest` is for automation.
 */
import * as THREE from "three";
import { arrival, configure, portal, type PortalDestination } from "nswp-sdk";
import { checkDestination, checkPreviewBytes, cleanItemsRule, encodeNaddr, isLocalHost, ITEM_RULES, WORLD_KIND, worldOffers, type Achievement, type Board, type ItemsRule, type Offer } from "@nswp/core";
import { createAlloy, createEnvironment, createHalo, createPortalGate, MeshBuilder, metalTone, PORTAL_HEIGHT, PORTAL_WIDTH, type Alloy, type EnvironmentOptions, type PortalGate } from "nswp-sdk/home";
import { addGateControls, worldGate, type PaidGate, addBagControls, addItemControls, type ItemControls, createBag, createItems, createDoorRatings, worldPersonLines, addAchievementControls, addCameraControls, addPanelControls, addRoomControls, addScoreControls, createAchievements, createScores, type Achievements, signerNamed, worldPeople, worldSigner, type Scores, lookScale, createFps, type Fps, addSoundControls, createSounds, type SoundTheme, addJump, createFloorMarks, createDragLook, createStepPace, createStroll, currentForm, DOOR_REACH, KEY_TURN, reachOf, RUN, TAP_REACH, addViewControls, capturePanorama, createConsole, createCrossing, createFigure, createPanels, createPresence, createStay, createXrInput, type PanelContent, type PanelPlace, type Panels, type GrabOptions, type XrInput, panoramaTexture, textSprite, type Camera, type Figure, type FigureStyle, type XrConsole } from "nswp-sdk/three";
import { addDoorControls, createControls, mountHud, type Controls, type MenuDoor } from "nswp-sdk/ui";
import previews from "../previews/index.json";
import sites from "../sites.json";

type V3 = [number, number, number];
/**
 * `category` is what kind of place it is, as its own announcement says (the build checks the two agree). `modes`,
 * `capabilities` and `items` are what it offers, word for word from the same announcement and checked the same way:
 * a door says them from what its own site was told, and never asks the place it leads to.
 */
type Place = { d: string; url: string; title?: string; category?: string; modes?: string[]; capabilities?: string[]; items?: string };
const places: Record<string, Place> = { ...sites.worlds, ...sites.elsewhere };
/** Whether sites.json says what a place does with the things visitors carry, in one of the words there are. Saying nothing is not saying `allowed`. */
const isItemsRule = (rule: unknown): rule is ItemsRule => typeof rule === "string" && (ITEM_RULES as readonly string[]).includes(rule);

export interface Door {
  /** Which world it leads to: a name from sites.json. */
  to: string;
  /** What its sign says. */
  label: string;
  position: V3;
  /** Degrees about the vertical. Left out, it faces where visitors arrive. */
  rotation?: number;
}

export interface WorldKit {
  scene: THREE.Scene;
  accent: THREE.Color;
  /** One builder for everything that stays still. Its tone is this world's metal. */
  builder: MeshBuilder;
  /** This world's metal with a little of its accent in it: for seats, leaves, things to notice. */
  soft: THREE.Color;
  /** Where the visitor's head is, kept up to date. */
  head: THREE.Vector3;
  /** Everything a visitor can do here. Add to it, or say a few words with `controls.say()`. */
  controls: Controls;
  /** A surface to draw a mesh of your own in. It is kept in time with the rest. */
  alloy(options?: { gloss?: number; sheen?: number }): Alloy;
  /** A sign that faces the reader. The first line is its heading; the rest is wrapped to fit. */
  sign(heading: string, text: string, at: V3, width?: number): THREE.Sprite;
  /** A soft glow, for round anything that gives off light. */
  halo(at: V3, size?: number): THREE.Sprite;
  /** Leave a note for tests: it shows up in `__nswpTest.state`. */
  note(key: string, value: unknown): void;
  /**
   * Play one of the kit's own sounds: at the visitor's own volume, and not at all where they have effects off.
   * A world plays the kit's sounds for its own moments rather than bring files of its own.
   */
  sound(cue: "grab" | "drop" | "notice" | "press" | "land"): void;
  /**
   * This world's scores (protocol/15-scores.md), where it names boards in its configuration; null where it names
   * none. `scores.record(board, score)` keeps a visitor's best on the device. Posting it is theirs to do, from
   * the Scores tab the kit adds to the menu.
   */
  scores: Scores | null;
  /**
   * This world's achievements (protocol/16-achievements.md), where it names some in its configuration; null where
   * it names none. `achievements.earn(id)` keeps what a visitor earned on the device. Showing it is theirs to do,
   * from the Achievements tab the kit adds to the menu.
   */
  achievements: Achievements | null;
  /**
   * Make something a visitor in a headset can pick up: with a controller's
   * grip, or a pinch of tracked fingers. Give the object a `name` to tell it
   * apart. Nobody needs to pick anything up to get around.
   */
  grabbable(object: THREE.Object3D, options?: GrabOptions): void;
  /**
   * Hang a panel: a note, a picture or a video in a frame a visitor can
   * move, resize and put away. Without a place it hangs in front of where
   * they arrive. A world's own panels are there for every visitor, and are
   * not kept by any of them.
   */
  panel(content: PanelContent, place?: Partial<PanelPlace>): void;
}

export interface WorldHandle {
  update?(t: number, dt: number): void;
  /** May a visitor stand here? Asked on top of the world's `reach`. */
  canStand?(x: number, z: number): boolean;
  /** Things to leave out of the preview picture, such as a score. */
  hideFromPreview?: THREE.Object3D[];
}

export interface WorldConfig {
  /** This world's name in sites.json. */
  site: string;
  title: string;
  /** One or two sentences: what this place is for. Shown on the sign where visitors arrive. */
  purpose: string;
  palette: { ground: number; accent: number; text: string };
  /**
   * This world's own sounds: a file of its own for any of the kit's cues, or null to silence one, and its own
   * music or null for none. Whatever it doesn't name keeps the kit's default.
   */
  sounds?: SoundTheme;
  /** False where this world wants no music shared between visitors. Each still hears their own. */
  sharedMusic?: boolean;
  /**
   * The boards this world keeps score on, if it keeps score at all (protocol/15-scores.md). Optional: left out,
   * there is no Scores tab and nothing about scores anywhere.
   */
  boards?: Board[];
  /**
   * What this world does with the things visitors carry (protocol/17-items.md): "allowed" or "play". Left out,
   * nothing carried is drawn or works here. It must be what the world's announcement says.
   */
  items?: ItemsRule;
  /**
   * What this world marks, if it marks anything (protocol/16-achievements.md). Optional: left out, there is no
   * Achievements tab and nothing about achievements anywhere.
   */
  achievements?: Achievement[];
  /** Positions in metres; yaw in degrees, 0 facing -Z. */
  entryPoints: Record<string, { position: V3; yaw: number }>;
  doors: Door[];
  /** How far from `middle` a visitor may go, in metres. Default 14 from the origin. */
  reach?: number;
  middle?: [number, number];
  environment?: EnvironmentOptions;
  /** Where the sign that says what this place is for hangs. Left out: ahead of the visitor and a little to the left. */
  welcome?: V3;
  /** How much room the controls take: a game asks for "quiet". */
  quiet?: boolean;
  /**
   * A gate (protocol/10-identity.md, "The front room" and "A world's own lists"). The world puts it where it
   * likes: everything before it is free to anyone. Past it is for someone who holds a receipt, where the world is
   * paid; and never for someone its owner keeps out, where it keeps lists.
   *
   * `on` is whether this world needs one at all: whether its own world.json names what it is entered by
   * (`access`), whose lists count (`keepers`), or that its rooms show only named people (`named_only`). It is false
   * in every world here, and then there is no gate, nothing is read and nothing is asked: the world is exactly as
   * it was. Making a world paid, or giving it lists, is its owner's word.
   */
  gate?: {
    on: boolean;
    /** Whether a spot on the floor is past the gate. */
    past(x: number, z: number): boolean;
    /** Where the gate is drawn while it is shut: a sheet of light across the way. */
    veil: { position: V3; rotation?: number; width: number; height?: number };
  };
  build(kit: WorldKit): WorldHandle | void;
}

type TestHooks = {
  marks?: () => { ring: [number, number] | null; dot: [number, number] | null; dots: number; turns: number };
  /** The way they are walking: each spot still ahead. */
  path?: () => number[][];
  jump?: { jump(): boolean; readonly height: number; readonly airborne: boolean };
  state: Record<string, unknown>;
  doors(): { label: string; to: string; url: string; position: number[] }[];
  /** The tiles beside each door that say what its world offers: what each says, where it is, and where on the screen just now. */
  offers?(): { label: string; tiles: { id: string; on: boolean; words: string; where: number[]; screen: number[]; ahead: boolean }[] }[];
  goThrough(i: number): Promise<void>;
  /** Kept for older scripts: go through the first door. */
  goThroughPortal(): Promise<void>;
  roomInfo?: () => unknown;
  /**
   * This page's own signer, or null where it names none: what any script of the world's already has. For a test
   * to ask what no control here asks yet (a purchase, whether something is held). Nothing is signed, paid or
   * handed over but at the visitor's press on their sign-in address's own page, whoever asks.
   */
  signer?: () => unknown;
  /** The gate of a paid world: how it stands, what it offers, why it is shut. Null where this world has none. */
  gate?: () => Record<string, unknown> | null;
  /** Items in play: what is in the air and stuck, this visitor's health, what their item shows. For tests. */
  play?: () => unknown;
  /** What is under the thumb on a touch screen (the sight and the item's buttons), or null. */
  thumbs?: () => unknown;
  /** How far the view is tilted by dragging, in degrees: up is positive. */
  tilt?: () => number;
  itemUse?: () => void;
  itemSecond?: () => void;
  /** Take an item in hand by its coordinate, as Hold in the bag does (`presence.setHolding`); "" puts it away. */
  hold?: (item: string) => Promise<{ ok: boolean; said: string }>;
  sight?: (on: boolean) => void;
  /** How what they hold is swaying just now, across and up (presence.heldBob). */
  heldBob?: () => [number, number];
  view?: () => { fov: number; sighting: boolean };
  /** What the visitor's hands are doing, as the input layer reads them. */
  input?: () => unknown;
  /** The panels hanging here. */
  panels?: Panels;
  /** What this place sounds like: cues, its music, and the visitor's own. */
  sounds?: unknown;
  /** Game controls on a desk: the mouse looks, keys walk. */
  fps?: Fps;
  /** The menu on a flat screen. */
  hud?: { readonly open: boolean; setOpen(open: boolean): void };
  /** Where a named thing is on the page, in pixels, or null if it is behind the visitor. */
  screenOf?: (name: string) => number[] | null;
  /** Where a crossing stands: arriving in the chamber, its doors opening, leaving, or none. */
  crossing?: () => string;
  /** What the hand in a slot points at: a button of the console, something on a panel, a door, or nothing. */
  pointedAt?: (slot: number) => string | null;
  /** Where on the floor the hand in a slot points, or null. */
  pointing?: (slot: number) => number[] | null;
  /** Which way the visitor has been turned, in degrees. */
  heading?: () => number;
  /** Where a named thing is: in the world, and in the space a headset's controllers are placed in. */
  thing?: (name: string) => { world: number[]; local: number[] } | null;
  /** Capture this world's preview panorama (spec §5.8), as a base64 WebP. */
  capturePreview?: (width?: number) => Promise<{ base64: string; width: number; height: number; bytes: number }>;
  teleport?: (x: number, z: number) => void;
  /** Turn the view: degrees to the left of -Z, and degrees up. */
  face?: (yaw: number, pitch?: number) => void;
  /** Point at a spot on the floor and select it, as a visitor would. */
  step?: (x: number, z: number) => void;
  /** The pace of stepping in a headset: whether a step may be taken now, and how long until one may. */
  pace?: { readonly ready: boolean; readonly wait: number };
  where?: () => number[];
  /** What the last frame cost to draw. */
  drawn?: () => { calls: number; triangles: number };
  /** Stand a visitor's figure somewhere, to see how one looks. */
  figure?: (x: number, z: number, yaw?: number, seed?: string, skin?: string) => unknown;
  device?: unknown;
  controls?: Controls;
  console?: XrConsole;
  /** The visitor's camera: what it has taken. */
  camera?: Camera;
};

declare global {
  interface Window {
    __nswpTest?: TestHooks;
    /**
     * For a trial on the maker's own network, set by a script before the page starts: `gate: true` has a world that
     * can have a gate use it, with what it is entered by read from its own manifest as ever. It is looked at only
     * on a local address, so no link and no script can change what a published world is; and all it can do is shut
     * a gate, never open one.
     */
    __nswpTrial?: { gate?: boolean };
  }
}

/** Break a paragraph into lines of about `width` letters. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line && (line + " " + word).length > width) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Whether a world's own world.json asks for a gate: it names what the world is entered by (`access`), whose lists
 * count (`keepers`), that its rooms show only named people (`named_only`), or that it is by invitation
 * (`by_invitation`). None of the worlds here does.
 */
export function needsGate(world: Record<string, unknown>): boolean {
  return (Array.isArray(world.access) ? world.access.length > 0 : world.access !== undefined) || world.keepers !== undefined || world.named_only === true || world.by_invitation === true;
}

export async function startWorld(cfg: WorldConfig): Promise<void> {
  // Read and scrub the arrival context before anything else (spec §4.4).
  const { context, warnings } = arrival.read();
  configure({ defaultAirlock: sites.airlock, defaultSigner: sites.signer });

  const emulate = new URLSearchParams(location.search).get("xr") === "emulate";
  const state: Record<string, unknown> = { world: cfg.title, arrival: context, arrivalWarnings: warnings, emulate, xr: "idle", ready: false };
  const hooks: TestHooks = { state, doors: () => [], goThrough: async () => {}, goThroughPortal: async () => {} };
  window.__nswpTest = hooks;
  if (emulate) {
    const { XRDevice, metaQuest3 } = await import("iwer");
    const device = new XRDevice(metaQuest3, { stereoEnabled: false });
    device.installRuntime({ forceInstall: true });
    hooks.device = device;
  }

  // ------------------------------------------------------------- the stage
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");
  document.getElementById("stage")!.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cfg.palette.ground);
  const accent = new THREE.Color(cfg.palette.accent);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 700);
  camera.position.set(0, 1.6, 0);
  const rig = new THREE.Group();
  rig.add(camera);
  scene.add(rig);

  const entryName = context?.entry && cfg.entryPoints[context.entry] ? context.entry : "main-entrance";
  const spawn = cfg.entryPoints[entryName]!;
  rig.position.set(...spawn.position);
  rig.rotation.y = THREE.MathUtils.degToRad(spawn.yaw);
  state.entryPoint = entryName;
  // A refresh is not an arrival: whoever was here is put back where they stood, facing the way they faced.
  const stay = createStay();
  const stood = context ? null : stay.before;
  if (stood) {
    rig.position.set(stood.x, spawn.position[1], stood.z);
    rig.rotation.y = THREE.MathUtils.degToRad(stood.yaw);
  }
  state.stood = !!stood;
  const keepPlace = () => stay.keep({ x: rig.position.x, z: rig.position.z, yaw: THREE.MathUtils.radToDeg(rig.rotation.y), headset: renderer.xr.isPresenting });
  addEventListener("pagehide", keepPlace);
  setInterval(keepPlace, 1000);

  // Everything modelled is drawn without lights; this is for anything a world adds that needs one.
  scene.add(new THREE.HemisphereLight(0xffffff, cfg.palette.ground, 1.2));

  // ------------------------------------------------------------- the controls
  const controls = createControls({ title: cfg.title, address: location.host, theme: { accent: `#${accent.getHexString()}` } });
  const hud = mountHud(controls);
  hooks.controls = controls;
  hooks.signer = () => (signerNamed() ? worldSigner() : null);
  hooks.hud = hud;
  // The gate of a paid world, where this world is one. None here is: `on` is false in every world.json's reading,
  // so no gate is made and nothing of this runs. What it is entered by is read from the world's own manifest.
  const gate: PaidGate | null = cfg.gate && (cfg.gate.on || (isLocalHost(location.hostname) && window.__nswpTrial?.gate === true)) ? worldGate() : null;
  const pastGate = (x: number, z: number): boolean => !!gate && !gate.open && cfg.gate!.past(x, z);
  hooks.gate = () => gate?.info() ?? null;
  // Its one control, in the console like every other, so it is the same on a flat screen and in a headset. Added
  // here, ahead of this world's doors: where the way is shut, it is the first thing a visitor came to do.
  const gateRows = gate ? addGateControls(controls, gate, { presenting: () => renderer.xr.isPresenting }) : null;
  // Sound: the kit's cues unless this world names its own, the place's music, and the visitor's own. Their volumes
  // are theirs, kept for this site.
  const sounds = createSounds({ context: THREE.AudioContext.getContext() as unknown as AudioContext, seed: cfg.title, kit: "/sounds/kit/", theme: { music: ["/sounds/music.ogg", "/sounds/music-2.ogg"], ...cfg.sounds } });
  addSoundControls(controls, sounds);
  hooks.sounds = sounds;
  if (cfg.quiet) {
    // A game has an interface of its own, and the keyboard is for playing (spec §21.3).
    controls.setPresence("quiet");
    controls.setCorner("top-right");
    controls.setKeys({ hotbar: false });
  }

  // ------------------------------------------------------------- the place
  const environment = createEnvironment(accent, { ground: cfg.palette.ground, ...cfg.environment });
  scene.add(environment.group);
  const builder = new MeshBuilder();
  builder.tone = metalTone(cfg.palette.ground);
  const alloys: Alloy[] = [];
  const alloy: WorldKit["alloy"] = (options = {}) => {
    const made = createAlloy(accent, { ground: cfg.palette.ground, gloss: 0.55, ...options });
    alloys.push(made);
    return made;
  };
  const head = new THREE.Vector3();
  camera.getWorldPosition(head);
  // Settles when the world is drawn and ready to be walked into.
  let worldOpened = () => {};
  const opened = new Promise<void>((resolve) => (worldOpened = resolve));
  // Hands in a headset are set up further down, once there is something to point with.
  let input: XrInput | null = null;
  const toHold: [THREE.Object3D, GrabOptions | undefined][] = [];
  let panels: Panels | null = null;
  const toHang: [PanelContent, Partial<PanelPlace> | undefined][] = [];
  // Scores, for a world that names boards (protocol/15-scores.md). The world's own code records what a visitor
  // scored; it is kept on the device, and posted only when the visitor says to, from the menu.
  const signedInHere = () => signerNamed() && worldSigner().state === "unlocked";
  const scores: Scores | null = cfg.boards?.length
    ? createScores({
        world: `${WORLD_KIND}:${sites.publisher}:${places[cfg.site]?.d ?? ""}`,
        // Where this page really is: on the world's own address that is the address it announced. A copy
        // somewhere else keeps a board of its own, and nothing posted there counts on the real one.
        worldUrl: location.origin,
        boards: cfg.boards,
        hand: { pubkey: () => (signedInHere() ? worldSigner().pubkey : null), sign: (world, board, score, said) => worldSigner().score(world, board, score, said) },
        // People this visitor follows are listed first, where they have let this world see who that is.
        counted: () => (signedInHere() && worldSigner().more.includes("follows") ? (worldPeople().follows() ?? []) : []),
      })
    : null;
  // Achievements, for a world that names some (protocol/16-achievements.md): kept on the device as they are
  // earned, and shown as the visitor's only when they say to.
  const achievements: Achievements | null = cfg.achievements?.length
    ? createAchievements({
        world: `${WORLD_KIND}:${sites.publisher}:${places[cfg.site]?.d ?? ""}`,
        worldUrl: location.origin,
        list: cfg.achievements,
        hand: { pubkey: () => (signedInHere() ? worldSigner().pubkey : null), sign: (world, id, title) => worldSigner().achieve(world, id, title) },
        counted: () => (signedInHere() && worldSigner().more.includes("follows") ? (worldPeople().follows() ?? []) : []),
      })
    : null;
  const kit: WorldKit = {
    scene,
    accent,
    builder,
    soft: builder.tone.clone().lerp(accent, 0.03),
    head,
    controls,
    alloy,
    sound(cue) {
      sounds.play(cue);
      state.sounded = [...((state.sounded as string[] | undefined) ?? []), cue].slice(-12);
    },
    sign(heading, text, at, width = 1.8) {
      const sprite = textSprite([heading, ...wrap(text, 38)].join("\n"), cfg.palette.text, width);
      sprite.position.set(...at);
      scene.add(sprite);
      return sprite;
    },
    halo(at, size = 1.5) {
      const halo = createHalo(accent, size);
      halo.position.set(...at);
      scene.add(halo);
      return halo;
    },
    note(key, value) {
      state[key] = value;
    },
    scores,
    achievements,
    grabbable(object, options) {
      if (input) input.grabbable(object, options);
      else toHold.push([object, options]);
    },
    panel(content, place) {
      if (panels) panels.open(content, { ...(place ? { place } : {}), keep: false });
      else toHang.push([content, place]);
    },
  };
  const handle = cfg.build(kit) ?? {};
  scene.add(builder.build(alloy()));

  // What this place is for, where a visitor first looks: ahead and a little to the left.
  const yawAxis = new THREE.Vector3(0, 1, 0);
  // Hung further off, it is made larger, so it reads the same from where a visitor arrives.
  const away = cfg.welcome ? Math.hypot(cfg.welcome[0] - spawn.position[0], cfg.welcome[2] - spawn.position[2]) : 0;
  const welcome = kit.sign(cfg.title, cfg.purpose, [0, 0, 0], Math.max(2.1, away * 0.36));
  if (cfg.welcome) welcome.position.set(...cfg.welcome);
  else welcome.position.set(...spawn.position).add(new THREE.Vector3(-1.75, 1.85, -3.4).applyAxisAngle(yawAxis, rig.rotation.y));

  // ------------------------------------------------------------- the doors
  // The standard doorway, with the destination's preview inside it when this
  // site mirrors one. The preview is fetched from this site, never from the
  // destination, and checked against its hash before it is shown (spec §5.8).
  const gates: { gate: PortalGate; door: Door; destination: PortalDestination; place: Place; window: THREE.Mesh | null }[] = [];
  for (const door of cfg.doors) {
    const place = places[door.to];
    if (!place) throw new Error(`${cfg.site}: no world called "${door.to}" in sites.json`);
    const destination: PortalDestination = {
      naddr: encodeNaddr({ kind: WORLD_KIND, pubkey: sites.publisher, identifier: place.d, relays: sites.relays.slice(0, 2) }),
      url: place.url,
      entryPoint: "main-entrance",
    };
    const offered = worldOffers({ modes: place.modes ?? [], capabilities: place.capabilities ?? [], ...(isItemsRule(place.items) ? { items: place.items } : {}) });
    const gate = createPortalGate(destination, { label: door.label, category: place.category ?? null, color: accent, textColor: cfg.palette.text, offers: offered });
    gate.group.position.set(...door.position);
    if (door.rotation === undefined) gate.group.lookAt(spawn.position[0], door.position[1], spawn.position[2]);
    else gate.group.rotation.y = THREE.MathUtils.degToRad(door.rotation);
    scene.add(gate.group);
    const entry = { gate, door, destination, place, window: null as THREE.Mesh | null };
    gates.push(entry);
    const hash = (previews as Record<string, { sha256: string } | undefined>)[door.to]?.sha256;
    if (hash) {
      void (async () => {
        try {
          const res = await fetch(`/previews/${hash}.webp`);
          if (!res.ok) return;
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (!checkPreviewBytes({ url: res.url, type: "pano", sha256: hash }, bytes).ok) return;
          const image = new Image();
          image.src = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
          await image.decode();
          entry.window = gate.showThrough(panoramaTexture(image));
          state.previews = ((state.previews as number | undefined) ?? 0) + 1;
        } catch {
          /* the doorway keeps its field of light */
        }
      })();
    }
  }
  hooks.doors = () => gates.map((g) => ({ label: g.door.label, to: g.door.to, url: g.place.url, position: g.gate.group.position.toArray() }));
  // The tiles beside each door, for automation: what each says, and where it is on the screen just now.
  hooks.offers = () =>
    gates.map((g) => ({
      label: g.door.label,
      tiles: g.gate.offers.targets.map((tile) => {
        const offer = g.gate.offers.offerOf(tile)!;
        const at = tile.getWorldPosition(new THREE.Vector3()).project(camera);
        const where = tile.getWorldPosition(new THREE.Vector3()).toArray();
        return { id: offer.id, on: offer.on, words: offer.words, where, screen: [Math.round(((at.x + 1) / 2) * innerWidth), Math.round(((1 - at.y) / 2) * innerHeight)], ahead: at.z < 1 };
      }),
    }));

  // ------------------------------------------------------------- leaving
  // Whether the visitor is in the room here, and heard: it goes with them, so the next place needn't ask again.
  let travelling = (): { joined: boolean; mic: boolean; blocked: string[] } => ({ joined: false, mic: false, blocked: [] });
  let movingNow = (): "intense" | "casual" => "casual";
  /**
   * Through a door. Chosen from where they stand (a click, a trigger, the menu), the crossing's room comes up round
   * them first, naming where the door says it leads. Walked into, there is nothing to bring up: they are already
   * going through it, so they go. Either way their Airlock shows the real address next, and the room they step out
   * of at the other end is the same.
   */
  const go = async (i: number, how: "chosen" | "walked" = "chosen") => {
    const g = gates[i];
    if (!g || state.leaving) return;
    state.leaving = true;
    state.left = how;
    stroll.stop();
    sounds.play("cross");
    if (how === "chosen") await crossing.leave({ title: g.door.label, address: host(g.place.url) });
    document.body.classList.add("leaving");
    await portal.go(g.destination, { xrSession: renderer.xr.getSession(), ...travelling(), moving: movingNow() });
  };
  const goHome = async () => {
    const back = arrival.returnAirlock();
    if (!back || state.leaving) return;
    state.leaving = true;
    sounds.play("cross");
    await crossing.leave({ title: "home", address: new URL(back).host });
    document.body.classList.add("leaving");
    await portal.home({ xrSession: renderer.xr.getSession(), ...travelling(), moving: movingNow() });
  };
  hooks.goThrough = go;
  hooks.goThroughPortal = () => go(0);

  // Every door, in the Travel tab: chosen, it shows its details and what its world offers, as the tiles beside it do,
  // and "Travel here" takes it the same way pointing at it does (door-controls.ts).
  const menuDoors: MenuDoor[] = gates.map((g, i) => ({
    id: String(i),
    title: g.door.label,
    url: g.place.url,
    // A door in a world doesn't ask whether the place's site vouches for it: the Airlock does, on the way.
    vouched: "unknown",
    offers: worldOffers({ modes: g.place.modes ?? [], capabilities: g.place.capabilities ?? [], ...(isItemsRule(g.place.items) ? { items: g.place.items } : {}) }),
  }));
  addDoorControls(controls, { doors: () => menuDoors, travel: (door) => void go(Number(door.id)) });
  controls.add({
    id: "home",
    section: "travel",
    icon: "home",
    hotbar: true,
    // Home is wherever the visitor's own client starts them: its own room, or a world of theirs they chose.
    label: "Go home",
    short: "Home",
    // Offered when the visitor came from a client that said where to send them back to.
    hidden: () => !arrival.returnAirlock(),
    act: () => void goHome(),
  });
  controls.addSection({
    id: "help",
    label: "Help",
    icon: "help",
    note: `${cfg.purpose} Drag to look around. Walk with W, A, S, D or the up and down arrows; the left and right arrows turn you. Or point at the floor and select to step there: twice to run. Shift runs and Space jumps. The key left of 1 brings these controls up in any world, whatever is on screen; on a touch screen, hold two fingers still. Select a doorway to see where it leads before you go. These controls are this world's own: your headset's or browser's own controls always get you out.`,
  });
  const xrConsole: XrConsole = createConsole(controls, { renderer, rig });
  scene.add(xrConsole.group);
  hooks.console = xrConsole;

  // ------------------------------------------------------------- moving
  const [midX, midZ] = cfg.middle ?? [0, 0];
  const reach = cfg.reach ?? 14;
  // Leaving and arriving happen in the kit's chamber: the same small room at both ends of every trip.
  // The room is drawn over everything where it stands; the visitor's own hands and console are drawn over it.
  const crossing = createCrossing({ scene, camera, accent, textColor: cfg.palette.text, motion: () => controls.theme.motion, keep: [rig, xrConsole.group] });
  hooks.crossing = () => crossing.state;
  // Past a shut gate nobody may stand: everything before it is free.
  const canStand = (x: number, z: number) => crossing.allows(x, z) && Math.hypot(x - midX, z - midZ) <= reach && !pastGate(x, z) && (handle.canStand?.(x, z) ?? true);
  const headAt = new THREE.Vector3();
  /** Move the visitor's head towards (x, z) in a straight line, stopping at the first place they may not stand. */
  const moveTowards = (x: number, z: number) => {
    camera.getWorldPosition(headAt);
    const dx = x - headAt.x;
    const dz = z - headAt.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1));
    let reached = 0;
    for (let i = 1; i <= steps; i++) {
      if (!canStand(headAt.x + (dx * i) / steps, headAt.z + (dz * i) / steps)) break;
      reached = i;
    }
    rig.position.x += (dx * reached) / steps;
    rig.position.z += (dz * reached) / steps;
  };
  // Stepping: point at the floor and select (click, tap, trigger or pinch) to
  // stand there. A jump, not a slide, which keeps it comfortable in a headset,
  // and the only way to move for a visitor with no keyboard.
  const raycaster = new THREE.Raycaster();
  raycaster.camera = camera; // signs are sprites, which can't be tested against a ray without it
  const STEP_MAX = 5;
  // A step in a headset lands at once, and the next waits as long as running there would have taken (the kit's
  // pace): nobody covers ground faster than a run, whatever they hold or wear.
  const pace = createStepPace();
  hooks.pace = pace;
  // On a flat screen a tap is a walk at the keys' pace, to a spot a few steps off at most (the kit's stroll).
  const stroll = createStroll({
    where: () => {
      camera.getWorldPosition(headAt);
      return [headAt.x, headAt.z];
    },
    canStand,
    move: (dx, dz) => {
      rig.position.x += dx;
      rig.position.z += dz;
    },
    onBlocked: () => sounds.bump(),
  });
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const spotAt = new THREE.Vector3();
  const floorHit = new THREE.Vector3();
  const floorUnder = (): THREE.Vector3 | null => {
    if (!raycaster.ray.intersectPlane(floor, spotAt)) return null;
    floorHit.copy(spotAt);
    camera.getWorldPosition(headAt);
    const dx = spotAt.x - headAt.x;
    const dz = spotAt.z - headAt.z;
    const far = Math.hypot(dx, dz);
    if (far < 0.3) return null;
    const most = renderer.xr.isPresenting ? STEP_MAX : TAP_REACH;
    if (far > most) spotAt.set(headAt.x + (dx / far) * most, 0, headAt.z + (dz / far) * most);
    return spotAt;
  };
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.28, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false }));
  reticle.rotation.x = -Math.PI / 2;
  reticle.renderOrder = 5;
  reticle.visible = false;
  scene.add(reticle);
  /** Is this something a visitor could be pointing at instead of the floor? The sky, the ground and glows are not. */
  const solid = (o: THREE.Object3D) => {
    if (!(o as THREE.Mesh).isMesh || o === reticle || !o.visible) return false;
    if ((o as THREE.Mesh).material && ((o as THREE.Mesh).material as THREE.Material).transparent) return false;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === environment.group) return false;
    return true;
  };
  /** Whether the ray reaches the floor it was last pointed at: pointing at a thing is not pointing at the floor behind it. */
  const floorIsClear = () => {
    const toFloor = raycaster.ray.origin.distanceTo(floorHit);
    const inTheWay = raycaster.intersectObjects(scene.children, true).find((h) => solid(h.object));
    return !(inTheWay && inTheWay.distance < toFloor - 0.05);
  };
  // The gate itself, while it is shut: a sheet of light across the way, with a bright line where it meets the floor.
  let veil: THREE.Mesh | null = null;
  const pressGate = (): void => gateRows?.press();
  if (gate && cfg.gate) {
    const at = cfg.gate.veil;
    veil = new THREE.Mesh(new THREE.PlaneGeometry(at.width, at.height ?? 4), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    veil.name = "gate";
    veil.position.set(at.position[0], at.position[1] + (at.height ?? 4) / 2, at.position[2]);
    veil.rotation.y = THREE.MathUtils.degToRad(at.rotation ?? 0);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(at.width, 0.07), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.015 - (at.height ?? 4) / 2;
    veil.add(line);
    scene.add(veil);
    const tend = () => {
      veil!.visible = !gate.open;
      state.gate = gate.info();
      // Shut with them past it (their time ran out, or they came back to where they stood): they are stood in
      // the front room again, where they arrived. Nothing is loaded again under them.
      camera.getWorldPosition(headAt);
      if (gate.state === "shut" && cfg.gate!.past(headAt.x, headAt.z)) {
        const front = cfg.entryPoints["main-entrance"]!;
        stroll.stop();
        rig.position.x += front.position[0] - headAt.x;
        rig.position.z += front.position[2] - headAt.z;
        state.putBack = ((state.putBack as number | undefined) ?? 0) + 1;
      }
    };
    gate.onChange(tend);
    tend();
  }
  /** Whether what was last pointed along reaches the shut gate, near enough to press it: as near as a door. */
  const gateAimed = (): boolean => {
    if (!veil?.visible) return false;
    const hit = raycaster.intersectObject(veil, false)[0];
    return !!hit && hit.distance <= DOOR_REACH;
  };
  // Where a press would take them, where they are going and the way there: drawn for this visitor and nobody else.
  const marks = createFloorMarks(accent);
  scene.add(marks.group);
  hooks.marks = () => marks.info();
  hooks.path = () => stroll.path.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100]);
  const stepTo = (spot: THREE.Vector3) => {
    if (!floorIsClear()) return;
    camera.getWorldPosition(headAt);
    // In a headset a step is a jump, which is what sits well there, at the pace of someone running: a press that
    // comes too soon does nothing, and the ring on the floor is dim until one would. On a flat screen it is
    // always a walk, on a phone as at a desk, with motion on or off: the same walk the keys make.
    if (renderer.xr.isPresenting) {
      if (!pace.take(Math.hypot(spot.x - headAt.x, spot.z - headAt.z))) return;
      moveTowards(spot.x, spot.z);
    } else stroll.tap(floorHit.x, floorHit.z); // where they pressed: standing, a walk there; walking, the path goes on from its end
    state.steps = ((state.steps as number | undefined) ?? 0) + 1;
  };
  hooks.step = (x, z) => {
    raycaster.ray.origin.copy(camera.getWorldPosition(new THREE.Vector3()));
    raycaster.ray.direction.set(x, 0, z).sub(raycaster.ray.origin).normalize();
    const spot = floorUnder();
    if (spot) stepTo(spot);
  };

  // ------------------------------------------------------------- input
  const targets = gates.map((g) => g.gate.target);
  // The tiles beside each door that say what its world offers: pointed at, never pressed.
  const offerTiles = gates.flatMap((g) => g.gate.offers.targets);
  /** The tile the ray is on, and whose door it is beside. The ray is wherever the last aim left it. */
  const offerAt = (): { door: number; offer: Offer } | null => {
    const tile = raycaster.intersectObjects(offerTiles, false)[0]?.object;
    if (!tile) return null;
    const door = gates.findIndex((g) => g.gate.offers.targets.includes(tile as THREE.Mesh));
    const offer = door >= 0 ? gates[door]!.gate.offers.offerOf(tile) : null;
    return offer ? { door, offer } : null;
  };
  /** Which door a pointed-at thing is, whether or not it is near enough to choose. */
  const anyDoorAt = (object: THREE.Object3D | undefined) => gates.findIndex((g) => g.gate.target === object);
  const gateAt = new THREE.Vector3();
  /** How far the visitor is from a door, over the floor. */
  const doorFar = (i: number) => {
    camera.getWorldPosition(headAt);
    gates[i]!.gate.group.getWorldPosition(gateAt);
    return Math.hypot(gateAt.x - headAt.x, gateAt.z - headAt.z);
  };
  /**
   * Which door a pointed-at thing is, if it is near enough to choose from where they stand: within ten feet. A door
   * across the place is not lit and can't be gone through by a press, so nobody leaves by a stray click on one.
   * Walking into a doorway goes through whatever this says.
   */
  const doorAt = (object: THREE.Object3D | undefined) => {
    const i = anyDoorAt(object);
    return i >= 0 && doorFar(i) <= DOOR_REACH ? i : -1;
  };
  const pointer = new THREE.Vector2(2, 2);
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  // A drag looks round: sideways it turns them, up and down it tilts the view, within about sixty degrees, and the
  // view comes back level as they walk (stroll.ts, `createDragLook`). Moving the intense way or in a headset, the
  // view is the mouse's or the head's, and this leaves it alone.
  const dragLook = createDragLook({ rig, camera, scale: lookScale });
  let moved = 0;
  let downAt = 0;
  const setPointer = (e: PointerEvent) => pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  // A panel taken by its bar is dragged; anything else, and the drag turns the view.
  let panelDrag = false;
  // Game controls, for a visitor who turned them on: the mouse looks, keys walk, F uses. While they are on, the
  // clicks and drags below stand down.
  let fps: Fps | null = null;
  const gameControls = () => !!fps?.enabled && !renderer.xr.isPresenting;
  /** Which of the two ways the visitor is moving now, on the device they are using: it goes with them through a door. */
  movingNow = () => ((renderer.xr.isPresenting ? input?.intense : fps?.enabled) ? "intense" : "casual");
  /** Use what the middle of the view points at: a panel, or a door. */
  const use = () => {
    pointer.set(0, 0);
    raycaster.setFromCamera(pointer, camera);
    const onPanel = panels?.pick(raycaster);
    if (onPanel) return void panels!.press(onPanel);
    // Someone's picture, over their head: pressing it chooses them.
    if (presence.pressAt(raycaster)) return;
    // Moving the intense way, a door is gone through by walking into it and no other way.
  };
  fps = createFps({ dom: renderer.domElement, camera, rig, controls, hud, canStand, presenting: () => renderer.xr.isPresenting, onUse: use, onBlocked: () => sounds.bump(), arrived: context?.moving === "intense" && !context.immersive });
  hooks.fps = fps;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (gameControls()) return;
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    panelDrag = !renderer.xr.isPresenting && !!panels?.pointer("down", raycaster);
    dragging = !panelDrag;
    lastX = e.clientX;
    lastY = e.clientY;
    moved = 0;
    downAt = performance.now();
  });
  addEventListener("pointerup", (e) => {
    dragging = false;
    if (panelDrag) {
      panelDrag = false;
      raycaster.setFromCamera(pointer, camera);
      panels?.pointer("up", raycaster);
      return;
    }
    if (moved > 6 || renderer.xr.isPresenting || gameControls() || e.target !== renderer.domElement) return;
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const onPanel = panels?.pick(raycaster);
    if (onPanel) return void panels!.press(onPanel);
    // With something in hand that does something, a tap is its first press, sent where they tapped. A press held
    // is still how they walk, choose someone or go through a door.
    if (itemControls?.tap(raycaster.ray, performance.now() - downAt, e.pointerType)) return;
    if (presence.pressAt(raycaster)) return;
    const any = anyDoorAt(raycaster.intersectObjects(targets, false)[0]?.object);
    // The shut gate, pressed from as near as a door is pressed: the same as its control in the console.
    if (any < 0 && gateAimed()) return pressGate();
    if (any >= 0 && doorFar(any) <= DOOR_REACH) void go(any);
    else if (any >= 0) {
      // A door too far off to choose: a press on it is a few steps towards it, like a press on the floor in front of it.
      gates[any]!.gate.group.getWorldPosition(gateAt);
      camera.getWorldPosition(headAt);
      stroll.to(...reachOf(headAt.x, headAt.z, gateAt.x, gateAt.z));
    } else {
      const spot = floorUnder();
      if (spot) stepTo(spot);
    }
  });
  renderer.domElement.addEventListener("pointerleave", () => pointer.set(2, 2));
  addEventListener("pointermove", (e) => {
    if (dragging && !renderer.xr.isPresenting) {
      dragLook.drag(e.clientX - lastX, e.clientY - lastY);
      moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
    }
    if (!gameControls()) setPointer(e);
    if (panelDrag) {
      raycaster.setFromCamera(pointer, camera);
      panels?.pointer("move", raycaster);
    }
  });

  // In a headset: a `select` from any input source.
  const rotation = new THREE.Matrix4();
  const aimFrom = (source: THREE.Object3D): number => {
    rotation.identity().extractRotation(source.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(source.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
    return doorAt(raycaster.intersectObjects(targets, false)[0]?.object);
  };
  const controllers: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    c.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5)]),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
      ),
    );
    c.addEventListener("select", () => {
      if (input?.claimed(i)) return; // that pinch picked something up; it wasn't a press
      state.lastSelect = i;
      const door = aimFrom(c); // leaves the ray where this hand points
      // While the keyboard is up it is in front of everything, the console's own button included.
      const key = panels!.keyboard.pick(raycaster);
      const button = key ? null : xrConsole.pick(raycaster);
      const onPanel = key ?? (button ? null : panels!.pick(raycaster));
      // The hand that holds something that does something: its trigger is the item's, on anything but the console.
      if (!button && !key && !onPanel && itemControls?.trigger(i)) return void input?.pulse(i, 0.4, 25);
      const person = button || onPanel ? null : presence.personAt(raycaster);
      if (button || onPanel || person || door >= 0) input?.pulse(i, 0.5, 30);
      if (button) xrConsole.press(button);
      else if (onPanel) panels!.press(onPanel);
      else if (person) presence.pressAt(raycaster);
      else if (door >= 0) void go(door);
      else if (gateAimed()) pressGate();
      else {
        const spot = floorUnder();
        if (spot) stepTo(spot);
      }
    });
    rig.add(c);
    controllers.push(c);
  }
  // Sticks, grips and buttons, for visitors who have them (the kit's input layer). Stepping with a stick is the
  // same step as pointing at the floor and selecting.
  input = createXrInput({
    renderer,
    scene,
    rig,
    camera,
    canStand,
    controls,
    // They left a headset moving the intense way: the same here.
    arrivedIntense: context?.moving === "intense" && !!context.immersive,
    accent,
    pace,
    stepFrom: (i) => {
      aimFrom(controllers[i]!);
      const spot = floorUnder();
      if (spot) stepTo(spot);
    },
    onMenu: () => xrConsole.setOpen(!xrConsole.open),
    onJump: () => void jump.jump(),
    // The visitor's own way to their controls, whatever this world is showing: the menu button held.
    onSummon: () => xrConsole.setOpen(true),
  });
  for (const [object, options] of toHold) input.grabbable(object, options);
  hooks.input = () => input!.info();
  // Panels: notes, pictures and video in frames a visitor can move about. Taken by the bar with a grip, or pressed
  // with a select like everything else.
  panels = createPanels({ scene, camera, accent, textColor: cfg.palette.text, input, session: () => renderer.xr.getSession() });
  for (const [content, place] of toHang) panels.open(content, { ...(place ? { place } : {}), keep: false });
  // The visitor's own panels, as in every world: a note, a picture or a video of theirs, hung where they like.
  addPanelControls(controls, panels, { presenting: () => renderer.xr.isPresenting });
  hooks.panels = panels;
  hooks.pointedAt = (slot) => {
    const door = aimFrom(controllers[slot]!);
    const key = panels?.keyboard.pick(raycaster);
    const button = key ? null : xrConsole.pick(raycaster);
    return key ?? (button ? `console:${button}` : (panels?.pick(raycaster) ?? (door >= 0 ? `door:${door}` : null)));
  };
  hooks.pointing = (slot) => {
    aimFrom(controllers[slot]!);
    const spot = floorUnder();
    return spot ? [Math.round(spot.x * 100) / 100, Math.round(spot.z * 100) / 100] : null;
  };

  // Walking into a doorway also goes through it.
  const local = new THREE.Vector3();
  const walkedInto = (): number => {
    for (let i = 0; i < gates.length; i++) {
      gates[i]!.gate.group.worldToLocal(local.copy(head));
      if (Math.abs(local.x) < PORTAL_WIDTH / 2 - 0.15 && local.y > 0 && local.y < PORTAL_HEIGHT && Math.abs(local.z) < 0.25) return i;
    }
    return -1;
  };

  // Without a headset: W, A, S, D, and the arrow keys. Up and down walk; left and right turn (the owner's ask of
  // 2026-11-20), so someone can get about with one hand and no mouse. A and D still step to the side.
  const keys = new Set<string>();
  addEventListener("keydown", (e) => {
    if (!(e.target instanceof HTMLButtonElement)) keys.add(e.code);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());
  const stride = new THREE.Vector3();
  const walk = (dt: number) => {
    const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const turn = (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0);
    if (turn) {
      stroll.stop(); // a walk a tap began turns them its own way
      rig.rotation.y += turn * KEY_TURN * dt;
    }
    if (!forward && !strafe) return;
    stroll.stop(); // the keys take over from a walk a tap began
    // Shift runs, moving the casual way as it does the intense way.
    const pace = 2.4 * (keys.has("ShiftLeft") || keys.has("ShiftRight") ? RUN : 1);
    stride.set(strafe, 0, -forward).normalize().multiplyScalar(pace * dt).applyAxisAngle(yawAxis, rig.rotation.y);
    // Try the whole step, then each direction alone, so a visitor slides along an edge instead of sticking to it.
    if (canStand(head.x + stride.x, head.z + stride.z)) rig.position.add(stride);
    else if (canStand(head.x + stride.x, head.z)) rig.position.x += stride.x;
    else if (canStand(head.x, head.z + stride.z)) rig.position.z += stride.z;
    else sounds.bump();
  };

  // ------------------------------------------------------------- the room
  // Other visitors appear only after someone presses Join (spec §9.4).
  let refreshRoom = () => {};
  let itemControls: ItemControls | null = null;
  // They are drawn to the others as they chose to arrive: wearing their look, or plain (spec §4.2).
  // What this world does with items. `?items=none` (or `play`) is for trying another rule on a copy of a world, on the
  // maker's own network: a published world is what its announcement says and nothing a link can change, or a
  // link could put someone in a place where items work with no warning on any door.
  const onMyNetwork = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);
  const itemsRule = cleanItemsRule((onMyNetwork ? new URLSearchParams(location.search).get("items") : null) ?? cfg.items);
  const items = createItems();
  // An item's own logic runs here, in its locked box, where this world draws items at all.
  const presence = createPresence({ scene, camera, rig, renderer, controllers, items, itemsRule: () => itemsRule, itemScripts: itemsRule !== "none", sounds, theme: () => ({ accent: controls.theme.accent, motion: controls.theme.motion }), labelColor: cfg.palette.text, look: () => arrival.look(), identity: () => arrival.identity(), onChange: () => (refreshRoom(), itemControls?.refresh()) });
  // What someone has done here goes on their card, where this world keeps score or marks anything.
  const about = scores || achievements ? worldPersonLines({ scores, achievements }) : null;
  about?.onChange(() => refreshRoom());
  let followingTab: ReturnType<typeof addRoomControls>["following"];
  ({ refresh: refreshRoom, travelling, following: followingTab } = addRoomControls(controls, presence, { about, onState: (room) => (state.room = room), arrived: context, panels, sounds, presenting: () => renderer.xr.isPresenting, ...(cfg.sharedMusic === false ? { sharedMusic: false } : {}) }));
  // Its boards, where it keeps score: a tab of the menu, with the way to post and who else is on each.
  if (scores) {
    const scoring = addScoreControls(controls, {
      scores,
      profiles: followingTab.profiles,
      signedIn: signedInHere,
      // Someone on a board, chosen: who they are, in Following, where they can be followed or not.
      choose: (pubkey) => {
        followingTab.choose(pubkey);
        hud.setOpen(true, "following");
      },
    });
    if (signerNamed()) worldSigner().onChange(() => scoring.refresh());
  }
  // What the people this visitor follows thought of the places these doors lead to, on each door's sign
  // (protocol/13-ratings.md). Their own rating always counts; the people they follow do where they have let this
  // world see who that is. Asked of relays by world. For a guest nothing is asked or shown.
  const coordinateOf = (place: Place) => `${WORLD_KIND}:${sites.publisher}:${place.d}`;
  const doorRatings = createDoorRatings({
    doors: gates.map((g) => ({ world: coordinateOf(g.place), url: g.place.url })),
    me: () => (signedInHere() ? worldSigner().pubkey : null),
    counted: () => (signedInHere() && worldSigner().more.includes("follows") ? worldPeople().follows() : null),
  });
  const paintRatings = () => {
    for (const g of gates) g.gate.setRating(doorRatings.mark(coordinateOf(g.place)));
    // For tests: what each door's sign says of its place.
    state.rated = Object.fromEntries(gates.map((g) => [g.door.to, doorRatings.mark(coordinateOf(g.place))]));
  };
  doorRatings.onChange(paintRatings);
  if (signerNamed()) {
    const look = () => {
      // Who they follow is looked for once they have let this world see it, and the signs follow.
      if (signedInHere() && worldSigner().more.includes("follows") && worldPeople().follows() === null) void worldPeople().load();
      void doorRatings.load();
    };
    worldSigner().onChange(look);
    worldPeople().onChange(paintRatings);
    look();
  }
  // Their bag, and the one thing in their hand (protocol/17-items.md). It is looked through here, and changed
  // at their home. In a world that draws nothing carried, it says so.
  const bag = createBag({ me: () => (signedInHere() ? worldSigner().pubkey : null) });
  const bagging = addBagControls(controls, {
    bag,
    items,
    me: () => (signedInHere() ? worldSigner().pubkey : null),
    rule: () => itemsRule,
    place: () => cfg.title,
    holding: () => presence.holding,
    hold: async (item, tints) => {
      const done = await presence.setHolding(item, tints);
      state.holding = presence.holding || null;
      return done;
    },
    tinted: (item, tints) => void (presence.holding === item && presence.setTints(tints)),
    keyboard: () => panels?.keyboard ?? null,
    presenting: () => renderer.xr.isPresenting,
  });
  if (signerNamed()) worldSigner().onChange(() => bagging.refresh());
  // What is in their hand, pressed: on the bar, by the mouse and R at a desk, by the trigger in a headset.
  itemControls = addItemControls(controls, { play: () => presence.play, holdingHand: () => presence.holdingHand, dom: renderer.domElement, sight: (on) => presence.setSighting(on), presenting: () => renderer.xr.isPresenting });
  hooks.thumbs = () => itemControls?.thumbs() ?? null;
  hooks.tilt = () => Math.round(THREE.MathUtils.radToDeg(dragLook.pitch) * 10) / 10;
  hooks.sight = (on) => presence.setSighting(on);
  hooks.heldBob = () => presence.heldBob;
  hooks.view = () => ({ fov: Math.round(camera.fov * 10) / 10, sighting: presence.sighting });
  hooks.play = () => presence.play?.info() ?? null;
  hooks.itemUse = () => presence.play?.use();
  hooks.itemSecond = () => presence.play?.second();
  hooks.hold = (item) => presence.setHolding(item);
  if (achievements) {
    const achieving = addAchievementControls(controls, { achievements, signedIn: signedInHere });
    if (signerNamed()) worldSigner().onChange(() => achieving.refresh());
  }
  hooks.roomInfo = () => presence.info();
  // How loud other people are is the visitor's to set, with the rest of their volumes.
  sounds.onChange((levels) => presence.setVolume(levels.off ? 0 : levels.voices));
  // A camera of the visitor's own: pictures, selfies and clips, saved to their device.
  hooks.camera = addCameraControls(controls, {
    renderer,
    scene,
    camera,
    look: () => presence.selfLook(),
    recording: (on) => presence.setRecording(on),
    hide: () => [xrConsole.group, reticle, welcome],
    name: cfg.title,
  });

  // ------------------------------------------------------------- for tests
  const figures: Figure[] = [];
  hooks.teleport = (x, z) => {
    rig.position.x = x - camera.position.x;
    rig.position.z = z - camera.position.z;
  };
  hooks.where = () => {
    const at = camera.getWorldPosition(new THREE.Vector3());
    return [Math.round(at.x * 100) / 100, Math.round(at.z * 100) / 100];
  };
  hooks.heading = () => Math.round(THREE.MathUtils.radToDeg(rig.rotation.y) * 10) / 10;
  hooks.thing = (name) => {
    const object = scene.getObjectByName(name);
    // A key of the keyboard or a cell of the library has no object of its own: the kit says where it is.
    const world = object ? object.getWorldPosition(new THREE.Vector3()) : (panels?.pointOf(name) ?? null);
    if (!world) return null;
    return { world: world.toArray().map((n) => Math.round(n * 1000) / 1000), local: rig.worldToLocal(world.clone()).toArray() };
  };
  hooks.screenOf = (name) => {
    const object = scene.getObjectByName(name);
    if (!object) return null;
    const at = object.getWorldPosition(new THREE.Vector3()).project(camera);
    return at.z > 1 ? null : [Math.round(((at.x + 1) / 2) * innerWidth), Math.round(((1 - at.y) / 2) * innerHeight)];
  };
  hooks.drawn = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
  // Stand a figure somewhere, to see how one looks: from a seed, as it is or re-dressed in one of three ways.
  const skins: Record<string, FigureStyle> = {
    plastic: { material: () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.1 }) },
    drab: { palette: [0x4b5320, 0x6b6f4a, 0x2f3524, 0xc2b280, 0xff7a1a], material: () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }) },
    wire: { material: (light) => new THREE.MeshBasicMaterial({ color: light, wireframe: true }) },
    plain: { omit: ["accessory", "shoulders"], palette: [0x1c2530, 0x8fa3b8, 0x4cc9f0] },
  };
  hooks.figure = (x, z, yaw = 0, seed = "visitor", skin) => {
    const figure = createFigure(seed, skin ? skins[skin] : undefined);
    figure.group.position.set(x, 1.6, z);
    figure.group.rotation.y = THREE.MathUtils.degToRad(yaw);
    scene.add(figure.group);
    figures.push(figure);
    return figure.look;
  };
  hooks.face = (yaw, pitch = 0) => {
    rig.rotation.y = THREE.MathUtils.degToRad(yaw);
    camera.rotation.x = THREE.MathUtils.degToRad(pitch);
  };

  // ------------------------------------------------------------- preview
  hooks.capturePreview = async (width = 2048) => {
    const main = cfg.entryPoints["main-entrance"]!;
    // Left out: the sign of welcome, anything about one visitor, and the views
    // through the doors, since a preview that held another world's preview
    // would change every time either was retaken.
    const hide: THREE.Object3D[] = [welcome, ...(handle.hideFromPreview ?? []), ...gates.flatMap((g) => (g.window ? [g.window] : []))];
    const blob = await capturePanorama(renderer, scene, new THREE.Vector3(main.position[0], 1.6, main.position[2]), { width, hide });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { base64: btoa(binary), width, height: width / 2, bytes: bytes.length };
  };

  // Someone who came through an Airlock starts in the chamber, and its doors open when the world is ready. If they
  // left a headset session to get here, the one thing asked of them is whether to go back into one, and the doors
  // wait for that, so they are seen to open.
  // The same goes for someone whose headset session a refresh ended: the way back in is offered first, and alone.
  const backToHeadset = !!context?.immersive || !!stood?.headset;
  let offered = backToHeadset;
  if (context) {
    camera.updateMatrixWorld(true);
    crossing.arrive({ title: cfg.title, address: location.host, ready: opened, hold: () => offered });
  }
  state.vrSupported = await addViewControls(controls, {
    renderer,
    rig,
    camera,
    hud,
    onState: (x) => (state.xr = x),
    ...(backToHeadset ? { arrived: { title: cfg.title } } : {}),
    onOffer: (showing) => (offered = showing),
    // Who they are and how they look are their own client's to keep. They leave by the crossing's room, as through
    // any door, and come back the same way: in the room they were in, moving as they were.
    leaving: async (to) => {
      state.leaving = true;
      stroll.stop();
      sounds.play("cross");
      await crossing.leave(to);
      document.body.classList.add("leaving");
      return { ...travelling(), moving: movingNow() };
    },
  });
  if (!state.vrSupported) offered = false;

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ------------------------------------------------------------- each frame
  const startedAt = performance.now();
  let lastT = 0;
  let wasBusy = false;
  const movedFrom = rig.position.clone();
  let hoverKept: [number, number] | null = null;
  let hoverTick = 0;
  // A jump, the same however they are moving: Space, the Jump control where there is no keyboard, A or X in a headset.
  const floorY = rig.position.y;
  const jump = addJump(controls, { presenting: () => renderer.xr.isPresenting, sounds, hud, busy: () => !!panels?.keyboard.open });
  hooks.jump = jump;
  renderer.setAnimationLoop(() => {
    const t = (performance.now() - startedAt) / 1000;
    const dt = Math.min(t - lastT, 0.1);
    lastT = t;
    input!.update(dt);
    panels!.update(t, dt);
    // The keyboard and the library's board come up where the console is: it steps aside for them.
    const busy = panels!.keyboard.open || panels!.library.showing;
    if (busy && !wasBusy) xrConsole.setOpen(false);
    wasBusy = busy;
    crossing.update(t, dt);
    camera.getWorldPosition(head);
    // Steps are made from how far the visitor was moved, not from how their head sways.
    // And not while they are in the air.
    if (state.ready && !jump.airborne) sounds.moved(Math.hypot(rig.position.x - movedFrom.x, rig.position.z - movedFrom.z));
    movedFrom.copy(rig.position);
    rig.position.y = floorY + jump.update(dt);
    // Shut in the crossing's room, nobody else is in it with the visitor, wherever they happen to be standing.
    presence.setHidden(crossing.state !== "none");
    presence.update(dt);
    environment.update(t);
    for (const a of alloys) a.tick(t);
    for (const f of figures) f.tick(t);
    handle.update?.(t, dt);
    let aimed = -1;
    let tile: { door: number; offer: Offer } | null = null;
    let panelAimed: string | null = null;
    let hover: [number, number] | null = null;
    let going: readonly (readonly [number, number])[] | null = null;
    reticle.visible = false;
    if (renderer.xr.isPresenting) {
      dragLook.update(dt, { walking: false, active: false });
      let button: string | null = null;
      for (const c of controllers) {
        if (!c.visible) continue;
        const door = aimFrom(c);
        tile = offerAt() ?? tile;
        const key = panels!.keyboard.pick(raycaster);
        const onMenu = key ? null : xrConsole.pick(raycaster);
        if (onMenu) {
          button = onMenu;
          continue;
        }
        const onPanel = key ?? panels!.pick(raycaster);
        if (onPanel) {
          panelAimed = onPanel;
          continue;
        }
        if (door >= 0) aimed = door;
        const spot = door >= 0 ? null : floorUnder();
        if (spot) {
          reticle.position.set(spot.x, 0.02, spot.z);
          reticle.visible = true;
          // Dim while the last step is still being paid for: a press now would do nothing.
          (reticle.material as THREE.MeshBasicMaterial).opacity = pace.ready ? 0.8 : 0.22;
        }
      }
      xrConsole.aim(button);
    } else {
      // Game controls have the visitor's movement when they are on, and aim from the middle of the view.
      if (fps!.update(dt)) {
        pointer.set(0, 0);
        dragLook.update(dt, { walking: false, active: false });
      } else {
        walk(dt);
        stroll.update(dt);
        // Walking, by a tap or by the keys, brings the view back level.
        const keyed = ["KeyW", "KeyS", "KeyA", "KeyD", "ArrowUp", "ArrowDown"].some((k) => keys.has(k));
        dragLook.update(dt, { walking: stroll.going || keyed, active: true });
        // They face the way they walk, so the next press ahead is a press where they are looking. Not while they
        // are turning the view themselves.
        if (stroll.going && !dragging) rig.rotation.y = stroll.face(rig.rotation.y, dt);
      }
      raycaster.setFromCamera(pointer, camera);
      panelAimed = panels!.pick(raycaster);
      aimed = panelAimed ? -1 : doorAt(raycaster.intersectObjects(targets, false)[0]?.object);
      tile = panelAimed || aimed >= 0 ? null : offerAt();
      // Moving the intense way, the pointer's picture is the kit's to hide: the middle of the view is what points.
      if (!fps!.enabled) renderer.domElement.style.cursor = aimed >= 0 || panelAimed ? "pointer" : "grab";
      // The casual way, with a pointer that hovers: a ring on the floor where a press would take them. With a finger
      // there is nothing to hover with, so only where they are going is marked.
      const mayHover = !fps!.enabled && !dragging && !panelAimed && aimed < 0 && !tile && Math.abs(pointer.x) <= 1 && Math.abs(pointer.y) <= 1 && currentForm() !== "touch";
      if (!mayHover) hoverKept = null;
      else if (hoverTick++ % 3 === 0) {
        // Looked for every third frame: finding what is in the way means looking at everything in the place.
        const spot = floorUnder();
        // Where a press would lead: from their feet standing, from the end of the path they are walking.
        const led = spot ? stroll.reach(floorHit.x, floorHit.z) : null;
        hoverKept = led && floorIsClear() && canStand(led[0], led[1]) ? led : null;
      }
      hover = hoverKept;
      going = fps!.enabled ? null : stroll.path;
    }
    marks.update({ hover, from: [head.x, head.z], path: going, t });
    // Walking into a doorway goes through it, on foot or in a headset, with nothing brought up first.
    const through = state.ready ? walkedInto() : -1;
    if (through >= 0) void go(through, "walked");
    panels!.aim(panelAimed);
    xrConsole.update(dt, camera, renderer.xr.isPresenting);
    // The console's own button sits where the keyboard comes up, and shows through it: away while typing.
    if (panels!.keyboard.open) xrConsole.group.visible = false;
    const at = gates[aimed];
    const rated = at ? doorRatings.words(coordinateOf(at.place)) : "";
    // A tile pointed at says what it means: in the card on a flat screen, and in front of its door in a headset.
    const beside = tile ? gates[tile.door]! : null;
    if (tile && beside) controls.setTarget(`${tile.offer.name}: ${beside.door.label}`, [tile.offer.words]);
    // Pointed at the shut gate: what it is and why it is shut, beside the controls like anything pointed at.
    else if (!at && !panelAimed && gate && gateAimed()) controls.setTarget("The way in", [gate.why]);
    else controls.setTarget(at ? `${at.door.label}, at ${host(at.place.url)}` : "", rated ? [rated] : []);
    gates.forEach((g, i) => {
      g.gate.offers.point(tile && tile.door === i ? tile.offer : null, renderer.xr.isPresenting);
      g.gate.aimed = i === aimed ? 1 : 0;
      g.gate.update(t, dt);
    });
    renderer.render(scene, camera);
  });
  // Out of a door, if they came through one. A browser may hold this back until their first touch.
  if (context) sounds.play("arrive");
  state.ready = true;
  worldOpened();
}

function host(url: string): string {
  const chk = checkDestination(url);
  return chk.ok ? chk.value.hostname : "an address that can't be read";
}
