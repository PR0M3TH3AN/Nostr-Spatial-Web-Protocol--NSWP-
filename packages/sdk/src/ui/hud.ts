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
 * Keys: 1 to 6 press the hotbar, M opens the menu, Escape closes it.
 */
import { ICONS, type IconName } from "./icons.js";
import type { Controls, UiItemView, UiView } from "./model.js";
import { rgb } from "./theme.js";

export interface Hud {
  /** The element on the page. */
  element: HTMLElement;
  readonly open: boolean;
  setOpen(open: boolean): void;
  /** How much of the top and bottom of the window the HUD covers, in pixels. For placing a scene's picture clear of it. */
  cover(): { top: number; bottom: number };
  /** Hide it all (in a headset session, where the page can't be seen anyway) or show it again. */
  setHidden(hidden: boolean): void;
  remove(): void;
}

const CSS = `
:host { position: fixed; inset: 0; z-index: 20; pointer-events: none; display: block;
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
kbd { font: inherit; font-size: .82em; min-width: 1.6em; padding: 1px 5px; text-align: center; border-radius: 5px;
  border: 1px solid rgba(var(--ink), .3); color: rgba(var(--ink), .75); }

/* ---- the bottom: what you point at, then the hotbar */
.low { position: absolute; left: 0; right: 0; bottom: max(10px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 0 12px; }
.target { max-width: min(92vw, 640px); padding: 6px 14px; border-radius: 999px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.target:empty { visibility: hidden; }
.hotbar { pointer-events: auto; display: flex; align-items: flex-start; justify-content: center; gap: 10px; padding: 12px 14px 8px; border-radius: 20px 20px 10px 10px; }
.key { position: relative; width: 62px; display: grid; justify-items: center; gap: 7px; text-align: center; }
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

/* ---- the sheet: everything else, by section */
.sheet { position: absolute; left: 50%; bottom: calc(max(10px, env(safe-area-inset-bottom)) + 122px * var(--s)); transform: translateX(-50%);
  width: min(480px, calc(100vw - 20px)); max-height: min(62vh, 560px); display: flex; flex-direction: column; pointer-events: auto;
  border-radius: 22px 22px 12px 12px; overflow: hidden; }
.sheet[hidden] { display: none; }
.sheet::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgb(var(--accent)), transparent); box-shadow: 0 0 16px rgb(var(--accent)); }
.tabs { display: flex; gap: 4px; padding: 12px 12px 0; overflow-x: auto; scrollbar-width: none; }
.tab { display: flex; align-items: center; gap: 7px; padding: 9px 13px 8px; border-radius: 14px 14px 0 0; color: rgba(var(--ink), .72); border-bottom: 2px solid transparent; white-space: nowrap; }
.tab:hover { color: rgb(var(--ink)); }
.tab[aria-selected="true"] { color: rgb(var(--accent)); background: rgba(var(--accent), .1); border-bottom-color: rgb(var(--accent)); }
.rows { display: grid; gap: 6px; padding: 12px; overflow-y: auto; border-top: 1px solid rgba(var(--accent), .22); }
.row { display: flex; align-items: center; gap: 12px; min-height: 46px; padding: 8px 12px; border-radius: 10px; text-align: left;
  border: 1px solid rgba(var(--ink), .12); background: rgba(var(--ink), .03); transition: background .12s, border-color .12s; }
.row:hover { background: rgba(var(--accent), .13); border-color: rgba(var(--accent), .7); }
.row .grow { flex: 1; min-width: 0; }
.row .state { font-size: .86em; color: rgba(var(--ink), .6); }
.row[aria-pressed="true"] { border-color: rgba(var(--accent), .8); }
.row[aria-pressed="true"] .state { color: rgb(var(--accent)); }
.row.warn { color: rgb(var(--warn)); }
.row.primary { background: rgba(var(--accent), .16); border-color: rgba(var(--accent), .75); }
.note { margin: 0; padding: 4px 12px 0 12px; color: rgba(var(--ink), .78); border-left: 2px solid rgba(var(--accent), .6); margin-left: 12px; font-size: .95em; }
.note:empty { display: none; }
.foot { display: flex; justify-content: flex-end; padding: 0 12px 12px; }
.close { min-height: 38px; padding: 0 14px; border-radius: 10px; border: 1px solid rgba(var(--ink), .22); }
.close:hover { border-color: rgb(var(--ink)); }

/* ---- one moment of motion: things arrive. Nothing loops. */
@keyframes say-in { from { opacity: 0; transform: translateX(-8px); } }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
@keyframes unfold { from { clip-path: inset(100% 0 0 0 round 22px); opacity: .4; } to { clip-path: inset(0 0 0 0 round 22px); opacity: 1; } }
:host(.moving) .key { animation: rise .32s cubic-bezier(.2, .8, .2, 1) both; animation-delay: calc(var(--i) * 45ms + 120ms); }
:host(.moving) .id, :host(.moving) .menu { animation: rise .32s cubic-bezier(.2, .8, .2, 1) both; }
:host(.moving) .sheet:not([hidden]) { animation: unfold .24s cubic-bezier(.2, .8, .2, 1) both; }
:host(:not(.moving)) * { transition: none !important; animation: none !important; }

/* ---- a phone: the same things, closer together */
@media (max-width: 640px) {
  .id { max-width: calc(100vw - 86px); padding: 6px 10px 6px 8px; }
  .menu span, .menu kbd, .key .num { display: none; }
  .menu { padding: 0 10px; }
  .hotbar { gap: 4px; padding: 10px 8px 6px; }
  .key { width: 54px; }
  .key .arch { width: 46px; height: 46px; border-radius: 23px 23px 6px 6px; }
  .key .sill { width: 50px; }
  .key .name { font-size: .76em; }
  .sheet { bottom: calc(max(10px, env(safe-area-inset-bottom)) + 108px * var(--s)); }
  .says { bottom: calc(max(10px, env(safe-area-inset-bottom)) + 116px * var(--s)); }
}
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

export function mountHud(controls: Controls, opts: { parent?: HTMLElement } = {}): Hud {
  const host = document.createElement("nswp-hud");
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;

  const title = el("b");
  const address = el("span", { class: "mono" });
  const id = el("div", { class: "id glass" }, el("span", { class: "mark", "aria-hidden": "true" }), el("div", {}, title, address));
  const menu = el("button", { class: "menu glass", type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" }, icon("menu"), el("span", {}, "Menu"), el("kbd", {}, "M"));
  const target = el("div", { class: "target glass", "aria-live": "polite" });
  const hotbar = el("nav", { class: "hotbar glass", "aria-label": "Controls" });
  const says = el("div", { class: "says", role: "status" });
  const tabs = el("div", { class: "tabs", role: "tablist" });
  const rows = el("div", { class: "rows" });
  const note = el("p", { class: "note" });
  const close = el("button", { class: "close", type: "button" }, "Close");
  const sheet = el("section", { class: "sheet glass", role: "dialog", "aria-label": "Menu", hidden: "" }, tabs, rows, note, el("div", { class: "foot" }, close));
  root.append(style, id, menu, says, sheet, el("div", { class: "low" }, target, hotbar));
  (opts.parent ?? document.body).append(host);

  let open = false;
  let section = "";
  let drawn = "";

  const press = (item: UiItemView) => controls.run(item.id);

  const draw = () => {
    const view: UiView = controls.view();
    const t = view.theme;
    host.style.setProperty("--accent", rgb(t.accent));
    host.style.setProperty("--ink", rgb(t.ink));
    host.style.setProperty("--glass", rgb(t.glass));
    host.style.setProperty("--warn", rgb(t.warn));
    host.style.setProperty("--s", String(t.scale));
    host.classList.toggle("moving", t.motion);
    title.textContent = view.title;
    address.textContent = view.address;
    if (target.textContent !== view.target) target.textContent = view.target;

    if (!view.sections.some((s) => s.id === section)) section = view.sections[0]?.id ?? "";
    // Rebuilding the buttons would drop the keyboard's place among them, so only do it when something they show has changed.
    const now = JSON.stringify([view.hotbar, view.sections, section, open]);
    if (now === drawn) return;
    drawn = now;

    hotbar.replaceChildren(
      ...view.hotbar.map((item, i) => {
        const b = el(
          "button",
          { class: `key ${item.tone}`, type: "button", "aria-label": item.label, ...(item.on === null ? {} : { "aria-pressed": String(item.on) }) },
          el("span", { class: "arch" }, icon(item.icon ?? "door")),
          el("span", { class: "sill" }),
          el("span", { class: "name" }, item.label),
          el("kbd", { class: "num mono" }, item.key),
        );
        b.style.setProperty("--i", String(i));
        b.addEventListener("click", () => press(item));
        return b;
      }),
    );
    hotbar.hidden = view.hotbar.length === 0;

    tabs.replaceChildren(
      ...view.sections.map((s) => {
        const b = el("button", { class: "tab", type: "button", role: "tab", "aria-selected": String(s.id === section) }, icon(s.icon), s.label);
        b.addEventListener("click", () => {
          section = s.id;
          draw();
          (tabs.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus();
        });
        return b;
      }),
    );
    const current = view.sections.find((s) => s.id === section);
    rows.replaceChildren(
      ...(current?.items ?? []).map((item) => {
        const b = el(
          "button",
          { class: `row ${item.tone}`, type: "button", ...(item.on === null ? {} : { "aria-pressed": String(item.on) }) },
          icon(item.icon),
          el("span", { class: "grow" }, item.label),
          item.on !== null && el("span", { class: "state" }, item.on ? "On" : "Off"),
          item.key ? el("kbd", { class: "mono" }, item.key) : null,
        );
        b.addEventListener("click", () => press(item));
        return b;
      }),
    );
    rows.hidden = !current?.items.length;
    note.textContent = current?.note ?? "";
    sheet.hidden = !open;
    menu.setAttribute("aria-expanded", String(open));
  };

  const setOpen = (next: boolean) => {
    if (open === next) return;
    open = next;
    draw();
    if (open) (tabs.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus();
    else menu.focus();
  };
  menu.addEventListener("click", () => setOpen(!open));
  close.addEventListener("click", () => setOpen(false));

  const onKey = (e: KeyboardEvent) => {
    if (host.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const at = e.composedPath()[0] as HTMLElement | undefined;
    if (at && (at.tagName === "INPUT" || at.tagName === "TEXTAREA" || at.isContentEditable)) return;
    if (e.key === "Escape" && open) return setOpen(false);
    if (e.key === "m" || e.key === "M") return setOpen(!open);
    const item = controls.view().hotbar.find((i) => i.key === e.key);
    if (item) press(item);
  };
  addEventListener("keydown", onKey);

  const stopSay = controls.onSay((text) => {
    const line = el("div", { class: "say glass" }, text);
    says.append(line);
    while (says.childElementCount > 3) says.firstElementChild?.remove();
    setTimeout(() => line.classList.add("going"), 3600);
    setTimeout(() => line.remove(), 4200);
  });
  const stop = controls.subscribe(draw);
  // Words that are worked out afresh each time (a room's status, a toggle) are read on a slow tick.
  const tick = setInterval(draw, 400);
  draw();

  return {
    element: host,
    get open() {
      return open;
    },
    setOpen,
    cover() {
      if (host.hidden) return { top: 0, bottom: 0 };
      const low = hotbar.getBoundingClientRect();
      const high = id.getBoundingClientRect();
      return { top: Math.round(high.bottom), bottom: Math.round(innerHeight - Math.min(low.top, target.getBoundingClientRect().top)) };
    },
    setHidden(hidden) {
      host.hidden = hidden;
      if (hidden) setOpen(false);
    },
    remove() {
      clearInterval(tick);
      stop();
      stopSay();
      removeEventListener("keydown", onKey);
      host.remove();
    },
  };
}
