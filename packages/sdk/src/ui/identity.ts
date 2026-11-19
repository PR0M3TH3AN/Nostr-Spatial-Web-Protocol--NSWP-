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
    return host ? `Who you are is asked and kept by ${host}, the place you set out from, and never by this world. Signing in takes you there and brings you back here.` : "";
  },
});

/**
 * The control. `leaving` is the visitor's state as they go (in a room, with a
 * microphone on, moving the intense way, in a headset session), so they come
 * back as they left.
 */
export function identityAction(controls: Controls, leaving: () => GoOptions = () => ({})): UiAction {
  let going = false;
  return {
    id: "identity",
    section: "you",
    icon: "you",
    label: () => identityWords().label,
    short: () => identityWords().short,
    hidden: () => portal.airlockFor() === null,
    act: async () => {
      if (going) return;
      going = true;
      controls.say(`Taking you to ${identityHost() ?? "your own client"} to say who you are.`);
      if (!(await portal.signIn(leaving()))) going = false;
    },
  };
}
