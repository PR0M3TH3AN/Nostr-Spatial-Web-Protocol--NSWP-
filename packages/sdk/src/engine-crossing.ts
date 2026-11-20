/**
 * The crossing's room, for a world whose engine isn't JavaScript's.
 *
 * A visitor who leaves a Three.js world leaves from a small room whose walls
 * rise round them, and arrives in the next world standing in the same room,
 * whose doors open once that world is ready (chamber.ts). That is what makes
 * two websites feel like two ends of one trip. An engine that exports to a
 * web page has two things in the way of it. The engine takes a long while to
 * arrive (Godot's is forty megabytes), and until it has there is nothing to
 * draw a room with. And what the export shows meanwhile is the engine's own
 * loading screen, with the engine's own name on it.
 *
 * So the room is drawn here, flat, by the page itself: the view from inside
 * it, facing its doors, as a visitor arriving in a Three.js world sees it. It
 * is up from the page's first moment, before the engine has loaded a byte.
 * The line of light over the doors fills as the engine arrives, and the doors
 * open when the world says it is ready. Leaving, it comes up again and the
 * doors shut before the page is left. It needs no engine and no renderer, so
 * it is the same for Godot, Unity and anything else.
 *
 * **It is scenery, and proves nothing,** as the room it copies is. The check
 * on where a door leads is the visitor's own Airlock. It asks for nothing,
 * says "verified" about nothing, and has nothing in it to press.
 */
import { DEFAULT_THEME } from "./ui/theme.js";

export type CrossingState = "none" | "arriving" | "opening" | "leaving" | "shut" | "failed";

const CSS = `
:host { position: fixed; inset: 0; z-index: 2147482990; display: block; overflow: hidden; pointer-events: auto;
  --accent: 76, 201, 240; --ink: 238, 245, 251; --wall: 12, 17, 24; --dark: 6, 9, 14;
  /* The doorway: as wide as it can be and still stand whole in a tall or a wide window. */
  --door: min(27vw, 46vh, 420px); --jamb: calc(var(--door) * .075);
  font: 500 16px / 1.3 ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; color: rgb(var(--ink));
  /* Where the leaves start, from the top: under the sign and the line of light. */
  --head: calc(clamp(22px, 6.2vh, 56px) + var(--door) * .57);
  opacity: 1; transition: opacity .45s ease; -webkit-font-smoothing: antialiased; }
:host(.gone) { opacity: 0; pointer-events: none; }
:host(.coming) { opacity: 0; }
* { box-sizing: border-box; }
@media (max-aspect-ratio: 3/4) { :host { --door: min(58vw, 40vh); } }

/* The room, seen from its middle: a wall each side falling away, a lid overhead, and the doors ahead. */
/* Everything is solid but the doorway itself, which only the leaves fill: what is behind them is the world. */
.room { position: absolute; inset: 0; background:
  linear-gradient(180deg, rgba(var(--accent), .05), transparent 18%, transparent 40%, rgba(var(--accent), .13) 50%, transparent 60%, rgba(var(--dark), .5)),
  rgb(var(--wall));
  clip-path: polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0,
    calc(50% - var(--door) * .5) var(--head), calc(50% - var(--door) * .5) 100%, calc(50% + var(--door) * .5) 100%, calc(50% + var(--door) * .5) var(--head), calc(50% - var(--door) * .5) var(--head)); }
.lid { position: absolute; left: 0; right: 0; top: 0; height: 9vh;
  background: linear-gradient(180deg, rgba(var(--accent), .12), rgba(var(--accent), .02));
  clip-path: polygon(22% 0, 78% 0, calc(50% + var(--door) * .5 + var(--jamb) * 3) 100%, calc(50% - var(--door) * .5 - var(--jamb) * 3) 100%); }
.wall { position: absolute; top: 0; bottom: 0; width: calc(50% - var(--door) * .5 - var(--jamb)); overflow: hidden;
  background: linear-gradient(90deg, rgba(var(--dark), .6), rgba(var(--wall), 1) 55%, rgba(var(--dark), .35)), rgb(var(--wall)); }
.wall.left { left: 0; clip-path: polygon(0 0, 100% 7vh, 100% 100%, 0 100%); }
.wall.right { right: 0; transform: scaleX(-1); clip-path: polygon(0 0, 100% 7vh, 100% 100%, 0 100%); }
/* Two lines of light that run a panel's height: a broad one near, a narrow one far. */
.wall i { position: absolute; top: 9vh; bottom: -2vh; border-radius: 2px; background: rgb(var(--accent)); box-shadow: 0 0 18px rgba(var(--accent), .55); }
.wall i:nth-child(1) { left: 7%; width: max(10px, 4.2%); opacity: .92; transform: skewY(8deg); transform-origin: left top; }
.wall i:nth-child(2) { left: 84%; width: max(5px, 2.3%); top: 11vh; opacity: .8; }
.wall b { position: absolute; left: 22%; right: 0; top: 7vh; height: 1px; background: rgba(var(--accent), .35); transform: skewY(3deg); transform-origin: left top; }

/* The doorway: two jambs, a head with the sign on it, a line of light, and two leaves. */
.way { position: absolute; left: 50%; top: 0; bottom: 0; width: calc(var(--door) + var(--jamb) * 2); translate: -50% 0;
  border-left: 1px solid rgba(var(--accent), .28); border-right: 1px solid rgba(var(--accent), .28); }
/* The frame round the doorway: all of it but the opening. */
.way::before { content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(var(--ink), .06), rgba(var(--ink), .02) 8%, transparent 14%, transparent 86%, rgba(var(--ink), .02) 92%, rgba(var(--ink), .06)), rgb(var(--wall));
  clip-path: polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0,
    var(--jamb) var(--head), var(--jamb) 100%, calc(100% - var(--jamb)) 100%, calc(100% - var(--jamb)) var(--head), var(--jamb) var(--head)); }
.sign { position: absolute; left: var(--jamb); right: var(--jamb); top: clamp(22px, 6.2vh, 56px); height: calc(var(--door) * .37); display: grid; align-content: center; justify-items: center; gap: .32em;
  padding: 0 4%; text-align: center; background: rgba(var(--dark), .92); font-size: calc(var(--door) * .052); }
.sign b { font-size: 1.62em; font-weight: 750; line-height: 1.1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sign span { opacity: .82; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sign em { font-style: normal; opacity: .9; }
:host(.failed) .sign em { color: rgb(255, 150, 130); opacity: 1; white-space: normal; }
/* The line over the doors. It fills as the world arrives: all the telling of progress there is. */
.line { position: absolute; left: calc(var(--jamb) * .7); right: calc(var(--jamb) * .7); top: calc(clamp(22px, 6.2vh, 56px) + var(--door) * .37 + var(--door) * .1); height: max(4px, calc(var(--door) * .02)); border-radius: 2px;
  background: rgba(var(--accent), .22); overflow: hidden; }
.line i { display: block; height: 100%; width: var(--got, 100%); background: rgb(var(--accent)); box-shadow: 0 0 14px rgba(var(--accent), .8); transition: width .35s ease; }
:host(.waiting) .line i { width: 34%; animation: sweep 1.5s ease-in-out infinite alternate; }
@keyframes sweep { from { translate: -10% 0; } to { translate: 205% 0; } }
.leaves { position: absolute; left: var(--jamb); right: var(--jamb); top: var(--head); bottom: 0; overflow: hidden; }
.leaf { position: absolute; top: 0; bottom: 0; width: 50%; background: linear-gradient(180deg, rgba(var(--wall), 1), rgba(var(--dark), 1)); transition: translate .9s cubic-bezier(.6, 0, .2, 1); }
.leaf.l { left: 0; border-right: max(2px, calc(var(--door) * .012)) solid rgb(var(--accent)); box-shadow: 4px 0 14px rgba(var(--accent), .35); }
.leaf.r { right: 0; border-left: max(2px, calc(var(--door) * .012)) solid rgb(var(--accent)); box-shadow: -4px 0 14px rgba(var(--accent), .35); }
.leaf::after { content: ""; position: absolute; inset: 9% 13% -4% 13%; border: 1px solid rgba(var(--accent), .42); }
:host(.open) .leaf.l { translate: -101% 0; }
:host(.open) .leaf.r { translate: 101% 0; }
/* Open, the world is seen through the doorway, and then the room goes from round it (the host fades). */
/* For someone who has asked for less motion: nothing slides. It is there, and then it isn't. */
:host(.still) .leaf { transition: none; }
:host(.still) .line i { animation: none; transition: none; }
`;

export interface EngineCrossing {
  readonly state: CrossingState;
  /** How much of the world has arrived, 0 to 1. Less than 0, or not a number, for "some, nobody knows how much". */
  loading(fraction: number): void;
  /** The world is ready: the doors open, and the room goes. */
  ready(): void;
  /** The world couldn't start. The doors stay shut and the sign says why, in the page's own words. */
  failed(words: string): void;
  /** Bring the room up round the visitor and shut the doors, naming where the door says it leads. Resolves when it is shut. */
  leave(to: { title: string; address: string }): Promise<void>;
  /** The world's own name and colour, once it says them: the sign and the light are redrawn with them. */
  dress(look: { title?: string; accent?: string }): void;
  /** Be told when its state changes. */
  onChange(fn: (state: CrossingState) => void): void;
}

const rgbOf = (hex: string): string | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

/**
 * The room, standing from this moment with its doors shut: call it as the page comes up. `title` is what the sign
 * says until the world names itself; `still` leaves out everything that slides.
 */
export function createEngineCrossing(o: { title: string; address: string; accent?: string; still?: boolean; arriving?: boolean }): EngineCrossing {
  const host = document.createElement("nswp-crossing");
  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  const root = host.attachShadow({ mode: "open" });
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    node.append(...children);
    return node;
  };
  const style = document.createElement("style");
  style.textContent = CSS;
  const name = el("b", "");
  const address = el("span", "");
  const status = el("em", "");
  const got = el("i", "");
  const wall = (side: string) => el("div", `wall ${side}`, el("i", ""), el("i", ""), el("b", ""));
  root.append(
    style,
    el("div", "room"),
    el("div", "lid"),
    wall("left"),
    wall("right"),
    el("div", "way", el("div", "sign", name, address, status), el("div", "line", got), el("div", "leaves", el("div", "leaf l"), el("div", "leaf r"))),
  );
  const watchers = new Set<(state: CrossingState) => void>();
  let state: CrossingState = "arriving";
  let title = o.title;
  const set = (next: CrossingState) => {
    if (next === state) return;
    state = next;
    host.dataset.state = next;
    for (const fn of watchers) fn(next);
  };
  const colour = (hex: string | undefined) => {
    const rgb = hex ? rgbOf(hex) : null;
    if (rgb) host.style.setProperty("--accent", rgb);
  };
  const say = (first: string, second: string, third: string) => {
    name.textContent = first;
    address.textContent = second;
    status.textContent = third;
  };
  colour(o.accent ?? DEFAULT_THEME.accent);
  host.classList.toggle("still", o.still === true);
  host.classList.add("waiting");
  host.dataset.state = state;
  say(title, o.address, "The doors open when it's ready");
  // There from the first moment: before the page has a body, if need be.
  (document.body ?? document.documentElement).append(host);
  if (!document.body) addEventListener("DOMContentLoaded", () => document.body?.append(host), { once: true });

  let gone: ReturnType<typeof setTimeout> | undefined;
  return {
    get state() {
      return state;
    },
    loading(fraction) {
      if (state !== "arriving") return;
      const known = Number.isFinite(fraction) && fraction >= 0;
      host.classList.toggle("waiting", !known);
      if (known) got.style.setProperty("--got", `${Math.round(Math.min(1, fraction) * 100)}%`);
    },
    ready() {
      if (state !== "arriving") return;
      host.classList.remove("waiting");
      got.style.setProperty("--got", "100%");
      host.classList.add("open");
      set("opening");
      // What is behind the doors is the world's now: nothing here is in the way of a press.
      host.style.pointerEvents = "none";
      clearTimeout(gone);
      // The doors draw back, the room fades from round the doorway, and then it is gone.
      gone = setTimeout(
        () => {
          host.classList.add("gone");
          gone = setTimeout(
            () => {
              host.hidden = true;
              set("none");
            },
            o.still ? 0 : 480,
          );
        },
        o.still ? 60 : 720,
      );
    },
    failed(words) {
      if (state !== "arriving") return;
      host.classList.remove("waiting");
      host.classList.add("failed");
      say(title, o.address, words.slice(0, 240));
      set("failed");
    },
    leave(to) {
      clearTimeout(gone);
      say(`To ${to.title}`, to.address, "Your Airlock checks the address next");
      got.style.setProperty("--got", "100%");
      host.classList.remove("waiting", "failed", "gone");
      host.hidden = false;
      host.style.pointerEvents = "auto";
      // It comes up from nothing, doors open, and then they shut: the reverse of arriving.
      host.classList.add("coming", "open");
      set("leaving");
      return new Promise((done) => {
        // Two frames: one for the room to be laid out open and unseen, one for it to begin coming up and shutting.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          host.classList.remove("coming", "open");
          setTimeout(
            () => {
              set("shut");
              done();
            },
            o.still ? 80 : 950,
          );
        }));
      });
    },
    dress(look) {
      colour(look.accent);
      if (look.title && state === "arriving") {
        title = look.title;
        name.textContent = title;
      }
    },
    onChange(fn) {
      watchers.add(fn);
    },
  };
}
