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
import { accessFor, cleanAccess, cleanListing, DEFAULT_RELAYS, LISTING_KIND, listingSeller, parseManifest, priceWords, readListing, readReceipt, WORLD_KIND, type Filter, type Listing, type ListingRefusal, type NostrEvent, type QueryResult, type Receipt } from "@nswp/core";
import { askWell } from "./relay-book.js";
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
export type GateReason = "" | "no-manifest" | "not-own" | "no-signer" | "signed-out" | "nothing-held" | "run-out" | "taken-back" | "unchecked";

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
export type GateSigner = Pick<WorldSigner, "state" | "pubkey" | "host" | "have" | "buy" | "onChange" | "whenAnswered">;

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
  /** When the pass that holds it open stops, in seconds, or null: it doesn't, or nothing is held. */
  readonly until: number | null;
  /** Whether the visitor is signed in here: buying needs it. */
  readonly signedIn: boolean;
  /** The visitor's sign-in address, as a host to name in words. */
  readonly host: string;
  /** A purchase is with the visitor now, at their sign-in address. */
  readonly buying: boolean;
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
  let disposed = false;
  let round = 0;
  let endTimer: ReturnType<typeof setTimeout> | undefined;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let lookTimer: ReturnType<typeof setInterval> | undefined;
  let retries = 0;
  let unwatch: (() => void) | null = null;

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
    const buyer = signer?.state === "unlocked" ? signer.pubkey : null;
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
    listings = cleanAccess(opts.listings ? [...opts.listings] : access.listings, access.sellers);
    // Whether it meant to be paid: it named something, here or in its own file, whether or not that held up.
    const named = (file as { worlds?: Record<string, { access?: unknown }> } | null)?.worlds?.[access.d]?.access;
    const meant = opts.listings ? opts.listings.length > 0 : Array.isArray(named) ? named.length > 0 : named !== undefined;
    // Its own site names nothing: a free world, as every world was. Nothing more is read or asked.
    if (!meant) return set("free", "");
    // It names something, and none of it is its own to sell: shut, since it meant to be paid.
    if (listings.length === 0) return set("shut", "not-own");
    void readOffers();
    const signer = opts.signer();
    // A signer that remembers this world says so a moment after the page loads: nothing is decided before it has.
    if (signer) await signer.whenAnswered(4000).catch(() => undefined);
    if (disposed) return;
    unwatch = signer?.onChange(() => void look()) ?? null;
    lookTimer = setInterval(() => void look(), GATE_TIMES.look * 1000);
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
    get until() {
      return state === "open" && held ? held.expiresAt : null;
    },
    get signedIn() {
      return signedIn();
    },
    get host() {
      return host();
    },
    get buying() {
      return buying;
    },
    async buy(listing) {
      const wanted = cleanListing(listing ?? offerList()[0]?.listing ?? "");
      const signer = opts.signer();
      // Only what was read and shown is bought from here, by someone signed in, one purchase at a time.
      if (disposed || buying || !wanted || !offers.has(wanted) || !signer || signer.state !== "unlocked") return false;
      if (state === "free" || state === "open") return false;
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
      await Promise.all([readOffers(), look()]);
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
    info() {
      return { state, open: state === "free" || state === "open" || state === "ending", reason, why: why(), offers: offerList(), unread: Object.fromEntries(unread), until: state === "open" && held ? held.expiresAt : null, endsAt: endsAt ? Math.round(endsAt / 1000) : null, signedIn: signedIn(), buying, listings: [...listings] };
    },
    dispose() {
      disposed = true;
      clearTimeout(endTimer);
      clearTimeout(graceTimer);
      clearTimeout(retryTimer);
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
  } = {},
): { refresh(): void; press(listing?: string): void } {
  const section = opts.section ?? "travel";
  const signIn = opts.signIn ?? (() => controls.run("signer"));
  let rows: string[] = [];
  let was: GateState = gate.state;
  let said = "";

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

  const refresh = (): void => {
    for (const id of rows) controls.remove(id);
    rows = [];
    const showing = gate.state === "shut" || gate.state === "ending";
    if (showing && gate.reason !== "no-manifest" && gate.reason !== "not-own" && gate.reason !== "no-signer") {
      const offers = gate.offers;
      const add = (id: string, label: string, listing?: string): void => {
        rows.push(id);
        controls.add({ id, section, icon: "key", tone: "primary", hotbar: id === "gate-buy", short: gate.signedIn ? "Buy" : "Sign in", label, act: () => press(listing) });
      };
      offers.forEach((o, i) => add(i === 0 ? "gate-buy" : `gate-buy-${i + 1}`, `${gate.signedIn ? "Buy" : "Sign in to buy"} ${o.name}: ${o.words}`, o.listing));
      // Nothing that could be read: still a way to sign in and show what is held, or to ask again.
      if (!offers.length) add("gate-buy", gate.signedIn ? "Ask again what this costs" : "Sign in, to show what you hold");
    }
    // Said once as it comes to be so: why the way is shut, or that their time has run out. An open gate says nothing.
    const words = gate.state === "shut" || gate.state === "ending" ? gate.why : "";
    if (words && words !== said && (gate.state !== was || !said)) controls.say(words);
    said = words;
    was = gate.state;
  };
  gate.onChange(refresh);
  refresh();
  return { refresh, press };
}
