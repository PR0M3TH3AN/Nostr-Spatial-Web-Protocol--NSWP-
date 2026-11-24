import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error a plain script, with no types of its own
import { TRIAL_PAGES_PATH, TRIAL_PAGES_SITE, trialPage, trialPagesIn } from "../../../scripts/trial-pages.mjs";

/**
 * A trial's pages (trials/pages/; scripts/trial-pages.mjs): the few pages a trial needs a real device to open. The
 * first is the one for the owner's Quest (docs/plans/headset-menu.md). They are answered by the local service
 * under the Gallery's local copy and nowhere else, and are never deployed: a file dropped into a served build could
 * go out with the next deploy, so none is ever in one. These hold that.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const pages = join(root, "trials", "pages");

describe("a trial's pages are answered under the Gallery's local copy, and nowhere else", () => {
  it("the Gallery answers for the Quest's page, and for the script beside it", () => {
    expect(TRIAL_PAGES_PATH).toBe("/trial-pages/");
    expect(TRIAL_PAGES_SITE).toBe("The Gallery");
    expect(trialPage("The Gallery", "/trial-pages/quest-picture/", pages)).toEqual({ file: join(pages, "quest-picture", "index.html") });
    expect(trialPage("The Gallery", "/trial-pages/quest-picture/picture.js", pages)).toEqual({ file: join(pages, "quest-picture", "picture.js") });
    expect(trialPagesIn(pages)).toContain("/trial-pages/quest-picture/");
  });

  it("no other site does: the request is the site's own, to answer from its build as it always did", () => {
    for (const site of ["BitPortal", "The Grove", "The Tour", "The Arcade", "The Observatory", "The Workshop", "The Library", "The world template", "The Foundry (made in Godot)", "BitLogin's own site", "the gallery", ""]) {
      expect(trialPage(site, "/trial-pages/quest-picture/", pages)).toBeNull();
      expect(trialPage(site, "/trial-pages/quest-picture/picture.js", pages)).toBeNull();
    }
  });

  it("and the Gallery's own pages are still its own", () => {
    for (const path of ["/", "/index.html", "/app.js", "/item-box.html", "/trial-pages-of-mine/", "/xr-test/", "/.well-known/nswp.json"]) expect(trialPage("The Gallery", path, pages)).toBeNull();
  });

  // A folder of this test's own, with a file beside it that must never be reached.
  const scratch = mkdtempSync(join(tmpdir(), "nswp-trial-pages-"));
  const mine = join(scratch, "pages");
  mkdirSync(join(mine, "one"), { recursive: true });
  mkdirSync(join(mine, "no-page"), { recursive: true });
  writeFileSync(join(mine, "one", "index.html"), "<!doctype html>");
  writeFileSync(join(mine, "one", "a.js"), "");
  writeFileSync(join(mine, "one", ".kept"), "");
  writeFileSync(join(mine, "no-page", "a.js"), "");
  writeFileSync(join(scratch, "secret.txt"), "not a page");
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it("nothing outside the pages' folder is named, however the path is written", () => {
    for (const path of ["/trial-pages/../secret.txt", "/trial-pages/one/../../secret.txt", "/trial-pages/..", "/trial-pages/one/..%2f..%2fsecret.txt", "/trial-pages/..\\secret.txt", "/trial-pages/one/\0", "/trial-pages/one/.kept", "/trial-pages/.git/config"]) {
      const got = trialPage("The Gallery", path, mine);
      expect(got, path).not.toBeNull();
      expect(got.file, path).toBeUndefined();
      expect([403, 404], path).toContain(got.status);
    }
    expect(trialPage("The Gallery", "/trial-pages/../secret.txt", mine)).toEqual({ status: 403 });
  });

  it("a folder is its own page or nothing: never a list, and sent on to its closing slash", () => {
    expect(trialPage("The Gallery", "/trial-pages/one/", mine)).toEqual({ file: join(mine, "one", "index.html") });
    expect(trialPage("The Gallery", "/trial-pages/one", mine)).toEqual({ redirect: "/trial-pages/one/" });
    expect(trialPage("The Gallery", "/trial-pages/one/a.js", mine)).toEqual({ file: join(mine, "one", "a.js") });
    expect(trialPage("The Gallery", "/trial-pages/", mine)).toEqual({ status: 404 });
    expect(trialPage("The Gallery", "/trial-pages", mine)).toEqual({ redirect: "/trial-pages/" });
    expect(trialPage("The Gallery", "/trial-pages/no-page/", mine)).toEqual({ status: 404 });
    expect(trialPage("The Gallery", "/trial-pages/none/", mine)).toEqual({ status: 404 });
    expect(trialPagesIn(mine)).toEqual(["/trial-pages/one/"]);
    expect(trialPagesIn(join(scratch, "not-there"))).toEqual([]);
  });
});

describe("a trial's page is never deployed", () => {
  /** Every file under a folder, as paths from it. */
  const filesIn = (dir: string, from = ""): string[] => readdirSync(join(dir, from), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesIn(dir, join(from, e.name)) : [join(from, e.name)]));
  // What is deployed is each site's build (scripts/deploy-sites.mjs sends `sites/<name>/dist`), and the Godot
  // example's. The gate builds the sites before it runs this; a build that isn't there has nothing in it to carry.
  const builds = [...readdirSync(join(root, "sites"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(root, "sites", e.name, "dist")), join(root, "engines", "godot", "dist")].filter((dist) => existsSync(dist));
  // The names a trial's page would be known by in a build: its folder, and every file of it but a page's usual name.
  const names = existsSync(pages) ? filesIn(pages).flatMap((f) => [f.split(/[\\/]/)[0], f.split(/[\\/]/).at(-1) as string]).filter((n) => n !== "index.html") : [];

  it("there is a page to ask about, or this test holds nothing", () => {
    expect(names).toContain("quest-picture");
    expect(names).toContain("picture.js");
  });

  it("no site's build carries one", () => {
    for (const dist of builds) {
      expect(existsSync(join(dist, "trial-pages")), `${dist} has a trial-pages folder`).toBe(false);
      const carried = filesIn(dist).filter((f) => f.split(/[\\/]/).some((part) => part === "trial-pages" || names.includes(part)));
      expect(carried, `${dist} carries a trial's page`).toEqual([]);
    }
  });

  it("what builds and what deploys read nothing of the trials", () => {
    for (const script of ["build-sites.mjs", "deploy-sites.mjs", "release-all.mjs", "release-prepare.mjs", "build-godot-example.mjs", "build-engine.mjs"]) {
      const text = readFileSync(join(root, "scripts", script), "utf8");
      expect(/trial/i.test(text), `scripts/${script} names the trials`).toBe(false);
    }
  });

  it("the page has no script written into it, which the Gallery's rules would refuse", () => {
    for (const path of trialPagesIn(pages)) {
      const html = readFileSync(join(pages, path.slice(TRIAL_PAGES_PATH.length), "index.html"), "utf8");
      const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
      expect(scripts.length, path).toBeGreaterThan(0);
      for (const [, attrs, body] of scripts) {
        // Its own file, beside it: nothing from another site, and nothing between the tags.
        expect(/\bsrc="[\w.-]+\.js"/.test(attrs), `${path}: ${attrs}`).toBe(true);
        expect(body.trim(), path).toBe("");
      }
      expect(/\son[a-z]+\s*=/i.test(html), `${path} has a handler written into an element`).toBe(false);
      expect(/https?:\/\/(?!www\.w3\.org\/)/i.test(html), `${path} names another site`).toBe(false);
    }
  });
});
