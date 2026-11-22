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
import { ICONS, type IconName } from "./ui/icons.js";
import { loadPicture } from "./picture.js";
import type { Controls, UiItemView, UiView } from "./ui/model.js";
import { rgb } from "./ui/theme.js";

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
  describe(): { showing: boolean; open: boolean; mount: "wrist" | "floating"; section: string; sections: string[]; buttons: string[]; lines: string[]; note: string; card: string };
  /** Press the thing with these words: a button, a section, "Menu" or "Close". For tests. */
  pressLabelled(label: string): boolean;
}

const W = 1024;
const H = 640;
const FLOAT_W = 0.84; // metres wide when it floats in front of the visitor
const WRIST_W = 0.36; // and when it sits above a wrist
const ASPECT = H / W;

interface Region {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

function strokeIcon(g: CanvasRenderingContext2D, name: IconName | null, x: number, y: number, size: number): void {
  if (!name) return;
  g.save();
  g.translate(x, y);
  g.scale(size / 24, size / 24);
  g.lineWidth = 1.7;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.stroke(new Path2D(ICONS[name]));
  g.restore();
}

function fit(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width <= max || !line) line = next;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = fit(g, `${out[lines - 1]} …`, max);
  }
  return out;
}

const SANS = 'system-ui, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

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
  const g = canvas.getContext("2d")!;
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

  let open = false;
  let mount: "wrist" | "floating" = "floating";
  let section = "";
  let aimed: string | null = null;
  let regions: Region[] = [];
  let painted = "";
  let unfold = 1;
  let clock = 0;
  let sinceRead = 0;
  let placed = false;
  let settling = false;
  let wristFor = 0; // seconds the wrist has been held up
  let wristAway = 0;
  let noteNow = "";

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

  /** Pictures for the card at the head of a section, by where each is: fetched once, the kit's way, and only drawn. */
  const faces = new Map<string, HTMLCanvasElement | null>();
  const faceOf = (address: string): HTMLCanvasElement | null => {
    if (!faces.has(address)) {
      faces.set(address, null);
      void loadPicture(address).then((drawn) => {
        if (!drawn) return;
        faces.set(address, drawn);
        painted = ""; // drawn again, with the picture in it
        if (group.visible) paint();
      });
    }
    return faces.get(address) ?? null;
  };

  /** Draw the whole console: header, sections down the left, the open section's buttons, its note. */
  const paint = () => {
    const view: UiView = controls.view();
    const t = view.theme;
    if (!view.sections.some((s) => s.id === section)) section = view.sections[0]?.id ?? "";
    const signature = JSON.stringify([view.title, view.address, view.sections, section, aimed, t]);
    if (signature === painted) return;
    painted = signature;
    const A = rgb(t.accent);
    const I = rgb(t.ink);
    const k = Math.min(1.2, t.scale); // text can't grow past what the panel holds
    regions = [];
    g.clearRect(0, 0, W, H);

    // The pane: glass with a lit top edge, its top corners rounded like an arch's shoulders.
    g.beginPath();
    g.roundRect(4, 4, W - 8, H - 8, [56, 56, 18, 18]);
    g.fillStyle = `rgba(${rgb(t.glass)}, 0.86)`;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = `rgba(${A}, 0.55)`;
    g.stroke();
    const top = g.createLinearGradient(80, 0, W - 80, 0);
    top.addColorStop(0, `rgba(${A}, 0)`);
    top.addColorStop(0.5, `rgba(${A}, 1)`);
    top.addColorStop(1, `rgba(${A}, 0)`);
    g.fillStyle = top;
    g.fillRect(80, 4, W - 160, 4);

    // Header: the lit doorway, the world's name, its address.
    const mark = g.createLinearGradient(0, 30, 0, 96);
    mark.addColorStop(0, `rgba(${A}, 0.95)`);
    mark.addColorStop(1, `rgba(${A}, 0.25)`);
    g.fillStyle = mark;
    g.beginPath();
    g.roundRect(40, 30, 44, 60, [22, 22, 4, 4]);
    g.fill();
    g.fillStyle = t.ink;
    g.fillRect(32, 94, 60, 4);
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.font = `650 ${Math.round(38 * k)}px ${SANS}`;
    g.fillText(fit(g, view.title, W - 300), 112, 62);
    g.font = `400 ${Math.round(24 * k)}px ${MONO}`;
    g.fillStyle = `rgba(${I}, 0.66)`;
    g.fillText(fit(g, view.address, W - 300), 112, 96);

    const button = (r: Region, draw: (hot: boolean) => void) => {
      regions.push(r);
      draw(aimed === r.id);
    };

    // Close, top right.
    button({ id: "close", x: W - 150, y: 26, w: 116, h: 72, label: "Close" }, (hot) => {
      g.beginPath();
      g.roundRect(W - 150, 26, 116, 72, 16);
      g.fillStyle = hot ? `rgba(${I}, 0.18)` : `rgba(${I}, 0.05)`;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = `rgba(${I}, ${hot ? 0.9 : 0.3})`;
      g.stroke();
      g.strokeStyle = t.ink;
      strokeIcon(g, "exit", W - 150 + 38, 26 + 16, 40);
    });

    g.fillStyle = `rgba(${A}, 0.22)`;
    g.fillRect(28, 122, W - 56, 2);

    // Sections, down the left.
    const tabH = Math.min(88, (H - 150) / Math.max(view.sections.length, 1));
    view.sections.forEach((s, i) => {
      const y = 134 + i * tabH;
      const on = s.id === section;
      button({ id: `tab:${s.id}`, x: 24, y, w: 236, h: tabH - 8, label: s.label }, (hot) => {
        if (on || hot) {
          g.beginPath();
          g.roundRect(24, y, 236, tabH - 8, [6, 18, 18, 6]);
          g.fillStyle = `rgba(${A}, ${on ? 0.16 : 0.08})`;
          g.fill();
        }
        if (on) {
          g.fillStyle = t.accent;
          g.fillRect(24, y, 5, tabH - 8);
        }
        g.strokeStyle = g.fillStyle = on ? t.accent : hot ? t.ink : `rgba(${I}, 0.72)`;
        strokeIcon(g, s.icon, 44, y + (tabH - 8) / 2 - 18, 36);
        g.font = `${on ? 650 : 500} ${Math.round(30 * k)}px ${SANS}`;
        g.textBaseline = "middle";
        g.fillText(fit(g, s.label, 150), 96, y + (tabH - 8) / 2 + 2);
        g.textBaseline = "alphabetic";
      });
    });

    // The open section's buttons, in two columns, or three when there are many.
    const current = view.sections.find((s) => s.id === section);
    // Lines are read, not pressed: they are laid out under the buttons, and are no region a ray can choose.
    const items: UiItemView[] = (current?.items ?? []).filter((item) => item.kind !== "line");
    const lines: UiItemView[] = (current?.items ?? []).filter((item) => item.kind === "line");
    noteNow = current?.note ?? "";
    g.font = `400 ${Math.round(24 * k)}px ${SANS}`;
    const noteLines = noteNow ? wrap(g, noteNow, W - 330, 3) : [];
    const noteH = noteLines.length ? noteLines.length * 32 + 20 : 0;
    const left = 284;
    const areaW = W - left - 30;

    // Who the section is about, at its head: a face, a name, how they are known, and what they say of themselves.
    const card = current?.card ?? null;
    const cardH = card ? (card.text ? 162 : 112) : 0;
    if (card) {
      const y = 138;
      g.beginPath();
      g.roundRect(left, y, areaW, cardH - 12, [22, 22, 8, 8]);
      g.fillStyle = `rgba(${A}, 0.08)`;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = `rgba(${A}, 0.5)`;
      g.stroke();
      const face = card.picture ? faceOf(card.picture) : null;
      const cx = left + 58;
      const cy = y + 50;
      g.save();
      g.beginPath();
      g.arc(cx, cy, 36, 0, Math.PI * 2);
      g.closePath();
      g.fillStyle = card.color || `rgba(${I}, 0.25)`;
      g.fill();
      if (face) {
        g.clip();
        g.drawImage(face, cx - 36, cy - 36, 72, 72);
      } else {
        g.fillStyle = t.glass;
        g.font = `700 ${Math.round(40 * k)}px ${SANS}`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText([...card.title][0]?.toUpperCase() ?? "", cx, cy + 2);
        g.textAlign = "left";
        g.textBaseline = "alphabetic";
      }
      g.restore();
      const tx = left + 116;
      g.font = `650 ${Math.round(32 * k)}px ${SANS}`;
      g.fillStyle = t.ink;
      const name = fit(g, card.title, areaW - 300);
      g.fillText(name, tx, y + 43);
      if (card.tag) {
        const nameW = g.measureText(name).width;
        g.font = `500 ${Math.round(21 * k)}px ${SANS}`;
        const tagW = g.measureText(card.tag).width + 26;
        g.beginPath();
        g.roundRect(tx + nameW + 16, y + 17, tagW, 34, 17);
        g.lineWidth = 2;
        g.strokeStyle = card.proven ? `rgba(${A}, 0.9)` : `rgba(${I}, 0.35)`;
        g.stroke();
        g.fillStyle = card.proven ? t.accent : `rgba(${I}, 0.8)`;
        g.fillText(card.tag, tx + nameW + 29, y + 41);
      }
      g.font = `400 ${Math.round(22 * k)}px ${card.copy ? MONO : SANS}`;
      g.fillStyle = `rgba(${I}, 0.7)`;
      g.fillText(fit(g, [card.sub, ...card.now].join("   "), areaW - 140), tx, y + 78);
      if (card.text) {
        g.fillStyle = `rgba(${A}, 0.7)`;
        g.fillRect(left + 20, y + 96, 3, 48);
        g.font = `400 ${Math.round(22 * k)}px ${SANS}`;
        g.fillStyle = `rgba(${I}, 0.9)`;
        wrap(g, card.text, areaW - 60, 2).forEach((line, i) => g.fillText(line, left + 34, y + 114 + i * 26));
      }
    }

    // Two buttons of long words (a question's two answers) are one column, so neither is cut short.
    const cols = items.length <= 2 && items.some((item) => item.label.length > 24) ? 1 : items.length > 8 ? 3 : 2;
    const rowsN = Math.max(1, Math.ceil(items.length / cols));
    const cellW = (areaW - (cols - 1) * 14) / cols;
    // Room kept for the lines: at least as much as two lines of words for each row of them.
    const lineRows = Math.ceil(lines.length / 2);
    const linesH = lines.length ? lineRows * 50 + 10 : 0;
    const cellH = items.length ? Math.min(96, (H - 150 - noteH - cardH - linesH - (rowsN - 1) * 12) / rowsN) : 0;
    items.forEach((item, i) => {
      const x = left + (i % cols) * (cellW + 14);
      const y = 138 + cardH + Math.floor(i / cols) * (cellH + 12);
      const tone = item.tone === "warn" ? rgb(t.warn) : A;
      button({ id: `act:${item.id}`, x, y, w: cellW, h: cellH, label: item.label }, (hot) => {
        g.beginPath();
        g.roundRect(x, y, cellW, cellH, [18, 18, 6, 6]);
        g.fillStyle = hot ? `rgba(${tone}, 0.3)` : item.tone === "primary" || item.on ? `rgba(${tone}, 0.16)` : `rgba(${I}, 0.05)`;
        g.fill();
        g.lineWidth = hot ? 4 : 2;
        g.strokeStyle = hot || item.on ? `rgba(${tone}, 1)` : `rgba(${tone}, 0.4)`;
        g.stroke();
        // The sill: lit when the thing is on.
        g.fillStyle = item.on ? `rgb(${tone})` : `rgba(${I}, 0.22)`;
        g.fillRect(x + 14, y + cellH - 7, cellW - 28, 3);
        g.strokeStyle = g.fillStyle = item.tone === "warn" ? t.warn : item.on ? t.accent : t.ink;
        const iconSize = Math.min(40, cellH - 30);
        if (item.kind === "swatch") {
          // A choice of colour: a small doorway lit in it.
          const ink = g.fillStyle;
          g.fillStyle = item.color;
          g.beginPath();
          g.roundRect(x + 20, y + (cellH - iconSize) / 2 - 4, iconSize * 0.78, iconSize, [iconSize * 0.39, iconSize * 0.39, 4, 4]);
          g.fill();
          g.fillStyle = ink;
        } else if (item.kind === "tile") {
          // A thing with a picture of itself: its picture where another button has an icon.
          const picture = item.picture?.();
          const side = Math.min(cellH - 12, iconSize * 1.5);
          if (picture) g.drawImage(picture, x + 10, y + (cellH - side) / 2 - 2, side, side);
          else strokeIcon(g, item.icon, x + 18, y + (cellH - iconSize) / 2 - 2, iconSize);
        } else strokeIcon(g, item.icon, x + 18, y + (cellH - iconSize) / 2 - 2, iconSize);
        const size = Math.round((cols === 3 ? 23 : 28) * k);
        g.font = `600 ${size}px ${SANS}`;
        g.textBaseline = "middle";
        // Two lines before any word is cut short: a button's words are how it is found.
        const words = wrap(g, item.label, cellW - iconSize - 44, cellH > 70 ? 2 : 1);
        words.forEach((line, n) => g.fillText(line, x + iconSize + 30, y + cellH / 2 - 2 + (n - (words.length - 1) / 2) * (size + 3)));
        g.textBaseline = "alphabetic";
      });
    });

    // The lines: two columns, each its whole sentence, wrapped and never cut. The words are made smaller until every
    // one fits the room there is, rather than any being shortened.
    if (lines.length) {
      const top = 138 + cardH + (items.length ? rowsN * (cellH + 12) : 0) + 4;
      const room = H - 14 - noteH - top;
      const colW = (areaW - 14) / 2;
      const textW = colW - 44;
      let size = Math.round(22 * k);
      let laid: string[][] = [];
      let rowH = 0;
      for (; size >= 12; size--) {
        g.font = `400 ${size}px ${SANS}`;
        laid = lines.map((item) => wrap(g, item.label, textW, 99));
        rowH = Math.max(...laid.map((l) => l.length)) * (size + 4) + 8;
        if (lineRows * rowH <= room) break;
      }
      lines.forEach((item, i) => {
        const x = left + (i % 2) * (colW + 14);
        const y = top + Math.floor(i / 2) * rowH;
        g.strokeStyle = g.fillStyle = item.on ? t.accent : `rgba(${I}, 0.4)`;
        strokeIcon(g, item.icon, x + 4, y + 2, Math.min(28, size + 6));
        g.fillStyle = item.on ? t.ink : `rgba(${I}, 0.6)`;
        g.font = `${item.on ? 500 : 400} ${size}px ${SANS}`;
        laid[i]!.forEach((line, n) => g.fillText(line, x + 40, y + size + n * (size + 4)));
      });
    }

    // What a visitor should know before using this section.
    if (noteLines.length) {
      const y = H - noteH - 14;
      g.fillStyle = `rgba(${A}, 0.7)`;
      g.fillRect(left, y, 3, noteH - 8);
      g.font = `400 ${Math.round(24 * k)}px ${SANS}`;
      g.fillStyle = `rgba(${I}, 0.82)`;
      noteLines.forEach((line, i) => g.fillText(line, left + 16, y + 24 + i * 32));
    }

    texture.needsUpdate = true;
    material.uniforms.uAccent!.value.set(t.accent);
    material.uniforms.uLines!.value = t.motion ? 1 : 0;
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
    section = name.slice(5);
    setOpen(true, "floating");
  });
  const setOpen = (next: boolean, where: "wrist" | "floating" = "floating") => {
    if (open === next && mount === where) return;
    if (open !== next) controls.signal(next ? "menuOpen" : "menuClose");
    open = next;
    mount = where;
    placed = false;
    aimed = null;
    unfold = controls.theme.motion && next ? 0 : 1;
    panel.visible = next;
    opener.visible = !next;
    if (next) {
      painted = "";
      paint();
    }
  };

  const stop = controls.subscribe(() => {
    painted = "";
    paintOpener(aimed === "open");
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
      return regions.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)?.id ?? "pane";
    },
    aim(hit) {
      const next = hit === "pane" ? null : hit;
      if (next === aimed) return;
      aimed = next;
      if (open) paint();
      else paintOpener(aimed === "open");
    },
    press(hit) {
      if (hit === "open") return setOpen(true, "floating");
      if (hit === "close") return setOpen(false, mount);
      if (hit.startsWith("tab:")) {
        section = hit.slice(4);
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
        opener.scale.setScalar((presence === "quiet" ? 0.7 : 1) * (aimed === "open" ? 1.1 : 1));
      }
    },
    describe() {
      const view = controls.view();
      const current = view.sections.find((s) => s.id === section) ?? view.sections[0];
      return {
        showing: group.visible,
        open,
        mount,
        section: open ? (current?.id ?? "") : "",
        sections: open ? view.sections.map((s) => s.label) : [],
        buttons: open ? (current?.items.filter((i) => i.kind !== "line").map((i) => i.label) ?? []) : opener.visible ? ["Menu"] : [],
        lines: open ? (current?.items.filter((i) => i.kind === "line").map((i) => i.label) ?? []) : [],
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
      const region = regions.find((r) => r.label === label);
      if (!region) return false;
      con.press(region.id);
      return true;
    },
  };
  return con;
}
