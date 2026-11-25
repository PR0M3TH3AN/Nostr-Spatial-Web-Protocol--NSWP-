/**
 * Signing from inside a world (protocol/10-identity.md, "Signing from a
 * world"): the pure parts.
 *
 * A world never holds its visitor's key. It asks a hidden signer served by
 * the visitor's own client, embedded in the world's page, and that signer
 * answers with a signed note or a refusal. This file is what both sides
 * agree on: where a client's signer and its sign-in window are, what the
 * messages between a world and the signer look like, which kinds of note a
 * world may have signed, and how a note is tidied and marked before it is
 * signed.
 *
 * Nothing here signs anything, and nothing here is a secret.
 */
import type { EventTemplate, NostrEvent } from "./event.js";
import { cleanLine } from "./chat.js";
import { cleanOrigin } from "./destination.js";
import { isHex64 } from "./event.js";
import { cleanAbout, cleanPicture } from "./pass.js";
import { cleanSlot, fitsInSave } from "./save.js";
import { cleanMessage, cleanRead, type Message, type SealedMessage } from "./message.js";
import { worldCoordinate } from "./rating.js";
import { cleanBoard, cleanScore, SCORE_LIMITS } from "./score.js";
import { ACHIEVEMENT_LIMITS, cleanAchievementId } from "./achievement.js";
import { cleanInvoice } from "./invoice.js";
import { cleanFileBytes, cleanFileName, cleanFileType, cleanFileUrl } from "./files.js";
import { cleanListing, cleanTip } from "./receipt.js";

export const SIGNER_PROTOCOL = "nswp-signer";
export const SIGNER_VERSION = 1;

export const SIGN_LIMITS = {
  /** The longest a note's content may be, in characters. */
  contentChars: 8000,
  tags: 60,
  tagItems: 8,
  tagChars: 400,
  /** How long an unlocked signer stays unlocked for a world, at most. Closing the world's page ends it sooner. */
  grantSec: 4 * 3600,
  /** No more than this many notes for one world in `perMs`: the pace of a person, not of a script. */
  burst: 3,
  perMs: 60_000,
  /** And no more than this many in an hour. */
  hourly: 20,
  /**
   * A pass is counted apart from notes, so signing in doesn't use up a post: no more than this many passes for
   * one world in `perMs`, and in an hour. A reader asks once per sign-in and once when a pass runs out.
   */
  passBurst: 2,
  passHourly: 10,
} as const;

/**
 * How a kind of note is treated when a world asks for it.
 *
 * - "ordinary": allowed once the visitor has unlocked the signer for that world.
 * - "careful": only with the visitor's say each time, on a surface their client draws. Not built yet: refused.
 * - "never": refused, whatever anyone says.
 */
export type SignClass = "ordinary" | "careful" | "never";

/** What a world may have signed once the visitor has said yes to it: a note, and a reaction to one. */
export const ORDINARY_KINDS: readonly number[] = [1, 7];

/**
 * What is never signed for a world: private messages and their wrappings,
 * passes and room signals (a world would be signing itself in), anything
 * that proves who someone is to a server or a relay, wallet and remote-signer
 * traffic, and application data, which is where a client keeps its own.
 */
export const NEVER_KINDS: readonly number[] = [4, 13, 14, 15, 1059, 1060, 13194, 22242, 23194, 23195, 24133, 27235, 27300, 27301, 30078];

export function signClass(kind: unknown): SignClass {
  if (typeof kind !== "number" || !Number.isInteger(kind) || kind < 0 || kind > 65535) return "never";
  if (NEVER_KINDS.includes(kind)) return "never";
  // Anything a relay keeps only the newest of (a profile, a follow list, a relay list) rewrites what the visitor
  // already has, and deleting undoes it: those are never "ordinary".
  if (ORDINARY_KINDS.includes(kind)) return "ordinary";
  return "careful";
}

/** The tag a signer puts on every note it signs for a world: which world asked. A world can't leave it off. */
export const WORLD_TAG = "nswp:world";

/**
 * What a world asked to have signed, as it may be signed for that world: an
 * ordinary kind, its words within the limit, its tags tidied, and marked with
 * the world that asked. The time is the signer's own, never the world's.
 * Null for anything else.
 */
export function prepareForWorld(input: unknown, world: string, now: number): EventTemplate | null {
  const origin = cleanOrigin(world);
  if (!origin || !input || typeof input !== "object") return null;
  const e = input as { kind?: unknown; content?: unknown; tags?: unknown };
  if (signClass(e.kind) !== "ordinary") return null;
  if (typeof e.content !== "string" || [...e.content].length > SIGN_LIMITS.contentChars) return null;
  if (!Array.isArray(e.tags) || e.tags.length > SIGN_LIMITS.tags) return null;
  const tags: string[][] = [];
  for (const tag of e.tags) {
    if (!Array.isArray(tag) || tag.length === 0 || tag.length > SIGN_LIMITS.tagItems) return null;
    if (!tag.every((item) => typeof item === "string" && item.length <= SIGN_LIMITS.tagChars)) return null;
    // The mark is the signer's to write. A world's own is dropped, whatever it says.
    if (tag[0] === WORLD_TAG) continue;
    tags.push([...(tag as string[])]);
  }
  tags.push([WORLD_TAG, origin]);
  return { kind: e.kind as number, created_at: Math.floor(now), tags, content: e.content };
}

/** Whether a signed note is the one that was asked for: the same kind, words and tags, plus the signer's mark. */
export function isWhatWasAsked(asked: { kind: number; content: string; tags: string[][] }, signed: NostrEvent): boolean {
  if (signed.kind !== asked.kind || signed.content !== asked.content) return false;
  const mine = asked.tags.filter((t) => t[0] !== WORLD_TAG);
  const theirs = signed.tags.filter((t) => t[0] !== WORLD_TAG);
  return JSON.stringify(mine) === JSON.stringify(theirs);
}

export interface SignGate {
  /** Whether another note may be signed for this world now. Counts it if so. `now` is in milliseconds. */
  take(now: number): boolean;
}

/** One world's notes, counted: a world the visitor said yes to still can't pour notes out under their name. */
export function createSignGate(limits: { burst: number; perMs: number; hourly: number } = SIGN_LIMITS): SignGate {
  let times: number[] = [];
  return {
    take(now) {
      times = times.filter((t) => now - t < 3_600_000);
      if (times.length >= limits.hourly) return false;
      if (times.filter((t) => now - t < limits.perMs).length >= limits.burst) return false;
      times.push(now);
      return true;
    },
  };
}

/**
 * Where a client's signer and its sign-in window are: beside its Airlock.
 * A client whose Airlock is at `https://client.example/go/` serves them at
 * `/signer/` and `/connect/`. Null for an Airlock that isn't an https address.
 */
export function signerAddresses(airlock: string | null | undefined): { origin: string; signer: string; window: string } | null {
  if (!airlock) return null;
  try {
    const base = new URL(airlock);
    if (base.protocol !== "https:") return null;
    return { origin: base.origin, signer: new URL("../signer/", base).href, window: new URL("../connect/", base).href };
  } catch {
    return null;
  }
}

/**
 * Where a signer and its sign-in window are, for a client that keeps them
 * somewhere of their own and says where in the arrival (`signer`): at
 * `signer/` and `connect/` under that address. Null for anything that isn't
 * an https address.
 */
export function signerAt(base: string | null | undefined): { origin: string; signer: string; window: string } | null {
  if (!base || base.length > 300) return null;
  try {
    const at = new URL(base);
    if (at.protocol !== "https:" || at.username || at.password) return null;
    // A base names a place, not a page: "https://sign.example" and "https://sign.example/" are the same place.
    if (!at.pathname.endsWith("/")) at.pathname += "/";
    at.search = "";
    at.hash = "";
    return { origin: at.origin, signer: new URL("signer/", at).href, window: new URL("connect/", at).href };
  } catch {
    return null;
  }
}

// ---- What a world and the signer say to each other. Every message is `{ nswp: "nswp-signer", v: 1, t, ... }`.

/** From a world: "what state are you in?", "sign this", or "lock": the visitor's own way to end it from the world's menu. */
export type SignerRequest =
  | { t: "state"; id: string }
  | { t: "lock"; id: string }
  | { t: "sign"; id: string; event: { kind: number; content: string; tags: string[][] } }
  /**
   * A room pass for this world, for the session key named (protocol/10-identity.md, "A pass from the signer").
   * The world gives the session's public key and nothing else: the signer writes the rest.
   */
  | { t: "pass"; id: string; session: string }
  /**
   * Keep this for me (protocol/12-saves.md). The world gives a slot's name and the words to keep, and nothing
   * else: the signer works out where it is kept from the world's own address, encrypts it, and signs it.
   */
  | { t: "save"; id: string; slot: string; data: string }
  /** Where is my save in this slot kept? So the world can ask a relay for it. */
  | { t: "find"; id: string; slot: string }
  /** Open this save, which a relay gave me. Opened only if it is this world's. */
  | { t: "open"; id: string; event: NostrEvent }
  /**
   * This world would like to be let do more than a note and a reaction (protocol/10-identity.md, "Asking for
   * more"). It approves nothing: the signer remembers it for its own window, where the visitor is shown it.
   * `family` asks, before the first sign-in, that it be for the world's whole family: `"https://*.<registrable
   * domain>"`, the world's own, so one sign-in carries to every world under that domain. BitLogin's word, carried
   * unchanged; a signer honours it only for a family it knows, judged by the browser's own origin, and says so in
   * its state (`familyTaken`). One that doesn't know the word says nothing of it.
   */
  | { t: "want"; id: string; more?: SignerMore[]; family?: string }
  /**
   * Follow or unfollow one person (protocol/14-people-and-messages.md). The world hands over the newest follow
   * list it found for the visitor, or null where they have none, and the one change. The signer makes the change.
   */
  | { t: "follow"; id: string; list: NostrEvent | null; add?: string; remove?: string }
  /**
   * Send a private message (protocol/14-people-and-messages.md). The world gives who it is to and the words, and
   * nothing else. The signer writes it and seals it, to its reader and to the visitor; the world wraps and sends.
   */
  | { t: "seal"; id: string; to: string; text: string }
  /** Open this wrapped message, which a relay gave me. The signer opens both layers and checks who wrote it. */
  | { t: "unwrap"; id: string; event: NostrEvent }
  /** Sign where the visitor's private messages reach them: a few relays (kind 10050). */
  | { t: "reach"; id: string; relays: string[] }
  /**
   * Sign my visitor's score (protocol/15-scores.md). The world gives its own coordinate, the board and the score,
   * and nothing else: the signer writes the note and marks it with the site that asked.
   */
  | { t: "score"; id: string; world: string; board: string; score: number; title?: string; format?: "number" | "time" }
  /**
   * Sign that my visitor holds one of my achievements (protocol/16-achievements.md). The world gives its own
   * coordinate, the achievement's name and what it is called: the signer writes the note and marks it.
   */
  | { t: "achieve"; id: string; world: string; achievement: string; title: string }
  /**
   * Put this to the person themselves (protocol/10-identity.md, "Asking the person"): a note of a careful kind,
   * which the signer never signs on a world's word. The sign-in address shows it to them in words, on a page of
   * its own, and it is signed only at their press there.
   */
  | { t: "propose"; id: string; event: { kind: number; content: string; tags: string[][] } }
  /** Ask the person for a wallet connection for this world, the same way: on the sign-in address's own page. */
  | { t: "wallet"; id: string }
  /**
   * Ask the person to pay this Lightning invoice, the same way. The world made the invoice; the sign-in address
   * shows them the amount and pays at their press. The world is told it was paid and nothing about their wallet.
   */
  | { t: "pay"; id: string; invoice: string }
  /**
   * Offer the person a file to keep among their own files, the same way: the sign-in address shows them where it
   * would go, and it is saved only at their press there. `private` (the default) is sealed so only they can read it.
   */
  | { t: "file-save"; id: string; name: string; type: string; bytes: Uint8Array; private: boolean }
  /** Ask the person to hand this world one of their files, the same way: they choose it, and say yes. */
  | { t: "file-pick"; id: string }
  /**
   * Ask the person to tip someone, the same way: a person, by their key, or (with no `to`) this world itself. The
   * world names who and how much and nothing else: the sign-in address finds where the money goes and shows it.
   */
  | { t: "tip"; id: string; to?: string; sats: number }
  /**
   * Ask the person to buy a listing, the same way. The sign-in address reads the listing, shows what it is and
   * what it costs, pays, and keeps the receipt. The world never signs as the buyer and never sees the wallet.
   */
  | { t: "buy"; id: string; listing: string }
  /**
   * Does my visitor hold a receipt for this listing? Answered at once, with no question put to them, and only
   * for a listing that is this world's own or was bought through it.
   */
  | { t: "have"; id: string; listing: string }
  /**
   * Change one person on this world's own lists (protocol/10-identity.md, "The owner's screen"), the same way: on the
   * sign-in address's own page, every time, with no standing say-so. The world hands over its coordinate, the newest
   * list it found for the signed-in keeper (or null, with `none` where it has looked and there is none), and the one
   * change. The sign-in address checks that the account is one of the world's keepers, builds the new list itself
   * and signs it; the world sends it to relays.
   */
  | { t: "guests"; id: string; world: string; list: NostrEvent | null; change: "allow" | "unallow" | "block" | "unblock"; key: string; none?: true };

/**
 * The careful kinds a world may put to its visitor, to be signed at their own press on the sign-in address's page:
 * their profile (0), a deletion (5), their relay list (10002). A closed list. Not who they follow (3): a whole
 * list signed for a world could unfollow everyone, so following is one person at a time (`follow`).
 */
export const PROPOSE_KINDS: readonly number[] = [0, 5, 10002];
/** A deletion (NIP-09): a request, signed by whoever wrote a note, that relays drop it. */
export const DELETION_KIND = 5;

/** The most text a purchase may release to a world: room for a key, not for the goods. */
export const DELIVERY_LIMIT = 20_000;

/** A wallet connection as it may be handed to a world: a Nostr Wallet Connect address, and not too long. */
export function cleanWalletUri(input: unknown): string {
  return typeof input === "string" && input.length <= 2000 && /^nostr\+walletconnect:\/\/[0-9a-f]{64}\?[\x21-\x7e]+$/.test(input) ? input : "";
}

/**
 * What a world may ask its visitor to let it do, beyond a note and a reaction. A closed list: each is a thing a
 * visitor can be asked in a few plain words, and none is "sign whatever I hand you".
 *
 * - "follows": follow and unfollow people for them, one at a time (the `follow` message).
 * - "messages": send private messages as them, and read the ones sent to them (`seal`, `unwrap`, `reach`).
 */
export const SIGNER_MORE = ["follows", "messages"] as const;
export type SignerMore = (typeof SIGNER_MORE)[number];

/** What was asked for or allowed, as it may be used: only names on the list, each once. */
export function cleanMore(input: unknown): SignerMore[] {
  if (!Array.isArray(input)) return [];
  return SIGNER_MORE.filter((name) => input.includes(name));
}

/**
 * From the signer. `ready` is said once, unasked, when it has loaded. `state`
 * answers a request and is said again whenever it changes. A refusal never
 * says why.
 */
export type SignerReply =
  | { t: "ready" }
  | { t: "state"; id?: string; unlocked: boolean; pubkey?: string; name?: string; picture?: string; about?: string; until?: number; remembered?: boolean; more?: SignerMore[]; offers?: SignerMore[]; familyTaken?: boolean }
  | { t: "signed"; id: string; event: NostrEvent }
  /** Answers `find`: the `d` of this world's save in that slot. */
  | { t: "found"; id: string; d: string }
  /** Answers `open`: what was kept, in which slot, and when. */
  | { t: "opened"; id: string; slot: string; data: string; at: number }
  /** Answers `seal`: the message as written, and its two seals. */
  | { t: "sealed"; id: string; message: SealedMessage["message"]; seals: SealedMessage["seals"] }
  /** Answers `unwrap`: the message that was inside. */
  | { t: "message"; id: string; message: Message }
  /**
   * Answers `propose` and `wallet`, at once: the person is to be asked. The world has the sign-in address's page
   * shown (its panel, or its window), and the real answer comes later under the same `id`.
   */
  | { t: "asking"; id: string }
  /** Answers `wallet`, once the person has said yes: the connection, for this world. */
  | { t: "wallet"; id: string; uri: string }
  /** Answers `pay`, once the person has paid: with the payment's proof, where their wallet was given one. */
  | { t: "paid"; id: string; preimage?: string }
  /**
   * Answers `file-save`, once the person has saved it: under what name, how big, and whether privately. `url` is
   * where it is kept, only if they kept it public. Never a folder, never a server for a private file, never a key.
   */
  | { t: "file-saved"; id: string; name: string; size: number; private: boolean; url?: string }
  /** Answers `file-pick`, once the person has chosen one: the file itself, already opened if it was private. */
  | { t: "file"; id: string; name: string; type: string; bytes: Uint8Array; url?: string }
  /**
   * Answers `buy`, once it is bought: the receipt, whole and as the selling service signed it, and what the
   * purchase released where the listing releases something (a key for a sealed world), as text.
   */
  | { t: "bought"; id: string; receipt: NostrEvent; delivery?: string }
  /** Answers `have`: the visitor's receipt for that listing. */
  | { t: "receipt"; id: string; receipt: NostrEvent }
  /** Answers `have`: they hold none that this world may be told of. */
  | { t: "none"; id: string }
  | { t: "refused"; id: string };

const ID = /^[0-9a-z-]{1,40}$/i;
const wrapped = (data: unknown): Record<string, unknown> | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  return d.nswp === SIGNER_PROTOCOL && d.v === SIGNER_VERSION && typeof d.t === "string" ? d : null;
};

export const signerMessage = <T extends SignerRequest | SignerReply>(message: T): T & { nswp: string; v: number } => ({ nswp: SIGNER_PROTOCOL, v: SIGNER_VERSION, ...message });

/** Read what a world sent the signer. Null for anything else. The event is checked later, by `prepareForWorld`. */
export function readSignerRequest(data: unknown): SignerRequest | null {
  const d = wrapped(data);
  if (!d || typeof d.id !== "string" || !ID.test(d.id)) return null;
  if (d.t === "state") return { t: "state", id: d.id };
  if (d.t === "lock") return { t: "lock", id: d.id };
  if (d.t === "sign" && d.event && typeof d.event === "object") return { t: "sign", id: d.id, event: d.event as { kind: number; content: string; tags: string[][] } };
  if (d.t === "pass" && isHex64(d.session)) return { t: "pass", id: d.id, session: d.session };
  if (d.t === "save" && cleanSlot(d.slot) && fitsInSave(d.data)) return { t: "save", id: d.id, slot: cleanSlot(d.slot), data: d.data };
  if (d.t === "find" && cleanSlot(d.slot)) return { t: "find", id: d.id, slot: cleanSlot(d.slot) };
  if (d.t === "open" && d.event && typeof d.event === "object") return { t: "open", id: d.id, event: d.event as NostrEvent };
  if (d.t === "want" && (Array.isArray(d.more) || cleanFamily(d.family))) return { t: "want", id: d.id, ...(Array.isArray(d.more) ? { more: cleanMore(d.more) } : {}), ...(cleanFamily(d.family) ? { family: cleanFamily(d.family) } : {}) };
  if (d.t === "score" && worldCoordinate(d.world) && cleanBoard(d.board) && cleanScore(d.score) !== null) {
    const title = cleanLine(d.title, SCORE_LIMITS.title);
    return { t: "score", id: d.id, world: worldCoordinate(d.world), board: cleanBoard(d.board), score: cleanScore(d.score)!, ...(title ? { title } : {}), ...(d.format === "time" ? { format: "time" as const } : {}) };
  }
  if (d.t === "achieve" && worldCoordinate(d.world) && cleanAchievementId(d.achievement) && cleanLine(d.title, ACHIEVEMENT_LIMITS.title)) {
    return { t: "achieve", id: d.id, world: worldCoordinate(d.world), achievement: cleanAchievementId(d.achievement), title: cleanLine(d.title, ACHIEVEMENT_LIMITS.title) };
  }
  if (d.t === "seal" && isHex64(d.to) && cleanMessage(d.text)) return { t: "seal", id: d.id, to: d.to, text: cleanMessage(d.text) };
  if (d.t === "unwrap" && d.event && typeof d.event === "object") return { t: "unwrap", id: d.id, event: d.event as NostrEvent };
  if (d.t === "reach" && Array.isArray(d.relays) && d.relays.length <= 8 && d.relays.every((r) => typeof r === "string" && r.length <= 200)) return { t: "reach", id: d.id, relays: d.relays as string[] };
  if (d.t === "propose" && d.event && typeof d.event === "object" && PROPOSE_KINDS.includes((d.event as { kind?: unknown }).kind as number)) return { t: "propose", id: d.id, event: d.event as { kind: number; content: string; tags: string[][] } };
  if (d.t === "wallet") return { t: "wallet", id: d.id };
  if (d.t === "pay" && cleanInvoice(d.invoice)) return { t: "pay", id: d.id, invoice: cleanInvoice(d.invoice) };
  if (d.t === "file-pick") return { t: "file-pick", id: d.id };
  if (d.t === "tip" && cleanTip(d.sats) !== null && (d.to === undefined || isHex64(d.to))) return { t: "tip", id: d.id, sats: cleanTip(d.sats)!, ...(isHex64(d.to) ? { to: d.to } : {}) };
  if ((d.t === "buy" || d.t === "have") && cleanListing(d.listing)) return { t: d.t, id: d.id, listing: cleanListing(d.listing) };
  if (d.t === "file-save" && cleanFileName(d.name) && cleanFileBytes(d.bytes)) return { t: "file-save", id: d.id, name: cleanFileName(d.name), type: cleanFileType(d.type), bytes: cleanFileBytes(d.bytes)!, private: d.private !== false };
  if (d.t === "follow" && (d.list === null || (d.list && typeof d.list === "object")) && isHex64(d.add) !== isHex64(d.remove)) {
    return { t: "follow", id: d.id, list: d.list as NostrEvent | null, ...(isHex64(d.add) ? { add: d.add } : { remove: d.remove as string }) };
  }
  return null;
}

/** Read what the signer sent a world. Null for anything else. A signed note is checked by the caller. */
/** A world's family as BitLogin's word has it: exactly `"https://*.<registrable domain>"`, lower case; anything else "". */
function cleanFamily(value: unknown): string {
  return typeof value === "string" && value.length <= 260 && /^https:\/\/\*\.[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value) ? value : "";
}

export function readSignerReply(data: unknown): SignerReply | null {
  const d = wrapped(data);
  if (!d) return null;
  if (d.t === "ready") return { t: "ready" };
  if (d.t === "state" && typeof d.unlocked === "boolean") {
    const pubkey = typeof d.pubkey === "string" && /^[0-9a-f]{64}$/.test(d.pubkey) ? d.pubkey : undefined;
    return {
      t: "state",
      ...(typeof d.id === "string" && ID.test(d.id) ? { id: d.id } : {}),
      unlocked: d.unlocked && !!pubkey,
      ...(pubkey ? { pubkey } : {}),
      ...(typeof d.name === "string" && cleanLine(d.name, 48) ? { name: cleanLine(d.name, 48) } : {}),
      // Their own picture and words, as their sign-in address read them from their profile: cleaned as a pass's are.
      ...(pubkey && cleanPicture(d.picture) ? { picture: cleanPicture(d.picture) } : {}),
      ...(pubkey && cleanAbout(d.about) ? { about: cleanAbout(d.about) } : {}),
      ...(typeof d.until === "number" && Number.isFinite(d.until) ? { until: d.until } : {}),
      // Whether the signer will still be unlocked for this world on their next visit, where it says.
      ...(pubkey && d.unlocked && typeof d.remembered === "boolean" ? { remembered: d.remembered } : {}),
      // What the visitor let this world do beyond a note and a reaction. Nothing, from a signer that doesn't say.
      ...(pubkey && d.unlocked && cleanMore(d.more).length ? { more: cleanMore(d.more) } : {}),
      // What this signer can be asked for at all, locked or not. Left out by one that doesn't say: then it is asked.
      ...(Array.isArray(d.offers) ? { offers: cleanMore(d.offers) } : {}),
      // Whether it took the world's whole family at the sign-in (`family`, asked with `want`). Left out by one that
      // doesn't know the word, which is "not offered".
      ...(typeof d.familyTaken === "boolean" ? { familyTaken: d.familyTaken } : {}),
    };
  }
  if (typeof d.id !== "string" || !ID.test(d.id)) return null;
  if (d.t === "refused") return { t: "refused", id: d.id };
  if (d.t === "asking") return { t: "asking", id: d.id };
  if (d.t === "wallet" && cleanWalletUri(d.uri)) return { t: "wallet", id: d.id, uri: cleanWalletUri(d.uri) };
  if (d.t === "paid") return { t: "paid", id: d.id, ...(isHex64(d.preimage) ? { preimage: d.preimage } : {}) };
  if (d.t === "none") return { t: "none", id: d.id };
  // A receipt is taken as a signed note and nothing more here: whoever asked checks it (`readReceipt`).
  if ((d.t === "bought" || d.t === "receipt") && d.receipt && typeof d.receipt === "object") {
    const delivery = d.t === "bought" && typeof d.delivery === "string" && d.delivery.length > 0 && d.delivery.length <= DELIVERY_LIMIT ? d.delivery : undefined;
    return d.t === "bought" ? { t: "bought", id: d.id, receipt: d.receipt as NostrEvent, ...(delivery !== undefined ? { delivery } : {}) } : { t: "receipt", id: d.id, receipt: d.receipt as NostrEvent };
  }
  if (d.t === "file-saved" && cleanFileName(d.name) && typeof d.size === "number" && Number.isSafeInteger(d.size) && d.size >= 0) {
    // Private unless it says otherwise, and an address only for a public one.
    const kept = d.private !== false;
    return { t: "file-saved", id: d.id, name: cleanFileName(d.name), size: d.size, private: kept, ...(!kept && cleanFileUrl(d.url) ? { url: cleanFileUrl(d.url) } : {}) };
  }
  if (d.t === "file" && cleanFileName(d.name) && cleanFileBytes(d.bytes)) return { t: "file", id: d.id, name: cleanFileName(d.name), type: cleanFileType(d.type), bytes: cleanFileBytes(d.bytes)!, ...(cleanFileUrl(d.url) ? { url: cleanFileUrl(d.url) } : {}) };
  if (d.t === "signed" && d.event && typeof d.event === "object") return { t: "signed", id: d.id, event: d.event as NostrEvent };
  if (d.t === "found" && isHex64(d.d)) return { t: "found", id: d.id, d: d.d };
  if (d.t === "sealed" && d.message && typeof d.message === "object" && Array.isArray(d.seals) && d.seals.length === 2) return { t: "sealed", id: d.id, message: d.message as SealedMessage["message"], seals: d.seals as SealedMessage["seals"] };
  if (d.t === "message" && cleanRead(d.message)) return { t: "message", id: d.id, message: cleanRead(d.message)! };
  if (d.t === "opened" && cleanSlot(d.slot) && fitsInSave(d.data) && typeof d.at === "number" && Number.isFinite(d.at)) return { t: "opened", id: d.id, slot: cleanSlot(d.slot), data: d.data, at: d.at };
  return null;
}

// ---- What the client's window and its own signer say to each other, across the world's page. These are only ever
// delivered between two pages of the client's own origin: the browser sees to that, and each side checks it.

export const HANDOFF_PROTOCOL = "nswp-handoff";

export type HandoffMessage =
  /** Window to every frame of the page that opened it: "is one of you mine?" */
  | { t: "hello"; nonce: string }
  /** Signer to window: which world embeds it (as the browser says), and a throwaway key to seal the hand-off to. */
  | { t: "frame"; nonce: string; world: string; recipient: string }
  /** Window to signer, after the visitor pressed Allow: the sealed hand-off, for that world. */
  | { t: "grant"; nonce: string; world: string; sealed: { senderPublicKey: string; payload: string }; name?: string }
  /** Signer to window: it is unlocked, or it could not be. */
  | { t: "done"; nonce: string; ok: boolean };

export const handoffMessage = <T extends HandoffMessage>(message: T): T & { nswp: string; v: number } => ({ nswp: HANDOFF_PROTOCOL, v: SIGNER_VERSION, ...message });

export function readHandoffMessage(data: unknown): HandoffMessage | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.nswp !== HANDOFF_PROTOCOL || d.v !== SIGNER_VERSION || typeof d.nonce !== "string" || !ID.test(d.nonce)) return null;
  const hex = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
  if (d.t === "hello") return { t: "hello", nonce: d.nonce };
  if (d.t === "frame" && cleanOrigin(d.world) && hex(d.recipient)) return { t: "frame", nonce: d.nonce, world: cleanOrigin(d.world), recipient: d.recipient };
  if (d.t === "grant" && cleanOrigin(d.world) && d.sealed && typeof d.sealed === "object") {
    const s = d.sealed as Record<string, unknown>;
    if (!hex(s.senderPublicKey) || typeof s.payload !== "string" || s.payload.length > 4000) return null;
    return { t: "grant", nonce: d.nonce, world: cleanOrigin(d.world), sealed: { senderPublicKey: s.senderPublicKey, payload: s.payload }, ...(typeof d.name === "string" && cleanLine(d.name, 48) ? { name: cleanLine(d.name, 48) } : {}) };
  }
  if (d.t === "done" && typeof d.ok === "boolean") return { t: "done", nonce: d.nonce, ok: d.ok };
  return null;
}
