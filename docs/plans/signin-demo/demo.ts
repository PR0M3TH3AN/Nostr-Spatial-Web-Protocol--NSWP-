/**
 * Notebook: a plain website that signs in by the window, to show what that is
 * like for an app that isn't a world (docs/plans/signing-in-worlds.md, "What
 * this means for every site that uses BitLogin").
 *
 * It uses the kit's own signer (packages/sdk/src/signer.ts) and nothing else
 * of the kit. The sign-in address is the BitPortal copy on the same machine.
 * It signs and shows; it sends nothing anywhere.
 */
import { shortNpub, encodeNpub } from "@nswp/core";
import { createWorldSigner } from "../../../packages/sdk/src/signer.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
// The sign-in address: BitLogin's own site, as the copy the development server serves beside this page (its
// twelfth port), wherever this page was opened from. `?at=portal` asks BitPortal's first copy instead.
const portal = new URLSearchParams(location.search).get("at") === "portal";
const client = `https://${location.hostname}:${portal ? 4300 : 4311}`;
for (const el of document.querySelectorAll("[data-host]")) el.textContent = `${portal ? "BitPortal" : "BitLogin"}, at ${new URL(client).host}`;

const signer = portal ? createWorldSigner({ airlock: `${client}/go/` }) : createWorldSigner({ at: { signer: `${client}/signer/`, window: `${client}/connect/` } });
let waited = false;
setTimeout(() => {
  waited = true;
  draw();
}, 3500);

const show = (title: string, says: string, note: unknown, refused = false) => {
  $("result").hidden = false;
  $("result").classList.toggle("refused", refused);
  $("result-title").textContent = title;
  $("result-says").textContent = says;
  $("result-note").hidden = note === null;
  $("result-note").textContent = note === null ? "" : JSON.stringify(note, null, 2);
};

function draw(): void {
  const state = signer.state;
  $("out").hidden = state !== "locked";
  $("in").hidden = state !== "unlocked";
  // "none" for a moment is only the signer loading: say nothing is there once it has had time to answer.
  $("none").hidden = !(state === "none" && waited);
  if (state === "unlocked" && signer.pubkey) {
    const name = signer.name ?? shortNpub(signer.pubkey);
    $("name").textContent = name;
    // With no name, the short key is the name: it isn't said twice.
    $("npub").textContent = signer.name ? shortNpub(signer.pubkey) : "";
    $("npub").title = encodeNpub(signer.pubkey);
    $("who").textContent = `Signed in as ${name}`;
  } else {
    $("who").textContent = state === "locked" ? "Not signed in" : waited ? "No sign-in address answered" : "Looking for your sign-in address.";
    $("result").hidden = true;
  }
}
signer.onChange(draw);
draw();

$("sign-in").addEventListener("click", () => {
  $("blocked").hidden = signer.unlock();
});
$("sign-out").addEventListener("click", () => signer.lock());
$("sign").addEventListener("click", async () => {
  const words = ($("words") as HTMLTextAreaElement).value.trim();
  if (!words) return show("Nothing to sign", "Write something first.", null, true);
  ($("sign") as HTMLButtonElement).disabled = true;
  const note = await signer.sign({ kind: 1, content: words, tags: [] });
  ($("sign") as HTMLButtonElement).disabled = false;
  if (!note) return show("The signer said no", "Either it is locked again, or this site has asked for too many in a minute. It never says which.", null, true);
  show("Signed", "The signature checks out, by the key you signed in with. The signer dated it and added the tag naming this site. Nothing was sent anywhere.", note);
});
$("forbidden").addEventListener("click", async () => {
  // A change to their profile: something a site like this may not have signed.
  const note = await signer.sign({ kind: 0, content: JSON.stringify({ name: "Not you any more" }), tags: [] });
  if (note) show("That should not have been signed", "This site asked to rewrite your profile, and the signer agreed. That is a fault.", note, true);
  else show("Refused", "This site asked the signer to rewrite your profile. It may sign notes and reactions for a site, and nothing else, so it said no. It doesn't say why.", null, true);
});
