/**
 * One menu, never two: who draws the visitor's menu for a world, kept in one place
 * (docs/plans/the-clients-menu.md, section 6; protocol/02-doors.md, "The client has the menu").
 *
 * A world asks the page above whether it has the menu (`portAbove`). This keeps to the answer, however the answer
 * and the world's own loading fall:
 *
 * - **Nobody above has it:** the world's own menu is mounted.
 * - **The client has it:** the world draws none. Until a client runs the room's chat, messages and posts itself,
 *   the world keeps that one pane, mounted only once there is something to write to.
 * - **The answer changes** (a client that answered late, or stopped): what was mounted is put away and the other
 *   takes its place.
 * - **The world's own menu arrives late.** Where the menu is a file fetched when it is needed, a client can answer
 *   while it is on its way. So who has the menu is asked again each time a mount finishes, and a menu that arrives
 *   for a world whose client now has one is put away before it is seen. (Asked only before the fetch, a world drew
 *   its menu over the client's: found by a trial on a busy machine, 2026-11-23.)
 *
 * This file is not the menu and doesn't load it: whoever uses it says how a menu is mounted (`mount`), which for a
 * world that fetches its menu when needed is where the fetching is.
 */
import type { MenuAbove } from "./menu-above.js";
import type { Hud } from "./ui/hud.js";
import type { Controls } from "./ui/model.js";

export interface KeptMenu {
  /** Whether the menu is up, whoever draws it. */
  readonly open: boolean;
  /** Bring the menu up or put it away, whoever draws it. `at` names a tab, where the world's own menu is the one. */
  setOpen(open: boolean, at?: string): void;
  /** Hide whatever this page draws (in a headset session, where the page can't be seen), or show it again. */
  setHidden(hidden: boolean): void;
  /**
   * How much of this page's view the menu covers at each edge, for what is always there (the bar, the marks),
   * whoever draws it: the world's own menu, or the client's as it last said (`covers`). In pixels of this page.
   * For keeping a view clear of it. Left out of it is what comes and goes (the sheet: `bounds`), so that a view
   * moved clear of the menu stays still. Nothing while hidden, as in a headset session.
   */
  cover(): { top: number; bottom: number; left: number; right: number };
  /** The box of each part of the menu that shows over this page, the sheet among them while it is up, whoever draws it. */
  bounds(): { x: number; y: number; width: number; height: number }[];
  /** The world's own menu, where that is what is drawn. Null where the client has the menu, or none is up yet. */
  readonly own: Hud | null;
  /** Whether this page is drawing the chat's pane by itself, its client having the rest of the menu. */
  readonly chatPane: boolean;
  /** Done once it is known who has the menu and, where it is the world, the world's own is up. */
  readonly ready: Promise<void>;
  /** Put away whatever this page draws, and stop keeping. */
  remove(): void;
}

/**
 * Keep one menu for these controls. `mount` makes the world's own menu, or with `"chat"` the chat's pane alone, and
 * may take its time (fetching the menu's file).
 */
export function keepMenu(controls: Controls, above: MenuAbove, mount: (only?: "chat") => Hud | Promise<Hud>): KeptMenu {
  let own: Hud | null = null;
  let chatPane: Hud | null = null;
  let ownComing: Promise<void> | null = null;
  let chatComing = false;
  let hidden = false;
  let gone = false;

  const chatIfNeeded = () => {
    if (gone || !above.has || own || chatPane || chatComing) return;
    const now = controls.view();
    // Fetched and mounted only once there is something to write to: a room joined, or a visitor signed in.
    if (!now.chat.ready && !now.feed.ready && !now.letters.ready) return;
    chatComing = true;
    void Promise.resolve(mount("chat")).then(
      (pane) => {
        chatComing = false;
        if (gone || !above.has || own || chatPane) return pane.remove();
        chatPane = pane;
        if (hidden) pane.setHidden(true);
      },
      () => (chatComing = false),
    );
  };

  const settle = (): Promise<void> => {
    if (gone) return Promise.resolve();
    if (above.has) {
      own?.remove();
      own = null;
      chatIfNeeded();
      return Promise.resolve();
    }
    chatPane?.remove();
    chatPane = null;
    if (own) return Promise.resolve();
    ownComing ??= Promise.resolve(mount()).then(
      (menu) => {
        ownComing = null;
        // Asked again now that it is here: a client may have answered while it was on its way.
        if (gone || above.has || own) menu.remove();
        else {
          own = menu;
          if (hidden) menu.setHidden(true);
        }
        return settle();
      },
      () => void (ownComing = null),
    );
    return ownComing;
  };

  const stopView = controls.subscribe(chatIfNeeded);
  // One thing at a time over the world: as the chat comes up here, the client's menu is asked to go, which also
  // gives this frame the keys to write with.
  const stopSignals = controls.onSignal((name) => {
    if ((name === "chatOpen" || name === "feedOpen") && above.has && above.menu.open) above.menu.setOpen(false);
  });
  const stopChange = above.onChange(() => void settle());
  const ready = above.ready.then(() => settle());

  return {
    get open() {
      return own ? own.open : above.menu.open;
    },
    setOpen(open, at) {
      if (own) own.setOpen(open, at);
      else above.menu.setOpen(open, at);
    },
    setHidden(next) {
      hidden = next;
      own?.setHidden(next);
      chatPane?.setHidden(next);
    },
    cover() {
      if (hidden) return { top: 0, bottom: 0, left: 0, right: 0 };
      return own ? own.cover() : above.menu.cover();
    },
    bounds() {
      if (hidden) return [];
      // The chat's pane is this page's own, over a menu the client draws: its box is with the client's.
      return own ? own.bounds() : [...above.menu.bounds(), ...(chatPane ? chatPane.bounds() : [])];
    },
    get own() {
      return own;
    },
    get chatPane() {
      return !!chatPane;
    },
    ready,
    remove() {
      gone = true;
      stopView();
      stopSignals();
      stopChange();
      own?.remove();
      chatPane?.remove();
      own = null;
      chatPane = null;
    },
  };
}
