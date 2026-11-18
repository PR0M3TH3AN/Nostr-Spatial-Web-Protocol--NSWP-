/**
 * A keyboard to type on inside a headset.
 *
 * It is drawn by the page, in the scene, so it works on every headset: the
 * keys are pressed with a select, like everything else. A real keyboard
 * joined to the headset types into it as well, and so does a paste. Where a
 * headset's browser offers its own keyboard to a page, one key hands over to
 * it; that is the visitor's choice, because few browsers have it and it has
 * been tried on none here.
 *
 *   const keyboard = createKeyboard({ scene, camera, accent });
 *   const text = await keyboard.ask({ title: "A note", multiline: true });   // null if they gave up
 *   // each frame: keyboard.update(t)
 *   // with a ray: const hit = keyboard.pick(raycaster); keyboard.aim(hit); on select: keyboard.press(hit)
 */
import * as THREE from "three";
import { keyAt, placeKeys, TextEntry, type PlacedKey } from "./keys.js";
import { wrapText } from "./panel-store.js";
import { LiveKeys, placeLiveKeys } from "./term-keys.js";

export interface KeyboardOptions {
  scene: THREE.Scene;
  camera: THREE.Camera;
  accent?: THREE.ColorRepresentation;
  textColor?: string;
  /** The headset session, if there is one: asked whether its browser has a keyboard of its own to offer. */
  session?: () => XRSession | null | undefined;
}

export interface AskOptions {
  /** What is being asked for, shown over the words. */
  title: string;
  value?: string;
  /** More than one line: enter starts a new one, and Done ends. */
  multiline?: boolean;
  maxLength?: number;
}

export interface LiveOptions {
  /** What the keys go to, shown over them. */
  title: string;
  /** Each press, as it happens: the bytes a terminal takes. */
  onKey(bytes: string): void;
  /** The visitor put it away, or something else took the keyboard. */
  onClose?(): void;
}

export interface Keyboard {
  readonly group: THREE.Group;
  /** Whether it is up. */
  readonly open: boolean;
  /** Whether it is up for a terminal: every key sent as it is pressed. */
  readonly isLive: boolean;
  /**
   * Put the keyboard up for something that takes keys as they are typed, a
   * terminal. It has Esc, Tab, Ctrl and the arrows, and stays up until it is
   * put away. A real keyboard is the caller's to listen to.
   */
  live(o: LiveOptions): void;
  closeLive(): void;
  /** Put the keyboard up in front of the visitor and wait. Resolves with what they wrote, or null if they gave up. */
  ask(o: AskOptions): Promise<string | null>;
  /** Put it away, as if they gave up. */
  cancel(): void;
  /** What this ray points at: a name to hand to `aim()` and `press()`, or null. While it is up it is in the way of what is behind it. */
  pick(raycaster: THREE.Raycaster): string | null;
  aim(hit: string | null): void;
  press(hit: string): void;
  /** Where a key is in the world, for a test to point at. */
  pointOf(hit: string): THREE.Vector3 | null;
  /** What is written so far, and which keys are showing. */
  info(): { open: boolean; live: boolean; title: string; value: string; layer: string; shift: string; ctrl: boolean; keys: string[] };
  update(t: number): void;
  dispose(): void;
}

const W = 1024;
const SHOW = 300; // pixels for the words, above the keys
const KEYS = 520; // and for the keys
const LIVE_STRIP = 92; // for a terminal, one line above the keys
const WIDTH = 0.8; // metres across

export function createKeyboard(o: KeyboardOptions): Keyboard {
  const accent = `#${new THREE.Color(o.accent ?? 0xffb65c).getHexString()}`;
  const ink = o.textColor ?? "#eef5fb";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = SHOW + KEYS;
  const g = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, (WIDTH * canvas.height) / W), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true }));
  board.name = "keyboard";
  const group = new THREE.Group();
  group.name = "keyboard";
  group.add(board);
  group.visible = false;
  o.scene.add(group);

  let entry = new TextEntry();
  let title = "";
  let keys: PlacedKey[] = [];
  let aimed: string | null = null;
  let done: ((value: string | null) => void) | null = null;
  let stale = true;
  let field: HTMLTextAreaElement | null = null; // the page's own text box, while the headset's keyboard has it
  let live: { keys: LiveKeys; o: LiveOptions } | null = null;
  const systemOffered = () => !!(o.session?.() as unknown as { isSystemKeyboardSupported?: boolean } | null | undefined)?.isSystemKeyboardSupported;
  const lay = () => {
    keys = live ? placeLiveKeys(live.keys.layer) : placeKeys(entry.layer, { multiline: entry.multiline, system: systemOffered() });
    stale = true;
  };

  const paint = () => {
    stale = false;
    g.clearRect(0, 0, W, canvas.height);
    // The words, on glass.
    // For a terminal the words are on the terminal, so there is one line here and nothing in the way above it.
    const top = live ? SHOW - LIVE_STRIP : 0;
    g.fillStyle = "rgba(10, 16, 24, 0.94)";
    g.beginPath();
    g.roundRect(0, top, W, SHOW - 16 - top, 26);
    g.fill();
    g.textBaseline = "top";
    g.fillStyle = accent;
    g.font = "bold 30px system-ui, sans-serif";
    if (live) g.fillText(live.keys.ctrl ? `${title}. Ctrl is on for the next key.` : title, 36, top + 22, W - 72);
    else {
      g.fillText(title, 36, 24, W - 72);
      g.fillStyle = ink;
      g.font = "40px system-ui, sans-serif";
      const lines = wrapText(`${entry.value}▏`, W - 72, (s) => g.measureText(s).width, 400);
      lines.slice(-4).forEach((line, i) => g.fillText(line, 36, 76 + i * 50));
    }
    // The keys.
    for (const k of keys) {
      const [x, y, w, h] = [k.x * W, SHOW + k.y * KEYS, k.width * W, k.height * KEYS];
      const shift = live ? live.keys.shift : entry.shift;
      const on = aimed === k.id || (k.kind === "shift" && shift !== "off") || (k.kind === "ctrl" && !!live?.keys.ctrl);
      g.fillStyle = on ? accent : k.kind === "char" || k.kind === "space" ? "#162231" : k.kind === "done" ? "#24384c" : "#0e1722";
      g.beginPath();
      g.roundRect(x, y, w, h, 16);
      g.fill();
      if (k.kind === "shift" && shift === "lock") {
        g.fillStyle = "#04070b";
        g.fillRect(x + w / 2 - 22, y + h - 16, 44, 5);
      }
      g.fillStyle = on ? "#04070b" : ink;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = k.kind === "char" ? "44px system-ui, sans-serif" : "bold 28px system-ui, sans-serif";
      g.fillText(live ? live.keys.label(k) : entry.label(k), x + w / 2, y + h / 2 + 2, w - 12);
      g.textAlign = "left";
    }
    texture.needsUpdate = true;
  };

  const finish = (value: string | null) => {
    if (!done) return;
    const resolve = done;
    done = null;
    group.visible = false;
    aimed = null;
    field?.remove();
    field = null;
    removeEventListener("keydown", onKey, true);
    removeEventListener("paste", onPaste, true);
    resolve(value);
  };

  // A real keyboard joined to the headset, or the one on a desk: it types here, and nothing behind hears it.
  const onKey = (e: KeyboardEvent) => {
    if (e.target === field) return; // the headset's keyboard is writing into the page's own box
    if (e.ctrlKey || e.metaKey || e.altKey) return; // a paste, or the browser's own business
    let handled = true;
    if (e.key === "Escape") finish(null);
    else if (e.key === "Backspace") entry.erase();
    else if (e.key === "Enter") {
      if (entry.multiline && !e.shiftKey) entry.type("\n");
      else finish(entry.value);
    } else if (e.key.length === 1 || [...e.key].length === 1) entry.type(e.key);
    else handled = e.key.length > 1 && !/^F\d+$/.test(e.key);
    if (handled) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    stale = true;
  };
  const onPaste = (e: ClipboardEvent) => {
    if (e.target === field) return;
    const text = e.clipboardData?.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    entry.type(text);
    stale = true;
  };

  /** Hand over to the headset's own keyboard, where its browser has one: it types into a text box on the page. */
  const useSystem = () => {
    if (field) return;
    field = document.createElement("textarea");
    Object.assign(field.style, { position: "fixed", left: "0", bottom: "0", width: "1px", height: "1px", opacity: "0" });
    field.maxLength = entry.maxLength;
    field.value = entry.value;
    field.addEventListener("input", () => {
      entry.value = "";
      entry.type(field!.value);
      stale = true;
    });
    document.body.append(field);
    field.focus();
  };

  const at = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const local = new THREE.Vector3();
  /** Below the eyes and a short reach ahead, leaning back like something on a desk. */
  const putUp = () => {
    o.camera.getWorldPosition(at);
    o.camera.getWorldDirection(facing);
    facing.y = 0;
    if (facing.lengthSq() < 1e-6) facing.set(0, 0, -1);
    facing.normalize();
    group.position.set(at.x + facing.x * 0.68, Math.max(0.5, at.y - 0.4), at.z + facing.z * 0.68);
    group.rotation.set(-32 * (Math.PI / 180), Math.atan2(-facing.x, -facing.z), 0, "YXZ");
    group.visible = true;
  };
  const closeLive = () => {
    if (!live) return;
    const was = live;
    live = null;
    aimed = null;
    if (!done) group.visible = false;
    was.o.onClose?.();
  };
  const api: Keyboard = {
    group,
    get open() {
      return !!done || !!live;
    },
    get isLive() {
      return !!live;
    },
    live(l) {
      if (done) finish(null);
      closeLive();
      live = { keys: new LiveKeys(), o: l };
      title = l.title;
      lay();
      putUp();
    },
    closeLive,
    ask(a) {
      if (done) finish(null);
      closeLive();
      entry = new TextEntry({ ...(a.value !== undefined ? { value: a.value } : {}), ...(a.multiline !== undefined ? { multiline: a.multiline } : {}), ...(a.maxLength !== undefined ? { maxLength: a.maxLength } : {}) });
      title = a.title;
      lay();
      putUp();
      addEventListener("keydown", onKey, true);
      addEventListener("paste", onPaste, true);
      return new Promise((resolve) => {
        done = resolve;
      });
    },
    cancel() {
      finish(null);
      closeLive();
    },
    pick(raycaster) {
      if (!done && !live) return null;
      const hit = raycaster.intersectObject(board, false)[0];
      if (!hit?.uv) return null;
      const y = (1 - hit.uv.y) * canvas.height;
      // Up for a terminal there is nothing above its one line, and the terminal behind can be pointed at.
      if (live && y < SHOW - LIVE_STRIP) return null;
      const k = y >= SHOW ? keyAt(keys, hit.uv.x, (y - SHOW) / KEYS) : null;
      return `kb:${k?.id ?? ""}`;
    },
    aim(hit) {
      const id = hit?.startsWith("kb:") ? hit.slice(3) || null : null;
      if (id === aimed) return;
      aimed = id;
      stale = true;
    },
    press(hit) {
      if (!hit.startsWith("kb:") || hit.length === 3) return;
      if (live) {
        const what = live.keys.press(hit.slice(3), keys);
        if (what && "close" in what) return closeLive();
        lay();
        if (what) live.o.onKey(what.send);
        return;
      }
      if (!done) return;
      const what = entry.press(hit.slice(3), keys);
      if (what === "done") return finish(entry.value);
      if (what === "cancel") return finish(null);
      if (what === "system") useSystem();
      lay();
    },
    pointOf(hit) {
      const k = hit.startsWith("kb:") ? keys.find((x) => x.id === hit.slice(3)) : null;
      if (!k || (!done && !live)) return null;
      const height = (WIDTH * canvas.height) / W;
      const v = (SHOW + (k.y + k.height / 2) * KEYS) / canvas.height;
      local.set((k.x + k.width / 2 - 0.5) * WIDTH, (0.5 - v) * height, 0);
      group.updateMatrixWorld(true);
      return board.localToWorld(local.clone());
    },
    info: () => ({ open: !!done || !!live, live: !!live, title, value: live ? "" : entry.value, layer: live ? live.keys.layer : entry.layer, shift: live ? live.keys.shift : entry.shift, ctrl: !!live?.keys.ctrl, keys: keys.map((k) => k.id) }),
    update() {
      if ((done || live) && stale) paint();
    },
    dispose() {
      finish(null);
      closeLive();
      o.scene.remove(group);
      board.geometry.dispose();
      (board.material as THREE.Material).dispose();
      texture.dispose();
    },
  };
  return api;
}
