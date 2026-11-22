import { describe, expect, it } from "vitest";
import { DOWNLOAD_WARN_MB, parseManifest, worldDownload } from "../src/index.js";

/**
 * How big a world says its first download is, for the Airlock to say before the visitor crosses (protocol/02-doors.md,
 * "What an Airlock does"; docs/backlog/game-worlds-kit-gaps.md, gap e). It is the world's own claim, and worded so.
 */
const manifestSaying = (budgets: unknown) =>
  parseManifest({ schema: "nswp/manifest/0.3", publishers: { ["a".repeat(64)]: { worlds: ["w"] } }, worlds: { w: { entry: { url: "https://w.example/", modes: ["inline-3d"] }, ...(budgets === undefined ? {} : { budgets }) } } });
const worldOf = (budgets: unknown) => {
  const r = manifestSaying(budgets);
  if (!r.ok) throw new Error("the manifest didn't read");
  return r.value.worlds.w!;
};

describe("how big a world says it is", () => {
  it("is read from the manifest's budgets, as the world's own word", () => {
    expect(worldDownload(worldOf({ initial_download_mb: 45 }))).toEqual({ mb: 45, words: "The world says about 45 MB to download", heavy: false });
  });

  it("is a lot on a phone's data above 50 MB, and not at 50", () => {
    expect(DOWNLOAD_WARN_MB).toBe(50);
    expect(worldDownload(worldOf({ initial_download_mb: 50 }))!.heavy).toBe(false);
    expect(worldDownload(worldOf({ initial_download_mb: 120 }))).toEqual({ mb: 120, words: "The world says about 120 MB to download: a lot on a phone's data", heavy: true });
  });

  it("is said in a size a person reads at a glance", () => {
    expect(worldDownload(worldOf({ initial_download_mb: 0.4 }))!.words).toBe("The world says less than 1 MB to download");
    expect(worldDownload(worldOf({ initial_download_mb: 4.46 }))!.words).toBe("The world says about 4.5 MB to download");
    expect(worldDownload(worldOf({ initial_download_mb: 1234 }))!.words).toBe("The world says about 1.2 GB to download: a lot on a phone's data");
  });

  it("says nothing where the world says nothing, or something that isn't a size", () => {
    expect(worldDownload(worldOf(undefined))).toBeNull();
    expect(worldDownload(worldOf({}))).toBeNull();
    expect(worldDownload(worldOf({ initial_download_mb: "45" }))).toBeNull();
    expect(worldDownload({ budgets: { initialDownloadMb: -3 } })).toBeNull();
    expect(worldDownload({ budgets: { initialDownloadMb: Number.POSITIVE_INFINITY } })).toBeNull();
    expect(worldDownload(null)).toBeNull();
  });
});
