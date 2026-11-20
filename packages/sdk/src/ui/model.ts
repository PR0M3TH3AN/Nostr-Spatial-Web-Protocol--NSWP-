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
import { cleanSettings, PINS_MOST } from "@nswp/core";
import { arrivedSettings, reportSettings } from "../settings.js";
import { createUiChat, type ChatView, type UiChat } from "./chat.js";
import { createUiFeed, type FeedView, type UiFeed } from "./feed.js";
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
  /** A function is read again as things change, for a swatch that shows a choice as it stands. */
  color?: Text;
}

/**
 * A card at the head of a section: who, or what, the section is about just
 * now. The People section shows whoever was chosen. Every word on it is
 * plain text, and what a person wrote about themselves is shown as theirs.
 */
export interface UiCard {
  /** Their name. */
  title: string;
  /** A word for how they are known here: "By name", "Guest". */
  tag: string;
  /** Whether that word is one to trust a little more: a name their own client vouched for. */
  proven: boolean;
  /** One line under the name: the short form of their key, or that nobody vouched for them. */
  sub: string;
  /** Their key in full, to copy, or "". */
  copy: string;
  /** What they wrote about themselves, or "". Their own words, not a fact. */
  text: string;
  /** Where their picture is (for `loadPicture`), or "". */
  picture: string;
  /** A colour that stands for them where there is no picture, as CSS. */
  color: string;
  /** What is so about them now: recording, sharing their screen. */
  now: string[];
}

export interface UiSection {
  id: string;
  label: string;
  icon?: IconName;
  /** A card at the head of the section, or null for none. Asked each time the section is drawn. */
  card?: () => UiCard | null;
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
  card: UiCard | null;
  items: UiItemView[];
  /** The visitor keeps this tab on their bar. */
  pinned: boolean;
}
/** A tab of the menu the visitor keeps on their bar: pressing it brings the menu up on that tab. */
export interface UiPinView {
  /** The tab's id. */
  id: string;
  label: string;
  icon: IconName | null;
  /** The number key that presses it, or "". */
  key: string;
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
  /** The key that opens the chat panel to write in, or null for none. Enter does too, while this is a key. */
  chat: string | null;
}

export interface UiView {
  title: string;
  address: string;
  target: string;
  /** A few more lines about what is pointed at. */
  detail: string[];
  presence: Presence;
  corner: Corner;
  keys: UiKeys;
  sections: UiSectionView[];
  hotbar: UiItemView[];
  /** The tabs they keep on the bar, after its own keys, in the order they pinned them. Only tabs this place has. */
  pins: UiPinView[];
  /** They have pinned as many as may be: another can't be until one is taken off. */
  pinsFull: boolean;
  theme: UiTheme;
  /** What the people in the room have written (ui/chat.ts). */
  chat: ChatView;
  /** The visitor's own public posts, and the place to send out another (ui/feed.ts). */
  feed: FeedView;
}

export interface Controls {
  readonly theme: UiTheme;
  add(...actions: UiAction[]): void;
  remove(id: string): void;
  /** Whether there is a control with this id, showing or not. */
  has(id: string): boolean;
  addSection(section: UiSection): void;
  /**
   * Say what the visitor is pointing at, or "" for nothing. `detail` is a
   * few more lines about it: what it is, why it is here, how to use it. On a
   * flat screen they are shown beside the controls, the same size wherever
   * the thing is, so that a world needn't hang a sign in front of it.
   */
  setTarget(text: string, detail?: string[]): void;
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
  /** The tabs the visitor keeps on their bar, by id, in order. They go with them to the next world (settings.ts). */
  readonly pins: readonly string[];
  /**
   * Pin a tab of the menu to the bar, or take it off. It is the visitor's own doing, from the menu: a world
   * doesn't pin for them. False if it couldn't be: the bar holds `PINS_MOST`, or there is no such tab.
   */
  setPinned(section: string, pinned: boolean): boolean;
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
  /**
   * Say that something happened, by a short name: a control was pressed
   * (`press`, which `run` says itself), the menu opened, a room was joined.
   * Nothing is shown. It is for whatever makes the controls heard or felt.
   */
  signal(name: string): void;
  onSignal(fn: (name: string) => void): () => void;
  /** What the people in the room write to each other (ui/chat.ts). The room fills it; every renderer draws it. */
  readonly chat: UiChat;
  /** The visitor's own public posts (ui/feed.ts). The room fills it once something signs for them; every renderer draws it. */
  readonly feed: UiFeed;
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
  if (k && (k.chat === null || (typeof k.chat === "string" && k.chat.length === 1))) out.chat = k.chat === null ? null : k.chat.toLowerCase();
  return out;
}

const read = (t: Text | undefined): string => (typeof t === "function" ? t() : (t ?? ""));

/** The sections every world has, in the order they are shown. */
const STANDARD: UiSection[] = [
  { id: "travel", label: "Travel", icon: "door" },
  // Who the visitor is here. It has something in it only for one who came through a client (ui/identity.ts).
  { id: "you", label: "You", icon: "you" },
  // How other people see them. A visitor's own client fills this in, in its own place: a look is changed there and
  // nowhere else (ui/identity.ts, protocol/05-looks.md). In a world it is empty, and isn't shown.
  { id: "figure", label: "Your look", icon: "look" },
  { id: "room", label: "Room", icon: "room" },
  { id: "people", label: "People", icon: "people" },
  // Who the visitor follows (following.ts). Empty, and not shown, for a guest.
  { id: "following", label: "Following", icon: "list" },
  { id: "camera", label: "Camera", icon: "camera" },
  { id: "panels", label: "Panels", icon: "panel" },
  { id: "view", label: "View", icon: "vr" },
  { id: "moving", label: "Moving", icon: "step" },
  { id: "sound", label: "Sound", icon: "sound" },
  // How the controls themselves look. Called "Display", since "your look" is how other people see you.
  { id: "look", label: "Display", icon: "look", note: "How these controls look to you: their colour, the size of their text, whether things move. They go with you from world to world." },
  { id: "help", label: "Help", icon: "help" },
];

/**
 * The order of the things every place has, wherever in a world's code they
 * were added. So the taskbar reads the same in every world, and the same
 * number key does the same thing: the way home is first, then the visitor's
 * doors, the headset, the room and its chat, and jumping. A world's own things come after,
 * in the order it added them.
 */
export const STANDARD_ORDER: readonly string[] = ["back", "home", "go-home", "doors", "list", "vr", "room-join", "room-mic", "room-chat", "jump"];
const rank = (id: string): number => {
  const i = STANDARD_ORDER.indexOf(id);
  return i === -1 ? STANDARD_ORDER.length : i;
};
const inOrder = <T extends { id: string }>(list: T[]): T[] =>
  list
    .map((a, i) => [a, i] as const)
    .sort((x, y) => rank(x[0].id) - rank(y[0].id) || x[1] - y[1])
    .map((x) => x[0]);

const PINS_KEY = "nswp:ui:pins";
/** The tabs this visitor keeps on their bar, as this site remembers them. Null if they have never chosen. */
function loadPins(): string[] | null {
  try {
    const kept = globalThis.localStorage?.getItem(PINS_KEY);
    return kept === null || kept === undefined ? null : (cleanSettings({ pins: JSON.parse(kept) }).pins ?? null);
  } catch {
    return null;
  }
}
function savePins(pins: string[]): void {
  try {
    globalThis.localStorage?.setItem(PINS_KEY, JSON.stringify(pins));
  } catch {
    /* storage unavailable: the choice lasts for this visit */
  }
}

export function createControls(opts: ControlsOptions): Controls {
  const sections: UiSection[] = STANDARD.map((s) => ({ ...s }));
  for (const s of opts.sections ?? []) addSection(s);
  const actions: UiAction[] = [];
  const listeners = new Set<() => void>();
  const sayers = new Set<(text: string) => void>();
  const signals = new Set<(name: string) => void>();
  let visitor = loadVisitorTheme();
  // What they arrived with, if they came through a door, in place of what this site remembered: the size of their
  // text, whether things move, which wrist. The colours stay the world's (settings.ts).
  const came = arrivedSettings();
  const brought: Partial<UiTheme> = { ...(came.text !== undefined ? { scale: came.text } : {}), ...(came.motion !== undefined ? { motion: came.motion } : {}), ...(came.wrist !== undefined ? { wrist: came.wrist } : {}) };
  if (Object.keys(brought).length) {
    visitor = { ...visitor, ...brought };
    saveVisitorTheme(visitor);
  }
  // Only what they chose themselves goes on with them. A world's own setting, or a device's, is not theirs to carry.
  reportSettings("look", () => ({ ...(visitor.scale !== undefined ? { text: visitor.scale } : {}), ...(visitor.motion !== undefined ? { motion: visitor.motion } : {}), ...(visitor.wrist !== undefined ? { wrist: visitor.wrist } : {}) }));
  // The tabs they keep on their bar. Null until they have chosen: then nothing is said of it to the next world.
  let pins: string[] | null = loadPins();
  if (came.pins !== undefined) {
    pins = [...came.pins];
    savePins(pins);
  }
  reportSettings("pins", () => (pins ? { pins } : {}));
  let theme = resolveTheme(opts.theme, visitor);
  let target = "";
  let detail: string[] = [];
  let presence: Presence = PRESENCES.includes(opts.presence as Presence) ? (opts.presence as Presence) : "full";
  let corner: Corner = CORNERS.includes(opts.corner as Corner) ? (opts.corner as Corner) : "top-left";
  let keys = cleanKeys({ menu: "m", hotbar: true, chat: "t" }, opts.keys);
  let claimed = false;
  const changed = () => {
    for (const fn of listeners) fn();
  };
  const chat = createUiChat(changed);
  const feed = createUiFeed(changed);

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
    has: (id) => actions.some((x) => x.id === id),
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
    setTarget(text, more = []) {
      const next = text ? more.filter((line) => typeof line === "string" && line.trim()).slice(0, 4) : [];
      if (text === target && next.join("\n") === detail.join("\n")) return;
      target = text;
      detail = next;
      changed();
    },
    say(text) {
      for (const fn of sayers) fn(text);
    },
    run(id) {
      const a = actions.find((x) => x.id === id);
      if (!a || a.hidden?.()) return false;
      for (const fn of signals) fn("press");
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
    get pins() {
      return pins ?? [];
    },
    setPinned(section, pinned) {
      const now = pins ?? [];
      if (pinned === now.includes(section)) return true;
      if (pinned && (now.length >= PINS_MOST || cleanSettings({ pins: [section] }).pins?.length !== 1)) return false;
      pins = pinned ? [...now, section] : now.filter((id) => id !== section);
      savePins(pins);
      changed();
      return true;
    },
    view() {
      const showing = inOrder(actions.filter((a) => !a.hidden?.()));
      const bar = showing.filter((a) => a.hotbar).slice(0, 6);
      const item = (a: UiAction): UiItemView => {
        const slot = bar.indexOf(a);
        return { id: a.id, label: read(a.label), icon: (typeof a.icon === "function" ? a.icon() : a.icon) ?? null, on: a.on ? a.on() : null, tone: a.tone ?? "normal", key: slot === -1 ? "" : String(slot + 1), short: read(a.short) || read(a.label), kind: a.kind ?? "button", color: read(a.color) };
      };
      const known = new Set(sections.map((s) => s.id));
      const extra = [...new Set(showing.map((a) => a.section ?? "travel").filter((id) => !known.has(id)))].map((id) => ({ id, label: id }) as UiSection);
      const shown = [...sections, ...extra]
        .map((s) => ({ id: s.id, label: s.label, icon: s.icon ?? null, note: read(s.note), card: s.card?.() ?? null, items: showing.filter((a) => (a.section ?? "travel") === s.id).map(item), pinned: (pins ?? []).includes(s.id) }))
        .filter((s) => s.items.length > 0 || s.note || s.card);
      return {
        title: opts.title,
        address: opts.address ?? "",
        target,
        detail,
        sections: shown,
        hotbar: bar.map(item),
        // Only tabs this place has: a tab pinned in another world that isn't here is kept, and not shown.
        pins: (pins ?? []).flatMap((id, i) => {
          const tab = shown.find((x) => x.id === id);
          const n = bar.length + i + 1;
          return tab ? [{ id, label: tab.label, icon: tab.icon, key: n <= 9 ? String(n) : "" }] : [];
        }),
        pinsFull: (pins ?? []).length >= PINS_MOST,
        theme,
        presence,
        corner,
        keys: claimed ? { menu: null, hotbar: false, chat: null } : keys,
        chat: chat.view(),
        feed: feed.view(),
      };
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    signal(name) {
      for (const fn of signals) {
        try {
          fn(name);
        } catch {
          /* a listener's trouble is not the controls' */
        }
      }
    },
    onSignal(fn) {
      signals.add(fn);
      return () => signals.delete(fn);
    },
    onSay(fn) {
      sayers.add(fn);
      return () => sayers.delete(fn);
    },
    chat,
    feed,
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
