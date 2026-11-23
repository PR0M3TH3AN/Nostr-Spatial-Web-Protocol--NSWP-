/**
 * The flat-screen HUD: a world's controls on a desktop or a phone, laid out
 * like a game's. The world's name in one corner, a row of the things always at
 * hand along the bottom, and everything else in a sheet that opens over it.
 *
 *   const hud = mountHud(controls);
 *
 * It draws whatever the controls hold (see model.ts) and holds no logic of its
 * own. It is real HTML in its own shadow root: buttons a keyboard can reach
 * and a screen reader can name, styled the same in every world because no
 * world's stylesheet reaches in.
 *
 * What the people in a room write to each other is a panel at the side
 * (ui/chat.ts): a few lines that come and go while it is put away, and a
 * list with a place to write when it is open.
 *
 * Keys: 1 to 6 press the hotbar, M opens the menu, Escape closes it, and
 * Enter or T opens the chat to write in. A world
 * can change or switch off those keys, and can make the whole HUD quiet (one
 * small mark in a corner) or hidden, so that it never competes with an
 * interface of the world's own (spec §21.3). See `Presence` in model.ts.
 */
import { MENU_LIMITS } from "@nswp/core";
import { onClientSignIn, setMenuPlace } from "../client-frame.js";
import { ICONS, type IconName } from "./icons.js";
import { portHere, type WorldPort } from "./port.js";
import { loadPicture } from "../picture.js";
import { ago } from "./feed.js";
import type { Controls, UiCard, UiItemView, UiView } from "./model.js";
import { createHoldWatch, SUMMON_KEY } from "./summon.js";
import { escapeDoes, escapeHeld, fullscreenButton, leaveFullscreen, onBrowserLeftFullscreen } from "./fullscreen.js";
import { rgb } from "./theme.js";

export interface Hud {
  /** The element on the page. */
  element: HTMLElement;
  readonly open: boolean;
  /** Bring the menu up or put it away. `at` names the section to bring it up on. */
  setOpen(open: boolean, at?: string): void;
  /** Whether the chat panel is open to write in. */
  readonly chatOpen: boolean;
  /** Which of its two sides the panel is on: what the room writes, or the visitor's own public feed. */
  readonly chatTab: "room" | "feed" | "letters";
  /**
   * Open the panel to write in, or put it away. `tab` says which side: the room's chat, which opens only where
   * there is a room to write to, or "feed", the visitor's own public posts, which opens only once something
   * signs for them. Left out, the side it was on.
   */
  setChatOpen(open: boolean, tab?: "room" | "feed" | "letters"): void;
  /** How much of the top and bottom of the window the HUD covers, in pixels. For placing a scene's picture clear of it. Nothing when it is quiet or hidden. */
  cover(): { top: number; bottom: number };
  /** Where each visible part of the HUD is, so a world can lay its own interface out around it. */
  bounds(): { x: number; y: number; width: number; height: number }[];
  /** Hide it all (in a headset session, where the page can't be seen anyway) or show it again. */
  setHidden(hidden: boolean): void;
  remove(): void;
}

const CSS = `
:host { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; display: block;
  --s: 1; --accent: 255, 182, 92; --ink: 238, 245, 251; --glass: 10, 16, 24; --warn: 255, 117, 102;
  font: 500 calc(13px * var(--s)) / 1.35 ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  color: rgb(var(--ink)); -webkit-font-smoothing: antialiased; }
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
button:focus-visible { outline: 2px solid rgb(var(--ink)); outline-offset: 3px; }
svg { width: 1.55em; height: 1.55em; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.glass { background: rgba(var(--glass), .7); border: 1px solid rgba(var(--accent), .34);
  -webkit-backdrop-filter: blur(12px) saturate(1.25); backdrop-filter: blur(12px) saturate(1.25); }
.mono { font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace; font-weight: 400; }

/* ---- the corners of the view, marked lightly: this is a HUD, laid over a place */
.corner { position: absolute; width: 22px; height: 22px; border: 0 solid rgba(var(--accent), .5); }
.corner.a { left: 6px; bottom: 6px; border-left-width: 1px; border-bottom-width: 1px; border-bottom-left-radius: 6px; }
.corner.b { right: 6px; bottom: 6px; border-right-width: 1px; border-bottom-width: 1px; border-bottom-right-radius: 6px; }
@media (max-width: 640px) { .corner { display: none; } }

/* ---- who and where: top left */
.id { position: absolute; top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left));
  display: flex; align-items: center; gap: 10px; max-width: min(60vw, 420px); padding: 8px 14px 8px 10px; border-radius: 6px 14px 14px 6px;
  border-left: 2px solid rgb(var(--accent)); }
/* The mark: a lit doorway. The arch is this kit's one shape, borrowed from the doors it leads to. */
.mark { width: 18px; height: 24px; border-radius: 9px 9px 2px 2px; flex: none; position: relative;
  background: linear-gradient(rgba(var(--accent), .95), rgba(var(--accent), .25)); box-shadow: 0 0 14px rgba(var(--accent), .55); }
.mark::after { content: ""; position: absolute; left: -3px; right: -3px; bottom: -3px; height: 2px; background: rgb(var(--ink)); border-radius: 1px; }
.id b { display: block; font-weight: 650; font-size: 1.12em; letter-spacing: .005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.id .mono { display: block; font-size: .86em; color: rgba(var(--ink), .68); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ---- the menu button: top right */
.menu { position: absolute; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right));
  pointer-events: auto; display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px 0 10px; border-radius: 12px; }
.menu:hover, .menu[aria-expanded="true"] { border-color: rgb(var(--accent)); color: rgb(var(--accent)); }
/* Fill the screen: small, top centre, on a desk while it isn't filled. */
.full { position: absolute; top: max(12px, env(safe-area-inset-top)); left: 50%; translate: -50% 0; pointer-events: auto;
  display: flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px 0 9px; border-radius: 10px; font-size: .9em; }
.full svg { width: 16px; height: 16px; }
.full:hover, .full:focus-visible { border-color: rgb(var(--accent)); color: rgb(var(--accent)); }
.full[hidden] { display: none; }
kbd { font: inherit; font-size: .82em; min-width: 1.6em; padding: 1px 5px; text-align: center; border-radius: 5px;
  border: 1px solid rgba(var(--ink), .3); color: rgba(var(--ink), .75); }

/* ---- the bottom: what you point at, then the hotbar */
.low { position: absolute; left: 0; right: 0; bottom: max(10px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 0 12px; }
.target { max-width: min(92vw, 640px); padding: 6px 14px; border-radius: 999px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.target:empty { visibility: hidden; }
/* Still loading, though they are in (controls.setLoading): the world's words, how far, and a line that fills. Above
   what is pointed at, and pressing nothing. */
.loading { position: relative; overflow: hidden; max-width: min(92vw, 520px); padding: 6px 16px 8px; border-radius: 999px;
  display: flex; gap: 10px; align-items: baseline; white-space: nowrap; font-size: .92em; }
.loading[hidden] { display: none; }
.loading .what { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.loading .much { flex: none; color: rgb(var(--accent)); font-variant-numeric: tabular-nums; }
.loading .fill { position: absolute; left: 0; bottom: 0; height: 2px; width: 100%; transform-origin: left; transform: scaleX(var(--f, 0));
  background: rgb(var(--accent)); box-shadow: 0 0 8px rgb(var(--accent)); }
/* How far isn't known: a short light runs along the line. */
.loading.unknown .fill { width: 30%; transform: none; animation: loading-run 1.6s ease-in-out infinite; }
:host(:not(.moving)) .loading.unknown .fill { animation: none; width: 100%; opacity: .5; }
@keyframes loading-run { from { translate: -100% 0; } to { translate: 340% 0; } }
/* What is pointed at, with a few lines about it: a small card, always this size, never in the way of the thing itself. */
.target.card { max-width: min(92vw, 460px); padding: 10px 16px; border-radius: 14px; white-space: normal; text-align: left; display: grid; gap: 3px; }
.target.card b { font-weight: 650; }
.target.card span { opacity: 0.86; font-size: 0.93em; line-height: 1.35; }
.target.card span:last-child { opacity: 1; color: rgb(var(--accent)); }
/* The bar: as wide as its keys, and no wider than the screen. Wider than that (tabs pinned to it on a phone), the
   keys slide along it, with an arrow at each end like the menu's tabs. The arrows stand beside the keys, never over
   them, and while it is too wide both places are kept, so the keys don't jump as one comes and goes. */
.bar { pointer-events: auto; position: relative; display: flex; align-items: stretch; max-width: 100%; border-radius: 20px 20px 10px 10px; }
.bar[hidden] { display: none; }
.hotbar { display: flex; align-items: flex-start; justify-content: flex-start; gap: 10px; padding: 12px 14px 8px; min-width: 0;
  overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; }
.hotbar::-webkit-scrollbar { display: none; }
.bar .more { display: none; flex: none; width: 30px; place-items: center; font-size: 1.55em; line-height: 1;
  color: rgb(var(--accent)); text-shadow: 0 0 10px rgb(var(--accent)); }
.bar.over .more { display: grid; }
.bar .more.left { border-radius: 20px 0 0 10px; }
.bar .more.right { border-radius: 0 20px 10px 0; }
/* Nothing more that way: its place is kept, empty, and it takes no press. */
.bar .more.spent { visibility: hidden; pointer-events: none; }
.bar .more:hover { color: rgb(var(--ink)); }
.key { position: relative; flex: none; width: 62px; display: grid; justify-items: center; gap: 7px; text-align: center; }
/* Between the place's own keys and the tabs the visitor pinned: a line, so it is plain which are theirs. */
.hotbar .theirs { flex: none; align-self: stretch; width: 1px; margin: 2px 2px 8px; background: rgba(var(--ink), .2); }
.key.pin .arch { border-style: dashed; }
/* A key is a small doorway: an arch, standing on a sill that lights when it is on. */
.key .arch { width: 52px; height: 54px; display: grid; place-items: center; border-radius: 26px 26px 7px 7px;
  background: rgba(var(--accent), .08); border: 1px solid rgba(var(--accent), .42); transition: background .15s, border-color .15s, transform .15s; }
.key .sill { width: 60px; height: 2px; margin-top: -4px; border-radius: 1px; background: rgba(var(--ink), .28); transition: background .2s, box-shadow .2s; }
.key .name { font-size: .84em; line-height: 1.2; color: rgba(var(--ink), .82); max-width: 100%; overflow-wrap: anywhere; }
.key .num { position: absolute; top: -6px; right: -2px; }
.key:hover .arch, .key:focus-visible .arch { background: rgba(var(--accent), .2); border-color: rgb(var(--accent)); transform: translateY(-2px); }
.key:hover .sill, .key[aria-pressed="true"] .sill { background: rgb(var(--accent)); box-shadow: 0 0 12px rgba(var(--accent), .8); }
.key[aria-pressed="true"] .arch { background: rgba(var(--accent), .26); color: rgb(var(--accent)); border-color: rgb(var(--accent)); }
.key.primary .arch { background: rgb(var(--accent)); color: rgb(var(--glass)); border-color: rgb(var(--accent)); box-shadow: 0 0 18px rgba(var(--accent), .45); }
.key.warn .arch { border-color: rgba(var(--warn), .7); color: rgb(var(--warn)); background: rgba(var(--warn), .08); }
.key:disabled { opacity: .5; cursor: default; }

/* ---- a few words for a moment: bottom left */
.says { position: absolute; left: max(12px, env(safe-area-inset-left)); bottom: calc(max(10px, env(safe-area-inset-bottom)) + 128px * var(--s)); display: grid; gap: 6px; max-width: min(80vw, 360px); }
.say { padding: 8px 12px; border-radius: 4px 12px 12px 4px; border-left: 2px solid rgb(var(--accent)); animation: say-in .22s ease-out both; }
.say.going { opacity: 0; transition: opacity .5s; }

/* ---- what the room writes: at the right-hand side. Put away, the newest lines pass by; open, a list and a place to write. */
.chat { position: absolute; right: max(12px, env(safe-area-inset-right)); top: calc(max(12px, env(safe-area-inset-top)) + 54px);
  bottom: calc(max(10px, env(safe-area-inset-bottom)) + 128px * var(--s)); width: min(340px, calc(100vw - 24px));
  display: flex; flex-direction: column; justify-content: flex-end; pointer-events: none; }
.chat[data-state="closed"] { display: none; }
.chat [hidden] { display: none !important; }
.chat .frame { display: flex; flex-direction: column; min-height: 0; max-height: 100%; }
.chat[data-state="open"] .frame { pointer-events: auto; border-radius: 14px 6px 6px 14px; border-right: 2px solid rgb(var(--accent)); overflow: hidden; }
.chat[data-state="peek"] .frame { background: none; border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; }
.chat header { display: flex; align-items: center; gap: 8px; padding: 9px 8px 8px 14px; border-bottom: 1px solid rgba(var(--accent), .22); }
.chat header b { flex: 1; font-weight: 650; }
.chat header button { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; color: rgba(var(--ink), .7); }
.chat header button:hover { color: rgb(var(--ink)); background: rgba(var(--ink), .1); }
.chat header svg { width: 1.2em; height: 1.2em; }
.chat ol { list-style: none; margin: 0; padding: 10px 14px; display: grid; gap: 7px; align-content: end; overflow-y: auto; min-height: 0;
  scrollbar-width: thin; scrollbar-color: rgba(var(--accent), .5) transparent; overflow-wrap: anywhere; }
.chat li b { font-weight: 650; margin-right: .45em; color: var(--who, rgb(var(--accent))); }
.chat li.mine b { color: rgba(var(--ink), .62); }
.chat li.aside { color: rgba(var(--ink), .6); font-size: .93em; }
.chat .empty { margin: 0; padding: 14px; color: rgba(var(--ink), .7); }
.chat form { display: flex; gap: 6px; padding: 8px; border-top: 1px solid rgba(var(--accent), .22); }
.chat input { flex: 1; min-width: 0; font: inherit; font-size: max(16px, 1em); color: rgb(var(--ink)); background: rgba(var(--ink), .07);
  border: 1px solid rgba(var(--ink), .22); border-radius: 9px; padding: 8px 10px; outline: none; }
.chat input::placeholder { color: rgba(var(--ink), .5); }
.chat input:focus { border-color: rgb(var(--accent)); }
.chat form button { padding: 0 13px; border-radius: 9px; background: rgba(var(--accent), .18); border: 1px solid rgba(var(--accent), .7); }
.chat form button:hover { background: rgb(var(--accent)); color: rgb(var(--glass)); }
.chat .hint { margin: 0; padding: 0 12px 8px; font-size: .9em; color: rgb(var(--warn)); }
.chat .hint:empty { display: none; }
/* Three sides may be up at once: the strip slides under a finger sooner than run under the button that puts the panel away. */
.chat header .tabs2 { flex: 1; display: flex; gap: 4px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.chat header .tabs2::-webkit-scrollbar { display: none; }
.chat header .tabs2 .tab { flex: 0 0 auto; white-space: nowrap; }
.chat header .tab { width: auto; height: 30px; padding: 0 10px; font-weight: 650; white-space: nowrap; border-bottom: 2px solid transparent; border-radius: 8px 8px 0 0; }
.chat header .tab[aria-selected="true"] { color: rgb(var(--ink)); border-bottom-color: rgb(var(--accent)); }
.chat .lead, .chat .said { margin: 0; padding: 8px 14px 0; font-size: .9em; color: rgba(var(--ink), .7); }
.chat .said { padding: 0 12px 8px; }
.chat .said:empty { display: none; }
/* The feed reads the other way up from the chat: where to write is at the top, and the newest post under it. */
.chat[data-tab="feed"] form { order: 1; border-top: 0; flex-wrap: wrap; }
.chat[data-tab="feed"] form input { flex: 1 1 100%; min-height: 38px; }
.chat[data-tab="feed"] form button { margin-left: auto; min-height: 34px; font-weight: 650; }
.chat[data-tab="feed"] :is(.hint, .said) { order: 2; }
.chat[data-tab="feed"] :is(ol, .empty) { order: 3; border-top: 1px solid rgba(var(--accent), .22); }
.chat[data-tab="feed"] ol { align-content: start; gap: 0; padding: 0 14px; }
.chat li.post { padding: 10px 0; border-bottom: 1px solid rgba(var(--ink), .12); overflow-wrap: anywhere; }
.chat li.post:last-child { border-bottom: 0; }
.chat li.letter { white-space: pre-wrap; overflow-wrap: anywhere; }
.chat li.letter.sending { opacity: .6; }
.chat li.letter.failed small { color: rgb(var(--warn)); opacity: 1; }
.chat li.letter small, .chat li.post small { display: block; margin-top: 3px; font-size: .86em; color: rgba(var(--ink), .55); }
.chat li.post.failed small { color: rgb(var(--warn)); }
.chat li.post.sending, .chat li.post.removing { opacity: .7; }
.chat li.post .post-remove { font: inherit; color: rgba(var(--ink), .8); text-decoration: underline; text-underline-offset: 3px; padding: 6px 2px; margin: -6px 0; pointer-events: auto; }
.chat li.post .post-remove:hover { color: rgb(var(--warn)); }
.chat[data-state="peek"] :is(header, form, .hint, .empty, .lead, .said) { display: none; }
.chat[data-state="peek"] ol { padding: 0; overflow: hidden; justify-items: end; }
.chat[data-state="peek"] li { padding: 7px 12px; border-radius: 12px 4px 4px 12px; border-right: 2px solid rgb(var(--accent)); max-width: 100%;
  background: rgba(var(--glass), .7); -webkit-backdrop-filter: blur(12px) saturate(1.25); backdrop-filter: blur(12px) saturate(1.25); animation: chat-in .22s ease-out both; }
.chat[data-state="peek"].going { opacity: 0; transition: opacity .6s; }
:host([data-presence="hidden"]) .chat { display: none; }
:host(:not([data-presence="full"])) .chat { bottom: max(72px, env(safe-area-inset-bottom)); }

/* ---- the sheet: everything else, by section */
.sheet { position: absolute; left: 50%; bottom: calc(max(10px, env(safe-area-inset-bottom)) + 122px * var(--s)); transform: translateX(-50%);
  width: min(480px, calc(100vw - 20px)); max-height: min(70vh, 640px); display: flex; flex-direction: column; pointer-events: auto;
  border-radius: 22px 22px 12px 12px; overflow: hidden; }
.sheet[hidden] { display: none; }
/* Where there is room, at a desk, the menu is larger: more of a list at once, and rows side by side. */
@media (min-width: 900px) and (min-height: 560px) {
  .sheet { width: min(780px, calc(100vw - 40px)); max-height: min(74vh, 780px); }
  .rows { grid-template-columns: 1fr 1fr; align-content: start; }
  .rows > .person, .rows > .swatches, .rows > .tiles, .rows > .row.primary { grid-column: 1 / -1; }
  .rows > .person.thing { grid-template-columns: 200px 1fr; grid-template-areas: "face about" "face acts"; grid-template-rows: auto 1fr; }
  .rows > .tiles { grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); }
}
.sheet::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgb(var(--accent)), transparent); box-shadow: 0 0 16px rgb(var(--accent)); }
.tabs { position: relative; display: flex; gap: 4px; padding: 12px 12px 0; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
/* There are more sections than fit: an arrow at the side they are on, over a fade, and it takes them there. */
.tabbar { position: relative; }
.tabbar .more { position: absolute; top: 2px; bottom: 0; width: 40px; display: grid; align-items: center; z-index: 1; font-size: 1.55em; line-height: 1;
  color: rgb(var(--accent)); text-shadow: 0 0 10px rgb(var(--accent)); }
.tabbar .more.left { left: 0; justify-items: start; padding-left: 9px; border-radius: 22px 0 0 0; background: linear-gradient(90deg, rgb(var(--glass)) 45%, rgba(var(--glass), 0)); }
.tabbar .more.right { right: 0; justify-items: end; padding-right: 9px; border-radius: 0 22px 0 0; background: linear-gradient(270deg, rgb(var(--glass)) 45%, rgba(var(--glass), 0)); }
.tabbar .more[hidden] { display: none; }
.tabbar .more:hover { color: rgb(var(--ink)); }
.tab { display: flex; align-items: center; gap: 7px; padding: 9px 13px 8px; border-radius: 14px 14px 0 0; color: rgba(var(--ink), .72); border-bottom: 2px solid transparent; white-space: nowrap; }
.tab:hover { color: rgb(var(--ink)); }
.tab[aria-selected="true"] { color: rgb(var(--accent)); background: rgba(var(--accent), .1); border-bottom-color: rgb(var(--accent)); }
.rows { display: grid; gap: 6px; padding: 12px; overflow-y: auto; border-top: 1px solid rgba(var(--accent), .22);
  scrollbar-width: thin; scrollbar-color: rgba(var(--accent), .5) transparent; }
/* A choice of colour is a row of small doorways, each lit in its own. */
.swatches { display: flex; flex-wrap: wrap; gap: 6px 4px; padding: 4px 2px 8px; }
.swatch { width: 66px; display: grid; justify-items: center; gap: 6px; font-size: .86em; color: rgba(var(--ink), .8); }
.swatch i { width: 38px; height: 44px; border-radius: 19px 19px 5px 5px; background: linear-gradient(var(--c), color-mix(in srgb, var(--c) 30%, transparent)); border: 1px solid var(--c); transition: transform .15s, box-shadow .15s; }
.swatch u { width: 46px; height: 2px; margin-top: -3px; border-radius: 1px; background: rgba(var(--ink), .25); }
.swatch:hover i { transform: translateY(-2px); }
.swatch[aria-pressed="true"] i { box-shadow: 0 0 16px var(--c); }
.swatch[aria-pressed="true"] u { background: var(--c); box-shadow: 0 0 10px var(--c); }
.swatch[aria-pressed="true"] { color: rgb(var(--ink)); }
/* Things with pictures of themselves, side by side: what is in a bag. Each is a small plinth the thing stands on. */
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; padding: 2px 0 4px; }
.tile { display: grid; grid-template-rows: auto auto; justify-items: center; gap: 4px; padding: 8px 6px 9px; border-radius: 14px 14px 8px 8px; text-align: center;
  border: 1px solid rgba(var(--ink), .12); background: radial-gradient(120% 90% at 50% 100%, rgba(var(--accent), .13), rgba(var(--ink), .03) 70%);
  font-size: .9em; line-height: 1.2; color: rgba(var(--ink), .85); transition: background .12s, border-color .12s, transform .12s; }
.tile .shown { width: 100%; aspect-ratio: 1; display: grid; place-items: center; font-weight: 700; font-size: 1.9em; color: rgba(var(--ink), .35); }
.tile canvas { width: 100%; height: 100%; display: block; }
.tile:hover { border-color: rgba(var(--accent), .7); transform: translateY(-2px); }
.tile[aria-pressed="true"] { border-color: rgb(var(--accent)); color: rgb(var(--ink)); box-shadow: 0 0 0 1px rgb(var(--accent)), 0 0 18px rgba(var(--accent), .35); }
.tile span { overflow-wrap: anywhere; }
/* A tile's mark, in its corner: the bag's says the thing is in your bag. Drawn in the accent, on the glass. */
.tile { position: relative; }
.tile .corner-mark { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 8px;
  background: rgba(var(--glass), .85); border: 1px solid rgba(var(--accent), .55); color: rgb(var(--accent)); }
.tile .corner-mark svg { width: 15px; height: 15px; }
/* Faint: not theirs yet. Greyed, and still pressable: it brightens under the pointer, as any tile does. */
.tile.faint { color: rgba(var(--ink), .55); background: rgba(var(--ink), .03); border-style: dashed; }
.tile.faint .shown { filter: grayscale(1); opacity: .5; }
.tile.faint:hover { color: rgba(var(--ink), .85); }
.tile.faint:hover .shown { opacity: .8; }
.row { display: flex; align-items: center; gap: 12px; min-height: 46px; padding: 8px 12px; border-radius: 10px; text-align: left;
  border: 1px solid rgba(var(--ink), .12); background: rgba(var(--ink), .03); transition: background .12s, border-color .12s; }
.row:hover { background: rgba(var(--accent), .13); border-color: rgba(var(--accent), .7); }
/* A line is read and not pressed: no edge, no hover, nothing that looks like a button. Lit is the accent; dark is dim. */
.line { grid-column: 1 / -1; display: flex; align-items: flex-start; gap: 12px; margin: 0; padding: 4px 12px; line-height: 1.35; color: rgba(var(--ink), .55); }
.line svg { flex: none; margin-top: 1px; opacity: .55; }
.line.on { color: rgb(var(--ink)); }
.line.on svg { opacity: 1; color: rgb(var(--accent)); }
.row .grow { flex: 1; min-width: 0; }
/* A row typed into: a box and its button, and under them where what is typed goes. */
.field { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr auto; gap: 6px 8px; margin: 0; padding: 8px 12px; border-radius: 10px;
  border: 1px solid rgba(var(--ink), .12); background: rgba(var(--ink), .03); }
.field input { min-width: 0; min-height: 40px; padding: 6px 10px; border-radius: 8px; font: inherit; color: inherit;
  border: 1px solid rgba(var(--ink), .25); background: rgba(var(--glass), .6); }
.field input:focus-visible { outline: 2px solid rgb(var(--ink)); outline-offset: 2px; }
.field button { min-height: 40px; padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(var(--accent), .7); background: rgba(var(--accent), .13); }
.field .to { grid-column: 1 / -1; margin: 0; font-size: .86em; color: rgba(var(--ink), .6); }
.row .state { font-size: .86em; color: rgba(var(--ink), .6); }
.row[aria-pressed="true"] { border-color: rgba(var(--accent), .8); }
.row[aria-pressed="true"] .state { color: rgb(var(--accent)); }
.row.warn { color: rgb(var(--warn)); }
.row.primary { background: rgba(var(--accent), .16); border-color: rgba(var(--accent), .75); }
/* Who a section is about: a face, a name, how they are known, and what they say of themselves, set apart as theirs. */
/* A person: the card at the head of a section. Its own name, so it is never taken for the card about what is pointed at. */
.person { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; align-items: center; padding: 12px; border-radius: 16px 16px 8px 8px;
  border: 1px solid rgba(var(--accent), .45); background: rgba(var(--accent), .07); }
.person .face { grid-row: span 2; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; overflow: hidden;
  background: var(--c, rgba(var(--ink), .2)); color: rgb(var(--glass)); font-weight: 700; font-size: 1.5em; }
.person .face canvas { width: 100%; height: 100%; display: block; }
/* A card about a thing: the thing itself, large, on a lit plinth, where a person's card has a face. */
.person.thing { grid-template-columns: minmax(112px, 30%) 1fr; grid-template-areas: "face about" "acts acts"; align-items: start; gap: 10px 14px; }
.person.thing .about { grid-area: about; display: grid; gap: 5px; min-width: 0; align-content: start; }
.person.thing .about blockquote { margin: 3px 0 0; }
/* What to do with the thing: side by side where they fit, and one under another where they don't. */
.person.thing .acts { grid-area: acts; display: flex; flex-wrap: wrap; gap: 8px; align-items: stretch; align-content: start; min-width: 0; }
.person.thing .acts > .row { flex: 1 1 210px; min-width: 0; }
.person.thing .acts > .swatches { flex: 1 1 100%; }
.person.thing .face { grid-area: face; width: 100%; height: auto; aspect-ratio: 1; border-radius: 14px;
  background: radial-gradient(90% 70% at 50% 92%, rgba(var(--accent), .3), transparent 70%), rgba(var(--ink), .05); color: rgba(var(--ink), .4); }
.person h3 { margin: 0; font-size: 1.15em; font-weight: 650; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; overflow-wrap: anywhere; }
.person .tag { font-size: .76em; font-weight: 500; padding: 1px 8px; border-radius: 999px; border: 1px solid rgba(var(--ink), .3); color: rgba(var(--ink), .75); white-space: nowrap; }
.person .tag.proven { border-color: rgba(var(--accent), .8); color: rgb(var(--accent)); }
.person .keyline { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; color: rgba(var(--ink), .7); font-size: .9em; }
.person .keyline button { padding: 2px 10px; border-radius: 7px; border: 1px solid rgba(var(--ink), .25); color: rgb(var(--ink)); }
.person .keyline button:hover { border-color: rgb(var(--accent)); color: rgb(var(--accent)); }
.person blockquote { grid-column: 1 / -1; margin: 7px 0 0; padding: 1px 0 1px 10px; border-left: 2px solid rgba(var(--accent), .6); overflow-wrap: anywhere; }
.person .now { grid-column: 1 / -1; margin: 5px 0 0; font-size: .9em; color: rgb(var(--accent)); }

.note { margin: 0; padding: 4px 12px 0 12px; color: rgba(var(--ink), .78); border-left: 2px solid rgba(var(--accent), .6); margin-left: 12px; font-size: .95em; }
.note:empty { display: none; }
.foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 0 12px 12px; }
/* Keeping this tab on the bar: a quiet button, opposite Close. */
.pin-it { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 10px; border: 1px solid rgba(var(--ink), .22); color: rgba(var(--ink), .82); font-size: .93em; }
.pin-it svg { width: 16px; height: 16px; }
.pin-it:hover:not(:disabled), .pin-it:focus-visible { border-color: rgb(var(--accent)); color: rgb(var(--accent)); }
.pin-it[aria-pressed="true"] { border-color: rgba(var(--accent), .8); color: rgb(var(--accent)); background: rgba(var(--accent), .12); }
.pin-it:disabled { opacity: .5; cursor: default; }
.close { min-height: 38px; padding: 0 14px; border-radius: 10px; border: 1px solid rgba(var(--ink), .22); }
.close:hover { border-color: rgb(var(--ink)); }

/* ---- quiet: one mark in a corner, and everything else behind it */
.quiet { position: absolute; pointer-events: auto; display: none; width: 44px; height: 48px; place-items: center; border-radius: 22px 22px 8px 8px; }
.quiet .mark { margin-bottom: 2px; }
.quiet:hover, .quiet[aria-expanded="true"] { border-color: rgb(var(--accent)); }
:host([data-presence="quiet"]) .quiet { display: grid; }
:host([data-presence="quiet"]) :is(.id, .menu, .bar, .target, .corner),
:host([data-presence="hidden"]) :is(.id, .menu, .bar, .target, .corner, .says, .loading) { display: none; }
:host([data-corner="top-left"]) .quiet { top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left)); }
:host([data-corner="top-right"]) .quiet { top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); }
:host([data-corner="bottom-left"]) .quiet { bottom: max(12px, env(safe-area-inset-bottom)); left: max(12px, env(safe-area-inset-left)); }
:host([data-corner="bottom-right"]) .quiet { bottom: max(12px, env(safe-area-inset-bottom)); right: max(12px, env(safe-area-inset-right)); }
/* With no hotbar under it, the sheet opens in the middle of the bottom edge, clear of the corners. */
:host(:not([data-presence="full"])) .sheet { bottom: max(72px, env(safe-area-inset-bottom)); }
:host(:not([data-presence="full"])) .says { bottom: max(72px, env(safe-area-inset-bottom)); }
/* Keys the world has switched off aren't advertised. */
:host(.no-menu-key) .menu kbd, :host(.no-hotbar-keys) :is(.key .num, .row kbd) { display: none; }

/* Who they are signed in as, said once when it becomes so: top centre, in one place, and gone again. It is never
   pressed and never in the way: it can't be clicked, and what is under it can. */
.as { position: absolute; top: max(12px, env(safe-area-inset-top)); left: 50%; translate: -50% 0; display: flex; align-items: center; gap: 10px;
  padding: 6px 18px 6px 6px; border-radius: 999px; max-width: min(72vw, 380px); opacity: 0; visibility: hidden; pointer-events: none; }
.as.plain { padding-left: 18px; }
.as .face { flex: none; width: calc(36px * var(--s)); height: calc(36px * var(--s)); border-radius: 50%; display: grid; place-items: center; overflow: hidden;
  background: rgba(var(--accent), .16); color: rgb(var(--accent)); font-weight: 650; box-shadow: 0 0 0 2px rgba(var(--accent), .75); }
.as.plain .face { display: none; }
.as .face canvas { width: 100%; height: 100%; display: block; }
.as .who { min-width: 0; }
.as small { display: block; font-size: .8em; line-height: 1.15; color: rgba(var(--ink), .72); white-space: nowrap; }
.as b { display: block; font-weight: 650; font-size: 1.06em; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.as.shown { opacity: 1; visibility: visible; }
/* It comes into focus where it stands and goes out the same way: nothing slides across the view. */
:host(.moving) .as { transform: scale(.9); filter: blur(8px); transition: opacity .4s ease, transform .5s cubic-bezier(.2, .8, .2, 1), filter .4s ease, visibility 0s linear .5s; }
:host(.moving) .as.shown { transform: none; filter: none; transition: opacity .4s ease, transform .5s cubic-bezier(.2, .8, .2, 1), filter .4s ease, visibility 0s; }
:host(.moving) .as.shown .face { animation: as-ring 1.2s ease-out .15s both; }
:host(.moving) .as.shown b { animation: as-name .5s ease-out .12s both; }
@keyframes as-ring { from { box-shadow: 0 0 0 2px rgba(var(--accent), .95), 0 0 0 0 rgba(var(--accent), .55); } to { box-shadow: 0 0 0 2px rgba(var(--accent), .75), 0 0 0 14px rgba(var(--accent), 0); } }
@keyframes as-name { from { opacity: 0; letter-spacing: .08em; } }
/* On a narrow screen the place's name and the menu take the top row: it stands just under them. */
@media (max-width: 760px) { .as { top: calc(max(12px, env(safe-area-inset-top)) + 60px * var(--s)); } }

/* ---- one moment of motion: things arrive. Nothing loops. */
@keyframes say-in { from { opacity: 0; transform: translateX(-8px); } }
@keyframes chat-in { from { opacity: 0; transform: translateX(8px); } }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
@keyframes unfold { from { clip-path: inset(100% 0 0 0 round 22px); opacity: .4; } to { clip-path: inset(0 0 0 0 round 22px); opacity: 1; } }
:host(.moving.arriving) .key { animation: rise .32s cubic-bezier(.2, .8, .2, 1) both; animation-delay: calc(var(--i) * 45ms + 120ms); }
:host(.moving.arriving) .id, :host(.moving.arriving) .menu { animation: rise .32s cubic-bezier(.2, .8, .2, 1) both; }
:host(.moving) .sheet:not([hidden]) { animation: unfold .24s cubic-bezier(.2, .8, .2, 1) both; }
:host(:not(.moving)) * { transition: none !important; animation: none !important; }

/* ---- a phone: the same things, closer together */
@media (max-width: 640px) {
  .id { max-width: calc(100vw - 86px); padding: 6px 10px 6px 8px; }
  .menu span, .menu kbd, .key .num { display: none; }
  .menu { padding: 0 10px; }
  .hotbar { gap: 4px; padding: 10px 8px 6px; }
  .bar .more { width: 26px; }
  .key { width: 54px; }
  .key .arch { width: 46px; height: 46px; border-radius: 23px 23px 6px 6px; }
  .key .sill { width: 50px; }
  .key .name { font-size: .76em; }
  .sheet { bottom: calc(max(10px, env(safe-area-inset-bottom)) + 108px * var(--s)); }
  .says { bottom: calc(max(10px, env(safe-area-inset-bottom)) + 116px * var(--s)); }
  /* The chat is across the bottom, over the hotbar's shoulder, and no taller than half the screen. */
  .chat { left: 8px; right: 8px; width: auto; top: auto; max-height: 46vh; bottom: calc(max(10px, env(safe-area-inset-bottom)) + 108px * var(--s)); }
  .chat[data-state="peek"] { max-height: 30vh; }
}
/* A keyboard on the glass covers the bottom of the page: the place to write stands on top of it. */
:host(.keys-up) .chat[data-state="open"] { top: auto; bottom: calc(var(--kb, 0px) + 8px); max-height: calc(100vh - var(--kb, 0px) - 24px); }
@media (hover: none) { kbd { display: none; } }
`;

function icon(name: IconName | null): SVGElement | null {
  if (!name) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", ICONS[name]);
  svg.append(path);
  return svg;
}

type Child = Node | string | null | false;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) if (c) e.append(c);
  return e;
}

/**
 * The visitor's menu, drawn from a world's port and from nothing else (ui/port.ts; docs/plans/the-clients-menu.md).
 * The port is all it is given of the world: what to draw comes as `view()`, and a press goes back as an id. So the
 * same menu can be given a port carried some other way (by words, from a page above the world) and not know it.
 */
export function mountMenu(port: WorldPort, opts: { parent?: HTMLElement } = {}): Hud {
  // Called `controls` throughout what follows, as it was when this was given a world's controls whole.
  const controls = port;
  const host = document.createElement("nswp-hud");
  const root = host.attachShadow({ mode: "open" });
  // A constructed stylesheet, not a <style> element: a site with a strict
  // content security policy forbids inline styles, and this isn't one.
  let style: HTMLStyleElement | "" = "";
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } catch {
    style = document.createElement("style");
    style.textContent = CSS;
  }

  const title = el("b");
  const address = el("span", { class: "mono" });
  const id = el("div", { class: "id glass" }, el("span", { class: "mark", "aria-hidden": "true" }), el("div", {}, title, address));
  const menu = el("button", { class: "menu glass", type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" }, icon("menu"), el("span", {}, "Menu"), el("kbd", {}, "M"));
  const quiet = el("button", { class: "quiet glass", type: "button", "aria-label": "Menu", "aria-haspopup": "dialog", "aria-expanded": "false" }, el("span", { class: "mark", "aria-hidden": "true" }));
  const target = el("div", { class: "target glass", "aria-live": "polite" });
  // Still loading, though they are in: the world's words, how far along, and a line that fills (controls.setLoading).
  // Its words are read out when they change; how far along is not, or every percent would be.
  const loadingWhat = el("span", { class: "what", "aria-live": "polite" });
  const loadingMuch = el("span", { class: "much" });
  const loadingFill = el("i", { class: "fill", "aria-hidden": "true" });
  const loadingLine = el("div", { class: "loading glass", hidden: "" }, loadingWhat, loadingMuch, loadingFill);
  const hotbar = el("nav", { class: "hotbar", "aria-label": "Controls" });
  // Wider than the screen, the keys slide along: an arrow at each end, as the menu's tabs have (the owner, 2026-11-21).
  const barBack = el("button", { class: "more left spent", type: "button", "aria-label": "Earlier keys", tabindex: "-1" }, "‹");
  const barOn = el("button", { class: "more right spent", type: "button", "aria-label": "More keys", tabindex: "-1" }, "›");
  const bar = el("div", { class: "bar glass" }, barBack, hotbar, barOn);
  const says = el("div", { class: "says", role: "status" });
  // Who they are signed in as: a picture and a name, top centre, for a few seconds when it becomes so.
  const asFace = el("span", { class: "face", "aria-hidden": "true" });
  const asLead = el("small");
  const asName = el("b");
  const asWho = el("div", { class: "as glass", role: "status" }, asFace, el("span", { class: "who" }, asLead, asName));
  // A small way to fill the screen, top centre, on a desk while the screen isn't filled (the owner's ask, 2026-11-21).
  const full = el("button", { class: "full glass", type: "button", hidden: "" }, icon("full"), el("span", {}, fullscreenButton.label));
  const tabs = el("div", { class: "tabs", role: "tablist" });
  // The sections may not all fit. Nothing said so: the strip scrolled sideways with no bar and no sign of it.
  const tabsBack = el("button", { class: "more left", type: "button", "aria-label": "Earlier sections", hidden: "" }, "‹");
  const tabsOn = el("button", { class: "more right", type: "button", "aria-label": "More sections", hidden: "" }, "›");
  const tabbar = el("div", { class: "tabbar" }, tabsBack, tabs, tabsOn);
  let tabsShowing = "";
  /** What the card at the head of the list was last about, so a new one takes the list back to its top. */
  let cardShown = "";
  const tendTabs = () => {
    const most = tabs.scrollWidth - tabs.clientWidth;
    tabsBack.hidden = tabs.scrollLeft <= 6;
    tabsOn.hidden = most <= 6 || tabs.scrollLeft >= most - 6;
  };
  const slideTabs = (by: number) => tabs.scrollBy({ left: by * Math.max(120, tabs.clientWidth * 0.6), behavior: controls.theme.motion ? "smooth" : "auto" });
  tabsBack.addEventListener("click", () => slideTabs(-1));
  tabsOn.addEventListener("click", () => slideTabs(1));
  tabs.addEventListener("scroll", tendTabs, { passive: true });
  // The window was made narrower or wider, or the text larger: what fits has changed.
  const tabsWatch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => tendTabs());
  tabsWatch?.observe(tabs);
  // A mouse's wheel turns up and down: over the strip, that is along it. Over any of it: the arrows at its ends too.
  tabbar.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || tabs.scrollWidth <= tabs.clientWidth) return;
      e.preventDefault();
      tabs.scrollLeft += e.deltaY;
    },
    { passive: false },
  );
  // The bar: too wide or not, and which way there is more. Too wide, both arrows' places are kept (they take 2 × their
  // width from the keys), so whether it would fit is asked of the keys' own width against the bar with those back.
  const arrowsTake = () => (bar.classList.contains("over") ? barBack.offsetWidth + barOn.offsetWidth : 0);
  const tendBar = () => {
    const over = hotbar.scrollWidth > hotbar.clientWidth + arrowsTake() + 1;
    if (bar.classList.contains("over") !== over) bar.classList.toggle("over", over);
    const most = hotbar.scrollWidth - hotbar.clientWidth;
    barBack.classList.toggle("spent", !over || hotbar.scrollLeft <= 6);
    barOn.classList.toggle("spent", !over || most <= 6 || hotbar.scrollLeft >= most - 6);
  };
  // Slid by the page itself, a frame at a time: a browser's own smooth scroll, asked for from a tap, was found to be
  // dropped now and then (a scripted Chrome, 2026-11-21). Any touch, press or wheel on the bar stops it at once.
  let sliding = 0;
  const stopSliding = () => {
    if (sliding) cancelAnimationFrame(sliding);
    sliding = 0;
  };
  const slideBar = (by: number) => {
    stopSliding();
    const from = hotbar.scrollLeft;
    const to = Math.max(0, Math.min(hotbar.scrollWidth - hotbar.clientWidth, from + by * Math.max(110, hotbar.clientWidth * 0.6)));
    if (!controls.theme.motion || typeof requestAnimationFrame !== "function") {
      hotbar.scrollLeft = to;
      return void tendBar();
    }
    const began = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - began) / 240);
      hotbar.scrollLeft = from + (to - from) * (1 - (1 - k) ** 3);
      sliding = k < 1 ? requestAnimationFrame(step) : 0;
      if (!sliding) tendBar();
    };
    sliding = requestAnimationFrame(step);
  };
  for (const type of ["pointerdown", "wheel", "touchstart"] as const) hotbar.addEventListener(type, stopSliding, { passive: true });
  barBack.addEventListener("click", () => slideBar(-1));
  barOn.addEventListener("click", () => slideBar(1));
  hotbar.addEventListener("scroll", tendBar, { passive: true });
  const barWatch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => tendBar());
  barWatch?.observe(hotbar);
  // A mouse's wheel over the bar, too wide: along it, as over the tabs.
  bar.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || hotbar.scrollWidth <= hotbar.clientWidth) return;
      e.preventDefault();
      hotbar.scrollLeft += e.deltaY;
    },
    { passive: false },
  );
  /** The key that led the bar last time it was drawn: one new at its head (Fire, taken in hand) is brought into sight. */
  let barLed = "";
  /** What the bar's keys were last drawn from. */
  let barDrawn = "";
  const rows = el("div", { class: "rows" });
  const note = el("p", { class: "note" });
  const close = el("button", { class: "close", type: "button" }, "Close");
  // Keep the tab that is open on the bar, or take it off: the visitor's own doing, and nobody else's.
  const pinWords = el("span");
  const pinIt = el("button", { class: "pin-it", type: "button", "aria-pressed": "false" }, icon("pin"), pinWords);
  const sheet = el("section", { class: "sheet glass", role: "dialog", "aria-label": "Menu", hidden: "" }, tabbar, rows, note, el("div", { class: "foot" }, pinIt, close));
  // What the room writes. The lines are plain text in a list; the place to write is a real field, so a phone's
  // keyboard, a screen reader and a password manager all know what it is (and that it is not a password).
  const chatTitle = el("b");
  const tabRoom = el("button", { type: "button", class: "tab", role: "tab" }, "Room chat");
  const tabFeed = el("button", { type: "button", class: "tab", role: "tab" }, "My public feed");
  // A private conversation with one person: named for who it is with, so it is never taken for the other two.
  const tabLetters = el("button", { type: "button", class: "tab", role: "tab" }, "Private messages");
  const chatTabs = el("div", { class: "tabs2", role: "tablist" }, tabRoom, tabLetters, tabFeed);
  const feedLead = el("p", { class: "lead" });
  const feedSaid = el("p", { class: "said", role: "status" });
  const chatClose = el("button", { type: "button", "aria-label": "Put this away" }, icon("close"));
  const chatLines = el("ol", { "aria-live": "polite" });
  const ROOM_EMPTY = "Nobody has written anything yet. What is written here goes to the people in this room, and is kept nowhere.";
  const chatEmpty = el("p", { class: "empty" }, ROOM_EMPTY);
  const chatField = el("input", { type: "text", autocomplete: "off", enterkeyhint: "send", "aria-label": "Write to the room", placeholder: "Write to the room" });
  const chatHint = el("p", { class: "hint", role: "status" });
  const chatSend = el("button", { type: "submit" }, "Send");
  const chatForm = el("form", {}, chatField, chatSend);
  const chat = el("section", { class: "chat", "aria-label": "Room chat", "data-state": "closed", "data-tab": "room" }, el("div", { class: "frame glass" }, el("header", {}, chatTitle, chatTabs, chatClose), feedLead, chatEmpty, chatLines, chatHint, feedSaid, chatForm));
  root.append(style, el("i", { class: "corner a", "aria-hidden": "true" }), el("i", { class: "corner b", "aria-hidden": "true" }), id, menu, quiet, asWho, full, says, chat, sheet, el("div", { class: "low" }, loadingLine, target, bar));
  (opts.parent ?? document.body).append(host);

  let open = false;
  let section = "";
  /** Whether the visitor has picked a section themselves. Until they do, the menu comes up on the first: the way home. */
  let chose = false;
  let drawn = "";

  const press = (item: UiItemView) => controls.run(item.id);
  /**
   * A row that copies (`kind: "copy"`): the menu writes the text itself, at this press, in this page. Where a client
   * above draws the menu, a press here is no press in the world's page, and a browser lets a page copy only at one.
   * The world is told of the press like any other.
   */
  const copyRow = (item: UiItemView) => {
    const text = item.copy ?? "";
    void (text && navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error("nothing to copy with"))).then(
      () => controls.say("Copied."),
      () => controls.say(text ? `It couldn't be copied here. It is: ${text}`.slice(0, 200) : "There is nothing to copy."),
    );
    press(item);
  };
  /**
   * The rows typed into (`kind: "field"`), by id: each box is kept while the menu is up, so that what is half typed
   * is still there when the menu is drawn again, which happens whenever anything changes. What is typed is given
   * to the row only at the visitor's press on its button, is never filled in by the menu or the browser, and is
   * gone once pressed or once the menu is put away.
   */
  const fields = new Map<string, { form: HTMLFormElement; input: HTMLInputElement; button: HTMLButtonElement; to: HTMLElement }>();
  /** The box that has the keys just now, if one of them does. */
  const typingNow = () => {
    let at = document.activeElement as HTMLElement | null;
    while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement as HTMLElement;
    return [...fields.values()].find((f) => f.input === at);
  };
  const drawField = (item: UiItemView, whose: string): HTMLElement => {
    let f = fields.get(item.id);
    if (!f) {
      const input = el("input", { type: "text", maxlength: String(MENU_LIMITS.field), autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false", enterkeyhint: "done" });
      const button = el("button", { type: "submit" });
      const to = el("p", { class: "to" });
      const form = el("form", { class: "field" }, input, button, to);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value;
        if (!text.trim()) return;
        // Gone from the box before anything else happens: nothing typed is kept after the press.
        input.value = "";
        controls.run(item.id, text);
      });
      f = { form, input, button, to };
      fields.set(item.id, f);
    }
    f.input.setAttribute("aria-label", item.label);
    f.button.textContent = item.label;
    f.to.textContent = whose ? `What you type here goes to ${whose}.` : "";
    return f.form;
  };
  /** Forget every box, and anything half typed in one. */
  const clearFields = () => {
    for (const f of fields.values()) f.input.value = "";
    fields.clear();
  };
  /** A tab kept on the bar: pressed, the menu comes up on it; pressed again while it is up, the menu is put away. */
  const openPin = (id: string) => {
    controls.signal("press");
    if (open && section === id) setOpen(false);
    else setOpen(true, id);
  };

  /** The card at the head of a section. Every word is set as text; the picture is fetched the kit's way and drawn. */
  const drawCard = (card: UiCard, acts: (HTMLElement | string)[] = []): HTMLElement => {
    const face = el("span", { class: "face", "aria-hidden": "true" }, [...card.title][0]?.toUpperCase() ?? "");
    if (card.color) face.style.setProperty("--c", card.color);
    const paint = card.draw;
    if (paint) {
      // A thing, not a person: drawn large, and again many times a second while it is on show, so it may turn.
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const g = canvas.getContext("2d");
      let had = false;
      const tick = (): void => {
        // Left alone once it is off the page, or the menu is put away: nothing is drawn that nobody sees.
        if (had && (!canvas.isConnected || sheet.hidden)) return;
        const now = paint();
        if (now && g) {
          g.clearRect(0, 0, 256, 256);
          g.drawImage(now, 0, 0, 256, 256);
          if (!had) face.replaceChildren(canvas);
          had = true;
        }
        if (canvas.isConnected || !had) requestAnimationFrame(tick);
      };
      // Tried a few times before giving up: its model may be on its way.
      let tries = 0;
      const begin = (): void => {
        if (!face.isConnected && ++tries < 3) return void requestAnimationFrame(begin);
        tick();
      };
      requestAnimationFrame(begin);
    }
    if (card.picture) {
      void loadPicture(card.picture).then((drawn) => {
        if (!drawn || !face.isConnected) return;
        // A copy of its own: a canvas can be in one place only, and the same picture is over their head too.
        const copy = document.createElement("canvas");
        copy.width = drawn.width;
        copy.height = drawn.height;
        copy.getContext("2d")?.drawImage(drawn, 0, 0);
        face.replaceChildren(copy);
      });
    }
    const copyKey = card.copy ? el("button", { type: "button" }, "Copy key") : null;
    copyKey?.addEventListener("click", () => {
      void (navigator.clipboard?.writeText(card.copy) ?? Promise.reject(new Error("no clipboard"))).then(
        () => controls.say("The key is copied, in full."),
        () => controls.say(`The key: ${card.copy}`),
      );
    });
    const head = el("h3", {}, card.title, card.tag && el("span", { class: card.proven ? "tag proven" : "tag" }, card.tag));
    const key = el("div", { class: "keyline" }, el("span", { class: card.copy ? "mono" : "" }, card.sub), copyKey);
    const words = card.text && el("blockquote", {}, card.text);
    const now = card.now.length > 0 && el("p", { class: "now" }, card.now.join(", "));
    // A thing: its picture on one side, and beside it everything about it and everything to do with it, so the
    // card is filled and what to press is next to what it is about. On a narrow screen what to do goes under.
    if (card.draw) {
      return el(
        "div",
        { class: "person thing", role: "group", "aria-label": `About ${card.title}` },
        face,
        el("div", { class: "about" }, head, key, words, now),
        acts.length > 0 && el("div", { class: "acts" }, ...acts),
      );
    }
    return el("div", { class: "person", role: "group", "aria-label": `About ${card.title}` }, face, head, key, words, now);
  };

  // ---- the chat panel. "closed" shows nothing, "peek" the newest lines for a few seconds, "open" all of it.
  let chatState: "closed" | "peek" | "open" = "closed";
  /** Which side of it is up while it is open: what the room writes, or the visitor's own public feed. */
  let dockTab: "room" | "feed" | "letters" = "room";
  let chatDrawn = "";
  let chatNewest = "";
  let peekTimer: ReturnType<typeof setTimeout> | undefined;
  let goingTimer: ReturnType<typeof setTimeout> | undefined;
  const PEEK_LINES = 4;
  const PEEK_MS = 9000;
  const setChatState = (next: "closed" | "peek" | "open") => {
    clearTimeout(peekTimer);
    clearTimeout(goingTimer);
    chat.classList.remove("going");
    chatState = next;
    if (next === "peek") {
      goingTimer = setTimeout(() => chat.classList.add("going"), PEEK_MS - 700);
      peekTimer = setTimeout(() => {
        if (chatState === "peek") setChatState("closed");
        draw();
      }, PEEK_MS);
    }
  };
  const drawChat = (view: UiView) => {
    const c = view.chat;
    const f = view.feed;
    const l = view.letters;
    const readyOf = (tab: "room" | "feed" | "letters") => (tab === "feed" ? f.ready : tab === "letters" ? l.ready : c.ready);
    // The side that is up has gone (the room was left, they signed out, a conversation was put away): another, or nothing.
    if (chatState === "open" && !readyOf(dockTab)) {
      const other = (["room", "letters", "feed"] as const).find(readyOf);
      if (other) dockTab = other;
      else setChatState("closed");
    }
    if (chatState === "peek" && !c.ready) setChatState("closed");
    // Something new was written while it was put away: it passes by, where it will be when the panel opens.
    const newest = c.lines[c.lines.length - 1]?.key ?? "";
    if (c.ready && newest && newest !== chatNewest && chatState !== "open" && !c.lines[c.lines.length - 1]!.mine) setChatState("peek");
    chatNewest = newest;
    const showing = chatState === "open" ? dockTab : "room";
    // "5 min ago" is worked out again each minute.
    const now = JSON.stringify([chatState, showing, c.version, c.ready, f.version, f.ready, l.version, l.ready, showing === "feed" ? [Math.floor(Date.now() / 60000), f.lead] : showing === "letters" ? [Math.floor(Date.now() / 60000), l.title] : 0]);
    if (now === chatDrawn) return;
    chatDrawn = now;
    chat.dataset.state = chatState;
    chat.dataset.tab = showing;
    chat.setAttribute("aria-label", showing === "feed" ? f.title : showing === "letters" ? l.title : "Room chat");
    // More than one side is there: a tab for each. One: its name.
    const both = [c.ready, f.ready, l.ready].filter(Boolean).length > 1;
    chatTabs.hidden = !both;
    chatTitle.hidden = both;
    chatTitle.textContent = showing === "feed" ? f.title : showing === "letters" ? l.title : c.title;
    tabRoom.hidden = !c.ready;
    tabFeed.hidden = !f.ready;
    tabLetters.hidden = !l.ready;
    tabLetters.textContent = l.title;
    tabLetters.setAttribute("aria-selected", String(showing === "letters"));
    tabRoom.textContent = c.unread && showing !== "room" ? `Room chat: ${c.unread} new` : "Room chat";
    tabRoom.setAttribute("aria-selected", String(showing === "room"));
    tabFeed.setAttribute("aria-selected", String(showing === "feed"));
    feedLead.hidden = showing === "room";
    feedSaid.hidden = showing === "room";
    chatField.maxLength = showing === "feed" ? f.limit : showing === "letters" ? l.limit : c.limit;
    const words = showing === "feed" ? "Write a post" : showing === "letters" ? `Write to ${l.with}, privately` : "Write to the room";
    chatField.placeholder = words;
    chatField.setAttribute("aria-label", words);
    chatSend.textContent = showing === "feed" ? "Send out a post" : "Send";
    if (showing === "feed") {
      feedLead.textContent = f.lead;
      feedSaid.textContent = f.said;
      const nowSec = Math.floor(Date.now() / 1000);
      // Every word is set as text. A post may hold an address: it is shown as words, and nothing is fetched or opened.
      chatLines.replaceChildren(
        ...f.posts.map((p) => {
          const when = el("small", {}, p.state === "sending" ? "Sending…" : p.state === "failed" ? "Not sent" : p.state === "removing" ? "Deleting…" : ago(p.at, nowSec));
          // A post that is out, and that their sign-in address can be asked about: deleting it is theirs to ask for.
          // The asking, and the "are you sure", are their sign-in address's own (NSWP-10, "Asking the person").
          if (f.removable && p.id && p.state === "out") {
            const remove = el("button", { type: "button", class: "post-remove" }, "Delete");
            remove.addEventListener("click", () => {
              const trouble = controls.feed.remove(p.key);
              if (trouble) controls.say(trouble);
            });
            when.append(" · ", remove);
          }
          return el("li", { class: `post ${p.state}` }, p.text, when);
        }),
      );
      chatEmpty.textContent = f.loading ? "Fetching your posts…" : "Nothing here yet. What you send out appears here, and on Nostr for anyone to read.";
      chatEmpty.hidden = f.posts.length > 0;
      chatLines.hidden = f.posts.length === 0;
      return;
    }
    if (showing === "letters") {
      feedLead.textContent = l.lead;
      feedSaid.textContent = l.said;
      const nowSec = Math.floor(Date.now() / 1000);
      const wasAtEnd = chatLines.scrollHeight - chatLines.scrollTop - chatLines.clientHeight < 40;
      // Every word is set as text. A message may hold an address: it is shown as words, and nothing is fetched or opened.
      chatLines.replaceChildren(
        ...l.lines.map((line) =>
          el("li", { class: `letter ${line.mine ? "mine" : ""} ${line.state}` }, el("b", {}, line.mine ? "You" : line.who), " ", line.text, el("small", {}, line.state === "sending" ? "Sending…" : line.state === "failed" ? "Not sent" : ago(line.at, nowSec))),
        ),
      );
      chatEmpty.textContent = `Nothing yet. What you write here is for ${l.with} alone.`;
      chatEmpty.hidden = l.lines.length > 0;
      chatLines.hidden = l.lines.length === 0;
      if (wasAtEnd || l.lines[l.lines.length - 1]?.mine) chatLines.scrollTop = chatLines.scrollHeight;
      controls.letters.seen();
      return;
    }
    const lines = chatState === "peek" ? c.lines.slice(-PEEK_LINES) : c.lines;
    const atEnd = chatLines.scrollHeight - chatLines.scrollTop - chatLines.clientHeight < 40;
    chatLines.replaceChildren(
      ...lines.map((line) => {
        // A space between the name and the words, for whoever hears the line read out: the gap seen is a margin.
        const li = el("li", { class: line.note ? "aside" : line.mine ? "mine" : "" }, !line.note && el("b", {}, line.mine ? "You" : line.who), line.note ? "" : " ", line.text);
        if (line.color && !line.mine) li.style.setProperty("--who", line.color);
        return li;
      }),
    );
    chatEmpty.textContent = ROOM_EMPTY;
    chatEmpty.hidden = lines.length > 0;
    chatLines.hidden = lines.length === 0;
    if (chatState === "open" && (atEnd || lines[lines.length - 1]?.mine)) chatLines.scrollTop = chatLines.scrollHeight;
    if (chatState === "open") controls.chat.seen();
  };
  const setChatOpen = (next: boolean, tab?: "room" | "feed" | "letters") => {
    if (next) {
      const c = controls.chat.view();
      const f = controls.feed.view();
      const l = controls.letters.view();
      const want = tab ?? (chatState === "open" ? dockTab : c.ready ? "room" : l.ready ? "letters" : "feed");
      if (!(want === "feed" ? f.ready : want === "letters" ? l.ready : c.ready) || host.hidden || controls.view().presence === "hidden") return;
      const was = chatState === "open";
      if (was && want === dockTab) return;
      dockTab = want;
      // Their posts are asked for when they ask to see them, and not before.
      if (want === "feed") controls.feed.opened();
      chatHint.textContent = "";
      if (!was) {
        // One thing at a time over the world: the menu goes away for the chat, and the chat for the menu.
        if (open) setOpen(false);
        chatCameFrom = focused();
        setChatState("open");
      }
      draw();
      chatLines.scrollTop = want === "feed" ? 0 : chatLines.scrollHeight;
      chatField.focus({ preventScroll: true });
      controls.signal(want === "feed" ? "feedOpen" : "chatOpen");
      return;
    }
    if (chatState !== "open") return;
    setChatState("closed");
    draw();
    controls.signal("chatClose");
    const back = chatCameFrom;
    chatCameFrom = null;
    if (back?.isConnected && back !== document.body && !chat.contains(back) && getComputedStyle(back).display !== "none") back.focus({ preventScroll: true });
    else focused()?.blur();
  };
  let chatCameFrom: HTMLElement | null = null;
  chatClose.addEventListener("click", () => setChatOpen(false));
  tabRoom.addEventListener("click", () => setChatOpen(true, "room"));
  tabFeed.addEventListener("click", () => setChatOpen(true, "feed"));
  tabLetters.addEventListener("click", () => setChatOpen(true, "letters"));
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = chatField.value;
    // Enter on an empty line puts the panel away, as it does in a game.
    if (!text.trim()) return setChatOpen(false);
    const trouble = dockTab === "feed" ? controls.feed.send(text) : dockTab === "letters" ? controls.letters.send(text) : controls.chat.send(text);
    chatHint.textContent = trouble ?? "";
    if (!trouble) chatField.value = "";
    if (!trouble && dockTab === "feed") chatLines.scrollTop = 0;
    chatField.focus({ preventScroll: true });
  });
  // What is typed here is for the room, not for the world: no key pressed in the field walks anybody anywhere or
  // opens anything. Letting go of a key is still heard, so one held on the way in doesn't stay held.
  chatField.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      setChatOpen(false);
    }
  });
  chatField.addEventListener("keypress", (e) => e.stopPropagation());
  // A keyboard on the glass (a phone's) covers the bottom of the page without telling the layout. The window that
  // can still be seen says where it ends, and the panel stands on that.
  const vv = typeof visualViewport === "undefined" ? null : visualViewport;
  const onViewport = () => {
    if (!vv) return;
    const covered = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
    host.classList.toggle("keys-up", covered > 80 && chatState === "open");
    host.style.setProperty("--kb", `${covered}px`);
  };
  vv?.addEventListener("resize", onViewport);
  vv?.addEventListener("scroll", onViewport);

  /**
   * Say who they are signed in as, when that becomes so, and that they are signed out, when that does: once each
   * time, for a few seconds. It is read from the card at the head of You, which every world and client fills the
   * same way, so it says the same thing everywhere. A guest who was never signed in is told nothing.
   */
  let asKey: string | null = null;
  let asPicture = "";
  let asTimer: ReturnType<typeof setTimeout> | undefined;
  const AS_SHOWN_MS = 5200;
  const sayWho = (card: UiCard | null) => {
    const key = card ? card.copy || card.title : "";
    const first = asKey === null;
    const changed = key !== asKey;
    asKey = key;
    if (card) {
      // The same person, whose name or picture has only now arrived: what is shown is put right where it stands.
      asLead.textContent = "Signed in as";
      asName.textContent = card.title;
      if (changed || card.picture !== asPicture) {
        asPicture = card.picture;
        asFace.replaceChildren([...card.title][0]?.toUpperCase() ?? "");
        const want = card.picture;
        if (want) {
          void loadPicture(want).then((drawn) => {
            if (!drawn || asPicture !== want) return;
            const copy = document.createElement("canvas");
            copy.width = drawn.width;
            copy.height = drawn.height;
            copy.getContext("2d")?.drawImage(drawn, 0, 0);
            asFace.replaceChildren(copy);
          });
        }
      }
    }
    if (!changed || (first && !card)) return;
    if (!card) {
      asPicture = "";
      asLead.textContent = "Signed out";
      asName.textContent = "You are a guest here";
    }
    // In a headset the page can't be seen: it is said the way everything is said there.
    if (host.hidden) {
      const words = card ? `Signed in as ${card.title}.` : "Signed out. You are a guest here.";
      return queueMicrotask(() => controls.say(words));
    }
    asWho.classList.toggle("plain", !card);
    asWho.classList.add("shown");
    clearTimeout(asTimer);
    asTimer = setTimeout(() => asWho.classList.remove("shown"), AS_SHOWN_MS);
  };

  const draw = () => {
    const view: UiView = controls.view();
    const t = view.theme;
    host.style.setProperty("--accent", rgb(t.accent));
    host.style.setProperty("--ink", rgb(t.ink));
    host.style.setProperty("--glass", rgb(t.glass));
    host.style.setProperty("--warn", rgb(t.warn));
    host.style.setProperty("--s", String(t.scale));
    host.classList.toggle("moving", t.motion);
    host.dataset.presence = view.presence;
    host.dataset.corner = view.corner;
    host.classList.toggle("no-menu-key", view.keys.menu === null);
    host.classList.toggle("no-hotbar-keys", !view.keys.hotbar);
    const key = menu.querySelector("kbd");
    if (key && view.keys.menu) key.textContent = view.keys.menu.toUpperCase();
    title.textContent = view.title;
    address.textContent = view.address;
    sayWho(view.sections.find((section) => section.id === "you")?.card ?? null);
    // The way to fill the screen, where there is one and it isn't filled: out of the way while who they are is said there.
    full.hidden = !fullscreenButton.shown() || view.presence === "hidden" || asWho.classList.contains("shown");
    // Still loading: said in the world's own words, as text, with how far along where it can say.
    const loads = view.loading;
    // Out of the way while the menu is up, where it would sit over the sheet's foot; back when it is put away.
    loadingLine.hidden = !loads || open;
    if (loads) {
      loadingWhat.textContent = loads.words || "Still loading";
      loadingMuch.textContent = loads.fraction === null ? "" : `${Math.floor(loads.fraction * 100)}%`;
      loadingLine.classList.toggle("unknown", loads.fraction === null);
      loadingFill.style.setProperty("--f", String(loads.fraction ?? 0));
    }
    const shown = [view.target, ...view.detail].join("\n");
    if (target.dataset.shown !== shown) {
      target.dataset.shown = shown;
      target.classList.toggle("card", view.detail.length > 0);
      if (view.detail.length) target.replaceChildren(el("b", {}, view.target), ...view.detail.map((line) => el("span", {}, line)));
      else target.textContent = view.target;
    }

    drawChat(view);

    if (!view.sections.some((s) => s.id === section)) section = view.sections[0]?.id ?? "";
    // Rebuilding the buttons would drop the keyboard's place among them, so only do it when something they show has changed.
    const now = JSON.stringify([view.hotbar, view.pins, view.pinsFull, view.sections, section, open, view.presence]);
    if (now === drawn) return;
    drawn = now;

    const here = view.sections.find((s) => s.id === section);
    pinIt.hidden = !here;
    pinIt.setAttribute("aria-pressed", String(!!here?.pinned));
    pinIt.disabled = !here?.pinned && view.pinsFull;
    pinWords.textContent = here?.pinned ? "On your bar. Take it off" : view.pinsFull ? "Your bar is full" : "Keep this tab on your bar";
    pinIt.title = here?.pinned ? "" : view.pinsFull ? "Take a tab off your bar to keep another on it." : "It stays on your bar in every world that has this tab.";

    // The bar's own keys, likewise: only when something on them has changed. Rebuilt for a change elsewhere in the
    // menu, a bar the visitor was sliding along would stop where it was.
    const barNow = JSON.stringify([view.hotbar, view.pins, open ? section : ""]);
    if (barNow !== barDrawn) {
      barDrawn = barNow;
      hotbar.replaceChildren(
        ...view.hotbar.map((item, i) => {
          const b = el(
            "button",
            { class: `key ${item.tone}`, type: "button", "aria-label": item.label, ...(item.on === null ? {} : { "aria-pressed": String(item.on) }) },
            el("span", { class: "arch" }, icon(item.icon ?? "door")),
            el("span", { class: "sill" }),
            el("span", { class: "name" }, item.short),
            el("kbd", { class: "num mono" }, item.key),
          );
          b.style.setProperty("--i", String(i));
          b.addEventListener("click", () => press(item));
          return b;
        }),
        // The tabs they pinned, after the place's own keys: each brings the menu up on its tab, or puts it away.
        ...(view.pins.length && view.hotbar.length ? [el("i", { class: "theirs", "aria-hidden": "true" })] : []),
        ...view.pins.map((pin, i) => {
          const b = el(
            "button",
            { class: "key pin normal", type: "button", "aria-label": `${pin.label}: a tab you keep on your bar`, "aria-pressed": String(open && section === pin.id) },
            el("span", { class: "arch" }, icon(pin.icon ?? "menu")),
            el("span", { class: "sill" }),
            el("span", { class: "name" }, pin.label),
            el("kbd", { class: "num mono" }, pin.key),
          );
          b.style.setProperty("--i", String(view.hotbar.length + i));
          b.addEventListener("click", () => openPin(pin.id));
          return b;
        }),
      );
      bar.hidden = view.hotbar.length === 0 && view.pins.length === 0;
      // What leads the bar is what is in hand (Fire and Reload lead it): new at its head, the bar goes back to its start
      // so a visitor who had slid it along sees them. Otherwise a bar they slid stays where they left it.
      const led = view.hotbar[0]?.id ?? "";
      if (led !== barLed && led) {
        // A slide under way would carry on from where it was: it is stopped first.
        stopSliding();
        hotbar.scrollLeft = 0;
      }
      barLed = led;
      // Watched for size, the keys too: one that grows (text made larger, a font arriving late) changes what fits
      // without the bar's own box changing.
      barWatch?.disconnect();
      barWatch?.observe(hotbar);
      for (const k of hotbar.children) barWatch?.observe(k);
      requestAnimationFrame(tendBar);
    }

    tabs.replaceChildren(
      ...view.sections.map((s) => {
        // One stop for the Tab key, on the tab that is up: left and right go along the rest (below).
        const b = el("button", { class: "tab", type: "button", role: "tab", "aria-selected": String(s.id === section), tabindex: s.id === section ? "0" : "-1" }, icon(s.icon), s.label);
        b.addEventListener("click", () => {
          section = s.id;
          chose = true;
          draw();
          (tabs.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus();
        });
        return b;
      }),
    );
    // The section that is up is brought into sight when it is chosen or the menu comes up, and not otherwise: a
    // strip the visitor has slid along stays where they left it. The arrows say which way there is more.
    const showing = open ? section : "";
    const bring = showing !== tabsShowing;
    tabsShowing = showing;
    // Measured once the menu has been laid out: asked for now, while it may still be put away, every width is nought.
    requestAnimationFrame(() => {
      const chosen = tabs.querySelector('[aria-selected="true"]') as HTMLElement | null;
      if (bring && open && chosen) {
        // Clear of the arrows at either end. (The strip is what its tabs are placed in, so these are along it.)
        const clear = 46;
        const left = chosen.offsetLeft - clear;
        const right = chosen.offsetLeft + chosen.offsetWidth + clear - tabs.clientWidth;
        if (tabs.scrollLeft > left) tabs.scrollLeft = Math.max(0, left);
        else if (tabs.scrollLeft < right) tabs.scrollLeft = right;
      }
      tendTabs();
    });
    const current = view.sections.find((s) => s.id === section);
    const drawSwatch = (item: UiItemView) => {
      const b = el("button", { class: "swatch", type: "button", "aria-label": item.label, "aria-pressed": String(item.on === true) }, el("i"), el("u"), item.label);
      b.style.setProperty("--c", item.color);
      b.addEventListener("click", () => press(item));
      return b;
    };
    const drawTile = (item: UiItemView) => {
      const shown = el("span", { class: "shown", "aria-hidden": "true" }, [...item.short][0]?.toUpperCase() ?? "");
      const picture = item.picture?.();
      if (picture) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 192;
        canvas.getContext("2d")?.drawImage(picture, 0, 0, 192, 192);
        shown.replaceChildren(canvas);
      }
      const b = el(
        "button",
        { class: item.faint ? "tile faint" : "tile", type: "button", "aria-label": item.label, "aria-pressed": String(item.on === true) },
        shown,
        el("span", {}, item.label),
        ...(item.mark ? [el("i", { class: "corner-mark", "aria-hidden": "true" }, icon(item.mark))] : []),
      );
      b.addEventListener("click", () => press(item));
      return b;
    };
    const drawRow = (item: UiItemView) => {
      const b = el(
        "button",
        { class: `row ${item.tone}`, type: "button", ...(item.on === null ? {} : { "aria-pressed": String(item.on) }) },
        icon(item.icon),
        el("span", { class: "grow" }, item.label),
        item.on !== null && el("span", { class: "state" }, item.on ? "On" : "Off"),
        item.key ? el("kbd", { class: "mono" }, item.key) : null,
      );
      b.addEventListener("click", () => (item.kind === "copy" ? copyRow(item) : press(item)));
      return b;
    };
    // Something to read: not a button, never focused, never pressed. Its words are the whole sentence, which says
    // whether it is so, so a screen reader hears that and not "dimmed".
    const drawLine = (item: UiItemView) => el("p", { class: `line ${item.on ? "on" : "off"}` }, icon(item.icon), el("span", {}, item.label));
    // In the order they were given. Choices of colour that come together are one strip, and things with pictures
    // that come together are laid out side by side: each where it was put, among the rows.
    const lay = (items: UiItemView[]): (HTMLElement | string)[] => {
      const laid: (HTMLElement | string)[] = [];
      let run = null as { kind: string; box: HTMLElement } | null;
      for (const item of items) {
        if (item.kind === "button" || item.kind === "line" || item.kind === "copy" || item.kind === "field") {
          run = null;
          laid.push(item.kind === "line" ? drawLine(item) : item.kind === "field" ? drawField(item, view.title) : drawRow(item));
          continue;
        }
        if (run?.kind !== item.kind) {
          run = { kind: item.kind, box: el("div", { class: item.kind === "tile" ? "tiles" : "swatches" }) };
          laid.push(run.box);
        }
        run.box.append(item.kind === "tile" ? drawTile(item) : drawSwatch(item));
      }
      return laid;
    };
    // What is about the card's own thing goes inside the card, beside its picture; the rest is the list under it.
    const inCard = new Set(current?.card?.draw ? (current.card.acts ?? []) : []);
    const laid = lay((current?.items ?? []).filter((item) => !inCard.has(item.id)));
    const beside = lay((current?.items ?? []).filter((item) => inCard.has(item.id)));
    // A card about something else than before: it is at the top of the list, so the list is taken back there.
    const about = current?.card ? `${section}:${current.card.title}` : "";
    const fresh = about !== cardShown;
    cardShown = about;
    // A box being typed in keeps the keys, and where the visitor was in it, though the list is laid out afresh.
    const typingIn = typingNow();
    const at = typingIn ? ([typingIn.input.selectionStart, typingIn.input.selectionEnd] as const) : null;
    rows.replaceChildren(current?.card ? drawCard(current.card, beside) : "", ...laid);
    if (typingIn?.form.isConnected) {
      typingIn.input.focus();
      if (at && at[0] !== null && at[1] !== null) typingIn.input.setSelectionRange(at[0], at[1]);
    }
    // A row that is no longer anywhere takes what was half typed in it away with it.
    const still = new Set(view.sections.flatMap((s) => s.items.filter((i) => i.kind === "field").map((i) => i.id)));
    for (const id of [...fields.keys()]) if (!still.has(id)) fields.delete(id);
    if (fresh && about) rows.scrollTop = 0;
    rows.hidden = !current?.items.length && !current?.card;
    note.textContent = current?.note ?? "";
    sheet.hidden = !open;
    menu.setAttribute("aria-expanded", String(open));
    quiet.setAttribute("aria-expanded", String(open));
  };

  /** Whatever has the keys now, looked for inside shadow roots too. */
  const focused = (): HTMLElement | null => {
    let at = document.activeElement as HTMLElement | null;
    while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement as HTMLElement;
    return at;
  };
  /** What had the keys when the menu came up: they go back to it when the menu goes away. */
  let cameFrom: HTMLElement | null = null;
  const setOpen = (next: boolean, at?: string) => {
    // Asked for by name: that section, whether the menu is up already or not.
    if (next && at) {
      section = at;
      chose = true;
      if (open) return void draw();
    }
    if (open === next) return;
    if (next) {
      if (chatState === "open") setChatOpen(false);
      cameFrom = focused();
      // Sections fill in as a world starts up, so "the first" is asked for again each time it comes up.
      if (!chose) section = "";
    }
    open = next;
    if (!open) clearFields();
    controls.signal(open ? "menuOpen" : "menuClose");
    draw();
    if (open) return void (tabs.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus();
    // Closing leaves nothing of ours holding the keys: they go back to whatever had them, the world's own
    // interface included, and to our own mark only if that is where the visitor came from.
    const back = cameFrom;
    cameFrom = null;
    if (back?.isConnected && back !== document.body && getComputedStyle(back).display !== "none") back.focus({ preventScroll: true });
    else focused()?.blur();
  };
  // Shown inside a client that draws the sign-in address's panel over the world (client-frame.ts): the panel is
  // drawn where this menu is, so the menu says where that is, steps aside while the panel is up, and comes back.
  setMenuPlace(() => {
    if (!open || sheet.hidden) return null;
    const r = sheet.getBoundingClientRect();
    return r.width > 0 ? { left: Math.round(r.left), width: Math.round(r.width), bottom: Math.round(innerHeight - r.bottom) } : null;
  });
  let asideFor: string | null = null;
  onClientSignIn((up, failed) => {
    // It never came up (a sign-in address that has no panel yet, or can't be reached): said, and the old way is next.
    if (failed) controls.say("The sign-in panel didn't come up. Press that again, and a window opens instead.");
    if (up) {
      asideFor = open ? section : null;
      if (open) setOpen(false);
    } else if (asideFor !== null) {
      const back = asideFor;
      asideFor = null;
      setOpen(true, back);
    }
  });
  menu.addEventListener("click", () => setOpen(!open));
  quiet.addEventListener("click", () => setOpen(!open));
  close.addEventListener("click", () => setOpen(false));
  pinIt.addEventListener("click", () => {
    const here = controls.view().sections.find((s) => s.id === section);
    if (!here) return;
    if (!controls.setPinned(here.id, !here.pinned)) return controls.say("Your bar is full. Take a tab off it to keep another on it.");
    controls.say(here.pinned ? `${here.label} is off your bar.` : `${here.label} is on your bar, here and in every world that has it.`);
  });

  const onKey = (e: KeyboardEvent) => {
    if (host.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const at = e.composedPath()[0] as HTMLElement | undefined;
    if (at && (at.tagName === "INPUT" || at.tagName === "TEXTAREA" || at.isContentEditable)) return;
    // Escape: in fullscreen, where the page holds the key, the first opens the menu and the next leaves fullscreen
    // (ui/fullscreen.ts, `escapeDoes`). Otherwise it closes an open menu whatever the world has done with the other
    // keys: a way out of our own sheet is ours to keep.
    if (e.key === "Escape") {
      const does = escapeDoes({ menuOpen: open, held: escapeHeld() });
      if (does !== "nothing") e.preventDefault();
      if (does === "close-menu") return setOpen(false);
      if (does === "open-menu") return setOpen(true);
      if (does === "leave-fullscreen") return void leaveFullscreen();
    }
    const view = controls.view();
    if (view.keys.menu && e.key.toLowerCase() === view.keys.menu && view.presence !== "hidden") return setOpen(!open);
    // Enter, or the chat key, opens the chat to write in. Enter on a button is that button's, and is left alone.
    if (view.keys.chat && view.chat.ready && view.presence !== "hidden" && !open && !e.repeat && (e.key.toLowerCase() === view.keys.chat || (e.key === "Enter" && at?.tagName !== "BUTTON" && at?.tagName !== "A"))) {
      // Or the letter that opened it would be the first thing written.
      e.preventDefault();
      return setChatOpen(true);
    }
    if (!view.keys.hotbar || view.presence !== "full") return;
    const item = view.hotbar.find((i) => i.key === e.key);
    if (item) return press(item);
    const pin = view.pins.find((p) => p.key && p.key === e.key);
    if (pin) openPin(pin.id);
  };
  addEventListener("keydown", onKey);
  full.addEventListener("click", () => {
    void fullscreenButton.press(controls).then(draw);
  });
  // Where a browser won't hand the page Escape, its own Escape takes the screen back: the menu comes up then, as the
  // first Escape does where it is the page's.
  const stopLeft = onBrowserLeftFullscreen(() => {
    if (!open && !host.hidden) setOpen(true);
    draw();
  });
  document.addEventListener("fullscreenchange", draw);

  // Left and right go along the menu's tabs while it is up, wherever the keys are: unless they are somewhere with
  // a use of its own for them (a box being typed in, a slider). Home and End go to the first and the last. Heard
  // before the world hears anything, and kept from it: or it would turn the visitor round behind their menu.
  const onTabKey = (e: KeyboardEvent) => {
    if (!open || host.hidden || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const at = e.composedPath()[0] as HTMLElement | undefined;
    const onStrip = !!at && typeof at.tagName === "string" && tabs.contains(at);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    if (at && !onStrip && (at.tagName === "INPUT" || at.tagName === "TEXTAREA" || at.tagName === "SELECT" || at.isContentEditable)) return;
    const ids = controls.view().sections.map((x) => x.id);
    if (ids.length < 2) return;
    const now = Math.max(0, ids.indexOf(section));
    const to = step ? (now + step + ids.length) % ids.length : e.key === "Home" ? 0 : ids.length - 1;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (to === now) return;
    section = ids[to]!;
    chose = true;
    draw();
    (tabs.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus();
  };
  addEventListener("keydown", onTabKey, true);

  // The summons (summon.ts): the visitor's own way to their controls, in every world. It answers whatever the
  // world has done with its screen and its keys, and it is heard before the world hears anything, so a world
  // can neither take the gesture nor be disturbed by it.
  const onSummonKey = (e: KeyboardEvent) => {
    if (e.code !== SUMMON_KEY || host.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const at = e.composedPath()[0] as HTMLElement | undefined;
    if (at && (at.tagName === "INPUT" || at.tagName === "TEXTAREA" || at.isContentEditable)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) setOpen(!open);
  };
  const swallow = (e: KeyboardEvent) => {
    if (e.code === SUMMON_KEY && !host.hidden && !e.ctrlKey && !e.metaKey && !e.altKey) e.stopImmediatePropagation();
  };
  const hold = createHoldWatch({
    onHeld: () => {
      if (!host.hidden) setOpen(!open);
    },
  });
  const onTouch = (e: TouchEvent) => hold.touches([...e.touches].map((t) => ({ x: t.clientX, y: t.clientY })));
  const listening = { capture: true } as const;
  const watching = { capture: true, passive: true } as const;
  addEventListener("keydown", onSummonKey, listening);
  addEventListener("keyup", swallow, listening);
  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) addEventListener(type, onTouch, watching);

  const stopSay = controls.onSay((text) => {
    const line = el("div", { class: "say glass" }, text);
    says.append(line);
    while (says.childElementCount > 3) says.firstElementChild?.remove();
    setTimeout(() => line.classList.add("going"), 3600);
    setTimeout(() => line.remove(), 4200);
  });
  const stop = controls.subscribe(draw);
  // Something in the world asks for the menu on one of its sections: pressing someone's picture asks for People.
  const stopAsking = controls.onSignal((name) => {
    if (name.startsWith("show:") && !host.hidden) setOpen(true, name.slice(5));
    if (name === "toggle:chat" && !host.hidden) setChatOpen(!(chatState === "open" && dockTab === "room"), "room");
    if (name === "toggle:feed" && !host.hidden) setChatOpen(!(chatState === "open" && dockTab === "feed"), "feed");
    if (name === "open:letters" && !host.hidden) setChatOpen(true, "letters");
  });
  // Words that are worked out afresh each time (a room's status, a toggle) are read on a slow tick.
  const tick = setInterval(draw, 400);
  // Things arrive once, when the HUD first appears. A key redrawn later is simply there.
  host.classList.add("arriving");
  setTimeout(() => host.classList.remove("arriving"), 1200);
  draw();

  return {
    element: host,
    get open() {
      return open;
    },
    setOpen,
    get chatOpen() {
      return chatState === "open";
    },
    get chatTab() {
      return dockTab;
    },
    setChatOpen,
    bounds() {
      if (host.hidden) return [];
      return [id, menu, quiet, bar, target, loadingLine, sheet, ...(chatState === "open" ? [chat] : [])]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }));
    },
    cover() {
      if (host.hidden || controls.presence !== "full") return { top: 0, bottom: 0 };
      const low = bar.getBoundingClientRect();
      const high = id.getBoundingClientRect();
      // The controls, and not the words about what is pointed at: those come and go as the pointer moves, and a
      // page that moves its picture clear of what is covered would move it every time something was pointed at.
      return { top: Math.round(high.bottom), bottom: Math.round(innerHeight - low.top) };
    },
    setHidden(hidden) {
      host.hidden = hidden;
      if (hidden) {
        setOpen(false);
        setChatOpen(false);
      }
    },
    remove() {
      clearInterval(tick);
      clearTimeout(asTimer);
      tabsWatch?.disconnect();
      barWatch?.disconnect();
      stopSliding();
      clearTimeout(peekTimer);
      clearTimeout(goingTimer);
      vv?.removeEventListener("resize", onViewport);
      vv?.removeEventListener("scroll", onViewport);
      stop();
      stopAsking();
      stopSay();
      removeEventListener("keydown", onKey);
      stopLeft();
      document.removeEventListener("fullscreenchange", draw);
      removeEventListener("keydown", onSummonKey, listening);
      removeEventListener("keydown", onTabKey, true);
      removeEventListener("keyup", swallow, listening);
      for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) removeEventListener(type, onTouch, watching);
      hold.cancel();
      host.remove();
    },
  };
}

/**
 * The menu over a world's own controls: the direct carrier, which is what a world with no client above it has.
 * `mountMenu(portHere(controls))`, under the name it has always had.
 */
export function mountHud(controls: Controls, opts: { parent?: HTMLElement } = {}): Hud {
  return mountMenu(portHere(controls), opts);
}
