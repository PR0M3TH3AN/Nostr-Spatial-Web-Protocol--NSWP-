/**
 * "Bag", in the menu every world has: the items a visitor has, taking one in hand, and putting it away
 * (protocol/17-items.md).
 *
 * The same tab in a world and at the visitor's home, on a phone, at a desk and on a headset's wrist. In a place
 * that draws nothing carried, the bag can still be looked through, and says that nothing in it works there.
 *
 * It also has the visitor's one switch for all items: off, nothing of anyone's is fetched, drawn or run.
 *
 * How it is laid out, and why. What they have is shown as the things themselves, side by side, each drawn from
 * its own model (item-preview.ts). Choosing one puts it at the head of the tab, large and turning, with the one
 * thing most people came to do, taking it in hand, as the first button under it: before this, that button was
 * the third row of a list, under two rows of housekeeping, and on a phone it was out of sight. Where a thing
 * can't be held, the tab says so in that button's place and says why. Housekeeping is last.
 */
import { cleanSettings, decodeNaddr, ITEM_KIND, itemCoordinate, TINT_PALETTE, type HeldThrough } from "@nswp/core";
import type { Bag } from "./bag.js";
import { createItemPreviews, type ItemPreviews } from "./item-preview.js";
import { onItemsChange, setShowsItems, showsItems, type ItemStore } from "./item-store.js";
import type { Items } from "./items.js";
import type { Keyboard } from "./keyboard.js";
import { allowScript, scriptAllowed } from "./play.js";
import { arrivedSettings, reportSettings } from "./settings.js";
import type { Controls, UiAction } from "./ui/model.js";

export interface BaggingOptions {
  bag: Bag;
  /**
   * What looks items up. Their descriptions are all that is needed; where it can also give a model (items.ts),
   * each thing is shown as itself, drawn from that model. Without, each is shown by its first letter.
   */
  items: Pick<ItemStore, "known" | "describe"> & Partial<Pick<Items, "model">>;
  /** What draws each thing's picture. Left out, one is made from `items.model`, where there is one. `null` for none. */
  previews?: ItemPreviews | null;
  /** Whether things may move for this visitor: off, the chosen thing is shown still. Left out, as the menu's own setting says. */
  motion?: () => boolean;
  /** What this place is called, for saying where a thing can't be held. */
  place?: () => string;
  /** The visitor's key here, or null: a guest carries nothing, and has no tab. */
  me(): string | null;
  /** What this place does with items: "none", "allowed" or "play". */
  rule(): string;
  /** What they hold now, by its coordinate, or "". */
  holding(): string;
  /** Take one in hand, in the colours they chose for it, or put it away with "". */
  hold(item: string, tints?: Record<string, string>): Promise<{ ok: boolean; said: string }>;
  /** They chose a colour for one of their things: where it is the one in their hand, it is recoloured now. */
  tinted?: (item: string, tints: Record<string, string>) => void;
  /** Where this place hasn't yet been let change the bag: have the visitor asked, from a press. */
  ask?: (then: () => void) => string;
  /** Whether a change can be signed now. */
  allowed?: () => boolean;
  keyboard?: () => Keyboard | null;
  presenting?: () => boolean;
  /**
   * A few items offered here, by coordinate, for someone to put in their bag with one press: a client's starter
   * items. Shown only where the bag can be changed, and only the ones not already in it. Twelve at most.
   */
  offered?: () => string[];
  /** Read what the visitor copied. For tests; left out, the browser's own. */
  copied?: () => Promise<string>;
}

/** Where a site keeps what its visitor last held there. */
export const HELD_KEY = "nswp:holding";
/** What they last held here, read back through the check everything said of a held thing goes through. */
function keptHolding(): HeldThrough | "" | undefined {
  try {
    const kept = globalThis.localStorage?.getItem(HELD_KEY);
    return kept ? cleanSettings({ holding: JSON.parse(kept) as unknown }).holding : undefined;
  } catch {
    return undefined;
  }
}
function keepHolding(held: HeldThrough | ""): void {
  try {
    globalThis.localStorage?.setItem(HELD_KEY, JSON.stringify(held));
  } catch {
    /* a private window: for this visit only */
  }
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
  /** An item whose own logic they were just asked about: the next press of Hold lets it run. */
  let asking = "";
  /** The thing being taken in hand just now: fetched and checked, which can take a moment. */
  let taking = "";
  const say = (text: string) => controls.say(text);
  const model = items.model;
  const previews = opts.previews === undefined ? (model ? createItemPreviews({ model: (item, tints) => model(item, tints) }) : null) : opts.previews;
  const still = (item: string) => (): CanvasImageSource | null => {
    const described = items.known(item);
    return described && previews && showsItems() ? previews.still(described, bag.tints(item)) : null;
  };
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

  /** What there is to do with the thing they chose, by id: drawn inside its card, beside its picture. */
  let cardActs: string[] = [];
  /** They put what they held away with their own hand, here. */
  let putAway = false;
  /**
   * What they arrived holding, until it has been taken in hand here or found that it can't be. A link says this,
   * and a link can be written by anyone: so it is acted on only for a thing in the visitor's own bag, as they
   * signed it, and its own logic runs unasked only if it is the very script they are said to have let run.
   */
  let cameHolding = ((): HeldThrough | null => {
    // What a door said comes first: it is what they had a moment ago. Where nothing was said (they opened this
    // place by its address, or loaded it again), it is what they last held here, kept by this site.
    const came = arrivedSettings().holding ?? keptHolding();
    return came && typeof came === "object" ? came : null;
  })();
  const carryOn = async (has: string[]): Promise<void> => {
    const came = cameHolding;
    cameHolding = null;
    if (!came || opts.holding() || opts.rule() === "none" || !showsItems() || !has.includes(came.item)) return;
    const described = await items.describe(came.item);
    if (!described || opts.holding()) return;
    if (described.script && came.script === described.script.sha256) allowScript(described.script.sha256);
    taking = came.item;
    refresh();
    let done: { ok: boolean; said: string } = { ok: false, said: "" };
    try {
      done = await opts.hold(came.item, came.tints ?? bag.tints(came.item));
    } catch {
      /* it stays in their bag */
    }
    taking = "";
    // Said only when it is in their hand: someone who arrives without it has lost nothing, and is told nothing.
    if (done.ok) say(`${items.known(came.item)?.title ?? "What you were holding"} is still in your hand.`);
    refresh();
  };
  /** What was in their hand when the tab was last drawn. */
  let drawnHolding = "";
  const refresh = () => {
    drawnHolding = opts.holding();
    // Kept by this site too, so it is in their hand when they come back to it or load it again.
    const held = heldNow();
    if (held !== undefined) keepHolding(held);
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
    // Their bag is known: what they arrived holding is taken in hand again, once.
    if (has && cameHolding) void carryOn(has);
    /** What is offered here that they don't have, where they could take it. */
    const offers = (): string[] => (has && bag.canChange() ? [...new Set((opts.offered?.() ?? []).map((i) => itemCoordinate(i)).filter((i) => i && !has.includes(i)))].slice(0, 12) : []);
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
        if (has.length === 0) return `Your bag is empty. ${bag.canChange() ? (offers().length ? "Take one of the things offered here, or put an item in by its address." : "Put an item in by its address: copy it from the place that keeps the item.") : "Things are put in it at your home."} ${here}`;
        return `${has.length === 1 ? "1 thing" : `${has.length} things`} in your bag. Anyone can see what is in it. ${here}`;
      },
      card: () => {
        const item = chosen ? items.known(chosen) : null;
        if (!item) return null;
        const tints = bag.tints(item.id);
        return {
          title: item.title,
          tag: opts.holding() === item.id ? "In your hand" : has?.includes(item.id) ? "In your bag" : "Offered here",
          proven: false,
          sub: `Made by ${item.maker.slice(0, 8)}…`,
          copy: item.id,
          text: item.summary,
          picture: "",
          color: "",
          now: [],
          // What to do with it sits in the card with it: what it does while it is in their hand (the kit's own
          // rows for that, item-controls.ts), then holding it or putting it away, its colours, and keeping it.
          acts: [...(opts.holding() === item.id ? ["item-use", "item-second"] : []), ...cardActs],
          // The thing itself, large and turning, in the colours they chose for it.
          ...(previews && showsItems() ? { draw: () => previews.turning(item, tints, opts.motion?.() ?? controls.theme?.motion ?? true) } : {}),
        };
      },
    });
    // A guest carries nothing: the tab has nothing in it, and isn't shown.
    if (!me) return;
    const housekeeping = (): void => {
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
    };
    if (has === null) {
      housekeeping();
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
    // What is in their hand is what the tab opens on: the thing they are most likely here about.
    if (chosen === null && opts.holding() && has.includes(opts.holding())) chosen = opts.holding();
    const holding = opts.holding();
    const away = (): UiAction => ({
      id: "bag-away",
      icon: "close",
      tone: chosen === holding ? "primary" : "normal",
      label: `Put ${titleOf(holding)} away`,
      short: "Away",
      act: async () => {
        // Their own hand put it away: it isn't taken out again for them in the next world.
        putAway = true;
        say((await opts.hold("")).said);
        // What the tab offers follows what is in their hand: with nothing in it, this is Hold again.
        refresh();
      },
    });
    // ---- The thing they chose: what to do with it comes first, with its picture.
    const firstOfTheirs = shown.length;
    if (chosen && has.includes(chosen)) {
      const item = chosen;
      if (taking === item)
        // Taking a thing in hand fetches it and checks it, which can take a moment. Said, so that a second press
        // isn't made on a button that seems to have done nothing.
        add({ id: "bag-taking", icon: "check", label: `Taking ${titleOf(item)} in hand…`, act: () => say("It is on its way: its files are being fetched and checked.") });
      else if (holding === item) add(away());
      else if (rule === "none") {
        // Said where the button would be, and why: a button that isn't there can't be asked about.
        add({
          id: "bag-nohold",
          icon: "close",
          label: `Can't be held here: ${opts.place?.() || "this place"} doesn't have items`,
          act: () => say("Each place says whether things can be carried in it. Most let them; this one has turned them off."),
        });
      } else if (!showsItems()) {
        add({
          id: "bag-turn-on",
          icon: "check",
          tone: "primary",
          label: `Turn items on, to hold ${titleOf(item)}`,
          act: () => {
            setShowsItems(true);
            refresh();
          },
        });
      } else {
        add({
          id: "bag-hold",
          icon: "check",
          tone: "primary",
          // An item that does things of its own runs its maker's code, shut away: the second press is their yes.
          label: asking === item ? `Let it run, and hold ${titleOf(item)}` : `Hold ${titleOf(item)}`,
          act: async () => {
            taking = item;
            putAway = false;
            refresh();
            let done: { ok: boolean; said: string };
            try {
              done = await opts.hold(item, bag.tints(item));
            } catch {
              done = { ok: false, said: "That couldn't be taken in hand just now." };
            }
            taking = "";
            asking = !done.ok && /Press Hold again/.test(done.said) ? item : "";
            say(done.said);
            refresh();
          },
        });
      }
      // Its colours, where its maker lets a holder choose any: each press steps to the next.
      for (const tint of items.known(item)?.tints ?? []) {
        const now = bag.tints(item)[tint.slot] ?? tint.color;
        const at = TINT_PALETTE.findIndex((c) => c.color === now);
        add({
          id: `bag-tint-${tint.slot}`,
          kind: "swatch",
          color: now,
          icon: "check",
          label: `${tint.label}: ${TINT_PALETTE[at]?.name ?? "its maker's own"}`,
          short: tint.label,
          act: () => {
            const next = TINT_PALETTE[(at + 1) % TINT_PALETTE.length]!;
            const chosen = { ...bag.tints(item), [tint.slot]: next.color };
            bag.setTints(item, chosen);
            opts.tinted?.(item, chosen);
            say(`${tint.label}: ${next.name}. ${bag.canChange() ? "It goes with it to every world." : "For this place. Choose it at your home to keep it everywhere."}`);
            refresh();
          },
        });
      }
      if (bag.canChange()) add({ id: "bag-remove", icon: "close", label: `Take ${titleOf(item)} out of my bag`, act: () => change(item, false) });
    } else if (chosen && offers().includes(chosen)) {
      const item = chosen;
      add({ id: "bag-take", icon: "save", tone: "primary", label: `Put ${titleOf(item)} in my bag`, act: () => change(item, true) });
    }
    cardActs = shown.slice(firstOfTheirs);
    // Something else is in their hand than the thing they are looking at: the way to put it away is still here.
    if (holding && holding !== chosen) add(away());
    // ---- Everything they have, as the things themselves, side by side.
    const listed = has.slice(0, pages * PAGE);
    // What each is called is asked for a page at a time, for the things on show.
    for (const item of listed) if (!items.known(item)) void items.describe(item).then((found) => found && soon());
    const choose = (item: string) => () => {
      chosen = chosen === item ? null : item;
      asking = "";
      refresh();
    };
    add(
      ...listed.map(
        (item): UiAction => ({
          id: `bag-${item.split(":")[1]!.slice(0, 8)}-${item.split(":")[2]}`.slice(0, 60),
          kind: "tile",
          icon: "save",
          picture: still(item),
          on: () => chosen === item,
          label: () => `${titleOf(item)}${opts.holding() === item ? ", in your hand" : ""}`,
          short: () => titleOf(item),
          act: choose(item),
        }),
      ),
    );
    // What is offered here, after what they have.
    const offered = offers();
    for (const item of offered) if (!items.known(item)) void items.describe(item).then((found) => found && soon());
    add(
      ...offered.map(
        (item): UiAction => ({
          id: `bag-offer-${item.split(":")[1]!.slice(0, 8)}-${item.split(":")[2]}`.slice(0, 60),
          kind: "tile",
          icon: "save",
          picture: still(item),
          on: () => chosen === item,
          label: () => `${titleOf(item)}, offered here`,
          short: () => titleOf(item),
          act: choose(item),
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
    // ---- Housekeeping, last: looked for again when they ask, since something put in at their home a moment ago is there then.
    housekeeping();
    add({ id: "bag-look", icon: "turn", label: "Look again", short: "Look", act: () => void bag.load(true).then(refresh) });
    if (bag.canChange()) add({ id: "bag-add", icon: "save", label: () => (opts.presenting?.() && opts.keyboard?.() ? "Put in an item by its address" : "Put in the item I copied"), short: "Add", act: () => void fromCopy() });
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
  // A thing's picture is ready: the tiles are drawn again with it.
  previews?.onChange(soon);
  // What is in their hand goes with them through the next door (settings.ts): the thing, its colours, and the mark
  // of its own logic where that is running for them. Nothing in hand says nothing, so what they arrived holding
  // goes on through a place where it couldn't be held: unless they put it away themselves, which is said.
  const heldNow = (): HeldThrough | "" | undefined => {
    const item = opts.holding();
    if (!item) return putAway ? "" : undefined;
    const script = items.known(item)?.script?.sha256;
    const tints = bag.tints(item);
    return { item, ...(Object.keys(tints).length ? { tints } : {}), ...(script && scriptAllowed(script) ? { script } : {}) };
  };
  reportSettings("holding", () => {
    const held = heldNow();
    return held === undefined ? {} : { holding: held };
  });
  refresh();
  // What is in their hand can change from elsewhere: the bar, a key, a rule of the place, another press still on
  // its way. The tab follows it, so it never offers to put away what isn't held, or to hold what is.
  const watch = setInterval(() => {
    if (!taking && opts.holding() !== drawnHolding) refresh();
  }, 400);
  (watch as { unref?: () => void }).unref?.();
  return { refresh };
}
