/**
 * A world's preview (protocol/04-previews.md): a 360° still, twice as wide as tall, with the middle of the picture
 * looking along -Z from where a visitor arrives.
 *
 * It is made from six ordinary square views, each 90° wide, painted onto the part of the panorama it covers. What
 * takes the six views is whatever draws the world: Three.js here (`capturePanorama`), or another engine, which
 * hands them over as pictures (engine-panorama.ts). The painting is this, once, for all of them.
 */
import * as THREE from "three";

/**
 * The six views, in the order they are taken: which way each looks, and which way is up in it. A view's right is
 * its looking direction crossed with its up.
 */
export const PANORAMA_VIEWS: readonly { forward: readonly [number, number, number]; up: readonly [number, number, number] }[] = [
  { forward: [0, 0, -1], up: [0, 1, 0] },
  { forward: [1, 0, 0], up: [0, 1, 0] },
  { forward: [0, 0, 1], up: [0, 1, 0] },
  { forward: [-1, 0, 0], up: [0, 1, 0] },
  { forward: [0, 1, 0], up: [0, 0, 1] },
  { forward: [0, -1, 0], up: [0, 0, -1] },
];

/** The widest a panorama may be (the protocol's ceiling), and the narrowest worth making. */
export const panoramaWidth = (asked: number | undefined): number => Math.min(4096, Math.max(256, Math.round((asked ?? 2048) / 2) * 2));

export interface PanoramaPainter {
  /** Paint one of the six views onto the panorama. `face` is that view's picture, square, its first row at the bottom. */
  paint(face: THREE.Texture, view: number): void;
  /** The finished panorama, as a WebP file. */
  blob(quality?: number): Promise<Blob>;
  dispose(): void;
}

/**
 * Something to paint the six views onto. It leaves the renderer drawing to its own target and not clearing: whoever
 * made it puts the renderer back as it was.
 */
export function paintPanorama(renderer: THREE.WebGLRenderer, width: number): PanoramaPainter {
  const height = width / 2;
  const flatTarget = new THREE.WebGLRenderTarget(width, height);
  flatTarget.texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    uniforms: { face: { value: null as THREE.Texture | null }, forward: { value: new THREE.Vector3() }, up: { value: new THREE.Vector3() }, right: { value: new THREE.Vector3() } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `uniform sampler2D face; uniform vec3 forward; uniform vec3 up; uniform vec3 right; varying vec2 vUv;
      void main(){
        float lon = (vUv.x - 0.5) * 6.283185307179586;
        float lat = (vUv.y - 0.5) * 3.141592653589793;
        vec3 dir = vec3(sin(lon) * cos(lat), sin(lat), -cos(lon) * cos(lat));
        float along = dot(dir, forward);
        // Only the directions this view is the best one for (with a hair of overlap).
        if (along < max(abs(dir.x), max(abs(dir.y), abs(dir.z))) - 0.0005) discard;
        vec2 p = vec2(dot(dir, right), dot(dir, up)) / along;
        gl_FragColor = texture2D(face, clamp(p * 0.5 + 0.5, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer.setRenderTarget(flatTarget);
  renderer.autoClear = true;
  renderer.clear();
  return {
    paint(face, view) {
      const v = PANORAMA_VIEWS[view];
      if (!v) return;
      material.uniforms.face!.value = face;
      (material.uniforms.forward!.value as THREE.Vector3).fromArray(v.forward);
      (material.uniforms.up!.value as THREE.Vector3).fromArray(v.up);
      (material.uniforms.right!.value as THREE.Vector3).crossVectors(material.uniforms.forward!.value as THREE.Vector3, material.uniforms.up!.value as THREE.Vector3);
      renderer.autoClear = false;
      renderer.setRenderTarget(flatTarget);
      renderer.render(quadScene, quadCamera);
    },
    async blob(quality = 0.82) {
      const pixels = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(flatTarget, 0, 0, width, height, pixels);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const g = canvas.getContext("2d")!;
      const image = g.createImageData(width, height);
      // WebGL rows run bottom-up; images run top-down.
      for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
      g.putImageData(image, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob) throw new Error("nswp-sdk: this browser couldn't encode the preview");
      return blob;
    },
    dispose() {
      flatTarget.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
