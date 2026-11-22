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
import { categoryWords, itemsWords, checkDestination, checkPictureBytes, encodeNaddr, LAYOUT_LIMITS, portalTarget, WORLD_KIND, type Layout, type Placement, type PortalDestination } from "@nswp/core";
import { createAlloy, type Alloy } from "./alloy.js";
import { createEnvironment } from "./environment.js";
import { MeshBuilder } from "./mesh.js";
import { PORTAL_SIGN_HEIGHT, PORTAL_SPRING as SPRING } from "./gate-size.js";
import { addArchFrame, addBench, addLamp, addPictureFrame, addPlant, addPlinth, addTable, addWall, metalTone, PORTAL_HEIGHT, PORTAL_WIDTH } from "./models.js";
import { createPortalWindow, textSprite } from "./three.js";
import { createDoorOffers, type DoorOffers } from "./door-offers.js";
import type { Offer } from "@nswp/core";

export interface PortalGateOptions {
  /** First line of the sign above the portal. The address is always shown beneath it. */
  label?: string;
  /**
   * What kind of place it leads to, as that place's own announcement says: one of the core's `CATEGORIES`. The
   * sign then reads "A game at example.com". Left out, or anything else, and the sign says only the address.
   */
  category?: string | null;
  color?: THREE.ColorRepresentation;
  textColor?: string;
  /**
   * What the place it leads to offers, as that place's own announcement says: the core's `worldOffers`. The door
   * shows the eight a door shows, lit and dark, beside its frame. Left out, the door shows none: nothing is known.
   */
  offers?: readonly Offer[];
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
  /** Say what kind of place it leads to, on the sign: one of the core's `CATEGORIES`. Anything else says nothing. */
  setCategory(category: string | null | undefined): void;
  /**
   * Say what the people this visitor has reason to trust thought of the place, under the address: "★ 4.5 from 3"
   * (protocol/13-ratings.md). "" says nothing, which is what a door says when nobody they know has rated it.
   */
  setRating(mark: string): void;
  /**
   * Say on the sign what the place does with the things visitors carry, as its own announcement says
   * (protocol/17-items.md): "Items are part of play here", or "No items here". A visitor is told before they go in.
   * `allowed`, and a place that said nothing, says nothing: it is the ordinary rule.
   */
  setItems(rule: string | null | undefined): void;
  /**
   * The tiles beside the door that say what its world offers (door-offers.ts). Test rays against `offers.targets`,
   * ask `offers.offerOf` what a pointed-at tile means, and tell it with `offers.point` which one is pointed at.
   */
  offers: DoorOffers;
  /** Say what the place offers, when it is learned or changes: the core's `worldOffers`. */
  setOffers(offers: readonly Offer[]): void;
  /** Show a preview of the destination through the portal (spec §5.8). Returns the window, for a world that needs to hide it while it photographs itself. */
  showThrough(pano: THREE.Texture): THREE.Mesh;
  update(t: number, dt: number): void;
}

/**
 * Where a destination leads, as a visitor should read it: the registrable domain, never a name alone. With what
 * kind of place it is, when the door was told: "A game at example.com".
 */
function addressLine(dest: PortalDestination, category?: string | null): string {
  const kind = categoryWords(category);
  if (!dest.url) return kind ? `${kind} on Nostr` : "A world on Nostr";
  const chk = checkDestination(dest.url);
  if (!chk.ok) return "invalid address";
  const at = chk.value.registrableDomain ?? chk.value.hostname;
  return kind ? `${kind} at ${at}` : at;
}


let archMask: THREE.Texture | null = null;
/** The doorway's opening as a cut-out, for a preview to be seen through. */
function archMaskTexture(): THREE.Texture {
  if (archMask) return archMask;
  const canvas = document.createElement("canvas");
  canvas.width = 500;
  canvas.height = 700;
  const g = canvas.getContext("2d")!;
  const k = canvas.height / PORTAL_HEIGHT; // pixels per metre
  g.beginPath();
  g.moveTo(0, canvas.height);
  g.lineTo(0, canvas.height - SPRING * k);
  g.arc(canvas.width / 2, canvas.height - SPRING * k, canvas.width / 2, Math.PI, 0);
  g.lineTo(canvas.width, canvas.height);
  g.closePath();
  g.fillStyle = "#ffffff";
  g.fill();
  archMask = new THREE.CanvasTexture(canvas);
  return archMask;
}

let frameGeometry: THREE.BufferGeometry | null = null;
/** The doorway's modelled frame, built once and shared by every doorway. Draw it in alloy (alloy.ts). */
export function archFrameGeometry(): THREE.BufferGeometry {
  if (!frameGeometry) {
    const b = new MeshBuilder().at();
    addArchFrame(b);
    frameGeometry = b.geometry();
  }
  return frameGeometry;
}

/**
 * What fills a doorway when there is no picture of the other side: a field of
 * light, deeper towards the middle, with cells that kindle and fade and a slow
 * band that rises through it. It is also the surface a visitor aims at.
 */
function veilMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: color }, uAim: { value: 0 }, uSize: { value: new THREE.Vector2(PORTAL_WIDTH, PORTAL_HEIGHT) }, uSpring: { value: SPRING } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uAim; uniform vec2 uSize; uniform float uSpring; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // Distance to the nearest edge of a honeycomb, and which cell this is.
      vec3 comb(vec2 p){
        vec2 r = vec2(1.0, 1.7320508);
        vec2 a = mod(p, r) - r * 0.5;
        vec2 b = mod(p - r * 0.5, r) - r * 0.5;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        float edge = 0.5 - max(abs(g.x), dot(abs(g), normalize(r)));
        return vec3(edge, p - g);
      }
      void main(){
        vec2 p = vec2((vUv.x - 0.5) * uSize.x, vUv.y * uSize.y);
        float half_ = uSize.x * 0.5;
        float d = p.y < uSpring ? half_ - abs(p.x) : half_ - length(p - vec2(0.0, uSpring));
        if (d < 0.0) discard;
        vec2 mid = vec2(0.0, uSize.y * 0.52);
        float deep = 1.0 - smoothstep(0.0, 1.15, length((p - mid) * vec2(1.0, 0.72)));
        vec3 c = mix(vec3(0.004, 0.007, 0.012), uColor * 0.2, deep);
        // The honeycomb: faint lines, and a cell here and there lit for a while.
        vec3 h = comb(p * 9.0 + vec2(0.0, uTime * 0.12));
        float cell = hash(h.yz);
        float lit = smoothstep(0.86, 1.0, sin(uTime * (0.35 + cell * 0.6) + cell * 40.0) * 0.5 + 0.5) * step(0.7, cell);
        c += uColor * (smoothstep(0.045, 0.0, h.x) * (0.1 + 0.2 * deep) + lit * 0.32 * smoothstep(0.0, 0.2, h.x));
        // A band of light rising, and the glow at the heart of it.
        float band = smoothstep(0.16, 0.0, abs(fract(p.y * 0.36 - uTime * 0.07) - 0.5) - 0.02);
        c += uColor * band * 0.12;
        c += (uColor * 0.85 + 0.25) * pow(deep, 3.0) * (0.36 + 0.4 * uAim);
        // Darker towards the frame, so it reads as set back into it.
        c *= 0.45 + 0.55 * smoothstep(0.0, 0.22, d);
        c *= 1.0 + uAim * 0.5;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * The light a doorway gives off: a soft glow round its arch and a pool on the
 * floor in front and behind. Drawn, since nothing here is lit by lights.
 */
function gateGlow(color: THREE.Color): { group: THREE.Group; material: THREE.ShaderMaterial } {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: color }, uAim: { value: 0 }, uSpring: { value: SPRING }, uRadius: { value: PORTAL_WIDTH / 2 + 0.09 } },
    vertexShader: "attribute float floor; varying vec2 vAt; varying float vFloor; void main(){ vAt = position.xy; vFloor = floor; vec3 p = floor > 0.5 ? vec3(position.x, 0.014, position.y) : position; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }",
    fragmentShader: `uniform vec3 uColor; uniform float uAim; uniform float uSpring; uniform float uRadius; varying vec2 vAt; varying float vFloor;
      void main(){
        float a;
        if (vFloor > 0.5) {
          // On the floor: brightest under the opening, gone a couple of metres out.
          vec2 q = vAt / vec2(1.7, 2.4);
          a = pow(max(1.0 - dot(q, q), 0.0), 2.0) * 0.2;
        } else {
          float d = vAt.y < uSpring ? abs(abs(vAt.x) - uRadius) : abs(length(vAt - vec2(0.0, uSpring)) - uRadius);
          a = (exp(-d * 5.0) * 0.16 + exp(-d * 18.0) * 0.2) * smoothstep(-0.02, 0.5, vAt.y);
        }
        gl_FragColor = vec4(uColor, a * (0.8 + 0.6 * uAim));
        #include <colorspace_fragment>
      }`,
  });
  const group = new THREE.Group();
  const [w, h] = [PORTAL_WIDTH + 2.6, PORTAL_HEIGHT + 1.7];
  for (const z of [0.125, -0.125]) {
    const sheet = new THREE.PlaneGeometry(w, h);
    sheet.translate(0, h / 2 - 0.2, z);
    sheet.setAttribute("floor", new THREE.Float32BufferAttribute([0, 0, 0, 0], 1));
    group.add(new THREE.Mesh(sheet, material));
  }
  const pool = new THREE.PlaneGeometry(3.4, 4.8);
  pool.setAttribute("floor", new THREE.Float32BufferAttribute([1, 1, 1, 1], 1));
  const onFloor = new THREE.Mesh(pool, material);
  onFloor.frustumCulled = false; // its corners are moved to the floor in the shader
  group.add(onFloor);
  return { group, material };
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
  const alloy = createAlloy(color, { gloss: 0.75 });
  const frame = new THREE.Mesh(archFrameGeometry(), alloy);
  const veil = veilMaterial(color);
  const plane = new THREE.PlaneGeometry(PORTAL_WIDTH, PORTAL_HEIGHT);
  const target = new THREE.Mesh(plane, veil);
  target.name = "portal";
  target.position.y = PORTAL_HEIGHT / 2;
  const glow = gateGlow(color);
  const offers = createDoorOffers(opts.offers ?? [], { color, textColor });
  group.add(frame, target, glow.group, offers.group);

  let sign: THREE.Sprite | null = null;
  let said = opts.label ?? "Portal";
  let category = opts.category ?? null;
  let rating = "";
  let items: string | null = null;
  const setLabel = (label: string) => {
    said = label;
    if (sign) {
      group.remove(sign);
      sign.material.map?.dispose();
      sign.material.dispose();
    }
    sign = textSprite(`${label}\n${addressLine(destination, category)}${rating ? `\n${rating}` : ""}${itemsWords(items) ? `\n${itemsWords(items)}` : ""}`, textColor, 2.2);
    sign.position.set(0, PORTAL_SIGN_HEIGHT, 0);
    group.add(sign);
  };
  setLabel(said);

  let aim = 0;
  const gate: PortalGate = {
    group,
    target,
    destination,
    aimed: 0,
    setLabel,
    offers,
    setOffers(next) {
      offers.set(next);
    },
    setCategory(next) {
      if ((next ?? null) === category) return;
      category = next ?? null;
      setLabel(said);
    },
    setItems(next) {
      if ((next ?? null) === items) return;
      items = next ?? null;
      setLabel(said);
    },
    setRating(mark) {
      // One short line of plain text: a star, a number and a count, whatever it was handed.
      const next = typeof mark === "string" ? mark.replace(/\s+/g, " ").trim().slice(0, 24) : "";
      if (next === rating) return;
      rating = next;
      setLabel(said);
    },
    showThrough(pano) {
      const through = createPortalWindow(plane, pano, { mask: archMaskTexture() });
      through.position.z = 0.004; // just in front of the veil, which stays as the fallback and the target
      target.add(through);
      return through;
    },
    update(t, dt) {
      aim += (gate.aimed - aim) * Math.min(1, dt * 12);
      veil.uniforms.uTime!.value = t;
      veil.uniforms.uAim!.value = aim;
      glow.material.uniforms.uAim!.value = aim;
      alloy.tick(t);
      alloy.aim(aim);
    },
  };
  return gate;
}

export interface HomeOptions {
  textColor?: string;
  /** Relay hints written into portal destinations, so an Airlock can find the worlds. */
  relays?: string[];
  /** Add a soft overall light and a key light, for things of your own that need them. The home's own models don't. Default true. */
  lights?: boolean;
  /** Draw the sky, the ground and the skyline. Default true. Pass false to stand the home in a place of your own. */
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

let haloTexture: THREE.Texture | null = null;
/** A soft round glow, to put round something that gives off light. */
export function createHalo(color: THREE.ColorRepresentation, size: number): THREE.Sprite {
  if (!haloTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const g = canvas.getContext("2d")!;
    const fade = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    fade.addColorStop(0, "rgba(255,255,255,0.9)");
    fade.addColorStop(0.18, "rgba(255,255,255,0.32)");
    fade.addColorStop(0.5, "rgba(255,255,255,0.07)");
    fade.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, 128, 128);
    haloTexture = new THREE.CanvasTexture(canvas);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(size);
  return halo;
}

/** The room's walls. The floor is the environment's ground. */
function buildRoom(layout: Layout, b: MeshBuilder): void {
  if (layout.room.template !== "hall") return;
  // "hall": three walls, open towards the visitor. The origin sits 5 m in from the open side.
  const W = 16;
  const D = 14;
  const H = 4.5;
  const mid = -D / 2 + 5;
  addWall(b.at([0, 0, mid - D / 2 - 0.1]), W + 0.6, H);
  addWall(b.at([-W / 2 - 0.1, 0, mid], 90), D, H);
  addWall(b.at([W / 2 + 0.1, 0, mid], -90), D, H);
}

/**
 * One built-in item, modelled into the home's one mesh. Things that aren't
 * part of that mesh (a picture, a sign, a doorway, a lamp's glow) are returned
 * as an object to place.
 */
function buildItem(p: Placement, layout: Layout, b: MeshBuilder, soft: THREE.Color, opts: HomeOptions, portals: PortalGate[], index: number): THREE.Object3D | null {
  const accent = new THREE.Color(layout.room.accent);
  const textColor = opts.textColor ?? "#f2f3f6";
  const g = new THREE.Group();
  b.at(p.position, p.rotation);
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
      addPictureFrame(b, W, H);
      const picture = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x0d1620 }));
      picture.position.z = 0.012;
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
    case "plant":
      addPlant(b, soft, index + 1);
      return null;
    case "lamp": {
      addLamp(b);
      // Nothing here is lit by lights, so a lamp's light is drawn: a glow round the lantern and a pool on the floor.
      const halo = createHalo(accent, 1.5);
      halo.position.y = 1.64;
      const pool = createHalo(accent, 1);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshBasicMaterial({ map: pool.material.map, color: accent, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.012;
      g.add(halo, disc);
      return g;
    }
    case "bench":
      addBench(b, soft);
      return null;
    case "table":
      addTable(b, soft);
      return null;
    case "plinth":
      addPlinth(b);
      return null;
    default:
      return null;
  }
}

/**
 * Draw a home layout. Positions are metres from the home's origin, which is
 * where the returned group sits. The home stands under its own sky, and
 * everything built in is modelled metal with seams of light in the room's accent.
 */
export function createHome(layout: Layout, opts: HomeOptions = {}): Home {
  const group = new THREE.Group();
  group.name = `home:${layout.d}`;
  const accent = new THREE.Color(layout.room.accent);
  const ground = new THREE.Color(layout.room.color);
  if (opts.lights !== false) {
    group.add(new THREE.HemisphereLight(0xffffff, ground, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(3, 9, 5);
    group.add(key);
  }
  const environment = opts.environment === false ? null : createEnvironment(accent, { ground });
  if (environment) group.add(environment.group);

  const b = new MeshBuilder();
  // What things are made of: a metal a few shades up from the ground. Seats, tabletops and leaves take some of the accent.
  b.tone = metalTone(ground);
  const soft = b.tone.clone().lerp(accent, 0.03);
  buildRoom(layout, b);
  if (layout.room.template === "open") {
    // A ring of light on the floor, marking the middle of an open place.
    const edge = new THREE.Mesh(new THREE.RingGeometry(11.94, 12, 96), new THREE.MeshBasicMaterial({ color: accent }));
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.012;
    group.add(edge);
  }
  const portals: PortalGate[] = [];
  let markers = 0;
  layout.items.forEach((p, i) => {
    const object = buildItem(p, layout, b, soft, opts, portals, i);
    if (p.source === "published") markers++;
    if (!object) return;
    object.position.set(...p.position);
    object.rotation.y = THREE.MathUtils.degToRad(p.rotation);
    group.add(object);
  });
  let alloy: Alloy | null = null;
  if (b.triangles > 0) {
    alloy = createAlloy(accent, { ground, gloss: 0.55 });
    group.add(b.build(alloy));
  }
  return {
    group,
    portals,
    markers,
    update(t, dt) {
      environment?.update(t);
      alloy?.tick(t);
      for (const gate of portals) gate.update(t, dt);
    },
  };
}

export { PORTAL_WIDTH, PORTAL_HEIGHT } from "./models.js";
export { createDoorOffers, doorOfferPlaces, OFFER_COLUMN_X, OFFER_ICONS, OFFER_TILE, type DoorOffers, type DoorOffersOptions } from "./door-offers.js";
export { createEnvironment, GROUND, type Environment, type EnvironmentOptions } from "./environment.js";
export { MeshBuilder, type Paint, type BoxOptions, type Frame, type V3, type P2 } from "./mesh.js";
export { createAlloy, type Alloy, type AlloyOptions } from "./alloy.js";
export { addArchFrame, addBench, addCrystal, addGyro, addHelix, addKnot, addLamp, addPictureFrame, addPlant, addPlinth, addSpiral, addTable, addTree, addWall, bandProfile, loopFrames, metalTone, mouldingPaint, mouldingProfile } from "./models.js";
