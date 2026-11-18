/**
 * Panels: flat things a visitor hangs in the air round them.
 *
 * A panel shows a note, a picture or a video, in a frame with a bar along
 * its top. Take it by the bar to move it; it turns to face you as it goes.
 * Three buttons on the bar make it smaller, larger, or put it away. Where the
 * page asks, panels are kept in this browser and are there next visit.
 *
 * Everything on a panel is something the kit drew: text it laid out, a
 * picture or a video the page was allowed to load, or a file the visitor
 * chose from their own device. It is never another website. A page cannot
 * draw a web page into a 3D scene, and a browser that could is a different
 * thing (browser/spec.md).
 *
 * Like everything in a headset here, each control is one `select`. Moving a
 * panel with a grip is the faster way for someone who has one.
 *
 *   const panels = createPanels({ scene, camera, accent, input, keep: "my-site:panels" });
 *   panels.open({ kind: "note", title: "Read me", text: "..." });
 *   // each frame:  panels.update(t, dt)
 *   // on a ray:    const hit = panels.pick(raycaster); panels.aim(hit);
 *   // on select:   if (hit) panels.press(hit);
 *   // on a flat screen, so a panel can be dragged by its bar:
 *   //   pointerdown: if (panels.pointer("down", raycaster)) ...the panel has the drag
 */
import * as THREE from "three";
import { createAlloy, type Alloy } from "./alloy.js";
import type { XrInput } from "./input.js";
import { MeshBuilder } from "./mesh.js";
import type { Controls } from "./ui/model.js";
import { cleanPlace, cleanRecords, cleanSource, facing, inFront, newId, PANEL_LIMITS, wrapText, type PanelPlace, type PanelRecord, type PanelSource, type V3 } from "./panel-store.js";

export type { PanelPlace, PanelRecord, PanelSource } from "./panel-store.js";

/** What a panel can show. `custom` is a texture of the page's own, for something the kit doesn't draw: it is not kept. */
export type PanelContent = PanelSource | { kind: "custom"; title: string; texture: THREE.Texture; aspect: number };

export interface PanelsOptions {
  scene: THREE.Scene;
  camera: THREE.Camera;
  accent?: THREE.ColorRepresentation;
  textColor?: string;
  /** The kit's input layer, so a panel can be taken by its bar with a grip or a pinch. */
  input?: XrInput;
  /** Keep panels in this browser under this name, and bring them back next visit. Left out, they last for the visit. */
  keep?: string;
  /** Called when a panel is opened, moved, resized or put away. */
  onChange?: () => void;
}

export interface Panel {
  readonly id: string;
  readonly group: THREE.Group;
  readonly source: PanelContent;
  place(): PanelPlace;
  moveTo(place: Partial<PanelPlace>): void;
  close(): void;
}

export interface PanelInfo {
  id: string;
  kind: string;
  title: string;
  place: PanelPlace;
  /** For a video: whether it is playing. */
  playing: boolean | null;
  held: boolean;
  /** Whether what it shows has loaded. */
  ready: boolean;
}

export interface Panels {
  /** Hang a panel. Without a place, it goes a comfortable reach in front of the visitor, facing them. */
  open(content: PanelContent, opts?: { id?: string; place?: Partial<PanelPlace>; keep?: boolean }): Panel;
  /** Hang a file the visitor chose from their own device: a picture or a video. It is kept in this browser. */
  openFile(file: Blob & { name?: string }): Promise<Panel | null>;
  list(): Panel[];
  /** Hide every panel, or show them again. They keep their places. */
  visible: boolean;
  /** What this ray points at on a panel: a name to hand to `aim()` and `press()`, or null. */
  pick(raycaster: THREE.Raycaster): string | null;
  aim(hit: string | null): void;
  press(hit: string): void;
  /** On a flat screen: tell it about the pointer, as a ray. "down" returns true if a panel's bar took the drag. */
  pointer(phase: "down" | "move" | "up", raycaster: THREE.Raycaster): boolean;
  update(t: number, dt: number): void;
  /** Settles when everything kept from last visit is hanging again. */
  readonly restored: Promise<void>;
  info(): PanelInfo[];
  dispose(): void;
}

const BAR = 0.085; // the bar's height, for a panel one metre wide
const GAP = 0.012;
const BUTTON = 0.062;
const DEG = Math.PI / 180;

// ------------------------------------------------------------------ kept files

const DB = "nswp-panels";
function files(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("files");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
async function fileStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await files();
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction("files", mode).objectStore("files"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return undefined; // no storage here: the file lasts for the visit
  }
}

// --------------------------------------------------------------------- drawing

function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d")!, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** A note, laid out by the kit: a heading and wrapped lines on dark glass. Returns the picture and its shape. */
function noteTexture(source: Extract<PanelSource, { kind: "note" }>, ink: string): { texture: THREE.CanvasTexture; aspect: number } {
  const W = 1024;
  const pad = 56;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = "40px system-ui, sans-serif";
  const lines = wrapText(source.text, W - pad * 2, (s) => measure.measureText(s).width);
  const H = Math.round(Math.min(2048, Math.max(360, pad * 2 + lines.length * 56 + 12)));
  const texture = canvasTexture(W, H, (g) => {
    g.fillStyle = "#0a1018";
    g.fillRect(0, 0, W, H);
    g.fillStyle = ink;
    g.textBaseline = "top";
    g.font = "40px system-ui, sans-serif";
    lines.forEach((line, i) => g.fillText(line, pad, pad + i * 56));
  });
  return { texture, aspect: W / H };
}

type Glyph = "close" | "smaller" | "larger" | "play" | "pause";
function glyphTexture(glyph: Glyph, ink: string): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = "#101a26";
    g.beginPath();
    g.roundRect(4, 4, 120, 120, 26);
    g.fill();
    g.strokeStyle = ink;
    g.fillStyle = ink;
    g.lineWidth = 11;
    g.lineCap = "round";
    g.beginPath();
    if (glyph === "close") {
      g.moveTo(42, 42);
      g.lineTo(86, 86);
      g.moveTo(86, 42);
      g.lineTo(42, 86);
      g.stroke();
    } else if (glyph === "smaller" || glyph === "larger") {
      g.moveTo(38, 64);
      g.lineTo(90, 64);
      if (glyph === "larger") {
        g.moveTo(64, 38);
        g.lineTo(64, 90);
      }
      g.stroke();
    } else if (glyph === "play") {
      g.moveTo(48, 36);
      g.lineTo(92, 64);
      g.lineTo(48, 92);
      g.closePath();
      g.fill();
    } else {
      g.fillRect(42, 38, 16, 52);
      g.fillRect(70, 38, 16, 52);
    }
  });
}

function barTexture(title: string, ink: string): THREE.CanvasTexture {
  return canvasTexture(1024, Math.round(1024 * BAR), (g, w, h) => {
    g.fillStyle = "#101a26";
    g.fillRect(0, 0, w, h);
    g.fillStyle = ink;
    g.textBaseline = "middle";
    g.font = "bold 42px system-ui, sans-serif";
    // Leave room at the right for the buttons, and for one at the left on a video.
    g.fillText(title, 96, h / 2 + 2, w - 96 - 290);
  });
}

// ---------------------------------------------------------------------- panels

interface Live extends Panel {
  record: PanelRecord | null; // null when it isn't kept
  body: THREE.Mesh;
  bar: THREE.Mesh;
  buttons: Map<string, THREE.Mesh>;
  video: HTMLVideoElement | null;
  aspect: number;
  width: number;
  ready: boolean;
  held: boolean;
  release?: () => void;
  blobUrl?: string;
}

export function createPanels(o: PanelsOptions): Panels {
  const accent = new THREE.Color(o.accent ?? 0xffb65c);
  const ink = o.textColor ?? "#eef5fb";
  const root = new THREE.Group();
  root.name = "panels";
  o.scene.add(root);
  const live = new Map<string, Live>();
  const metal: Alloy = createAlloy(accent, { gloss: 0.5 });
  const glyphs = new Map<Glyph, THREE.CanvasTexture>();
  const glyph = (g: Glyph) => glyphs.get(g) ?? (glyphs.set(g, glyphTexture(g, ink)), glyphs.get(g)!);
  // One frame for every panel: a slab behind the picture, lit along its edge. It is scaled to fit.
  const frameShape = (() => {
    const b = new MeshBuilder().at();
    b.tone = new THREE.Color(0x121a24);
    b.light = accent.clone();
    b.box([1, 1, 0.022], [0, 0, 0], { bevel: 0.008 });
    return b.geometry();
  })();
  const head = new THREE.Vector3();
  const at = new THREE.Vector3();
  const headV3 = (): V3 => {
    o.camera.getWorldPosition(head);
    return [head.x, head.y, head.z];
  };

  // ------------------------------------------------------------------ keeping
  const save = () => {
    o.onChange?.();
    if (!o.keep) return;
    try {
      localStorage.setItem(o.keep, JSON.stringify([...live.values()].flatMap((p) => (p.record ? [{ ...p.record, place: p.place() }] : []))));
    } catch {
      /* storage unavailable: they last for the visit */
    }
  };

  // ------------------------------------------------------------------- layout
  /** Put a panel's parts where they belong for its shape. Everything is sized for a panel one metre wide, and the group is scaled. */
  const layout = (p: Live) => {
    const h = 1 / p.aspect;
    p.body.scale.set(1, h, 1);
    const top = h / 2 + GAP + BAR / 2;
    if (!p.held) {
      p.bar.position.set(0, top, 0);
      p.bar.quaternion.identity();
      p.bar.scale.set(1, 1, 1);
    }
    const frame = p.group.getObjectByName("frame");
    if (frame) {
      frame.scale.set(1.03, h + BAR + GAP + 0.03, 1);
      frame.position.set(0, (BAR + GAP) / 2, -0.014);
    }
    let x = 0.5 - BUTTON / 2 - 0.012;
    for (const name of ["close", "larger", "smaller"]) {
      p.buttons.get(name)?.position.set(x, top, 0.004);
      x -= BUTTON + 0.014;
    }
    p.buttons.get("play")?.position.set(-0.5 + BUTTON / 2 + 0.012, top, 0.004);
    p.group.scale.setScalar(p.width);
  };

  const setPlace = (p: Live, place: Partial<PanelPlace>) => {
    if (place.position) p.group.position.set(...place.position);
    if (place.yaw !== undefined || place.pitch !== undefined) {
      const now = p.place();
      p.group.rotation.set((place.pitch ?? now.pitch) * DEG, (place.yaw ?? now.yaw) * DEG, 0, "YXZ");
    }
    if (place.width !== undefined) {
      p.width = Math.min(PANEL_LIMITS.maxWidth, Math.max(PANEL_LIMITS.minWidth, place.width));
      layout(p);
    }
  };

  const turnToFace = (p: Live) => {
    const f = facing(p.group.position.toArray() as V3, headV3());
    p.group.rotation.set(f.pitch * DEG, f.yaw * DEG, 0, "YXZ");
  };

  const close = (p: Live) => {
    if (!live.delete(p.id)) return;
    p.release?.();
    p.video?.pause();
    if (p.video) p.video.src = "";
    if (p.blobUrl) URL.revokeObjectURL(p.blobUrl);
    const src = p.record && "src" in p.record.source ? p.record.source.src : "";
    if (src.startsWith("kept:")) void fileStore("readwrite", (s) => s.delete(src.slice(5)));
    root.remove(p.group);
    p.bar.removeFromParent();
    for (const mesh of [p.body, p.bar]) {
      mesh.geometry.dispose();
      const m = mesh.material as THREE.MeshBasicMaterial;
      if (p.source.kind !== "custom" || mesh !== p.body) m.map?.dispose();
      m.dispose();
    }
    for (const b of p.buttons.values()) (b.material as THREE.Material).dispose();
    save();
  };

  // ------------------------------------------------------------------ opening
  const flat = (texture: THREE.Texture | null, w = 1, h = 1) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, color: texture ? 0xffffff : 0x0a1018, toneMapped: false }));

  const open = (content: PanelContent, opts: { id?: string; place?: Partial<PanelPlace>; keep?: boolean } = {}): Panel => {
    const source = content.kind === "custom" ? content : cleanSource(content);
    if (!source) throw new Error("nswp-sdk: a panel needs something to show (a note with words, or a picture or video with an address).");
    // Never make room by throwing one of the visitor's away.
    if (live.size >= PANEL_LIMITS.count && !(opts.id && live.has(opts.id))) throw new Error(`nswp-sdk: ${PANEL_LIMITS.count} panels are open. Put one away first.`);
    const id = opts.id ?? newId();
    live.get(id)?.close();
    const group = new THREE.Group();
    group.name = `panel:${id}`;
    const body = flat(null);
    body.name = `${id}:body`;
    const bar = flat(barTexture(source.title || (source.kind === "note" ? "Note" : source.kind === "picture" ? "Picture" : source.kind === "video" ? "Video" : ""), ink), 1, BAR);
    bar.name = `${id}:bar`;
    const frame = new THREE.Mesh(frameShape, metal);
    frame.name = "frame";
    frame.raycast = () => {};
    const buttons = new Map<string, THREE.Mesh>();
    const button = (name: string, g: Glyph) => {
      const mesh = flat(glyph(g), BUTTON, BUTTON);
      mesh.name = `${id}:${name}`;
      buttons.set(name, mesh);
      group.add(mesh);
    };
    button("close", "close");
    button("larger", "larger");
    button("smaller", "smaller");
    if (source.kind === "video") button("play", "play");
    group.add(frame, body, bar);
    root.add(group);

    const p: Live = {
      id,
      group,
      source,
      record: null,
      body,
      bar,
      buttons,
      video: null,
      aspect: 16 / 9,
      width: source.kind === "note" ? 0.8 : 1.1,
      ready: false,
      held: false,
      place() {
        const e = new THREE.Euler().setFromQuaternion(group.quaternion, "YXZ");
        const round = (n: number) => Math.round(n * 1000) / 1000;
        return { position: group.position.toArray().map(round) as V3, yaw: round((((e.y / DEG) % 360) + 360) % 360), pitch: round(e.x / DEG), width: round(p.width) };
      },
      moveTo(place) {
        setPlace(p, place);
        save();
      },
      close: () => close(p),
    };
    live.set(id, p);
    const show = (texture: THREE.Texture, aspect: number) => {
      const material = body.material as THREE.MeshBasicMaterial;
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
      p.aspect = Math.min(4, Math.max(0.25, aspect));
      p.ready = true;
      layout(p);
    };

    if (source.kind === "note") {
      const drawn = noteTexture(source, ink);
      show(drawn.texture, drawn.aspect);
    } else if (source.kind === "custom") show(source.texture, source.aspect);
    else {
      // A picture or a video: from an address the page may load, or a file kept here.
      void (async () => {
        let src = source.src;
        if (src.startsWith("kept:")) {
          const blob = await fileStore<Blob>("readonly", (s) => s.get(src.slice(5)) as IDBRequest<Blob>);
          if (!blob || !live.has(id)) return;
          src = p.blobUrl = URL.createObjectURL(blob);
        }
        if (source.kind === "picture") {
          const image = new Image();
          image.onload = () => {
            if (!live.has(id)) return;
            const texture = new THREE.Texture(image);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
            show(texture, image.naturalWidth / Math.max(1, image.naturalHeight));
          };
          image.src = src;
        } else {
          const video = document.createElement("video");
          video.playsInline = true;
          video.loop = true;
          video.preload = "metadata";
          p.video = video;
          video.addEventListener("loadedmetadata", () => {
            if (!live.has(id) || !video.videoWidth) return;
            const texture = new THREE.VideoTexture(video);
            texture.colorSpace = THREE.SRGBColorSpace;
            show(texture, video.videoWidth / video.videoHeight);
          });
          const mark = () => {
            const m = buttons.get("play")?.material as THREE.MeshBasicMaterial | undefined;
            if (m) m.map = glyph(video.paused ? "play" : "pause");
            o.onChange?.();
          };
          video.addEventListener("play", mark);
          video.addEventListener("pause", mark);
          video.src = src;
        }
      })();
    }

    layout(p);
    const given = opts.place ? { ...opts.place } : {};
    if (!given.position) given.position = inFront(headV3(), o.camera.getWorldDirection(at).x === 0 && at.z === 0 ? 0 : Math.atan2(-at.x, -at.z) / DEG, live.size - 1);
    setPlace(p, given);
    if (given.yaw === undefined) turnToFace(p);

    // By its bar, with a grip or a pinch. From across the room it stays where it is and moves from there.
    if (o.input) {
      p.release = o.input.grabbable(bar, {
        reach: 0.12,
        pull: false,
        onGrab: () => {
          p.held = true;
        },
        onRelease: () => {
          p.held = false;
          group.add(bar);
          layout(p);
          turnToFace(p);
          save();
        },
      });
    }
    if (opts.keep !== false && source.kind !== "custom" && !("src" in source && source.src.startsWith("blob:"))) p.record = { id, source, place: p.place() };
    save();
    return p;
  };

  // --------------------------------------------------------- from last visit
  const restored = (async () => {
    if (!o.keep) return;
    let kept: PanelRecord[] = [];
    try {
      kept = cleanRecords(JSON.parse(localStorage.getItem(o.keep) ?? "[]"));
    } catch {
      /* nothing kept */
    }
    for (const r of kept) {
      const place = cleanPlace(r.place);
      if (place) open(r.source, { id: r.id, place });
    }
  })();

  // ------------------------------------------------------------- interaction
  const targets = () => [...live.values()].flatMap((p) => [p.body, ...(p.held ? [] : [p.bar]), ...p.buttons.values()]);
  let aimed: string | null = null;
  let drag: { p: Live; far: number; moved: boolean } | null = null;
  const find = (hit: string): [Live, string] | null => {
    const cut = hit.lastIndexOf(":");
    const p = live.get(hit.slice(0, cut));
    return p ? [p, hit.slice(cut + 1)] : null;
  };
  const tint = (hit: string | null, on: boolean) => {
    const found = hit ? find(hit) : null;
    const mesh = found?.[0].buttons.get(found[1]);
    if (mesh) (mesh.material as THREE.MeshBasicMaterial).color.copy(on ? accent : new THREE.Color(0xffffff));
  };

  const api: Panels = {
    open,
    async openFile(file) {
      const kind = file.type.startsWith("image/") ? "picture" : file.type.startsWith("video/") ? "video" : null;
      if (!kind || file.size > PANEL_LIMITS.fileBytes) return null;
      const name = newId();
      const stored = (await fileStore("readwrite", (s) => s.put(file, name))) !== undefined;
      const title = (file.name ?? "").replace(/\.[a-z0-9]+$/i, "");
      // Kept if this browser will hold it; otherwise shown for this visit only.
      return stored ? open({ kind, title, src: `kept:${name}` }) : open({ kind, title, src: URL.createObjectURL(file) }, { keep: false });
    },
    list: () => [...live.values()],
    get visible() {
      return root.visible;
    },
    set visible(v) {
      root.visible = v;
      if (!v) for (const p of live.values()) p.video?.pause();
      o.onChange?.();
    },
    pick(raycaster) {
      if (!root.visible) return null;
      const hit = raycaster.intersectObjects(targets(), false)[0];
      return hit ? hit.object.name : null;
    },
    aim(hit) {
      if (hit === aimed) return;
      tint(aimed, false);
      aimed = hit;
      tint(aimed, true);
    },
    press(hit) {
      const found = find(hit);
      if (!found) return;
      const [p, part] = found;
      if (part === "close") return p.close();
      if (part === "larger" || part === "smaller") return p.moveTo({ width: p.width * (part === "larger" ? 1.25 : 0.8) });
      // A video's own picture is its play button too: the largest thing to hit.
      if ((part === "play" || part === "body") && p.video) void (p.video.paused ? p.video.play().catch(() => {}) : Promise.resolve(p.video.pause()));
    },
    pointer(phase, raycaster) {
      if (phase === "down") {
        const hit = root.visible ? raycaster.intersectObjects(targets(), false)[0] : undefined;
        const found = hit ? find(hit.object.name) : null;
        if (!found || found[1] !== "bar") return false;
        drag = { p: found[0], far: hit!.distance, moved: false };
        return true;
      }
      if (!drag) return false;
      if (phase === "move") {
        // The bar stays under the pointer, at the distance it was taken at.
        const p = drag.p;
        const down = (1 / p.aspect / 2 + GAP + BAR / 2) * p.width;
        raycaster.ray.at(drag.far, at);
        p.group.position.set(at.x, at.y - down, at.z);
        turnToFace(p);
        drag.moved = true;
        return true;
      }
      const moved = drag.moved;
      drag = null;
      if (moved) save();
      return moved;
    },
    update(t) {
      metal.tick(t);
      for (const p of live.values()) {
        if (!p.held) continue;
        // The bar is in the visitor's hand. The panel hangs from it, and turns to face them.
        p.bar.getWorldPosition(at);
        const down = (1 / p.aspect / 2 + GAP + BAR / 2) * p.width;
        p.group.position.set(at.x, at.y - down, at.z);
        turnToFace(p);
      }
    },
    restored,
    info: () =>
      [...live.values()].map((p) => ({
        id: p.id,
        kind: p.source.kind,
        title: p.source.title,
        place: p.place(),
        playing: p.video ? !p.video.paused : null,
        held: p.held,
        ready: p.ready,
      })),
    dispose() {
      // Going away with the page is not the visitor putting their panels away: nothing kept is touched.
      for (const p of live.values()) {
        p.release?.();
        p.video?.pause();
        if (p.blobUrl) URL.revokeObjectURL(p.blobUrl);
      }
      live.clear();
      o.scene.remove(root);
      frameShape.dispose();
      metal.dispose();
      for (const g of glyphs.values()) g.dispose();
    },
  };
  return api;
}

// -------------------------------------------------------------------- controls

/** A small box to write a note in, on the page. A headset has no keyboard to offer, so notes are written on a flat screen. */
function askForNote(done: (note: { title: string; text: string } | null) => void): void {
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-label", "Write a note");
  Object.assign(dialog.style, { width: "min(92vw, 520px)", padding: "20px", border: "1px solid #2a3a4a", borderRadius: "14px", background: "#0a1018", color: "#eef5fb", font: "16px/1.5 system-ui, sans-serif" });
  const field = (el: HTMLInputElement | HTMLTextAreaElement, label: string) => {
    const wrap = document.createElement("label");
    wrap.textContent = label;
    Object.assign(wrap.style, { display: "grid", gap: "6px", marginBottom: "14px" });
    Object.assign(el.style, { font: "inherit", padding: "10px", color: "inherit", background: "#101a26", border: "1px solid #2a3a4a", borderRadius: "8px" });
    wrap.append(el);
    return wrap;
  };
  const title = document.createElement("input");
  title.maxLength = PANEL_LIMITS.titleChars;
  const text = document.createElement("textarea");
  text.rows = 7;
  text.maxLength = PANEL_LIMITS.noteChars;
  const row = document.createElement("div");
  Object.assign(row.style, { display: "flex", gap: "10px", justifyContent: "flex-end" });
  const button = (label: string, primary: boolean, act: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    Object.assign(b.style, { font: "inherit", fontWeight: primary ? "700" : "500", padding: "10px 18px", borderRadius: "8px", border: "1px solid #2a3a4a", background: primary ? "#eef5fb" : "none", color: primary ? "#04070b" : "inherit", cursor: "pointer" });
    b.addEventListener("click", act);
    return b;
  };
  const finish = (note: { title: string; text: string } | null) => {
    dialog.close();
    dialog.remove();
    done(note);
  };
  row.append(
    button("Cancel", false, () => finish(null)),
    button("Hang it", true, () => finish(text.value.trim() || title.value.trim() ? { title: title.value, text: text.value } : null)),
  );
  dialog.addEventListener("cancel", () => finish(null));
  dialog.append(field(title, "A heading, if you want one"), field(text, "The note"), row);
  document.body.append(dialog);
  dialog.showModal();
  text.focus();
}

/**
 * Give the visitor their panels under "Panels" in the controls: write a note,
 * hang a picture or video from their own device, and hide or show them all.
 * Writing and choosing a file happen on the page, so they are offered on a
 * flat screen; in a headset the panels already hanging are moved, resized and
 * put away.
 */
export function addPanelControls(controls: Controls, panels: Panels, o: { presenting: () => boolean; kept?: boolean }): void {
  const note = () =>
    o.presenting()
      ? "Take a panel by its bar to move it. Write notes and hang pictures on a flat screen: a headset has no keyboard or files to offer."
      : `Notes, pictures and video in frames you can hang anywhere. Drag one by its bar.${o.kept ? " They are kept in this browser and are here next visit." : ""} A panel can't show another website.`;
  controls.addSection({ id: "panels", label: "Panels", icon: "panel", note });
  const full = (act: () => void) => {
    try {
      act();
    } catch (err) {
      controls.say(err instanceof Error && /Put one away/.test(err.message) ? `${PANEL_LIMITS.count} panels are open. Put one away first.` : "That couldn't be hung.");
    }
  };
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*,video/*";
  picker.hidden = true;
  document.body.append(picker);
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    picker.value = "";
    if (!file) return;
    void panels.openFile(file).then(
      (p) => controls.say(p ? "Hung in front of you." : file.size > PANEL_LIMITS.fileBytes ? "That file is too large to hang: 64 MB at most." : "Only pictures and videos can be hung."),
      () => controls.say(`${PANEL_LIMITS.count} panels are open. Put one away first.`),
    );
  });
  controls.add(
    {
      id: "panel-note",
      section: "panels",
      icon: "note",
      label: "Write a note",
      short: "Note",
      hidden: o.presenting,
      act: () =>
        askForNote((n) => {
          if (n) full(() => void panels.open({ kind: "note", ...n }));
        }),
    },
    { id: "panel-file", section: "panels", icon: "panel", label: "Hang a picture or video", short: "Hang", hidden: o.presenting, act: () => picker.click() },
    {
      id: "panel-hide",
      section: "panels",
      icon: "exit",
      hidden: () => panels.list().length === 0,
      on: () => !panels.visible,
      label: () => (panels.visible ? "Hide your panels" : "Show your panels"),
      short: "Hide",
      act: () => {
        panels.visible = !panels.visible;
      },
    },
  );
}
