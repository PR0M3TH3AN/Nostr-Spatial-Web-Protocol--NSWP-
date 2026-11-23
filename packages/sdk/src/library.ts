/**
 * The visitor's library: the pictures and video of their own that this
 * browser keeps, and a board to choose from inside a headset.
 *
 * A page can't show the files on a visitor's device: the browser keeps its
 * file picker to itself, and draws it as a flat window. What a page can hold
 * is what the visitor has already given it. So everything they hang, and
 * every picture they take here, goes into the library, and from then on it
 * is one select away in any headset.
 *
 * Nothing in it is sent anywhere. It is kept for this site, in this browser.
 */
import * as THREE from "three";
import { fileStore } from "./file-store.js";
import { cleanLibrary, LIBRARY_LIMITS, libraryPage, newId, PANEL_LIMITS, type LibraryItem } from "./panel-store.js";

export { fileStore };

/** A small picture of a file, to recognise it by. "" when none can be made. */
async function thumbnail(file: Blob, kind: "picture" | "video"): Promise<string> {
  const draw = (source: CanvasImageSource, w: number, h: number): string => {
    if (!w || !h) return "";
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = Math.max(1, Math.round((240 * h) / w));
    canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.7);
    return data.length <= LIBRARY_LIMITS.thumbChars ? data : "";
  };
  try {
    if (kind === "picture") {
      const bitmap = await createImageBitmap(file);
      const data = draw(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      return data;
    }
    const url = URL.createObjectURL(file);
    try {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = url;
      await new Promise<void>((resolve, reject) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error("unreadable")), { once: true });
        setTimeout(() => reject(new Error("slow")), 4000);
      });
      return draw(video, video.videoWidth, video.videoHeight);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return "";
  }
}

export interface Library {
  readonly group: THREE.Group;
  /** Everything kept, newest first. */
  list(): LibraryItem[];
  /** Keep a picture or a video. Null if it is neither, is too large, or the library is full. */
  add(file: Blob, name?: string): Promise<LibraryItem | null>;
  remove(id: string): Promise<void>;
  /** Whether the board is up. */
  showing: boolean;
  pick(raycaster: THREE.Raycaster): string | null;
  aim(hit: string | null): void;
  press(hit: string): void;
  pointOf(hit: string): THREE.Vector3 | null;
  info(): { showing: boolean; page: number; pages: number; removing: boolean; cells: string[] };
  update(): void;
  dispose(): void;
}

export interface LibraryOptions {
  scene: THREE.Scene;
  camera: THREE.Camera;
  accent?: THREE.ColorRepresentation;
  textColor?: string;
  /** Keep the list under this name. Left out, the library lasts for the visit. */
  keep?: string;
  /** The visitor chose one from the board. */
  onChoose: (item: LibraryItem) => void;
  onChange?: () => void;
}

const W = 1024;
const H = 768;
const COLS = 4;
const ROWS = 2;
const TOP = 96; // the bar
const FOOT = 104; // the row of things to do
const WIDTH = 1.1;

interface Region {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function createLibrary(o: LibraryOptions): Library {
  const accent = `#${new THREE.Color(o.accent ?? 0xffb65c).getHexString()}`;
  const ink = o.textColor ?? "#eef5fb";
  let items: LibraryItem[] = [];
  if (o.keep) {
    try {
      items = cleanLibrary(JSON.parse(localStorage.getItem(`${o.keep}:library`) ?? "[]"));
    } catch {
      /* nothing kept */
    }
  }
  const save = () => {
    stale = true;
    o.onChange?.();
    if (!o.keep) return;
    try {
      localStorage.setItem(`${o.keep}:library`, JSON.stringify(items));
    } catch {
      /* storage is full or unavailable: the list lasts for the visit */
    }
  };

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, (WIDTH * H) / W), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  board.name = "library";
  const group = new THREE.Group();
  group.name = "library";
  group.add(board);
  group.visible = false;
  o.scene.add(group);

  let page = 0;
  let removing = false;
  let aimed: string | null = null;
  let stale = true;
  let regions: Region[] = [];
  const thumbs = new Map<string, HTMLImageElement>();
  const thumbOf = (item: LibraryItem): HTMLImageElement | null => {
    if (!item.thumb) return null;
    let image = thumbs.get(item.id);
    if (!image) {
      image = new Image();
      image.onload = () => (stale = true);
      image.src = item.thumb;
      thumbs.set(item.id, image);
    }
    return image.complete && image.naturalWidth ? image : null;
  };

  const paint = () => {
    stale = false;
    regions = [];
    const shown = libraryPage(items, page, COLS * ROWS);
    page = shown.page;
    g.fillStyle = "#0a1018";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#101a26";
    g.fillRect(0, 0, W, TOP);
    g.fillStyle = ink;
    g.textBaseline = "middle";
    g.textAlign = "left";
    g.font = "bold 40px system-ui, sans-serif";
    g.fillText(removing ? "Select one to remove it" : "Your pictures and video", 36, TOP / 2 + 2, W - 200);
    const button = (id: string, label: string, x: number, y: number, w: number, h: number, on = false) => {
      regions.push({ id, x, y, w, h });
      const lit = aimed === id || on;
      g.fillStyle = lit ? accent : "#162231";
      g.beginPath();
      g.roundRect(x, y, w, h, 16);
      g.fill();
      g.fillStyle = lit ? "#04070b" : ink;
      g.textAlign = "center";
      g.font = "bold 30px system-ui, sans-serif";
      g.fillText(label, x + w / 2, y + h / 2 + 2, w - 16);
      g.textAlign = "left";
    };
    button("close", "Close", W - 164, 18, 140, TOP - 36);
    if (shown.items.length === 0) {
      g.fillStyle = ink;
      g.globalAlpha = 0.8;
      g.font = "34px system-ui, sans-serif";
      g.textAlign = "center";
      g.fillText("Nothing here yet.", W / 2, H / 2 - 40);
      g.fillText("Hang a picture or video on a flat screen,", W / 2, H / 2 + 10);
      g.fillText("or take a picture with the camera.", W / 2, H / 2 + 56);
      g.textAlign = "left";
      g.globalAlpha = 1;
    }
    const cellW = (W - 48) / COLS;
    const cellH = (H - TOP - FOOT - 24) / ROWS;
    shown.items.forEach((item, i) => {
      const [x, y] = [24 + (i % COLS) * cellW + 10, TOP + 12 + Math.floor(i / COLS) * cellH + 8];
      const [w, h] = [cellW - 20, cellH - 16];
      const id = `item:${item.id}`;
      regions.push({ id, x, y, w, h });
      g.fillStyle = aimed === id ? accent : "#162231";
      g.beginPath();
      g.roundRect(x, y, w, h, 14);
      g.fill();
      const image = thumbOf(item);
      const [px, py, pw, ph] = [x + 8, y + 8, w - 16, h - 60];
      g.fillStyle = "#05090e";
      g.fillRect(px, py, pw, ph);
      if (image) {
        // Fitted inside its frame, whole, whatever its shape.
        const scale = Math.min(pw / image.naturalWidth, ph / image.naturalHeight);
        const [dw, dh] = [image.naturalWidth * scale, image.naturalHeight * scale];
        g.drawImage(image, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
      }
      if (item.kind === "video") {
        // A mark that it moves.
        g.fillStyle = "rgba(4, 7, 11, 0.7)";
        g.beginPath();
        g.arc(px + pw / 2, py + ph / 2, 30, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = ink;
        g.beginPath();
        g.moveTo(px + pw / 2 - 10, py + ph / 2 - 15);
        g.lineTo(px + pw / 2 + 16, py + ph / 2);
        g.lineTo(px + pw / 2 - 10, py + ph / 2 + 15);
        g.fill();
      }
      g.fillStyle = aimed === id ? "#04070b" : ink;
      g.font = "26px system-ui, sans-serif";
      g.fillText(item.title || (item.kind === "video" ? "A video" : "A picture"), x + 12, y + h - 26, w - 24);
    });
    const fy = H - FOOT + 14;
    if (shown.pages > 1) {
      button("prev", "Earlier", 24, fy, 170, FOOT - 28);
      button("next", "Later", 206, fy, 170, FOOT - 28);
      g.fillStyle = ink;
      g.font = "28px system-ui, sans-serif";
      g.fillText(`${shown.page + 1} of ${shown.pages}`, 400, fy + (FOOT - 28) / 2 + 2);
    }
    if (items.length) button("removing", removing ? "Stop removing" : "Remove one", W - 300, fy, 276, FOOT - 28, removing);
    texture.needsUpdate = true;
  };

  const at = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const api: Library = {
    group,
    list: () => items,
    async add(file, name = "") {
      const kind = file.type.startsWith("image/") ? "picture" : file.type.startsWith("video/") ? "video" : null;
      if (!kind || file.size > PANEL_LIMITS.fileBytes || items.length >= LIBRARY_LIMITS.count) return null;
      const id = newId();
      if ((await fileStore("readwrite", (s) => s.put(file, id))) === undefined) return null;
      const item: LibraryItem = { id, kind, title: name.replace(/\.[a-z0-9]+$/i, "").slice(0, PANEL_LIMITS.titleChars), bytes: file.size, addedAt: Math.floor(Date.now() / 1000), thumb: await thumbnail(file, kind) };
      items = cleanLibrary([item, ...items]);
      save();
      return items.find((x) => x.id === id) ?? null;
    },
    async remove(id) {
      if (!items.some((x) => x.id === id)) return;
      items = items.filter((x) => x.id !== id);
      thumbs.delete(id);
      await fileStore("readwrite", (s) => s.delete(id));
      save();
    },
    get showing() {
      return group.visible;
    },
    set showing(v) {
      if (v === group.visible) return;
      group.visible = v;
      removing = false;
      aimed = null;
      stale = true;
      if (v) {
        // In front of the visitor, at eye height, facing them.
        o.camera.getWorldPosition(at);
        o.camera.getWorldDirection(facing);
        facing.y = 0;
        if (facing.lengthSq() < 1e-6) facing.set(0, 0, -1);
        facing.normalize();
        group.position.set(at.x + facing.x * 1.15, Math.max(0.8, at.y - 0.05), at.z + facing.z * 1.15);
        group.rotation.set(0, Math.atan2(-facing.x, -facing.z), 0);
      }
      o.onChange?.();
    },
    pick(raycaster) {
      if (!group.visible) return null;
      const hit = raycaster.intersectObject(board, false)[0];
      if (!hit?.uv) return null;
      const [x, y] = [hit.uv.x * W, (1 - hit.uv.y) * H];
      const r = regions.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      return `lib:${r?.id ?? ""}`;
    },
    aim(hit) {
      const id = hit?.startsWith("lib:") ? hit.slice(4) || null : null;
      if (id === aimed) return;
      aimed = id;
      stale = true;
    },
    press(hit) {
      if (!group.visible || !hit.startsWith("lib:")) return;
      const id = hit.slice(4);
      if (id === "close") api.showing = false;
      else if (id === "prev") page--;
      else if (id === "next") page++;
      else if (id === "removing") removing = !removing;
      else if (id.startsWith("item:")) {
        const item = items.find((x) => x.id === id.slice(5));
        if (item && removing) void api.remove(item.id);
        else if (item) o.onChoose(item);
      }
      stale = true;
    },
    pointOf(hit) {
      const r = hit.startsWith("lib:") ? regions.find((q) => q.id === hit.slice(4)) : null;
      if (!r || !group.visible) return null;
      const height = (WIDTH * H) / W;
      group.updateMatrixWorld(true);
      return board.localToWorld(new THREE.Vector3(((r.x + r.w / 2) / W - 0.5) * WIDTH, (0.5 - (r.y + r.h / 2) / H) * height, 0));
    },
    info: () => ({ showing: group.visible, page, pages: libraryPage(items, page, COLS * ROWS).pages, removing, cells: regions.map((r) => r.id) }),
    update() {
      if (group.visible && stale) paint();
    },
    dispose() {
      o.scene.remove(group);
      board.geometry.dispose();
      (board.material as THREE.Material).dispose();
      texture.dispose();
    },
  };
  return api;
}
