/**
 * The visitor's camera: pictures, selfies and short clips of the world they
 * are in, saved to their own device.
 *
 * It needs no account and contacts nothing. A picture is the scene drawn
 * once more into a file; a selfie is the same from a camera held out in
 * front, with the visitor's own figure put in for the moment; a clip is the
 * page's own canvas recorded for up to half a minute.
 *
 * Recording other people is said out loud: while a clip is being recorded,
 * everyone in the room sees a light on the recorder's figure (spec §9).
 */
import * as THREE from "three";
import type { Look } from "@nswp/core";
import { createFigure } from "./figure.js";
import type { Controls } from "./ui/model.js";
import { savesWait } from "./client-frame.js";
import { saveFile } from "./save-file.js";

export { saveFile };

export interface PictureOptions {
  /** Pixels across and down. Default 1920 by 1080. */
  width?: number;
  height?: number;
  /** Things to leave out: a menu floating in the scene, say. */
  hide?: THREE.Object3D[];
  /** JPEG quality, 0 to 1. Default 0.92. */
  quality?: number;
}

/**
 * Draw the scene once from `camera` and return it as a JPEG. The camera's
 * own shape is left alone: a copy is fitted to the picture. Works during an
 * immersive session too, since it never draws to the headset.
 */
export async function takePicture(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, opts: PictureOptions = {}): Promise<Blob> {
  const width = Math.round(opts.width ?? 1920);
  const height = Math.round(opts.height ?? 1080);
  const hidden = (opts.hide ?? []).filter((o) => o.visible);
  const xrWasEnabled = renderer.xr.enabled;
  const previousTarget = renderer.getRenderTarget();
  const target = new THREE.WebGLRenderTarget(width, height, { samples: 4 });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const eye = new THREE.PerspectiveCamera(camera.fov, width / height, camera.near, camera.far);
  camera.updateWorldMatrix(true, false);
  camera.matrixWorld.decompose(eye.position, eye.quaternion, eye.scale);
  eye.updateMatrixWorld(true);
  try {
    for (const o of hidden) o.visible = false;
    renderer.xr.enabled = false; // a picture is never an XR frame
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, eye);
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d")!;
    const image = g.createImageData(width, height);
    // WebGL rows run bottom-up; images run top-down.
    for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
    g.putImageData(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", opts.quality ?? 0.92));
    if (!blob) throw new Error("nswp-sdk: this browser couldn't encode the picture");
    return blob;
  } finally {
    for (const o of hidden) o.visible = true;
    renderer.xr.enabled = xrWasEnabled;
    renderer.setRenderTarget(previousTarget);
    target.dispose();
  }
}

export interface SelfieOptions extends PictureOptions {
  /** How far in front of the visitor the camera is held, in metres. Default 1.7. */
  reach?: number;
}

/**
 * A picture of the visitor, from a camera held out in front of them and
 * turned back. Their own figure is put where their head is for the picture:
 * nobody sees themselves otherwise. Whoever is behind them is in it too.
 */
export async function takeSelfie(renderer: THREE.WebGLRenderer, scene: THREE.Scene, head: THREE.PerspectiveCamera, look: Look | string, opts: SelfieOptions = {}): Promise<Blob> {
  head.updateWorldMatrix(true, false);
  const at = new THREE.Vector3();
  const facing = new THREE.Quaternion();
  head.matrixWorld.decompose(at, facing, new THREE.Vector3());
  // Straight ahead, along the ground: a selfie taken looking at the floor still shows a face.
  const ahead = new THREE.Vector3(0, 0, -1).applyQuaternion(facing).setY(0);
  if (ahead.lengthSq() < 1e-6) ahead.set(0, 0, -1);
  ahead.normalize();
  const figure = createFigure(look);
  figure.group.position.copy(at);
  figure.group.rotation.y = Math.atan2(-ahead.x, -ahead.z);
  // Hands resting, since a held-out camera has no way to know where they are.
  scene.add(figure.group);
  const eye = new THREE.PerspectiveCamera(58, 1, 0.05, head.far);
  eye.position.copy(at).addScaledVector(ahead, opts.reach ?? 1.7);
  eye.position.y = at.y + 0.08;
  eye.lookAt(at.x, at.y - 0.22, at.z);
  try {
    return await takePicture(renderer, scene, eye, { width: 1600, height: 1200, ...opts });
  } finally {
    scene.remove(figure.group);
    figure.dispose();
  }
}

export interface Clip {
  /** Stop, and get the recording. */
  stop(): Promise<Blob>;
  /** Seconds recorded so far. */
  seconds(): number;
  /** Resolves when it stops for any reason, such as reaching its limit. */
  done: Promise<Blob>;
}

/** Can this browser record its own canvas? */
export function canRecord(): boolean {
  return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;
}

/**
 * Record what the page's canvas shows: picture only, no sound, for at most
 * `maxSeconds`. Not available during an immersive session, when the page's
 * canvas isn't what is being drawn.
 */
export function recordClip(canvas: HTMLCanvasElement, opts: { fps?: number; maxSeconds?: number } = {}): Clip {
  if (!canRecord()) throw new Error("nswp-sdk: this browser can't record its canvas");
  const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const stream = canvas.captureStream(opts.fps ?? 30);
  const recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 6_000_000 });
  const parts: Blob[] = [];
  const started = performance.now();
  recorder.ondataavailable = (e) => {
    if (e.data.size) parts.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      resolve(new Blob(parts, { type: recorder.mimeType || type || "video/webm" }));
    };
  });
  recorder.start(500);
  const limit = setTimeout(() => recorder.state !== "inactive" && recorder.stop(), (opts.maxSeconds ?? 30) * 1000);
  return {
    done,
    seconds: () => (performance.now() - started) / 1000,
    stop() {
      clearTimeout(limit);
      if (recorder.state !== "inactive") recorder.stop();
      return done;
    },
  };
}

export interface Capture {
  kind: "picture" | "selfie" | "clip";
  blob: Blob;
  name: string;
}

export interface CameraOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /**
   * The visitor's own look, for selfies: what they are wearing, or a key to
   * generate one from. Usually `presence.selfLook`. Left out, they are a
   * figure of their own for this visit.
   */
  look?: () => Look | string;
  /** Tell the room a clip is being recorded, and when it stops. Usually `presence.setRecording`. */
  recording?: (on: boolean) => void;
  /** Things in the scene to leave out of every picture: the headset console, a pointer. */
  hide?: () => THREE.Object3D[];
  /** A word for file names: the world's name. */
  name?: string;
  /** Longest clip, in seconds. Default 30. */
  maxSeconds?: number;
  /** Called with everything taken: a picture, a selfie or a clip. A place to keep it, such as the visitor's library. */
  onCapture?: (capture: Capture) => void;
}

export interface Camera {
  /** What has been taken and not yet saved (for tests, and for a gallery of a world's own). */
  waiting(): Capture[];
  /** Whether a clip is being recorded now. */
  readonly recording: boolean;
  /** The most recent picture or clip, saved or not. */
  last(): Capture | null;
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "world";

/**
 * Add the camera to a world's controls: a section with a picture, a selfie
 * and a clip. Outside a headset each is saved straight away. Inside one a
 * save can't be shown, so they are kept and offered once the visitor is out.
 */
export function addCameraControls(controls: Controls, d: CameraOptions): Camera {
  const name = slug(d.name ?? "world");
  const presenting = () => d.renderer.xr.isPresenting;
  const kept: Capture[] = [];
  let clip: Clip | null = null;
  const plain = `plain-${Math.random().toString(36).slice(2, 12)}`;
  let last = "Pictures and clips are saved to this device. Nothing is sent anywhere.";

  const tell = (text: string) => {
    last = text;
    controls.say(text);
  };
  let latest: Capture | null = null;
  const keep = (capture: Capture) => {
    latest = capture;
    d.onCapture?.(capture);
    if (presenting()) {
      kept.push(capture);
      tell(`Kept. Save ${kept.length === 1 ? "it" : `all ${kept.length}`} from the Camera menu when you leave VR.`);
    } else if (savesWait()) {
      // The client above has the menu, and no press there is waiting for this (a clip that ran to its end): it is
      // kept for one, as in a headset. Saved from here it would be a save nobody pressed for.
      kept.push(capture);
      tell(`Kept. Save ${kept.length === 1 ? "it" : `all ${kept.length}`} from the Camera menu.`);
    } else if (!saveFile(capture.blob, capture.name)) {
      // Saved by this page. Handed up to a client instead, the client says what it saved: its page did.
      tell(capture.kind === "clip" ? "Clip saved to this device." : "Picture saved to this device.");
    }
  };
  const shoot = async (kind: "picture" | "selfie") => {
    try {
      const hide = d.hide?.() ?? [];
      const blob = kind === "selfie" ? await takeSelfie(d.renderer, d.scene, d.camera, d.look?.() ?? plain, { hide }) : await takePicture(d.renderer, d.scene, d.camera, { hide });
      keep({ kind, blob, name: `${name}-${kind === "selfie" ? "selfie-" : ""}${stamp()}.jpg` });
    } catch {
      tell("That picture couldn't be taken on this device.");
    }
  };
  const finish = (blob: Blob) => {
    clip = null;
    d.recording?.(false);
    keep({ kind: "clip", blob, name: `${name}-clip-${stamp()}.${blob.type.includes("mp4") ? "mp4" : "webm"}` });
  };

  controls.addSection({ id: "camera", label: "Camera", icon: "camera", note: () => (clip ? `Recording: ${Math.floor(clip.seconds())} s. Others in the room can see that you are.` : last) });
  controls.add(
    // Each of these may end in something to save, so each is a row that saves: where a client above has the menu,
    // its press there is what the picture or the clip answers.
    { id: "camera-picture", section: "camera", icon: "camera", kind: "save", label: "Take a picture", short: "Picture", act: () => shoot("picture") },
    { id: "camera-selfie", section: "camera", icon: "selfie", kind: "save", label: "Take a selfie", short: "Selfie", act: () => shoot("selfie") },
    {
      id: "camera-clip",
      section: "camera",
      icon: "record",
      kind: "save",
      label: () => (clip ? "Stop recording" : "Record a clip"),
      short: () => (clip ? "Stop" : "Clip"),
      on: () => !!clip,
      tone: "warn",
      // The page's canvas isn't what a headset is shown, so there is nothing to record there.
      hidden: () => !canRecord() || (presenting() && !clip),
      act: async () => {
        if (clip) return void clip.stop();
        try {
          clip = recordClip(d.renderer.domElement, { maxSeconds: d.maxSeconds ?? 30 });
          d.recording?.(true);
          tell(`Recording, picture only, for up to ${d.maxSeconds ?? 30} seconds. Others in the room can see that you are.`);
          void clip.done.then(finish);
        } catch {
          clip = null;
          tell("This device can't record a clip.");
        }
      },
    },
    {
      id: "camera-save",
      section: "camera",
      icon: "save",
      kind: "save",
      label: () => (kept.length === 1 ? "Save 1 picture" : `Save ${kept.length} pictures`),
      short: "Save",
      tone: "primary",
      hidden: () => kept.length === 0 || presenting(),
      act: () => {
        // A client above takes only so many for one press: the rest stay kept, and the row stays for the next.
        let here = 0;
        while (kept.length && !savesWait()) {
          const c = kept.shift()!;
          if (!saveFile(c.blob, c.name)) here++;
        }
        if (kept.length) tell(`${kept.length} more to save. Press again.`);
        else if (here) tell("Saved to this device.");
      },
    },
  );
  return {
    waiting: () => [...kept],
    last: () => latest,
    get recording() {
      return !!clip;
    },
  };
}
