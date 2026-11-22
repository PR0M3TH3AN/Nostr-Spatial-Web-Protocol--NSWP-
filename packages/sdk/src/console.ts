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
  describe(): { showing: boolean; open: boolean; mount: "wrist" | "floating"; section: string; sections: string[]; buttons: string[]; lines: string[]; linesPage: { page: number; pages: number }; note: string; card: string };
  /** Press the thing with these words: a button, a section, "Menu" or "Close". For tests. */
  pressLabelled(label: string): boolean;
}

const W = 1024;
const H = 640;
const FLOAT_W = 0.84; // metres wide when it floats in front of the visitor
const WRIST_W = 0.36; // and when it sits above a wrist
const ASPECT = H / W;

/** The least height a section's tab is given in one column; fewer, and the sections go into two columns instead. */
export const TAB_MIN = 52;
/** A button's height while there are lines under it: room is kept for the lines, never by shrinking their words. */
export const BUTTON_WITH_LINES = 72;

/**
 * Where the sections go down the left: one column while each tab can have `TAB_MIN`, else two, filled down the first
 * and then the second, so every section is one select away and no icon touches its neighbour. `left` is where the
 * open section's buttons begin.
 */
export function tabLayout(count: number): { cols: 1 | 2; rows: number; tabH: number; colW: number; left: number } {
  const n = Math.max(1, count);
  const room = H - 150;
  if (room / n >= TAB_MIN) return { cols: 1, rows: n, tabH: Math.min(88, room / n), colW: 236, left: 284 };
  const rows = Math.ceil(n / 2);
  return { cols: 2, rows, tabH: Math.min(88, room / rows), colW: 168, left: 384 };
}

/**
 * The lines of a section, a page at a time: as many whole lines as fit the room, in order, and the rest on the next
 * page. Their words are always the console's usual size: a page more, never a smaller sentence. Every page has at
 * least one line, even one taller than the room.
 */
export function pageLines(heights: readonly number[], room: number): number[][] {
  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;
  heights.forEach((h, i) => {
    if (page.length && used + h > room) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(i);
    used += h;
  });
  if (page.length) pages.push(page);
  return pages;
}

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
  // A single word longer than the room (an address, a name with no spaces) is cut, rather than run past the edge.
  return out.map((line) => fit(g, line, max));
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
  /** Which page of the open section's lines is shown, of how many, and for what (a page is kept until that changes). */
  let linePage = 0;
  let linePages = 1;
  let linesFor = "";

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
    // How far along is drawn to the whole percent: finer than that, and the panel would be drawn again for nothing.
    const loads = view.loading ? { words: view.loading.words, much: view.loading.fraction === null ? null : Math.floor(view.loading.fraction * 100) } : null;
    const signature = JSON.stringify([view.title, view.address, loads, view.sections, section, aimed, t, linePage]);
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
    // Still loading: the address keeps the left half of its line, and the world's words take the right, up to Close.
    g.fillText(fit(g, view.address, loads ? (W - 300) / 2 - 16 : W - 300), 112, 96);
    if (loads) {
      g.font = `500 ${Math.round(24 * k)}px ${SANS}`;
      g.fillStyle = `rgb(${A})`;
      g.textAlign = "right";
      const said = `${loads.words || "Still loading"}${loads.much === null ? "" : `  ${loads.much}%`}`;
      g.fillText(fit(g, said, (W - 300) / 2 - 16), W - 172, 96);
      g.textAlign = "left";
    }

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
    // How far along, as the line under the header filling: all of it lit faintly where that can't be said.
    if (loads) {
      g.fillStyle = `rgba(${A}, ${loads.much === null ? 0.45 : 1})`;
      g.fillRect(28, 121, (W - 56) * (loads.much === null ? 1 : loads.much / 100), 4);
    }

    // Sections, down the left: in two columns when there are too many for one to give each room.
    const tabs = tabLayout(view.sections.length);
    const tabIcon = Math.min(36, tabs.tabH - 18);
    view.sections.forEach((s, i) => {
      const c = tabs.cols === 2 ? Math.floor(i / tabs.rows) : 0;
      const x = 24 + c * (tabs.colW + 8);
      const y = 134 + (tabs.cols === 2 ? i % tabs.rows : i) * tabs.tabH;
      const h = tabs.tabH - 8;
      const on = s.id === section;
      button({ id: `tab:${s.id}`, x, y, w: tabs.colW, h, label: s.label }, (hot) => {
        if (on || hot) {
          g.beginPath();
          g.roundRect(x, y, tabs.colW, h, [6, 18, 18, 6]);
          g.fillStyle = `rgba(${A}, ${on ? 0.16 : 0.08})`;
          g.fill();
        }
        if (on) {
          g.fillStyle = t.accent;
          g.fillRect(x, y, 5, h);
        }
        g.strokeStyle = g.fillStyle = on ? t.accent : hot ? t.ink : `rgba(${I}, 0.72)`;
        strokeIcon(g, s.icon, x + 16, y + h / 2 - tabIcon / 2, tabIcon);
        g.font = `${on ? 650 : 500} ${Math.round((tabs.cols === 2 ? 22 : 30) * k)}px ${SANS}`;
        g.textBaseline = "middle";
        g.fillText(fit(g, s.label, tabs.colW - tabIcon - 34), x + tabIcon + 26, y + h / 2 + 2);
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
    const left = tabs.left;
    const areaW = W - left - 30;
    const noteLines = noteNow ? wrap(g, noteNow, areaW - 16, 4) : [];
    const noteH = noteLines.length ? noteLines.length * 32 + 20 : 0;

    // Who the section is about, at its head: a face, a name, how they are known, and what they say of themselves.
    const card = current?.card ?? null;
    const cardH = card ? (card.text ? 162 : 104) : 0;
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

    // The lines, at the console's usual size, one to a row across the whole width: each its whole sentence, wrapped
    // and never cut. What doesn't fit goes on another page, and a button under the others shows the next.
    const lineSize = Math.round(22 * k);
    const lineTextW = areaW - 44;
    g.font = `400 ${lineSize}px ${SANS}`;
    const laid = lines.map((item) => wrap(g, item.label, lineTextW, 99));
    const lineHs = laid.map((l) => l.length * (lineSize + 4) + 4);
    const contentTop = 138 + cardH;
    // Kept clear of the note under it.
    const contentRoom = H - 14 - noteH - (noteH ? 10 : 0) - contentTop;
    // Two buttons of long words (a question's two answers) are one column, so neither is cut short.
    const columns = (n: number) => (n <= 2 && items.some((item) => item.label.length > 24) ? 1 : n > 8 ? 3 : 2);
    const grid = (n: number, withLines: boolean) => {
      let cols = columns(n);
      // The page button sits beside the others where there is a cell for it, rather than taking a row of its own.
      if (withLines && n <= 3 && n > items.length && cols < n) cols = n;
      const rows = n ? Math.ceil(n / cols) : 0;
      const free = contentRoom - (rows - 1) * 12;
      const cellH = !rows ? 0 : withLines && lines.length ? Math.min(BUTTON_WITH_LINES, free / rows) : Math.min(96, free / rows);
      return { cols, rows, cellH: Math.max(0, cellH), height: rows ? rows * (cellH + 12) : 0 };
    };
    const forLines = lines.length > 0;
    let cells = items.length;
    let layout = grid(cells, forLines);
    let pages = [lines.map((_, i) => i)];
    if (forLines) {
      const room = contentRoom - layout.height - 4;
      if (lineHs.reduce((a, h) => a + h, 0) > room) {
        cells = items.length + 1;
        layout = grid(cells, true);
        pages = pageLines(lineHs, contentRoom - layout.height - 4);
      }
    }
    const key = `${section}|${card?.title ?? ""}|${lines.map((l) => l.label).join("|")}`;
    if (key !== linesFor) {
      linesFor = key;
      linePage = 0;
    }
    linePages = pages.length;
    if (linePage >= linePages) linePage = 0;
    const { cols, cellH } = layout;
    const evenW = (areaW - (cols - 1) * 14) / cols;
    // Where the page button shares a single row with the others, it needs only its few words, and they get the rest.
    const PAGER_W = 150;
    const shared = !!(linePages > 1 && layout.rows === 1 && items.length);
    const itemW = shared ? (areaW - PAGER_W - items.length * 14) / items.length : evenW;
    const cellAt = (i: number): { x: number; y: number; w: number } =>
      shared ? { x: left + i * (itemW + 14), y: contentTop, w: i < items.length ? itemW : PAGER_W } : { x: left + (i % cols) * (evenW + 14), y: contentTop + Math.floor(i / cols) * (cellH + 12), w: evenW };
    const pager: UiItemView | null =
      linePages > 1 ? { id: "", label: `Page ${linePage + 1} of ${linePages}`, icon: "turn", on: null, tone: "normal", key: "", short: "", kind: "button", color: "" } : null;
    [...items, ...(pager ? [pager] : [])].forEach((item, i) => {
      const { x, y, w: cellW } = cellAt(i);
      const tone = item.tone === "warn" ? rgb(t.warn) : A;
      button({ id: item === pager ? "lines-more" : `act:${item.id}`, x, y, w: cellW, h: cellH, label: item.label }, (hot) => {
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
        const iconSize = Math.max(0, Math.min(40, cellH - 30));
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
        const size = Math.round((cols === 3 || cellW < 240 ? 23 : 28) * k);
        g.font = `600 ${size}px ${SANS}`;
        g.textBaseline = "middle";
        // Two lines before any word is cut short: a button's words are how it is found.
        const words = wrap(g, item.label, cellW - iconSize - 44, cellH >= size * 2 + 12 ? 2 : 1);
        words.forEach((line, n) => g.fillText(line, x + iconSize + 30, y + cellH / 2 - 2 + (n - (words.length - 1) / 2) * (size + 3)));
        g.textBaseline = "alphabetic";
      });
    });

    if (lines.length) {
      let y = contentTop + layout.height + 4;
      for (const i of pages[linePage] ?? []) {
        const item = lines[i]!;
        g.strokeStyle = g.fillStyle = item.on ? t.accent : `rgba(${I}, 0.4)`;
        strokeIcon(g, item.icon, left + 4, y + 2, Math.min(28, lineSize + 6));
        g.fillStyle = item.on ? t.ink : `rgba(${I}, 0.6)`;
        g.font = `${item.on ? 500 : 400} ${lineSize}px ${SANS}`;
        laid[i]!.forEach((line, n) => g.fillText(line, left + 40, y + lineSize + n * (lineSize + 4)));
        y += lineHs[i]!;
      }
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
      if (hit === "lines-more") {
        linePage = (linePage + 1) % Math.max(1, linePages);
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
        buttons: open ? [...(current?.items.filter((i) => i.kind !== "line").map((i) => i.label) ?? []), ...(linePages > 1 ? [`Page ${linePage + 1} of ${linePages}`] : [])] : opener.visible ? ["Menu"] : [],
        lines: open ? (current?.items.filter((i) => i.kind === "line").map((i) => i.label) ?? []) : [],
        linesPage: { page: open ? linePage + 1 : 0, pages: open ? linePages : 0 },
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
