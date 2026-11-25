/**
 * "Following", in the menu every world has: who the visitor follows, by name, with the way to stop following any
 * of them and to follow someone by their key (protocol/14-people-and-messages.md).
 *
 * It is the same tab in a world and at the visitor's home, on a phone, at a desk and on a headset's wrist. It
 * shows the visitor's own Nostr follow list, the one every other Nostr app reads.
 *
 * Nothing is asked of a relay about the visitor until they have let this place see to who they follow. Until
 * then the tab has one control, which asks them.
 */
import { decodeNpub, encodeNpub, shortNpub } from "@nswp/core";
import { copiedRefused } from "./client-frame.js";
import type { Keyboard } from "./keyboard.js";
import type { People } from "./people.js";
import type { PersonLines } from "./person-lines.js";
import { showsPictures } from "./picture.js";
import { createProfiles, type Profiles } from "./profiles.js";
import type { Controls, UiAction } from "./ui/model.js";

/** What follows and unfollows someone for the visitor (three.ts gives a world's; a visitor's own client gives its own). */
export interface FollowingHand {
  people: People;
  /** The visitor's key here, or null: nobody is followed for a guest. */
  pubkey(): string | null;
  /** Whether the visitor has let this place change who they follow. */
  allowed(): boolean;
  /** From a press: have the visitor asked. Returns what to say meanwhile; `then` is run once they have allowed it. */
  ask(then: () => void): string;
}

export interface FollowingOptions {
  follows: FollowingHand;
  /** The usual relays, where people's profiles are looked for. */
  relays?: string[];
  profiles?: Profiles;
  /** A keyboard to type a key on inside a headset. Without one, a key is taken from what was copied. */
  keyboard?: () => Keyboard | null;
  presenting?: () => boolean;
  /** More to offer about someone chosen in the list: writing to them, say. */
  more?: (who: { pubkey: string; name: string }) => UiAction[];
  /** Read what the visitor copied. For tests; left out, the browser's own. */
  copied?: () => Promise<string>;
  /** A few lines about someone, for their card: what they have done here, say (person-lines.ts). */
  about?: PersonLines | null;
}

export interface Following {
  /** Draw it again: who is signed in, or what they allowed, changed. */
  refresh(): void;
  /** Put someone at the head of the tab, as choosing them in the list does. */
  choose(pubkey: string): void;
  /** Follow or unfollow someone, asking the visitor first where this place hasn't been let. Says what happened. */
  press(pubkey: string, name: string, adding: boolean): void;
  profiles: Profiles;
}

/** How many people are listed before "Show more". */
const PAGE = 24;

/** A key in what someone typed or pasted: an npub, 64 hex characters, with or without "nostr:" before it. Null for anything else. */
export function keyIn(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const found = /npub1[02-9ac-hj-np-z]{58}/.exec(text)?.[0] ?? /\b[0-9a-f]{64}\b/i.exec(text)?.[0];
  if (!found) return null;
  try {
    return decodeNpub(found);
  } catch {
    return null;
  }
}

export function addFollowingControls(controls: Controls, opts: FollowingOptions): Following {
  const f = opts.follows;
  const profiles = opts.profiles ?? createProfiles(opts.relays ? { relays: opts.relays } : {});
  let shown: string[] = [];
  let chosen: string | null = null;
  let pages = 1;
  let wasMe: string | null = null;
  /** Their list has been looked for once for this person: it isn't looked for again on every drawing. */
  let looked = false;
  const nameOf = (pubkey: string) => profiles.get(pubkey)?.name || shortNpub(pubkey);
  const say = (text: string) => controls.say(text);

  const press = (pubkey: string, name: string, adding: boolean) => {
    const now = async () => {
      const done = await (adding ? f.people.follow(pubkey, name) : f.people.unfollow(pubkey, name));
      say(done.said);
      if (done.ok && adding) void profiles.fetch([pubkey]);
      refresh();
    };
    if (!f.pubkey()) return say("Sign in to follow people.");
    if (f.allowed()) return void now();
    say(f.ask(() => void now()));
  };

  /**
   * Follow whoever's key they typed or pasted into the row (`typed`), or, where the menu has no box to type in (a
   * headset's console), typed on the headset's keyboard or copied.
   */
  const byKey = async (typed?: string) => {
    const me = f.pubkey();
    if (!me) return say("Sign in to follow people.");
    let text = typed ?? "";
    const keyboard = opts.presenting?.() ? (opts.keyboard?.() ?? null) : null;
    if (typed !== undefined) {
      /* what they typed is all there is to read */
    } else if (keyboard) text = (await keyboard.ask({ title: "Their key: npub1… Paste it, or type it. Done follows them.", maxLength: 80 }).catch(() => null)) ?? "";
    else {
      try {
        text = await (opts.copied ? opts.copied() : navigator.clipboard.readText());
      } catch {
        return say(copiedRefused("Copy their key (it starts npub1)"));
      }
    }
    const key = keyIn(text);
    if (!key) return say(keyboard ? "That isn't a key. A key starts npub1 and is 63 characters long." : "What you copied isn't a key. Copy their key (it starts npub1) and press again.");
    if (key === me) return say("That is your own key.");
    chosen = key;
    await profiles.fetch([key]);
    press(key, nameOf(key), true);
  };

  const refresh = () => {
    for (const id of shown) controls.remove(id);
    shown = [];
    const me = f.pubkey();
    if (me !== wasMe) {
      wasMe = me;
      chosen = null;
      pages = 1;
      looked = false;
    }
    const allowed = !!me && f.allowed();
    const follows = allowed ? f.people.follows() : null;
    const add = (...actions: UiAction[]) => {
      for (const a of actions) shown.push(a.id);
      controls.add(...actions.map((a) => ({ section: "following", ...a })));
    };
    controls.addSection({
      id: "following",
      label: "Following",
      icon: "list",
      note: () =>
        !me
          ? "Sign in to see who you follow."
          : !allowed
            ? "Who you follow is yours, and the same in every Nostr app. This place hasn't been let see to it: say so below, and your sign-in address asks you once."
            : follows === null
              ? looked
                ? "Who you follow couldn't be looked for just now."
                : "Looking for who you follow."
              : follows.length === 0
                ? "You follow nobody yet. Follow someone from their card in People, or by their key. Who you follow is public."
                : `You follow ${follows.length === 1 ? "1 person" : `${follows.length} people`}. Select one to see who they are. It is your own Nostr follow list, and it is public.`,
      card: () => {
        if (!chosen || !follows) return null;
        const p = profiles.get(chosen);
        const following = follows.includes(chosen);
        return {
          title: nameOf(chosen),
          tag: following ? "You follow them" : "Not followed",
          proven: false,
          sub: shortNpub(chosen),
          copy: encodeNpub(chosen),
          text: p?.about ?? "",
          picture: showsPictures() ? (p?.picture ?? "") : "",
          color: "",
          // What they have done, as they say: where they stand here, what they show.
          now: opts.about?.lines(chosen) ?? [],
        };
      },
    });
    // A guest has no list: the tab has nothing in it, and isn't shown.
    if (!me) return;
    if (!allowed) {
      add({
        id: "following-let",
        icon: "check",
        tone: "primary",
        label: "Show who I follow, and let me change it here",
        act: () => say(f.ask(() => void f.people.load().then(refresh))),
      });
      return;
    }
    if (follows === null) {
      if (!looked) {
        looked = true;
        void f.people.load().then(refresh);
      } else {
        add({
          id: "following-again",
          icon: "turn",
          label: "Look again",
          act: () => {
            looked = false;
            refresh();
          },
        });
      }
      return;
    }
    // A row typed into: the key is pasted or typed in the menu's own box and followed at the press. So it works in a
    // world shown in its client's frame, which a browser never lets read what was copied.
    add({ id: "following-key", icon: "key", kind: "field", label: "Follow by key (npub1…)", short: "By key", act: (typed) => void byKey(typed) });
    if (chosen) {
      const them = chosen;
      const following = follows.includes(them);
      add({ id: "following-toggle", icon: "check", on: () => following, label: following ? `Unfollow ${nameOf(them)}` : `Follow ${nameOf(them)}`, act: () => press(them, nameOf(them), !following) });
      add(...(opts.more?.({ pubkey: them, name: nameOf(them) }) ?? []));
    }
    // Named people first, by name; then the rest, as their list has them.
    const named = follows.filter((k) => profiles.get(k)?.name).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    const rest = follows.filter((k) => !profiles.get(k)?.name);
    const listed = [...named, ...rest].slice(0, pages * PAGE);
    // Names are asked for a page at a time, for the people on show.
    void profiles.fetch(follows.slice(0, pages * PAGE * 2));
    add(
      ...listed.map((k) => ({
        id: `following-${k.slice(0, 16)}`,
        kind: "swatch" as const,
        color: `#${k.slice(0, 6)}`,
        on: () => chosen === k,
        label: () => nameOf(k),
        act: () => {
          chosen = chosen === k ? null : k;
          refresh();
        },
      })),
    );
    if (follows.length > listed.length) {
      add({
        id: "following-more",
        icon: "list",
        label: `Show more (${listed.length} of ${follows.length})`,
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
  profiles.onChange(soon);
  f.people.onChange(soon);
  opts.about?.onChange(soon);
  refresh();
  return {
    refresh,
    choose(pubkey) {
      chosen = pubkey;
      void profiles.fetch([pubkey]);
      refresh();
    },
    press,
    profiles,
  };
}
