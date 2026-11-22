// The console's Bag section, drawn by the kit's own code (addBagControls, mountHud), with a stand-in bag: for
// pictures of how items in the bag and items offered here look. Bundled and served by trials/bag-marks.mjs.
import { buildItem, finalizeEvent, parseItem, type Item } from "../packages/core/src/index.js";
import { addBagControls } from "../packages/sdk/src/bagging.js";
import { createControls } from "../packages/sdk/src/ui/model.js";
import { mountHud } from "../packages/sdk/src/ui/hud.js";

const H = (c: string) => c.repeat(64);
const maker = new Uint8Array(32).fill(7);
const make = (d: string, title: string): Item =>
  parseItem(finalizeEvent(buildItem({ d, title, model: { url: `https://items.example/${H("a")}.glb`, sha256: H("a") }, size: [0.2, 0.3, 0.2], behaviors: ["holdable"], now: 1_800_000_000 })!, maker))!;
const lantern = make("brass-lantern", "Brass lantern");
const mug = make("tin-mug", "Tin mug");
const pinwheel = make("paper-pinwheel", "Paper pinwheel");
const all = new Map([lantern, mug, pinwheel].map((i) => [i.id, i]));

// The stand-in bag: the lantern and the mug in it; the pinwheel offered here, not taken.
let has = [lantern.id, mug.id];
let holding = mug.id;
const watchers = new Set<() => void>();
const changed = () => { for (const fn of [...watchers]) fn(); };
const bag = {
  items: () => [...has],
  load: async () => [...has],
  canChange: () => true,
  add: async (item: string) => { has = [...has, item]; changed(); return { ok: true, said: "Put in your bag." }; },
  remove: async (item: string) => { has = has.filter((i) => i !== item); if (holding === item) holding = ""; changed(); return { ok: true, said: "Taken out of your bag." }; },
  tints: () => ({}),
  setTints: () => {},
  onChange: (fn: () => void) => { watchers.add(fn); return () => void watchers.delete(fn); },
};
const controls = createControls({ title: "A world", address: "world.example" });
const hud = mountHud(controls);
const bagging = addBagControls(controls, {
  bag: bag as never,
  items: { known: (c: string) => all.get(c) ?? null, describe: async (c: string) => all.get(c) ?? null },
  me: () => H("9"),
  rule: () => "allowed",
  holding: () => holding,
  hold: async (item: string) => { holding = item; changed(); return { ok: true, said: "In your hand." }; },
  offered: () => [pinwheel.id],
  place: () => "A world",
});
bag.onChange(() => bagging.refresh());
(window as unknown as { __bag: unknown }).__bag = {
  open: () => hud.setOpen(true, "bag"),
  accent: (hex: string) => controls.setTheme({ accent: hex }),
  take: () => bag.add(pinwheel.id),
  putAway: () => bag.remove(lantern.id),
  tiles: () => controls.view().sections.find((s) => s.id === "bag")?.items.filter((i) => i.kind === "tile").map((i) => ({ id: i.id, label: i.label, ...("mark" in i ? { mark: (i as { mark: unknown }).mark } : {}), ...("faint" in i ? { faint: (i as { faint: unknown }).faint } : {}) })) ?? [],
};
