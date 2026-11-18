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
  /** Show a preview of the destination through the portal (spec §5.8). */
  showThrough(pano: THREE.Texture): void;
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
  /** Add a soft overall light and a key light. Default true. */
  lights?: boolean;
}

export interface Home {
  group: THREE.Group;
  /** The home's doors, in layout order. */
  portals: PortalGate[];
  /** Placements this renderer doesn't draw (published items), shown as markers. */
  markers: number;
  update(t: number, dt: number): void;
}

const mat = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

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

function buildRoom(layout: Layout, group: THREE.Group): void {
  const base = new THREE.Color(layout.room.color);
  const accent = new THREE.Color(layout.room.accent);
  const floorColor = base.clone().lerp(new THREE.Color(0xffffff), 0.06);
  if (layout.room.template === "open") {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(24, 72), mat(floorColor, { roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    const edge = new THREE.Mesh(new THREE.RingGeometry(11.9, 12, 96), new THREE.MeshBasicMaterial({ color: accent }));
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.01;
    group.add(floor, edge);
    return;
  }
  // "hall": a floor and three walls, open towards the visitor.
  const W = 16;
  const D = 14;
  const H = 4.5;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(floorColor, { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -D / 2 + 5; // the origin sits 5 m in from the open side
  const wallMat = mat(base.clone().lerp(new THREE.Color(0xffffff), 0.1).lerp(accent, 0.05));
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.2), wallMat);
  back.position.set(0, H / 2, floor.position.z - D / 2);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, H, D), wallMat);
  left.position.set(-W / 2, H / 2, floor.position.z);
  const right = left.clone();
  right.position.x = W / 2;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, 0.04), new THREE.MeshBasicMaterial({ color: accent }));
  strip.position.set(0, 0.03, back.position.z + 0.13);
  group.add(floor, back, left, right, strip);
}

function buildItem(p: Placement, accent: THREE.Color, opts: HomeOptions, portals: PortalGate[], lamps: { n: number }): THREE.Object3D | null {
  const g = new THREE.Group();
  const textColor = opts.textColor ?? "#f2f3f6";
  if (p.source === "published") {
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 0.5, 0.5)), new THREE.LineBasicMaterial({ color: accent }));
    box.position.y = 0.25;
    g.add(box);
    return g;
  }
  switch (p.type) {
    case "frame": {
      const W = 1.2;
      const H = 0.9;
      const border = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, H + 0.1, 0.04), mat(0xf2f3f6));
      const picture = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat(0x2a2e37));
      picture.position.z = 0.025;
      g.add(border, picture);
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
      const sign = textSprite(wrapText(p.args[0]!, 30), textColor, 2.2);
      g.add(sign);
      return g;
    }
    case "plant": {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.34, 20), mat(0x8a6f5a));
      pot.position.y = 0.17;
      g.add(pot);
      const leaf = mat(0x3f8f5a, { flatShading: true });
      for (const [x, y, z, s] of [[0, 0.7, 0, 0.36], [0.18, 0.5, 0.08, 0.24], [-0.16, 0.55, -0.1, 0.26]] as const) {
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), leaf);
        blob.position.set(x, y, z);
        g.add(blob);
      }
      return g;
    }
    case "lamp": {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.5, 12), mat(0x8b91a0, { metalness: 0.4 }));
      pole.position.y = 0.75;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: accent, emissiveIntensity: 2 }));
      bulb.position.y = 1.6;
      g.add(pole, bulb);
      // Real lights are costly on a headset, so only the first few lamps cast any.
      if (lamps.n++ < 4) {
        const light = new THREE.PointLight(accent, 6, 9, 1.6);
        light.position.y = 1.6;
        g.add(light);
      }
      return g;
    }
    case "bench": {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.45), mat(0xc9b08a));
      seat.position.y = 0.45;
      // The back is on the far side, so someone sitting faces +Z like everything else.
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.34, 0.06), mat(0xc9b08a));
      back.position.set(0, 0.74, -0.2);
      g.add(seat, back);
      for (const x of [-0.6, 0.6]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.4), mat(0x3a3f4a));
        leg.position.set(x, 0.21, 0);
        g.add(leg);
      }
      return g;
    }
    case "table": {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.7), mat(0xc9b08a));
      top.position.y = 0.74;
      g.add(top);
      for (const [x, z] of [[-0.52, -0.28], [0.52, -0.28], [-0.52, 0.28], [0.52, 0.28]] as const) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.71, 0.06), mat(0x3a3f4a));
        leg.position.set(x, 0.355, z);
        g.add(leg);
      }
      return g;
    }
    case "plinth": {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), mat(0xe0e1dd, { roughness: 0.6 }));
      block.position.y = 0.5;
      g.add(block);
      return g;
    }
    default:
      return null;
  }
}

/** Draw a home layout. Positions are metres from the home's origin, which is where the returned group sits. */
export function createHome(layout: Layout, opts: HomeOptions = {}): Home {
  const group = new THREE.Group();
  group.name = `home:${layout.d}`;
  const accent = new THREE.Color(layout.room.accent);
  if (opts.lights !== false) {
    group.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(layout.room.color), 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(3, 9, 5);
    group.add(key);
  }
  buildRoom(layout, group);
  const portals: PortalGate[] = [];
  const lamps = { n: 0 };
  let markers = 0;
  for (const p of layout.items) {
    const object = buildItem(p, accent, opts, portals, lamps);
    if (!object) continue;
    if (p.source === "published") markers++;
    object.position.set(...p.position);
    object.rotation.y = THREE.MathUtils.degToRad(p.rotation);
    group.add(object);
  }
  return {
    group,
    portals,
    markers,
    update(t, dt) {
      for (const gate of portals) gate.update(t, dt);
    },
  };
}
