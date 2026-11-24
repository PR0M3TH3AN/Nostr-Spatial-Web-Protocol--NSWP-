// A trial's pages: the few pages a trial needs a real device to open (trials/pages/), a headset's browser say.
//
// They are answered by the local service (scripts/serve-local.mjs) under ONE site's local copy, at /trial-pages/,
// and nowhere else. Read straight from trials/pages/, never copied into a site's build: a file in a served build
// could go out with the next deploy, and a trial's page is never deployed. They are sent with that site's own
// headers, so a page here runs under the content rules a world's page runs under.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, normalize, sep } from "node:path";

/** Where they are answered, under the one site's local copy. */
export const TRIAL_PAGES_PATH = "/trial-pages/";
/** The one site whose local copy answers for them, by the name the local service gives it. */
export const TRIAL_PAGES_SITE = "The Gallery";

/**
 * What a request for `path` of `site`'s local copy comes to, with the trials' pages kept in the folder `pages`.
 *
 * - `null`: not a trial's page. The site answers as it always did, from its own build.
 * - `{ file }`: this file, from `pages`.
 * - `{ redirect }`: a folder asked for without its closing slash; a page's own files are found beside it.
 * - `{ status }`: refused (403) or not there (404).
 *
 * `path` is the request's path, already decoded. Nothing outside `pages` is ever named, however the path is written.
 */
export function trialPage(site, path, pages) {
  if (site !== TRIAL_PAGES_SITE) return null;
  if (path !== TRIAL_PAGES_PATH.slice(0, -1) && !path.startsWith(TRIAL_PAGES_PATH)) return null;
  const rest = path.slice(TRIAL_PAGES_PATH.length);
  // No way up and out, no hidden file, and nothing a file's name can't hold.
  if (/[\0\\]/.test(rest) || rest.split("/").some((part) => part === ".." || part.startsWith("."))) return { status: 403 };
  const file = normalize(join(pages, rest));
  if (file !== pages && !file.startsWith(pages + sep)) return { status: 403 };
  if (!existsSync(file)) return { status: 404 };
  if (!statSync(file).isDirectory()) return { file };
  if (!path.endsWith("/")) return { redirect: `${path}/` };
  const index = join(file, "index.html");
  // A folder with no page of its own is not listed.
  return existsSync(index) ? { file: index } : { status: 404 };
}

/** Each page there is, as the path it is answered at: a folder of `pages` with an `index.html` in it. */
export function trialPagesIn(pages) {
  if (!existsSync(pages)) return [];
  return readdirSync(pages, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && existsSync(join(pages, e.name, "index.html")))
    .map((e) => `${TRIAL_PAGES_PATH}${e.name}/`)
    .sort();
}
