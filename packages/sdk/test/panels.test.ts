/** What a panel is, as data: what may be kept, where a new one goes, and how a note is laid out. */
import { describe, expect, it } from "vitest";
import { cleanLibrary, cleanPlace, cleanRecords, cleanSource, facing, inFront, LIBRARY_LIMITS, libraryPage, newId, PANEL_LIMITS, wrapText } from "../src/panel-store.js";

const place = { position: [1, 1.5, -2] as [number, number, number], yaw: 90, pitch: 0, width: 1 };
const note = { kind: "note" as const, title: "Read me", text: "Hello\nthere" };

describe("what a panel may show", () => {
  it("is a note, a picture or a video, and nothing else", () => {
    expect(cleanSource(note)).toEqual(note);
    expect(cleanSource({ kind: "picture", title: "", src: "/pictures/a.webp" })).toEqual({ kind: "picture", title: "", src: "/pictures/a.webp" });
    expect(cleanSource({ kind: "video", title: "Clip", src: "kept:p-abc123defg" })).toMatchObject({ kind: "video", src: "kept:p-abc123defg" });
    expect(cleanSource({ kind: "web", url: "https://example.com/" })).toBeNull();
    expect(cleanSource({ kind: "custom", title: "x" })).toBeNull(); // a page's own texture is never kept
    expect(cleanSource(null)).toBeNull();
  });

  it("never takes a script or an odd address for a picture", () => {
    for (const src of ["javascript:alert(1)", "data:text/html,<script>", "http://plain.example/a.png", "file:///etc/passwd", "", "x".repeat(3000)]) {
      expect(cleanSource({ kind: "picture", title: "", src }), src.slice(0, 30)).toBeNull();
    }
    expect(cleanSource({ kind: "picture", title: "", src: "https://media.example/a.png" })).not.toBeNull();
  });

  it("tidies a title to one line, and keeps a note's line breaks", () => {
    const s = cleanSource({ kind: "note", title: "  A\ntitle  ", text: "one\ntwo" });
    expect(s).toEqual({ kind: "note", title: "A title", text: "one\ntwo" });
    expect(cleanSource({ kind: "note", title: "", text: "   " })).toBeNull(); // nothing to show
    const long = cleanSource({ kind: "note", title: "t".repeat(200), text: "x".repeat(9000) }) as { title: string; text: string };
    expect([long.title.length, long.text.length]).toEqual([PANEL_LIMITS.titleChars, PANEL_LIMITS.noteChars]);
  });
});

describe("where a panel may hang", () => {
  it("keeps a sensible place and refuses a senseless one", () => {
    expect(cleanPlace(place)).toEqual(place);
    expect(cleanPlace({ ...place, width: 99 })?.width).toBe(PANEL_LIMITS.maxWidth);
    expect(cleanPlace({ ...place, width: 0.01 })?.width).toBe(PANEL_LIMITS.minWidth);
    expect(cleanPlace({ ...place, yaw: -90 })?.yaw).toBe(270);
    expect(cleanPlace({ ...place, pitch: 200 })?.pitch).toBe(60);
    expect(cleanPlace({ ...place, position: [0, NaN, 0] })).toBeNull();
    expect(cleanPlace({ ...place, position: [0, 0, 1e9] })).toBeNull();
    expect(cleanPlace({ ...place, position: [0, 0] })).toBeNull();
    expect(cleanPlace("here")).toBeNull();
  });

  it("turns to face the reader, leaning a little and never lying flat", () => {
    expect(facing([0, 1.6, -2], [0, 1.6, 0])).toEqual({ yaw: 0, pitch: -0 });
    expect(facing([2, 1.6, 0], [0, 1.6, 0]).yaw).toBeCloseTo(270);
    expect(facing([0, 1.6, 2], [0, 1.6, 0]).yaw).toBeCloseTo(180);
    expect(facing([0, 3, -1], [0, 1.6, 0]).pitch).toBeGreaterThan(0); // above the eyes: it leans down to them
    expect(facing([0, 30, -1], [0, 1.6, 0]).pitch).toBe(35);
    expect(facing([0, 5, 0], [0, 1.6, 0])).toEqual({ yaw: 0, pitch: 0 }); // straight overhead: nothing to turn to
  });

  it("puts a new one in front of the visitor, and the next beside it", () => {
    const first = inFront([0, 1.6, 0], 0);
    expect(first[0]).toBeCloseTo(0);
    expect(first[2]).toBeCloseTo(-1.3);
    expect(first[1]).toBeCloseTo(1.55);
    const turned = inFront([0, 1.6, 0], 90); // facing -X
    expect(turned[0]).toBeCloseTo(-1.3);
    expect(turned[2]).toBeCloseTo(0);
    // Each one after hangs further round, right then left, all at the same reach, and none on another.
    const spots = [0, 1, 2, 3, 4].map((n) => inFront([0, 1.6, 0], 0, n));
    for (const s of spots) expect(Math.hypot(s[0], s[2])).toBeCloseTo(1.3);
    expect(spots[1]![0]).toBeGreaterThan(0.5);
    expect(spots[2]![0]).toBeLessThan(-0.5);
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i]![0] - spots[j]![0], spots[i]![2] - spots[j]![2])).toBeGreaterThan(1);
  });
});

describe("what is kept between visits", () => {
  const record = { id: "p-abc123defg", source: note, place };

  it("comes back as it was", () => {
    expect(cleanRecords(JSON.parse(JSON.stringify([record])))).toEqual([record]);
  });

  it("drops anything that isn't what it claims to be", () => {
    const junk = [null, 4, { id: "p-abc123defg" }, { ...record, id: "NO" }, { ...record, id: "p-other12345", place: { ...place, position: "x" } }, { ...record, id: "p-other67890", source: { kind: "web", url: "https://x.example" } }];
    expect(cleanRecords(junk)).toEqual([]);
    expect(cleanRecords("nope")).toEqual([]);
    expect(cleanRecords([record, record]).length).toBe(1); // the same panel twice is one panel
  });

  it("forgets a page's temporary address, which means nothing next time", () => {
    expect(cleanRecords([{ ...record, source: { kind: "picture", title: "", src: "blob:https://a.example/123" } }])).toEqual([]);
  });

  it("stops at the limit", () => {
    const many = Array.from({ length: PANEL_LIMITS.count + 6 }, (_, i) => ({ ...record, id: `p-${String(i).padStart(10, "0")}` }));
    expect(cleanRecords(many).length).toBe(PANEL_LIMITS.count);
  });

  it("names panels unguessably enough, in the shape it will accept back", () => {
    const id = newId();
    expect(id).toMatch(/^p-[a-z0-9]{10}$/);
    expect(cleanRecords([{ ...record, id }]).length).toBe(1);
  });
});

describe("laying out a note", () => {
  const measure = (s: string) => s.length; // one unit a character

  it("wraps at words, keeps blank lines, and cuts a word too long to fit", () => {
    expect(wrapText("one two three four", 9, measure)).toEqual(["one two", "three", "four"]);
    expect(wrapText("a\n\nb", 9, measure)).toEqual(["a", "", "b"]);
    expect(wrapText("abcdefghijklmnop", 5, measure)).toEqual(["abcde", "fghij", "klmno", "p"]);
  });

  it("stops at a number of lines and says there was more", () => {
    const lines = wrapText(Array(100).fill("word").join("\n"), 9, measure, 5);
    expect(lines.length).toBe(5);
    expect(lines[4]!.endsWith("…")).toBe(true);
  });
});

describe("the library of a visitor's own files", () => {
  const item = { id: "p-abc123defg", kind: "picture" as const, title: "The grove", bytes: 1200, addedAt: 100, thumb: "data:image/jpeg;base64,AAAA" };

  it("comes back as it was, newest first", () => {
    const older = { ...item, id: "p-older12345", addedAt: 50 };
    expect(cleanLibrary(JSON.parse(JSON.stringify([older, item])))).toEqual([item, older]);
  });

  it("keeps a thumbnail only if it is a small picture, never an address to fetch", () => {
    for (const thumb of ["https://tracker.example/pixel.png", "data:text/html;base64,AAAA", "data:image/svg+xml;base64,AAAA", "javascript:alert(1)", `data:image/jpeg;base64,${"A".repeat(LIBRARY_LIMITS.thumbChars)}`]) {
      expect(cleanLibrary([{ ...item, thumb }])[0]!.thumb, thumb.slice(0, 30)).toBe("");
    }
    expect(cleanLibrary([{ ...item, thumb: "data:image/webp;base64,AA+/=" }])[0]!.thumb).toBe("data:image/webp;base64,AA+/=");
  });

  it("drops what isn't a picture or a video, and counts a file once", () => {
    expect(cleanLibrary([{ ...item, kind: "note" }, { ...item, id: "bad id" }, null, 7])).toEqual([]);
    expect(cleanLibrary([item, item]).length).toBe(1);
    expect(cleanLibrary("nope")).toEqual([]);
    expect(cleanLibrary([{ ...item, title: "  two\nlines ", bytes: -4, addedAt: "soon" }])[0]).toMatchObject({ title: "two lines", bytes: 0, addedAt: 0 });
  });

  it("stops at its limit, keeping the newest", () => {
    const many = Array.from({ length: LIBRARY_LIMITS.count + 5 }, (_, i) => ({ ...item, id: `p-${String(i).padStart(10, "0")}`, addedAt: i }));
    const kept = cleanLibrary(many);
    expect(kept.length).toBe(LIBRARY_LIMITS.count);
    expect(kept[0]!.addedAt).toBe(LIBRARY_LIMITS.count + 4);
  });

  it("is shown a page at a time", () => {
    const all = Array.from({ length: 19 }, (_, i) => i);
    expect(libraryPage(all, 0, 8)).toEqual({ items: [0, 1, 2, 3, 4, 5, 6, 7], page: 0, pages: 3 });
    expect(libraryPage(all, 2, 8).items).toEqual([16, 17, 18]);
    expect(libraryPage(all, 9, 8).page).toBe(2); // past the end is the last page
    expect(libraryPage(all, -3, 8).page).toBe(0);
    expect(libraryPage([], 0, 8)).toEqual({ items: [], page: 0, pages: 1 });
  });
});
