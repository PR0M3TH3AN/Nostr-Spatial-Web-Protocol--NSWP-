import { describe, expect, it } from "vitest";
import { FRESH_HEADER, servedFresh } from "../src/index.js";

describe("whether a world is served so a visitor always gets its latest", () => {
  it("is, where a browser must ask before it uses a copy it kept", () => {
    for (const header of ["no-cache", "no-store", "public, max-age=0, must-revalidate", "max-age=0", "private, no-cache, max-age=3600", "No-Cache", 'max-age="0"', FRESH_HEADER]) expect(servedFresh(header), header).toBe(true);
  });
  it("isn't, where a browser may go on using its copy without asking", () => {
    for (const header of ["public, max-age=600", "max-age=31536000, immutable", "public", "must-revalidate", "s-maxage=0", "max-age=abc", "max-age=-1"]) expect(servedFresh(header), header).toBe(false);
  });
  it("isn't, where nothing is said: a browser then guesses, and its guess can be days", () => {
    for (const header of [null, undefined, "", "   "]) expect(servedFresh(header)).toBe(false);
  });
});
