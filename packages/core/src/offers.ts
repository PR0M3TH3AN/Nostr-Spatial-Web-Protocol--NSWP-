/**
 * What a world offers, as its own announcement says it: the list a door
 * shows, and a door's details (NSWP-01, "What a world offers").
 *
 * One rule for every line: it is `on` only for what the announcement says in
 * so many words. Nothing is on by a default, by a guess from something else
 * it said, or because most worlds have it. A world that says nothing about
 * the things visitors carry does allow them (NSWP-17), and its door still
 * doesn't say so: that is the world's to say.
 *
 * So what is not `on` is never "this world doesn't": it is "this world
 * doesn't say", and the words say exactly that. A reader has only the
 * announcement, and looking at a door contacts no site.
 */
import type { World } from "./world.js";

/** The seven a door shows, in the order it shows them. */
export const DOOR_OFFERS = ["headset", "people", "voice", "items", "saves", "records", "paid"] as const;
/** The rest, which a door's details show after those seven. */
export const MORE_OFFERS = ["tips", "doors", "looks", "by-name", "home"] as const;
export const OFFERS = [...DOOR_OFFERS, ...MORE_OFFERS] as const;
export type OfferId = (typeof OFFERS)[number];

export interface Offer {
  id: OfferId;
  /** Whether the announcement says it. */
  on: boolean;
  /** A word or two, for a heading or a label. The same whether it is on or not. */
  name: string;
  /** What it means for the visitor, as one plain sentence: one for a world that says it, another for one that doesn't. */
  words: string;
  /** Whether a door shows it. Otherwise it is for a door's details. */
  onDoor: boolean;
}

/** What `worldOffers` reads. A whole `World` does. */
export type OffersOf = Pick<World, "modes" | "capabilities"> & Partial<Pick<World, "items" | "access">>;

const NAMES: Record<OfferId, string> = {
  headset: "Headset",
  people: "People",
  voice: "Voice",
  items: "Items",
  saves: "Saves",
  records: "Scores",
  paid: "Paid",
  tips: "Tips",
  doors: "Doors",
  looks: "Looks",
  "by-name": "By name",
  home: "Home",
};

/** The sentence for a world that says it, and for one that doesn't. `items` and `records` have more than one of each. */
const WORDS: Record<Exclude<OfferId, "items" | "records">, readonly [on: string, off: string]> = {
  headset: ["You can go in with a VR headset.", "It doesn't say it works in a VR headset."],
  people: ["You can meet other people here.", "It doesn't say you can meet other people here."],
  voice: ["You can talk with people here.", "It doesn't say you can talk with people here."],
  saves: ["Your progress is kept for you here.", "It doesn't say it keeps your progress."],
  paid: ["It costs money to go in.", "It doesn't say it costs anything to go in."],
  tips: ["You can tip this place.", "It doesn't say it takes tips."],
  doors: ["It has doors on to other places.", "It doesn't say it has doors on to other places."],
  looks: ["People appear as they chose to look.", "It doesn't say how people appear."],
  "by-name": ["You can go by your name here.", "It doesn't say you can go by your name here."],
  home: ["It can be the place its owner starts.", "It doesn't say it can be a home."],
};

/**
 * Everything a world may say it offers, each with whether this one says it
 * and the words for that: the seven a door shows first, then the rest. From
 * the announcement alone.
 */
export function worldOffers(world: OffersOf): Offer[] {
  const says = (capability: string) => world.capabilities.includes(capability);
  const scores = says("scores");
  const achievements = says("achievements");
  const read: Record<OfferId, readonly [on: boolean, words: string]> = {
    headset: line("headset", world.modes.includes("immersive-vr")),
    people: line("people", says("rooms") || says("multiplayer")),
    voice: line("voice", says("voice")),
    // Its own tag, with three words. Only two of them are something to offer.
    items:
      world.items === "play"
        ? [true, "The things you carry are part of the game here."]
        : world.items === "allowed"
          ? [true, "The things you carry work here."]
          : world.items === "none"
            ? [false, "The things you carry are put away here."]
            : [false, "It doesn't say whether the things you carry work here."],
    saves: line("saves", says("saves")),
    records: [
      scores || achievements,
      scores && achievements ? "It keeps scores, and marks what you achieve." : scores ? "It keeps scores." : achievements ? "It marks what you achieve." : "It doesn't say it keeps scores or marks what you achieve.",
    ],
    // What costs money to go into names what is sold (the `access` tag). Saying it takes payments is not that.
    paid: line("paid", !!world.access),
    tips: line("tips", says("tips")),
    doors: line("doors", says("spatial-portals")),
    looks: line("looks", says("avatars")),
    "by-name": line("by-name", says("entry-assertion")),
    home: line("home", says("home")),
  };
  const onDoor = new Set<string>(DOOR_OFFERS);
  return OFFERS.map((id) => ({ id, on: read[id][0], name: NAMES[id], words: read[id][1], onDoor: onDoor.has(id) }));
}

function line(id: Exclude<OfferId, "items" | "records">, on: boolean): readonly [boolean, string] {
  return [on, WORDS[id][on ? 0 : 1]];
}
