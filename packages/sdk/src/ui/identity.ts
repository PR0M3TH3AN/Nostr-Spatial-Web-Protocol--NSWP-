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
import { shortNpub } from "@nswp/core";
import { arrival, portal, type GoOptions } from "../index.js";
import type { Controls, UiAction, UiSection } from "./model.js";

/** The words for who a visitor is here, for a world that draws this itself. */
export function identityWords(): { signedIn: boolean; name: string; label: string; short: string } {
  const who = arrival.identity();
  const name = who ? who.name || shortNpub(who.pubkey) : "";
  return who
    ? { signedIn: true, name, label: `Here as ${name}. Switch profile, or go as a guest`, short: "You" }
    : { signedIn: false, name: "", label: "You are a guest here. Sign in", short: "Sign in" };
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
  note: () => {
    const host = identityHost();
    return host ? `Who you are and how you look are kept by ${host}, the place you set out from, and are the same in every world. Changing either takes you there and brings you back here.` : "";
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
    hidden: () => portal.airlockFor() === null,
    act: () => leave(controls, "identity", leaving),
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
