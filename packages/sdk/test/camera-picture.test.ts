import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { takePicture, takeSelfie } from "../src/camera.js";

/**
 * Taking a picture holds the world only for the one drawing. Making the file from it can take a slow device
 * seconds, and the world draws its own frames meanwhile: they must go to the screen, with nothing of the picture's
 * left set. The renderer and the page's canvas are stand-ins; the file is made only when the test says.
 */
const renderer = () => {
  const r = {
    target: null as unknown,
    drawn: [] as { to: unknown; things: number }[],
    xr: { enabled: true },
    getRenderTarget: () => r.target,
    setRenderTarget: (t: unknown) => void (r.target = t),
    clear: () => {},
    render: (scene: THREE.Scene) => {
      let things = 0;
      scene.traverseVisible(() => things++);
      r.drawn.push({ to: r.target, things });
    },
    readRenderTargetPixels: () => {},
  };
  return r;
};

/** The page's canvas: its file is made when `make()` is called, as a slow device makes it late. */
let waiting: ((blob: Blob | null) => void)[] = [];
const make = (blob: Blob | null = new Blob(["jpeg"], { type: "image/jpeg" })) => waiting.splice(0).forEach((done) => done(blob));
beforeEach(() => {
  waiting = [];
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8Array(w * h * 4) }), putImageData: () => {} }),
      toBlob: (done: (blob: Blob | null) => void) => void waiting.push(done),
    }),
  };
});
afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
});

const world = () => {
  const scene = new THREE.Scene();
  const wall = new THREE.Object3D();
  const hands = new THREE.Object3D();
  scene.add(wall, hands);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  scene.add(camera);
  return { scene, wall, hands, camera };
};
const count = (scene: THREE.Scene) => {
  let n = 0;
  scene.traverseVisible(() => n++);
  return n;
};

describe("taking a picture", () => {
  it("draws once into a target of its own, with what is to be hidden hidden", async () => {
    const r = renderer();
    const w = world();
    const taking = takePicture(r as unknown as THREE.WebGLRenderer, w.scene, w.camera, { width: 8, height: 4, hide: [w.hands] });
    expect(r.drawn).toHaveLength(1);
    expect(r.drawn[0]!.to).toBeInstanceOf(THREE.WebGLRenderTarget);
    // The scene, the wall and the camera: not the hands.
    expect(r.drawn[0]!.things).toBe(3);
    make();
    expect((await taking).type).toBe("image/jpeg");
  });

  it("leaves the renderer as it was before the file is made, so the world's own frames go to the screen meanwhile", async () => {
    const r = renderer();
    const w = world();
    const screen = { the: "screen" };
    r.target = screen;
    const taking = takePicture(r as unknown as THREE.WebGLRenderer, w.scene, w.camera, { width: 8, height: 4, hide: [w.hands] });
    // The file is still being made: a slow device. Nothing of the picture's is left set.
    await Promise.resolve();
    expect(waiting).toHaveLength(1);
    expect([r.target, r.xr.enabled, w.hands.visible]).toEqual([screen, true, true]);
    // A frame of the world's own, drawn now, goes where the world draws, with everything in it.
    r.render(w.scene);
    expect(r.drawn[1]).toEqual({ to: screen, things: 4 });
    make();
    await taking;
    expect([r.target, r.xr.enabled, w.hands.visible]).toEqual([screen, true, true]);
  });

  it("leaves it as it was when the drawing fails, and when the file can't be made", async () => {
    const r = renderer();
    const w = world();
    r.xr.enabled = false;
    r.render = () => {
      throw new Error("the context was lost");
    };
    await expect(takePicture(r as unknown as THREE.WebGLRenderer, w.scene, w.camera, { width: 8, height: 4, hide: [w.hands] })).rejects.toThrow("the context was lost");
    expect([r.target, r.xr.enabled, w.hands.visible]).toEqual([null, false, true]);
    const ok = renderer();
    const taking = takePicture(ok as unknown as THREE.WebGLRenderer, w.scene, w.camera, { width: 8, height: 4 });
    make(null);
    await expect(taking).rejects.toThrow("couldn't encode");
    expect([ok.target, ok.xr.enabled]).toEqual([null, true]);
  });

  it("leaves hidden what was hidden before it", async () => {
    const r = renderer();
    const w = world();
    w.hands.visible = false;
    const taking = takePicture(r as unknown as THREE.WebGLRenderer, w.scene, w.camera, { width: 8, height: 4, hide: [w.hands] });
    make();
    await taking;
    expect(w.hands.visible).toBe(false);
  });
});

describe("taking a selfie", () => {
  it("stands the visitor's own figure in the world for the one drawing, and not while the file is made", async () => {
    const r = renderer();
    const w = world();
    const before = count(w.scene);
    const taking = takeSelfie(r as unknown as THREE.WebGLRenderer, w.scene, w.camera, "a look", { hide: [w.hands] });
    // In the picture: more than the world alone, without the hands.
    expect(r.drawn).toHaveLength(1);
    expect(r.drawn[0]!.things).toBeGreaterThan(before);
    // And gone again, with the file not made yet: it is in none of the world's own frames.
    await Promise.resolve();
    expect(waiting).toHaveLength(1);
    expect([count(w.scene), r.target, w.hands.visible]).toEqual([before, null, true]);
    make();
    expect((await taking).type).toBe("image/jpeg");
    expect(count(w.scene)).toBe(before);
  });
});
