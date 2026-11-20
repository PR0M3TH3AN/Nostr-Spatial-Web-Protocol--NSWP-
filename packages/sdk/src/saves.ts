/**
 * Saves: what a world keeps for its visitor (protocol/12-saves.md).
 *
 *   const saves = createSaves({ signer });
 *   const last = await saves.load();                 // { data, at, from } or null
 *   await saves.save(JSON.stringify({ level: 3 }));  // says where it was kept
 *
 * A save is text: the world's own, in whatever shape it likes. It is always kept on this device, at once, so
 * nothing is lost to a closed tab. For a visitor who is signed in here it is also kept with their account, on
 * their own relays, encrypted so that only they can read it: then it is there on their next device.
 *
 * A world can read and write its own saves and nobody else's. It never says where a save is kept: the visitor's
 * signer works that out from this site's address. A guest's save stays on the device, and is taken up by their
 * account the first time it is loaded after they sign in.
 */
import { cleanSlot, DEFAULT_RELAYS, fitsInSave, publishEvent, queryRelays, readRelayList, RELAY_LIST_KIND, SAVE_KIND, SAVE_SLOT, verifyEvent, writeRelaysFor, type NostrEvent } from "@nswp/core";
import type { WorldSigner } from "./signer.js";

export interface Saved {
  data: string;
  /** When it was saved, in seconds. */
  at: number;
  /** Where this copy came from: their account, or this device alone. */
  from: "account" | "device";
}

export interface SaveResult {
  /**
   * "account": kept with their account, on at least one of their relays, and on this device. "device": kept on
   * this device only (a guest, or their account couldn't be reached). "nowhere": it couldn't be kept at all.
   */
  kept: "account" | "device" | "nowhere";
  /** Words for the visitor, should the world want to say: "Saved to your account". */
  said: string;
}

export interface Saves {
  /** The newest save in a slot: from their account if they are signed in and it has a newer one, else this device's. Null if there is none, or it was cleared. */
  load(slot?: string): Promise<Saved | null>;
  /** Keep this. Text, at most `SAVE_LIMITS.dataBytes` bytes. An empty text clears the slot. */
  save(data: string, slot?: string): Promise<SaveResult>;
  /** Clear a slot: here, and with their account if they are signed in. */
  clear(slot?: string): Promise<SaveResult>;
}

export interface SavesOptions {
  /** The world's signer (`worldSigner()`), or a way to get it once there is one. Left out, saves stay on the device. */
  signer?: WorldSigner | (() => WorldSigner | null | undefined) | null;
  /** The relays asked when the visitor has published no list of their own. */
  relays?: string[];
  /** For tests: where the device's copy is kept, the clock, and how relays are asked. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  now?: () => number;
  query?: typeof queryRelays;
  publish?: typeof publishEvent;
}

type Local = { data: string; at: number };

export function createSaves(opts: SavesOptions = {}): Saves {
  const now = opts.now ?? (() => Date.now());
  const query = opts.query ?? queryRelays;
  const publish = opts.publish ?? publishEvent;
  const usual = () => opts.relays ?? DEFAULT_RELAYS;
  const signer = () => (typeof opts.signer === "function" ? opts.signer() : opts.signer) ?? null;
  const store = (() => {
    if (opts.storage !== undefined) return opts.storage;
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  })();
  /** A device's copy is kept apart for each person who has signed in on it, and for a guest. */
  const keyFor = (who: string | null, slot: string) => `nswp:save:${who ?? "guest"}:${slot}`;
  const readLocal = (who: string | null, slot: string): Local | null => {
    try {
      const kept = JSON.parse(store?.getItem(keyFor(who, slot)) ?? "null") as Partial<Local> | null;
      return kept && typeof kept.data === "string" && typeof kept.at === "number" ? { data: kept.data, at: kept.at } : null;
    } catch {
      return null;
    }
  };
  const writeLocal = (who: string | null, slot: string, kept: Local): boolean => {
    try {
      if (!store) return false;
      store.setItem(keyFor(who, slot), JSON.stringify(kept));
      return true;
    } catch {
      return false;
    }
  };

  /** Where this person's saves go and are read from: the relays they say they write to, or the usual ones. Asked once, kept ten minutes. */
  let relaysKept: { key: string; at: number; found: Promise<string[]> } | null = null;
  const relaysFor = (key: string): Promise<string[]> => {
    if (relaysKept && relaysKept.key === key && now() - relaysKept.at < 600_000) return relaysKept.found;
    const found = query(usual(), { kinds: [RELAY_LIST_KIND], authors: [key], limit: 4 }, 2500)
      .then((got) => writeRelaysFor(readRelayList(got.events, key), usual()).relays)
      .catch(() => usual());
    relaysKept = { key, at: now(), found };
    return found;
  };

  /** Their account's save in a slot, opened, or null: they aren't signed in here, there is none, or it isn't this world's. */
  const fromAccount = async (slot: string): Promise<Local | null> => {
    const s = signer();
    const who = s?.state === "unlocked" ? s.pubkey : null;
    if (!s || !who) return null;
    const d = await s.find(slot);
    if (!d) return null;
    const got = await query(await relaysFor(who), { kinds: [SAVE_KIND], authors: [who], "#d": [d], limit: 4 }, 3500).catch(() => null);
    // The newest that is really theirs, of this kind, at that address. The signer checks the rest when it opens it.
    const newest = (got?.events ?? [])
      .filter((e: NostrEvent) => e.kind === SAVE_KIND && e.pubkey === who && e.tags.some((t) => t[0] === "d" && t[1] === d) && verifyEvent(e))
      .sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at)[0];
    if (!newest) return null;
    const opened = await s.open(newest);
    return opened && opened.slot === slot ? { data: opened.data, at: opened.at } : null;
  };

  const load = async (slotIn?: string): Promise<Saved | null> => {
    const slot = cleanSlot(slotIn ?? SAVE_SLOT);
    if (!slot) return null;
    const s = signer();
    const who = s?.state === "unlocked" ? s.pubkey : null;
    // What this device has: theirs, and what a guest kept here before anyone signed in.
    const here = [readLocal(who, slot), who ? readLocal(null, slot) : null].filter((x): x is Local => !!x).sort((a, b) => b.at - a.at)[0] ?? null;
    const there = who ? await fromAccount(slot).catch(() => null) : null;
    const newest = there && (!here || there.at >= here.at) ? { ...there, from: "account" as const } : here ? { ...here, from: "device" as const } : null;
    // An account's newer save is kept here too, so it is there the next time with no relay to ask.
    if (newest?.from === "account") writeLocal(who, slot, { data: newest.data, at: newest.at });
    // And this device's newer one is taken up by their account: what they did as a guest, or while a relay was
    // out of reach, follows them without the world having to save again. Not waited for.
    // One at a time for a slot: a world that loads twice in a moment doesn't have it signed twice.
    if (who && newest?.from === "device" && !taking.has(slot)) {
      taking.add(slot);
      void toAccount(newest.data, slot, who)
        .catch(() => false)
        .then(() => taking.delete(slot));
    }
    return newest && newest.data !== "" ? newest : null;
  };
  const taking = new Set<string>();

  /** Have their signer keep this and send it to their relays. True if a relay took it. This device's copy is given the signer's time. */
  const toAccount = async (data: string, slot: string, who: string): Promise<boolean> => {
    const s = signer();
    if (!s || s.state !== "unlocked" || s.pubkey !== who) return false;
    const signed = await s.save(slot, data).catch(() => null);
    if (!signed) return false;
    // The signer's own time is the save's: this device's copy is given it, so the two compare as one.
    writeLocal(who, slot, { data, at: signed.created_at });
    const sent = await publish(await relaysFor(who), signed).catch(() => null);
    return !!sent && Object.values(sent.relays).some((said) => said === "ok");
  };

  const save = async (data: string, slotIn?: string): Promise<SaveResult> => {
    const slot = cleanSlot(slotIn ?? SAVE_SLOT);
    if (!slot || !fitsInSave(data)) return { kept: "nowhere", said: "That is too much to save, or not a slot's name." };
    const s = signer();
    const who = s?.state === "unlocked" ? s.pubkey : null;
    const at = Math.floor(now() / 1000);
    // This device first, at once: whatever happens next, it isn't lost to a closed tab.
    const here = writeLocal(who, slot, { data, at });
    if (!s || !who) return here ? { kept: "device", said: "Saved on this device. Sign in to keep it with your account." } : { kept: "nowhere", said: "This browser wouldn't keep it." };
    if (await toAccount(data, slot, who).catch(() => false)) return { kept: "account", said: "Saved to your account." };
    return here ? { kept: "device", said: "Saved on this device. It didn't reach your account this time." } : { kept: "nowhere", said: "That wasn't saved." };
  };

  return { load, save, clear: (slot) => save("", slot) };
}
