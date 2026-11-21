/**
 * What a world offers, drawn beside its door: a column of small tiles, lit
 * for what the world's announcement says and dark for what it doesn't
 * (`worldOffers` in the core; NSWP-01, "What a world offers").
 *
 * One piece for every door there is: the kit's own doorway stands it beside
 * itself (`createPortalGate`), and a client that draws its doors another way
 * adds it to each. So the tiles, their order and their words are the same on
 * every door in every world. The owner, 2026-11-21: "icons that are lit up
 * or dark if not supported. And when the user hovers over one it should
 * display in game text explaining what that icon means."
 *
 * A tile is something to point at, never something to press: pointing says
 * what it means. On a flat screen that goes in the card over the controls,
 * which the page that owns the door fills from `offerOf`; in a headset this
 * shows the words itself, in front of the door (`point`).
 */
import * as THREE from "three";
import { DOOR_OFFERS, type Offer, type OfferId } from "@nswp/core";
import { PORTAL_WIDTH } from "./gate-size.js";
import { ICONS, type IconName } from "./ui/icons.js";
import { OFFER_ICONS } from "./offer-icons.js";
import { textSprite } from "./three.js";

export { OFFER_ICONS };

/** A tile's side, in metres: large enough to tell lit from dark across a room. */
export const OFFER_TILE = 0.24;
const GAP = 0.03;
/** How far left of the doorway's middle the column stands: clear of the frame, and inside half the least distance between two doors. */
export const OFFER_COLUMN_X = -(PORTAL_WIDTH / 2 + 0.34);
/** The height of the lowest tile's middle. */
const FOOT = 0.32;

/** Where each tile's middle is, top to bottom in the order given, in the door's own space. */
export function doorOfferPlaces(count: number): [x: number, y: number, z: number][] {
  const n = Math.max(0, Math.floor(count));
  return Array.from({ length: n }, (_, i) => [OFFER_COLUMN_X, FOOT + (n - 1 - i) * (OFFER_TILE + GAP), 0.05]);
}

export interface DoorOffersOptions {
  color?: THREE.ColorRepresentation;
  textColor?: string;
}

export interface DoorOffers {
  /** Add this to the door's own group: the column stands beside the opening, on the floor the door stands on. */
  group: THREE.Group;
  /** Test rays against these. */
  targets: THREE.Mesh[];
  /** Which line a pointed-at thing is, or null if it isn't one of these tiles. */
  offerOf(object: THREE.Object3D | null | undefined): Offer | null;
  /**
   * Say which tile is pointed at, or null for none: it is drawn brighter.
   * With `words` (a headset, where there is no card to read), what it means
   * is shown in front of the door for as long as it is pointed at.
   */
  point(offer: Offer | null, words?: boolean): void;
  /** What the world offers, when it is learned or changes. Only the lines a door shows are drawn. */
  set(offers: readonly Offer[]): void;
  dispose(): void;
}

const tileGeo = new THREE.PlaneGeometry(OFFER_TILE, OFFER_TILE);

/** A tile's picture: a square with the line drawing in it. Lit, it is the door's own colour; dark, a dim outline. */
function tileTexture(icon: IconName, on: boolean, color: THREE.Color, pointed: boolean): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const pen = canvas.getContext("2d")!;
  const css = `#${color.getHexString()}`;
  pen.fillStyle = on ? "rgba(6, 12, 14, 0.86)" : "rgba(6, 10, 12, 0.6)";
  pen.fillRect(0, 0, size, size);
  if (on) {
    pen.globalAlpha = pointed ? 0.34 : 0.2;
    pen.fillStyle = css;
    pen.fillRect(0, 0, size, size);
    pen.globalAlpha = 1;
  }
  pen.lineWidth = on || pointed ? 6 : 3;
  pen.strokeStyle = on ? css : pointed ? "rgba(214, 226, 236, 0.75)" : "rgba(160, 174, 186, 0.34)";
  pen.strokeRect(3, 3, size - 6, size - 6);
  // The drawing is on a 24-unit square: scaled to the tile with a margin.
  const scale = (size * 0.66) / 24;
  pen.translate(size * 0.17, size * 0.17);
  pen.scale(scale, scale);
  pen.lineWidth = on ? 2 : 1.6;
  pen.lineCap = "round";
  pen.lineJoin = "round";
  pen.strokeStyle = on ? (pointed ? "#ffffff" : css) : pointed ? "rgba(214, 226, 236, 0.8)" : "rgba(160, 174, 186, 0.42)";
  pen.stroke(new Path2D(ICONS[icon]));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createDoorOffers(offers: readonly Offer[] = [], opts: DoorOffersOptions = {}): DoorOffers {
  const color = new THREE.Color(opts.color ?? 0x4cc9f0);
  const textColor = opts.textColor ?? "#f2f3f6";
  const group = new THREE.Group();
  group.name = "door-offers";
  const targets: THREE.Mesh[] = [];
  let shown: Offer[] = [];
  let pointed: OfferId | null = null;
  let label: THREE.Sprite | null = null;
  let labelled = "";

  const material = (mesh: THREE.Mesh) => mesh.material as THREE.MeshBasicMaterial;
  const paint = (mesh: THREE.Mesh, offer: Offer) => {
    material(mesh).map?.dispose();
    material(mesh).map = tileTexture(OFFER_ICONS[offer.id as keyof typeof OFFER_ICONS], offer.on, color, offer.id === pointed);
    material(mesh).needsUpdate = true;
  };
  const dropLabel = () => {
    if (!label) return;
    group.remove(label);
    label.material.map?.dispose();
    label.material.dispose();
    label = null;
    labelled = "";
  };

  const api: DoorOffers = {
    group,
    targets,
    offerOf(object) {
      const i = object ? targets.indexOf(object as THREE.Mesh) : -1;
      return i >= 0 ? (shown[i] ?? null) : null;
    },
    point(offer, words = false) {
      const next = offer && shown.some((o) => o.id === offer.id) ? offer.id : null;
      if (next !== pointed) {
        const before = pointed;
        pointed = next;
        shown.forEach((o, i) => {
          if (o.id === before || o.id === next) paint(targets[i]!, o);
        });
      }
      const say = words && next ? `${shown.find((o) => o.id === next)!.name}\n${shown.find((o) => o.id === next)!.words}` : "";
      if (say === labelled) return;
      dropLabel();
      if (!say) return;
      // In front of the door at the height of the eyes, where someone pointing at its side is already looking.
      label = textSprite(say, textColor, 1.5);
      label.position.set(0, 1.55, 0.4);
      label.renderOrder = 5;
      label.material.depthTest = false;
      group.add(label);
      labelled = say;
    },
    set(next) {
      const door = new Set<string>(DOOR_OFFERS);
      shown = next.filter((o) => door.has(o.id));
      for (const mesh of targets.splice(0)) {
        group.remove(mesh);
        material(mesh).map?.dispose();
        material(mesh).dispose();
      }
      pointed = null;
      dropLabel();
      doorOfferPlaces(shown.length).forEach((at, i) => {
        const mesh = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
        mesh.name = `offer:${shown[i]!.id}`;
        mesh.position.set(...at);
        paint(mesh, shown[i]!);
        targets.push(mesh);
        group.add(mesh);
      });
    },
    dispose() {
      api.set([]);
    },
  };
  api.set(offers);
  return api;
}
