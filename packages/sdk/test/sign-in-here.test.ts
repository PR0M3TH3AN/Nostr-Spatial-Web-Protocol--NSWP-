import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A "Sign in" row wherever a tab says to sign in (the owner, 2026-11-25: "can we have a "sign in" button anywhere in
 * the menus that we say something like "sign into bitlogin to use this feature""). Its press is You's sign-in row's,
 * in one press; it isn't there once signed in, or where nobody can sign in. The signer is a stand-in.
 */
type Fake = { state: "none" | "locked" | "unlocked"; asking: boolean; unanswered: boolean; host: string | null; panel: boolean; pubkey: string | null; name: string | null; unlock: ReturnType<typeof vi.fn>; lock: ReturnType<typeof vi.fn> };
/** The page keeps one signer (worldSigner): each test changes this one, never makes another. */
const fake = {} as Fake;
vi.mock("../src/signer.js", async (original) => ({
  ...(await original<typeof import("../src/signer.js")>()),
  createWorldSigner: () =>
    Object.assign(fake, { more: [], remembered: true, copy: null, onChange: () => () => {}, retry: () => true }),
}));
const { createControls } = await import("../src/ui/model.js");
const { signInHere } = await import("../src/ui.js");
const { signerAction } = await import("../src/ui/identity.js");
const { addAchievementControls } = await import("../src/achieving.js");
const { addScoreControls } = await import("../src/scoring.js");

const signedOut = (): Fake => ({ state: "locked", asking: false, unanswered: false, host: "signin.example", panel: false, pubkey: null, name: null, unlock: vi.fn(() => true), lock: vi.fn() });
const row = (c: ReturnType<typeof createControls>, section: string) => c.view().sections.find((s) => s.id === section)?.items ?? [];
const shownIds = (c: ReturnType<typeof createControls>) => c.view().sections.flatMap((s) => s.items.map((i) => i.id));

afterEach(() => vi.restoreAllMocks());

describe("a Sign in row where a tab says to sign in", () => {
  it("is named for its tab, and isn't there with nothing to sign in with", () => {
    Object.assign(fake, signedOut());
    const c = createControls({ title: "A world" });
    c.addSection({ id: "my-tab", label: "Mine" });
    c.add(signInHere(c, "my-tab"), { id: "mine", section: "my-tab", label: "Something", act: () => {} });
    // No sign-in row of You's in these controls: nothing to do it with.
    expect(row(c, "my-tab").map((i) => i.id)).toEqual(["mine"]);
    expect(c.run("sign-in-my-tab")).toBe(false);
  });

  it("does what You's row does, in one press, and is at the top of its tab", () => {
    Object.assign(fake, signedOut());
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    c.addSection({ id: "my-tab", label: "Mine" });
    c.add(signInHere(c, "my-tab"), { id: "mine", section: "my-tab", label: "Something", act: () => {} });
    const [first] = row(c, "my-tab");
    expect(first).toMatchObject({ id: "sign-in-my-tab", label: "Sign in, at signin.example", short: "Sign in", tone: "primary" });
    const said: string[] = [];
    c.onSay((t) => said.push(t));
    expect(c.run("sign-in-my-tab")).toBe(true);
    return Promise.resolve().then(() => {
      expect(fake.unlock).toHaveBeenCalledTimes(1);
      expect(said).toEqual(["A window from signin.example has opened. Say yes there, and you are signed in here."]);
    });
  });

  it("says, as You's does, that the sign-in address is being asked again or didn't answer", () => {
    Object.assign(fake, signedOut(), { unanswered: true });
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    c.add(signInHere(c, "my-tab"));
    expect(row(c, "my-tab")[0]?.label).toBe("signin.example didn't answer. Press to ask again");
    fake.unanswered = false;
    fake.asking = true;
    expect(row(c, "my-tab")[0]?.label).toBe("Asking signin.example again…");
  });

  it("is gone once signed in, and never signs anyone out", async () => {
    Object.assign(fake, signedOut(), { state: "unlocked", pubkey: "a".repeat(64) });
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    c.add(signInHere(c, "my-tab"));
    expect(shownIds(c).filter((id) => id.startsWith("sign-in-"))).toEqual([]);
    expect(c.run("sign-in-my-tab")).toBe(false);
    await Promise.resolve();
    expect(fake.lock).not.toHaveBeenCalled();
  });

  it("isn't there where no sign-in address was named", () => {
    Object.assign(fake, signedOut(), { state: "none", host: null });
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    c.add(signInHere(c, "my-tab"));
    expect(row(c, "my-tab")).toEqual([]);
  });
});

describe("the kit's tabs that say to sign in", () => {
  it("Achievements: at the top while something earned waits to be shown, and gone once signed in", () => {
    Object.assign(fake, signedOut());
    let signedIn = false;
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    const achievements = {
      list: [{ id: "first", title: "First steps" }],
      earned: () => ["first"],
      shown: () => [],
      holders: () => new Promise<never>(() => {}),
      show: async () => ({ ok: false, said: "" }),
      onChange: () => () => {},
      onEarn: () => () => {},
    };
    const tab = addAchievementControls(c, { achievements: achievements as never, signedIn: () => signedIn });
    expect(row(c, "achievements").map((i) => i.id).slice(0, 2)).toEqual(["sign-in-achievements", "achievements-show"]);
    signedIn = true;
    fake.state = "unlocked";
    tab.refresh();
    expect(shownIds(c).filter((id) => id.startsWith("sign-in-"))).toEqual([]);
  });

  it("Scores: at the top while a best of theirs waits to be posted, and not before there is one", () => {
    Object.assign(fake, signedOut());
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    let best: number | null = null;
    const scores = {
      boards: [{ id: "laps", title: "Laps" }],
      best: () => best,
      posted: () => null,
      words: (_: string, n: number) => `${n} laps`,
      standings: () => new Promise<never>(() => {}),
      post: async () => ({ ok: false, said: "" }),
      onChange: () => () => {},
    };
    const tab = addScoreControls(c, { scores: scores as never, signedIn: () => false });
    expect(shownIds(c).filter((id) => id.startsWith("sign-in-"))).toEqual([]);
    best = 12;
    tab.refresh();
    expect(row(c, "scores").map((i) => i.id).slice(0, 2)).toEqual(["sign-in-scores", "scores-post-laps"]);
  });
});
