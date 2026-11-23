/**
 * The client has the menu: the words between a world in a frame and the page above it that draws the visitor's
 * console (protocol/02-doors.md, "The client has the menu"; docs/plans/the-clients-menu.md).
 *
 * A client that keeps the screen can draw the console itself, above the world, so that it is the same in every
 * world. The world's own console steps aside and says a few words upward: what it is called, the tabs it fills,
 * and the state of the things only it can run. Presses on those come back down as words.
 *
 * This file is those words as data, and nothing else: what each side may say, the limits a client holds a world
 * to, and the reading of whatever arrives. Nothing here draws, sends or listens. Everything a world says is plain
 * data, shown as text; nothing in it is ever run. What is over a limit is left out, never cut to fit.
 *
 * Both sides read with these functions, so a world and a client built from different copies of the kit agree on
 * what a word means. The examples are `vectors/menu-words.json`.
 */
import { cleanItemsRule, type ItemsRule } from "./constants.js";
import { cleanSettings, type TravelSettings } from "./settings.js";

/** The version of these words this code speaks: what a world says as `menu` in its `here`, and a client as `v`. */
export const MENU_VERSION = 1;

/** What a client holds a world to, whatever it sends. */
export const MENU_LIMITS = {
  /** Tabs in one description. */
  sections: 12,
  /** Rows in one tab. */
  rows: 60,
  /** Rows in all. */
  allRows: 200,
  /** Characters in a row's label, and in any other short line. */
  label: 120,
  /** Pixels a side, for a picture. */
  picture: 256,
  /** Bytes of description, as JSON, without its pictures. */
  bytes: 65536,
  /** Tabs of its own a world may add. */
  ownTabs: 2,
  /** Characters in words shown for a moment. */
  say: 200,
  /** Characters of text a `copy` row carries. */
  copy: 2000,
  /** Characters typed into a `field` row. */
  field: 500,
  /** Characters in the world's name. */
  title: 80,
  /** Characters in a tab's note, and in what a card says at length. */
  note: 400,
  /** Bytes in a file the visitor chose for a `file` row: 64 MB. */
  file: 64 * 1024 * 1024,
  /** Characters in that file's own name. A longer name is left out, and the file goes without one. */
  fileName: 255,
  /** Bytes in a picture or a clip a world hands up to be saved: 64 MB. */
  save: 64 * 1024 * 1024,
  /** How many a world may hand up in answer to one press. */
  saves: 12,
} as const;

/** How long a framed world waits for a client to say it has the menu, before drawing its own. */
export const MENU_WAIT_MS = 300;
/** How long a client waits for a world to leave by itself, before taking the visitor home. */
export const LEAVE_MS = 1000;
/** How long after a press on a `save` row a client still takes what the world hands up for it. */
export const MENU_SAVE_MS = 10_000;

/**
 * The visitor's own tabs. A world never fills, reads or presses them, and is never told what is in them.
 * (`figure` is "Your look" and `look` is "Display": the names are the kit's, and travel as pins already.)
 */
export const MENU_VISITOR_TABS = ["you", "figure", "bag", "wallet", "files", "following", "messages", "look"] as const;
/**
 * The tabs every place has that a world fills: its room and people, its own doors under Travel, its keeper's list.
 * Several are filled by both: the client's own rows come first in them, and the world's stand below, under the
 * world's name. Sound, Help and Moving are of that kind. The volumes and the visitor's own music are the client's,
 * and a world adds what is its own (the piece it is playing); the client's help comes first, and a world's words
 * about itself are a note after it; how the visitor moves is the client's to switch, and a world adds what it does
 * for them (a jump). Nothing typed goes to a world from any of the three: a `field` row there is left out.
 */
export const MENU_WORLD_TABS = ["travel", "room", "people", "camera", "panels", "view", "scores", "achievements", "guests", "sound", "help", "moving"] as const;

/** The few keys that are the visitor's, which a world forwards while it has the keyboard. Never any other. */
export const MENU_KEYS = ["summon", "escape", "menu", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
export type MenuKey = (typeof MENU_KEYS)[number];

/**
 * Before a tab's id, for the picture of the card at its head: a card has no id of its own, so its picture is sent
 * as `{ picture, id: "card:people" }`. So that this can never be taken for a row's picture, no row's id may begin
 * with it: a row that does is left out as it is read.
 */
export const MENU_CARD_PICTURE = "card:";

/**
 * What kind of row it is. `copy` and `field` are done by the client itself, since the word of a press is not a
 * press in the world's page: `copy` carries text the client writes to the clipboard, and `field` is typed into.
 *
 * `file` and `save` are the two things a browser gives only to the page that was pressed, handed across instead.
 * A `file` row has the client's page open the browser's chooser and hand the chosen file down with the press. A
 * `save` row's press may be answered by the world handing a picture or a clip up, which the client's page saves.
 */
export const MENU_ROW_KINDS = ["button", "swatch", "tile", "line", "copy", "field", "file", "save"] as const;
export type MenuRowKind = (typeof MENU_ROW_KINDS)[number];

/**
 * The kinds of file a `file` row may ask for. A world names some of these and never "any file": the chooser offers
 * only them, and a file of another kind is not handed over. A file's kind is the first part of the type the
 * browser gives it (`image/png` is an `image`).
 */
export const MENU_FILE_KINDS = ["image", "video"] as const;
export type MenuFileKind = (typeof MENU_FILE_KINDS)[number];

/** What a world may hand up to be saved: a picture or a clip, of one of these types. Anything else is not read. */
export const MENU_SAVE_TYPES = ["image/jpeg", "image/png", "image/webp", "video/webm", "video/mp4"] as const;
export type MenuSaveType = (typeof MENU_SAVE_TYPES)[number];

export interface MenuRow {
  id: string;
  label: string;
  /** A word or two for where there is little room. */
  short?: string;
  /** A name from the console's own set of icons. A client leaves out a name it has no icon for. */
  icon?: string;
  kind: MenuRowKind;
  /** Whether it is so, for a row that is on or off. */
  on?: boolean;
  tone?: "primary" | "warn";
  /** A colour, as `#rrggbb`. */
  color?: string;
  /** A tile's small icon in its corner. */
  mark?: string;
  /** A tile drawn greyed, and still pressable. */
  faint?: true;
  /** The world would have it on the bar. */
  bar?: true;
  /** For a `copy` row: the text. */
  copy?: string;
  /** For a `file` row: the kinds of file it takes. */
  accept?: MenuFileKind[];
  /** A small picture, as whatever the caller's own check let through (a bitmap, in a browser). */
  picture?: unknown;
}

/** A card at the head of a tab: who, or what, the tab is about just now. Every word on it is plain text. */
export interface MenuCard {
  title: string;
  tag?: string;
  /** The mark for a name their own client vouched for. Only ever kept from a page of the client's own origin. */
  proven?: true;
  sub?: string;
  /** Text to copy from it (a key in full). */
  copy?: string;
  text?: string;
  color?: string;
  /** What is so about them now, a line each. */
  now?: string[];
  /** Which of the tab's rows are about this card, by id. */
  acts?: string[];
  picture?: unknown;
}

export interface MenuSection {
  id: string;
  /** For a world's own tab only: its name. The tabs every place has are named by the client. */
  label?: string;
  icon?: string;
  note?: string;
  card?: MenuCard;
  rows: MenuRow[];
}

/**
 * Where a world's own way of signing in stands, as a fact. The client words its own row from it ("Sign in",
 * "Asking again…", "It didn't answer"): a world never supplies those words, and never puts a row in You.
 *
 * - `none`: this world names nothing that signs for a visitor. There is no signing in here.
 * - `ready`: it can be asked, or has answered.
 * - `asking`: asked, and waiting on the visitor's sign-in address.
 * - `unanswered`: the sign-in address didn't answer.
 */
export const MENU_SIGN_IN = ["none", "ready", "asking", "unanswered"] as const;
export type MenuSignIn = (typeof MENU_SIGN_IN)[number];

/** The things every place has and only the world can run. */
export interface MenuState {
  room: { has: boolean; joined: boolean; mic: boolean | null; count: number };
  headset: { supported: boolean; presenting: boolean };
  /** Whether this world has the visitor's name. */
  named: boolean;
  /** Where the world's own way of signing in stands (`MENU_SIGN_IN`). */
  signIn: MenuSignIn;
  /** The address of what is in their hand, or "". */
  holding: string;
  /** The world's rule for items. */
  items: ItemsRule;
  /** Whether the place has a hum under its music: the visitor's own switch for it is shown only where it does. */
  hum: boolean;
}

/** A world's description of itself, as a client keeps it after reading. */
export interface MenuWorld {
  title: string;
  level: "full" | "quiet" | "hidden";
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** False while the world has taken every key. */
  keys: boolean;
  state: MenuState;
  /** What is pointed at: its name, then a few more lines about it. Empty for nothing. */
  target: string[];
  loading: { fraction: number | null; words: string } | null;
  sections: MenuSection[];
}

export interface MenuReadOptions {
  /**
   * The page is of the client's own origin, exactly (its own room, its Airlock). Such a page may fill any tab, add
   * any number of its own, and put a `field` row anywhere. This is a client's rule about itself.
   */
  own?: boolean;
  /**
   * Visitor's tabs this client does not yet run itself, and so still takes from a world. A `field` row may stand
   * in one. Empty in a client that runs them all, which is what the protocol describes.
   */
  also?: readonly string[];
  /** Whether something sent as a picture may be kept: the caller's own check of its kind and size. No check, no pictures. */
  picture?: (value: unknown) => boolean;
}

/** A tab's name: a short plain word, as a pin's is (settings.ts). */
const TAB_NAME = /^[a-z][a-z0-9-]{0,11}$/;
const ICON_NAME = /^[a-z][a-z0-9-]{0,23}$/;
const COLOR = /^#[0-9a-f]{6}$/;
const LEVELS = ["full", "quiet", "hidden"] as const;
const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
/** Control characters, and the marks that turn text round or hide in it. */
const UNSEEN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;
const UNSEEN_BUT_LINES = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const count = (s: string): number => {
  let n = 0;
  for (const _ of s) n++;
  return n;
};

/**
 * One line of plain text: anything unseen becomes a space, and the ends are trimmed. Undefined if it isn't text,
 * is empty, or is over `most` characters. Never cut to fit.
 */
function line(v: unknown, most: number): string | undefined {
  if (typeof v !== "string" || v.length > most * 4) return undefined;
  const s = v.replace(UNSEEN, " ").replace(/ {2,}/g, " ").trim();
  return s && count(s) <= most ? s : undefined;
}

/** Text carried whole, as it was written (to copy, or as it was typed): refused if anything in it is unseen. */
function whole(v: unknown, most: number): string | undefined {
  if (typeof v !== "string" || !v || v.length > most * 4 || UNSEEN_BUT_LINES.test(v)) return undefined;
  return count(v) <= most ? v : undefined;
}

/** An id is only ever compared, never shown: any text of a line's length with nothing unseen and no spaces. */
const id = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 && v.length <= MENU_LIMITS.label && !/\s/.test(v) && !UNSEEN_BUT_LINES.test(v) ? v : undefined);

/** Something sent as a file: a blob of at least one byte and at most `most`, or null. Never read, only measured. */
function fileOf(v: unknown, most: number): Blob | null {
  if (typeof Blob === "undefined" || !(v instanceof Blob)) return null;
  return Number.isInteger(v.size) && v.size > 0 && v.size <= most ? v : null;
}

/** The kind of a file, by the type the browser gives it (`image/png` is an `image`): one a row may ask for, or null. */
export function menuFileKind(type: unknown): MenuFileKind | null {
  if (typeof type !== "string" || type.length > 100) return null;
  const kind = type.slice(0, type.indexOf("/") === -1 ? 0 : type.indexOf("/")).toLowerCase();
  return (MENU_FILE_KINDS as readonly string[]).includes(kind) ? (kind as MenuFileKind) : null;
}

/**
 * A file's own name as it may go with the file: one line of plain text, `MENU_LIMITS.fileName` characters at most.
 * Undefined for anything else, and the file then goes without a name. Never cut to fit.
 */
export function menuFileName(name: unknown): string | undefined {
  return typeof name === "string" && !/[\\/]/.test(name) ? whole(name, MENU_LIMITS.fileName) : undefined;
}

/**
 * The type of something handed up to be saved, without what follows a `;` (a recorder adds how it packed a clip):
 * one of `MENU_SAVE_TYPES`, or null.
 */
export function menuSaveType(type: unknown): MenuSaveType | null {
  if (typeof type !== "string" || type.length > 100) return null;
  const plain = type.split(";")[0]!.trim().toLowerCase();
  return (MENU_SAVE_TYPES as readonly string[]).includes(plain) ? (plain as MenuSaveType) : null;
}

function readRow(raw: unknown, mayType: boolean, mayFile: boolean, o: MenuReadOptions): MenuRow | null {
  if (!isObject(raw)) return null;
  const rowId = id(raw.id);
  const label = line(raw.label, MENU_LIMITS.label);
  // An id that begins as a card's picture's does is no row's: a picture for it would be the card's.
  if (!rowId || !label || rowId.startsWith(MENU_CARD_PICTURE)) return null;
  const kind = raw.kind === undefined ? "button" : (MENU_ROW_KINDS as readonly unknown[]).includes(raw.kind) ? (raw.kind as MenuRowKind) : null;
  // A kind this doesn't know is left out: it is never guessed to be a button.
  if (!kind) return null;
  if (kind === "field" && !mayType) return null;
  if (kind === "file" && !mayFile) return null;
  const row: MenuRow = { id: rowId, label, kind };
  if (kind === "file") {
    // Only the kinds it names from the ones there are. A row that names none of them asks for nothing, and is left out.
    const asked: unknown[] = Array.isArray(raw.accept) ? raw.accept.slice(0, 8) : [];
    const accept = MENU_FILE_KINDS.filter((k) => asked.includes(k));
    if (!accept.length) return null;
    row.accept = accept;
  }
  if (kind === "copy") {
    const text = whole(raw.copy, MENU_LIMITS.copy);
    if (!text) return null;
    row.copy = text;
  }
  const short = line(raw.short, MENU_LIMITS.label);
  if (short) row.short = short;
  if (typeof raw.icon === "string" && ICON_NAME.test(raw.icon)) row.icon = raw.icon;
  if (typeof raw.on === "boolean") row.on = raw.on;
  if (raw.tone === "primary" || raw.tone === "warn") row.tone = raw.tone;
  if (typeof raw.color === "string" && COLOR.test(raw.color)) row.color = raw.color;
  if (kind === "swatch" && !row.color) return null;
  if (typeof raw.mark === "string" && ICON_NAME.test(raw.mark)) row.mark = raw.mark;
  if (raw.faint === true) row.faint = true;
  // Something to read, or to type into, is never on the bar. Nor is a row that takes a file: where the file goes
  // is written under it, and the bar has no room for that.
  if (raw.bar === true && kind !== "line" && kind !== "field" && kind !== "file") row.bar = true;
  if (raw.picture !== undefined && o.picture?.(raw.picture)) row.picture = raw.picture;
  return row;
}

function readCard(raw: unknown, o: MenuReadOptions): MenuCard | undefined {
  if (!isObject(raw)) return undefined;
  const title = line(raw.title, MENU_LIMITS.label);
  if (!title) return undefined;
  const card: MenuCard = { title };
  const tag = line(raw.tag, MENU_LIMITS.label);
  if (tag) card.tag = tag;
  // The mark for a name their own client vouched for is the client's to give. Drawn by the client on a world's
  // say-so, it would be the client vouching for what it hasn't checked: so it is taken only from the client's own
  // pages. A world may still write what it likes in `tag`, which is its own words.
  if (raw.proven === true && o.own) card.proven = true;
  const sub = line(raw.sub, MENU_LIMITS.label);
  if (sub) card.sub = sub;
  const copy = whole(raw.copy, MENU_LIMITS.copy);
  if (copy) card.copy = copy;
  const text = line(raw.text, MENU_LIMITS.note);
  if (text) card.text = text;
  if (typeof raw.color === "string" && COLOR.test(raw.color)) card.color = raw.color;
  if (Array.isArray(raw.now)) {
    const now = raw.now.slice(0, 8).flatMap((n) => line(n, MENU_LIMITS.label) ?? []);
    if (now.length) card.now = now;
  }
  if (Array.isArray(raw.acts)) {
    const acts = raw.acts.slice(0, 8).flatMap((a) => id(a) ?? []);
    if (acts.length) card.acts = acts;
  }
  if (raw.picture !== undefined && o.picture?.(raw.picture)) card.picture = raw.picture;
  return card;
}

function readState(raw: unknown): MenuState {
  const s = isObject(raw) ? raw : {};
  const room = isObject(s.room) ? s.room : {};
  const headset = isObject(s.headset) ? s.headset : {};
  const has = room.has === true;
  const n = typeof room.count === "number" && Number.isFinite(room.count) ? Math.min(9999, Math.max(0, Math.floor(room.count))) : 0;
  return {
    room: { has, joined: has && room.joined === true, mic: has && typeof room.mic === "boolean" ? room.mic : null, count: has ? n : 0 },
    headset: { supported: headset.supported === true, presenting: headset.supported === true && headset.presenting === true },
    named: s.named === true,
    signIn: (MENU_SIGN_IN as readonly unknown[]).includes(s.signIn) ? (s.signIn as MenuSignIn) : "none",
    holding: id(s.holding) ?? "",
    items: cleanItemsRule(s.items),
    hum: s.hum === true,
  };
}

/** Whether a world may fill this tab, and so whether its rows are taken: "world", "own" for one of its own, or null. */
function tabOf(name: string, o: MenuReadOptions): "world" | "own" | "visitor" | null {
  if ((MENU_WORLD_TABS as readonly string[]).includes(name)) return "world";
  if ((MENU_VISITOR_TABS as readonly string[]).includes(name)) return o.own || o.also?.includes(name) ? "visitor" : null;
  return "own";
}

/**
 * A world's description as a client keeps it: everything unknown, over a limit or not the world's to say left
 * out. Null if it isn't a description at all, or is over the limit on its size once read. Never throws.
 *
 * The work done is bounded whatever is sent: only the first tabs and rows up to the limits are looked at.
 */
export function cleanMenuWorld(input: unknown, opts: MenuReadOptions = {}): MenuWorld | null {
  if (!isObject(input)) return null;
  const world: MenuWorld = {
    title: line(input.title, MENU_LIMITS.title) ?? "",
    level: (LEVELS as readonly unknown[]).includes(input.level) ? (input.level as MenuWorld["level"]) : "full",
    keys: input.keys !== false,
    state: readState(input.state),
    target: [],
    loading: null,
    sections: [],
  };
  if ((CORNERS as readonly unknown[]).includes(input.corner)) world.corner = input.corner as NonNullable<MenuWorld["corner"]>;
  if (Array.isArray(input.target)) {
    const lines = input.target.slice(0, 6).map((t) => line(t, MENU_LIMITS.label));
    // Without a name for what is pointed at, the lines about it say nothing.
    if (lines[0]) world.target = lines.filter((t): t is string => !!t);
  }
  if (isObject(input.loading)) {
    const f = input.loading.fraction;
    world.loading = { fraction: typeof f === "number" && Number.isFinite(f) ? Math.round(Math.min(1, Math.max(0, f)) * 100) / 100 : null, words: line(input.loading.words, MENU_LIMITS.label) ?? "" };
  }

  const tabs = new Set<string>();
  const rows = new Set<string>();
  let own = 0;
  let all = 0;
  for (const raw of Array.isArray(input.sections) ? input.sections.slice(0, MENU_LIMITS.sections) : []) {
    if (!isObject(raw) || typeof raw.id !== "string" || !TAB_NAME.test(raw.id) || tabs.has(raw.id)) continue;
    const whose = tabOf(raw.id, opts);
    if (!whose) continue;
    const section: MenuSection = { id: raw.id, rows: [] };
    if (whose === "own") {
      // A tab of the world's own is named by the world, and there are only so many.
      const label = line(raw.label, MENU_LIMITS.label);
      if (!label || (!opts.own && own >= MENU_LIMITS.ownTabs)) continue;
      own++;
      section.label = label;
      if (typeof raw.icon === "string" && ICON_NAME.test(raw.icon)) section.icon = raw.icon;
    }
    tabs.add(raw.id);
    const note = line(raw.note, MENU_LIMITS.note);
    if (note) section.note = note;
    const mayType = !!opts.own || whose === "own" || whose === "visitor" || raw.id === "guests";
    // A file is taken only in Panels and in a world's own tabs.
    const mayFile = !!opts.own || whose === "own" || raw.id === "panels";
    for (const r of Array.isArray(raw.rows) ? raw.rows.slice(0, MENU_LIMITS.rows) : []) {
      if (all >= MENU_LIMITS.allRows) break;
      const row = readRow(r, mayType, mayFile, opts);
      // A press is by id, so an id said twice is the first one's.
      if (!row || rows.has(row.id)) continue;
      rows.add(row.id);
      section.rows.push(row);
      all++;
    }
    const card = readCard(raw.card, opts);
    if (card) {
      // A card's rows are this tab's own, and no others.
      if (card.acts) {
        const here = new Set(section.rows.map((r) => r.id));
        const acts = card.acts.filter((a) => here.has(a));
        if (acts.length) card.acts = acts;
        else delete card.acts;
      }
      section.card = card;
    }
    world.sections.push(section);
  }
  return menuBytes(world) > MENU_LIMITS.bytes ? null : world;
}

/** How big a description is, as the limit counts it: the bytes of its JSON, as UTF-8, without its pictures. */
export function menuBytes(world: MenuWorld): number {
  const text = JSON.stringify(world, (key, value: unknown) => (key === "picture" ? undefined : value));
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c <= 0xdbff ? (i++, 4) : 3;
  }
  return n;
}

/**
 * The visitor's settings as a client says them to a world: the settings that travel (settings.ts), and nothing a
 * link couldn't carry.
 *
 * "Load people's files from anywhere" is not among them. It is turned on by the visitor's own press for the one
 * place they are in, and that place keeps it: where a client draws the menu the row is still the world's, pressed
 * through the client. So nothing above a world can turn it on, and `filesAnywhere: true` from a client is dropped
 * exactly as a link's is. (`false` is still taken: turning it off is always safe.)
 */
export type MenuSettings = TravelSettings;

/** Settings as a client said them, cleaned as a link's are. Never throws. */
export function cleanMenuSettings(input: unknown): MenuSettings {
  return cleanSettings(input);
}

/**
 * The settings a world may report back, by name: comfort and layout, and nothing else. A world's report can never
 * turn a privacy switch on, or change who the visitor is, what they hold or what they see of other people.
 */
export const MENU_REPORTED = ["headset", "intense", "turn", "hand", "narrow", "fade", "look", "fov", "wrist", "sound", "motion", "text", "tabs", "pins"] as const;

/** What a client takes from the settings a world reported: the ones named in `MENU_REPORTED`, cleaned. Never throws. */
export function reportedSettings(input: unknown): TravelSettings {
  const clean = cleanSettings(input) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const name of MENU_REPORTED) if (clean[name] !== undefined) out[name] = clean[name];
  return out as TravelSettings;
}

/** What a client may say to a world. */
export type MenuWordDown =
  | { what: "has"; has: true; v: number; settings: MenuSettings }
  | { what: "has"; has: false }
  | { what: "settings"; settings: MenuSettings }
  | { what: "press"; press: string; field?: string; file?: undefined }
  | { what: "press"; press: string; file: Blob; kind: MenuFileKind; name?: string; field?: undefined }
  | { what: "open"; open: boolean }
  | { what: "go"; go: "home" }
  | { what: "sign"; sign: "out" };

/** What a world may say to a client. */
export type MenuWordUp =
  | { what: "world"; world: MenuWorld }
  | { what: "key"; key: MenuKey }
  | { what: "say"; say: string }
  | { what: "settings"; settings: TravelSettings }
  | { what: "picture"; id: string; picture: unknown }
  | { what: "save"; id: string; save: Blob; type: MenuSaveType };

const isMenu = (data: unknown): data is Record<string, unknown> => isObject(data) && data.nswp === "menu";
/** Only `settings` is said both ways. A word with anything of the other side's in it is not this side's to read. */
const DOWN_ONLY = ["has", "v", "press", "field", "file", "open", "go", "sign"] as const;
const UP_ONLY = ["world", "key", "say", "picture", "save", "id"] as const;
const hasAny = (data: Record<string, unknown>, names: readonly string[]): boolean => names.some((n) => data[n] !== undefined);

/**
 * A word from the page above, as a world reads it, or null if it is none of these words. One word says one thing:
 * the first of `has`, `settings`, `press`, `open`, `go`, `sign` that is there. A word with anything in it that only a world
 * says is not read at all. Never throws.
 *
 * A `press` is given whatever its id: only the world knows what it last described, and it checks. A press may
 * carry what was typed (`field`) or a file the visitor chose (`file`), never both. A file is given with its kind
 * and, where it has one that may go with it, its name; the world checks the kind against the row it described.
 */
export function readMenuWordDown(data: unknown): MenuWordDown | null {
  if (!isMenu(data) || hasAny(data, UP_ONLY)) return null;
  if (data.has === true) {
    const v = typeof data.v === "number" && Number.isInteger(data.v) && data.v >= 1 ? Math.min(data.v, MENU_VERSION) : null;
    return v ? { what: "has", has: true, v, settings: cleanMenuSettings(data.settings) } : null;
  }
  if (data.has === false) return { what: "has", has: false };
  if (data.settings !== undefined) return isObject(data.settings) ? { what: "settings", settings: cleanMenuSettings(data.settings) } : null;
  if (data.press !== undefined) {
    const press = id(data.press);
    if (!press) return null;
    if (data.file !== undefined) {
      // Carried as it is or not at all: a press whose file is too big, empty or of no kind a row takes is not a press.
      if (data.field !== undefined) return null;
      const file = fileOf(data.file, MENU_LIMITS.file);
      const kind = file && menuFileKind(file.type);
      if (!file || !kind) return null;
      const name = menuFileName((file as { name?: unknown }).name);
      return { what: "press", press, file, kind, ...(name ? { name } : {}) };
    }
    if (data.field === undefined) return { what: "press", press };
    // What was typed is carried whole or not at all: a press whose text is over the limit is not a press.
    if (typeof data.field !== "string" || data.field.length > MENU_LIMITS.field * 4 || UNSEEN_BUT_LINES.test(data.field) || count(data.field) > MENU_LIMITS.field) return null;
    return { what: "press", press, field: data.field };
  }
  if (typeof data.open === "boolean") return { what: "open", open: data.open };
  if (data.go === "home") return { what: "go", go: "home" };
  // Signing out of this world, at the visitor's press on their client's own row. It can only take away: the word
  // carries nothing, there is no word for signing in, and a world acts on it without asking.
  if (data.sign === "out") return { what: "sign", sign: "out" };
  return null;
}

/**
 * A word from the page in the frame, as a client reads it, or null if it is none of these words. One word says one
 * thing: the first of `world`, `key`, `say`, `settings`, `picture`, `save` that is there. A word with anything in
 * it that only a client says is not read at all. Never throws.
 *
 * A `save` is read here for what it is (a picture or a clip, within the limit, for a row by id). Whether it is the
 * answer to a press this client sent, and in time, only the client knows, and it checks.
 */
export function readMenuWordUp(data: unknown, opts: MenuReadOptions = {}): MenuWordUp | null {
  if (!isMenu(data) || hasAny(data, DOWN_ONLY)) return null;
  if (data.world !== undefined) {
    const world = cleanMenuWorld(data.world, opts);
    return world ? { what: "world", world } : null;
  }
  if (data.key !== undefined) return (MENU_KEYS as readonly unknown[]).includes(data.key) ? { what: "key", key: data.key as MenuKey } : null;
  if (data.say !== undefined) {
    const text = line(data.say, MENU_LIMITS.say);
    return text ? { what: "say", say: text } : null;
  }
  if (data.settings !== undefined) return isObject(data.settings) ? { what: "settings", settings: reportedSettings(data.settings) } : null;
  if (data.picture !== undefined) {
    const row = id(data.id);
    return row && opts.picture?.(data.picture) ? { what: "picture", id: row, picture: data.picture } : null;
  }
  if (data.save !== undefined) {
    const row = id(data.id);
    const file = fileOf(data.save, MENU_LIMITS.save);
    const type = file && menuSaveType(file.type);
    return row && file && type ? { what: "save", id: row, save: file, type } : null;
  }
  return null;
}

/** Whether a `here` says the world speaks these words, and which version of them is spoken with it: the lower. 0 for none. */
export function menuVersionOf(here: unknown): number {
  if (!isObject(here) || here.nswp !== "here") return 0;
  return typeof here.menu === "number" && Number.isInteger(here.menu) && here.menu >= 1 ? Math.min(here.menu, MENU_VERSION) : 0;
}
