import { beforeEach, describe, expect, it } from "vitest";
import { loadPicture, onPicturesChange, resetPictures, setShowsPictures, showsPictures } from "../src/picture.js";
import { arriveWith, currentSettings, resetSettings } from "../src/settings.js";

beforeEach(() => {
  resetSettings();
  resetPictures();
});

describe("seeing other people's pictures", () => {
  it("is on until the visitor says otherwise, and goes on with them", () => {
    expect(showsPictures()).toBe(true);
    expect(currentSettings().pictures).toBe(true);
  });

  it("begins as they arrived", () => {
    arriveWith({ pictures: false });
    expect(showsPictures()).toBe(false);
    expect(currentSettings().pictures).toBe(false);
  });

  it("is theirs to turn off, and whoever draws people hears of it", () => {
    let told = 0;
    onPicturesChange(() => told++);
    setShowsPictures(false);
    expect(showsPictures()).toBe(false);
    expect(currentSettings().pictures).toBe(false);
    expect(told).toBe(1);
  });

  it("fetches nothing when they are off, and nothing that isn't an https address", async () => {
    let fetched = 0;
    const real = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetched++;
      throw new Error("not in this test");
    }) as typeof fetch;
    try {
      setShowsPictures(false);
      expect(await loadPicture("https://pictures.example/a.webp")).toBeNull();
      setShowsPictures(true);
      for (const bad of ["http://pictures.example/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA", "", null]) expect(await loadPicture(bad)).toBeNull();
      expect(fetched).toBe(0);
    } finally {
      globalThis.fetch = real;
    }
  });
});
