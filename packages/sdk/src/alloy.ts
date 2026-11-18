/**
 * Alloy: the one surface everything modelled is drawn in.
 *
 * Dark metal that is never lit by a light. Its shape shows from three things
 * worked out per pixel instead: a fixed light from above and in front, the
 * horizon's glow reflected in it, and a rim of that glow where it turns away
 * from the eye. Faces marked as lights (mesh.ts) are drawn bright, with a
 * pulse that travels along them. One program for every mesh, so a headset
 * compiles it once.
 */
import * as THREE from "three";

export interface AlloyOptions {
  /** How mirror-like it is, 0 to 1. Furniture is about 0.5, a sculpture 1. */
  gloss?: number;
  /** The ground colour reflections fade into, and that distance fades to. */
  ground?: THREE.ColorRepresentation;
  /** How fast light travels along the seams. 0 holds it still. */
  speed?: number;
  /** Colours shift with the angle of view, like oil on water. 0 to 1. */
  sheen?: number;
  /** How far apart the pulses that travel along the seams are, in units of flow (metres, for most things). Default 3. */
  reach?: number;
}

export interface Alloy extends THREE.ShaderMaterial {
  /** Call each frame with seconds since the start. */
  tick(t: number): void;
  /** 0 to 1: how strongly it is being pointed at. Its lights answer. */
  aim(amount: number): void;
}

/** The sky as the reflections see it. Shared with the sky dome so the two agree. */
export const SKY_GLSL = `
vec3 skyGlow(vec3 d, vec3 accent, vec3 ground){
  float h = clamp(d.y, -1.0, 1.0);
  float band = pow(1.0 - abs(h), 9.0);
  float line = pow(1.0 - abs(h), 60.0);
  vec3 up = mix(ground * 0.55, ground * 0.2, smoothstep(0.0, 0.7, h));
  vec3 base = h > 0.0 ? up : ground;
  return base + accent * (band * 0.5 + line * 0.9);
}`;

export function createAlloy(accent: THREE.ColorRepresentation, opts: AlloyOptions = {}): Alloy {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uAccent: { value: new THREE.Color(accent) },
      uGround: { value: new THREE.Color(opts.ground ?? 0x04070b) },
      uTime: { value: 0 },
      uAim: { value: 0 },
      uGloss: { value: opts.gloss ?? 0.5 },
      uSpeed: { value: opts.speed ?? 1 },
      uSheen: { value: opts.sheen ?? 0 },
      uReach: { value: opts.reach ?? 3 },
      uOpacity: { value: 1 },
    },
    vertexShader: `
      attribute vec3 tone; attribute float glow; attribute float flow;
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vTone; varying float vGlow; varying float vFlow;
      void main(){
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = modelMatrix * instanceMatrix;
        #endif
        vec4 w = m * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = normalize(mat3(m) * normal);
        vTone = tone; vGlow = glow; vFlow = flow;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uAccent; uniform vec3 uGround; uniform float uTime; uniform float uAim; uniform float uGloss; uniform float uSpeed; uniform float uSheen; uniform float uReach; uniform float uOpacity;
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vTone; varying float vGlow; varying float vFlow;
      ${SKY_GLSL}
      void main(){
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorld);
        float facing = max(dot(N, V), 0.0);
        // Form: a light from above and in front, and more from the sky than from the floor.
        float key = max(dot(N, normalize(vec3(0.35, 0.8, 0.5))), 0.0);
        float dome = 0.5 + 0.5 * N.y;
        vec3 c = vTone * (0.3 + 0.6 * dome + 0.75 * key);
        // The place reflected in it, strongest at a glancing angle, as on real metal.
        float fresnel = pow(1.0 - facing, 4.0);
        vec3 mirror = skyGlow(reflect(-V, N), uAccent, uGround);
        c += mirror * (0.1 + 0.75 * fresnel) * uGloss;
        // A rim of the place's light where the surface turns away.
        c += uAccent * pow(1.0 - facing, 3.0) * 0.16;
        // Colours that shift with the angle, for things meant to be looked at.
        if (uSheen > 0.0) {
          vec3 shift = 0.5 + 0.5 * cos(6.2831 * (facing * 1.2 + vec3(0.0, 0.33, 0.67)) + vWorld.y * 1.5);
          c = mix(c, c + shift * uAccent * 0.8 + shift * 0.1, uSheen * (0.3 + 0.7 * fresnel));
        }
        // Lights: the place's colour, with a brighter pulse travelling along them.
        if (vGlow > 0.001) {
          float run = fract(vFlow / uReach - uTime * 0.22 * uSpeed);
          float pulse = smoothstep(0.8, 1.0, run) + smoothstep(0.1, 0.0, run) * 0.6;
          vec3 light = mix(uAccent, vec3(1.0), 0.06 + 0.5 * pulse + 0.3 * uAim);
          c = mix(c, light * (0.8 + 0.6 * pulse + 0.5 * uAim), vGlow);
        }
        // Distance takes it into the ground's colour.
        float far = length(cameraPosition - vWorld);
        c = mix(c, uGround, smoothstep(70.0, 320.0, far) * (1.0 - vGlow * 0.6));
        gl_FragColor = vec4(c, uOpacity);
        #include <colorspace_fragment>
      }`,
  }) as Alloy;
  // `opacity` works as on any material, once `transparent` is set: for things that fade.
  Object.defineProperty(material, "opacity", {
    get: () => material.uniforms.uOpacity!.value as number,
    set: (value: number) => {
      if (material.uniforms?.uOpacity) material.uniforms.uOpacity.value = value;
    },
  });
  material.tick = (t) => {
    material.uniforms.uTime!.value = t;
  };
  material.aim = (amount) => {
    material.uniforms.uAim!.value = amount;
  };
  return material;
}
