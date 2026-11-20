/**
 * "Bag", in the menu every world has: the items a visitor has, taking one in hand, and putting it away
 * (protocol/17-items.md).
 *
 * The same tab in a world and at the visitor's home, on a phone, at a desk and on a headset's wrist. In a place
 * that draws nothing carried, the bag can still be looked through, and says that nothing in it works there.
 *
 * It also has the visitor's one switch for all items: off, nothing of anyone's is fetched, drawn or run.
 */
import { decodeNaddr, ITEM_KIND, itemCoordinate } from "@nswp/core";
import type { Bag } from "./bag.js";
import { onItemsChange, setShowsItems, showsItems, type Items } from "./items.js";
import type { Keyboard } from "./keyboard.js";
import type { Controls, UiAction } from "./ui/model.js";

export interface BaggingOptions {
  bag: Bag;
  items: Items;
  /** The visitor's key here, or null: a guest carries nothing, and has no tab. */
  me(): string | null;
  /** What this place does with items: "none", "allowed" or "play". */
  rule(): string;
  /** What they hold now, by its coordinate, or "". */
  holding(): string;
  /** Take one in hand, or put it away with "". */
  hold(item: string): Promise<{ ok: boolean; said: string }>;
  /** Where this place hasn't yet been let change the bag: have the visitor asked, from a press. */
  ask?: (then: () => void) => string;
  /** Whether a change can be signed now. */
  allowed?: () => boolean;
  keyboard?: () => Keyboard | null;
  presenting?: () => boolean;
  /** Read what the visitor copied. For tests; left out, the browser's own. */
  copied?: () => Promise<string>;
}

export interface Bagging {
  refresh(): void;
}

const PAGE = 24;

/** An item in what someone typed or pasted: its coordinate, or its `naddr`. "" for anything else. */
export function itemIn(text: unknown): string {
  if (typeof text !== "string") return "";
  const plain = itemCoordinate(/37303:[0-9a-f]{64}:[a-z0-9][a-z0-9-]{0,63}/.exec(text)?.[0]);
  if (plain) return plain;
  const address = /naddr1[02-9ac-hj-np-z]{20,400}/.exec(text)?.[0];
  if (!address) return "";
  try {
    const to = decodeNaddr(address);
    return to.kind === ITEM_KIND ? itemCoordinate(`${ITEM_KIND}:${to.pubkey}:${to.identifier}`) : "";
  } catch {
    return "";
  }
}

export function addBagControls(controls: Controls, opts: BaggingOptions): Bagging {
  const { bag, items } = opts;
  let shown: string[] = [];
  let chosen: string | null = null;
  let pages = 1;
  let wasMe: string | null = null;
  let looked = false;
  const say = (text: string) => controls.say(text);
  const titleOf = (item: string) => items.known(item)?.title ?? item.split(":")[2] ?? "an item";

  const change = (item: string, adding: boolean) => {
    const now = async () => {
      const done = await (adding ? bag.add(item, titleOf(item)) : bag.remove(item, titleOf(item)));
      say(done.said);
      refresh();
    };
    if (!bag.canChange()) return say("Your bag is changed at your home, not from here.");
    if (opts.allowed && !opts.allowed() && opts.ask) return say(opts.ask(() => void now()));
    void now();
  };

  /** Put in whatever item they copied, or typed on the headset's keyboard. */
  const fromCopy = async () => {
    let text = "";
    const keyboard = opts.presenting?.() ? (opts.keyboard?.() ?? null) : null;
    if (keyboard) text = (await keyboard.ask({ title: "The item's address: naddr1… Paste it, or type it.", maxLength: 420 }).catch(() => null)) ?? "";
    else {
      try {
        text = await (opts.copied ? opts.copied() : navigator.clipboard.readText());
      } catch {
        return say("What you copied couldn't be read here. Copy an item's address, allow this site to read what you copy, and press again.");
      }
    }
    const item = itemIn(text);
    if (!item) return say("That isn't an item's address. Copy one from the place that keeps the item, and press again.");
    const described = await items.describe(item);
    if (!described) return say("No description of that item could be found, so it wasn't put in your bag.");
    chosen = item;
    change(item, true);
  };

  const refresh = () => {
    for (const id of shown) controls.remove(id);
    shown = [];
    const me = opts.me();
    if (me !== wasMe) {
      wasMe = me;
      chosen = null;
      pages = 1;
      looked = false;
    }
    const has = me ? bag.items() : null;
    const rule = opts.rule();
    const add = (...actions: UiAction[]) => {
      for (const a of actions) shown.push(a.id);
      controls.add(...actions.map((a) => ({ section: "bag", ...a })));
    };
    controls.addSection({
      id: "bag",
      label: "Bag",
      icon: "save",
      note: () => {
        const here = rule === "play" ? "Items are part of play here: what people hold can reach you." : rule === "allowed" ? "Items work here." : "Nothing carried is drawn or works in this place.";
        if (!me) return "Sign in to keep a bag.";
        if (has === null) return looked ? "Your bag couldn't be looked for just now." : "Looking for your bag.";
        if (has.length === 0) return `Your bag is empty. ${bag.canChange() ? "Put an item in by its address: copy it from the place that keeps the item." : "Things are put in it at your home."} ${here}`;
        return `${has.length === 1 ? "1 thing" : `${has.length} things`} in your bag. Anyone can see what is in it. ${here}`;
      },
      card: () => {
        const item = chosen ? items.known(chosen) : null;
        if (!item) return null;
        return { title: item.title, tag: opts.holding() === item.id ? "In your hand" : "In your bag", proven: false, sub: `Made by ${item.maker.slice(0, 8)}…`, copy: item.id, text: item.summary, picture: "", color: "", now: [] };
      },
    });
    // A guest carries nothing: the tab has nothing in it, and isn't shown.
    if (!me) return;
    add({
      id: "bag-items",
      icon: "check",
      on: () => showsItems(),
      label: () => (showsItems() ? "Items: on" : "Items: off. Nothing of anyone's is fetched, drawn or run"),
      short: "Items",
      act: () => {
        setShowsItems(!showsItems());
        if (!showsItems() && opts.holding()) void opts.hold("");
        say(showsItems() ? "Items are drawn, here and in the next world that allows them." : "No item is fetched, drawn or run for you, here or in the next world.");
        refresh();
      },
    });
    if (has === null) {
      if (!looked) {
        looked = true;
        void bag.load().then(refresh);
      } else
        add({
          id: "bag-again",
          icon: "turn",
          label: "Look again",
          act: () => {
            looked = false;
            refresh();
          },
        });
      return;
    }
    // Looked for again when they ask: something put in at their home a moment ago is there then.
    add({ id: "bag-look", icon: "turn", label: "Look again", short: "Look", act: () => void bag.load(true).then(refresh) });
    if (bag.canChange()) add({ id: "bag-add", icon: "save", label: () => (opts.presenting?.() && opts.keyboard?.() ? "Put in an item by its address" : "Put in the item I copied"), short: "Add", act: () => void fromCopy() });
    if (opts.holding()) add({ id: "bag-away", icon: "close", label: `Put ${titleOf(opts.holding())} away`, short: "Away", act: async () => say((await opts.hold("")).said) });
    if (chosen && has.includes(chosen)) {
      const item = chosen;
      // Only where something held would be drawn: a place that has items, for someone who has them switched on.
      if (opts.holding() !== item && rule !== "none" && showsItems()) {
        add({
          id: "bag-hold",
          icon: "check",
          tone: "primary",
          label: `Hold ${titleOf(item)}`,
          act: async () => {
            say((await opts.hold(item)).said);
            refresh();
          },
        });
      }
      if (bag.canChange()) add({ id: "bag-remove", icon: "close", label: `Take ${titleOf(item)} out of my bag`, act: () => change(item, false) });
    }
    const listed = has.slice(0, pages * PAGE);
    // What each is called is asked for a page at a time, for the things on show.
    for (const item of listed) if (!items.known(item)) void items.describe(item).then((found) => found && soon());
    add(
      ...listed.map(
        (item): UiAction => ({
          id: `bag-${item.split(":")[1]!.slice(0, 8)}-${item.split(":")[2]}`.slice(0, 60),
          icon: "save",
          on: () => chosen === item,
          label: () => `${titleOf(item)}${opts.holding() === item ? ", in your hand" : ""}`,
          act: () => {
            chosen = chosen === item ? null : item;
            refresh();
          },
        }),
      ),
    );
    if (has.length > listed.length) {
      add({
        id: "bag-more",
        icon: "list",
        label: `Show more (${listed.length} of ${has.length})`,
        act: () => {
          pages++;
          refresh();
        },
      });
    }
  };

  let drawing = false;
  const soon = () => {
    if (drawing) return;
    drawing = true;
    queueMicrotask(() => {
      drawing = false;
      refresh();
    });
  };
  bag.onChange(soon);
  onItemsChange(soon);
  refresh();
  return { refresh };
}
