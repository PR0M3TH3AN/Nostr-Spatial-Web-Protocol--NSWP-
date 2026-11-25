/**
 * Signing from inside a world (protocol/10-identity.md, "Signing from a
 * world").
 *
 * A world never holds its visitor's key. It embeds a hidden signer served
 * by the visitor's own client, and asks it. This is the world's side of
 * that: the embed, the question, and the check on what comes back.
 *
 *   const signer = worldSigner();
 *   signer.unlock();                                   // from a press: opens the client's own window
 *   const note = await signer.sign({ kind: 1, content: "Hello" });   // null if locked or refused
 *
 * What a world can learn from it: whether it is unlocked, and then whose key
 * it holds. What it can never get: the key, a password, or a reason for a
 * refusal. Nothing is asked of the visitor here. The window that unlocks it
 * is the client's own page, which this page can't read.
 */
import { askClientForSignIn, clientSignsInAt } from "./client-frame.js";
import { checkDestination, isListSubject, isOwnerListAsked, type OwnerListChange, isAchievementAsked, cleanFileBytes, cleanFileName, cleanFileType, cleanInvoice, cleanListing, cleanMessage, cleanTip, readReceipt, type Receipt, fileUrlNames, cleanMore, cleanWalletUri, PROPOSE_KINDS, provesPayment, cleanOrigin, cleanSlot, fitsInSave, isFollowAsked, isHex64, isReachAsked, isScoreAsked, isSealAsked, looksLikeWrap, isWhatWasAsked, looksLikeSave, readSignerReply, signerAddresses, signerAt, signerMessage, toLocal, verifyEvent, verifyRoomPass, WORLD_TAG, type NostrEvent, type Message, type SealedMessage, type SignerMore, type SignerReply, type SignerRequest } from "@nswp/core";

/** "none": the visitor has no client here that offers one. "locked": there is one, and it hasn't been unlocked for this world. */
export type SignerState = "none" | "locked" | "unlocked";

export interface WorldSigner {
  readonly state: SignerState;
  /** Whose key it holds, once unlocked. */
  readonly pubkey: string | null;
  /** What the client calls them, once unlocked, or null. Their own choice of name, not a fact. */
  readonly name: string | null;
  /** Where their picture is, as their sign-in address read it from their own profile, or null. For their own card. */
  readonly picture: string | null;
  /** What they wrote about themselves there, or null. Their own words. */
  readonly about: string | null;
  /**
   * Whether the signer will still be unlocked for this world the next time its page is loaded: true, false, or
   * null where it is locked or doesn't say. False means this visit only: the visitor is asked again next time.
   */
  readonly remembered: boolean | null;
  /**
   * Whether the signer took this world's whole family at the sign-in (BitLogin's `family`): true, so one sign-in
   * carries to every world under its registrable domain; false, not taken; null where it was not asked (no domain
   * of its own, or not https) or the signer says nothing of it, which is "not offered".
   */
  readonly family: boolean | null;
  /**
   * Whether who it is unlocked as is a guest account the signer made for the family (BitLogin's `guest`), not yet
   * secured: true; false, an account; null where it is locked or says nothing of it. A guest has a key of its own,
   * the same in every world of the family, and may do less (no wallet, no messages; protocol/10-identity.md).
   */
  readonly guest: boolean | null;
  /** The visitor's client, as a host to name in words, or null. */
  readonly host: string | null;
  /**
   * What the visitor let this world do beyond a note and a reaction (protocol/10-identity.md, "Asking for more"):
   * "follows", or nothing. Empty while it is locked, and from a signer that offers none of it.
   */
  readonly more: readonly SignerMore[];
  /**
   * What this signer can be asked for at all, as it says ("Asking for more"), or null where it doesn't say. A
   * name that is missing has no question in its window: asking would open a window that says nothing of it.
   */
  readonly offers: readonly SignerMore[] | null;
  /**
   * True when a signer was named for this visitor (in the arrival, or
   * outright) and has had time to answer, and hasn't: it couldn't be
   * loaded, or the browser kept it out. Then there is something to say.
   */
  readonly unanswered: boolean;
  /** True while it is being asked again because the visitor pressed for it (`retry`), and hasn't answered yet. */
  readonly asking: boolean;
  /**
   * Where the signer is being asked for on this page, when that is a
   * development server's copy and not the real address: something to name
   * when it didn't answer. Null on a real site.
   */
  readonly copy: string | null;
  /**
   * Open the client's window, where the visitor unlocks it for this world.
   * Call it from a press: a browser opens a window for nothing else. False
   * if there is no signer, or no window could be opened. Where this world
   * is shown inside a client that draws the sign-in address's own panel
   * over it (`panel`), that is asked for instead, and no window opens.
   */
  unlock(): boolean;
  /**
   * Sign in from the visitor's phone, for a headset (BitLogin's "Way 1"): its own page, `<sign-in address>/headset/`,
   * opened as a window of its own from the visitor's press, never the client's panel, whose address bar would be the
   * world's. It finds this signer through its opener, so no "noopener". `opened`: whether the window opened (false:
   * the browser refused, or nobody can sign in here). `done`: once it has closed, the signer is asked how it stands,
   * once, and this says whether they are signed in now. Closed without pairing, they are as they were.
   */
  signInFromPhone(): { opened: boolean; done: Promise<boolean> };
  /**
   * Put a note of a careful kind to the visitor themselves: their profile
   * (0), a deletion (5) or their relay list (10002). The signer signs none
   * of these on a world's word: the sign-in address shows the visitor what
   * it is, in words, on its own page (its panel in a client that has one,
   * else its window), and signs it only at their press there. Call it from
   * a press. Resolves with the signed note, checked, or null: they said no,
   * closed it, took longer than five minutes, or the signer doesn't do this.
   */
  propose(note: { kind: number; content: string; tags?: string[][] }): Promise<NostrEvent | null>;
  /**
   * Ask the visitor for a wallet connection for this world, the same way.
   * Call it from a press. Resolves with a Nostr Wallet Connect address
   * this world may spend with, within what the wallet allows, or null.
   */
  wallet(): Promise<string | null>;
  /**
   * Ask the visitor to pay a Lightning invoice this world made, the same
   * way: their sign-in address shows them the amount and pays at their
   * press. Call it from a press. Resolves null if they didn't pay; else
   * with the payment's `preimage` where their wallet was given one, and
   * `proven`: whether that preimage really is this invoice's proof. A
   * world that hands over something of value should go by `proven`, or
   * by its own word from whoever it made the invoice with: "paid" with
   * no proof is the sign-in address's say-so and nothing more. The world
   * learns nothing else: no balance, no wallet, never a token.
   */
  pay(invoice: string): Promise<{ preimage: string | null; proven: boolean } | null>;
  /**
   * Offer the visitor a file to keep among their own files, kept by their
   * sign-in address on servers they chose. Their sign-in address shows them
   * where it would go (a folder of this world's, unless they choose
   * another) and saves it only at their press there. `private`, the
   * default, is sealed so that only they can read it. Call it from a
   * press. Resolves null if they didn't save it; else with the name they
   * saved it under, its size, whether privately, and `url`: where it is
   * kept, only for a public file, and only if that address really names
   * these bytes. A world can't list their files or read this one back: it
   * asks for it with `pickFile`. At most 25 MB.
   */
  saveFile(file: { name: string; type?: string; bytes: Uint8Array | ArrayBuffer; private?: boolean }): Promise<{ name: string; size: number; private: boolean; url: string | null } | null>;
  /**
   * Ask the visitor to hand this world one of their files: they browse
   * their own files on their sign-in address's page, choose one, and say
   * yes. Call it from a press. Resolves with the file (already opened, if
   * it was private), or null. What comes back is a stranger's file as far
   * as the world's code is concerned: show it, never run it.
   */
  pickFile(): Promise<{ name: string; type: string; bytes: Uint8Array; url: string | null } | null>;
  /**
   * Ask the visitor to tip someone: a person, by their key, or (with no
   * `to`) this world itself. The world says who and how much and nothing
   * else: their sign-in address finds where the money goes (the person's
   * own profile, or this world's own `/.well-known/nswp.json`), shows it,
   * and pays at their press. Call it from a press. Resolves true if it
   * was paid, false if not; never why not. Nothing is owned afterwards.
   */
  tip(o: { to?: string; sats: number }): Promise<boolean>;
  /**
   * Ask the visitor to buy a listing (`30078:<seller>:<name>`). Their
   * sign-in address reads the listing, shows what it is, whose, and what
   * it costs, pays, and keeps the receipt. Call it from a press. Resolves
   * null if they didn't buy; else with the receipt, checked here as well:
   * really signed by a selling service the kit knows, for this listing,
   * and theirs. `delivery` is what the purchase released, where the
   * listing releases something. Something already held costs nothing.
   */
  buy(listing: string): Promise<(Receipt & { event: NostrEvent; delivery: string | null }) | null>;
  /**
   * Whether the visitor already holds this listing, with no question put
   * to them. Null if they don't, or if this world may not be told: a
   * world is told only of its own listings and of things bought through
   * it. A world loaded again may hear "none" for something held until
   * their sign-in address has next been shown here; `buy` then brings it
   * back and charges nothing. Checked here like any receipt. It can't say
   * whether the receipt was taken back: only the selling service can.
   */
  have(listing: string): Promise<(Receipt & { event: NostrEvent }) | null>;
  /**
   * Whether `unlock()` shows a panel in the visitor's client rather than a
   * window: this world is in the frame of a client that has one, for this
   * signer's own address (client-frame.ts). Something to choose words by.
   */
  readonly panel: boolean;
  /**
   * Load the signer again and ask it once more: for one that was named and said nothing. False if there is nothing
   * to ask again (none was named, or it has answered).
   */
  retry(): boolean;
  /** Lock it again for this world. The visitor's own doing, from the world's menu. */
  lock(): void;
  /** Ask for a note to be signed. Null if it is locked, or it refused, or what came back wasn't what was asked. */
  sign(note: { kind: number; content: string; tags?: string[][] }): Promise<NostrEvent | null>;
  /**
   * Ask for a room pass for this world, for the session key whose public key is given
   * (protocol/10-identity.md, "A pass from the signer"). Null if it is locked, or it refused, or it is a signer
   * that makes none, or what came back isn't a pass by the key it holds, for this site and that session.
   */
  pass(session: string): Promise<NostrEvent | null>;
  /**
   * Ask for something to be kept for this world, in a slot (protocol/12-saves.md). What comes back is a signed
   * save that only the visitor can read: this page sends it to their relays. Null if it is locked, or it
   * refused, or it is a signer that keeps nothing, or what came back isn't a save by the key it holds.
   */
  save(slot: string, data: string): Promise<NostrEvent | null>;
  /** Where this world's save in a slot is kept: the `d` to ask a relay for. Null as for `save`. */
  find(slot: string): Promise<string | null>;
  /** Have a save opened. Null if it isn't this world's, or isn't theirs, or as for `save`. */
  open(event: NostrEvent): Promise<{ slot: string; data: string; at: number } | null>;
  /**
   * Say what this world would like to be let do. It approves nothing: the signer remembers it for its own window,
   * so call `unlock()` after it, from the same press, for the visitor to be shown it. False where there is no
   * signer to tell.
   */
  want(more: readonly SignerMore[]): boolean;
  /**
   * Follow or unfollow one person, for a visitor who let this world do so (protocol/14-people-and-messages.md).
   * `list` is the newest follow list of theirs that could be found, or null where they have said they follow
   * nobody yet. What comes back is their new list, signed, for this page to send to their relays. Null if it is
   * locked, or they haven't allowed it, or it refused, or what came back isn't that list with that one change.
   */
  follow(list: NostrEvent | null, change: { add: string } | { remove: string }): Promise<NostrEvent | null>;
  /**
   * Change one person on this world's own lists, for a visitor who is one of its keepers (protocol/10-identity.md,
   * "The owner's screen"). Asked on the sign-in address's own page every time: no standing permission is needed or
   * granted. `list` is the newest list of theirs for `world` and that change found, or null with `none` true where
   * it was looked for and there is none. What comes back is the new list, signed, for this page to send to relays:
   * null if it is locked, or refused, or what came back isn't exactly that list with that one change.
   */
  guests(o: { world: string; list: NostrEvent | null; change: OwnerListChange; key: string; none?: boolean }): Promise<NostrEvent | null>;
  /**
   * Have a private message written and sealed, for a visitor who let this world send them
   * (protocol/14-people-and-messages.md). What comes back is the message and its two seals: one for its reader,
   * one for the visitor to read back. This page wraps each and sends it. Null if it is locked, or they haven't
   * allowed it, or it refused, or what came back isn't that message, sealed by the key it holds.
   */
  seal(to: string, text: string): Promise<SealedMessage | null>;
  /** Have a wrapped message opened: one a relay gave this page, sent to the visitor. Null as for `seal`, or if it isn't a message for them. */
  unwrap(wrap: NostrEvent): Promise<Message | null>;
  /** Have the list of where their private messages reach them signed. Null as for `seal`. */
  reach(relays: readonly string[]): Promise<NostrEvent | null>;
  /**
   * Have the visitor's score signed (protocol/15-scores.md): for this world, on one of its boards. Any world its
   * visitor has unlocked may ask; a score is public, so ask only when the visitor has said to post it. What
   * comes back is for this page to send to relays. Null if it is locked, or it refused, or it is a signer that
   * signs no scores, or what came back isn't that score, by the key it holds, marked for this site.
   */
  score(world: string, board: string, score: number, said?: { title?: string; format?: "number" | "time" }): Promise<NostrEvent | null>;
  /**
   * Have it signed that the visitor holds one of this world's achievements (protocol/16-achievements.md). Any
   * world its visitor has unlocked may ask; it is public, so ask only when the visitor has said to show it. Null
   * as for `score`.
   */
  achieve(world: string, achievement: string, title: string): Promise<NostrEvent | null>;
  /** Be told when its state changes. Returns how to stop. */
  onChange(fn: () => void): () => void;
  /**
   * Wait until it has said whether it is unlocked, or `ms` have passed. A signer that remembers this world
   * says so a moment after the page loads: this is how to not decide anything before it has.
   */
  whenAnswered(ms: number): Promise<void>;
  dispose(): void;
}

export interface WorldSignerOptions {
  /** The visitor's Airlock: usually `portal.airlockFor()`. The signer is beside it. */
  airlock?: string | null | undefined;
  /**
   * Or where the visitor's client said their signer is: usually
   * `arrival.signer()`. Its `signer/` and `connect/` pages are under that
   * address. Given, it is used in place of the Airlock's.
   */
  under?: string | null | undefined;
  /**
   * Or the signer and its window, named outright: for a site that isn't a
   * world, whose visitor arrived from no client. Both must be https
   * addresses on one origin.
   */
  at?: { signer: string; window: string };
  /** This page's query string, for tests (`signer=test` asks the client's window for a throwaway identity). */
  search?: string;
}

const NONE: WorldSigner = {
  state: "none",
  pubkey: null,
  name: null,
  picture: null,
  about: null,
  remembered: null,
  family: null,
  guest: null,
  host: null,
  more: [],
  offers: null,
  unanswered: false,
  asking: false,
  retry: () => false,
  copy: null,
  unlock: () => false,
  signInFromPhone: () => ({ opened: false, done: Promise.resolve(false) }),
  propose: () => Promise.resolve(null),
  wallet: () => Promise.resolve(null),
  pay: () => Promise.resolve(null),
  saveFile: () => Promise.resolve(null),
  pickFile: () => Promise.resolve(null),
  tip: () => Promise.resolve(false),
  buy: () => Promise.resolve(null),
  have: () => Promise.resolve(null),
  panel: false,
  lock() {},
  sign: async () => null,
  pass: async () => null,
  save: async () => null,
  find: async () => null,
  open: async () => null,
  want: () => false,
  follow: async () => null,
  guests: async () => null,
  seal: async () => null,
  unwrap: async () => null,
  reach: async () => null,
  score: async () => null,
  achieve: async () => null,
  onChange: () => () => {},
  whenAnswered: async () => {},
  dispose() {},
};

/** A signer and its window named outright: both https, on one origin. Null for anything else. */
function namedAddresses(at: { signer: string; window: string }): { origin: string; signer: string; window: string } | null {
  try {
    const signer = new URL(at.signer);
    const win = new URL(at.window);
    if (signer.protocol !== "https:" || win.origin !== signer.origin) return null;
    return { origin: signer.origin, signer: signer.href, window: win.href };
  } catch {
    return null;
  }
}

/** How long the visitor has to answer a question put to them: as long as the sign-in address keeps it. */
const ASK_PERSON_MS = 5 * 60_000;

/** A signer for this page, from the visitor's client. With no client, or off a browser, one that is always "none". */
export function createWorldSigner(opts: WorldSignerOptions): WorldSigner {
  const real = opts.at ? namedAddresses(opts.at) : (signerAt(opts.under) ?? signerAddresses(opts.airlock));
  if (!real || typeof document === "undefined") return NONE;
  const test = new URLSearchParams(opts.search ?? location.search).get("signer") === "test";
  const watchers = new Set<() => void>();
  const pending = new Map<string, { asked?: { kind: number; content: string; tags: string[][] }; session?: string; done: (e: NostrEvent | null) => void; timer: ReturnType<typeof setTimeout> }>();
  /** Questions about saves, each with what its answer must be. A signer that keeps nothing says nothing: then there is none. */
  const kept = new Map<string, { answer: (reply: SignerReply | null) => void; timer: ReturnType<typeof setTimeout> }>();
  const askAbout = <T>(request: SignerRequest, read: (reply: SignerReply) => T | null): Promise<T | null> =>
    new Promise((done) => {
      const timer = setTimeout(() => {
        kept.delete(request.id);
        done(null);
      }, 8000);
      kept.set(request.id, { answer: (reply) => done(reply ? read(reply) : null), timer });
      tell(request);
    });
  /**
   * Questions put to the visitor themselves ("Asking the person"): answered twice. First "asking", at which the
   * sign-in address's page is shown; then, at their press there, the answer.
   */
  const put = new Map<string, { shown: boolean; finish: (reply: SignerReply | null) => void; timer: ReturnType<typeof setTimeout> }>();
  let state: SignerState = "none";
  let pubkey: string | null = null;
  let name: string | null = null;
  let picture: string | null = null;
  let about: string | null = null;
  let remembered: boolean | null = null;
  let family: boolean | null = null;
  let guest: boolean | null = null;
  // This world's family, as BitLogin's word has it: `"https://*.<registrable domain>"` of its own origin. Asked for
  // once, before the first sign-in (the owner, 2026-11-25: "These logins should carry. especialy when on the same
  // domain."). None for a page with no registrable domain of its own (an address, a local name) or not on https.
  const ownFamily = (() => {
    try {
      const here = new URL(location.origin);
      if (here.protocol !== "https:") return "";
      const seen = checkDestination(here.origin);
      const domain = seen.ok ? seen.value.registrableDomain : null;
      return domain ? `https://*.${domain}` : "";
    } catch {
      return "";
    }
  })();
  let familyAsked = false;
  let more: SignerMore[] = [];
  let offers: SignerMore[] | null = null;
  // Where the signer and the window really are: the client's own addresses, or their copies on a development server.
  let origin = "";
  let windowAt = "";
  let frame: HTMLIFrameElement | null = null;
  let disposed = false;
  /** A signer someone named, as against one only looked for beside an Airlock that may have none. */
  const named = !!opts.at || !!signerAt(opts.under);
  /**
   * It has had the time a signer takes to load and answer. A signer that checks something before its first
   * answer (BitLogin's asks the visitor's relays whether this world was taken back, when it hasn't for days)
   * can take five seconds over it: ten is allowed before it is called silent.
   */
  let waited = false;
  /** The visitor pressed to have it asked again, and it hasn't answered yet. */
  let asking = false;
  /** How many times its frame has been loaded again because it said nothing. Once by itself; then on a press. */
  let again = 0;
  let waiting: ReturnType<typeof setTimeout> | undefined;
  /** Where the frame was sent, to send it there again. */
  let signerUrl = "";
  const reload = () => {
    if (frame && signerUrl) frame.src = signerUrl;
  };
  /**
   * Give it the time, and say so when it runs out. A frame that never loaded (a moment without a network, a
   * browser that was busy) answers nothing however long it is waited for, so the first time the time runs out it
   * is loaded once more, quietly, before anyone is told it is silent.
   */
  const wait = () => {
    waited = false;
    clearTimeout(waiting);
    waiting = setTimeout(() => {
      if (state !== "none" || disposed) return;
      if (again === 0) {
        again = 1;
        reload();
        return wait();
      }
      waited = true;
      asking = false;
      changed();
    }, 10_000);
  };
  wait();
  /** Whether the signer has answered at all. Until it has, it is asked again a few times. */
  let answered = false;
  const firstAnswer = new Set<() => void>();
  let n = 0;
  const changed = () => {
    for (const fn of watchers) fn();
  };
  const tell = (message: Parameters<typeof signerMessage>[0]) => frame?.contentWindow?.postMessage(signerMessage(message), origin);

  /**
   * Show the sign-in address's own page, at the visitor's press: its panel, where this world is in the frame of a
   * client that has one for this address (client-frame.ts), and otherwise its window. False if neither could be.
   */
  const showPage = (): boolean => {
    if (!windowAt) return false;
    if (!test && clientSignsInAt() === real.origin && askClientForSignIn("ask")) return true;
    try {
      // A window of its own, never a tab the visitor would lose the world behind. It must keep its link to this
      // page: that is how it finds the signer here. So no "noopener".
      return !!window.open(`${windowAt}${test ? "?signer=test" : ""}`, "nswp-connect", "popup,width=460,height=660");
    } catch {
      return false;
    }
  };
  /** Put a question to the visitor themselves, and read its answer. A signer that doesn't do this says nothing: then there is none. */
  const putToThem = <T>(request: SignerRequest, read: (reply: SignerReply) => T | null): Promise<T | null> =>
    new Promise((done) => {
      // One at a time, as the sign-in address keeps them: a new question ends the one before.
      for (const [id, earlier] of put) {
        put.delete(id);
        clearTimeout(earlier.timer);
        earlier.finish(null);
      }
      const timer = setTimeout(() => {
        put.delete(request.id);
        done(null);
      }, 8000);
      put.set(request.id, { shown: false, finish: (reply) => done(reply ? read(reply) : null), timer });
      tell(request);
    });

  const onMessage = (e: MessageEvent) => {
    // Only the signer itself is listened to: that frame, at that address.
    if (!frame || e.source !== frame.contentWindow || e.origin !== origin) return;
    const reply = readSignerReply(e.data);
    if (!reply) return;
    if (reply.t === "ready") {
      asking = false;
      if (state === "none") state = "locked";
      // Before the first sign-in: that it be for this world's whole family. Asked once; an older signer says nothing.
      if (ownFamily && !familyAsked) {
        familyAsked = true;
        // And that a visitor nobody is signed in as be given the family's guest: the same guest in every world of it.
        tell({ t: "want", id: `w${++n}`, family: ownFamily, guest: true });
      }
      tell({ t: "state", id: `s${++n}` });
      return changed();
    }
    if (reply.t === "state") {
      answered = true;
      asking = false;
      state = reply.unlocked ? "unlocked" : "locked";
      pubkey = reply.unlocked ? (reply.pubkey ?? null) : null;
      name = reply.unlocked ? (reply.name ?? null) : null;
      picture = reply.unlocked ? (reply.picture ?? null) : null;
      about = reply.unlocked ? (reply.about ?? null) : null;
      remembered = reply.unlocked ? (reply.remembered ?? null) : null;
      more = reply.unlocked ? cleanMore(reply.more) : [];
      if (reply.offers) offers = reply.offers;
      if (typeof reply.familyTaken === "boolean") family = reply.familyTaken;
      guest = reply.unlocked && typeof reply.guest === "boolean" ? reply.guest : null;
      for (const go of [...firstAnswer]) go();
      return changed();
    }
    const personal = put.get(reply.id);
    if (personal) {
      const end = (answer: SignerReply | null): void => {
        put.delete(reply.id);
        clearTimeout(personal.timer);
        personal.finish(answer);
      };
      if (reply.t !== "asking") return end(reply.t === "refused" ? null : reply);
      if (personal.shown) return;
      personal.shown = true;
      // They have as long as the sign-in address keeps the question, and no longer.
      clearTimeout(personal.timer);
      personal.timer = setTimeout(() => end(null), ASK_PERSON_MS);
      // The page where they are asked: nothing to wait for if it can't be shown.
      if (!showPage()) end(null);
      return;
    }
    const question = kept.get(reply.id);
    if (question) {
      kept.delete(reply.id);
      clearTimeout(question.timer);
      return question.answer(reply.t === "refused" ? null : reply);
    }
    const waiting = pending.get(reply.id);
    if (!waiting) return;
    pending.delete(reply.id);
    clearTimeout(waiting.timer);
    // Only a signed note answers these: an answer about a save that nothing here asked for is dropped.
    if (reply.t !== "signed") return waiting.done(null);
    // What comes back is checked like anything else that arrives: a real signature, by the key it said it holds,
    // on the note that was asked for, marked for this world.
    const signed = reply.event;
    // A pass is checked as a pass from anyone is, and then for whose it is: the key this signer holds, for this
    // site, speaking for the session that was named. Its name and picture are its holder's own to say.
    if (waiting.session) {
      const checked = verifyRoomPass(signed, { origin: location.origin, session: waiting.session });
      return waiting.done(checked.ok && checked.value.pubkey === pubkey ? signed : null);
    }
    if (!waiting.asked) return waiting.done(null);
    const marked = Array.isArray(signed?.tags) && signed.tags.some((t) => t[0] === WORLD_TAG && t[1] === cleanOrigin(location.origin));
    waiting.done(verifyEvent(signed) && signed.pubkey === pubkey && marked && isWhatWasAsked(waiting.asked, signed) ? signed : null);
  };

  void (async () => {
    try {
      // A client's own addresses are followed to their copies on a development server. One named outright is used
      // as it is: whoever named it meant that one.
      const there = opts.at ? async (address: string) => address : toLocal;
      signerUrl = await there(real.signer);
      windowAt = await there(real.window);
      origin = new URL(signerUrl).origin;
      if (disposed) return;
      frame = document.createElement("iframe");
      frame.title = "Signer";
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      // It has nothing to show and is never seen. It is allowed nothing the page could lend it.
      frame.setAttribute("allow", "");
      frame.referrerPolicy = "no-referrer";
      frame.style.cssText = "position:fixed;left:-10px;top:-10px;width:1px;height:1px;border:0;visibility:hidden;pointer-events:none";
      addEventListener("message", onMessage);
      // A signer says nothing to a page whose address it doesn't know, and not every browser tells it. So it is
      // asked: once the frame has loaded, and a few times more in case its script wasn't listening yet.
      frame.addEventListener("load", () => {
        for (const after of [0, 400, 1200, 3000]) {
          setTimeout(() => {
            if (!answered && !disposed) tell({ t: "state", id: `s${++n}` });
          }, after);
        }
      });
      frame.src = signerUrl;
      document.body.append(frame);
    } catch {
      /* no signer: it stays "none" */
    }
  })();

  return {
    get state() {
      return state;
    },
    get pubkey() {
      return pubkey;
    },
    get name() {
      return name;
    },
    get picture() {
      return picture;
    },
    get about() {
      return about;
    },
    get family() {
      return family;
    },
    get guest() {
      return guest;
    },
    get remembered() {
      return remembered;
    },
    get more() {
      return more;
    },
    get offers() {
      return offers;
    },
    get unanswered() {
      return named && waited && state === "none" && !disposed;
    },
    get asking() {
      return asking && state === "none" && !disposed;
    },
    retry() {
      if (!named || state !== "none" || disposed || !frame) return false;
      again++;
      asking = true;
      reload();
      wait();
      changed();
      return true;
    },
    get copy() {
      return origin && origin !== real.origin ? origin : null;
    },
    // The signer's real address, never a development server's copy of it: it is what the visitor should recognise.
    get host() {
      try {
        return new URL(real.origin).host;
      } catch {
        return null;
      }
    },
    get panel() {
      // Only the panel of this signer's own address can find this signer: any other client's is no use here.
      return !test && clientSignsInAt() === real.origin;
    },
    unlock() {
      return state !== "none" && showPage();
    },
    signInFromPhone() {
      const nothing = { opened: false, done: Promise.resolve(false) };
      if (state === "none" || state === "unlocked" || !windowAt) return nothing;
      let win: Window | null = null;
      try {
        win = window.open(`${new URL(windowAt).origin}/headset/`, "bitlogin-headset", "popup");
      } catch {
        win = null;
      }
      if (!win) return nothing;
      const opened = win;
      const done = new Promise<boolean>((ok) => {
        const look = setInterval(() => {
          if (!opened.closed || disposed) return;
          clearInterval(look);
          // No word comes back from that page: the signer is asked how it stands now, once, and answers in a moment.
          tell({ t: "state", id: `s${++n}` });
          setTimeout(() => ok(state === "unlocked"), 1500);
        }, 400);
      });
      return { opened: true, done };
    },
    propose(note) {
      const asked = { kind: note.kind, content: note.content, tags: note.tags ?? [] };
      if (state !== "unlocked" || !frame || !PROPOSE_KINDS.includes(asked.kind)) return Promise.resolve(null);
      // Checked as anything a signer hands back is: really signed, by the key it holds, exactly what was put to
      // them, and marked for this world.
      return putToThem({ t: "propose", id: `r${++n}`, event: asked }, (reply) => {
        if (reply.t !== "signed") return null;
        const signed = reply.event;
        const marked = Array.isArray(signed?.tags) && signed.tags.some((t) => t[0] === WORLD_TAG && t[1] === cleanOrigin(location.origin));
        return verifyEvent(signed) && signed.pubkey === pubkey && marked && isWhatWasAsked(asked, signed) ? signed : null;
      });
    },
    wallet() {
      if (state !== "unlocked" || !frame) return Promise.resolve(null);
      return putToThem({ t: "wallet", id: `v${++n}` }, (reply) => (reply.t === "wallet" ? cleanWalletUri(reply.uri) || null : null));
    },
    saveFile(file) {
      const name = cleanFileName(file.name);
      const bytes = cleanFileBytes(file.bytes);
      if (state !== "unlocked" || !frame || !name || !bytes) return Promise.resolve(null);
      return putToThem({ t: "file-save", id: `fs${++n}`, name, type: cleanFileType(file.type), bytes, private: file.private !== false }, (reply) =>
        // An address is passed on only for a public file, and only if it names exactly the bytes that were offered.
        reply.t === "file-saved" ? { name: reply.name, size: reply.size, private: reply.private, url: !reply.private && reply.url && fileUrlNames(reply.url, bytes) ? reply.url : null } : null,
      );
    },
    pickFile() {
      if (state !== "unlocked" || !frame) return Promise.resolve(null);
      return putToThem({ t: "file-pick", id: `fp${++n}` }, (reply) => (reply.t === "file" ? { name: reply.name, type: reply.type, bytes: reply.bytes, url: reply.url && fileUrlNames(reply.url, reply.bytes) ? reply.url : null } : null));
    },
    tip(o) {
      const sats = cleanTip(o.sats);
      if (state !== "unlocked" || !frame || sats === null || (o.to !== undefined && !isHex64(o.to))) return Promise.resolve(false);
      return putToThem({ t: "tip", id: `t${++n}`, sats, ...(o.to ? { to: o.to } : {}) }, (reply) => (reply.t === "paid" ? true : null)).then((paid) => paid === true);
    },
    buy(listing) {
      const asked = cleanListing(listing);
      if (state !== "unlocked" || !frame || !asked) return Promise.resolve(null);
      return putToThem({ t: "buy", id: `b${++n}`, listing: asked }, (reply) => {
        if (reply.t !== "bought") return null;
        // The word "bought" is not believed: the receipt is, if it is this listing's and this visitor's.
        const checked = readReceipt(reply.receipt, { listing: asked, buyer: pubkey ?? "" });
        return checked.ok ? { ...checked.receipt, event: reply.receipt, delivery: reply.delivery ?? null } : null;
      });
    },
    have(listing) {
      const asked = cleanListing(listing);
      if (state !== "unlocked" || !frame || !asked) return Promise.resolve(null);
      return askAbout({ t: "have", id: `h${++n}`, listing: asked }, (reply) => {
        if (reply.t !== "receipt") return null;
        const checked = readReceipt(reply.receipt, { listing: asked, buyer: pubkey ?? "" });
        return checked.ok ? { ...checked.receipt, event: reply.receipt } : null;
      });
    },
    pay(invoice) {
      const asked = cleanInvoice(invoice);
      if (state !== "unlocked" || !frame || !asked) return Promise.resolve(null);
      return putToThem({ t: "pay", id: `y${++n}`, invoice: asked }, (reply) => (reply.t === "paid" ? { preimage: reply.preimage ?? null, proven: !!reply.preimage && provesPayment(asked, reply.preimage) } : null));
    },
    lock() {
      if (state === "unlocked") tell({ t: "lock", id: `l${++n}` });
    },
    sign(note) {
      if (state !== "unlocked" || !frame) return Promise.resolve(null);
      const asked = { kind: note.kind, content: note.content, tags: note.tags ?? [] };
      const id = `q${++n}`;
      return new Promise((done) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          done(null);
        }, 8000);
        pending.set(id, { asked, done, timer });
        tell({ t: "sign", id, event: asked });
      });
    },
    pass(session) {
      if (state !== "unlocked" || !frame) return Promise.resolve(null);
      const id = `p${++n}`;
      return new Promise((done) => {
        // A signer that makes no passes says nothing at all to this: then there is none.
        const timer = setTimeout(() => {
          pending.delete(id);
          done(null);
        }, 8000);
        pending.set(id, { session, done, timer });
        tell({ t: "pass", id, session });
      });
    },
    save(slot, data) {
      if (state !== "unlocked" || !frame || !cleanSlot(slot) || !fitsInSave(data)) return Promise.resolve(null);
      // The world can't read what comes back, and doesn't need to: it checks that it is a save, really signed, by
      // the key this signer holds.
      return askAbout({ t: "save", id: `s${++n}`, slot, data }, (reply) => (reply.t === "signed" && verifyEvent(reply.event) && looksLikeSave(reply.event, pubkey) ? reply.event : null));
    },
    find(slot) {
      if (state !== "unlocked" || !frame || !cleanSlot(slot)) return Promise.resolve(null);
      return askAbout({ t: "find", id: `f${++n}`, slot }, (reply) => (reply.t === "found" ? reply.d : null));
    },
    open(event) {
      if (state !== "unlocked" || !frame || !verifyEvent(event) || !looksLikeSave(event, pubkey)) return Promise.resolve(null);
      return askAbout({ t: "open", id: `o${++n}`, event }, (reply) => (reply.t === "opened" ? { slot: reply.slot, data: reply.data, at: reply.at } : null));
    },
    want(asked) {
      // Only what this signer says it has a question for, where it says.
      const wanted = cleanMore([...asked]).filter((name) => !offers || offers.includes(name));
      if (state === "none" || !frame || wanted.length === 0) return false;
      tell({ t: "want", id: `w${++n}`, more: wanted });
      return true;
    },
    follow(list, change) {
      const add = "add" in change ? change.add : undefined;
      const remove = "remove" in change ? change.remove : undefined;
      if (state !== "unlocked" || !frame || !more.includes("follows") || !isHex64(add ?? remove)) return Promise.resolve(null);
      // What comes back is checked as anything that arrives is: their own list, really signed, and exactly the one
      // handed over with that one change. A signer can't slip anyone else in, and nor can anything between.
      return askAbout({ t: "follow", id: `w${++n}`, list, ...(add ? { add } : { remove: remove! }) }, (reply) => (reply.t === "signed" && isFollowAsked(reply.event, { list, ...(add ? { add } : { remove: remove! }), pubkey }) ? reply.event : null));
    },
    guests(o) {
      if (state !== "unlocked" || !frame || !pubkey || !isListSubject(o.world) || !isHex64(o.key)) return Promise.resolve(null);
      if (o.list === null && o.none !== true) return Promise.resolve(null);
      const asked = { list: o.list, subject: o.world, change: o.change, key: o.key, pubkey };
      // Put to the person on the sign-in address's own page; what comes back is checked as anything that arrives
      // is: their own key, really signed, exactly that list with that one change, before it goes anywhere.
      return putToThem({ t: "guests", id: `g${++n}`, world: o.world, list: o.list, change: o.change, key: o.key, ...(o.none === true ? { none: true as const } : {}) }, (reply) => (reply.t === "signed" && isOwnerListAsked(reply.event, asked) ? reply.event : null));
    },
    seal(to, text) {
      const words = cleanMessage(text);
      if (state !== "unlocked" || !frame || !more.includes("messages") || !isHex64(to) || !words) return Promise.resolve(null);
      return askAbout({ t: "seal", id: `m${++n}`, to, text: words }, (reply) => (reply.t === "sealed" && isSealAsked(reply, { pubkey, to, text: words }) ? { message: reply.message, seals: reply.seals } : null));
    },
    unwrap(wrap) {
      if (state !== "unlocked" || !frame || !more.includes("messages") || !looksLikeWrap(wrap, pubkey ?? "")) return Promise.resolve(null);
      // The signer opened it and checked who wrote it. It is taken only if it is to or from the key it holds.
      return askAbout({ t: "unwrap", id: `m${++n}`, event: wrap }, (reply) => (reply.t === "message" && (reply.message.from === pubkey || reply.message.to.includes(pubkey ?? "")) ? reply.message : null));
    },
    reach(relays) {
      if (state !== "unlocked" || !frame || !more.includes("messages")) return Promise.resolve(null);
      return askAbout({ t: "reach", id: `m${++n}`, relays: [...relays] }, (reply) => (reply.t === "signed" && isReachAsked(reply.event, { pubkey, relays }) ? reply.event : null));
    },
    score(world, board, score, said = {}) {
      if (state !== "unlocked" || !frame) return Promise.resolve(null);
      // What the board is called and how it counts go with the score, so it can be shown where the world isn't.
      const more = { ...(said.title ? { title: said.title } : {}), ...(said.format === "time" ? { format: "time" as const } : {}) };
      return askAbout({ t: "score", id: `c${++n}`, world, board, score, ...more }, (reply) => (reply.t === "signed" && isScoreAsked(reply.event, { pubkey, world, board, score, ...more, origin: location.origin }) ? reply.event : null));
    },
    achieve(world, achievement, title) {
      if (state !== "unlocked" || !frame) return Promise.resolve(null);
      return askAbout({ t: "achieve", id: `a${++n}`, world, achievement, title }, (reply) => (reply.t === "signed" && isAchievementAsked(reply.event, { pubkey, world, id: achievement, title, origin: location.origin }) ? reply.event : null));
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
    whenAnswered(ms) {
      if (answered || disposed) return Promise.resolve();
      return new Promise((done) => {
        const go = () => {
          clearTimeout(timer);
          firstAnswer.delete(go);
          done();
        };
        const timer = setTimeout(go, ms);
        firstAnswer.add(go);
      });
    },
    dispose() {
      disposed = true;
      for (const go of [...firstAnswer]) go();
      clearTimeout(waiting);
      removeEventListener("message", onMessage);
      frame?.remove();
      frame = null;
      for (const w of pending.values()) {
        clearTimeout(w.timer);
        w.done(null);
      }
      pending.clear();
      for (const k of kept.values()) {
        clearTimeout(k.timer);
        k.answer(null);
      }
      kept.clear();
      state = "none";
    },
  };
}
