/**
 * The place a world stands in: a sky, a ground ruled with light that runs to
 * the horizon, a skyline, and dust in the air.
 *
 * It is the look of the reference worlds, of a home drawn by `createHome`, and
 * of BitPortal's room: one place to change it for all of them. A dozen draw
 * calls, no textures, nothing fetched.
 *
 *   const environment = createEnvironment("#3df2a0");
 *   scene.add(environment.group);
 *   // each frame: environment.update(t)
 *
 * It needs a camera that sees a long way: set the far plane to 700 or more.
 */
import * as THREE from "three";
import { createAlloy, SKY_GLSL } from "./alloy.js";
import { MeshBuilder, type Frame, type P2 } from "./mesh.js";
import { mouldingPaint, mouldingProfile } from "./models.js";

export interface Environment {
  group: THREE.Group;
  /** Call each frame with seconds since the start. Pass 0 always to keep it still. */
  update(t: number): void;
}

export interface EnvironmentOptions {
  /** The colour of the ground the grid is drawn on, and of the night above it. Dark by default. */
  ground?: THREE.ColorRepresentation;
  /** Metres round the middle that the nearest towers of the skyline keep well back from. */
  clear?: number;
  /** Draw the skyline. Default true. */
  skyline?: boolean;
  /** Draw dust drifting in the air near the middle. Default true. */
  dust?: boolean;
  /** Draw the constellations that come and go among the stars. Default true. */
  constellations?: boolean;
  /** Any number: it turns the sky, so two worlds don't share one. Taken from the colours when left out. */
  seed?: number;
}

/** The ground colour this look is drawn on unless a place asks for another. */
export const GROUND = 0x04070b;

/** A small, repeatable random number source: a place looks the same on every visit. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const NOISE_GLSL = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float noise3(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}`;

/** Where things stand in a world's sky. Worked out once from its seed, so the sky is the same on every visit. */
interface SkyPlan {
  /** Towards the middle of the ringed world, and the directions across and up its face. */
  planet: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  /** How big it looks: the sine of half the angle it covers. */
  size: number;
  /** Which side of the way in it hangs on: 1 or -1. */
  side: number;
  /** The pole of the band of far stars. */
  band: THREE.Vector3;
}

function planSky(seed: number): SkyPlan {
  const rand = seeded(seed * 31 + 5);
  const side = rand() > 0.5 ? 1 : -1;
  // Off to one side of the way in, low enough to sit over the skyline.
  const az = side * THREE.MathUtils.degToRad(30 + rand() * 22);
  const el = THREE.MathUtils.degToRad(19 + rand() * 4);
  const planet = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  const right = new THREE.Vector3(0, 1, 0).cross(planet).normalize().negate();
  const up = planet.clone().cross(right).normalize().negate();
  const lean = rand() * Math.PI * 2;
  const band = new THREE.Vector3(Math.cos(lean) * 0.75, 0.62, Math.sin(lean) * 0.75).normalize();
  return { planet, right, up, size: 0.135 + rand() * 0.03, side, band };
}

/**
 * The sky. Quiet on purpose, with one thing in it to look at: another world,
 * hanging low, dark but for a thin lit edge. It is ruled with the same grid as
 * the ground a visitor stands on, has lights on its night side, and wears
 * rings that its own shadow falls across. Behind it: fine stars, thicker along
 * one faint band, in a night the colour of the ground. Every world's sky is
 * arranged differently.
 */
function createSky(glow: THREE.Color, ground: THREE.Color, seed: number, plan: SkyPlan): THREE.Mesh {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        uAccent: { value: glow },
        uGround: { value: ground },
        uTime: { value: 0 },
        uSeed: { value: seed % 100 },
        uPlanet: { value: plan.planet },
        uRight: { value: plan.right },
        uUp: { value: plan.up },
        uSize: { value: plan.size },
        // Where its light comes from, in its own directions (across, up, towards the eye): below and behind, so only an edge is lit.
        uLight: { value: new THREE.Vector3(0.62 * plan.side, -0.5, -0.6).normalize() },
        // The pole its rings turn about, tipped towards the eye so they open into an ellipse.
        uRing: { value: new THREE.Vector3(0.3 * plan.side, 0.88, 0.37).normalize() },
        uBand: { value: plan.band },
      },
      // The dome is drawn round the eye wherever it is, so the sky never comes closer.
      vertexShader: "varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww; }",
      fragmentShader: `uniform vec3 uAccent; uniform vec3 uGround; uniform float uTime; uniform float uSeed;
        uniform vec3 uPlanet; uniform vec3 uRight; uniform vec3 uUp; uniform float uSize; uniform vec3 uLight; uniform vec3 uRing; uniform vec3 uBand;
        varying vec3 vDir;
        ${SKY_GLSL}
        ${NOISE_GLSL}
        // One layer of stars: a lattice of cells, a few of which hold a star somewhere inside.
        vec3 stars(vec3 d, float scale, float share, float size){
          vec3 p = d * scale;
          vec3 id = floor(p);
          float pick = hash3(id);
          if (pick < 1.0 - share) return vec3(0.0);
          vec3 where = vec3(hash3(id + 1.7), hash3(id + 5.3), hash3(id + 9.1)) - 0.5;
          float dist = length(fract(p) - 0.5 - where * 0.55);
          float bright = fract(pick * 91.7);
          bright = 0.15 + 0.85 * bright * bright * bright;
          float twinkle = 0.75 + 0.25 * sin(uTime * (0.5 + bright * 2.0) + pick * 90.0);
          vec3 tint = mix(vec3(0.78, 0.86, 1.0), mix(uAccent, vec3(1.0), 0.35), step(0.6, fract(pick * 37.3)));
          return tint * smoothstep(size, 0.0, dist) * bright * twinkle;
        }
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = skyGlow(d, uAccent, uGround);
          float above = smoothstep(-0.01, 0.1, h);

          // The band of far stars: a faint cloud along one great circle, and more stars where it runs.
          float off = dot(d, uBand);
          float band = exp(-off * off * 16.0);
          float cloud = 0.0;
          if (band > 0.03) {
            cloud = noise3(d * 3.1 + uSeed) * 0.55 + noise3(d * 7.7 + uSeed) * 0.3 + noise3(d * 17.0) * 0.15;
            cloud = smoothstep(0.3, 0.8, cloud) * band;
            c += mix(uAccent, uAccent.brg, 0.5 * noise3(d * 2.0 - uSeed)) * cloud * 0.055 * above;
          }
          vec3 sky = stars(d, 95.0, 0.010 + 0.02 * band, 0.2) * 0.8 + stars(d, 44.0, 0.006, 0.13) * 1.5 + stars(d, 210.0, 0.012 + 0.03 * cloud, 0.3) * 0.3;
          c += sky * above;

          // The ringed world. Across its face: x and y from -1 to 1, as on a disc.
          if (dot(d, uPlanet) > 0.0) {
            vec2 q = vec2(dot(d, uRight), dot(d, uUp)) / uSize;
            float r2 = dot(q, q);
            float haze = smoothstep(0.02, 0.16, h); // it sinks into the horizon's light
            if (r2 < 9.0) {
              // Light spilling past the lit edge.
              float r = sqrt(r2);
              vec3 rim = vec3(q / max(r, 0.001), 0.0);
              float day = smoothstep(-0.1, 0.5, dot(rim, uLight));
              c += uAccent * exp(-max(r - 1.0, 0.0) * 7.0) * (0.02 + 0.3 * day) * haze * step(1.0, r2);
              if (r2 < 1.0) {
                vec3 n = vec3(q, sqrt(1.0 - r2));
                float lit = smoothstep(-0.02, 0.3, dot(n, uLight));
                // Its own grid: lines of longitude that turn with it, lines of latitude that don't.
                vec2 g = vec2(atan(n.x, n.z) + uTime * 0.006, asin(clamp(n.y, -1.0, 1.0))) * (12.0 / 3.14159265);
                vec2 gw = fwidth(g);
                vec2 gl = abs(fract(g - 0.5) - 0.5) / max(gw, vec2(0.0001));
                float line = (1.0 - min(min(gl.x, gl.y), 1.0)) * smoothstep(0.5, 0.15, max(gw.x, gw.y));
                // Lights on the night side, gathered where its cities would be.
                vec2 cell = floor(g * 5.0);
                float town = step(0.72, hash(cell)) * smoothstep(0.42, 0.62, noise(g * 0.8 + uSeed));
                float lamp = town * smoothstep(0.32, 0.1, length(fract(g * 5.0) - 0.5)) * (0.6 + 0.4 * sin(uTime * 0.7 + hash(cell) * 40.0));
                vec3 world = uGround * 0.22;
                world += uAccent * (line * 0.05 + lamp * 0.3) * (1.0 - lit);
                world = mix(world, uAccent * 0.5 + uGround, lit * 0.85);
                world += mix(uAccent, vec3(1.0), 0.35) * line * lit * 0.55;
                world += uAccent * pow(r2, 7.0) * (0.05 + 0.5 * lit);
                float edge = smoothstep(1.0, 1.0 - fwidth(r2) * 1.5, r2);
                c = mix(c, mix(c, world, haze), edge);
              }
              // The rings: where this line of sight meets their plane.
              float z = -(q.x * uRing.x + q.y * uRing.y) / uRing.z;
              if (r2 > 1.0 || z > 0.0) {
                vec3 P = vec3(q, z);
                float rho = length(P);
                float inside = smoothstep(1.42, 1.5, rho) * smoothstep(2.32, 2.24, rho);
                if (inside > 0.0) {
                  float k = rho * 26.0;
                  float lane = mix(hash(vec2(floor(k), 3.0 + uSeed)), hash(vec2(floor(k) + 1.0, 3.0 + uSeed)), smoothstep(0.35, 0.65, fract(k)));
                  float shade = mix(lane * lane, 0.3, smoothstep(0.3, 1.0, fwidth(k)));
                  shade *= 1.0 - 0.85 * smoothstep(0.06, 0.0, abs(rho - 1.93)); // a gap
                  float behind = dot(P, uLight);
                  float shadow = behind < 0.0 && length(P - uLight * behind) < 1.0 ? 0.1 : 1.0;
                  c += mix(uAccent, vec3(1.0), 0.2) * shade * inside * shadow * 0.34 * haze;
                }
              }
            }
          }

          // A grain finer than a screen can band.
          c += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.0015;
          gl_FragColor = vec4(max(c, 0.0), 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}

/**
 * Constellations, drawn the way a map of a network is: stars joined by fine
 * lines, with a point of light now and then travelling from one to the next.
 * Each shows for a while and fades, so the sky is never the same for long.
 */
function createConstellations(glow: THREE.Color, seed: number, plan: SkyPlan): THREE.Group {
  const rand = seeded(seed * 17 + 3);
  const lines: number[] = [];
  const lineData: number[] = []; // along, phase
  const nodes: number[] = [];
  const nodeData: number[] = []; // size, phase
  const FIGURES = 7;
  for (let f = 0; f < FIGURES; f++) {
    // Somewhere in the upper sky, clear of the ringed world.
    let start = new THREE.Vector3();
    for (let tries = 0; tries < 30; tries++) {
      const az = rand() * Math.PI * 2;
      const el = THREE.MathUtils.degToRad(24 + rand() * 46);
      start.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
      if (start.dot(plan.planet) < 0.72) break;
    }
    const phase = f / FIGURES + rand() * 0.05;
    const stars = [start];
    const far = [0];
    const count = 5 + Math.floor(rand() * 4);
    for (let i = 1; i < count; i++) {
      // Each new star hangs off one already placed: mostly the last, sometimes an earlier one, so figures branch.
      const from = rand() < 0.7 ? stars.length - 1 : Math.floor(rand() * stars.length);
      const step = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(0.07 + rand() * 0.09);
      const next = stars[from]!.clone().add(step).normalize();
      if (next.y < 0.3) next.setY(0.3).normalize();
      const along = far[from]! + stars[from]!.distanceTo(next) * 10;
      lines.push(...stars[from]!.toArray(), ...next.toArray());
      lineData.push(far[from]!, phase, along, phase);
      stars.push(next);
      far.push(along);
    }
    for (const s of stars) {
      nodes.push(...s.toArray());
      nodeData.push(0.5 + rand() * 0.5, phase);
    }
  }
  const SHOW = "float show(float phase, float t){ return smoothstep(0.1, 0.75, sin(t * 0.045 + phase * 6.2831) * 0.5 + 0.5); }";
  const VERT = "vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww;";
  const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false } as const;
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  lineGeometry.setAttribute("data", new THREE.Float32BufferAttribute(lineData, 2));
  const lineMaterial = new THREE.ShaderMaterial({
    ...common,
    uniforms: { uAccent: { value: glow }, uTime: { value: 0 } },
    vertexShader: `attribute vec2 data; varying vec2 vData; varying float vUp; void main(){ vData = data; vUp = position.y; ${VERT} }`,
    fragmentShader: `uniform vec3 uAccent; uniform float uTime; varying vec2 vData; varying float vUp; ${SHOW}
      void main(){
        float on = show(vData.y, uTime) * smoothstep(0.2, 0.45, vUp);
        float run = smoothstep(0.92, 1.0, fract(vData.x * 0.28 - uTime * 0.11 + vData.y * 3.0));
        gl_FragColor = vec4(mix(uAccent, vec3(1.0), 0.25 + 0.5 * run), (0.2 + 0.8 * run) * on);
        #include <colorspace_fragment>
      }`,
  });
  const nodeGeometry = new THREE.BufferGeometry();
  nodeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(nodes, 3));
  nodeGeometry.setAttribute("data", new THREE.Float32BufferAttribute(nodeData, 2));
  const nodeMaterial = new THREE.ShaderMaterial({
    ...common,
    uniforms: { uAccent: { value: glow }, uTime: { value: 0 }, uPixels: { value: 1 } },
    vertexShader: `attribute vec2 data; uniform float uPixels; varying vec2 vData; varying float vUp; void main(){ vData = data; vUp = position.y; ${VERT} gl_PointSize = (5.0 + 5.0 * data.x) * uPixels; }`,
    fragmentShader: `uniform vec3 uAccent; uniform float uTime; varying vec2 vData; varying float vUp; ${SHOW}
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float on = show(vData.y, uTime) * smoothstep(0.2, 0.45, vUp);
        float a = smoothstep(0.16, 0.06, d) + smoothstep(0.5, 0.1, d) * 0.22;
        gl_FragColor = vec4(mix(uAccent, vec3(1.0), 0.5), a * on * (0.55 + 0.45 * vData.x));
        #include <colorspace_fragment>
      }`,
  });
  const group = new THREE.Group();
  const drawn = [new THREE.LineSegments(lineGeometry, lineMaterial), new THREE.Points(nodeGeometry, nodeMaterial)];
  for (const o of drawn) {
    o.frustumCulled = false;
    o.renderOrder = -9;
    o.onBeforeRender = (renderer) => {
      nodeMaterial.uniforms.uPixels!.value = renderer.getPixelRatio();
    };
  }
  group.add(...drawn);
  return group;
}

/** The ground: plates ruled with light, lit harder towards the horizon, with light running along the main lines. */
function createGround(glow: THREE.Color, ground: THREE.Color): THREE.Mesh {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.ShaderMaterial({
      uniforms: { uAccent: { value: glow }, uGround: { value: ground }, uTime: { value: 0 } },
      vertexShader: "varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: `uniform vec3 uAccent; uniform vec3 uGround; uniform float uTime; varying vec3 vWorld;
        ${SKY_GLSL}
        ${NOISE_GLSL}
        // A line every \`size\` metres, one pixel sharp at any distance: x across, y along.
        vec2 rule(vec2 p, float size){
          vec2 q = p / size;
          vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
          return 1.0 - min(g, 1.0);
        }
        void main(){
          vec2 p = vWorld.xz;
          vec3 V = normalize(cameraPosition - vWorld);
          float far = length(p - cameraPosition.xz);
          vec2 fine = rule(p, 1.0) * exp(-far * 0.085);
          vec2 wide = rule(p, 8.0) * exp(-far * 0.02);
          // Each eight-metre plate is its own piece of ground: a shade apart from its neighbours.
          vec2 plate = floor(p / 8.0);
          vec3 c = uGround * (0.86 + 0.28 * hash(plate)) ;
          // The sky in the floor, as on polished stone: nothing straight down, a lot at a glancing angle.
          float glance = pow(1.0 - max(V.y, 0.0), 5.0);
          c += skyGlow(reflect(-V, vec3(0.0, 1.0, 0.0)), uAccent, uGround) * glance * 0.55;
          // Light running along the main lines, each at its own pace and in its own direction.
          float lineX = floor(p.y / 8.0 + 0.5);
          float lineZ = floor(p.x / 8.0 + 0.5);
          float boltX = smoothstep(0.972, 1.0, fract(p.x * 0.011 * (hash(vec2(lineX, 3.0)) > 0.5 ? 1.0 : -1.0) - uTime * (0.05 + 0.07 * hash(vec2(lineX, 9.0))) + hash(vec2(lineX, 1.0))));
          float boltZ = smoothstep(0.972, 1.0, fract(p.y * 0.011 * (hash(vec2(lineZ, 5.0)) > 0.5 ? 1.0 : -1.0) - uTime * (0.05 + 0.07 * hash(vec2(lineZ, 7.0))) + hash(vec2(lineZ, 2.0))));
          float bolts = wide.y * boltX + wide.x * boltZ;
          // A slow ring of light that travels out across the floor.
          float ring = smoothstep(2.6, 0.0, abs(far - mod(uTime * 5.0, 110.0))) * exp(-far * 0.028);
          float light = max(fine.x, fine.y) * 0.26 + max(wide.x, wide.y) * 0.8 + ring * (0.1 + max(fine.x, fine.y) * 0.5);
          c = mix(c, uAccent, clamp(light, 0.0, 1.0));
          c += mix(uAccent, vec3(1.0), 0.6) * bolts * 1.4;
          // A stud where the main lines cross.
          vec2 cross8 = abs(fract(p / 8.0 + 0.5) - 0.5) * 8.0;
          c += uAccent * smoothstep(0.16, 0.1, max(cross8.x, cross8.y)) * exp(-far * 0.03) * 0.8;
          c = mix(c, uAccent, 0.07 * smoothstep(40.0, 300.0, far));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = -2;
  return floor;
}

/** What the skyline is built from. Each is a metre square and a metre high, so an instance's scale is its size. */
interface SkylineShapes {
  towers: MeshBuilder[];
  /** A great arch: the doorway's shape at the size of a city. One metre across. */
  arch: MeshBuilder;
}

/**
 * The skyline's pieces. Modelled, not boxes: towers set back as they rise,
 * with lit seams, bands of windows, decks, bridges and beacons.
 */
function skylineShapes(): SkylineShapes {
  const dark = { bevel: 0.02 };
  /** Rows of lit windows round a square tier. */
  const windows = (b: MeshBuilder, y0: number, y1: number, half: number, rows: number, glow = 0.32) => {
    for (let r = 0; r < rows; r++) {
      const y = y0 + ((r + 0.5) / rows) * (y1 - y0);
      const w = 0.35 * ((y1 - y0) / rows);
      b.line([-half * 0.82, y, half + 0.001], [half * 0.82, y, half + 0.001], w, [0, 0, 1], { glow, flow: r });
      b.line([half + 0.001, y, half * 0.82], [half + 0.001, y, -half * 0.82], w, [1, 0, 0], { glow, flow: r + 0.5 });
      b.line([half * 0.82, y, -half - 0.001], [-half * 0.82, y, -half - 0.001], w, [0, 0, -1], { glow, flow: r + 1 });
      b.line([-half - 0.001, y, -half * 0.82], [-half - 0.001, y, half * 0.82], w, [-1, 0, 0], { glow, flow: r + 1.5 });
    }
  };
  /** A seam of light up each corner of a square tier. */
  const seams = (b: MeshBuilder, y0: number, y1: number, half: number, width = 0.02) => {
    for (const [ox, oz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const)
      b.line([ox * (half + 0.004), y0, oz * (half + 0.004)], [ox * (half + 0.004), y1, oz * (half + 0.004)], width, [ox, 0, oz], { glow: 0.9 });
  };

  // A spire: four tiers, each set back from the one below, and a needle with a beacon.
  const spire = new MeshBuilder().at();
  const tiers: [number, number, number][] = [[0.5, 0, 0.36], [0.39, 0.37, 0.62], [0.27, 0.63, 0.8], [0.14, 0.81, 0.9]];
  for (const [half, y0, y1] of tiers) {
    spire.box([half * 2, y1 - y0, half * 2], [0, (y0 + y1) / 2, 0], dark);
    spire.box([half * 2 + 0.03, 0.008, half * 2 + 0.03], [0, y1 - 0.004, 0], { glow: 0.6 });
    windows(spire, y0 + 0.02, y1 - 0.03, half, Math.max(2, Math.round((y1 - y0) * 22)));
    seams(spire, y0, y1, half);
  }
  spire.lathe([[0.03, 0.9], [0.012, 0.985]], [0, 0, 0], 4, () => ({ shade: 1.4 }));
  spire.box([0.04, 0.012, 0.04], [0, 0.992, 0], { glow: 1 });

  // A blade: a thin slab with its top cut on a slant, lit along the cut and down its faces.
  const blade = new MeshBuilder().at();
  const [bx, bz, lo, hi] = [0.2, 0.46, 0.8, 1];
  blade.quad([-bx, 0, bz], [bx, 0, bz], [bx, lo, bz], [-bx, lo, bz], {}, [0, 0, 1]);
  blade.quad([-bx, 0, -bz], [bx, 0, -bz], [bx, hi, -bz], [-bx, hi, -bz], {}, [0, 0, -1]);
  for (const sx of [-1, 1]) blade.quad([sx * bx, 0, -bz], [sx * bx, 0, bz], [sx * bx, lo, bz], [sx * bx, hi, -bz], { shade: 1.15 }, [sx, 0, 0]);
  blade.quad([-bx, lo, bz], [bx, lo, bz], [bx, hi, -bz], [-bx, hi, -bz], { glow: 0.5 }, [0, 1, 0.3]);
  for (const sx of [-1, 1]) {
    for (const z of [-0.3, -0.1, 0.1, 0.3]) blade.line([sx * (bx + 0.002), 0.03, z], [sx * (bx + 0.002), lo + (hi - lo) * (0.5 - z / (bz * 2)) - 0.03, z], 0.018, [sx, 0, 0], { glow: 0.55 });
    blade.box([0.05, 0.9 * lo, 0.12], [sx * (bx + 0.025), 0.45 * lo, 0], dark);
  }
  blade.line([0, 0.03, bz + 0.002], [0, lo - 0.02, bz + 0.002], 0.03, [0, 0, 1], { glow: 0.9 });
  blade.line([0, 0.03, -bz - 0.002], [0, hi - 0.02, -bz - 0.002], 0.03, [0, 0, -1], { glow: 0.9 });

  // Two towers of different heights, joined by bridges.
  const twin = new MeshBuilder().at();
  for (const [x, top] of [[-0.3, 1], [0.3, 0.74]] as const) {
    twin.box([0.38, top - 0.06, 0.8], [x, (top - 0.06) / 2, 0], dark);
    twin.box([0.3, 0.06, 0.6], [x, top - 0.03, 0], dark);
    twin.box([0.32, 0.008, 0.62], [x, top - 0.062, 0], { glow: 0.7 });
    for (const z of [0.401, -0.401]) twin.line([x, 0.03, z], [x, top - 0.08, z], 0.03, [0, 0, z], { glow: 0.9 });
    for (let r = 0; r < Math.round(top * 14); r++) {
      const y = 0.05 + (r / Math.round(top * 14)) * (top - 0.14);
      for (const sx of [-1, 1]) twin.line([x + sx * 0.191, y, -0.33], [x + sx * 0.191, y, 0.33], 0.014, [sx, 0, 0], { glow: 0.3, flow: r });
    }
  }
  for (const y of [0.34, 0.6]) {
    twin.box([0.24, 0.03, 0.14], [0, y, 0], dark);
    twin.line([-0.11, y - 0.016, 0], [0.11, y - 0.016, 0], 0.05, [0, -1, 0], { glow: 0.8 });
  }

  // A stack: a six-sided shaft with decks standing out from it, each lit at its rim.
  const stack = new MeshBuilder().at();
  const shaft: P2[] = [[0.36, 0]];
  const decks = 6;
  for (let i = 0; i < decks; i++) {
    const y = 0.1 + (i / decks) * 0.78;
    const r = 0.36 - i * 0.03;
    shaft.push([r, y], [r + 0.14, y + 0.012], [r + 0.14, y + 0.03], [r - 0.03, y + 0.045]);
  }
  shaft.push([0.15, 0.9], [0.05, 0.93], [0.012, 1]);
  stack.lathe(shaft, [0, 0, 0], 6, (row) => (row > 0 && (row - 1) % 4 === 1 && row < decks * 4 ? { glow: 0.3 } : (row - 1) % 4 === 0 ? { shade: 0.7 } : {}));
  stack.box([0.03, 0.012, 0.03], [0, 1, 0], { glow: 1 });

  // The great arch: the doorway's moulding swept round a circle that sinks into the ground.
  const arch = new MeshBuilder().at();
  const moulding = mouldingProfile(0.03, 0.045, 0.012, 0.008, 0.008);
  const turns = 64;
  const frames: Frame[] = [];
  for (let i = 0; i < turns; i++) {
    const a = Math.PI * 2 - (i / turns) * Math.PI * 2;
    frames.push({ p: [Math.cos(a) * 0.5, 0.36 + Math.sin(a) * 0.5, 0], x: [Math.cos(a), Math.sin(a), 0], y: [0, 0, 1], t: i * 0.6 });
  }
  arch.sweep(moulding, frames, mouldingPaint, { loop: true });
  return { towers: [spire, blade, twin, stack], arch };
}

export function createEnvironment(accent: THREE.ColorRepresentation, opts: EnvironmentOptions = {}): Environment {
  const group = new THREE.Group();
  group.name = "environment";
  const glow = new THREE.Color(accent);
  const ground = new THREE.Color(opts.ground ?? GROUND);
  const clear = opts.clear ?? 14;
  const seed = opts.seed ?? Math.round((glow.r * 7 + glow.g * 13 + glow.b * 29 + ground.r * 31) * 1000);
  const ticking: THREE.ShaderMaterial[] = [];

  const plan = planSky(seed);
  const sky = createSky(glow, ground, seed, plan);
  const floor = createGround(glow, ground);
  ticking.push(sky.material as THREE.ShaderMaterial, floor.material as THREE.ShaderMaterial);
  group.add(sky, floor);
  if (opts.constellations !== false) {
    const figures = createConstellations(glow, seed, plan);
    for (const o of figures.children) ticking.push((o as THREE.Points).material as THREE.ShaderMaterial);
    group.add(figures);
  }

  // The skyline: low buildings well back from the middle, tall ones far off,
  // and a few great arches beyond them. A skyline to stand in front of, not
  // walls to stand between.
  if (opts.skyline !== false) {
    const rand = seeded(20261117 + seed);
    const alloy = createAlloy(glow, { ground, gloss: 0.6, speed: 0.25, reach: 5 });
    ticking.push(alloy);
    const shapes = skylineShapes();
    const each = shapes.towers.map(() => [] as THREE.Matrix4[]);
    const snap = (n: number) => Math.round(n / 2) * 2;
    const up = new THREE.Vector3(0, 1, 0);
    const place = (out: number, w: number, h: number) => {
      const angle = rand() * Math.PI * 2;
      const kind = Math.floor(rand() * shapes.towers.length);
      each[kind]!.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(snap(Math.sin(angle) * out), 0, snap(Math.cos(angle) * out)),
          new THREE.Quaternion().setFromAxisAngle(up, Math.floor(rand() * 4) * (Math.PI / 2)),
          new THREE.Vector3(w, h, w),
        ),
      );
    };
    for (let i = 0; i < 24; i++) place(clear + 72 + rand() * 50, 7 + rand() * 6, 9 + rand() * rand() * 22);
    for (let i = 0; i < 60; i++) place(clear + 125 + rand() * 170, 11 + rand() * 9, 26 + rand() * rand() * 96);
    shapes.towers.forEach((shape, k) => {
      const towers = new THREE.InstancedMesh(shape.geometry(), alloy, each[k]!.length);
      each[k]!.forEach((m, i) => towers.setMatrixAt(i, m));
      towers.instanceMatrix.needsUpdate = true;
      towers.frustumCulled = false; // they ring the whole horizon
      group.add(towers);
    });
    // The arches face the middle, so a visitor looks through them.
    const ARCHES = 3;
    const arches = new THREE.InstancedMesh(shapes.arch.geometry(), alloy, ARCHES);
    const turn = rand() * Math.PI * 2;
    for (let i = 0; i < ARCHES; i++) {
      const angle = turn + (i / ARCHES) * Math.PI * 2 + (rand() - 0.5) * 0.7;
      const out = clear + 200 + rand() * 90;
      const size = 110 + rand() * 70;
      arches.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(angle) * out, 0, Math.cos(angle) * out), new THREE.Quaternion().setFromAxisAngle(up, angle), new THREE.Vector3(size, size, size)));
    }
    arches.instanceMatrix.needsUpdate = true;
    arches.frustumCulled = false;
    group.add(arches);
  }

  // Dust in the air: a few hundred points of light, slow, near the middle.
  if (opts.dust !== false) {
    const rand = seeded(7 + seed);
    const N = 320;
    const at = new Float32Array(N * 3);
    const phase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2;
      const r = 2 + rand() * 30;
      at.set([Math.cos(a) * r, 0.2 + rand() * rand() * 8, Math.sin(a) * r], i * 3);
      phase[i] = rand();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(at, 3));
    geometry.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    const dust = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uAccent: { value: glow }, uTime: { value: 0 }, uPixels: { value: 1 } },
        vertexShader: `attribute float phase; uniform float uTime; uniform float uPixels; varying float vFade;
          void main(){
            vec3 p = position;
            p.y += sin(uTime * 0.25 + phase * 40.0) * 0.35;
            p.x += sin(uTime * 0.11 + phase * 17.0) * 0.5;
            p.z += cos(uTime * 0.09 + phase * 29.0) * 0.5;
            vec4 v = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * v;
            // Small and sharp: a mote, never a blur across the view.
            gl_PointSize = clamp((1.5 + phase * 2.5) * (9.0 / max(-v.z, 1.0)), 1.5, 7.0) * uPixels;
            vFade = (0.2 + 0.8 * (0.5 + 0.5 * sin(uTime * 0.6 + phase * 80.0))) * smoothstep(44.0, 14.0, -v.z) * smoothstep(0.6, 2.2, -v.z);
          }`,
        fragmentShader: `uniform vec3 uAccent; varying float vFade;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            gl_FragColor = vec4(mix(uAccent, vec3(1.0), 0.4), (smoothstep(0.22, 0.08, d) + smoothstep(0.5, 0.0, d) * 0.3) * vFade * 0.6);
            #include <colorspace_fragment>
          }`,
      }),
    );
    dust.frustumCulled = false;
    dust.onBeforeRender = (renderer) => {
      (dust.material as THREE.ShaderMaterial).uniforms.uPixels!.value = renderer.getPixelRatio();
    };
    ticking.push(dust.material as THREE.ShaderMaterial);
    group.add(dust);
  }

  return {
    group,
    update(t) {
      for (const m of ticking) m.uniforms.uTime!.value = t;
    },
  };
}
