/**
 * The kit's own menu and sounds, for an engine that isn't JavaScript's.
 *
 * A world made in another engine draws its own place. What a visitor uses to
 * get about in it should still be what they know from every other world: the
 * same menu in the same corner, the same sounds at the same volumes they set,
 * the same words on the same controls. None of that needs a renderer. The
 * menu is drawn by the page over the engine's canvas, and the sounds are made
 * by the page beside the engine's own.
 *
 * So this is the reference kit's menu (`ui/`) and its sounds (`sound.ts`)
 * themselves, not a copy of them, with a way for an engine to hear what the
 * visitor chose. As everywhere in the engine script, text goes in and text
 * comes out: the engine asks for what happened since it last asked.
 *
 *   NSWP.menu('{"title":"My world","kit":"sounds/kit/"}');
 *   // every frame:
 *   for (const e of JSON.parse(NSWP.events())) ...   // {"type":"moving","moving":"intense"}
 *   NSWP.moved(0.04);                                // they walked that far: steps are heard
 *   NSWP.play("cross");
 *
 * What the engine still does itself: move the visitor, draw the doors, and
 * start a headset session when asked to.
 */
import { checkDestination, isLocalHost, ITEM_RULES, worldOffers, type ItemsRule } from "@nswp/core";
import { addGateControls, type PaidGate } from "./front-room.js";
import { ICONS } from "./ui/icons.js";
import { OFFER_ICONS } from "./offer-icons.js";
import { DESK_WORDS, hasMouse, keepIntense, LOOK_SPEED, PITCH_LIMIT, SPRINT, startsIntense } from "./fps.js";
import { DOOR_REACH, DOOR_SPACING, PORTAL_HEIGHT, PORTAL_SIGN_HEIGHT, PORTAL_SPRING, PORTAL_WIDTH } from "./gate-size.js";
import { arrival, portal } from "./index.js";
import { addSoundControls, createSounds, CUES, type Cue, type Sounds, type SoundTheme } from "./sound.js";
import { JUMP_GRAVITY, JUMP_HEIGHT } from "./jump.js";
import { DOUBLE_TAP, DRAG_LOOK, FACE_RATE, PATH_MOST, TAP_REACH, TOP_SPEED, WALK_SPEED } from "./stroll.js";
import { freshAction } from "./ui/fresh.js";
import { fullscreenAction } from "./ui/fullscreen.js";
import { offerHeadset, type HeadsetOffer } from "./ui/headset.js";
import { addDeskControls, lookScale, visitorFov } from "./desk.js";
import { reportSettings } from "./settings.js";
import { accountAction, filesAction, libraryAction, hereAs, identityHost, identitySection, identityWords, onHereAs, signerAction, signerNamed, worldGate, worldSaves } from "./ui/identity.js";
import { mountHud, type Hud } from "./ui/hud.js";
import { createControls, type Controls } from "./ui/model.js";

const read = (text: unknown): Record<string, unknown> => {
  try {
    const v: unknown = typeof text === "string" && text ? JSON.parse(text) : text;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const words = (v: unknown, most: number): string => (typeof v === "string" ? v.slice(0, most) : "");

/** What happened that the engine should know of, until it asks. Never more than a frame or two's worth. */
const queue: Record<string, unknown>[] = [];
const tell = (event: Record<string, unknown>): void => {
  if (queue.length < 64) queue.push(event);
};
/** For the rest of the engine's script to tell the engine something the same way. */
export const tellEngine = tell;
/** The menu and the sounds, once the world has asked for them: for the rest of the engine's script to add to. */
export const engineParts = (): { controls: Controls; sounds: Sounds; presenting: boolean } | null => (controls && sounds ? { controls, sounds, presenting: vr.presenting } : null);
/** Told once, when the world asks for its menu: its name and colour, and whether it will open the crossing's doors itself. */
const menuWatchers = new Set<(look: { title: string; accent?: string; hold: boolean }) => void>();
export const onMenu = (fn: (look: { title: string; accent?: string; hold: boolean }) => void): void => void menuWatchers.add(fn);

let controls: Controls | null = null;
let hud: Hud | null = null;
let sounds: Sounds | null = null;
let moving: "casual" | "intense" = "casual";
const vr = { supported: false, presenting: false };
/** The world's name, for the offer below. */
let named = "";
/** The way back into a headset, while it is offered, and whether it has been: it is offered once. */
let headsetOffer: HeadsetOffer | null = null;
let headsetOffered = false;
const doors = new Map<string, string>();

/**
 * The numbers every world shares, and the two a visitor sets for themselves
 * (how fast the view turns, how wide they see), as JSON: how fast a visitor walks, how far
 * a tap takes them, how a drag and a mouse turn the view, and the size of the standard
 * doorway. An engine reads them here so that they are the kit's and not a
 * copy that drifts. Lengths are metres, angles radians, speeds per second.
 */
export function kit(): string {
  return JSON.stringify({
    walkSpeed: WALK_SPEED,
    // The fastest anyone goes on foot: a run. However an engine moves its visitor, never faster than this.
    topSpeed: TOP_SPEED,
    tapReach: TAP_REACH,
    sprint: SPRINT,
    // Both as the visitor has set them: the kit's own speed times theirs. Read again when a `changed` event comes.
    dragLook: DRAG_LOOK * lookScale(),
    lookSpeed: LOOK_SPEED * lookScale(),
    // How wide they asked to see at a desk, in degrees top to bottom, or 0 for the world's own.
    fov: visitorFov() ?? 0,
    pitchLimit: PITCH_LIMIT,
    doubleTap: DOUBLE_TAP,
    pathMost: PATH_MOST,
    faceRate: FACE_RATE,
    jumpHeight: JUMP_HEIGHT,
    jumpGravity: JUMP_GRAVITY,
    gateWidth: PORTAL_WIDTH,
    gateHeight: PORTAL_HEIGHT,
    gateSpring: PORTAL_SPRING,
    gateSignHeight: PORTAL_SIGN_HEIGHT,
    doorReach: DOOR_REACH,
    // The least distance between two doors' middles: lay doors out no nearer than this.
    doorSpacing: DOOR_SPACING,
    cues: CUES,
  });
}

/**
 * How a door's address should be read on its sign, as JSON: `domain` is the
 * part that says whose site it is, and `prefix` what comes before it. A sign
 * shows the domain, never a name alone. `ok` is false, with `code` saying
 * why, for an address a door can't lead to.
 */
export function check(url: string): string {
  const c = checkDestination(typeof url === "string" ? url : "");
  if (!c.ok) return JSON.stringify({ ok: false, code: c.error.code, domain: "", prefix: "", host: "" });
  return JSON.stringify({ ok: true, code: "", domain: c.value.registrableDomain ?? c.value.hostname, prefix: c.value.hostPrefix, host: c.value.hostname });
}

/**
 * What a world offers, for the tiles beside its door, as JSON: twelve lines
 * in a set order, each with `id`, `on` (the world's announcement says it),
 * `name`, `words` (one sentence, for whichever case it is) and `onDoor`. The
 * seven a door shows also have `icon`: the kit's line drawing for it, as SVG
 * path data on a 24-unit square. Draw them lit where `on`, dark where not,
 * and say `words` when one is pointed at. `world` is JSON with what the
 * place's announcement says: `modes`, `capabilities`, and `items` and
 * `access` where it says them. Anything else in it is not read, and a world
 * it can't read offers nothing.
 */
export function offers(world: string): string {
  let said: { modes?: unknown; capabilities?: unknown; items?: unknown; access?: unknown } = {};
  try {
    const read: unknown = JSON.parse(typeof world === "string" ? world : "");
    if (read && typeof read === "object") said = read as typeof said;
  } catch {
    /* nothing said */
  }
  const words = (list: unknown) => (Array.isArray(list) ? list.filter((w): w is string => typeof w === "string") : []);
  const items = typeof said.items === "string" && (ITEM_RULES as readonly string[]).includes(said.items) ? (said.items as ItemsRule) : undefined;
  const lines = worldOffers({ modes: words(said.modes), capabilities: words(said.capabilities), ...(items ? { items } : {}), ...(said.access ? { access: said.access as never } : {}) });
  return JSON.stringify(lines.map((o) => ({ ...o, ...(o.onDoor ? { icon: ICONS[OFFER_ICONS[o.id as keyof typeof OFFER_ICONS]] } : {}) })));
}

/**
 * Put the kit's menu over the engine's canvas, and start its sounds. Call it
 * once, after `start()`. `options` is JSON:
 *
 * - `title`: the world's name.
 * - `accent`: its colour, as `#rrggbb`. The visitor's own choice of look overrides it.
 * - `kit`: where the page serves the kit's sound files (a folder holding `sounds.json`), for example `"sounds/kit/"`.
 *   Left out, the sounds are the ones made in the browser.
 * - `sounds`: the world's own sounds, as in a world's settings (`docs/controls-kit.md`, "Sound"). Left out, the defaults.
 * - `help`: a few lines for the Help section.
 *
 * Returns JSON: `moving` is how the visitor starts out moving ("casual" or
 * "intense": as they arrived, or as they chose here before), and `mouse`
 * whether there is a mouse to move the intense way with.
 */
export function menu(options?: string): string {
  if (controls) return JSON.stringify({ moving, mouse: hasMouse() });
  const o = read(options);
  const title = words(o.title, 80) || "A world";
  named = title;
  const accent = /^#[0-9a-f]{6}$/i.test(String(o.accent)) ? String(o.accent) : undefined;
  const c = (controls = createControls({ title, address: location.host, ...(accent ? { theme: { accent } } : {}) }));
  for (const fn of menuWatchers) fn({ title, ...(accent ? { accent } : {}), hold: o.hold === true });
  const h = (hud = mountHud(c));
  const s = (sounds = createSounds({
    seed: title,
    ...(typeof o.kit === "string" && o.kit ? { kit: o.kit } : {}),
    ...(o.sounds && typeof o.sounds === "object" ? { theme: o.sounds as SoundTheme } : {}),
  }));
  addSoundControls(c, s);
  // The latest, always, as in a Three.js world (ui/fresh.ts).
  c.add(freshAction(c, { busy: () => vr.presenting }));
  // A paid world's gate that was begun before its menu: its control joins the menu now, ahead of the world's doors.
  rowsForGate();

  // The way home, or to their doors from a world that is their home. The engine does the going: it may have a headset session to end first.
  const atHome = arrival.atHome();
  c.add({
    id: "home",
    section: "travel",
    icon: "home",
    hotbar: true,
    label: atHome ? "Your doors" : "Go home",
    short: atHome ? "Doors" : "Home",
    hidden: () => portal.airlockFor() === null,
    act: () => tell({ type: atHome ? "doors" : "home" }),
  });

  // Who they are here, and the way to sign in. It is their own client's to ask, so the engine does the going, as
  // it does for home: the same control, in the same place, with the same words as in a Three.js world (ui/identity.ts).
  if (identityHost()) {
    c.addSection(identitySection());
    c.add(
      { id: "figure", section: "you", icon: "look", label: "Change how you look", short: "Look", act: () => tell({ type: "figure" }) },
      // Where their client named a signer there is one sign-in, and it is that one, below: this row would be a second.
      { id: "identity", section: "you", icon: "you", label: () => identityWords().label, short: () => identityWords().short, hidden: () => signerNamed(), act: () => tell({ type: "identity" }) },
      // The same sign-in as in a Three.js world: a window of their own sign-in address, where they say yes. The card
      // at the head of You, and the words at the top of the view when they are signed in, come with it (ui/hud.ts).
      signerAction(c, { presenting: () => vr.presenting }),
      accountAction(c, { presenting: () => vr.presenting }),
      filesAction(c, { presenting: () => vr.presenting }),
      libraryAction(c, { presenting: () => vr.presenting }),
    );
    // Who they are here has changed: the engine is told, so it can write a name over them or take it away.
    onHereAs(() => tell({ type: "who", ...whoNow() }));
  }

  // How they move at a desk. The same control, the same words and the same memory as in a Three.js world (fps.ts).
  const context = arrival.read().context;
  moving = startsIntense(context?.moving === "intense") ? "intense" : "casual";
  // What they prefer goes on with them through the next door. Where there is no mouse nothing is said about it.
  if (hasMouse()) reportSettings("moving", () => ({ intense: moving === "intense" }));
  c.add({
    id: "fps",
    section: "moving",
    icon: "step",
    on: () => moving === "intense",
    hidden: () => !hasMouse() || vr.presenting,
    label: () => (moving === "intense" ? DESK_WORDS.intense : DESK_WORDS.casual),
    act: () => {
      moving = moving === "intense" ? "casual" : "intense";
      keepIntense(moving === "intense");
      tell({ type: "moving", moving });
      c.say(moving === "intense" ? DESK_WORDS.nowIntense : DESK_WORDS.nowCasual);
    },
  });

  // A jump. The engine does the jumping, and hears Space itself: this is the way to ask where there is no keyboard.
  c.add({
    id: "jump",
    section: "moving",
    icon: "step",
    label: "Jump",
    short: "Jump",
    hotbar: !hasMouse(),
    hidden: () => vr.presenting,
    act: () => tell({ type: "jump" }),
  });

  c.add(
    {
      id: "vr",
      section: "view",
      icon: "vr",
      tone: "primary",
      hotbar: true,
      hidden: () => !vr.supported,
      label: () => (vr.presenting ? "Leave VR" : "Enter VR"),
      short: "VR",
      // A browser starts a headset session only on a press. This is one, and the engine hears of it within a frame.
      act: () => tell({ type: "vr", enter: !vr.presenting }),
    },
    fullscreenAction(c, () => vr.presenting),
  );
  // How fast the view turns and how wide they see: the engine reads both from `kit()` when a `changed` event comes.
  addDeskControls(c, { presenting: () => vr.presenting });
  document.addEventListener("fullscreenchange", () => c.setTarget(""));
  c.addSection({
    id: "help",
    label: "Help",
    icon: "help",
    note:
      words(o.help, 600) ||
      "Drag to look around. Walk with W, A, S, D, or click the floor to step there: twice to run. Shift runs and Space jumps. The key left of 1 brings these controls up in any world, whatever is on screen; on a touch screen, hold two fingers still. Walk into a doorway to go through it: your own Airlock shows where it really leads, and asks, before you go. These controls are this world's own: your headset's or browser's own controls always get you out.",
  });

  // Something in the console changed (a volume, the words on a control): an engine drawing its own asks again.
  let told = 0;
  c.subscribe(() => {
    const now = performance.now();
    if (now - told < 120) return;
    told = now;
    tell({ type: "changed" });
  });
  // The menu opening and closing: the engine stops moving the visitor, and lets the pointer go.
  let closedAt = -1;
  c.onSignal((name) => {
    if (name === "menuOpen") tell({ type: "menu", open: true });
    if (name === "menuClose") {
      closedAt = performance.now();
      tell({ type: "menu", open: false });
      // The keys go back to the world.
      document.querySelector("canvas")?.focus();
    }
  });
  // Moving the intense way, the pointer is the view's. When the visitor takes it back with Escape, that is the menu.
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement || moving !== "intense" || vr.presenting || h.open) return;
    if (performance.now() - closedAt > 80) h.setOpen(true);
  });
  addEventListener("keydown", (e) => {
    if (e.code !== "Escape" || moving !== "intense" || vr.presenting || h.open || document.pointerLockElement) return;
    if (performance.now() - closedAt > 80) h.setOpen(true);
  });
  return JSON.stringify({ moving, mouse: hasMouse() });
}

/** Who the visitor is here, as plain fields: a guest, or someone signed in with a name, a key, a picture and a line about them. */
const whoNow = (): { guest: boolean; name: string; pubkey: string; picture: string; about: string } => {
  const me = hereAs();
  return { guest: !me, name: me?.name ?? "", pubkey: me?.pubkey ?? "", picture: me?.picture ?? "", about: me?.about ?? "" };
};

/**
 * Who the visitor is here, now, as JSON: `guest` true, or `name`, `pubkey`, `picture` (an address, to be fetched the
 * way the kit fetches one or not at all) and `about`. It changes when they sign in or out in the menu: a `who`
 * event says so, with the same fields. A name is theirs only while they are signed in here.
 */
export function who(): string {
  return JSON.stringify(whoNow());
}

// ------------------------------------------------------------------ a paid world's gate
let gated: PaidGate | null = null;
let gateRows = false;
/** How a gate stands, as an engine is told it. A world with no gate is "free", and open. */
const gateNow = (): Record<string, unknown> =>
  gated ? { state: gated.state, open: gated.open, reason: gated.reason, why: gated.why, offers: gated.offers, until: gated.until } : { state: "free", open: true, reason: "", why: "", offers: [], until: null };
/** The gate's one control, in the kit's menu as in a Three.js world: added once there is both a gate and a menu. */
function rowsForGate(): void {
  if (!gated || !controls || gateRows) return;
  gateRows = true;
  addGateControls(controls, gated, { presenting: () => vr.presenting });
}

/**
 * The gate of a paid world (protocol/10-identity.md, "The front room"), for a world made in another engine: the
 * same gate as a Three.js world's, since none of it is drawing. Call it once as the world comes up, after `start()`,
 * in a world that is paid. It asks what the visitor holds, reads what is for sale, and puts the one control that asks to buy
 * (`gate-buy`) in the kit's menu.
 *
 * Returns how the gate stands, as JSON, and a `gate` event with the same fields comes whenever that changes:
 * `state` ("checking", "shut", "open", "ending", or "free"), `open` (whether a visitor may go past it now: the one
 * thing to act on), `reason` and `why` (why it is shut: a stable word, and plain words for the visitor), `offers`
 * (what can be bought: `listing`, `name`, `sats`, `term`, `words`), and `until` (when a pass ends, in seconds, or null).
 *
 * The engine draws the gate and stops the visitor where it stands: everything before it is free, and where it
 * stands is the world's to choose. While `open` is false, nobody goes past. It is false until the gate knows.
 * `run("gate-buy")` presses the control, for a gate that is pressed in the world.
 *
 * What it is entered by, whose lists count and whether its rooms show only named people are the world's own
 * manifest's word (`access`, `keepers`, `named_only`); the gate stops someone its owner keeps out, and the room
 * takes the same rules. `options` is JSON: `paid` false says this world's own settings ask for none of that, and
 * then nothing is made, read or asked: the answer is "free". Such a world has no need to call this at all.
 */
export function gate(options?: string): string {
  if (!gated) {
    // For a trial on the maker's own network, a script may have a world that can have a gate use it: only on a local
    // address, never by a link, and all it can do is shut a gate. What the gate is entered by is still the manifest's.
    const trial = typeof window !== "undefined" && typeof location !== "undefined" && isLocalHost(location.hostname) && (window as { __nswpTrial?: { gate?: unknown } }).__nswpTrial?.gate === true;
    if (read(options).paid === false && !trial) return JSON.stringify(gateNow());
    const g = (gated = worldGate());
    let told = "";
    g.onChange(() => {
      const now = JSON.stringify(gateNow());
      if (now === told) return;
      told = now;
      tell({ type: "gate", ...gateNow() });
    });
    rowsForGate();
  }
  return JSON.stringify(gateNow());
}

/**
 * Keep this for the visitor (protocol/12-saves.md): text, the world's own, in a slot ("main" when none is named).
 * It is kept on this device at once, and with their account if they are signed in here. A `saved` event says
 * where it was kept: `{"type":"saved","slot":...,"kept":"account"|"device"|"nowhere","said":...}`.
 */
export function save(data: string, slot?: string): void {
  const name = slot || "main";
  void worldSaves()
    .save(String(data ?? ""), name)
    .catch(() => ({ kept: "nowhere" as const, said: "That wasn't saved." }))
    .then((r) => tell({ type: "saved", slot: name, kept: r.kept, said: r.said }));
}

/**
 * Ask for what was kept in a slot. The answer is a `loaded` event: `{"type":"loaded","slot":...,"found":true,
 * "data":...,"at":...,"from":"account"|"device"}`, or `"found":false` when there is nothing. The newer of this
 * device's and their account's is given.
 */
export function load(slot?: string): void {
  const name = slot || "main";
  void worldSaves()
    .load(name)
    .catch(() => null)
    .then((got) => tell(got ? { type: "loaded", slot: name, found: true, data: got.data, at: got.at, from: got.from } : { type: "loaded", slot: name, found: false, data: "", at: 0, from: "" }));
}

/** What happened since the engine last asked, as a JSON list, oldest first. Ask every frame. */
export function events(): string {
  if (!queue.length) return "[]";
  const out = JSON.stringify(queue);
  queue.length = 0;
  return out;
}

/** Play one of the kit's cues by name (`kit().cues`): the world's own sound for it, or the default. */
export function play(cue: string): void {
  if ((CUES as readonly string[]).includes(cue)) sounds?.play(cue as Cue);
}

/** The visitor jumped: the kit's own sound for it, as in every world (two footsteps back to back, a little louder). */
export function jumped(): void {
  sounds?.jumped();
}

/** Say how far the visitor was moved this frame, in metres, by what moves them: their steps are heard. */
export function moved(metres: number): void {
  if (typeof metres === "number" && Number.isFinite(metres) && metres > 0) sounds?.moved(metres);
}

/** They walked into something. */
export function bump(): void {
  sounds?.bump();
}

/** A few words shown for a moment, where the menu shows them. */
export function say(text: string): void {
  const t = words(text, 300);
  if (t) controls?.say(t);
}

/**
 * Say what the visitor is pointing at, or "" for nothing. `detail` is a JSON
 * list of a few more lines. On a flat screen it is shown beside the controls,
 * the same size wherever the thing is, so a world needn't hang a sign in
 * front of it.
 */
export function target(name: string, detail?: string): void {
  let lines: string[] = [];
  try {
    const d: unknown = detail ? JSON.parse(detail) : [];
    if (Array.isArray(d)) lines = d.filter((l): l is string => typeof l === "string").slice(0, 6).map((l) => l.slice(0, 200));
  } catch {
    /* no more lines */
  }
  controls?.setTarget(words(name, 120), lines);
}

/**
 * Tell the menu about a headset, as JSON: `supported` (this browser can start
 * a session, so the way in is offered), `presenting` (one is running, so
 * the page's menu is put away and the control becomes the way out) and
 * `failed` (a session was asked for and didn't start).
 *
 * A visitor who left a headset to come here is offered the way back in as
 * soon as the engine says one can start: the whole page is its button, as in
 * every world (ui/headset.ts). A press on it reaches the engine as the
 * menu's own control would: `{ type: "vr", enter: true }`.
 */
export function headset(state: string): void {
  const s = read(state);
  vr.supported = s.supported === true;
  vr.presenting = s.presenting === true;
  hud?.setHidden(vr.presenting);
  controls?.setTarget("");
  const put = () => {
    headsetOffer?.remove();
    headsetOffer = null;
  };
  if (vr.presenting) {
    headsetOffered = true;
    put();
  } else if (headsetOffer && s.failed === true) headsetOffer.failed();
  else if (vr.supported && controls && !headsetOffered && arrival.read().context?.immersive) {
    headsetOffered = true;
    headsetOffer = offerHeadset(named, () => tell({ type: "vr", enter: true }), put);
  }
}

/**
 * Everything in the visitor's console, as JSON, for an engine that wants to
 * draw some or all of it in an interface of its own: the home button on its
 * own pause menu, the volumes in its own settings screen, wherever it likes.
 *
 * `sections` is the whole menu, in order, each with its `items`; `hotbar` is
 * the few kept always at hand. An item has an `id` to press it by (`run`),
 * the words on it as they stand now (`label`, and `short` for a small
 * space), and `on` (true, false, or null for something that isn't on or
 * off). The words change as things do: "Music: low", "Fullscreen: on". Ask
 * again when a `changed` event comes.
 */
export function view(): string {
  if (!controls) return JSON.stringify({ sections: [], hotbar: [], open: false });
  const v = controls.view();
  const item = (i: { id: string; label: string; short: string; on: boolean | null; tone: string }) => ({ id: i.id, label: i.label, short: i.short, on: i.on, tone: i.tone });
  return JSON.stringify({
    title: v.title,
    address: v.address,
    presence: v.presence,
    open: hud?.open ?? false,
    sections: v.sections.map((s) => ({ id: s.id, label: s.label, note: s.note, items: s.items.map(item) })),
    hotbar: v.hotbar.map(item),
  });
}

/**
 * Press something in the visitor's console by its id, as pressing it there
 * would: "home", "fullscreen", "sound-music", "jump". It does exactly what
 * the console's own does, with the visitor's own settings and their own
 * home, which is the point: a button a world draws for itself is the same
 * button. Returns false if there is no such thing just now.
 */
export function run(id: string): boolean {
  return typeof id === "string" && !!controls?.run(id);
}

/** Bring the visitor's console up ("1" or true), or put it away: for a world's own button that opens it. */
export function open(on: unknown): void {
  hud?.setOpen(on === true || on === "true" || on === "1" || on === 1);
}

/**
 * How much of the screen the controls take: "full", "quiet" (one small mark
 * in a corner) or "hidden" (nothing at all). For a world with an interface
 * of its own, which leads. Whatever is chosen, the visitor can still bring
 * the controls up with the summons, which is theirs in every world: the key
 * left of 1, or two fingers held still (protocol/11-the-visitors-console.md).
 * The engine hears `menu` events as they come and go, and should stop
 * taking the visitor's input while they are up.
 */
export function presence(level: string): void {
  if (level === "full" || level === "quiet" || level === "hidden") controls?.setPresence(level);
}

/**
 * Take every key for the world ("1" or "true"), or give them back. While
 * claimed, the menu answers to none of its own keys. The summons still works.
 */
export function claim(on: unknown): void {
  controls?.claimInput(on === true || on === "true" || on === "1" || on === 1);
}

/**
 * List a door in the menu, as JSON: `id` and `label`. Choosing it there tells
 * the engine (`{"type":"door","id":...}`), which goes through it. With
 * `remove` true, the door is taken off the list.
 */
export function door(entry: string): void {
  const d = read(entry);
  const id = words(d.id, 60);
  if (!id || !controls) return;
  const menuId = `door-${id}`;
  if (d.remove === true) {
    doors.delete(id);
    controls.remove(menuId);
    return;
  }
  if (doors.has(id) || doors.size >= 24) return;
  doors.set(id, words(d.label, 80) || "A door");
  controls.add({ id: menuId, section: "travel", icon: "door", label: () => doors.get(id) ?? "A door", short: "Door", act: () => tell({ type: "door", id }) });
}
