import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * No merge left half done in any file the repository keeps (the orchestrator, 2026-11-22: twice a merged CHANGELOG
 * still had conflict markers and the gate passed, since nothing reads past its newest numbered heading). A line that
 * starts a conflict, or ends one, or the line of `=` between them, is a merge nobody finished.
 *
 * A line of `=` on its own is also how Markdown underlines a heading, so it counts only between the two others.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
// Built, not written out, so this file has no such line in it itself.
const OPEN = `${"<".repeat(7)} `;
const SPLIT = "=".repeat(7);
const CLOSE = `${">".repeat(7)} `;

/** Where in `text` a merge was left unfinished: the 1-based line numbers of each marker found. */
export function unfinishedMerges(text: string): number[] {
  const found: number[] = [];
  let inside = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.startsWith(OPEN)) {
      inside = true;
      found.push(i + 1);
    } else if (line.startsWith(CLOSE)) {
      inside = false;
      found.push(i + 1);
    } else if (inside && line === SPLIT) found.push(i + 1);
  });
  return found;
}

/** Every file git keeps here, or null where this isn't a git checkout (a copy unpacked from an archive). */
const tracked = (): string[] | null => {
  try {
    return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
  } catch {
    return null;
  }
};

describe("no merge left half done", () => {
  it("finds the markers a merge leaves, and a heading's underline only between them", () => {
    const left = ["# What changed", "", `${OPEN}HEAD`, "- ours", SPLIT, "- theirs", `${CLOSE}main`, ""].join("\n");
    expect(unfinishedMerges(left)).toEqual([3, 5, 7]);
    // A Markdown heading underlined with `=`, and a line that only mentions a marker: neither is a merge.
    expect(unfinishedMerges(["A heading", SPLIT, "", `Text about ${OPEN}markers`].join("\n"))).toEqual([]);
    // Half a conflict is still one.
    expect(unfinishedMerges([`${CLOSE}theirs`].join("\n"))).toEqual([1]);
  });

  it("is in no text file the repository keeps", () => {
    const files = tracked();
    if (!files) return; // Not a git checkout: there is no list of what is kept to look through.
    expect(files.length).toBeGreaterThan(100);
    const left: string[] = [];
    for (const file of files) {
      let bytes: Buffer;
      try {
        bytes = readFileSync(join(root, file));
      } catch {
        continue; // Removed in the working copy and not yet committed: nothing to read.
      }
      // A file with a nought byte in its first stretch is not text (a model, a picture, a sound).
      if (bytes.subarray(0, 8000).includes(0)) continue;
      const lines = unfinishedMerges(bytes.toString("utf8"));
      if (lines.length) left.push(`${file}: line ${lines.join(", ")}`);
    }
    expect(left, "a merge left half done").toEqual([]);
  });
});
