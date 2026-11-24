/**
 * The headset console: a world's controls inside an immersive session, where
 * the page and its HUD can't be seen.
 *
 * It draws the same controls the flat HUD draws (ui/model.ts), as one panel of
 * light: sections down the side, their buttons beside them. Two ways to reach
 * it, and a visitor always has the second:
 *
 *  - On the wrist. Where the headset tracks a hand or controller, raising it
 *    in front of the face brings the console up above it, and the other hand
 *    points at it. Which wrist, or none, is the visitor's choice.
 *  - A small arched Menu button that keeps low and in front of the visitor,
 *    and opens the console floating there. It needs no tracked hand, so it
 *    works with gaze-and-pinch too.
 *
 * A world with an interface of its own can turn this down (`Presence`, in
 * ui/model.ts). Quiet, the Menu button shows only where no hand is tracked,
 * and smaller. Hidden, nothing shows until the world opens it with setOpen().
 *
 * Everything is pressed with `select` (spec §21.2). It is drawn by the world:
 * it is that world's console, not a trusted surface (spec §3.2).
 *
 *   const xrConsole = createConsole(controls, { renderer, rig });
 *   scene.add(xrConsole.group);
 *   // each frame:        xrConsole.update(dt, camera, renderer.xr.isPresenting)
 *   // when aiming a ray: const hit = xrConsole.pick(raycaster); xrConsole.aim(hit);
 *   // on select:         if (hit) xrConsole.press(hit);
 */
import * as THREE from "three";
import { CONSOLE_H, CONSOLE_W, createConsoleDrawing, SANS, strokeIcon } from "./console-drawing.js";
import type { Controls } from "./ui/model.js";
import { rgb } from "./ui/theme.js";

// The layout's own numbers and rules, which were here before the drawing had a file of its own.
export { BUTTON_WITH_LINES, pageLines, TAB_MIN, tabLayout } from "./console-drawing.js";

export interface XrConsole {
  /** Add this to the scene (not to the camera or the rig). */
  group: THREE.Group;
  readonly open: boolean;
  setOpen(open: boolean): void;
  /** What this ray points at on the console: a name to hand to aim() and press(), or null. */
  pick(raycaster: THREE.Raycaster): string | null;
  aim(hit: string | null): void;
  press(hit: string): void;
  /** Call every frame. `presenting` is whether a headset session is running. */
  update(dt: number, camera: THREE.Camera, presenting: boolean): void;
  /** What it shows right now, in words. For tests. */
  describe(): { showing: boolean; open: boolean; mount: "wrist" | "floating"; section: string; sections: string[]; buttons: string[]; lines: string[]; linesPage: { page: number; pages: number }; note: string; card: string };
  /** Press the thing with these words: a button, a section, "Menu" or "Close". For tests. */
  pressLabelled(label: string): boolean;
}

const W = CONSOLE_W;
const H = CONSOLE_H;
const FLOAT_W = 0.84; // metres wide when it floats in front of the visitor
const WRIST_W = 0.36; // and when it sits above a wrist
const ASPECT = H / W;

/** The panel's own material: a picture that unfolds upward, with the faint lines of something projected. */
function holoMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    side: THREE.DoubleSide,
    uniforms: { map: { value: map }, uOpen: { value: 1 }, uTime: { value: 0 }, uAccent: { value: new THREE.Color() }, uLines: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform sampler2D map; uniform float uOpen; uniform float uTime; uniform vec3 uAccent; uniform float uLines; varying vec2 vUv;
      void main(){
        if (vUv.y > uOpen) discard;
        vec4 c = texture2D(map, vUv);
        float lines = 1.0 - uLines * 0.05 * (0.5 + 0.5 * sin(vUv.y * 420.0 - uTime * 1.2));
        float lead = (1.0 - step(0.999, uOpen)) * smoothstep(0.03, 0.0, uOpen - vUv.y);
        gl_FragColor = vec4(c.rgb * lines + uAccent * lead, max(c.a, lead * 0.9));
        #include <colorspace_fragment>
      }`,
  });
}

export function createConsole(controls: Controls, opts: { renderer: THREE.WebGLRenderer; rig: THREE.Object3D }): XrConsole {
  const group = new THREE.Group();
  group.name = "nswp-console";
  group.visible = false;

  // ------------------------------------------------------------ the panel
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = holoMaterial(texture);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, ASPECT), material);
  panel.renderOrder = 30;
  panel.visible = false;
  group.add(panel);

  // ------------------------------------------- the button that opens it
  const openerCanvas = document.createElement("canvas");
  openerCanvas.width = 256;
  openerCanvas.height = 300;
  const openerTexture = new THREE.CanvasTexture(openerCanvas);
  openerTexture.colorSpace = THREE.SRGBColorSpace;
  const opener = new THREE.Mesh(new THREE.PlaneGeometry(0.15, (0.15 * 300) / 256), new THREE.MeshBasicMaterial({ map: openerTexture, transparent: true, depthTest: false }));
  opener.renderOrder = 30;
  group.add(opener);

  // The picture itself, and what is on it: drawn by the same code whatever shows it (console-drawing.ts).
  const d = createConsoleDrawing(controls, {
    canvas,
    shown: () => group.visible,
    painted: (t) => {
      texture.needsUpdate = true;
      material.uniforms.uAccent!.value.set(t.accent);
      material.uniforms.uLines!.value = t.motion ? 1 : 0;
    },
  });
  const paint = () => void d.paint();

  let open = false;
  let mount: "wrist" | "floating" = "floating";
  let unfold = 1;
  let clock = 0;
  let sinceRead = 0;
  let placed = false;
  let settling = false;
  let wristFor = 0; // seconds the wrist has been held up
  let wristAway = 0;

  const paintOpener = (hot: boolean) => {
    const t = controls.theme;
    const c = openerCanvas.getContext("2d")!;
    const w = openerCanvas.width;
    const h = openerCanvas.height;
    c.clearRect(0, 0, w, h);
    // An arch on a sill: the same small doorway the flat HUD's keys are.
    c.beginPath();
    c.moveTo(28, h - 44);
    c.lineTo(28, 128);
    c.arc(w / 2, 128, w / 2 - 28, Math.PI, 0);
    c.lineTo(w - 28, h - 44);
    c.closePath();
    c.fillStyle = hot ? `rgba(${rgb(t.accent)}, 0.34)` : `rgba(${rgb(t.glass)}, 0.82)`;
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = t.accent;
    c.stroke();
    c.fillStyle = hot ? t.accent : t.ink;
    c.fillRect(14, h - 34, w - 28, 8);
    c.strokeStyle = hot ? t.accent : t.ink;
    strokeIcon(c, "menu", w / 2 - 44, 60, 88);
    c.fillStyle = t.ink;
    c.font = `600 40px ${SANS}`;
    c.textAlign = "center";
    c.fillText("Menu", w / 2, 208);
    openerTexture.needsUpdate = true;
  };

  // ----------------------------------------------------------- the wrists
  // The grip spaces move with a tracked controller or hand. Which hand each is arrives when it connects.
  const grips = [0, 1].map((i) => {
    const grip = opts.renderer.xr.getControllerGrip(i);
    const info = { grip, hand: "" };
    grip.addEventListener("connected", ((e: { data?: { handedness?: string } }) => {
      info.hand = e.data?.handedness ?? "";
    }) as never);
    grip.addEventListener("disconnected", (() => {
      info.hand = "";
    }) as never);
    opts.rig.add(grip);
    return info;
  });

  const head = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const want = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const toHand = new THREE.Vector3();

  // Something asks for the controls on one of their sections ("show:<section>": the kit's first-time question,
  // someone's picture pressed): in a headset the console opens there, as the flat menu does on a screen.
  controls.onSignal((name) => {
    if (!name.startsWith("show:") || !opts.renderer.xr.isPresenting) return;
    d.section = name.slice(5);
    setOpen(true, "floating");
  });
  const setOpen = (next: boolean, where: "wrist" | "floating" = "floating") => {
    if (open === next && mount === where) return;
    if (open !== next) controls.signal(next ? "menuOpen" : "menuClose");
    open = next;
    mount = where;
    placed = false;
    d.aimed = null;
    unfold = controls.theme.motion && next ? 0 : 1;
    panel.visible = next;
    opener.visible = !next;
    if (next) {
      d.again();
      paint();
    }
  };

  const stop = controls.subscribe(() => {
    d.again();
    paintOpener(d.aimed === "open");
  });
  void stop;
  paintOpener(false);

  const con: XrConsole = {
    group,
    get open() {
      return open;
    },
    setOpen: (next) => setOpen(next, "floating"),
    pick(raycaster) {
      if (!group.visible) return null;
      if (!open) return opener.visible && raycaster.intersectObject(opener, false).length ? "open" : null;
      const hit = raycaster.intersectObject(panel, false)[0];
      if (!hit?.uv) return null;
      const x = hit.uv.x * W;
      const y = (1 - hit.uv.y) * H;
      // Anywhere on the pane counts as the console, so a ray at it never falls through to the world behind.
      return d.regions.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)?.id ?? "pane";
    },
    aim(hit) {
      const next = hit === "pane" ? null : hit;
      if (next === d.aimed) return;
      d.aimed = next;
      if (open) paint();
      else paintOpener(d.aimed === "open");
    },
    press(hit) {
      if (hit === "open") return setOpen(true, "floating");
      if (hit === "close") return setOpen(false, mount);
      if (hit.startsWith("tab:")) {
        d.section = hit.slice(4);
        paint();
        return;
      }
      if (hit === "lines-more") {
        d.turnPage();
        paint();
        return;
      }
      if (hit.startsWith("act:")) {
        controls.run(hit.slice(4));
        sinceRead = 1;
      }
    },
    update(dt, camera, presenting) {
      if (!presenting) {
        if (group.visible) {
          group.visible = false;
          setOpen(false);
        }
        return;
      }
      clock += dt;
      camera.getWorldPosition(head);
      camera.getWorldDirection(facing);
      const t = controls.theme;
      const presence = controls.presence;

      // Raising the chosen wrist close in front of the face opens the console above it; lowering it puts it away.
      // A hidden console answers to nothing but the world.
      const tracked = t.wrist === "off" || presence === "hidden" ? undefined : grips.find((x) => x.hand === t.wrist && x.grip.visible);
      if (tracked) {
        tracked.grip.getWorldPosition(hand);
        toHand.copy(hand).sub(head);
        const far = toHand.length();
        const inView = toHand.normalize().dot(facing);
        if (far < 0.48 && inView > 0.88) {
          wristFor += dt;
          wristAway = 0;
        } else if (far > 0.6 || inView < 0.72) {
          wristAway += dt;
          wristFor = 0;
        }
        if (!open && wristFor > 0.35) setOpen(true, "wrist");
        if (open && mount === "wrist" && wristAway > 0.4) setOpen(false, "wrist");
      } else if (open && mount === "wrist") setOpen(false, "wrist");

      const flat = Math.hypot(facing.x, facing.z) || 1;
      if (open && mount === "wrist" && tracked) {
        // Above the wrist, turned to the eyes. It follows the hand, eased so a shaky hand doesn't shake it.
        want.set(hand.x, hand.y + 0.16, hand.z);
        if (!placed) group.position.copy(want);
        else group.position.lerp(want, Math.min(1, dt * 14));
        placed = true;
        panel.scale.setScalar(WRIST_W);
        group.lookAt(head);
      } else {
        const reach = open ? 1.05 : 0.75;
        want.set(head.x + (facing.x / flat) * reach, Math.max(0.4, head.y - (open ? 0.18 : 0.52)), head.z + (facing.z / flat) * reach);
        if (!placed) {
          group.position.copy(want);
          placed = true;
          settling = false;
        } else if (open) {
          // Open, it stays where it opened, so it can be aimed at. Walk away and it closes.
          if (Math.hypot(head.x - group.position.x, head.z - group.position.z) > 2.6) setOpen(false);
        } else {
          // Closed, the button keeps to the visitor's side, but lazily: it moves once they have turned or walked well away.
          if (group.position.distanceTo(want) > 0.6) settling = true;
          if (settling) {
            group.position.lerp(want, Math.min(1, dt * 6));
            if (group.position.distanceTo(want) < 0.02) settling = false;
          }
        }
        panel.scale.setScalar(FLOAT_W);
        group.rotation.set(0, Math.atan2(head.x - group.position.x, head.z - group.position.z), 0);
      }
      group.visible = true;

      if (open) {
        unfold = Math.min(1, unfold + dt * 4.5);
        material.uniforms.uOpen!.value = unfold;
        material.uniforms.uTime!.value = t.motion ? clock : 0;
        if ((sinceRead += dt) > 0.3) {
          sinceRead = 0;
          paint();
        }
      } else {
        // The button is there for anyone in full; in quiet, only for someone with no wrist to raise.
        opener.visible = presence === "full" || (presence === "quiet" && !tracked);
        opener.scale.setScalar((presence === "quiet" ? 0.7 : 1) * (d.aimed === "open" ? 1.1 : 1));
      }
    },
    describe() {
      const view = controls.view();
      const current = view.sections.find((s) => s.id === d.section) ?? view.sections[0];
      return {
        showing: group.visible,
        open,
        mount,
        section: open ? (current?.id ?? "") : "",
        sections: open ? view.sections.map((s) => s.label) : [],
        buttons: open ? [...(current?.items.filter((i) => i.kind !== "line" && i.kind !== "slider").map((i) => i.label) ?? []), ...(d.linePages > 1 ? [`Page ${d.linePage + 1} of ${d.linePages}`] : [])] : opener.visible ? ["Menu"] : [],
        lines: open ? (current?.items.filter((i) => i.kind === "line").map((i) => i.label) ?? []) : [],
        linesPage: { page: open ? d.linePage + 1 : 0, pages: open ? d.linePages : 0 },
        note: open ? (current?.note ?? "") : "",
        card: open ? (current?.card?.title ?? "") : "",
      };
    },
    pressLabelled(label) {
      if (!open) {
        if (label !== "Menu" || !opener.visible) return false;
        con.press("open");
        return true;
      }
      paint();
      const region = d.regions.find((r) => r.label === label);
      if (!region) return false;
      con.press(region.id);
      return true;
    },
  };
  return con;
}
