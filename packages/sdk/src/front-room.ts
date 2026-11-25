/**
 * The front room of a paid world: the gate, and the one control that asks a visitor to buy
 * (docs/plans/paying-for-things.md, sections 6, 6.1, 7.1 and 7.2; protocol/10-identity.md, "The front room").
 *
 *   const gate = worldGate();                        // nswp-sdk/three: this page's own signer and manifest
 *   addGateControls(controls, gate, { presenting: () => renderer.xr.isPresenting });
 *   const canStand = (x, z) => gate.open || !pastTheGate(x, z);
 *
 * A world puts the gate where it likes, and everything before it is free. This is the `soft` kind: the world and
 * every honest client keep to it, and it promises nothing against someone who means to get round it (a world is a
 * website, and its files are public). What it holds to:
 *
 * - **It opens on a receipt and on nothing else.** Never on the word "bought", a flag in an address, or a bare
 *   payment. The receipt is checked here (`readReceipt`) whoever else checked it: really signed, by a service the
 *   kit believes, for one of this world's own listings, this visitor's, and not run out.
 * - **It fails closed, and says why in plain words.** While anything is unknown it is shut.
 * - **What it is entered by is the world's own site's word:** its manifest's `access`, each listing sold by a key
 *   the manifest lets announce the world. Nobody prices a world that isn't theirs.
 * - **It shows what is for sale before anyone is asked:** the listing's name, its price, and how long it lasts,
 *   read from the seller's own signed note. Nothing under the least price is shown.
 * - **It never takes money.** The control calls `signer.buy`, and the visitor's own sign-in address does the rest
 *   on its own page.
 * - **A timed pass that runs out closes the gate where it stands,** after a notice and a couple of minutes, with
 *   no page loaded again under anyone.
 *
 * Nothing here draws anything: a world shows the gate its own way and reads `open`. The control is added to the
 * visitor's console, so it is the same on a flat screen and in a headset.
 */
import { ACCESS_MOST, accessFor, cleanAccess, cleanListing, DEFAULT_RELAYS, isHex64, LIST_KIND, listD, LISTING_KIND, listingSeller, OWNER_LIST_LIMITS, parseManifest, priceWords, publishEvent, readListing, readReceipt, isOwnerListAsked, resolveOwnerList, scopeOfChange, shortNpub, worldSubject, WORLD_KIND, type OwnerListChange, type Filter, type Listing, type ListingRefusal, type NostrEvent, type QueryResult, type Receipt } from "@nswp/core";
import { keyIn } from "./following.js";
import { copiedRefused } from "./client-frame.js";
import { createProfiles, type Profiles } from "./profiles.js";
import { askWell, sendWell } from "./relay-book.js";
import type { WorldSigner } from "./signer.js";
import type { Controls } from "./ui/model.js";

/**
 * The gate's own times, in seconds. `grace`: how long someone inside has after their time runs out (the owner's
 * decision: a notice and a couple of minutes). `look`: how often what is held is asked about again, and the least
 * time between two askings of the selling service. `goodFor`: how long a receipt last found good stays good while
 * that service can't be reached (the owner's decision: someone who paid isn't locked out by a short outage).
 */
export const GATE_TIMES = { grace: 120, look: 300, goodFor: 86_400 } as const;

/** "free": this world names nothing for sale. "checking": not known yet, and shut. "ending": open, for the last couple of minutes of a pass that has run out. */
export type GateState = "free" | "checking" | "shut" | "open" | "ending";
/** Why a gate is shut, or "" where it isn't. Stable words for a test or a world's own drawing to go by. */
export type GateReason = "" | "no-manifest" | "not-own" | "no-signer" | "signed-out" | "nothing-held" | "run-out" | "taken-back" | "unchecked" | "blocked" | "not-invited";
/**
 * How the world owner's block list stands, as the gate last read it (protocol/10-identity.md, "A world's own
 * lists"). "none": this world keeps no lists. "reading": being read for the first time. "read": read, and it may name
 * nobody. "not-found": there is none. "unreadable": its newest copy was refused. "unanswered": no relay answered,
 * and the copy this device remembered (or none) is used.
 */
export type ListState = "none" | "reading" | "read" | "not-found" | "unreadable" | "unanswered";

/** One thing a visitor can buy to get in, as its listing reads. */
export interface GateOffer {
  readonly listing: string;
  /** The seller's own name for it. */
  readonly name: string;
  readonly sats: number;
  /** How long it lasts, in seconds, or null for something bought for good. */
  readonly term: number | null;
  /** Its price and how long it lasts, in words: "500 sats, for 30 days". */
  readonly words: string;
}

/** What the gate needs of the page's signer: no more than it uses. */
export type GateSigner = Pick<WorldSigner, "state" | "pubkey" | "host" | "have" | "buy" | "guests" | "onChange" | "whenAnswered">;

export interface PaidGateOptions {
  /** The page's own signer, or null where the visitor came with none (`worldGate` gives it). Asked each time. */
  signer: () => GateSigner | null;
  /**
   * What this world is entered by, said outright. Left out, the world's own manifest is read for it, which is
   * the usual way. Either way each listing must be sold by a key the manifest lets announce this world. An empty
   * list is a free world: nothing is read, asked or shown.
   */
  listings?: readonly string[];
  /** This world's address. Left out, the page's own. */
  url?: string;
  /** The usual relays, asked for a listing beside the ones the manifest names. Left out, the kit's own list. */
  relays?: string[];
  /** For tests: what reads the world's own manifest. Left out, the file at this site's well-known address. */
  manifest?: () => Promise<unknown>;
  /** For tests: what asks relays. */
  query?: (relays: string[], filter: Filter, timeoutMs?: number) => Promise<QueryResult>;
  /** For tests: what sends a changed list to relays. */
  publish?: typeof publishEvent;
  /**
   * For tests: what asks the service that signed a receipt whether it has taken it back since. Left out, that
   * service is asked at its own address. "unknown" where it couldn't be asked.
   */
  status?: (receipt: Receipt) => Promise<"stands" | "taken-back" | "unknown">;
  /** For tests: the time, in milliseconds. */
  now?: () => number;
}

export interface PaidGate {
  readonly state: GateState;
  /** Whether a visitor may go past it now. The one thing a world needs to read. */
  readonly open: boolean;
  /** Why it is shut, as a stable word. */
  readonly reason: GateReason;
  /** Why it is shut, or what is about to happen, in plain words for the visitor. "" where there is nothing to say. */
  readonly why: string;
  /** What can be bought to get in: each listing that was read and holds up. */
  readonly offers: readonly GateOffer[];
  /** Whether what is for sale has been looked for yet: each listing read, or found not to hold up. */
  readonly read: boolean;
  /** When the pass that holds it open stops, in seconds, or null: it doesn't, or nothing is held. */
  readonly until: number | null;
  /** Whether the visitor is signed in here: buying needs it. */
  readonly signedIn: boolean;
  /**
   * The keys the world owner's block list names, where this world keeps lists (its manifest names `keepers`):
   * for the room, which neither shows nor hears anyone behind them. Never the visitor's own blocks, never kept with
   * them, never carried on to another world. Empty where the world keeps no lists or the list names nobody.
   */
  readonly ownerBlocked: readonly string[];
  /** Whether this world's rooms show only people whose pass checks out (its manifest's `named_only`). */
  readonly namedOnly: boolean;
  /** Whether guest accounts may come in (its manifest's `guests`; true where it says nothing). Not `guests`, the guest list. */
  readonly takesGuests: boolean;
  /** How the owner's block list stands. */
  readonly lists: ListState;
  /** Whether this world is by invitation (its manifest's `by_invitation`). */
  readonly byInvitation: boolean;
  /** How the owner's allow list stands, where the world is by invitation; "none" where it isn't. */
  readonly invites: ListState;
  /**
   * Who may be in this world's rooms, where it is by invitation: the people its owner's allow list names, and the
   * keepers. Null where the world isn't by invitation. Empty where the list couldn't be read: then only a keeper.
   */
  readonly invited: readonly string[] | null;
  /** The visitor's sign-in address, as a host to name in words. */
  readonly host: string;
  /** A purchase is with the visitor now, at their sign-in address. */
  readonly buying: boolean;
  /** The visitor signed in here, where they are one of this world's keepers (their key), or null: "Who comes in" is theirs. */
  readonly keeper: string | null;
  /** Who the guest list itself names, as read (not the keepers, always let in), where the world is by invitation; else null. */
  readonly guests: readonly string[] | null;
  /**
   * Change one person on this world's own lists, for a keeper signed in here (protocol/10-identity.md, "The owner's
   * screen"): let in or take off the guest list (a world by invitation), block or unblock. Call it from a press.
   * Their sign-in address asks them on its own page; what comes back is checked, sent to relays, and taken here at
   * once. Where no list was found, the first press says so and a second, for the same change, starts one: a relay
   * that was down must not wipe a list. `said` is what to tell them, in words; `again` that a second press is wanted.
   */
  changeList(change: OwnerListChange, key: string): Promise<{ ok: boolean; said: string; again?: boolean }>;
  /**
   * Ask the visitor to buy one of the offers (the first, left out). Call it from a press. Their sign-in address
   * asks them on its own page. Resolves true only once a receipt that holds up has opened the gate.
   */
  buy(listing?: string): Promise<boolean>;
  /** Look again now: at what is held, and for any listing that couldn't be read. */
  check(): Promise<void>;
  /** Be told when anything above may have changed. Returns how to stop. */
  onChange(fn: () => void): () => void;
  /** Everything above, for a test to read. */
  info(): Record<string, unknown>;
  dispose(): void;
}

type Held = Receipt & { event: NostrEvent };

const LISTS_KEY = "nswp:owner-lists";
/**
 * The newest copy of each owner's list this device has seen, by its `d`. A list is public, so keeping it says
 * nothing about the visitor. It is what stops an older copy being taken: the newest is chosen from these and what
 * relays give, together.
 */
function rememberedLists(): Record<string, NostrEvent> {
  try {
    const kept = JSON.parse(globalThis.localStorage?.getItem(LISTS_KEY) ?? "{}") as unknown;
    return kept && typeof kept === "object" && !Array.isArray(kept) ? (kept as Record<string, NostrEvent>) : {};
  } catch {
    return {};
  }
}
function rememberList(d: string, event: NostrEvent): void {
  try {
    const all = { ...rememberedLists(), [d]: event };
    // A few worlds' worth: the newest kept.
    const kept = Object.entries(all).sort((a, b) => (b[1]?.created_at ?? 0) - (a[1]?.created_at ?? 0)).slice(0, 24);
    globalThis.localStorage?.setItem(LISTS_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    /* a private window: remembered for this page only */
  }
}
type Unread = ListingRefusal | "not-found" | "no-relay" | "not-for-here";

const GOOD_KEY = "nswp:receipts:good";
/** When each receipt was last found good, by its own name at the service that signed it: kept on this device. */
function goodAt(): Record<string, number> {
  try {
    const kept = JSON.parse(globalThis.localStorage?.getItem(GOOD_KEY) ?? "{}") as unknown;
    return kept && typeof kept === "object" && !Array.isArray(kept) ? (kept as Record<string, number>) : {};
  } catch {
    return {};
  }
}
function keepGood(fulfillment: string, at: number): void {
  try {
    // The newest few: a visitor holds a handful of passes, not hundreds.
    const all = Object.entries({ ...goodAt(), [fulfillment]: at }).filter(([, t]) => typeof t === "number").sort((a, b) => b[1] - a[1]).slice(0, 40);
    globalThis.localStorage?.setItem(GOOD_KEY, JSON.stringify(Object.fromEntries(all)));
  } catch {
    /* a private window: remembered for this page only */
  }
}

/** Ask the service that signed a receipt whether it has taken it back since: its own public answer, at its own address. */
async function askService(receipt: Receipt): Promise<"stands" | "taken-back" | "unknown"> {
  if (typeof fetch !== "function") return "unknown";
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(`${receipt.issuer.service}/entitlements/${encodeURIComponent(receipt.fulfillment)}/status`, { credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal: ctl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return "unknown";
    const said = (await res.json()) as { revokedAt?: unknown } | null;
    if (!said || typeof said !== "object") return "unknown";
    return said.revokedAt === undefined || said.revokedAt === null ? "stands" : "taken-back";
  } catch {
    return "unknown";
  }
}

/** Why a listing isn't offered, in plain words. */
function unreadWords(why: Unread): string {
  switch (why) {
    case "no-relay":
      return "What it costs couldn't be read just now: no relay answered. It is being asked for again.";
    case "not-found":
      return "Its listing wasn't found on the relays asked, so it can't be bought here yet. It is being asked for again.";
    case "too-cheap":
      return "Its listing is priced under 500 sats, the least anything is sold for, so it isn't offered.";
    case "other-seller":
    case "not-signed":
      return "Its listing isn't signed by this world's own key, so it isn't offered.";
    case "not-for-sale":
      return "It isn't for sale just now.";
    case "unknown-service":
      return "It is sold through a service this world can't take a receipt from, so it isn't offered.";
    case "shared":
      return "Its price is divided between several people, which isn't switched on yet, so it isn't offered.";
    case "not-for-here":
      return "Its listing is for somewhere else, so it isn't offered here.";
    default:
      return "Its listing doesn't read, so it isn't offered.";
  }
}

/** When a pass stops, in words: "until 21 Nov, 14:05". */
function untilWords(until: number | null): string {
  if (until === null) return "for good";
  try {
    return `until ${new Date(until * 1000).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "for now";
  }
}

/** A gate for this world. With nothing for sale it is "free" at once and does nothing more. */
export function createPaidGate(opts: PaidGateOptions): PaidGate {
  const now = opts.now ?? (() => Date.now());
  const sec = () => Math.floor(now() / 1000);
  const watchers = new Set<() => void>();
  // A world that says outright that it names nothing is free, with nothing read and nobody asked.
  let state: GateState = opts.listings && opts.listings.length === 0 ? "free" : "checking";
  let reason: GateReason = "";
  let listings: string[] = [];
  let ownRelays: string[] = [];
  /** This world's own coordinate for each seller, where its manifest gave its name: what a listing may say it is for. */
  let worldName = "";
  const offers = new Map<string, Listing>();
  const unread = new Map<string, Unread>();
  let held: Held | null = null;
  /** Receipts the service that signed them said it took back: not believed again on this page. */
  const takenBack = new Set<string>();
  /** When each receipt's service was last asked, on this page. */
  const asked = new Map<string, number>();
  let endsAt = 0;
  let buying = false;
  /** A change to the lists is with the keeper now; and the change a second press would start a new list for. */
  let changing = false;
  let starting: { what: string; at: number } | null = null;
  let disposed = false;
  let round = 0;
  let endTimer: ReturnType<typeof setTimeout> | undefined;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let lookTimer: ReturnType<typeof setInterval> | undefined;
  let retries = 0;
  let unwatch: (() => void) | null = null;
  /** How many times a signer has been looked for again where none was named, and the timer for the next. */
  let seeking = 0;
  let seekTimer: ReturnType<typeof setTimeout> | undefined;
  /** Whether this world is sold (it names listings). A world that keeps lists and sells nothing is open but for a block. */
  let paid = false;
  /**
   * Where this world keeps lists: whose lists count (its keepers; null for the default, each world coordinate's own
   * key), and what they are for (its coordinate, for each publisher).
   */
  let lists: { root: string[] | null; subjects: string[] } | null = null;
  let listState: ListState = "none";
  let ownerBlocked: string[] = [];
  let namedOnly = false;
  let takesGuests = true;
  let byInvitation = false;
  let inviteState: ListState = "none";
  let invited: string[] = [];
  /** The owner's list is asked for again soon after no relay answered: less and less often, up to the usual look. */
  let listRetries = 0;
  let listTimer: ReturnType<typeof setTimeout> | undefined;

  const changed = (): void => {
    for (const fn of [...watchers]) {
      try {
        fn();
      } catch {
        /* a watcher's trouble is not the gate's */
      }
    }
  };
  const set = (next: GateState, why: GateReason): void => {
    if (state === next && reason === why) return;
    state = next;
    reason = why;
    changed();
  };
  const shut = (why: GateReason): void => {
    clearTimeout(endTimer);
    clearTimeout(graceTimer);
    endsAt = 0;
    held = null;
    set("shut", why);
  };
  /** A receipt, checked here whoever checked it before: for one of this world's listings, this visitor's, not run out. */
  const believe = (event: unknown, listing: string, buyer: string | null): Held | null => {
    if (!buyer || !listings.includes(listing)) return null;
    const read = readReceipt(event, { listing, buyer, now: sec() });
    return read.ok && !takenBack.has(read.receipt.fulfillment) ? { ...read.receipt, event: event as NostrEvent } : null;
  };
  const lasts = (r: Held): boolean => r.expiresAt === null || r.expiresAt * 1000 > now();
  /** Of several, the one that lasts longest: one with no end, else the latest end. */
  const best = (all: (Held | null)[]): Held | null =>
    all.filter((r): r is Held => !!r && lasts(r)).sort((a, b) => (a.expiresAt === null ? -1 : b.expiresAt === null ? 1 : b.expiresAt - a.expiresAt))[0] ?? null;

  const openUp = (r: Held): void => {
    held = r;
    clearTimeout(endTimer);
    clearTimeout(graceTimer);
    endsAt = 0;
    // At its end, to the second: looked at again then, in case it was renewed.
    if (r.expiresAt !== null) endTimer = setTimeout(() => void look(true), Math.max(0, Math.min(r.expiresAt * 1000 - now(), 2 ** 31 - 1)));
    const was = state;
    set("open", "");
    // Open already, by another receipt (a renewal): when it stops has changed.
    if (was === "open") changed();
  };
  /** Their time ran out while they were inside: told, given a couple of minutes, then shut. */
  const ending = (): void => {
    held = null;
    clearTimeout(endTimer);
    clearTimeout(graceTimer);
    endsAt = now() + GATE_TIMES.grace * 1000;
    graceTimer = setTimeout(() => {
      if (state === "ending") shut("run-out");
    }, GATE_TIMES.grace * 1000);
    set("ending", "run-out");
  };
  /** Ask the service whether it took this one back, no oftener than every few minutes, and act on what it says. */
  const askAbout = async (r: Held): Promise<"stands" | "taken-back" | "unknown"> => {
    asked.set(r.fulfillment, now());
    const said = await (opts.status ?? askService)(r).catch(() => "unknown" as const);
    if (said === "stands") keepGood(r.fulfillment, now());
    if (said === "taken-back") takenBack.add(r.fulfillment);
    return said;
  };
  /**
   * Take a receipt that holds up. One found good within the last day opens the gate at once, and the service is
   * asked behind it. One that wasn't waits for the service's answer: with none, the gate stays shut.
   */
  const take = async (r: Held, mine: number): Promise<void> => {
    const last = Math.max(goodAt()[r.fulfillment] ?? 0, r.issuedAt * 1000);
    const fresh = now() - last < GATE_TIMES.goodFor * 1000;
    const due = now() - (asked.get(r.fulfillment) ?? 0) >= GATE_TIMES.look * 1000;
    if (fresh) {
      openUp(r);
      if (!due) return;
      const said = await askAbout(r);
      if (disposed || held?.fulfillment !== r.fulfillment) return;
      if (said === "taken-back") return shut("taken-back");
      // Still not to be had, and now a day since it was last found good: shut until the service answers.
      if (said === "unknown" && now() - Math.max(goodAt()[r.fulfillment] ?? 0, r.issuedAt * 1000) >= GATE_TIMES.goodFor * 1000) shut("unchecked");
      return;
    }
    const said = due ? await askAbout(r) : "unknown";
    if (disposed || mine !== round) return;
    if (said === "stands") return openUp(r);
    if (state !== "ending") shut(said === "taken-back" ? "taken-back" : "unchecked");
  };

  /** Ask the signer what is held. `ended`: asked because the pass that held the gate open has just run out. */
  const look = async (ended = false): Promise<void> => {
    if (disposed || state === "free") return;
    const mine = ++round;
    const signer = opts.signer();
    // A signer that was named after the gate began (a world that started its gate first) is listened to from here on.
    if (signer && !unwatch) unwatch = signer.onChange(() => void look());
    const buyer = signer?.state === "unlocked" ? signer.pubkey : null;
    // Nobody to ask yet: looked for again shortly, a few times, in case the world names one a moment later.
    if (!signer && seeking < 10) {
      seeking++;
      clearTimeout(seekTimer);
      seekTimer = setTimeout(() => void look(), 3000);
    }
    // Kept out by the world's owner: blocked beats everything, a pass included. Never a keeper, in their own world.
    if (isBlocked(buyer)) return shut("blocked");
    // By invitation: only someone signed in as a key the owner invited, or a keeper. Unknown is shut.
    if (byInvitation) {
      if (!signer || !buyer) return shut(signer ? "signed-out" : "no-signer");
      if (inviteState === "reading" || listState === "reading") return;
      if (!isInvited(buyer)) return shut("not-invited");
      if (!paid) return set("open", "");
    }
    // A world that keeps lists and sells nothing is open to anyone not on the block list, guests included: a block
    // stops a name, and a guest has none.
    if (!paid) {
      if (lists && buyer && listState === "reading") return;
      return set("open", "");
    }
    // Signed out, or nobody to ask: whatever was held is nobody's here now.
    if (!signer || !buyer) return shut(signer ? "signed-out" : "no-signer");
    if (held && held.buyer !== buyer) held = null;
    const got = await Promise.all(listings.map((l) => signer.have(l).then((r) => (r ? believe(r.event, l, buyer) : null)).catch(() => null)));
    if (disposed || mine !== round) return;
    // What is already held and still good is kept: a signer that says "none" a moment later takes nothing away.
    const found = best([...got, held && !takenBack.has(held.fulfillment) ? held : null]);
    if (found) return take(found, mine);
    if (state === "ending") return;
    if (ended && state === "open") return ending();
    shut(reason === "taken-back" || reason === "unchecked" || reason === "run-out" ? reason : "nothing-held");
  };

  /** Read what is for sale from relays, the way the kit reads anything: the seller's own signed listing. */
  const readOffers = async (): Promise<void> => {
    const want = listings.filter((l) => !offers.has(l));
    if (!want.length || disposed) return;
    const name = (l: string) => l.slice(71);
    const filter: Filter = { kinds: [LISTING_KIND], authors: [...new Set(want.map(listingSeller))], "#d": want.map(name) };
    const got = await askWell(filter, { own: ownRelays, usual: opts.relays ?? DEFAULT_RELAYS, ...(opts.query ? { query: opts.query } : {}), now }).catch(() => null);
    if (disposed) return;
    const answered = !!got && Object.values(got.relays).some((said) => said === "eose");
    for (const l of want) {
      // The newest the seller signed under that name is the listing: an older one was replaced.
      const newest = (got?.events ?? []).filter((e) => e && e.kind === LISTING_KIND && e.pubkey === listingSeller(l) && Array.isArray(e.tags) && e.tags.some((t) => t[0] === "d" && t[1] === name(l))).sort((a, b) => b.created_at - a.created_at)[0];
      if (!newest) {
        unread.set(l, answered ? "not-found" : "no-relay");
        continue;
      }
      const read = readListing(newest, l);
      if (!read.ok) unread.set(l, read.why);
      // Where it says what it is for, that is this world. Sold for somewhere else, it isn't offered here.
      else if (read.listing.for && worldName && read.listing.for !== `${WORLD_KIND}:${read.listing.seller}:${worldName}`) unread.set(l, "not-for-here");
      else {
        offers.set(l, read.listing);
        unread.delete(l);
      }
    }
    changed();
    // What couldn't be had is asked for again, less and less often: a relay that was down comes back.
    clearTimeout(retryTimer);
    if ([...unread.values()].some((w) => w === "no-relay" || w === "not-found")) retryTimer = setTimeout(() => void readOffers(), Math.min(20_000 * 2 ** retries++, GATE_TIMES.look * 1000));
  };

  /** The keys whose lists count for one of this world's coordinates: its keepers, or by default that coordinate's own key. */
  const rootOf = (subject: string): string[] => lists?.root ?? [subject.split(":")[1]!];
  /** Whether a key is one whose lists count here: never kept out of, or uninvited to, its own world. */
  const isKeeper = (key: string): boolean => !!lists && lists.subjects.some((s) => rootOf(s).includes(key));
  /** Whether the world's owner keeps this key out. Never a keeper, in their own world. */
  const isBlocked = (key: string | null): boolean => !!lists && !!key && ownerBlocked.includes(key) && !isKeeper(key);
  /** Whether this key may go in, where the world is by invitation: a keeper, or named on the allow list as read. */
  const isInvited = (key: string): boolean => isKeeper(key) || (inviteState === "read" && invited.includes(key)) || (inviteState === "unanswered" && invited.includes(key));
  /** Choose one of the owner's lists from what relays gave and what this device remembered: who it names, and how it stands. */
  const chooseList = (scope: "user-deny" | "user-allow", events: readonly NostrEvent[], answered: boolean): { people: string[]; state: ListState } => {
    const kept = rememberedLists();
    const people = new Set<string>();
    let state: ListState = "not-found";
    let found = false;
    for (const subject of lists!.subjects) {
      const d = listD(scope, subject);
      const root = rootOf(subject);
      const all = [...events, ...(kept[d] ? [kept[d]] : [])];
      const r = resolveOwnerList(all, { scope, subject, root, now: sec() });
      // The newest copy is remembered, refused or not: an older one is never taken in its place.
      const newest = all
        .filter((e) => e && e.kind === LIST_KIND && root.includes(e.pubkey) && e.created_at <= sec() + OWNER_LIST_LIMITS.ahead && Array.isArray(e.tags) && e.tags.some((t) => t[0] === "d" && t[1] === d))
        .sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? -1 : 1))[0];
      if (newest && (!kept[d] || newest.created_at > kept[d]!.created_at || (newest.created_at === kept[d]!.created_at && newest.id < kept[d]!.id))) rememberList(d, newest);
      if (r.ok) {
        for (const key of r.entries) people.add(key);
        state = "read";
        found = true;
      } else if (r.reason !== "not_found" && !found) state = "unreadable";
    }
    // No relay answered: the remembered copy stands (its people are still read). Said, not hidden.
    return { people: [...people].sort(), state: answered ? state : "unanswered" };
  };
  /** Choose the owner's lists, and say who they name. */
  const applyLists = (events: readonly NostrEvent[], answered = true): void => {
    if (!lists) return;
    const blocks = chooseList("user-deny", events, answered);
    listState = blocks.state;
    let differs = blocks.people.join() !== ownerBlocked.join();
    ownerBlocked = blocks.people;
    if (byInvitation) {
      const invites = chooseList("user-allow", events, answered);
      differs ||= invites.people.join() !== invited.join() || invites.state !== inviteState;
      inviteState = invites.state;
      // A list that couldn't be read, or wasn't found, lets nobody in but a keeper.
      invited = invites.state === "read" || invites.state === "unanswered" ? invites.people : [];
    }
    if (differs) changed();
  };
  /** Read the owner's lists from relays: the exact `d`s, signed by the keys whose lists count. */
  const readLists = async (): Promise<void> => {
    if (!lists || disposed) return;
    const scopes: ("user-deny" | "user-allow")[] = byInvitation ? ["user-deny", "user-allow"] : ["user-deny"];
    const filter: Filter = { kinds: [LIST_KIND], authors: [...new Set(lists.subjects.flatMap(rootOf))], "#d": lists.subjects.flatMap((s) => scopes.map((scope) => listD(scope, s))) };
    const got = await askWell(filter, { own: ownRelays, usual: opts.relays ?? DEFAULT_RELAYS, ...(opts.query ? { query: opts.query } : {}), now }).catch(() => null);
    if (disposed) return;
    const answered = !!got && Object.values(got.relays).some((said) => said === "eose");
    applyLists(got?.events ?? [], answered);
    // Nobody answered: asked again soon, as what is for sale is, and looked at again with what comes.
    clearTimeout(listTimer);
    if (answered) listRetries = 0;
    else listTimer = setTimeout(() => void readLists().then(() => look()), Math.min(20_000 * 2 ** listRetries++, GATE_TIMES.look * 1000));
  };

  /** Read what this world is entered by, from its own site, and begin. */
  const begin = async (): Promise<void> => {
    let access: ReturnType<typeof accessFor> = null;
    let file: unknown = null;
    try {
      file = await (opts.manifest ?? (() => fetch("/.well-known/nswp.json", { cache: "no-cache", credentials: "omit" }).then((r) => (r.ok ? r.json() : null))))();
      const parsed = parseManifest(file);
      if (parsed.ok) {
        const worlds = Object.values(parsed.value.worlds);
        // The world at this address; or, on a copy served from another address (a development server), the one
        // world the file names. A file that names several, none of them here, says nothing of this page.
        access = accessFor(parsed.value, opts.url ?? `${location.origin}${location.pathname}`) ?? (worlds.length === 1 ? accessFor(parsed.value, worlds[0]!.entry.url) : null);
        ownRelays = parsed.value.relays;
      }
    } catch {
      access = null;
    }
    if (disposed) return;
    if (!access) {
      // Not known what this world is sold by, or who may sell it: shut, and read again shortly.
      set("shut", "no-manifest");
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void begin(), Math.min(15_000 * 2 ** retries++, GATE_TIMES.look * 1000));
      return;
    }
    retries = 0;
    worldName = access.d;
    namedOnly = access.namedOnly;
    takesGuests = access.guests;
    listings = cleanAccess(opts.listings ? [...opts.listings] : access.listings, access.sellers);
    // Whether it meant to be paid: it named something, here or in its own file, whether or not that held up.
    const named = (file as { worlds?: Record<string, { access?: unknown }> } | null)?.worlds?.[access.d]?.access;
    const meant = opts.listings ? opts.listings.length > 0 : Array.isArray(named) ? named.length > 0 : named !== undefined;
    paid = meant;
    byInvitation = access.byInvitation;
    // Whose lists count: the keepers its manifest names, or, for a world that is by invitation and names none, the
    // key that announced it. A world that says neither keeps no lists, and reads none.
    if ((access.keepers || byInvitation) && access.sellers.length) {
      lists = { root: access.keepers, subjects: access.sellers.map((key) => worldSubject(key, access.d)) };
      listState = "reading";
      if (byInvitation) inviteState = "reading";
    }
    // Its own site names nothing for sale and keeps no lists: a free world, as every world was. Nothing more is read or asked.
    if (!meant && !lists) return set("free", "");
    // It names something, and none of it is its own to sell: shut, since it meant to be paid.
    if (meant && listings.length === 0) return set("shut", "not-own");
    if (lists) {
      // With a copy remembered, the gate decides at once and the newest is read behind it. With none, it waits for relays.
      const remembered = lists.subjects.some((s) => rememberedLists()[listD("user-deny", s)] || (byInvitation && rememberedLists()[listD("user-allow", s)]));
      if (remembered) {
        applyLists([]);
        void readLists().then(() => look());
      } else await readLists();
      if (disposed) return;
    }
    if (meant) void readOffers();
    const signer = opts.signer();
    // A signer that remembers this world says so a moment after the page loads: nothing is decided before it has.
    if (signer) await signer.whenAnswered(4000).catch(() => undefined);
    if (disposed) return;
    if (signer && !unwatch) unwatch = signer.onChange(() => void look());
    lookTimer = setInterval(() => void (lists ? readLists().then(() => look()) : look()), GATE_TIMES.look * 1000);
    await look();
  };
  if (state !== "free") void begin();

  const offerList = (): GateOffer[] => listings.flatMap((l) => (offers.has(l) ? [{ listing: l, name: offers.get(l)!.name, sats: offers.get(l)!.sats, term: offers.get(l)!.term, words: priceWords(offers.get(l)!) }] : []));
  const host = (): string => opts.signer()?.host ?? "your sign-in address";
  const signedIn = (): boolean => opts.signer()?.state === "unlocked";
  const why = (): string => {
    if (state === "free" || state === "open" || state === "checking") return "";
    if (state === "ending") return "Your time here has run out. This part closes in two minutes. Buy again to stay.";
    if (reason === "no-manifest") return "This world couldn't read its own list of what it is sold by, so the way stays shut. It is being read again.";
    if (reason === "not-own") return "What this world says it is sold by isn't its own to sell, so nothing here can be bought. That is the world's to put right.";
    if (reason === "blocked") return "The owner of this world has asked you not to come in.";
    if (reason === "not-invited") {
      if (inviteState === "not-found") return "This world is by invitation, and its owner's list of who is invited wasn't found. Only its owner may go in until it is.";
      if (inviteState === "unreadable") return "This world is by invitation, and its owner's list of who is invited doesn't read, so only its owner may go in.";
      if (inviteState === "unanswered" && !invited.length) return "This world is by invitation, and its owner's list of who is invited couldn't be read just now. It is being asked for again.";
      return "This world is by invitation, and its owner hasn't invited you.";
    }
    if (byInvitation && (reason === "signed-out" || reason === "no-signer") && !paid) return reason === "signed-out" ? "This world is by invitation. Sign in, so it can see whether you are invited." : "This world is by invitation, and sign-in is done at a sign-in address: this world was given none for you.";
    const list = offerList();
    const firstUnread = [...unread.values()][0];
    const sale = list.length ? `Past here is for people who have bought it: ${list.map((o) => `${o.name}, ${o.words}`).join("; or ")}.` : `Past here is for people who have bought it. ${firstUnread ? unreadWords(firstUnread) : "What it costs is being read."}`;
    if (reason === "no-signer") return `${sale} Buying is done at a sign-in address, and this world was given none for you.`;
    if (reason === "signed-out") return `${sale} Sign in to buy, or to show what you already hold.`;
    if (reason === "taken-back") return `The pass you held was taken back by the service that sold it. ${sale}`;
    if (reason === "unchecked") return "The service that sold your pass couldn't be asked whether it still stands, and it was last checked more than a day ago. The way opens when it answers.";
    if (reason === "run-out") return `Your time here has run out. ${sale}`;
    return sale;
  };

  return {
    get state() {
      return state;
    },
    get open() {
      return state === "free" || state === "open" || state === "ending";
    },
    get reason() {
      return reason;
    },
    get why() {
      return why();
    },
    get offers() {
      return offerList();
    },
    get read() {
      // A world that sells nothing has no price to wait for before it speaks.
      return !paid || offers.size > 0 || unread.size > 0;
    },
    get until() {
      return state === "open" && held ? held.expiresAt : null;
    },
    get signedIn() {
      return signedIn();
    },
    get ownerBlocked() {
      return ownerBlocked;
    },
    get namedOnly() {
      return namedOnly;
    },
    get takesGuests() {
      return takesGuests;
    },
    get lists() {
      return listState;
    },
    get byInvitation() {
      return byInvitation;
    },
    get invites() {
      return inviteState;
    },
    get invited() {
      return byInvitation && lists ? [...new Set([...invited, ...lists.subjects.flatMap(rootOf)])].sort() : null;
    },
    get host() {
      return host();
    },
    get buying() {
      return buying;
    },
    get keeper() {
      const signer = opts.signer();
      return signer && signer.state === "unlocked" && signer.pubkey && isKeeper(signer.pubkey) ? signer.pubkey : null;
    },
    get guests() {
      return byInvitation ? [...invited] : null;
    },
    async changeList(change, key) {
      const signer = opts.signer();
      const me = signer?.state === "unlocked" ? signer.pubkey : null;
      if (disposed || !lists || !signer || !me || !isKeeper(me)) return { ok: false, said: "Only one of this world's keepers, signed in here, can change who comes in." };
      if (!isHex64(key)) return { ok: false, said: "That isn't someone's key." };
      if (isKeeper(key)) return { ok: false, said: "That's one of this world's keepers: always let in, and never kept out." };
      const scope = scopeOfChange(change);
      if (scope === "user-allow" && !byInvitation) return { ok: false, said: "This world isn't by invitation, so there is no list of who is let in." };
      if (changing) return { ok: false, said: "One change at a time: the last is still with your sign-in address." };
      // The list of the coordinate whose keepers include them: the first such, which is the world's own entry.
      const subject = lists.subjects.find((s) => rootOf(s).includes(me))!;
      const d = listD(scope, subject);
      const found = rememberedLists()[d] ?? null;
      let none = false;
      if (!found) {
        const standing = scope === "user-deny" ? listState : inviteState;
        if (standing === "reading" || standing === "unanswered") return { ok: false, said: "The list couldn't be read just now, so it isn't changed: one started now could wipe a list a relay is holding. Try again in a moment." };
        const what = `${change} ${key}`;
        if (!starting || starting.what !== what || sec() - starting.at > 60) {
          starting = { what, at: sec() };
          return { ok: false, again: true, said: `No ${scope === "user-allow" ? "guest" : "block"} list for this world was found. Press again to start one, naming only them.` };
        }
        none = true;
      }
      starting = null;
      changing = true;
      changed();
      const signed = await signer.guests({ world: subject, list: found, change, key, ...(none ? { none: true } : {}) }).catch(() => null);
      changing = false;
      // Checked here too, whatever signer the gate was given: exactly that list with that one change, by this keeper.
      if (!signed || disposed || !isOwnerListAsked(signed, { list: found, subject, change, key, pubkey: me })) {
        changed();
        return { ok: false, said: "Nothing changed: your sign-in window said no, or can't change this world's list yet." };
      }
      // Taken here at once: the gate and the room act on it without waiting for a relay to give it back.
      rememberList(d, signed);
      applyLists([signed]);
      void look();
      const sent = await sendWell(signed, { own: ownRelays, usual: opts.relays ?? DEFAULT_RELAYS, ...(opts.publish ? { publish: opts.publish } : {}), ...(opts.query ? { query: opts.query } : {}), now }).catch(() => null);
      const done = change === "allow" ? "Invited." : change === "unallow" ? "Taken off the list." : change === "block" ? "Kept out." : "No longer kept out.";
      if (!sent || sent.took === 0) return { ok: true, said: `${done} It holds here, but no relay took the list yet, so nobody else sees the change.` };
      return { ok: true, said: `${done} Anyone can read this list.` };
    },
    async buy(listing) {
      const wanted = cleanListing(listing ?? offerList()[0]?.listing ?? "");
      const signer = opts.signer();
      // Only what was read and shown is bought from here, by someone signed in, one purchase at a time.
      if (disposed || buying || !wanted || !offers.has(wanted) || !signer || signer.state !== "unlocked") return false;
      // Nobody the owner blocked is sold their way in.
      if (state === "free" || state === "open" || reason === "blocked" || isBlocked(signer.pubkey)) return false;
      buying = true;
      changed();
      const got = await signer.buy(wanted).catch(() => null);
      buying = false;
      // The word "bought" is not believed: the receipt is, checked again here.
      const receipt = got ? believe(got.event, wanted, opts.signer()?.state === "unlocked" ? opts.signer()!.pubkey : null) : null;
      if (!receipt || disposed) {
        changed();
        return false;
      }
      // Blocked while the purchase was with them: still kept out.
      if (isBlocked(receipt.buyer)) {
        shut("blocked");
        return false;
      }
      // Signed this moment by the service itself: found good now.
      keepGood(receipt.fulfillment, now());
      asked.set(receipt.fulfillment, now());
      round++;
      openUp(receipt);
      return true;
    },
    async check() {
      if (state === "free" || disposed) return;
      if (reason === "no-manifest") return begin();
      retries = 0;
      await Promise.all([readOffers(), readLists()]);
      await look();
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
    info() {
      return { state, open: state === "free" || state === "open" || state === "ending", reason, why: why(), offers: offerList(), unread: Object.fromEntries(unread), until: state === "open" && held ? held.expiresAt : null, endsAt: endsAt ? Math.round(endsAt / 1000) : null, signedIn: signedIn(), buying, listings: [...listings], lists: listState, changing, ownerBlocked: ownerBlocked.length, namedOnly, takesGuests, byInvitation, invites: inviteState, invited: invited.length };
    },
    dispose() {
      disposed = true;
      clearTimeout(endTimer);
      clearTimeout(graceTimer);
      clearTimeout(retryTimer);
      clearTimeout(seekTimer);
      clearTimeout(listTimer);
      clearInterval(lookTimer);
      unwatch?.();
      watchers.clear();
    },
  };
}

/**
 * The gate's control, in the visitor's console: one row for each thing that can be bought, saying its name, its
 * price and how long it lasts, and calling `signer.buy` at the visitor's press. It is there only while the gate is
 * shut (or about to be), and comes after the things every place has, so the way home keeps the first key.
 *
 * Someone who isn't signed in is offered sign-in by the same row, the way the kit already does it. In a headset,
 * where a sign-in address's own page can't be seen, it says to step out, as a tip does.
 */
export function addGateControls(
  controls: Controls,
  gate: PaidGate,
  opts: {
    /** Whether the visitor is in a headset: a page that asks them can't be seen from in there. */
    presenting?: () => boolean;
    /** Which tab the rows go in. Left out, Travel: the gate is a door. */
    section?: string;
    /** What starts signing in, from a press. Left out, the kit's own sign-in row. False if nothing could be started. */
    signIn?: () => boolean;
    /** The owner's screen: who is here now, by their keys (those whose pass checked out), to offer a keeper. */
    here?: () => readonly string[];
    /** The owner's screen: who the visitor follows, by their keys, or null where that isn't known (`worldPeople().follows`). */
    follows?: () => readonly string[] | null;
    /** For tests: what reads what the visitor copied. Left out, the browser's clipboard. */
    copied?: () => Promise<string>;
  } = {},
): { refresh(): void; press(listing?: string): void } {
  const section = opts.section ?? "travel";
  const signIn = opts.signIn ?? (() => controls.run("signer"));
  /** Which state its words were last said for: they are said once as each comes to be so. */
  let saidFor = "";

  const press = (listing?: string): void => {
    const offer = gate.offers.find((o) => o.listing === listing) ?? gate.offers[0];
    if (!gate.signedIn) {
      // Signing in is their own sign-in address's to do: this only starts it, as the row under You does.
      if (!signIn()) controls.say("No sign-in address answered here, so nothing can be bought just now. Reload the page to try again.");
      return;
    }
    if (!offer) {
      controls.say("Asking again what this costs.");
      return void gate.check();
    }
    // A headset draws nothing but the world, so the page that asks them can't be seen from in one.
    if (opts.presenting?.()) return controls.say(`${gate.host} has to ask you this itself, which can't be seen from in here. Step out of the headset and press this again.`);
    if (gate.buying) return controls.say(`${gate.host} is still asking. Answer there.`);
    controls.say(`${gate.host} is asking: ${offer.name}, ${offer.words}. Say yes there, and the way opens.`);
    void gate.buy(offer.listing).then((bought) => {
      if (bought) controls.say(`Bought: ${offer.name}. The way is open ${untilWords(gate.until)}.`);
      else controls.say("That didn't finish, and the way is still shut. If you did pay, press Buy again: it finds what you paid for and charges nothing more.");
    });
  };

  // Whether there is anything to press: shut, or about to be, for a reason a press could help with.
  const showing = (): boolean => (gate.state === "shut" || gate.state === "ending") && gate.reason !== "no-manifest" && gate.reason !== "not-own" && gate.reason !== "no-signer" && gate.reason !== "blocked" && gate.reason !== "not-invited";
  // One row for each thing a world may sell, there only while it has that thing to offer. They are added once, so
  // they keep their place: ahead of whatever the world adds after them, behind the things every place has.
  for (let i = 0; i < ACCESS_MOST; i++) {
    const offer = (): GateOffer | undefined => gate.offers[i];
    controls.add({
      id: i === 0 ? "gate-buy" : `gate-buy-${i + 1}`,
      section,
      icon: "key",
      tone: "primary",
      hotbar: i === 0,
      short: () => (gate.signedIn ? "Buy" : "Sign in"),
      // With nothing that could be read, the first row is still a way to sign in and show what is held, or to ask again.
      label: () => {
        const o = offer();
        if (o) return `${gate.signedIn ? "Buy" : "Sign in to buy"} ${o.name}: ${o.words}`;
        if (gate.byInvitation && !gate.signedIn) return "Sign in, to show you are invited";
        return gate.signedIn ? "Ask again what this costs" : "Sign in, to show what you hold";
      },
      hidden: () => !showing() || (!offer() && (i > 0 || gate.offers.length > 0)),
      act: () => press(offer()?.listing),
    });
  }

  const refresh = (): void => {
    // Said once as it comes to be so: why the way is shut, or that their time has run out. An open gate says
    // nothing, and nothing is said of a price before it has been read.
    const closed = gate.state === "shut" || gate.state === "ending";
    if (!closed) saidFor = "";
    else if (saidFor !== gate.state && (gate.state === "ending" || gate.read || !showing())) {
      saidFor = gate.state;
      controls.say(gate.why);
    }
    // The rows' words follow the gate: whatever draws the console is told to look again.
    controls.signal("gate");
  };
  gate.onChange(refresh);
  refresh();
  addOwnersScreen(controls, gate, opts);
  return { refresh, press };
}

/** The most people the owner's screen offers at once: the lists' own first, then who is here, who they follow, who they copied. */
const SCREEN_MOST = 40;

/**
 * The owner's screen, "Who comes in" (protocol/10-identity.md, "The owner's screen"; docs/plans/a-world-by-invitation.md
 * §4), in the console of a keeper signed in here and nobody else's. Who the lists name, as read; and for the people on
 * them, the people here now, the people they follow and someone whose key they copied: let in or take off the guest list
 * (a world by invitation), block or unblock. Each is one change, asked on their sign-in address's own page every time.
 * In a headset that page can't be seen, so the rows say to step out, as buying does.
 */
function addOwnersScreen(controls: Controls, gate: PaidGate, opts: { presenting?: () => boolean; here?: () => readonly string[]; follows?: () => readonly string[] | null; copied?: () => Promise<string> }): void {
  let profiles: Profiles | null = null;
  const nameOf = (key: string): string => profiles?.get(key)?.name || shortNpub(key);
  const typed: string[] = [];
  const rows = new Set<string>();
  const inHeadset = (): boolean => !!opts.presenting?.();
  const stepOut = "Take the headset off to change who comes in: your sign-in window can't be shown in here.";

  controls.addSection({
    id: "guests",
    label: "Who comes in",
    icon: "people",
    note: () => {
      if (!gate.keeper) return "";
      const lists: string[] = [];
      if (gate.byInvitation) lists.push(gate.invites === "read" ? `${count(gate.guests?.length ?? 0, "person", "people")} invited` : gate.invites === "not-found" ? "nobody invited yet" : "who is invited couldn't be read just now");
      lists.push(gate.lists === "read" || gate.lists === "not-found" ? `${count(gate.ownerBlocked.length, "person", "people")} kept out` : "who is kept out couldn't be read just now");
      return `Anyone can read this list. ${capital(lists.join(", "))}.${inHeadset() ? ` ${stepOut}` : ""}`;
    },
  });

  /** The keys the lists themselves name. */
  const listed = (): string[] => [...(gate.guests ?? []), ...gate.ownerBlocked];
  const isGuest = (key: string): boolean => (gate.guests ?? []).includes(key);

  const change = (key: string, what: OwnerListChange): void => {
    if (inHeadset()) return controls.say(stepOut);
    const name = nameOf(key);
    const asking = what === "allow" ? `let ${name} in` : what === "unallow" ? `take ${name} off the list` : what === "block" ? `block ${name}` : `unblock ${name}`;
    controls.say(`${gate.host || "Your sign-in address"} is asking you to ${asking}. Say yes there.`);
    void gate.changeList(what, key).then((r) => {
      controls.say(r.ok ? `${name}: ${r.said}` : r.said);
      refresh();
    });
  };

  /** The people to offer, in order, each once: on a list, here now, followed, copied. Never the keeper themselves. */
  const people = (): string[] => {
    if (!gate.keeper) return [];
    const me = gate.keeper;
    const all = [...listed(), ...(opts.here?.() ?? []), ...(opts.follows?.() ?? []), ...typed];
    return [...new Set(all)].filter((k) => isHex64(k) && k !== me).slice(0, SCREEN_MOST);
  };

  const addRows = (key: string): void => {
    controls.add(
      {
        id: `guests-allow-${key}`,
        section: "guests",
        icon: "door",
        hidden: () => !gate.keeper || !gate.byInvitation,
        label: () => (isGuest(key) ? `${nameOf(key)}: invited. Take them off the list` : `Let ${nameOf(key)} in`),
        short: () => (isGuest(key) ? "Take off" : "Let in"),
        act: () => change(key, isGuest(key) ? "unallow" : "allow"),
      },
      {
        id: `guests-block-${key}`,
        section: "guests",
        icon: "exit",
        tone: "warn",
        hidden: () => !gate.keeper,
        label: () => (gate.ownerBlocked.includes(key) ? `${nameOf(key)}: kept out. Unblock them` : `Block ${nameOf(key)}`),
        short: () => (gate.ownerBlocked.includes(key) ? "Unblock" : "Block"),
        act: () => change(key, gate.ownerBlocked.includes(key) ? "unblock" : "block"),
      },
    );
  };

  // Someone not here and not followed: by the key they copied (an npub, or 64 hex).
  controls.add({
    id: "guests-copied",
    section: "guests",
    icon: "you",
    hidden: () => !gate.keeper,
    // A row typed into: the key is pasted or typed in the menu's own box and taken at the press. So it works in a
    // world shown in its client's frame, which a browser never lets read what was copied. Where the menu has no box
    // (a headset's console draws the row as a button), what was copied is read, as before.
    kind: "field",
    label: "Add someone by key (npub1…)",
    short: "By key",
    act: async (given) => {
      let text = given ?? "";
      if (given === undefined) {
        try {
          text = await (opts.copied ? opts.copied() : navigator.clipboard.readText());
        } catch {
          return controls.say(copiedRefused("Copy someone's key (npub1…)"));
        }
      }
      const key = keyIn(text);
      if (!key) return controls.say("That isn't someone's key. Copy their npub1… and press again.");
      if (key === gate.keeper) return controls.say("That's your own key: you are always let in.");
      typed.unshift(key);
      refresh();
      controls.say(`${nameOf(key)} is in the list below: let them in, or block them.`);
    },
  });

  const refresh = (): void => {
    const now = people();
    if (now.length && !profiles) {
      profiles = createProfiles();
      profiles.onChange(() => controls.signal("gate"));
    }
    if (now.length) void profiles?.fetch(now);
    for (const key of [...rows]) {
      if (now.includes(key)) continue;
      controls.remove(`guests-allow-${key}`);
      controls.remove(`guests-block-${key}`);
      rows.delete(key);
    }
    for (const key of now) {
      if (rows.has(key)) continue;
      addRows(key);
      rows.add(key);
    }
  };
  gate.onChange(refresh);
  refresh();
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
