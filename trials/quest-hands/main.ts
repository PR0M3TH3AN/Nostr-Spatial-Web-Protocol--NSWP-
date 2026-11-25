// The 3D artist's hands and controllers, in the owner's headset (docs/backlog/hands-in-a-headset.md, part 2). One
// page, answered only by the local service at /trial-pages/quest-hands/ on the https network address; never part of
// any site's build, and nothing of it goes into the kit until the owner says yes to the look.
//
// It draws bitportal-art's controller-{left,right}.glb and hand-{left,right}.glb (authored in WebXR grip space) on
// each controller's grip, in the reference look (bitportal-art assets/hands/preview/preview.js), with the hand's clips
// driven by the controller as the kit would drive them: trigger and grip from 0 to 1, and which control the thumb is
// on. And it writes down, a line each, what the headset reports: each input's profile ids (meta-quest-touch-plus or
// a v2?) and whether hands and controllers are tracked at once.
//
// Fetches nothing but its own files and the four models beside it (copied there by scripts/quest-hands.mjs). Sends
// nothing and keeps nothing. With ?emulate, a made-up Quest (iwer) stands in for a real one, for trials/quest-hands.mjs.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

type Side = "left" | "right";
type Thumb = "lower" | "upper" | "stick" | "rest" | "up";

const said: string[] = [];
const logList = document.getElementById("log")!;
const statusLine = document.getElementById("status")!;
/** One line written down: on the page, in the headset's panel, and in the console. */
const say = (line: string) => {
  said.push(line);
  const li = document.createElement("li");
  li.textContent = line;
  logList.append(li);
  console.log(`[quest-hands] ${line}`);
  drawPanel();
};

// ---------- the stage, in the reference look: a dark room, a cool sky light, a grid floor of glowing lines ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local-floor");
document.getElementById("stage")!.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040b10);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 50);
camera.position.set(0, 1.6, 0.6);
camera.lookAt(0, 1.2, -0.3);
scene.add(new THREE.HemisphereLight(0x7fc8ff, 0x061018, 1.1));
const key = new THREE.DirectionalLight(0xdff4ff, 1.4);
key.position.set(0.6, 2.4, 1.0);
scene.add(key);
scene.add(new THREE.GridHelper(8, 80, 0x2bffc6, 0x0e5a4c));
addEventListener("resize", () => {
  if (renderer.xr.isPresenting) return;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---------- the look, as the reference applies it ----------
function rimMaterial(o: { color: number; rim: number; opacity: number; rimPower: number; vertexAlpha?: boolean }) {
  const m = new THREE.MeshPhongMaterial({ color: o.color, transparent: true, opacity: o.opacity, depthWrite: false, shininess: 60, specular: 0x334455, vertexColors: !!o.vertexAlpha, side: THREE.FrontSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.rimColor = { value: new THREE.Color(o.rim) };
    s.uniforms.rimPower = { value: o.rimPower };
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 rimColor;\nuniform float rimPower;")
      .replace(
        "#include <opaque_fragment>",
        `
        float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), rimPower);
        float seen = clamp(diffuseColor.a * 3.0, 0.0, 1.0);
        outgoingLight = mix(outgoingLight, rimColor, fr * seen);
        diffuseColor.a = clamp(diffuseColor.a * (1.0 + 1.5 * fr), 0.0, 1.0);
        #include <opaque_fragment>`,
      );
  };
  return m;
}
const handMat = () => rimMaterial({ color: 0x3f86ff, rim: 0x9fe8ff, opacity: 0.55, rimPower: 2.2, vertexAlpha: true });
const shellMat = () => rimMaterial({ color: 0xc8dcf2, rim: 0xe8fbff, opacity: 0.16, rimPower: 3.0 });
const edgeMat = new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55 });

// ---------- the models ----------
type Part = { value: THREE.Object3D; min: THREE.Object3D; max: THREE.Object3D };
type Model = { group: THREE.Group; mixer: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>; parts: Record<string, Part>; clips: string[] };
const loader = new GLTFLoader();
const load = (u: string) => new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((ok, no) => loader.load(u, ok as never, undefined, no));
const models: Partial<Record<Side, Model>> = {};

async function makeSide(side: Side): Promise<void> {
  const [ctl, hand] = await Promise.all([load(`models/controller-${side}.glb`), load(`models/hand-${side}.glb`)]);
  const group = new THREE.Group();
  group.name = `held-${side}`;
  group.add(ctl.scene, hand.scene);
  ctl.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      mesh.material = shellMat();
      mesh.renderOrder = 1;
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 35), edgeMat));
    }
  });
  hand.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      mesh.material = handMat();
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
    }
  });
  const mixer = new THREE.AnimationMixer(hand.scene);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const clip of hand.animations) {
    const a = mixer.clipAction(clip);
    a.play();
    a.setEffectiveWeight(0);
    actions[clip.name] = a;
  }
  // The controller's own moving parts, as the Input Profiles motion-controller code moves them.
  const node = (n: string) => ctl.scene.getObjectByName(n);
  const parts: Record<string, Part> = {};
  for (const v of ["xr_standard_trigger", "xr_standard_squeeze", "xr_standard_thumbstick", "xr_standard_thumbstick_xaxis", "xr_standard_thumbstick_yaxis", "a_button", "b_button", "x_button", "y_button"]) {
    const value = node(`${v}_pressed_value`);
    const min = node(`${v}_pressed_min`);
    const max = node(`${v}_pressed_max`);
    if (value && min && max) parts[v] = { value, min, max };
  }
  group.visible = false;
  models[side] = { group, mixer, actions, parts, clips: hand.animations.map((c) => c.name).sort() };
}

const press = (part: Part | undefined, t: number) => {
  if (!part) return;
  part.value.position.lerpVectors(part.min.position, part.max.position, t);
  part.value.quaternion.slerpQuaternions(part.min.quaternion, part.max.quaternion, t);
};

/** The pose, as the kit would set it each frame: weights in each group sum to one. */
type Pose = { trigger: number; grip: number; thumb: Thumb; stick: [number, number]; stickPressed: number; lowerPressed: number; upperPressed: number };
const poses: Partial<Record<Side, Pose>> = {};
function setPose(side: Side, p: Pose) {
  const m = models[side];
  if (!m) return;
  poses[side] = p;
  const w = (n: string, v: number) => m.actions[n]?.setEffectiveWeight(v);
  w("hold", 1);
  w("index-rest", 1 - p.trigger);
  w("index-pulled", p.trigger);
  w("fingers-open", 1 - p.grip);
  w("fingers-squeezed", p.grip);
  for (const n of Object.keys(m.actions)) if (n.startsWith("thumb-")) w(n, n === `thumb-${p.thumb}` ? 1 : 0);
  press(m.parts.xr_standard_trigger, p.trigger);
  press(m.parts.xr_standard_squeeze, p.grip);
  press(m.parts.xr_standard_thumbstick, p.stickPressed);
  press(m.parts.xr_standard_thumbstick_xaxis, (p.stick[0] + 1) / 2);
  press(m.parts.xr_standard_thumbstick_yaxis, (p.stick[1] + 1) / 2);
  const [lower, upper] = side === "right" ? ["a_button", "b_button"] : ["x_button", "y_button"];
  press(m.parts[lower], p.lowerPressed);
  press(m.parts[upper], p.upperPressed);
  m.mixer.update(0);
}

/** Which control the thumb is on, from the xr-standard buttons: A/X lower, B/Y upper, the stick, the thumb rest, or none. */
function thumbOf(b: readonly GamepadButton[]): Thumb {
  const on = (i: number) => !!b[i] && (b[i]!.touched || b[i]!.pressed);
  if (on(4)) return "lower";
  if (on(5)) return "upper";
  if (on(3)) return "stick";
  if (on(6)) return "rest";
  return "up";
}

// ---------- the panel in the headset: what has been written down, and what each hand is doing now ----------
const panelCanvas = document.createElement("canvas");
panelCanvas.width = 1024;
panelCanvas.height = 640;
const panelTexture = new THREE.CanvasTexture(panelCanvas);
panelTexture.colorSpace = THREE.SRGBColorSpace;
const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshBasicMaterial({ map: panelTexture, transparent: true }));
panel.position.set(0, 1.45, -1.1);
scene.add(panel);
let live = "";
function drawPanel() {
  const c = panelCanvas.getContext("2d")!;
  c.fillStyle = "rgba(6, 14, 22, 0.92)";
  c.fillRect(0, 0, panelCanvas.width, panelCanvas.height);
  c.strokeStyle = "#58c8f0";
  c.lineWidth = 3;
  c.strokeRect(2, 2, panelCanvas.width - 4, panelCanvas.height - 4);
  c.fillStyle = "#eef5fb";
  c.font = "600 30px system-ui, sans-serif";
  c.fillText("The artist's hands: what the headset says", 28, 50);
  c.font = "24px system-ui, sans-serif";
  c.fillStyle = "#9fe8ff";
  c.fillText(live, 28, 92);
  c.fillStyle = "#eef5fb";
  // Each line wrapped to the panel's width, never cut: the profile ids are at the end of theirs. The newest at the foot.
  const width = panelCanvas.width - 56;
  const rows: string[] = [];
  for (const l of said) {
    let row = "";
    for (const word of l.split(" ")) {
      const next = row ? `${row} ${word}` : word;
      if (c.measureText(next).width > width && row) {
        rows.push(row);
        row = `   ${word}`;
      } else row = next;
    }
    rows.push(row);
  }
  rows.slice(-14).forEach((r, i) => c.fillText(r, 28, 140 + i * 34));
  panelTexture.needsUpdate = true;
}
drawPanel();

// ---------- the headset ----------
const grips = [0, 1].map((i) => {
  const grip = renderer.xr.getControllerGrip(i);
  scene.add(grip);
  let source: XRInputSource | null = null;
  grip.addEventListener("connected", (e) => {
    source = (e as unknown as { data: XRInputSource }).data;
    const side = source.handedness as Side;
    const held = !!source.gamepad && !source.hand && (side === "left" || side === "right") ? models[side] : undefined;
    if (held) {
      grip.add(held.group);
      held.group.visible = true;
    }
  });
  grip.addEventListener("disconnected", () => {
    for (const side of ["left", "right"] as const) if (models[side]?.group.parent === grip) grip.remove(models[side]!.group);
    source = null;
  });
  return { grip, source: () => source };
});
void grips;

let together = false;
let seenHands = 0;
let seenPads = 0;
const described = new Set<string>();
const describe = (s: XRInputSource) => {
  const line = `input: ${s.handedness} hand=${s.hand ? "yes" : "no"} gamepad=${s.gamepad ? `yes (${s.gamepad.mapping || "no mapping"}, ${s.gamepad.buttons.length} buttons)` : "no"} profiles=[${s.profiles.join(", ")}]`;
  if (described.has(line)) return;
  described.add(line);
  say(line);
};

renderer.xr.addEventListener("sessionstart", () => {
  const session = renderer.xr.getSession()!;
  const features = (session as XRSession & { enabledFeatures?: string[] }).enabledFeatures;
  say(`session: enabled features ${features ? `[${features.join(", ")}]` : "(not said by this browser)"}`);
  for (const s of session.inputSources) describe(s);
  session.addEventListener("inputsourceschange", (e) => {
    for (const s of (e as XRInputSourcesChangeEvent).added) describe(s);
    for (const s of (e as XRInputSourcesChangeEvent).removed) say(`input gone: ${s.handedness} ${s.hand ? "hand" : "controller"}`);
  });
  statusLine.textContent = "In the headset. Hold both controllers; then put one down and show a bare hand.";
});
renderer.xr.addEventListener("sessionend", () => {
  say(`session ended: hands and controllers tracked together ${together ? "yes" : "no, not seen"} (most at once: ${seenHands} hands, ${seenPads} controllers)`);
  statusLine.textContent = "Out of the headset. What it said is below.";
});

renderer.setAnimationLoop(() => {
  const session = renderer.xr.getSession();
  if (session) {
    const sources = [...session.inputSources];
    const hands = sources.filter((s) => s.hand).length;
    const pads = sources.filter((s) => s.gamepad && !s.hand).length;
    seenHands = Math.max(seenHands, hands);
    seenPads = Math.max(seenPads, pads);
    if (!together && hands > 0 && pads > 0) {
      together = true;
      say(`hands and controllers tracked together: yes (${hands} hand${hands === 1 ? "" : "s"}, ${pads} controller${pads === 1 ? "" : "s"})`);
    }
    const now: string[] = [];
    for (const s of sources) {
      const side = s.handedness as Side;
      if (!s.gamepad || s.hand || (side !== "left" && side !== "right")) continue;
      const b = s.gamepad.buttons;
      const a = s.gamepad.axes;
      const p: Pose = { trigger: b[0]?.value ?? 0, grip: b[1]?.value ?? 0, thumb: thumbOf(b), stick: [a[2] ?? 0, a[3] ?? 0], stickPressed: b[3]?.pressed ? 1 : 0, lowerPressed: b[4]?.pressed ? 1 : 0, upperPressed: b[5]?.pressed ? 1 : 0 };
      setPose(side, p);
      now.push(`${side[0]!.toUpperCase()}: trigger ${p.trigger.toFixed(2)} grip ${p.grip.toFixed(2)} thumb ${p.thumb}`);
    }
    const next = now.join("   ") || "no controller held";
    if (next !== live) {
      live = next;
      drawPanel();
    }
  }
  renderer.render(scene, camera);
});

// ---------- going in ----------
const enter = document.getElementById("enter") as HTMLButtonElement;
async function start() {
  if (new URLSearchParams(location.search).has("emulate")) {
    const { XRDevice, metaQuest3 } = await import("iwer");
    const device = new XRDevice(metaQuest3, { stereoEnabled: false });
    device.installRuntime({ forceInstall: true });
    (window as unknown as { __xr: unknown }).__xr = device;
  }
  try {
    await Promise.all([makeSide("left"), makeSide("right")]);
    const clips = models.right?.clips.join(", ") ?? "";
    say(`models: both sides loaded; clips [${clips}]`);
  } catch (err) {
    say(`models: couldn't be loaded (${err instanceof Error ? err.message : String(err)}). Run scripts/quest-hands.mjs on the laptop first.`);
    return;
  }
  const xr = navigator.xr;
  const can = xr ? await xr.isSessionSupported("immersive-vr").catch(() => false) : false;
  say(`browser: ${navigator.userAgent}`);
  if (!can) {
    say("browser: can't enter VR here");
    statusLine.textContent = "This browser can't enter VR. Open this page in the Quest's own browser.";
    return;
  }
  enter.disabled = false;
  statusLine.textContent = "Ready. Press Enter VR, holding both controllers.";
}
enter.addEventListener("click", async () => {
  enter.disabled = true;
  try {
    const session = await navigator.xr!.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "hand-tracking"] });
    await renderer.xr.setSession(session);
  } catch (err) {
    say(`couldn't enter VR: ${err instanceof Error ? err.message : String(err)}`);
    enter.disabled = false;
  }
});

/** For trials/quest-hands.mjs only: what is drawn and written down. */
(window as unknown as { __questHands: unknown }).__questHands = {
  said: () => [...said],
  held: () => Object.fromEntries((["left", "right"] as const).map((s) => [s, { attached: !!models[s]?.group.parent && models[s]!.group.parent !== scene, visible: !!models[s]?.group.visible }])),
  weights: (side: Side) => Object.fromEntries(Object.entries(models[side]?.actions ?? {}).map(([n, a]) => [n, Math.round(a.getEffectiveWeight() * 100) / 100])),
  pose: (side: Side) => poses[side] ?? null,
};
void start();
