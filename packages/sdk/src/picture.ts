/**
 * Other people's pictures: the one each keeps in their Nostr profile, shown
 * with them in a world.
 *
 * A picture is said on a pass, so it is theirs: their own key signed where it
 * is (protocol/10-identity.md, "Pictures"). It is fetched from wherever they
 * keep it, and that is the cost: the place that holds a picture learns the
 * address of everyone who is shown it. It is the same as reading Nostr in any
 * client, and it is the visitor's to turn off. So pictures are a preference
 * that travels with them, on unless they said otherwise.
 *
 * What is fetched is treated as untrusted: only an https address, nothing
 * sent with the request, a limit on its size, and it is only ever drawn. It
 * is redrawn small, as a round badge, and that is all a world keeps of it.
 */
import { cleanPicture } from "@nswp/core";
import { arrivedSettings, reportSettings } from "./settings.js";

/** Where the preference is kept, for this site. */
export const PICTURES_KEY = "nswp:pictures";
/** How much of a picture is ever downloaded, and how large the badge it is redrawn as is, in pixels. */
export const PICTURE_LIMITS = { bytes: 3_000_000, size: 128, waitMs: 9000 } as const;

let shown: boolean | null = null;
const watchers = new Set<() => void>();

/** Whether this visitor sees other people's pictures. On, unless they turned it off here or where they came from. */
export function showsPictures(): boolean {
  if (shown !== null) return shown;
  const came = arrivedSettings().pictures;
  let kept: string | null = null;
  try {
    kept = localStorage.getItem(PICTURES_KEY);
  } catch {
    /* nothing kept */
  }
  shown = came ?? kept !== "0";
  if (came !== undefined) keep(shown);
  reportSettings("pictures", () => ({ pictures: showsPictures() }), (now) => void (now.pictures !== undefined && now.pictures !== shown && setShowsPictures(now.pictures)));
  return shown;
}
const keep = (on: boolean): void => {
  try {
    if (on) localStorage.removeItem(PICTURES_KEY);
    else localStorage.setItem(PICTURES_KEY, "0");
  } catch {
    /* it lasts for this visit */
  }
};
export function setShowsPictures(on: boolean): void {
  showsPictures();
  shown = on;
  keep(on);
  for (const w of watchers) w();
}
/** Hear of the preference changing. Returns how to stop. */
export function onPicturesChange(cb: () => void): () => void {
  watchers.add(cb);
  return () => void watchers.delete(cb);
}

/** A picture, cropped to a square and drawn round, on a canvas of its own. */
function badge(image: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const size = PICTURE_LIMITS.size;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  g.closePath();
  g.clip();
  const side = Math.min(width, height);
  g.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, size, size);
  return canvas;
}

/** Fetched with nothing of the visitor's sent along, and never more than the limit. */
async function byFetch(url: string): Promise<HTMLCanvasElement | null> {
  const res = await fetch(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", redirect: "follow", signal: AbortSignal.timeout(PICTURE_LIMITS.waitMs) });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!/^image\/(png|jpeg|webp|gif|avif)\b/i.test(type)) return null;
  if (Number(res.headers.get("content-length") ?? 0) > PICTURE_LIMITS.bytes) return null;
  const blob = await res.blob();
  if (blob.size > PICTURE_LIMITS.bytes) return null;
  const bitmap = await createImageBitmap(blob);
  try {
    return badge(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** For a page whose own rules let it show an image from elsewhere but not fetch one. */
function byImage(url: string): Promise<HTMLCanvasElement | null> {
  return new Promise((done) => {
    const img = new Image();
    const timer = setTimeout(() => done(null), PICTURE_LIMITS.waitMs);
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.decoding = "async";
    img.onload = () => {
      clearTimeout(timer);
      try {
        done(img.naturalWidth > 0 && img.naturalWidth <= 8192 && img.naturalHeight <= 8192 ? badge(img, img.naturalWidth, img.naturalHeight) : null);
      } catch {
        done(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    img.src = url;
  });
}

const loaded = new Map<string, Promise<HTMLCanvasElement | null>>();

/**
 * Someone's picture as a small round badge, or null if there is none to
 * show: the address isn't one that can be fetched, the place that holds it
 * didn't answer or won't let a page read it, it isn't a picture, or this
 * visitor has pictures turned off. Asked for once for each address.
 */
export function loadPicture(address: unknown): Promise<HTMLCanvasElement | null> {
  const url = cleanPicture(address);
  if (!url || !showsPictures() || typeof document === "undefined") return Promise.resolve(null);
  let asked = loaded.get(url);
  if (!asked) {
    asked = byFetch(url)
      .catch(() => null)
      .then((got) => got ?? byImage(url))
      .catch(() => null);
    loaded.set(url, asked);
  }
  return asked;
}

/** For tests: forget what was loaded and what was chosen. */
export function resetPictures(): void {
  shown = null;
  loaded.clear();
  watchers.clear();
}
