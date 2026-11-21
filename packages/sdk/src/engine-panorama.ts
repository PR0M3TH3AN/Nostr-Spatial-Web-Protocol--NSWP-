/**
 * A world's 360° picture, for a world drawn by an engine that isn't JavaScript's (docs/other-engines.md).
 *
 * The engine takes six square views from where a visitor arrives, and this paints them into the one picture a door
 * shows (panorama.ts): the same painting a Three.js world's capture uses, so the two can't come out differently.
 *
 *   const shot = await NSWP.capturePreview(2048);   // asked from the page: by whoever makes the world, or their tools
 *   // the engine hears { type: "preview", size: 1024 }, takes its six views, and answers:
 *   NSWP.previewFaces('{"faces":["<png, base64>", … six of them, in the order of NSWP.previewViews()]}');
 *   // shot is { base64, width, height, bytes }: a WebP file, to be kept under its SHA-256
 */
import * as THREE from "three";
import { base64, read } from "./engine-world.js";
import { tellEngine } from "./engine-menu.js";
import { PANORAMA_VIEWS, paintPanorama, panoramaWidth } from "./panorama.js";

export interface PreviewShot {
  base64: string;
  width: number;
  height: number;
  bytes: number;
}

let waiting: { width: number; resolve: (shot: PreviewShot) => void; reject: (why: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;

/** The six views an engine takes, as JSON, in the order it hands them back: each one's `forward` and `up`. 90° wide, square. */
export function previewViews(): string {
  return JSON.stringify(PANORAMA_VIEWS);
}

/**
 * Ask the engine for the world's 360° picture. It is told `{ type: "preview", size }` (how many pixels square
 * each view should be) and answers with `previewFaces`. Resolves to the finished picture, or rejects if the engine
 * doesn't answer: one that doesn't take pictures never will.
 */
export function capturePreview(width?: number): Promise<PreviewShot> {
  const wide = panoramaWidth(width);
  waiting?.reject(new Error("nswp-sdk: another picture was asked for"));
  if (waiting) clearTimeout(waiting.timer);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting = null;
      reject(new Error("nswp-sdk: the engine didn't hand over its six views"));
    }, 30_000);
    waiting = { width: wide, resolve, reject, timer };
    tellEngine({ type: "preview", size: Math.min(2048, wide / 2) });
  });
}

const picture = (png: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("nswp-sdk: one of the six views isn't a picture"));
    image.src = `data:image/png;base64,${png}`;
  });

/**
 * The engine's six views, as JSON: `faces`, six PNG files as base64, in the order of `previewViews()`. Each is
 * what a camera 90° wide sees looking along that view's `forward` with its `up` upward, taken with nothing in it
 * that is about one visitor, and without fog or glow (they differ from view to view and leave seams).
 * Returns "true" if a picture was being waited for.
 */
export function previewFaces(faces: string): string {
  const asked = waiting;
  if (!asked) return "false";
  waiting = null;
  clearTimeout(asked.timer);
  const given = read(faces).faces;
  const pngs = Array.isArray(given) ? given.filter((f): f is string => typeof f === "string" && /^[A-Za-z0-9+/=]+$/.test(f)) : [];
  if (pngs.length !== PANORAMA_VIEWS.length) {
    asked.reject(new Error("nswp-sdk: a picture needs six views"));
    return "true";
  }
  void (async () => {
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    const textures: THREE.Texture[] = [];
    let painter: ReturnType<typeof paintPanorama> | null = null;
    try {
      const images = await Promise.all(pngs.map(picture));
      painter = paintPanorama(renderer, asked.width);
      images.forEach((image, i) => {
        const texture = new THREE.Texture(image);
        // A picture's colours are as a screen shows them; the painting works in light and turns it back.
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        textures.push(texture);
        painter!.paint(texture, i);
      });
      const bytes = new Uint8Array(await (await painter.blob()).arrayBuffer());
      asked.resolve({ base64: base64(bytes), width: asked.width, height: asked.width / 2, bytes: bytes.length });
    } catch (err) {
      asked.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      painter?.dispose();
      for (const t of textures) t.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  })();
  return "true";
}
