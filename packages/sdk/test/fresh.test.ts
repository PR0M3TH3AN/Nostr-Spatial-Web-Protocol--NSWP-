import { describe, expect, it } from "vitest";
import { watchFresh } from "../src/fresh.js";

/** A watcher asked only when the test asks, with a mark, a clock and a count of reloads the test holds. */
const watcher = (o: { busy?: () => boolean } = {}) => {
  const held = { mark: "a" as string | null, ms: 0, reloads: 0, told: 0 };
  const fresh = watchFresh({ manual: true, stamp: async () => held.mark, now: () => held.ms, reload: () => held.reloads++, onStale: () => held.told++, ...(o.busy ? { busy: o.busy } : {}) });
  return { fresh, held, later: () => (held.ms += 60_000) };
};

describe("noticing that a world was updated while its page was open", () => {
  it("says nothing while what the page was made from is unchanged", async () => {
    const { fresh, held, later } = watcher();
    expect(await fresh.check()).toBe(false);
    later();
    expect(await fresh.check(true)).toBe(false);
    expect(fresh.stale).toBe(false);
    expect(held.reloads + held.told).toBe(0);
  });
  it("gives someone coming back to the tab the latest at once, when they have nothing in hand", async () => {
    const { fresh, held, later } = watcher();
    await fresh.check();
    held.mark = "b";
    later();
    expect(await fresh.check(true)).toBe(true);
    expect(held.reloads).toBe(1);
    expect(held.told).toBe(0);
  });
  it("tells someone who is in the middle of something, once, and leaves the reload to them", async () => {
    let busy = true;
    const { fresh, held, later } = watcher({ busy: () => busy });
    await fresh.check();
    held.mark = "b";
    later();
    await fresh.check(true);
    later();
    await fresh.check(true);
    expect(fresh.stale).toBe(true);
    expect(held.reloads).toBe(0);
    expect(held.told).toBe(1);
    // Done with what they were doing, and back at the tab: now it is loaded again.
    busy = false;
    later();
    await fresh.check(true);
    expect(held.reloads).toBe(1);
    fresh.reload();
    expect(held.reloads).toBe(2);
  });
  it("tells, and never reloads by itself, someone who is looking at the page when it finds out", async () => {
    const { fresh, held, later } = watcher();
    await fresh.check();
    held.mark = "b";
    later();
    expect(await fresh.check(false)).toBe(true);
    expect(held.reloads).toBe(0);
    expect(held.told).toBe(1);
  });
  it("takes no mark as no answer: a host that gives none, or a request that failed, is not an update", async () => {
    const { fresh, held, later } = watcher();
    await fresh.check();
    held.mark = null;
    later();
    expect(await fresh.check(true)).toBe(false);
    const none = watcher();
    none.held.mark = null;
    await none.fresh.check();
    none.held.mark = "b";
    none.later();
    expect(await none.fresh.check(true)).toBe(false);
    expect(held.reloads + none.held.reloads).toBe(0);
  });
  it("asks no more than twice a minute, however often they come and go", async () => {
    let asks = 0;
    let ms = 0;
    const fresh = watchFresh({ manual: true, stamp: async () => (asks++, "a"), now: () => ms });
    await fresh.check();
    for (let i = 0; i < 20; i++) {
      ms += 1000;
      await fresh.check(true);
    }
    expect(asks).toBe(1);
    ms += 30_000;
    await fresh.check(true);
    expect(asks).toBe(2);
  });
});
