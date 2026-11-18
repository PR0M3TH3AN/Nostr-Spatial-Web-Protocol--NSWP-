/**
 * nswp-sdk/home — draws a home layout (spec §4.5) with Three.js, and the
 * standard portal that homes and worlds both use.
 *
 *   import { createHome } from "nswp-sdk/home";
 *   const home = createHome(layout);
 *   scene.add(home.group);
 *   // each frame: home.update(t, dt)
 *   // home.portals are the doors: send a visitor through with portal.go(p.destination)
 *
 * This is one renderer. A layout is data, so any other renderer can draw the
 * same home differently. Only the built-in catalogue is drawn here; a
 * published item (§10.4) appears as a marker of its place.
 */
import * as THREE from "three";
import { checkDestination, checkPictureBytes, encodeNaddr, LAYOUT_LIMITS, portalTarget, WORLD_KIND, type Layout, type Placement, type PortalDestination } from "@nswp/core";
import { BLOCK, createBlocks, type Blocks } from "./blocks.js";
import { createEnvironment } from "./environment.js";
import { createPortalWindow, textSprite } from "./three.js";

export interface PortalGateOptions {
  /** First line of the sign above the portal. The address is always shown beneath it. */
  label?: string;
  color?: THREE.ColorRepresentation;
  textColor?: string;
}

export interface PortalGate {
  /** Place and turn this. The doorway stands on the floor at the group's origin and faces its local +Z. */
  group: THREE.Group;
  /** The surface to aim at: test rays against this. */
  target: THREE.Mesh;
  destination: PortalDestination;
  /** 1 while a visitor is aiming at the portal, 0 otherwise. The glow follows it. */
  aimed: number;
  setLabel(label: string): void;
  /** Show a preview of the destination through the portal (spec §5.8). Returns the window, for a world that needs to hide it while it photographs itself. */
  showThrough(pano: THREE.Texture): THREE.Mesh;
  update(t: number, dt: number): void;
}

/** Where a destination leads, as a visitor should read it: the registrable domain, never a name alone. */
function addressLine(dest: PortalDestination): string {
  if (!dest.url) return "A world on Nostr";
  const chk = checkDestination(dest.url);
  return chk.ok ? (chk.value.registrableDomain ?? chk.value.hostname) : "invalid address";
}

/** The standard doorway's size, in metres. */
export const PORTAL_WIDTH = 1.5;
export const PORTAL_HEIGHT = 2.1;
/** Where the doorway's straight sides end and its round top begins. */
const SPRING = PORTAL_HEIGHT - PORTAL_WIDTH / 2;

let archMask: THREE.Texture | null = null;
/** The doorway's outline as a cut-out, for a preview to be seen through. */
function archMaskTexture(): THREE.Texture {
  if (archMask) return archMask;
  const canvas = document.createElement("canvas");
  canvas.width = 500;
  canvas.height = 700;
  const g = canvas.getContext("2d")!;
  const k = canvas.height / PORTAL_HEIGHT; // pixels per metre
  const inset = 0.045 * k; // the frame stays in front of the preview
  g.beginPath();
  g.moveTo(inset, canvas.height);
  g.lineTo(inset, canvas.height - SPRING * k);
  g.arc(canvas.width / 2, canvas.height - SPRING * k, canvas.width / 2 - inset, Math.PI, 0);
  g.lineTo(canvas.width - inset, canvas.height);
  g.closePath();
  g.fillStyle = "#ffffff";
  g.fill();
  archMask = new THREE.CanvasTexture(canvas);
  return archMask;
}

/**
 * The standard portal: an arched doorway standing on the floor, with a sign
 * above it saying where it leads. It is the same shape wherever a visitor
 * meets one, so a way out is always recognisable.
 */
export function createPortalGate(destination: PortalDestination, opts: PortalGateOptions = {}): PortalGate {
  const color = new THREE.Color(opts.color ?? 0x4cc9f0);
  const textColor = opts.textColor ?? "#f2f3f6";
  const group = new THREE.Group();
  // One unlit surface draws the doorway: its outline, and a quiet view through
  // it for when there is no preview. Unlit, so it shows in a dark scene too.
  const surface = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: color }, uAim: { value: 0 }, uSize: { value: new THREE.Vector2(PORTAL_WIDTH, PORTAL_HEIGHT) }, uSpring: { value: SPRING } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uAim; uniform vec2 uSize; uniform float uSpring; varying vec2 vUv;
      void main(){
        vec2 p = vec2((vUv.x - 0.5) * uSize.x, vUv.y * uSize.y);
        float half_ = uSize.x * 0.5;
        float d = p.y < uSpring ? half_ - abs(p.x) : half_ - length(p - vec2(0.0, uSpring));
        if (d < 0.0) discard;
        float horizon = uSize.y * 0.34;
        vec3 dusk = uColor * 0.10 + vec3(0.015, 0.015, 0.04);
        vec3 sky = mix(uColor * 0.62 + vec3(0.06), dusk, smoothstep(horizon, uSize.y, p.y));
        vec2 sun = vec2(0.12 * sin(uTime * 0.25), horizon + 0.42);
        float glow = exp(-5.0 * length(p - sun));
        sky += (uColor * 0.7 + vec3(0.35)) * glow;
        vec3 ground = uColor * 0.07 + vec3(0.02);
        float path = 1.0 - smoothstep(0.0, 0.03, abs(p.x) - (0.06 + (horizon - p.y) * 0.5));
        ground += uColor * 0.22 * path;
        vec3 view = (p.y > horizon ? sky : ground) * (1.0 + uAim * 0.35);
        float frame = 1.0 - smoothstep(0.04, 0.05, d);
        gl_FragColor = vec4(mix(view, mix(vec3(0.95, 0.955, 0.965), uColor, uAim), frame), 1.0);
      }`,
  });
  const plane = new THREE.PlaneGeometry(PORTAL_WIDTH, PORTAL_HEIGHT);
  const target = new THREE.Mesh(plane, surface);
  target.name = "portal";
  target.position.y = PORTAL_HEIGHT / 2;
  const sill = new THREE.Mesh(new THREE.BoxGeometry(PORTAL_WIDTH + 0.1, 0.06, 0.24), new THREE.MeshBasicMaterial({ color: 0xf2f3f6 }));
  sill.position.y = 0.03;
  group.add(target, sill);

  let sign: THREE.Sprite | null = null;
  const setLabel = (label: string) => {
    if (sign) {
      group.remove(sign);
      sign.material.map?.dispose();
      sign.material.dispose();
    }
    sign = textSprite(`${label}\n${addressLine(destination)}`, textColor, 2.2);
    sign.position.set(0, PORTAL_HEIGHT + 0.45, 0);
    group.add(sign);
  };
  setLabel(opts.label ?? "Portal");

  const gate: PortalGate = {
    group,
    target,
    destination,
    aimed: 0,
    setLabel,
    showThrough(pano) {
      const through = createPortalWindow(plane, pano, { mask: archMaskTexture() });
      through.position.z = 0.004; // just in front of the surface, which stays as the frame, the fallback and the target
      target.add(through);
      return through;
    },
    update(t, dt) {
      surface.uniforms.uTime!.value = t;
      const glow = surface.uniforms.uAim!;
      glow.value += (gate.aimed - (glow.value as number)) * Math.min(1, dt * 12);
    },
  };
  return gate;
}

export interface HomeOptions {
  textColor?: string;
  /** Relay hints written into portal destinations, so an Airlock can find the worlds. */
  relays?: string[];
  /** Add a soft overall light and a key light, for things of your own that need them. The home's own blocks don't. Default true. */
  lights?: boolean;
  /** Draw the ground: the grid to the horizon and the skyline. Default true. Pass false to stand the home on a ground of your own. */
  environment?: boolean;
}

export interface Home {
  group: THREE.Group;
  /** The home's doors, in layout order. */
  portals: PortalGate[];
  /** Placements this renderer doesn't draw (published items), shown as markers. */
  markers: number;
  update(t: number, dt: number): void;
}

function wrapText(text: string, perLine: number): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > perLine) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.slice(0, 8).join("\n");
}

/** Fetch a frame's picture, check it against its hash, and put it on the frame. A failure leaves the frame blank. */
async function hangPicture(url: string, sha256: string, picture: THREE.Mesh, maxW: number, maxH: number): Promise<void> {
  try {
    const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
    if (!res.ok || Number(res.headers.get("content-length") ?? "0") > LAYOUT_LIMITS.pictureBytes) return;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!checkPictureBytes(sha256, bytes)) return;
    const image = new Image();
    image.src = URL.createObjectURL(new Blob([bytes]));
    await image.decode();
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    const fit = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight);
    picture.scale.set((image.naturalWidth * fit) / maxW, (image.naturalHeight * fit) / maxH, 1);
    picture.material = new THREE.MeshBasicMaterial({ map: texture });
  } catch {
    /* the frame stays blank */
  }
}

/** The room's walls. The floor is the environment's grid. */
function buildRoom(layout: Layout, blocks: Blocks, group: THREE.Group): void {
  const accent = new THREE.Color(layout.room.accent);
  const wall = new THREE.Color(layout.room.color).lerp(new THREE.Color(0xffffff), 0.05);
  blocks.at([0, 0, 0]);
  if (layout.room.template === "open") {
    // A ring of light on the floor, marking the middle of an open place.
    const edge = new THREE.Mesh(new THREE.RingGeometry(11.94, 12, 96), new THREE.MeshBasicMaterial({ color: accent }));
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.012;
    group.add(edge);
    return;
  }
  // "hall": three walls, open towards the visitor. The origin sits 5 m in from the open side.
  const W = 16;
  const D = 14;
  const H = 4.5;
  const mid = -D / 2 + 5;
  blocks.box([W + 0.4, H, 0.2], [0, H / 2, mid - D / 2 - 0.1], { color: wall });
  blocks.box([0.2, H, D], [-W / 2 - 0.1, H / 2, mid], { color: wall });
  blocks.box([0.2, H, D], [W / 2 + 0.1, H / 2, mid], { color: wall });
  // A line of light where the back wall meets the floor.
  const strip = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, 0.04), new THREE.MeshBasicMaterial({ color: accent }));
  strip.position.set(0, 0.03, mid - D / 2 + 0.03);
  group.add(strip);
}

/**
 * One built-in item, as blocks. Sizes are on a tenth-of-a-metre lattice, so
 * everything in a home reads as made of the same stuff. Things that aren't
 * blocks (a picture, a sign, a doorway, a lamp's pool of light) are returned
 * as an object to place.
 */
function buildItem(p: Placement, layout: Layout, blocks: Blocks, opts: HomeOptions, portals: PortalGate[]): THREE.Object3D | null {
  const accent = new THREE.Color(layout.room.accent);
  const textColor = opts.textColor ?? "#f2f3f6";
  const g = new THREE.Group();
  blocks.at(p.position, p.rotation);
  if (p.source === "published") {
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 0.5, 0.5)), new THREE.LineBasicMaterial({ color: accent }));
    box.position.y = 0.25;
    g.add(box);
    return g;
  }
  // A leaf, a cushion, a tabletop: the room's accent, turned well down.
  const soft = new THREE.Color(BLOCK).lerp(accent, 0.28);
  switch (p.type) {
    case "frame": {
      const W = 1.2;
      const H = 0.9;
      blocks.box([W + 0.1, H + 0.1, 0.05], [0, 0, 0]);
      const picture = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x121c26 }));
      picture.position.z = 0.03;
      g.add(picture);
      void hangPicture(p.args[0]!, p.args[1]!, picture, W, H);
      return g;
    }
    case "portal": {
      const target = portalTarget(p.args[0]);
      if (!target) return null;
      const destination: PortalDestination =
        "url" in target ? { url: target.url } : { naddr: encodeNaddr({ kind: WORLD_KIND, pubkey: target.pubkey, identifier: target.d, relays: (opts.relays ?? []).slice(0, 2) }) };
      const gate = createPortalGate(destination, { label: p.args[1] || ("url" in target ? "Portal" : target.d), color: accent, textColor });
      g.add(gate.group);
      portals.push(gate);
      return g;
    }
    case "note": {
      g.add(textSprite(wrapText(p.args[0]!, 30), textColor, 2.2));
      return g;
    }
    case "plant": {
      blocks.box([0.4, 0.3, 0.4], [0, 0.15, 0]);
      blocks.box([0.5, 0.5, 0.5], [0, 0.6, 0], { color: soft });
      blocks.box([0.3, 0.3, 0.3], [0.2, 0.95, 0.1], { color: soft });
      blocks.box([0.3, 0.3, 0.3], [-0.15, 1.0, -0.1], { color: soft });
      blocks.box([0.2, 0.2, 0.2], [0.05, 1.25, 0], { color: accent, lit: true });
      return null;
    }
    case "lamp": {
      blocks.box([0.3, 0.1, 0.3], [0, 0.05, 0]);
      blocks.box([0.1, 1.4, 0.1], [0, 0.8, 0]);
      blocks.box([0.3, 0.3, 0.3], [0, 1.65, 0], { color: accent, lit: true });
      // Nothing here is lit by lights, so a lamp's light is drawn: a pool of it on the floor.
      const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.1, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.014;
      g.add(pool);
      return g;
    }
    case "bench": {
      blocks.box([1.4, 0.1, 0.5], [0, 0.45, 0], { color: soft });
      // The back is on the far side, so someone sitting faces +Z like everything else.
      blocks.box([1.4, 0.4, 0.1], [0, 0.7, -0.2]);
      blocks.box([0.1, 0.4, 0.4], [-0.6, 0.2, 0]);
      blocks.box([0.1, 0.4, 0.4], [0.6, 0.2, 0]);
      return null;
    }
    case "table": {
      blocks.box([1.2, 0.1, 0.7], [0, 0.7, 0], { color: soft });
      for (const [x, z] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]] as const) blocks.box([0.1, 0.65, 0.1], [x, 0.325, z]);
      return null;
    }
    case "plinth": {
      blocks.box([0.6, 1, 0.6], [0, 0.5, 0]);
      return null;
    }
    default:
      return null;
  }
}

/**
 * Draw a home layout. Positions are metres from the home's origin, which is
 * where the returned group sits. The home stands on the grid, and everything
 * built in is made of blocks: dark, with edges lit in the room's accent.
 */
export function createHome(layout: Layout, opts: HomeOptions = {}): Home {
  const group = new THREE.Group();
  group.name = `home:${layout.d}`;
  if (opts.lights !== false) {
    group.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(layout.room.color), 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(3, 9, 5);
    group.add(key);
  }
  const environment = opts.environment === false ? null : createEnvironment(layout.room.accent, { ground: layout.room.color });
  if (environment) group.add(environment.group);
  const blocks = createBlocks(layout.room.accent);
  buildRoom(layout, blocks, group);
  const portals: PortalGate[] = [];
  let markers = 0;
  for (const p of layout.items) {
    const object = buildItem(p, layout, blocks, opts, portals);
    if (p.source === "published") markers++;
    if (!object) continue;
    object.position.set(...p.position);
    object.rotation.y = THREE.MathUtils.degToRad(p.rotation);
    group.add(object);
  }
  if (blocks.count > 0) group.add(blocks.build());
  return {
    group,
    portals,
    markers,
    update(t, dt) {
      environment?.update(t);
      for (const gate of portals) gate.update(t, dt);
    },
  };
}

export { createEnvironment, GROUND, type Environment, type EnvironmentOptions } from "./environment.js";
export { createBlocks, BLOCK, type Blocks, type BlockOptions } from "./blocks.js";
