/**
 * Fetching an item and getting it ready to draw (protocol/17-items.md).
 *
 *   const items = createItems();
 *   const lantern = await items.describe("37303:<maker>:brass-lantern");   // its maker's signed description
 *   const model = lantern && (await items.model(lantern));                 // something to add to a scene
 *
 * An item is something a stranger made. So nothing of it is trusted until it has been checked:
 *
 * - its description is taken only with a real signature by the maker its coordinate names;
 * - its model is taken only if its bytes have the hash the description gives, and are no larger than this allows;
 * - the file is read and counted before Three.js sees it, and one with too much in it, or that names anything
 *   outside itself, is not drawn (`item-store.ts`, which is the part every engine shares).
 *
 * Whatever fails, there is a plain marker of the item's own size to draw instead: a visitor is never left
 * holding nothing because a file was missing.
 *
 * Fetching a model tells the place that keeps it the visitor's address, as fetching a picture does. A visitor
 * who would rather not has one switch for all items (`showsItems`).
 */
import { tintSlot, type Item } from "@nswp/core";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createItemStore, ITEM_BUDGET, showsItems, type ItemStore, type ItemStoreOptions, type ModelNamed } from "./item-store.js";

export { forgetItemsSwitch, ITEM_BUDGET, onItemsChange, setShowsItems, showsItems } from "./item-store.js";

export type ItemsOptions = ItemStoreOptions;

export interface Items extends ItemStore {
  /**
   * Something to draw for an item: its own model where every check passes, and a plain marker of its size where
   * one doesn't, or where the visitor has items turned off. Each call gives a copy of its own.
   */
  model(item: Item, tints?: Record<string, string>): Promise<THREE.Object3D>;
  /** A plain marker of an item's size. */
  marker(item: Pick<Item, "size">): THREE.Object3D;
  /** The animations an item's own model brings, by name. Empty until its model has been made, and for a marker. */
  clips(item: Item): THREE.AnimationClip[];
  /** Something to draw for one of the things an item sends out: checked and counted like its model, or a marker. */
  sent(item: Item, name: string, tints?: Record<string, string>): Promise<THREE.Object3D>;
}

/**
 * Colour the parts of a drawn item that its holder may choose (protocol/17-items.md, "A holder's own colours"):
 * every material named `tint:<slot>` takes the colour chosen for that tint, or the one its maker gave it. A part
 * that glows, glows in that colour. Call it again to change them. Nothing else about the model is touched.
 */
export function applyTints(root: THREE.Object3D, item: Pick<Item, "tints">, tints: Record<string, string> = {}): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const slot = (material.userData.nswpTint as string | undefined) ?? "";
      if (!slot) continue;
      const color = tints[slot] ?? item.tints.find((t) => t.slot === slot)?.color;
      if (!color || !/^#[0-9a-f]{6}$/.test(color)) continue;
      const m = material as THREE.MeshStandardMaterial;
      m.color?.set(color);
      if (m.userData.nswpGlows) m.emissive?.set(color);
    }
  });
}

/** A copy of a model with materials of its own wherever a tint goes, coloured as its holder chose. */
function tinted(root: THREE.Object3D, item: Pick<Item, "tints">, tints?: Record<string, string>): THREE.Object3D {
  if (!item.tints.length) return root;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const own = (material: THREE.Material): THREE.Material => {
      const slot = tintSlot(material.name);
      if (!slot || !item.tints.some((t) => t.slot === slot)) return material;
      const copy = material.clone();
      copy.userData = { ...copy.userData, nswpTint: slot, nswpGlows: ((material as THREE.MeshStandardMaterial).emissive?.getHex() ?? 0) !== 0 };
      return copy;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);
  });
  applyTints(root, item, tints);
  return root;
}

export function withinBudget(root: THREE.Object3D): boolean {
  let triangles = 0;
  let meshes = 0;
  const materials = new Set<THREE.Material>();
  let ok = true;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    const g = mesh.geometry;
    triangles += Math.floor((g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3);
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(m);
      for (const value of Object.values(m as unknown as Record<string, unknown>)) {
        const image = (value as THREE.Texture | null)?.isTexture ? ((value as THREE.Texture).image as { width?: number; height?: number } | null) : null;
        if (image && Math.max(image.width ?? 0, image.height ?? 0) > ITEM_BUDGET.texture) ok = false;
      }
    }
  });
  return ok && meshes > 0 && meshes <= ITEM_BUDGET.meshes && triangles <= ITEM_BUDGET.triangles && materials.size <= ITEM_BUDGET.materials;
}

/** Scale and place a model so that it stands inside the box its description gives, on that box's floor. */
export function fitToSize(root: THREE.Object3D, size: readonly [number, number, number]): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(root);
  const has = box.getSize(new THREE.Vector3());
  const scale = Math.min(size[0] / (has.x || 1), size[1] / (has.y || 1), size[2] / (has.z || 1));
  const holder = new THREE.Group();
  root.scale.multiplyScalar(Number.isFinite(scale) && scale > 0 ? scale : 1);
  const fitted = new THREE.Box3().setFromObject(root);
  const centre = fitted.getCenter(new THREE.Vector3());
  root.position.x -= centre.x;
  root.position.z -= centre.z;
  root.position.y -= fitted.min.y;
  holder.add(root);
  return holder;
}

export function createItems(opts: ItemsOptions = {}): Items {
  const store = createItemStore(opts);
  const made = new Map<string, Promise<THREE.Object3D | null>>();
  const clipsOf = new Map<string, THREE.AnimationClip[]>();

  const marker = (item: Pick<Item, "size">): THREE.Object3D => {
    const [w, h, d] = item.size;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0x9aa7b4, wireframe: true }));
    box.position.y = h / 2;
    const holder = new THREE.Group();
    holder.add(box);
    return holder;
  };

  /** The model itself, once: its checked bytes read by Three.js, counted again as it will be drawn, and fitted. Null where any of that fails. */
  const load = (named: ModelNamed): Promise<THREE.Object3D | null> => {
    const key = `${named.model.sha256}:${named.size.join(",")}`;
    let got = made.get(key);
    if (!got) {
      got = (async () => {
        const checked = await store.modelBytes(named);
        if (!checked) return null;
        const { bytes } = checked;
        try {
          const read = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "");
          // Lights and cameras a file brings are not an item's to add to someone's world.
          const extra: THREE.Object3D[] = [];
          read.scene.traverse((o) => {
            if ((o as THREE.Light).isLight || (o as THREE.Camera).isCamera) extra.push(o);
          });
          for (const o of extra) o.removeFromParent();
          if (!withinBudget(read.scene)) return null;
          clipsOf.set(key, (read.animations ?? []).slice(0, 8));
          return fitToSize(read.scene, named.size);
        } catch {
          return null;
        }
      })();
      made.set(key, got);
    }
    return got;
  };

  return {
    ...store,
    async model(item, tints) {
      if (!showsItems()) return marker(item);
      const got = await load(item);
      return got ? tinted(got.clone(true), item, tints) : marker(item);
    },
    marker,
    clips: (item) => clipsOf.get(`${item.model.sha256}:${item.size.join(",")}`) ?? [],
    async sent(item, name, tints) {
      const send = item.sends.find((x) => x.name === name);
      if (!send) return marker({ size: [0.03, 0.03, 0.1] });
      if (!showsItems()) return marker(send);
      const got = await load(send);
      return got ? tinted(got.clone(true), item, tints) : marker(send);
    },
  };
}
