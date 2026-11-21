/**
 * A page that changes whenever what it is served with does.
 *
 * A browser that has a page asks its site whether the page has changed. If it hasn't, the site says so in a few
 * bytes, and the browser goes on using the copy it kept: with the headers that copy came with. Those headers hold
 * the page's content rules. So a release that changes a site's rules and leaves its HTML alone leaves everyone who
 * has been there before under the old rules, for as long as the HTML stays the same: reloading doesn't help.
 * (Kit 0.58.0 did exactly that: worlds that began to draw what visitors carry kept, for returning visitors, the
 * rules that stopped them fetching it.)
 *
 * So every page a build writes is marked with the kit it was built from and a mark of everything it is served
 * with. Either changing changes the page, and a browser is then given the page, and its headers, afresh.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const MARK = /<meta name="nswp-built" content="[^"]*">\n?/i;

/** The mark itself: the kit, and sixteen characters that change with `rules` (the headers the page is served with, in any form). */
export function builtMark(kit: string, rules: unknown): string {
  return `${kit} ${bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(rules ?? null)))).slice(0, 16)}`;
}

/** `html` with its mark put in, or put right: in its head where it has one, and at its end where it doesn't. */
export function stampPage(html: string, kit: string, rules: unknown): string {
  const meta = `<meta name="nswp-built" content="${builtMark(kit, rules).replace(/[^\w. -]/g, "")}">\n`;
  const bare = html.replace(MARK, "");
  const at = bare.search(/<\/head>/i);
  return at < 0 ? `${bare}${bare.endsWith("\n") ? "" : "\n"}${meta}` : `${bare.slice(0, at)}${meta}${bare.slice(at)}`;
}
