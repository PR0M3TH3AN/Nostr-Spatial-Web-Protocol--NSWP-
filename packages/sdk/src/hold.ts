/**
 * Whether a thing may be taken in hand, and whether the visitor has let its own code run: the rules and the words,
 * the same whatever draws the world or the Bag.
 *
 * It is a file of its own, with no renderer in it, so that a client's page can run the kit's Bag (`nswp-sdk/bag`)
 * without loading one. Moved out of play.ts word for word; play.ts still hands these on.
 */
import { cleanItemsRule, type Item } from "@nswp/core";
import { showsItems } from "./item-store.js";

const SCRIPT_KEPT = "nswp:item-scripts";

/** Whether this visitor has let an item's script run: by its hash, so a changed script is asked about again. */
export function scriptAllowed(sha256: string): boolean {
  try {
    return (JSON.parse(globalThis.localStorage?.getItem(SCRIPT_KEPT) ?? "[]") as unknown[]).includes(sha256);
  } catch {
    return false;
  }
}

export function allowScript(sha256: string): void {
  try {
    const kept = (JSON.parse(globalThis.localStorage?.getItem(SCRIPT_KEPT) ?? "[]") as unknown[]).filter((x): x is string => typeof x === "string" && x !== sha256);
    globalThis.localStorage?.setItem(SCRIPT_KEPT, JSON.stringify([...kept, sha256].slice(-64)));
  } catch {
    /* a private window: for this page only */
  }
}

/**
 * Whether a thing may be taken in hand here, and the words for it where it may not: the same rules and the same
 * words whatever draws the world. `asked` remembers the script the visitor was last told about, so that a second
 * press on the same item is their yes to it.
 */
export function mayHold(described: Item | null, o: { rule: string; scripts: boolean; asked: { sha: string } }): { ok: true } | { ok: false; said: string } {
  if (cleanItemsRule(o.rule) === "none") return { ok: false, said: "Nothing carried is drawn or works in this place." };
  if (!showsItems()) return { ok: false, said: "You have items turned off. Turn them on to hold one." };
  if (!described) return { ok: false, said: "That item's description couldn't be found." };
  if (!(described.behaviors.includes("holdable") || described.fits.includes("hand-right") || described.fits.includes("hand-left"))) return { ok: false, said: `${described.title} isn't something to hold.` };
  // An item that must be granted needs its maker's grant checked, which nothing here does yet.
  if (described.use === "granted") return { ok: false, said: `${described.title} has to be granted by its maker, which can't be checked here yet.` };
  // An item that does things of its own runs its maker's code, shut away. They are told so, and who wrote it, the
  // first time: a second press lets it. A changed script is asked about again.
  if (described.script && o.scripts && !scriptAllowed(described.script.sha256)) {
    if (o.asked.sha !== described.script.sha256) {
      o.asked.sha = described.script.sha256;
      return { ok: false, said: `${described.title} does things of its own, with code written by its maker (${described.maker.slice(0, 8)}…). It runs shut away on your device: it can't reach the network, your account or anything of this world. Press Hold again to let it.` };
    }
    allowScript(described.script.sha256);
  }
  return { ok: true };
}
