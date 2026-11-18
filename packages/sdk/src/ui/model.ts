/**
 * The controls a world gives its visitor, as a list of things they can do.
 *
 * A world says what the actions are, once. Two renderers draw them: a HUD on a
 * flat screen (`mountHud`, in `nswp-sdk/ui`) and a console inside a headset
 * (`createConsole`, in `nswp-sdk/three`). They look nothing alike, and they
 * always offer the same things, because neither holds any of the logic.
 *
 *   const controls = createControls({ title: "My world", address: "example.org" });
 *   controls.add({ id: "home", section: "travel", label: "Go home", icon: "home", hotbar: true, act: () => portal.home() });
 *
 * Adding a button, a section, or a whole new kind of control later means
 * adding to this list. Nothing about either renderer has to change.
 */
import type { IconName } from "./icons.js";
import { DEFAULT_THEME, resolveTheme, saveVisitorTheme, loadVisitorTheme, UI_PRESETS, type UiTheme } from "./theme.js";

type Text = string | (() => string);

export interface UiAction {
  id: string;
  /** What it says. A function is read again as things change, so the words follow what they describe. */
  label: Text;
  /** A function is read again as things change, like the label. */
  icon?: IconName | (() => IconName);
  /** Which group it belongs to. Sections the kit doesn't know are added after the ones it does. */
  section?: string;
  act(): void | Promise<void>;
  /** Leave it out while this returns true. */
  hidden?: () => boolean;
  /** For something that is on or off: whether it is on now. */
  on?: () => boolean;
  tone?: "normal" | "primary" | "warn";
  /** Put it in the row of things always at hand. Keep that row to six. */
  hotbar?: boolean;
  /** A word or two for where there is little room, such as under a hotbar key. */
  short?: Text;
  /**
   * What kind of control it is. Each kind is drawn by one small function in
   * each renderer, so a new kind is added there and nowhere else.
   * "swatch" is a choice of colour, and needs `color`.
   */
  kind?: "button" | "swatch";
  color?: string;
}

export interface UiSection {
  id: string;
  label: string;
  icon?: IconName;
  /** A few lines shown with the section: what a visitor should know before using it. */
  note?: Text;
}

export interface UiItemView {
  id: string;
  label: string;
  icon: IconName | null;
  on: boolean | null;
  tone: "normal" | "primary" | "warn";
  /** The number key that presses it from the hotbar, or "". */
  key: string;
  short: string;
  kind: "button" | "swatch";
  color: string;
}
export interface UiSectionView {
  id: string;
  label: string;
  icon: IconName | null;
  note: string;
  items: UiItemView[];
}
/** Everything a renderer needs to draw, with every word already worked out. */
/**
 * How much of the screen the controls take. A world with an interface of its
 * own leads, and these controls stay out of its way (spec §21.3).
 *
 * - "full": the whole HUD, and in a headset the Menu button and the wrist.
 * - "quiet": one small mark in a corner, which opens everything else. In a
 *   headset, the wrist; the Menu button only where no hand is tracked.
 * - "hidden": nothing until the world opens it. For a world that draws these
 *   actions in menus of its own, or for a moment that shouldn't be interrupted.
 */
export type Presence = "full" | "quiet" | "hidden";
export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
/** Which keys the HUD answers to. A game needs its keys more than a menu does. */
export interface UiKeys {
  /** The key that opens the menu, or null for none. */
  menu: string | null;
  /** Whether 1 to 6 press the hotbar. */
  hotbar: boolean;
}

export interface UiView {
  title: string;
  address: string;
  target: string;
  presence: Presence;
  corner: Corner;
  keys: UiKeys;
  sections: UiSectionView[];
  hotbar: UiItemView[];
  theme: UiTheme;
}

export interface Controls {
  readonly theme: UiTheme;
  add(...actions: UiAction[]): void;
  remove(id: string): void;
  addSection(section: UiSection): void;
  /** Say what the visitor is pointing at, or "" for nothing. */
  setTarget(text: string): void;
  /** A few words shown for a moment. */
  say(text: string): void;
  /** Do an action by its id, as pressing it would. Returns false if it isn't there or isn't showing. */
  run(id: string): boolean;
  /** Change the look. `keep` also remembers it as this visitor's choice, for this site. */
  setTheme(patch: Partial<UiTheme>, keep?: boolean): void;
  readonly presence: Presence;
  /** How much of the screen the controls take. A world can change it as it goes: quiet during play, full in a lobby. */
  setPresence(presence: Presence): void;
  /** Which corner the quiet mark sits in. */
  setCorner(corner: Corner): void;
  /** Which keys the HUD answers to. */
  setKeys(keys: Partial<UiKeys>): void;
  /**
   * Take every key for the world, or give them back. While claimed, the HUD
   * answers to no key at all; its mark can still be clicked. For play that
   * needs the whole keyboard.
   */
  claimInput(claimed: boolean): void;
  view(): UiView;
  /** Be told when something changed: a new action, the theme, the target. Returns how to stop being told. */
  subscribe(fn: () => void): () => void;
  /** Be told when there is something to say. */
  onSay(fn: (text: string) => void): () => void;
}

export interface ControlsOptions {
  /** The world's name. */
  title: string;
  /** Its address, as a visitor should read it. This is the world speaking about itself, not a verification. */
  address?: string;
  /** The look this world would like. The visitor's own choice overrides it. */
  theme?: Partial<UiTheme>;
  sections?: UiSection[];
  /** How much of the screen the controls take. "full" unless the world says otherwise. */
  presence?: Presence;
  /** Which corner the quiet mark sits in. Top left by default. */
  corner?: Corner;
  keys?: Partial<UiKeys>;
}

const PRESENCES: readonly Presence[] = ["full", "quiet", "hidden"];
const CORNERS: readonly Corner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
/** A key setting, kept only if it is one: these arrive from a world's settings file as well as from code. */
function cleanKeys(now: UiKeys, k: Partial<UiKeys> | undefined): UiKeys {
  const out = { ...now };
  if (k && (k.menu === null || (typeof k.menu === "string" && k.menu.length === 1))) out.menu = k.menu === null ? null : k.menu.toLowerCase();
  if (k && typeof k.hotbar === "boolean") out.hotbar = k.hotbar;
  return out;
}

const read = (t: Text | undefined): string => (typeof t === "function" ? t() : (t ?? ""));

/** The sections every world has, in the order they are shown. */
const STANDARD: UiSection[] = [
  { id: "travel", label: "Travel", icon: "door" },
  { id: "room", label: "Room", icon: "room" },
  { id: "people", label: "People", icon: "people" },
  { id: "camera", label: "Camera", icon: "camera" },
  { id: "panels", label: "Panels", icon: "panel" },
  { id: "view", label: "View", icon: "vr" },
  { id: "moving", label: "Moving", icon: "step" },
  { id: "look", label: "Look", icon: "look", note: "How these controls look to you. Kept in this browser, for this site." },
  { id: "help", label: "Help", icon: "help" },
];

export function createControls(opts: ControlsOptions): Controls {
  const sections: UiSection[] = STANDARD.map((s) => ({ ...s }));
  for (const s of opts.sections ?? []) addSection(s);
  const actions: UiAction[] = [];
  const listeners = new Set<() => void>();
  const sayers = new Set<(text: string) => void>();
  let visitor = loadVisitorTheme();
  let theme = resolveTheme(opts.theme, visitor);
  let target = "";
  let presence: Presence = PRESENCES.includes(opts.presence as Presence) ? (opts.presence as Presence) : "full";
  let corner: Corner = CORNERS.includes(opts.corner as Corner) ? (opts.corner as Corner) : "top-left";
  let keys = cleanKeys({ menu: "m", hotbar: true }, opts.keys);
  let claimed = false;
  const changed = () => {
    for (const fn of listeners) fn();
  };

  function addSection(s: UiSection): void {
    const i = sections.findIndex((x) => x.id === s.id);
    if (i === -1) sections.push({ ...s });
    else sections[i] = { ...sections[i], ...s };
  }

  const controls: Controls = {
    get theme() {
      return theme;
    },
    add(...more) {
      for (const a of more) {
        const i = actions.findIndex((x) => x.id === a.id);
        if (i === -1) actions.push(a);
        else actions[i] = a;
      }
      changed();
    },
    remove(id) {
      const i = actions.findIndex((x) => x.id === id);
      if (i !== -1) actions.splice(i, 1);
      changed();
    },
    addSection(s) {
      addSection(s);
      changed();
    },
    get presence() {
      return presence;
    },
    setPresence(next) {
      if (!PRESENCES.includes(next) || next === presence) return;
      presence = next;
      changed();
    },
    setCorner(next) {
      if (!CORNERS.includes(next) || next === corner) return;
      corner = next;
      changed();
    },
    setKeys(next) {
      keys = cleanKeys(keys, next);
      changed();
    },
    claimInput(next) {
      if (claimed === next) return;
      claimed = next;
      changed();
    },
    setTarget(text) {
      if (text === target) return;
      target = text;
      changed();
    },
    say(text) {
      for (const fn of sayers) fn(text);
    },
    run(id) {
      const a = actions.find((x) => x.id === id);
      if (!a || a.hidden?.()) return false;
      void Promise.resolve()
        .then(() => a.act())
        .catch(() => {})
        .finally(changed);
      return true;
    },
    setTheme(patch, keep = false) {
      if (keep) {
        visitor = { ...visitor, ...patch };
        saveVisitorTheme(visitor);
      }
      theme = resolveTheme({ ...opts.theme, ...(keep ? {} : patch) }, visitor);
      changed();
    },
    view() {
      const showing = actions.filter((a) => !a.hidden?.());
      const bar = showing.filter((a) => a.hotbar).slice(0, 6);
      const item = (a: UiAction): UiItemView => {
        const slot = bar.indexOf(a);
        return { id: a.id, label: read(a.label), icon: (typeof a.icon === "function" ? a.icon() : a.icon) ?? null, on: a.on ? a.on() : null, tone: a.tone ?? "normal", key: slot === -1 ? "" : String(slot + 1), short: read(a.short) || read(a.label), kind: a.kind ?? "button", color: a.color ?? "" };
      };
      const known = new Set(sections.map((s) => s.id));
      const extra = [...new Set(showing.map((a) => a.section ?? "travel").filter((id) => !known.has(id)))].map((id) => ({ id, label: id }) as UiSection);
      return {
        title: opts.title,
        address: opts.address ?? "",
        target,
        sections: [...sections, ...extra]
          .map((s) => ({ id: s.id, label: s.label, icon: s.icon ?? null, note: read(s.note), items: showing.filter((a) => (a.section ?? "travel") === s.id).map(item) }))
          .filter((s) => s.items.length > 0 || s.note),
        hotbar: bar.map(item),
        theme,
        presence,
        corner,
        keys: claimed ? { menu: null, hotbar: false } : keys,
      };
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    onSay(fn) {
      sayers.add(fn);
      return () => sayers.delete(fn);
    },
  };

  // The Look section comes with the kit, so every world lets a visitor change it the same way.
  const keep = (patch: Partial<UiTheme>) => controls.setTheme(patch, true);
  controls.add(
    ...UI_PRESETS.map(
      (p): UiAction => ({ id: `look-${p.id}`, section: "look", kind: "swatch", color: p.accent, label: p.label, on: () => theme.accent === p.accent, act: () => keep({ accent: p.accent }) }),
    ),
    { id: "look-size", section: "look", icon: "size", label: () => (theme.scale > 1 ? "Text: larger" : "Text: normal"), on: () => theme.scale > 1, act: () => keep({ scale: theme.scale > 1 ? 1 : 1.25 }) },
    { id: "look-motion", section: "look", icon: "motion", label: () => (theme.motion ? "Motion: on" : "Motion: off"), on: () => theme.motion, act: () => keep({ motion: !theme.motion }) },
    {
      id: "look-wrist",
      section: "look",
      icon: "menu",
      label: () => (theme.wrist === "off" ? "Wrist console: off" : `Wrist console: ${theme.wrist} hand`),
      on: () => theme.wrist !== "off",
      act: () => keep({ wrist: theme.wrist === "left" ? "right" : theme.wrist === "right" ? "off" : "left" }),
    },
    { id: "look-reset", section: "look", icon: "turn", label: "Back to this world's look", hidden: () => Object.keys(visitor).length === 0, act: () => {
        visitor = {};
        saveVisitorTheme({});
        theme = resolveTheme(opts.theme, visitor);
      } },
  );
  return controls;
}

export { DEFAULT_THEME };
