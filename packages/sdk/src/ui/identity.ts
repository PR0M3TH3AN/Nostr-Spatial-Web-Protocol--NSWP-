/**
 * Who the visitor is here, and the way to change it: sign in, switch to
 * another profile, or go on as a guest.
 *
 * A world never shows a sign-in and never holds a key
 * (protocol/09-what-a-world-owes.md). So this control does one thing: it
 * leaves for the visitor's own client, which asks them in its own way and
 * brings them back through its Airlock, with a pass if they chose to come by
 * name (protocol/10-identity.md, "Signing in from inside a world"). What it
 * says is what the world was told on arrival, and nothing else.
 *
 * It is there only for a visitor who came through a client: with no Airlock
 * to go back to, there is nobody to ask.
 */
import { encodeNpub, getPublicKey, shortNpub, signerAt, type NostrEvent } from "@nswp/core";
import { askClientForSignIn, onClientScreen } from "../client-frame.js";
import { arrival, portal, type GoOptions } from "../index.js";
import { createPeople, type People } from "../people.js";
import { createSaves, type Saves } from "../saves.js";
import { createWorldSigner, type WorldSigner } from "../signer.js";
import type { Controls, UiAction, UiCard, UiSection } from "./model.js";

/**
 * Whether signing in here means unlocking a signer: the visitor's client named one
 * (protocol/10-identity.md, "One sign-in"). Then there is one sign-in in this world and it is that one. A
 * client's own pages are not a world it sent someone to: there they are signed in already, its own way.
 */
export function signerNamed(): boolean {
  if (!signerAt(arrival.signer())) return false;
  try {
    const airlock = portal.airlockFor();
    if (airlock && new URL(airlock).origin === location.origin) return false;
  } catch {
    /* no Airlock to compare with */
  }
  return true;
}

/**
 * Who the visitor is here, now. With no signer named, what their pass says. With one, their pass counts only
 * while that signer is unlocked for this world and holds the pass's own key: signed out, they are a guest,
 * whatever they arrived with. So nothing here says "you are here as" someone who isn't signed in.
 */
export function hereAs(): ReturnType<typeof arrival.identity> {
  const who = arrival.identity();
  if (!who || !signerNamed()) return who;
  const signer = worldSigner();
  return signer.state === "unlocked" && signer.pubkey === who.pubkey ? who : undefined;
}

const hereWatchers = new Set<() => void>();
/** Be told when who the visitor is here may have changed: a pass arrived from their signer. Returns how to stop. */
export function onHereAs(fn: () => void): () => void {
  hereWatchers.add(fn);
  return () => void hereWatchers.delete(fn);
}

let seeking: Promise<void> | null = null;
/**
 * When a pass may next be asked for. A signer that gave none (it makes none, or it said no) isn't asked again
 * until the visitor signs in afresh or the page is loaded again: each asking counts against what the signer
 * lets this world have signed.
 */
let seekAfter = 0;
/**
 * A pass from the signer (protocol/10-identity.md, "A pass from the signer"). Signed in here with no pass for
 * that key (their client sent none, or one for someone else, or it ran out), the signer is asked for one: for a
 * session key made here, for this site. What comes back is checked and kept as an arrival's pass is. A signer
 * that makes none never answers, and the visitor stays a guest.
 */
export function seekPass(): Promise<void> {
  if (seeking) return seeking;
  if (!signerNamed()) return Promise.resolve();
  const signer = worldSigner();
  const key = signer.state === "unlocked" ? signer.pubkey : null;
  if (!key || arrival.identity()?.pubkey === key || Date.now() < seekAfter) return Promise.resolve();
  seekAfter = Date.now() + 60_000;
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const sessionKey = [...secret].map((b) => b.toString(16).padStart(2, "0")).join("");
  seeking = signer
    .pass(getPublicKey(secret))
    .then((pass) => {
      // Signed out, or in as someone else, while it was on its way: it is nobody's now.
      if (pass && signer.state === "unlocked" && signer.pubkey === key && arrival.keepIdentity(pass, sessionKey)) {
        for (const fn of [...hereWatchers]) fn();
      } else if (!pass) seekAfter = Infinity;
    })
    .catch(() => {})
    .finally(() => {
      seeking = null;
    });
  return seeking;
}

const soon = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/**
 * The same question for a room about to be joined, with a moment's wait for a signer that hasn't spoken yet:
 * one that remembers this world says so just after the page loads, and a room joined before that would be
 * joined as a guest. Signed in with no pass for that key, the signer is asked for one, and waited on briefly.
 */
export async function byName(identity: { pass: NostrEvent; sessionKey: string } | undefined): Promise<{ pass: NostrEvent; sessionKey: string } | undefined> {
  if (!signerNamed()) return identity;
  const signer = worldSigner();
  await signer.whenAnswered(2500);
  if (signer.state !== "unlocked" || !signer.pubkey) return undefined;
  if (identity && signer.pubkey === identity.pass.pubkey) return identity;
  await Promise.race([seekPass(), soon(3000)]);
  const who = arrival.identity();
  return who && who.pubkey === signer.pubkey ? { pass: who.pass, sessionKey: who.sessionKey } : undefined;
}

/** The words for who a visitor is here, for a world that draws this itself. */
export function identityWords(): { signedIn: boolean; name: string; label: string; short: string } {
  const who = hereAs();
  const name = who ? who.name || shortNpub(who.pubkey) : "";
  return who
    ? { signedIn: true, name, label: `Here as ${name}. Switch profile, or go as a guest`, short: "You" }
    : { signedIn: false, name: "", label: "You are a guest here. Sign in", short: "Sign in" };
}

/** Who they are signed in as, as a card at the head of You: their picture, their name, their key. Null for a guest. */
export function youCard(): UiCard | null {
  const who = hereAs();
  const signer = signerNamed() ? worldSigner() : null;
  if (who) {
    const npub = encodeNpub(who.pubkey);
    return { title: who.name || shortNpub(who.pubkey), tag: "Signed in", proven: true, sub: shortNpub(who.pubkey), copy: npub, text: who.about ?? "", picture: who.picture ?? "", color: "", now: [] };
  }
  // Unlocked, with no pass for that key (a signer that makes none): they can post as it, and the room has nobody's
  // word for a name. What their sign-in address says of them is shown to them alone.
  if (signer?.state === "unlocked" && signer.pubkey) {
    return { title: signer.name ?? shortNpub(signer.pubkey), tag: "Signed in to post", proven: false, sub: shortNpub(signer.pubkey), copy: encodeNpub(signer.pubkey), text: signer.about ?? "", picture: signer.picture ?? "", color: "", now: [] };
  }
  return null;
}

/** Where signing in happens: the host of the visitor's own client. Null when they came through none. */
export function identityHost(): string | null {
  const airlock = portal.airlockFor();
  try {
    return airlock ? new URL(airlock).host : null;
  } catch {
    return null;
  }
}

/** What the section says: where they will be taken, and that the world never sees it. */
export const identitySection = (): UiSection => ({
  id: "you",
  label: "You",
  icon: "you",
  card: youCard,
  note: () => {
    const host = identityHost();
    if (!host) return "";
    if (!signerNamed()) return `Who you are and how you look are kept by ${host}, the place you set out from, and are the same in every world. Changing either takes you there and brings you back here.`;
    const at = worldSigner().host ?? "your sign-in address";
    const look = `How you look is kept by ${host}, the place you set out from: changing it takes you there and brings you back.`;
    // For this visit only: said, so that being asked again next time is no surprise, and where that is chosen.
    const visit = worldSigner().remembered === false ? ` It lasts for this visit: next time, ${at} asks again. Whether it remembers this world is yours to choose when it asks.` : "";
    if (worldSigner().state === "unlocked") return `You are signed in here by ${at}.${visit} Signing out here makes you a guest in this world, and nowhere else. ${look}`;
    return `Signing in is done by ${at}, which asks you itself: this world never sees a password. Until you sign in here, everyone sees a guest. ${look}`;
  },
});

/** The visitor's state as they go, so they come back as they left. A world may bring its crossing's room up first. */
export type Leaving = (to: { title: string; address: string }) => GoOptions | Promise<GoOptions>;

let going = false;
const leave = async (controls: Controls, what: "identity" | "look", leaving: Leaving): Promise<void> => {
  if (going) return;
  going = true;
  const host = identityHost() ?? "your own client";
  controls.say(what === "look" ? `Taking you to ${host} to change how you look.` : `Taking you to ${host} to say who you are.`);
  try {
    if (await portal.ask(what, await leaving({ title: what === "look" ? "Your look" : "Who you are", address: host }))) return;
  } catch {
    /* they stay */
  }
  going = false;
};

/**
 * The control. `leaving` is the visitor's state as they go (in a room, with a
 * microphone on, moving the intense way, in a headset session), so they come
 * back as they left.
 */
export function identityAction(controls: Controls, leaving: Leaving = () => ({})): UiAction {
  return {
    id: "identity",
    section: "you",
    icon: "you",
    label: () => identityWords().label,
    short: () => identityWords().short,
    // Where a signer was named there is one sign-in, and it is that one (signerAction): this row would be a second.
    hidden: () => portal.airlockFor() === null || signerNamed(),
    act: () => leave(controls, "identity", leaving),
  };
}

/** What to say when a signer that was named didn't answer: what happened, and the one thing likely to help. */
export function unansweredWords(signer: WorldSigner): string {
  const host = signer.host ?? "your signer";
  const copy = signer.copy
    ? ` On this development server its copy is at ${signer.copy}: open that address once in a tab, so your browser accepts its certificate, then reload this page.`
    : " Press this again to ask once more, or reload the page.";
  return `This world asked ${host} for your sign-in and got no answer. It may be unreachable from here, or your browser may have kept it out.${copy} Nothing is wrong with your sign-in.`;
}

let shared: WorldSigner | null = null;
/** This page's one signer, from the visitor's own client (signer.ts). "none" when they came through no client. */
export function worldSigner(): WorldSigner {
  // Where their own client said it is; or beside that client's Airlock.
  if (shared) return shared;
  const signer = (shared = createWorldSigner({ under: arrival.signer(), airlock: portal.airlockFor() }));
  // Signed in with no pass for that key: one is asked for. And once more when one that was held has run out,
  // which the minute's look notices. A refusal is not asked about again (seekPass).
  signer.onChange(() => {
    if (signer.state !== "unlocked") seekAfter = 0;
    void seekPass();
  });
  if (typeof document !== "undefined" && signerNamed()) setInterval(() => void seekPass(), 60_000);
  return signer;
}

let kept: Saves | null = null;
/**
 * This world's saves (saves.ts, protocol/12-saves.md): on this device for anyone, and with their account for a
 * visitor who is signed in here. One for the page, using the page's one signer.
 */
export function worldSaves(): Saves {
  return (kept ??= createSaves({ signer: () => (signerNamed() ? worldSigner() : null) }));
}

let followed: People | null = null;
/**
 * Who this world's visitor follows, and following for them (people.ts, protocol/14-people-and-messages.md): for a
 * visitor who is signed in here and has let this world do so. One for the page, using the page's one signer.
 * Nothing is asked of a relay about them until this is used.
 */
export function worldPeople(): People {
  const signer = () => (signerNamed() ? worldSigner() : null);
  return (followed ??= createPeople({
    hand: {
      pubkey: () => (signer()?.state === "unlocked" ? signer()!.pubkey : null),
      ready: () => !!signer()?.more.includes("follows"),
      change: (list, change) => signer()?.follow(list, change) ?? Promise.resolve(null),
    },
  }));
}

/**
 * The control that unlocks the visitor's signer for this world, and locks it
 * again (protocol/10-identity.md, "Signing from a world"). Unlocking opens a
 * window of their own client, where they say yes. Nothing is typed here.
 */
export function signerAction(controls: Controls, opts: { presenting?: () => boolean } = {}): UiAction {
  const signer = worldSigner();
  let was = signer.state;
  let wasAsking = false;
  const short = () => shortNpub(signer.pubkey ?? "");
  signer.onChange(() => {
    if (signer.state === "unlocked" && was !== "unlocked") {
      // A pass may be on its way from the signer: what is said waits a moment for it.
      void Promise.race([seekPass(), soon(4000)]).then(() => {
        if (signer.state !== "unlocked") return;
        const who = hereAs();
        controls.say(
          who
            ? `You are signed in here as ${who.name || short()}${signer.remembered === false ? ", for this visit" : ""}. People in a room see your name and picture, and you can send out posts. Signing out is under You.`
            : `You are signed in here as ${signer.name ?? short()}, and can send out posts. In a room you are still a guest: ${signer.host ?? "your sign-in address"} gave no pass with your name on it.`,
        );
      });
    }
    if (signer.state === "locked" && was === "unlocked") controls.say("You are signed out here. Everyone sees a guest, and nothing more can be signed as you.");
    // Asked again at their press, and silent again: said, with what is left to try.
    if (wasAsking && !signer.asking && signer.unanswered) controls.say(unansweredWords(signer));
    if (wasAsking && !signer.asking && signer.state === "locked") controls.say(`${signer.host ?? "Your sign-in address"} answered. You can sign in now.`);
    wasAsking = signer.asking;
    was = signer.state;
    controls.signal("signer");
  });
  onHereAs(() => controls.signal("signer"));
  return {
    id: "signer",
    section: "you",
    icon: "key",
    // Signed out, it says whose window will open, before anything is pressed: an address to recognise.
    label: () =>
      signer.state === "unlocked"
        ? `Signed in as ${hereAs()?.name || signer.name || short()}. Sign out here`
        : signer.asking
          ? `Asking ${signer.host ?? "your signer"} again…`
          : signer.unanswered
            ? `${signer.host ?? "Your signer"} didn't answer. Press to ask again`
            : `Sign in${signer.host ? `, at ${signer.host}` : ""}`,
    short: () => (signer.state === "unlocked" ? "Sign out" : "Sign in"),
    on: () => signer.state === "unlocked",
    // Nothing to offer where no signer was named. One that was named and doesn't answer is said so, not hidden:
    // a row that isn't there can't be asked about.
    hidden: () => signer.state === "none" && !signer.unanswered && !signer.asking,
    act: () => {
      if (signer.state === "unlocked") return signer.lock();
      const host = signer.host ?? "your own client";
      if (signer.asking) return;
      if (signer.unanswered) {
        // Asked again, there and then: a frame that failed to load once often loads the second time.
        if (signer.retry()) return controls.say(`Asking ${host} again. It has ten seconds to answer.`);
        return controls.say(unansweredWords(signer));
      }
      // A headset draws nothing but the world, so no window or panel of the client's can be seen in one.
      if (opts.presenting?.()) return controls.say(`${signer.panel ? `${host} has to ask you this itself, and that can't be seen from inside a headset` : `A window from ${host} is needed for this, and none can open in a headset`}. Leave the headset view for a moment, sign in, and come back in.`);
      // Shown inside a client that draws the sign-in address's panel over the world: no window, and the screen stays as it is.
      const here = signer.panel;
      if (signer.unlock()) controls.say(here ? `${host} is asking, here. Say yes there, and you are signed in.` : `A window from ${host} has opened. Say yes there, and you are signed in here.`);
      else controls.say(`Your browser didn't let a window open. Allow pop-ups for this site and press this again. Nothing is typed in this world: ${host} asks.`);
    },
  };
}

/**
 * Their account at the sign-in address, without leaving the world: its own pages (other accounts, the lock, the
 * password, recovery, what it keeps), in the panel the visitor's client draws over the world (client-frame.ts).
 * Only where there is such a panel, for this world's own signer's address: a world never shows any of it itself.
 */
export function accountAction(controls: Controls, opts: { presenting?: () => boolean } = {}): UiAction {
  const signer = worldSigner();
  // Whether there is a panel is said by the client a moment after the world loads.
  onClientScreen(() => controls.signal("signer"));
  return {
    id: "account",
    section: "you",
    icon: "key",
    label: () => `Your account, at ${signer.host ?? "your sign-in address"}`,
    short: "Account",
    hidden: () => !signer.panel,
    act: () => {
      const host = signer.host ?? "your sign-in address";
      if (opts.presenting?.()) return controls.say(`${host} shows your account itself, and that can't be seen from inside a headset. Leave the headset view for a moment and press this again.`);
      if (!askClientForSignIn("account")) controls.say(`${host} couldn't be shown here just now.`);
    },
  };
}

/**
 * Their own files, without leaving the world: the file browser of their sign-in address (folders, public and
 * private files, the servers they keep them on), in the panel their client draws over the world. The world sees
 * none of it: it is the sign-in address's page, and a world is handed a file only when the visitor picks one for
 * it (`signer.pickFile`). Only where there is such a panel.
 */
export function filesAction(controls: Controls, opts: { presenting?: () => boolean } = {}): UiAction {
  const signer = worldSigner();
  onClientScreen(() => controls.signal("signer"));
  return {
    id: "files",
    section: "you",
    icon: "list",
    label: () => `Your files, at ${signer.host ?? "your sign-in address"}`,
    short: "Files",
    hidden: () => !signer.panel,
    act: () => {
      const host = signer.host ?? "your sign-in address";
      if (opts.presenting?.()) return controls.say(`${host} shows your files itself, and that can't be seen from inside a headset. Leave the headset view for a moment and press this again.`);
      if (!askClientForSignIn("files")) controls.say(`${host} couldn't be shown here just now.`);
    },
  };
}

/**
 * The way to change how they look. Their look is kept by their own client and
 * is the same in every world, so it is changed there: this leaves for it and
 * comes back, as signing in does.
 */
export function figureAction(controls: Controls, leaving: Leaving = () => ({})): UiAction {
  return {
    id: "figure",
    section: "you",
    icon: "look",
    label: "Change how you look",
    short: "Look",
    hidden: () => portal.airlockFor() === null,
    act: () => leave(controls, "look", leaving),
  };
}
