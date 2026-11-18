/**
 * Shared scene for the NSWP reference worlds.
 *
 * Input is written against the plain WebXR `select` event on every input
 * source, so the same code works with controllers, hand tracking (pinch) and
 * gaze-and-pinch (`transient-pointer`), across headsets. On desktop and
 * phones, tap or click the portal.
 *
 * Testing without a headset: add `?xr=emulate` to load IWER, which emulates a
 * Meta Quest 3 in the page. `window.__nswpTest` exposes hooks for automation.
 */
import * as THREE from "three";
import { arrival, configure, portal, type PortalDestination } from "nswp-sdk";
import { checkDestination, checkPreviewBytes } from "@nswp/core";
import { createAlloy, createEnvironment, createPortalGate, MeshBuilder, metalTone, PORTAL_HEIGHT, PORTAL_WIDTH, type Alloy } from "nswp-sdk/home";
import { addRoomControls, addViewControls, capturePanorama, createConsole, createPresence, panoramaTexture, type XrConsole } from "nswp-sdk/three";
import { createControls, mountHud, type Controls } from "nswp-sdk/ui";
import { textSprite } from "./text.js";

export interface WorldKit {
  accent: THREE.Color;
  /** One builder for everything that stays still. Its tone is this world's metal. */
  builder: MeshBuilder;
  /** This world's metal with some of its accent in it: for seats, leaves, things to notice. */
  soft: THREE.Color;
  /** A surface to draw a mesh of your own in. It is kept in time with the rest. */
  alloy(options?: { gloss?: number; sheen?: number }): Alloy;
}

export interface WorldConfig {
  name: string;
  tagline: string;
  palette: { sky: number; ground: number; accent: number; fog: number; text: string };
  airlock: string;
  entryPoints: Record<string, { position: [number, number, number]; yaw: number }>;
  /** `preview` is the destination's panorama, mirrored on this site at /previews/<sha256>.webp. */
  portal: PortalDestination & { label: string; position: [number, number, number]; preview?: { sha256: string } };
  /** Build what is in this world. `blocks` draws boxes with lit edges, all together; add anything else to the scene. Returns what to do each frame. */
  /**
   * Build what stands in this world. Add what stays still to `kit.builder`: it
   * all becomes one mesh. Things that move are meshes of their own; draw them
   * in `kit.alloy(...)` so they are lit the same way. Returns what to do each frame.
   */
  decorate(scene: THREE.Scene, kit: WorldKit): (t: number) => void;
}

type TestHooks = {
  state: Record<string, unknown>;
  goThroughPortal(): Promise<void>;
  roomInfo?: () => unknown;
  /** Capture this world's preview panorama (spec §5.8), as a base64 WebP. */
  capturePreview?: (width?: number) => Promise<{ base64: string; width: number; height: number; bytes: number }>;
  /** Test aid: put the visitor at a floor position. */
  teleport?: (x: number, z: number) => void;
  /** Turn the view: degrees to the left of the way in, and degrees up. */
  face?: (yaw: number, pitch?: number) => void;
  device?: unknown;
  /** Everything a visitor can do here. */
  controls?: Controls;
  /** The console shown in a headset. */
  console?: XrConsole;
};

declare global {
  interface Window {
    __nswpTest?: TestHooks;
  }
}

export async function startWorld(cfg: WorldConfig): Promise<void> {
  // Read and scrub the arrival context before anything else (spec §4.4).
  const { context, warnings } = arrival.read();
  configure({ defaultAirlock: cfg.airlock });

  const emulate = new URLSearchParams(location.search).get("xr") === "emulate";
  const hooks: TestHooks = {
    state: { world: cfg.name, arrival: context, arrivalWarnings: warnings, emulate, xr: "idle" },
    goThroughPortal: async () => {},
  };
  window.__nswpTest = hooks;
  if (emulate) {
    const { XRDevice, metaQuest3 } = await import("iwer");
    const device = new XRDevice(metaQuest3, { stereoEnabled: false });
    device.installRuntime({ forceInstall: true });
    hooks.device = device;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");
  document.getElementById("stage")!.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cfg.palette.sky);
  scene.fog = new THREE.Fog(cfg.palette.fog, 60, 300);
  const accent = new THREE.Color(cfg.palette.accent);

  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 700);
  camera.position.set(0, 1.6, 0);
  const rig = new THREE.Group();
  rig.add(camera);
  scene.add(rig);

  const entryName = context?.entry && cfg.entryPoints[context.entry] ? context.entry : "main-entrance";
  const spawn = cfg.entryPoints[entryName]!;
  rig.position.set(...spawn.position);
  rig.rotation.y = spawn.yaw;
  hooks.state.entryPoint = entryName;

  scene.add(new THREE.HemisphereLight(0xffffff, cfg.palette.ground, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(4, 10, 2);
  scene.add(sun);
  // The ground: the grid every NSWP reference place stands on, in this world's colour.
  const environment = createEnvironment(accent, { ground: cfg.palette.ground });
  scene.add(environment.group);
  const builder = new MeshBuilder();
  builder.tone = metalTone(cfg.palette.ground);
  const alloys: Alloy[] = [];
  const alloy: WorldKit["alloy"] = (options = {}) => {
    const made = createAlloy(accent, { ground: cfg.palette.ground, gloss: 0.55, ...options });
    alloys.push(made);
    return made;
  };
  const tick = cfg.decorate(scene, { accent, builder, soft: builder.tone.clone().lerp(accent, 0.06), alloy });
  scene.add(builder.build(alloy()));

  // --- the portal ---------------------------------------------------------
  // The standard doorway: an arch standing on the floor, with its sign above.
  const { label: portalLabel, position: _at, ...destination } = cfg.portal;
  const gate = createPortalGate(destination, { label: portalLabel, color: accent, textColor: cfg.palette.text });
  const portalGroup = gate.group;
  portalGroup.position.set(...cfg.portal.position);
  portalGroup.lookAt(rig.position.x, cfg.portal.position[1], rig.position.z);
  const disc = gate.target; // what a ray is tested against

  // The view through the portal: the destination's preview, if this site
  // mirrors one. It is fetched from this site, never from the destination, and
  // checked against its hash before it is shown (spec §5.8).
  const previewHash = cfg.portal.preview?.sha256;
  let portalWindow: THREE.Mesh | null = null;
  if (previewHash) {
    void (async () => {
      try {
        const res = await fetch(`/previews/${previewHash}.webp`);
        if (!res.ok) return;
        const bytes = new Uint8Array(await res.arrayBuffer());
        const check = checkPreviewBytes({ url: res.url, type: "pano", sha256: previewHash }, bytes);
        if (!check.ok) {
          hooks.state.preview = check.code;
          return;
        }
        const image = new Image();
        image.src = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
        await image.decode();
        portalWindow = gate.showThrough(panoramaTexture(image));
        hooks.state.preview = "shown";
      } catch {
        hooks.state.preview = "failed";
      }
    })();
  }
  scene.add(portalGroup);

  // --- info panel near the spawn point -------------------------------------
  const airlockNow = portal.airlockFor();
  const lines = [
    cfg.name,
    cfg.tagline,
    "",
    context ? `Arrived at: ${entryName}` : "Arrived directly (no arrival context)",
    context?.airlock ? `Return Airlock: ${destinationHost(context.airlock)}` : "Return Airlock: none (using world default)",
    `This portal goes through: ${airlockNow ? destinationHost(airlockNow) : "built-in screen"}`,
  ];
  // Placed 3 m ahead and to the left, small enough to stay in view on a
  // landscape screen (≈86° horizontal field of view) as well as in a headset.
  const panel = textSprite(lines.join("\n"), cfg.palette.text, 1.7);
  const yawAxis = new THREE.Vector3(0, 1, 0);
  panel.position
    .set(...spawn.position)
    .add(new THREE.Vector3(-1.45, 1.75, -3).applyAxisAngle(yawAxis, spawn.yaw));
  scene.add(panel);

  hooks.capturePreview = async (width = 2048) => {
    const main = cfg.entryPoints["main-entrance"]!;
    // The arrival panel is about one visitor, so it stays out of the picture.
    // So does the view through the portal: a preview that contained the other
    // world's preview would change every time either one was retaken.
    const hide: THREE.Object3D[] = portalWindow ? [panel, portalWindow] : [panel];
    const blob = await capturePanorama(renderer, scene, new THREE.Vector3(main.position[0], 1.6, main.position[2]), { width, hide });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { base64: btoa(binary), width, height: width / 2, bytes: bytes.length };
  };

  // --- going through ---------------------------------------------------------
  let leaving = false;
  const go = async () => {
    if (leaving) return;
    leaving = true;
    hooks.state.leaving = true;
    document.body.classList.add("leaving");
    const { label: _l, position: _p, ...dest } = cfg.portal;
    await portal.go(dest, { xrSession: renderer.xr.getSession() });
  };
  hooks.goThroughPortal = go;

  // One list of what a visitor can do here (the NSWP controls kit). The HUD
  // draws it on a flat screen and the console draws it in a headset.
  const controls = createControls({ title: cfg.name, address: location.host, theme: { accent: `#${accent.getHexString()}` } });
  const hud = mountHud(controls);
  hooks.controls = controls;
  controls.add(
    { id: "portal", section: "travel", icon: "door", hotbar: true, label: cfg.portal.label, short: "Portal", act: go },
    {
      id: "home",
      section: "travel",
      icon: "home",
      hotbar: true,
      label: "Back to your lobby",
      short: "Home",
      // Offered when the visitor came from a lobby that said where to send them back to.
      hidden: () => !arrival.returnAirlock(),
      act: () => void portal.home({ xrSession: renderer.xr.getSession() }),
    },
  );
  controls.addSection({
    id: "help",
    label: "Help",
    icon: "help",
    note: `${cfg.tagline} Drag to look around, walk with W, A, S, D, and select the portal to see where it leads before you go. These controls are this world's own: your headset's or browser's own controls always get you out.`,
  });
  const xrConsole: XrConsole = createConsole(controls, { renderer, rig });
  scene.add(xrConsole.group);
  hooks.console = xrConsole;

  // Desktop / touch: tap the portal. Drag to look around.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let dragging = false;
  let lastX = 0;
  let moved = 0;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    moved = 0;
  });
  addEventListener("pointerup", (e) => {
    dragging = false;
    if (moved > 6 || renderer.xr.isPresenting || e.target !== renderer.domElement) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.intersectObject(disc).length) void go();
  });
  addEventListener("pointermove", (e) => {
    if (dragging && !renderer.xr.isPresenting) {
      rig.rotation.y += (e.clientX - lastX) * 0.005;
      moved += Math.abs(e.clientX - lastX);
      lastX = e.clientX;
    }
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  });

  // XR: any input source's `select` (trigger, pinch, gaze-and-pinch) on the portal.
  const tmpMatrix = new THREE.Matrix4();
  const rayHits = (source: THREE.Object3D) => {
    tmpMatrix.identity().extractRotation(source.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(source.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpMatrix);
    return raycaster.intersectObject(disc).length > 0;
  };
  const controllers: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5)]),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
    );
    c.add(line);
    c.addEventListener("select", () => {
      hooks.state.lastSelect = i;
      const onPortal = rayHits(c); // leaves the ray where this hand points
      const button = xrConsole.pick(raycaster);
      if (button) xrConsole.press(button);
      else if (onPortal) void go();
    });
    rig.add(c);
    controllers.push(c);
  }

  // Other visitors appear only after someone presses Join (spec §9.4).
  let refreshRoom = () => {};
  const presence = createPresence({ scene, camera, rig, renderer, controllers, labelColor: cfg.palette.text, onChange: () => refreshRoom() });
  ({ refresh: refreshRoom } = addRoomControls(controls, presence, { onState: (room) => (hooks.state.room = room) }));
  hooks.roomInfo = () => presence.info();
  hooks.teleport = (x, z) => {
    rig.position.x = x - camera.position.x;
    rig.position.z = z - camera.position.z;
  };
  hooks.face = (yaw, pitch = 0) => {
    rig.rotation.y = THREE.MathUtils.degToRad(yaw);
    camera.rotation.x = THREE.MathUtils.degToRad(pitch);
  };

  // Desktop: WASD or arrow keys to walk.
  const keys = new Set<string>();
  addEventListener("keydown", (e) => {
    if (!(e.target instanceof HTMLButtonElement)) keys.add(e.code);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());
  const step = new THREE.Vector3();
  const walk = (dt: number) => {
    const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const strafe = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    if (!forward && !strafe) return;
    step.set(strafe, 0, -forward).normalize().multiplyScalar(2 * dt).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rig.rotation.y);
    rig.position.add(step);
    rig.position.x = THREE.MathUtils.clamp(rig.position.x, -12, 12);
    rig.position.z = THREE.MathUtils.clamp(rig.position.z, -12, 12);
  };

  // XR: physically walking into the disc also works.
  const camWorld = new THREE.Vector3();
  const local = new THREE.Vector3();
  const checkWalkThrough = () => {
    camera.getWorldPosition(camWorld);
    local.copy(camWorld);
    portalGroup.worldToLocal(local);
    if (Math.abs(local.x) < PORTAL_WIDTH / 2 - 0.15 && local.y > 0 && local.y < PORTAL_HEIGHT && Math.abs(local.z) < 0.25) void go();
  };

  hooks.state.vrSupported = await addViewControls(controls, { renderer, rig, camera, hud, onState: (x) => (hooks.state.xr = x) });

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const startedAt = performance.now();
  let lastT = 0;
  renderer.setAnimationLoop(() => {
    const t = (performance.now() - startedAt) / 1000;
    const dt = Math.min(t - lastT, 0.1);
    lastT = t;
    presence.update(dt);
    environment.update(t);
    for (const a of alloys) a.tick(t);
    tick(t);
    let hover = 0;
    if (renderer.xr.isPresenting) {
      let button: string | null = null;
      for (const c of controllers) {
        const onPortal = rayHits(c);
        const b = xrConsole.pick(raycaster);
        if (b) button = b;
        else if (onPortal) hover = 1;
      }
      xrConsole.aim(button);
      checkWalkThrough();
    } else {
      walk(dt);
      raycaster.setFromCamera(ndc, camera);
      hover = raycaster.intersectObject(disc).length ? 1 : 0;
      renderer.domElement.style.cursor = hover ? "pointer" : "grab";
    }
    xrConsole.update(dt, camera, renderer.xr.isPresenting);
    controls.setTarget(hover ? `${cfg.portal.label}, at ${destinationHost(cfg.portal.url)}` : "");
    gate.aimed = hover;
    gate.update(t, dt);
    renderer.render(scene, camera);
  });
  hooks.state.ready = true;
}

function destinationHost(url: string | undefined): string {
  if (!url) return "";
  const chk = checkDestination(url);
  return chk.ok ? (chk.value.registrableDomain ?? chk.value.hostname) : "invalid destination";
}
