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
import { checkDestination, checkPreviewBytes, encodeNaddr, WORLD_KIND } from "@nswp/core";
import { createAlloy, createEnvironment, createHalo, createPortalGate, MeshBuilder, metalTone, PORTAL_HEIGHT, PORTAL_WIDTH, type Alloy, type EnvironmentOptions, type PortalGate } from "nswp-sdk/home";
import { addCameraControls, addRoomControls, addViewControls, capturePanorama, createConsole, createCrossing, createFigure, createPanels, createPresence, createXrInput, type PanelContent, type PanelPlace, type Panels, type GrabOptions, type XrInput, panoramaTexture, textSprite, type Camera, type Figure, type FigureStyle, type XrConsole } from "nswp-sdk/three";
import { createControls, mountHud, type Controls } from "nswp-sdk/ui";
import previews from "../previews/index.json";
import sites from "../sites.json";

type V3 = [number, number, number];
type Place = { d: string; url: string; title?: string };
const places: Record<string, Place> = { ...sites.worlds, ...sites.elsewhere };

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
  build(kit: WorldKit): WorldHandle | void;
}

type TestHooks = {
  state: Record<string, unknown>;
  doors(): { label: string; to: string; url: string; position: number[] }[];
  goThrough(i: number): Promise<void>;
  /** Kept for older scripts: go through the first door. */
  goThroughPortal(): Promise<void>;
  roomInfo?: () => unknown;
  /** What the visitor's hands are doing, as the input layer reads them. */
  input?: () => unknown;
  /** The panels hanging here. */
  panels?: Panels;
  /** Where a named thing is on the page, in pixels, or null if it is behind the visitor. */
  screenOf?: (name: string) => number[] | null;
  /** Where a crossing stands: arriving in the chamber, its doors opening, leaving, or none. */
  crossing?: () => string;
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

export async function startWorld(cfg: WorldConfig): Promise<void> {
  // Read and scrub the arrival context before anything else (spec §4.4).
  const { context, warnings } = arrival.read();
  configure({ defaultAirlock: sites.airlock });

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

  // Everything modelled is drawn without lights; this is for anything a world adds that needs one.
  scene.add(new THREE.HemisphereLight(0xffffff, cfg.palette.ground, 1.2));

  // ------------------------------------------------------------- the controls
  const controls = createControls({ title: cfg.title, address: location.host, theme: { accent: `#${accent.getHexString()}` } });
  const hud = mountHud(controls);
  hooks.controls = controls;
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
  const kit: WorldKit = {
    scene,
    accent,
    builder,
    soft: builder.tone.clone().lerp(accent, 0.03),
    head,
    controls,
    alloy,
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
    const gate = createPortalGate(destination, { label: door.label, color: accent, textColor: cfg.palette.text });
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

  // ------------------------------------------------------------- leaving
  const go = async (i: number) => {
    const g = gates[i];
    if (!g || state.leaving) return;
    state.leaving = true;
    // The walls come up, naming where this door says it leads. The visitor's Airlock shows the real address next.
    await crossing.leave({ title: g.door.label, address: host(g.place.url) });
    document.body.classList.add("leaving");
    await portal.go(g.destination, { xrSession: renderer.xr.getSession() });
  };
  const goHome = async () => {
    const back = arrival.returnAirlock();
    if (!back || state.leaving) return;
    state.leaving = true;
    await crossing.leave({ title: "your lobby", address: new URL(back).host });
    document.body.classList.add("leaving");
    await portal.home({ xrSession: renderer.xr.getSession() });
  };
  hooks.goThrough = go;
  hooks.goThroughPortal = () => go(0);

  gates.forEach((g, i) => controls.add({ id: `door-${i}`, section: "travel", icon: "door", label: g.door.label, short: "Door", act: () => void go(i) }));
  controls.add({
    id: "home",
    section: "travel",
    icon: "home",
    hotbar: true,
    label: "Back to your lobby",
    short: "Home",
    // Offered when the visitor came from a lobby that said where to send them back to.
    hidden: () => !arrival.returnAirlock(),
    act: () => void goHome(),
  });
  controls.addSection({
    id: "help",
    label: "Help",
    icon: "help",
    note: `${cfg.purpose} Drag to look around. Walk with W, A, S, D, or point at the floor and select to step there. Select a doorway to see where it leads before you go. These controls are this world's own: your headset's or browser's own controls always get you out.`,
  });
  const xrConsole: XrConsole = createConsole(controls, { renderer, rig });
  scene.add(xrConsole.group);
  hooks.console = xrConsole;

  // ------------------------------------------------------------- moving
  const [midX, midZ] = cfg.middle ?? [0, 0];
  const reach = cfg.reach ?? 14;
  // Leaving and arriving happen in the kit's chamber: the same small room at both ends of every trip.
  const crossing = createCrossing({ scene, camera, accent, textColor: cfg.palette.text, motion: () => controls.theme.motion });
  hooks.crossing = () => crossing.state;
  const canStand = (x: number, z: number) => crossing.allows(x, z) && Math.hypot(x - midX, z - midZ) <= reach && (handle.canStand?.(x, z) ?? true);
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
    if (far > STEP_MAX) spotAt.set(headAt.x + (dx / far) * STEP_MAX, 0, headAt.z + (dz / far) * STEP_MAX);
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
  const stepTo = (spot: THREE.Vector3) => {
    // Pointing at a thing is not pointing at the floor behind it.
    const toFloor = raycaster.ray.origin.distanceTo(floorHit);
    const inTheWay = raycaster.intersectObjects(scene.children, true).find((h) => solid(h.object));
    if (inTheWay && inTheWay.distance < toFloor - 0.05) return;
    moveTowards(spot.x, spot.z);
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
  const doorAt = (object: THREE.Object3D | undefined) => gates.findIndex((g) => g.gate.target === object);
  const pointer = new THREE.Vector2(2, 2);
  let dragging = false;
  let lastX = 0;
  let moved = 0;
  const setPointer = (e: PointerEvent) => pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  // A panel taken by its bar is dragged; anything else, and the drag turns the view.
  let panelDrag = false;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    panelDrag = !renderer.xr.isPresenting && !!panels?.pointer("down", raycaster);
    dragging = !panelDrag;
    lastX = e.clientX;
    moved = 0;
  });
  addEventListener("pointerup", (e) => {
    dragging = false;
    if (panelDrag) {
      panelDrag = false;
      raycaster.setFromCamera(pointer, camera);
      panels?.pointer("up", raycaster);
      return;
    }
    if (moved > 6 || renderer.xr.isPresenting || e.target !== renderer.domElement) return;
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const onPanel = panels?.pick(raycaster);
    if (onPanel) return void panels!.press(onPanel);
    const door = doorAt(raycaster.intersectObjects(targets, false)[0]?.object);
    if (door >= 0) void go(door);
    else {
      const spot = floorUnder();
      if (spot) stepTo(spot);
    }
  });
  addEventListener("pointermove", (e) => {
    if (dragging && !renderer.xr.isPresenting) {
      rig.rotation.y += (e.clientX - lastX) * 0.005;
      moved += Math.abs(e.clientX - lastX);
      lastX = e.clientX;
    }
    setPointer(e);
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
      const button = xrConsole.pick(raycaster);
      const onPanel = button ? null : panels!.pick(raycaster);
      if (button || onPanel || door >= 0) input?.pulse(i, 0.5, 30);
      if (button) xrConsole.press(button);
      else if (onPanel) panels!.press(onPanel);
      else if (door >= 0) void go(door);
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
    accent,
    stepFrom: (i) => {
      aimFrom(controllers[i]!);
      const spot = floorUnder();
      if (spot) stepTo(spot);
    },
    onMenu: () => xrConsole.setOpen(!xrConsole.open),
  });
  for (const [object, options] of toHold) input.grabbable(object, options);
  hooks.input = () => input!.info();
  // Panels: notes, pictures and video in frames a visitor can move about. Taken by the bar with a grip, or pressed
  // with a select like everything else.
  panels = createPanels({ scene, camera, accent, textColor: cfg.palette.text, input });
  for (const [content, place] of toHang) panels.open(content, { ...(place ? { place } : {}), keep: false });
  hooks.panels = panels;
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

  // Without a headset: W, A, S, D or the arrow keys.
  const keys = new Set<string>();
  addEventListener("keydown", (e) => {
    if (!(e.target instanceof HTMLButtonElement)) keys.add(e.code);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());
  const stride = new THREE.Vector3();
  const walk = (dt: number) => {
    const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const strafe = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    if (!forward && !strafe) return;
    stride.set(strafe, 0, -forward).normalize().multiplyScalar(2.4 * dt).applyAxisAngle(yawAxis, rig.rotation.y);
    // Try the whole step, then each direction alone, so a visitor slides along an edge instead of sticking to it.
    if (canStand(head.x + stride.x, head.z + stride.z)) rig.position.add(stride);
    else if (canStand(head.x + stride.x, head.z)) rig.position.x += stride.x;
    else if (canStand(head.x, head.z + stride.z)) rig.position.z += stride.z;
  };

  // ------------------------------------------------------------- the room
  // Other visitors appear only after someone presses Join (spec §9.4).
  let refreshRoom = () => {};
  // They are drawn to the others as they chose to arrive: wearing their look, or plain (spec §4.2).
  const presence = createPresence({ scene, camera, rig, renderer, controllers, labelColor: cfg.palette.text, look: () => arrival.look(), identity: () => arrival.identity(), onChange: () => refreshRoom() });
  ({ refresh: refreshRoom } = addRoomControls(controls, presence, { onState: (room) => (state.room = room) }));
  hooks.roomInfo = () => presence.info();
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
    if (!object) return null;
    const world = object.getWorldPosition(new THREE.Vector3());
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
  let offered = !!context?.immersive;
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
    ...(context?.immersive ? { arrived: { title: cfg.title } } : {}),
    onOffer: (showing) => (offered = showing),
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
  renderer.setAnimationLoop(() => {
    const t = (performance.now() - startedAt) / 1000;
    const dt = Math.min(t - lastT, 0.1);
    lastT = t;
    input!.update(dt);
    panels!.update(t, dt);
    crossing.update(t, dt);
    camera.getWorldPosition(head);
    presence.update(dt);
    environment.update(t);
    for (const a of alloys) a.tick(t);
    for (const f of figures) f.tick(t);
    handle.update?.(t, dt);
    let aimed = -1;
    let panelAimed: string | null = null;
    reticle.visible = false;
    if (renderer.xr.isPresenting) {
      let button: string | null = null;
      for (const c of controllers) {
        if (!c.visible) continue;
        const door = aimFrom(c);
        const onMenu = xrConsole.pick(raycaster);
        if (onMenu) {
          button = onMenu;
          continue;
        }
        const onPanel = panels!.pick(raycaster);
        if (onPanel) {
          panelAimed = onPanel;
          continue;
        }
        if (door >= 0) aimed = door;
        const spot = door >= 0 ? null : floorUnder();
        if (spot) {
          reticle.position.set(spot.x, 0.02, spot.z);
          reticle.visible = true;
        }
      }
      xrConsole.aim(button);
      const through = walkedInto();
      if (through >= 0) void go(through);
    } else {
      walk(dt);
      raycaster.setFromCamera(pointer, camera);
      panelAimed = panels!.pick(raycaster);
      aimed = panelAimed ? -1 : doorAt(raycaster.intersectObjects(targets, false)[0]?.object);
      renderer.domElement.style.cursor = aimed >= 0 || panelAimed ? "pointer" : "grab";
    }
    panels!.aim(panelAimed);
    xrConsole.update(dt, camera, renderer.xr.isPresenting);
    const at = gates[aimed];
    controls.setTarget(at ? `${at.door.label}, at ${host(at.place.url)}` : "");
    gates.forEach((g, i) => {
      g.gate.aimed = i === aimed ? 1 : 0;
      g.gate.update(t, dt);
    });
    renderer.render(scene, camera);
  });
  state.ready = true;
  worldOpened();
}

function host(url: string): string {
  const chk = checkDestination(url);
  return chk.ok ? chk.value.hostname : "an address that can't be read";
}
