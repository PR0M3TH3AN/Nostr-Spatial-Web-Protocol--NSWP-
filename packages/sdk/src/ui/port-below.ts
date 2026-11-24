/**
 * The client's end of the menu's port, where the client has the menu (protocol/02-doors.md, "The client has the
 * menu"; docs/plans/the-clients-menu.md).
 *
 * A client that keeps the screen shows a world in a frame and draws the visitor's menu above it, from its own copy of
 * the kit. This is what the menu is mounted on there: the client's own controls (the visitor's own tabs, the way
 * home), with the tabs the world describes laid in among them, and the words between the two pages carried for it.
 *
 * - A world's `here` that says it speaks the words is answered at once: this page has the menu.
 * - Everything a world says is read by the core's own reader and held to its limits before the menu sees any of it.
 * - A description lasts only as long as the page that sent it: it is dropped at every load of the frame.
 * - A press on something the world described goes down as a word. It is not the visitor's press in the world's
 *   page, so a row that copies is copied here, and a row typed into is typed here.
 * - Words go only to the origin that last said `here`, never to whatever happens to be in the frame.
 *
 * Nothing of the visitor's own tabs is ever said down: only their settings, and their presses on the world's rows.
 */
import { cleanMenuSettings, LEAVE_MS, MENU_CARD_PICTURE, menuFileKind, menuFileName, MENU_LIMITS, MENU_MAKING_MS, MENU_SAVE_MS, menuVersionOf, readMenuWordUp, type MenuCard, type MenuRow, type MenuCovers, type MenuSaveType, type MenuSettings, type MenuWorld, type TravelSettings } from "@nswp/core";
import { download } from "../save-file.js";
import { changeSettings, currentSettings } from "../settings.js";
import { ICONS, type IconName } from "./icons.js";
import { STANDARD_TABS, standardTab, type Controls, type UiAction, type UiCard, type UiItemView, type UiSectionView, type UiView } from "./model.js";
import type { WorldPort } from "./port.js";
import { sheetOf } from "./sheet-box.js";

/** Before the id of everything that is the world's, in what the menu draws: so a world's id can never be one of the client's own. */
export const WORLDS = "world:";

/** How long a world is given to say that what the visitor took up is in their hand, before it is taken not to be. */
const HOLD_MS = 4000;

/** The most keys on the bar: the client's own come first, then the world's while there is room. */
const BAR_MOST = 6;

const iconOf = (name: string | undefined): IconName | null => (name && Object.prototype.hasOwnProperty.call(ICONS, name) ? (name as IconName) : null);

const itemOf = (row: MenuRow, sent?: unknown, from?: string): UiItemView => ({
  ...(from ? { from } : {}),
  id: `${WORLDS}${row.id}`,
  label: row.label,
  icon: iconOf(row.icon),
  on: row.on ?? null,
  tone: row.tone ?? "normal",
  key: "",
  short: row.short ?? row.label,
  kind: row.kind,
  ...(row.kind === "copy" ? { copy: row.copy ?? "" } : {}),
  ...(row.kind === "file" ? { accept: row.accept ?? [] } : {}),
  color: row.color ?? "",
  mark: iconOf(row.mark),
  faint: row.faint === true,
  ...((sent ?? row.picture) !== undefined ? { picture: () => (sent ?? row.picture) as CanvasImageSource } : {}),
});

const cardOf = (card: MenuCard, sent?: unknown): UiCard => ({
  title: card.title,
  tag: card.tag ?? "",
  // Only ever so for a page of the client's own: the core's reader drops it from any other world.
  proven: card.proven === true,
  sub: card.sub ?? "",
  copy: card.copy ?? "",
  text: card.text ?? "",
  // An address a world names is never fetched: a world's picture crosses as a bitmap, or not at all.
  picture: "",
  color: card.color ?? "",
  now: card.now ?? [],
  ...((sent ?? card.picture) !== undefined ? { face: (sent ?? card.picture) as CanvasImageSource } : {}),
  ...(card.acts ? { acts: card.acts.map((id) => `${WORLDS}${id}`) } : {}),
});

/**
 * What the client's menu draws over a world: the client's own view, with what the world described laid in.
 *
 * - The world's name and address head it; how much room the console takes, and whether the keys are the world's,
 *   are the world's to say.
 * - A tab every place has keeps the client's name and icon for it, and the client's rows come first in it.
 * - A tab of the world's own stands after every other, and carries the world's name.
 * - The bar is the client's keys, then the world's while there is room; the visitor's pinned tabs follow.
 * - The look is the visitor's own. A world's colour doesn't tint the menu.
 */
export function mergeView(base: UiView, world: MenuWorld | null, from: { address: string; pins: readonly string[]; pictures?: ReadonlyMap<string, unknown> }): UiView {
  if (!world) return base;
  const order = (id: string) => {
    const i = STANDARD_TABS.indexOf(id);
    return i === -1 ? STANDARD_TABS.length : i;
  };
  const sections: UiSectionView[] = base.sections.map((s) => ({ ...s, items: [...s.items] }));
  const own: UiSectionView[] = [];
  const onBar: UiItemView[] = [];
  for (const said of world.sections) {
    const standard = standardTab(said.id);
    // In a tab the menu has its own name for, a world's rows carry the world's name, and stand below the menu's own.
    const whose = world.title || from.address;
    const items = said.rows.map((row) => itemOf(row, from.pictures?.get(row.id), standard ? whose : undefined));
    for (const [i, row] of said.rows.entries()) if (row.bar) onBar.push(items[i]!);
    const card = said.card ? cardOf(said.card, from.pictures?.get(`${MENU_CARD_PICTURE}${said.id}`)) : null;
    const there = sections.find((s) => s.id === said.id);
    if (there) {
      there.items.push(...items);
      there.card ??= card;
      // A world's words are never the menu's own: kept apart, to be shown after them under the world's name.
      if (said.note) there.said = { from: whose, note: said.note };
      continue;
    }
    const section: UiSectionView = {
      id: said.id,
      // A tab of the world's own carries the world's name, so that it is never taken for one of the visitor's.
      label: standard ? standard.label : `${said.label ?? said.id} · ${world.title || from.address}`.slice(0, MENU_LIMITS.label),
      icon: standard ? standard.icon : iconOf(said.icon),
      // In a tab of the world's own the name is on the tab, and its note is plainly its own.
      note: standard ? "" : (said.note ?? ""),
      ...(standard && said.note ? { said: { from: whose, note: said.note } } : {}),
      card,
      items,
      pinned: from.pins.includes(said.id),
    };
    if (standard) sections.push(section);
    else own.push(section);
  };
  // In the menu's own order, the client's own extra tabs after, and the world's own last of all.
  const shown = [...sections.map((s, i) => ({ s, i })).sort((a, b) => order(a.s.id) - order(b.s.id) || a.i - b.i).map((x) => x.s), ...own];
  const bar = [...base.hotbar, ...onBar].slice(0, BAR_MOST);
  const keyOf = new Map(bar.map((item, i) => [item.id, String(i + 1)]));
  for (const s of shown) s.items = s.items.map((item) => ({ ...item, key: keyOf.get(item.id) ?? "" }));
  return {
    ...base,
    title: world.title || base.title,
    address: from.address,
    target: world.target[0] ?? "",
    detail: world.target.slice(1),
    loading: world.loading,
    presence: world.level,
    corner: world.corner ?? base.corner,
    keys: world.keys ? base.keys : { menu: null, hotbar: false, chat: null },
    sections: shown,
    hotbar: bar.map((item) => ({ ...item, key: keyOf.get(item.id) ?? "" })),
    pins: from.pins.flatMap((id, i) => {
      const tab = shown.find((x) => x.id === id);
      const n = bar.length + i + 1;
      return tab ? [{ id, label: tab.label, icon: tab.icon, key: n <= 9 ? String(n) : "" }] : [];
    }),
  };
}

export interface MenuBelowOptions {
  /** The client's own controls: the visitor's own tabs, and the way home. */
  controls: Controls;
  /**
   * Visitor's tabs this client doesn't yet run itself, and so still takes from a world (the core's
   * `MenuReadOptions.also`). None, for a client that runs them all.
   */
  also?: readonly string[];
  /** The visitor's settings as they are now. By default what this page's own parts of the kit say they are. */
  settings?: () => MenuSettings;
  /**
   * Take the visitor home: send the frame there, whatever the world in it does. `left` is true where the world
   * didn't go by itself in time, so what was in the visitor's hand is not carried.
   */
  home?: (left: boolean) => void;
  /**
   * A world reported settings the visitor changed in its headset session: comfort and layout only, already cleaned
   * (the core's `MENU_REPORTED`), and taken only while the world says its session is running. Left out, they become
   * the visitor's settings in this page (`changeSettings`), and so are said to the next world. A client that keeps
   * the visitor's settings somewhere of its own takes them here.
   */
  onReported?: (settings: TravelSettings) => void;
  /** Whether something a world sent as a picture may be kept. By default a bitmap within the limit on its size. */
  picture?: (value: unknown) => boolean;
  /**
   * A world handed up a picture or a clip to be saved, as the answer to the visitor's press on a row that saves:
   * already checked for its kind and size, and named by this page (the world's name, the date and time, an ending
   * from its kind). Left out, this page saves it to the device as a download. A client that keeps the visitor's
   * files somewhere of its own takes it here instead. Either way the visitor is told, for a moment, what was saved
   * and from which world; return words of the client's own to say those instead.
   */
  onSave?: (file: Blob, about: SavedAbout) => string | void;
  /**
   * Whether the visitor's own music is playing in this page. A world is told when that changes, and once as it
   * comes up if it is playing then, so that it steps its own music back and the two aren't heard on top of one
   * another. Nothing of the music itself is said: not its name, not where it is from. It is read whenever the
   * controls say something changed, which the kit's Sound controls do as a song starts and stops. Left out, no
   * world is told anything.
   */
  playing?: () => boolean;
  /**
   * The frame's first page had already finished loading when this was made. Say so if it may have: a `here` is
   * told apart from the next page's by whether a load is still waiting for one (below).
   */
  loaded?: boolean;
  /** For tests: where words from the frame are heard. By default this page's window. */
  hear?: { addEventListener(type: "message", fn: (e: MessageEvent) => void): void; removeEventListener(type: "message", fn: (e: MessageEvent) => void): void };
  /** For tests: this page's own origin. */
  origin?: string;
  /** For tests: the size of this page's window, in pixels. By default the window's own. */
  view?: () => { w: number; h: number };
  /** For tests: the time, in milliseconds. */
  now?: () => number;
}

/** What a client is told of something a world handed up to be saved. */
export interface SavedAbout {
  /** The name this page gave it. A world never names a file on the visitor's device. */
  name: string;
  /** The world it came from: its title, or its address where it has none. */
  world: string;
  kind: "picture" | "clip";
  type: MenuSaveType;
}

const ENDING: Record<MenuSaveType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/webm": "webm", "video/mp4": "mp4" };
/** A name for a saved file, from the world's name and the time: plain letters, digits and hyphens. */
const savedName = (world: string, kind: "picture" | "clip", type: MenuSaveType, at: Date): string =>
  `${
    world
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "world"
  }-${kind === "clip" ? "clip-" : ""}${at.toISOString().slice(0, 19).replace(/[T:]/g, "-")}.${ENDING[type]}`;

export interface MenuBelow {
  /** What the menu is mounted on: `mountMenu(below.port)`. */
  readonly port: WorldPort;
  /** The origin of the page that last said `here`, or "" before any has since the frame last loaded. */
  readonly origin: string;
  /** Whether that page speaks the menu's words. A client draws no menu over one that doesn't: it draws its own. */
  readonly speaks: boolean;
  /** What the world last described, as it was kept, or null. */
  readonly world: MenuWorld | null;
  /** Be told when any of those change. Returns how to stop. */
  onChange(fn: () => void): () => void;
  /**
   * The menu that was mounted, so that the keys a world forwards act on it, and so that the world is told what of
   * its view the menu covers (`covers`): worked out here from the menu's own `cover()`, where its sheet is, and
   * where the frame is in this page. Nothing for a client to say. A menu with no `cover()` says nothing of it.
   */
  attach(menu: { pressKey(key: string): void; setOpen?(open: boolean, at?: string): void; cover?(): { top: number; bottom: number; left?: number; right?: number } } | null): void;
  /** The visitor's own Home was pressed: the world is told, and they are taken home within `LEAVE_MS` whatever it does. */
  leave(): void;
  /**
   * The visitor's own "Sign out here" was pressed: the world is told to sign them out. It can only take away, and
   * the world does it without asking. Whether it did is read from `world.state.named`.
   */
  signOut(): void;
  /**
   * The visitor took something up in this menu's Bag, or put what they held away (`""`): the world is told. It
   * takes a thing in hand only if it is in their own bag as they signed it, and where it lets things be carried,
   * so this waits for the world to say what is in hand (`world.state.holding`) and resolves whether it is this.
   *
   * `script` is the mark of the item's own logic (its SHA-256), said only where the visitor has let that logic run,
   * in this menu: a thing that does things of its own is asked about before it is first held, and that asking is
   * the Bag's own, here. A world lets a thing's logic run unasked only for the very script named.
   */
  hold(item: string, how?: { tints?: Record<string, string>; script?: string }): Promise<boolean>;
  dispose(): void;
}

/** How long after a world says it is making something to save the visitor is told so, if it hasn't come. */
const MAKING_SAID_MS = 1500;

const isBitmap = (value: unknown): boolean => typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap && value.width <= MENU_LIMITS.picture && value.height <= MENU_LIMITS.picture;

/** The client's end of the port, for the frame the world is shown in. */
export function portBelow(frame: HTMLIFrameElement, opts: MenuBelowOptions): MenuBelow {
  const { controls } = opts;
  const hear: NonNullable<MenuBelowOptions["hear"]> = opts.hear ?? {
    addEventListener: (type, fn) => window.addEventListener(type, fn),
    removeEventListener: (type, fn) => window.removeEventListener(type, fn),
  };
  const self = opts.origin ?? location.origin;
  // "Load people's files from anywhere" is never said down, on or off: it is for one place, the visitor's own press
  // on that place's own row, and that place keeps it. A client that said "off" with everything else would turn it
  // off in every world it showed.
  // What is in hand is not said with the rest either: this page knows it only from the world, and saying it back
  // would be the world's own word returned to it. It is said when the visitor takes something up or puts it away
  // in this menu (`hold`, below), and at no other time.
  const settingsNow = (): MenuSettings => {
    const { filesAnywhere: _notSaid, holding: _saidAtAPress, ...rest } = cleanMenuSettings(opts.settings ? opts.settings() : currentSettings());
    return rest;
  };
  const watchers = new Set<() => void>();
  const viewers = new Set<() => void>();
  const sayers = new Set<(text: string) => void>();
  let origin = "";
  let speaks = false;
  let world: MenuWorld | null = null;
  /** The visitor's last press on a row that saves: what the world may still hand up for it, and until when. */
  let saving: { id: string; at: number; until: number; left: number; making: boolean } | null = null;
  const now = opts.now ?? (() => performance.now());
  /** Told that it is being made, if it hasn't come in a moment; and told once more if it never came. */
  let slow: ReturnType<typeof setTimeout> | null = null;
  let overdue: ReturnType<typeof setTimeout> | null = null;
  const forget = () => {
    saving = null;
    if (slow) clearTimeout(slow);
    if (overdue) clearTimeout(overdue);
    slow = overdue = null;
  };
  /** What the world in the frame was last told of the visitor's own music. A page newly up has been told nothing. */
  let saidPlaying = false;
  const sayPlaying = () => {
    const on = speaks && opts.playing?.() === true;
    if (on === saidPlaying) return;
    saidPlaying = on;
    if (speaks) say({ playing: on });
  };
  /** The pictures a world sent, each alone, by the id of the row it is for, or `card:<tab>` for a tab's card. */
  const pictures = new Map<string, unknown>();
  let menu: { pressKey(key: string): void; setOpen?(open: boolean, at?: string): void; cover?(): { top: number; bottom: number; left?: number; right?: number } } | null = null;
  let open = false;
  let saidSettings = "";
  let leaving: ReturnType<typeof setTimeout> | null = null;

  const changed = () => {
    for (const fn of [...viewers]) fn();
    for (const fn of [...watchers]) fn();
    // What a world says of itself is drawn in this page's menu (its name and address, in the marks), and can change
    // how much of the frame the menu covers. Found by the trial: the marks grew by a line as the name arrived.
    coversMayHaveChanged();
  };
  // What this page's menu covers of the world's view, said to the world so that it can keep what matters clear of
  // it (`covers`). The world's view is the frame. Each edge is how far the menu reaches into the frame from that
  // edge, for what is always there (the marks, the bar); the sheet, while it is up, is said as its box in the frame.
  // In pixels of the world's own page: a frame this page has scaled is measured as the world measures itself.
  // Said with the answer that this page has the menu, and after that only when a number changes, no oftener than
  // eight times a second. A sheet on its way up or down is not said until it has come to rest.
  const COVERS_MS = 125;
  const clock = opts.now ?? (() => performance.now());
  let saidCovers = "";
  let coversAt = -Infinity;
  let coversTimer: ReturnType<typeof setTimeout> | null = null;
  const coversNow = (): MenuCovers | "moving" | null => {
    if (!menu?.cover || typeof frame.getBoundingClientRect !== "function") return null;
    const f = frame.getBoundingClientRect();
    if (!(f.width > 0 && f.height > 0)) return null;
    const win = opts.view?.() ?? { w: innerWidth, h: innerHeight };
    const scale = frame.offsetWidth > 0 ? f.width / frame.offsetWidth : 1;
    const px = (n: number, most: number) => Math.min(MENU_LIMITS.covers, Math.round(Math.max(0, Math.min(n, most)) / scale));
    const c = menu.cover();
    const covers: MenuCovers = {
      top: px(c.top - f.top, f.height),
      bottom: px(f.bottom - (win.h - c.bottom), f.height),
      left: px((c.left ?? 0) - f.left, f.width),
      right: px(f.right - (win.w - (c.right ?? 0)), f.width),
    };
    const sheet = sheetOf(menu);
    if (sheet.moving) return "moving";
    if (sheet.box) {
      // As much of the sheet as is over the frame.
      const x0 = Math.max(sheet.box.x, f.left);
      const y0 = Math.max(sheet.box.y, f.top);
      const x1 = Math.min(sheet.box.x + sheet.box.width, f.right);
      const y1 = Math.min(sheet.box.y + sheet.box.height, f.bottom);
      if (x1 > x0 && y1 > y0) covers.sheet = { x: px(x0 - f.left, f.width), y: px(y0 - f.top, f.height), width: px(x1 - x0, f.width), height: px(y1 - y0, f.height) };
    }
    return covers;
  };
  const sayCovers = () => {
    coversTimer = null;
    if (!speaks) return;
    const covers = coversNow();
    if (covers === "moving") return void (coversTimer = setTimeout(sayCovers, COVERS_MS));
    if (!covers) return;
    const text = JSON.stringify(covers);
    if (text === saidCovers) return;
    saidCovers = text;
    coversAt = clock();
    say({ covers });
  };
  /** Something that may have changed what the menu covers: looked at once the page has drawn it, and not too often. */
  const coversMayHaveChanged = () => {
    if (coversTimer || !speaks) return;
    coversTimer = setTimeout(sayCovers, Math.max(50, coversAt + COVERS_MS - clock()));
  };
  const onResize = () => coversMayHaveChanged();
  if (typeof addEventListener === "function") addEventListener("resize", onResize);
  const watchFrame = typeof ResizeObserver === "function" && typeof frame.getBoundingClientRect === "function" ? new ResizeObserver(onResize) : null;
  watchFrame?.observe(frame);

  // A world asks for the menu to come up on a tab (`show`): one of its own rows was pressed. It is honoured, and
  // a world can never hold the menu up with it against the visitor, or move them about in it:
  //
  // - **It never puts the menu away.** Only the visitor does.
  // - **With the menu up, only in answer to a press.** The one reason to change tab under a visitor is that they
  //   pressed a row of the world's in this menu. So it is honoured only within a second of a press this page sent
  //   that world, and once for each press.
  // - **With the menu down, the visitor's closing wins.** For two seconds after they put the menu away, nothing a
  //   world says brings it back. If what they put away was a menu that `show` had brought up, and they pressed
  //   nothing in it, that rest doubles each time in a row, to a minute at the most; it goes back to two seconds
  //   once they press something in the menu, or put away a menu they brought up themselves.
  // - A tab this menu doesn't have is no tab named: the menu comes up where it last was.
  const SHOW_AFTER_PRESS_MS = 1000;
  const SHOW_REST_MS = 2000;
  const SHOW_REST_MOST_MS = 60_000;
  let pressedAt = -Infinity;
  let showRestUntil = -Infinity;
  let showStrikes = 0;
  let broughtByShow = false;
  let usedSinceShow = false;
  const shown = (tab: string | undefined) => {
    if (!menu?.setOpen) return;
    const at = tab && port.view().sections.some((s) => s.id === tab) ? tab : undefined;
    if (open) {
      if (clock() - pressedAt > SHOW_AFTER_PRESS_MS) return;
      pressedAt = -Infinity;
      if (at) menu.setOpen(true, at);
      return;
    }
    if (clock() < showRestUntil) return;
    broughtByShow = true;
    usedSinceShow = false;
    menu.setOpen(true, at);
  };
  /** A press in this menu went to the world: the visitor is using the menu, and the world may answer with a tab. */
  const pressed = () => {
    pressedAt = clock();
    usedSinceShow = true;
    showStrikes = 0;
  };
  /** The menu came up or went: kept, for what the next `show` may do. */
  const showKnows = (up: boolean) => {
    if (up) return;
    showStrikes = broughtByShow && !usedSinceShow ? Math.min(showStrikes + 1, 8) : 0;
    showRestUntil = clock() + Math.min(SHOW_REST_MOST_MS, SHOW_REST_MS * 2 ** showStrikes);
    broughtByShow = false;
  };

  /** Only to the page that said `here`: never to whatever is in the frame now. */
  const say = (word: Record<string, unknown>) => {
    if (!speaks || !origin) return;
    try {
      frame.contentWindow?.postMessage({ ...word, nswp: "menu" }, origin);
    } catch {
      /* the frame has gone */
    }
  };
  const drop = () => {
    const had = !!world || speaks || !!origin;
    origin = "";
    speaks = false;
    world = null;
    forget();
    saidPlaying = false;
    pictures.clear();
    saidSettings = "";
    saidCovers = "";
    if (had) changed();
  };
  // A page says `here` as its script starts, which is usually before the frame's own load is told, and sometimes
  // after. So a `here` belongs to the load that is waiting for one, if one is; and otherwise to the load about to
  // come, which then keeps it. Every other load drops what was there: one world's name and tabs never stand over the
  // next page, or over a page that says nothing.
  let awaiting = opts.loaded === true;
  let early = false;
  const onLoad = () => {
    if (leaving) clearTimeout(leaving);
    leaving = null;
    if (early) {
      early = false;
      awaiting = false;
      return;
    }
    awaiting = true;
    drop();
  };
  frame.addEventListener("load", onLoad);

  const onMessage = (e: MessageEvent) => {
    if (e.source !== frame.contentWindow || !e.data || typeof e.data !== "object") return;
    const data = e.data as { nswp?: unknown };
    if (data.nswp === "here") {
      // A new page is up in the frame. Said after its load, it is that load's; said before, it is the next one's.
      if (awaiting) awaiting = false;
      else early = true;
      world = null;
      forget();
      saidPlaying = false;
      pictures.clear();
      origin = typeof e.origin === "string" ? e.origin : "";
      speaks = menuVersionOf(data) > 0 && !!origin && origin !== "null";
      if (speaks) {
        const settings = settingsNow();
        saidSettings = JSON.stringify(settings);
        say({ has: true, v: menuVersionOf(data), settings });
        // What the menu covers of this world's view, with the answer: a new page has been told nothing of it.
        saidCovers = "";
        if (coversTimer) clearTimeout(coversTimer);
        sayCovers();
        if (open) say({ open: true });
        // Their own music, if it is playing as this world comes up: said once, after the rest.
        sayPlaying();
      }
      return changed();
    }
    if (data.nswp !== "menu" || !speaks || e.origin !== origin) return;
    const word = readMenuWordUp(data, { own: origin === self, ...(opts.also ? { also: opts.also } : {}), picture: opts.picture ?? isBitmap });
    if (!word) return;
    if (word.what === "world") {
      world = word.world;
      // A picture lasts as long as the thing it is of: gone with a row or a card the world no longer describes.
      const still = new Set(world.sections.flatMap((s) => [...s.rows.map((r) => r.id), ...(s.card ? [`${MENU_CARD_PICTURE}${s.id}`] : [])]));
      for (const key of [...pictures.keys()]) if (!still.has(key)) pictures.delete(key);
      return changed();
    }
    if (word.what === "key") return void menu?.pressKey(word.key);
    if (word.what === "show") return void shown(word.show);
    // Shown under the world's name: a world's words are never put in the client's mouth.
    if (word.what === "say") {
      const text = `${world?.title || new URL(origin).host}: ${word.say}`;
      for (const fn of [...sayers]) fn(text);
      return;
    }
    // Only while its headset session runs, where only the world can draw the console.
    // Taken as the visitor's own, in this page, unless the client says what to do with them: each part here that
    // holds one takes it, and it is said to the next world with the rest.
    if (word.what === "settings") return void (world?.state.headset.presenting && (opts.onReported ?? changeSettings)(word.settings));
    // Something to save. Only as the answer to a press this page sent on a row that saves, for that row, in time,
    // and only so many: a world can't put a file on the visitor's device unasked. The name is this page's own.
    // The world is making what the press asked for, and it may take a while (a slow device). Only for the press
    // that is waiting, only in its first while, and only once: the press is then held open for longer, counted from
    // the press itself, so no world can hold one open by saying this again. The visitor is told, in this page's
    // words, and told again if nothing came of it.
    if (word.what === "making") {
      if (!saving || saving.id !== word.id || saving.making || saving.left < MENU_LIMITS.saves || now() > saving.until) return;
      const held = saving;
      held.making = true;
      held.until = held.at + MENU_MAKING_MS;
      const from = world?.title || host();
      const waiting = () => saving === held && held.left === MENU_LIMITS.saves;
      // Most pictures come at once, and then only the saving is said. One that hasn't come in a moment is said to
      // be on its way, so that a press is never met with nothing.
      slow = setTimeout(() => {
        slow = null;
        if (waiting()) controls.say(`${from} is making it. It will be saved when it is ready.`);
      }, MAKING_SAID_MS);
      overdue = setTimeout(() => {
        overdue = null;
        if (!waiting()) return;
        saving = null;
        controls.say(`Nothing came from ${from} to save. Press again to try once more.`);
      }, Math.max(0, held.until - now()));
      return;
    }
    if (word.what === "save") {
      if (!saving || saving.id !== word.id || now() > saving.until || saving.left < 1) return;
      saving.left--;
      const kind = word.type.startsWith("video/") ? "clip" : "picture";
      const from = world?.title || host();
      const name = savedName(from, kind, word.type, new Date());
      const own = opts.onSave ? opts.onSave(word.save, { name, world: from, kind, type: word.type }) : download(word.save, name);
      // Never silent: what was saved, and from which world, in this page's own words.
      controls.say(typeof own === "string" && own ? own.slice(0, MENU_LIMITS.say) : `${kind === "clip" ? "A clip" : "A picture"} from ${from} was saved${opts.onSave ? "" : " to this device"}.`);
      return;
    }
    // Only for a row or a card of the last description: a picture is never kept for something that isn't there.
    if (word.what === "picture" && world) {
      const there = world.sections.some((s) => (s.card && `${MENU_CARD_PICTURE}${s.id}` === word.id) || s.rows.some((r) => r.id === word.id));
      if (!there) return;
      pictures.set(word.id, word.picture);
      changed();
    }
  };
  hear.addEventListener("message", onMessage);

  // The visitor changed a setting in this menu: the world hears, and applies what is its to apply.
  const stopControls = controls.subscribe(() => {
    sayPlaying();
    if (speaks) {
      const settings = settingsNow();
      const text = JSON.stringify(settings);
      if (text !== saidSettings) {
        saidSettings = text;
        say({ settings });
      }
    }
    for (const fn of [...viewers]) fn();
    // A setting can change the size of the bar and the marks (the size of text), or take them away (quiet).
    coversMayHaveChanged();
  });

  const rowOf = (id: string): MenuRow | null => {
    if (!world || !id.startsWith(WORLDS)) return null;
    const rowId = id.slice(WORLDS.length);
    for (const s of world.sections) for (const row of s.rows) if (row.id === rowId) return row;
    return null;
  };
  const host = () => {
    try {
      return origin ? new URL(origin).host : "";
    } catch {
      return "";
    }
  };

  const port: WorldPort = {
    view: () => mergeView(controls.view(), speaks ? world : null, { address: host(), pins: controls.pins, pictures }),
    subscribe(fn) {
      viewers.add(fn);
      return () => void viewers.delete(fn);
    },
    run(id, typed, file) {
      // A press on anything of this page's takes the keys from the frame, and the world stops hearing them: walking
      // stops. So with the menu down they are given back once the press has been taken, whatever it did.
      if (!open) setTimeout(() => !open && frame.focus(), 0);
      if (!id.startsWith(WORLDS)) return controls.run(id, typed, file);
      const row = rowOf(id);
      // Only for something in the world's last description, and something that can be pressed.
      if (!row || row.kind === "line") return false;
      if (row.kind === "file") {
        // The file the visitor chose in this page's chooser, as it is, to the one world that described the row. It is
        // checked here whoever drew the menu: one of the kinds the row asked for, within the limit. Its own name goes
        // with it only where a name may; otherwise the file goes without one.
        const kind = file ? menuFileKind(file.type) : null;
        if (!file || !kind || !row.accept?.includes(kind) || file.size < 1 || file.size > MENU_LIMITS.file) return false;
        controls.signal("press");
        const name = (file as { name?: unknown }).name;
        pressed();
        say({ press: row.id, file: name === undefined || menuFileName(name) ? file : file.slice(0, file.size, file.type) });
        return true;
      }
      // A row that saves: what the world hands up for it, for a while after this press, is saved here.
      if (row.kind === "save") {
        forget();
        const at = now();
        saving = { id: row.id, at, until: at + MENU_SAVE_MS, left: MENU_LIMITS.saves, making: false };
      }
      controls.signal("press");
      pressed();
      say({ press: row.id, ...(row.kind === "field" && typed !== undefined ? { field: typed.slice(0, MENU_LIMITS.field) } : {}) });
      return true;
    },
    say: (text) => controls.say(text),
    onSay(fn) {
      sayers.add(fn);
      const stop = controls.onSay(fn);
      return () => {
        sayers.delete(fn);
        stop();
      };
    },
    signal(name) {
      controls.signal(name);
      if (name !== "menuOpen" && name !== "menuClose") return;
      open = name === "menuOpen";
      showKnows(open);
      say({ open });
      coversMayHaveChanged();
      // While the menu is up this page has the keys, so nothing typed in it reaches the world. As it goes, they go
      // back to the frame: a page above a frame hears no key the frame doesn't forward, and the frame none while this
      // page has them.
      if (!open) frame.focus();
    },
    onSignal: (fn) => controls.onSignal(fn),
    setPinned: (tab, pinned) => controls.setPinned(tab, pinned),
    get presence() {
      return speaks && world ? world.level : controls.presence;
    },
    get theme() {
      return controls.theme;
    },
    get chat() {
      return controls.chat;
    },
    get feed() {
      return controls.feed;
    },
    get letters() {
      return controls.letters;
    },
  };

  return {
    port,
    get origin() {
      return origin;
    },
    get speaks() {
      return speaks;
    },
    get world() {
      return world;
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
    attach(next) {
      menu = next;
      coversMayHaveChanged();
    },
    leave() {
      if (leaving) return;
      const from = origin;
      say({ go: "home" });
      // The world may go by itself, carrying what the visitor carries: then the frame loads, and this is put away.
      // If it hasn't in `LEAVE_MS`, or it never spoke the words, the client takes them home itself.
      if (!speaks) return void opts.home?.(false);
      leaving = setTimeout(() => {
        leaving = null;
        if (origin === from) opts.home?.(true);
      }, LEAVE_MS);
    },
    signOut() {
      say({ sign: "out" });
    },
    hold(item, how = {}) {
      if (!speaks) return Promise.resolve(false);
      say({ settings: { holding: item ? { item, ...(how.tints && Object.keys(how.tints).length ? { tints: how.tints } : {}), ...(how.script ? { script: how.script } : {}) } : "" } });
      const held = () => (world?.state.holding ?? "") === item;
      if (held()) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        const done = (ok: boolean) => {
          clearTimeout(giveUp);
          watchers.delete(look);
          resolve(ok);
        };
        const look = () => void (held() && done(true));
        const giveUp = setTimeout(() => done(held()), HOLD_MS);
        watchers.add(look);
      });
    },
    dispose() {
      if (leaving) clearTimeout(leaving);
      forget();
      frame.removeEventListener("load", onLoad);
      hear.removeEventListener("message", onMessage);
      stopControls();
      if (coversTimer) clearTimeout(coversTimer);
      if (typeof removeEventListener === "function") removeEventListener("resize", onResize);
      watchFrame?.disconnect();
      watchers.clear();
      viewers.clear();
      sayers.clear();
      menu = null;
    },
  };
}

/**
 * The client's own rows, under You, for signing in to the world in the frame and out of it. You is the visitor's
 * own tab, and a world never puts a row in it: a sign-in row under a world's name, naming a host, is exactly what a
 * visitor should never be taught to trust. So the world says only facts (`state.named`, `state.signIn`), and these
 * words are the menu's own, the same in every client.
 *
 * - Signing in opens the sign-in address's own panel for the world in the frame, which is the client's to do
 *   (`ask`): a world's word can't open it.
 * - Signing out tells the world, which does it without asking (`below.signOut`).
 * - Where the world names nothing that signs for a visitor, neither row is shown.
 */
export function signInRows(below: Pick<MenuBelow, "world" | "signOut">, opts: { ask(): void }): UiAction[] {
  const state = () => below.world?.state;
  const where = () => below.world?.title || "this world";
  return [
    {
      id: "world-sign-in",
      section: "you",
      icon: "key",
      hidden: () => !state() || state()!.named || state()!.signIn === "none",
      label: () => (state()?.signIn === "asking" ? "Asking your sign-in address…" : state()?.signIn === "unanswered" ? "Your sign-in address didn't answer. Press to try again." : `Sign in to ${where()}`),
      short: "Sign in",
      act: () => opts.ask(),
    },
    {
      id: "world-sign-out",
      section: "you",
      icon: "key",
      on: () => true,
      hidden: () => !state()?.named,
      label: () => `Signed in to ${where()}. Sign out here`,
      short: "Sign out",
      act: () => below.signOut(),
    },
  ];
}
