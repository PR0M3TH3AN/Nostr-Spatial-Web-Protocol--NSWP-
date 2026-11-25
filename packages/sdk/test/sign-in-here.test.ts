import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A "Sign in" row wherever a tab says to sign in (the owner, 2026-11-25: "can we have a "sign in" button anywhere in
 * the menus that we say something like "sign into bitlogin to use this feature""). Its press is You's sign-in row's,
 * in one press; it isn't there once signed in, or where nobody can sign in. The signer is a stand-in.
 */
type Fake = { state: "none" | "locked" | "unlocked"; asking: boolean; unanswered: boolean; host: string | null; panel: boolean; pubkey: string | null; name: string | null; guest: boolean | null; unlock: ReturnType<typeof vi.fn>; lock: ReturnType<typeof vi.fn> };
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
const { signInFirst, guestHere } = await import("../src/ui/sign-in-here.js");
const { addAchievementControls } = await import("../src/achieving.js");
const { addScoreControls } = await import("../src/scoring.js");

const signedOut = (): Fake => ({ state: "locked", asking: false, unanswered: false, host: "signin.example", panel: false, pubkey: null, name: null, guest: null, unlock: vi.fn(() => true), lock: vi.fn() });
/** Signed in as a guest account the sign-in address made (protocol/10-identity.md, "A guest"). */
const asGuest = (): Fake => ({ ...signedOut(), state: "unlocked", pubkey: "c".repeat(64), guest: true });
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

describe("a press that needs signing in, made signed out", () => {
  it("says why, and starts the sign-in there and then, as You's row does", async () => {
    Object.assign(fake, signedOut());
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    const said: string[] = [];
    c.onSay((t) => said.push(t));
    signInFirst(c, "Sign in to follow people.");
    expect(fake.unlock).toHaveBeenCalledTimes(1);
    expect(said).toEqual(["Sign in to follow people.", "A window from signin.example has opened. Say yes there, and you are signed in here."]);
  });

  it("only says why where nobody can sign in, and never signs anyone out", () => {
    for (const state of ["none", "unlocked"] as const) {
      Object.assign(fake, signedOut(), { state, host: state === "none" ? null : "signin.example" });
      const c = createControls({ title: "A world" });
      c.add(signerAction(c));
      const said: string[] = [];
      c.onSay((t) => said.push(t));
      signInFirst(c, "Sign in to post a score.");
      expect(said, state).toEqual(["Sign in to post a score."]);
      expect(fake.unlock, state).not.toHaveBeenCalled();
      expect(fake.lock, state).not.toHaveBeenCalled();
    }
  });

  it("Show in Achievements and Post in Scores start it, with no word of where else to go", async () => {
    Object.assign(fake, signedOut());
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    const show = vi.fn(async () => ({ ok: false, said: "" }));
    const post = vi.fn(async () => ({ ok: false, said: "" }));
    addAchievementControls(c, { achievements: { list: [{ id: "first", title: "First steps" }], earned: () => ["first"], shown: () => [], holders: () => new Promise<never>(() => {}), show, onChange: () => () => {}, onEarn: () => () => {} } as never, signedIn: () => false });
    addScoreControls(c, { scores: { boards: [{ id: "laps", title: "Laps" }], best: () => 12, posted: () => null, words: (_: string, n: number) => `${n} laps`, standings: () => new Promise<never>(() => {}), post, onChange: () => () => {} } as never, signedIn: () => false });
    const said: string[] = [];
    c.onSay((t) => said.push(t));
    c.run("achievements-show");
    c.run("scores-post-laps");
    await new Promise((ok) => setTimeout(ok, 0));
    expect(fake.unlock).toHaveBeenCalledTimes(2);
    expect(show).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(said.filter((t) => t.startsWith("Sign in"))).toEqual(["Sign in to show what you have earned.", "Sign in to post a score."]);
    expect(said.some((t) => /under You/.test(t))).toBe(false);
  });
});

describe("a guest account, where a tab needs more than a guest may do", () => {
  it("is offered Secure this account, and its press opens that, not a sign-in or a sign-out", () => {
    Object.assign(fake, asGuest());
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    c.add(signInHere(c, "my-tab"));
    expect(guestHere(c)).toBe(true);
    const [first] = row(c, "my-tab");
    expect(first).toMatchObject({ id: "sign-in-my-tab", label: "Secure this account", short: "Secure" });
    const said: string[] = [];
    c.onSay((t) => said.push(t));
    c.run("sign-in-my-tab");
    return Promise.resolve().then(() => {
      expect(fake.unlock).not.toHaveBeenCalled();
      expect(fake.lock).not.toHaveBeenCalled();
      // No client frames this page in a test: BitPortal's menu is where it can be done.
      expect(said).toEqual(["Secure this account from BitPortal's menu: only signin.example's page there can see this guest."]);
    });
  });

  it("is asked to secure it first by a press that needs more, in one press", () => {
    Object.assign(fake, asGuest());
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    const said: string[] = [];
    c.onSay((t) => said.push(t));
    signInFirst(c, "Sign in to follow people.");
    expect(said[0]).toBe("Secure this account first.");
    expect(fake.unlock).not.toHaveBeenCalled();
  });

  it("is told under You what it is, and offered to secure it there", () => {
    Object.assign(fake, asGuest());
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    expect(row(c, "you").find((i) => i.id === "signer")?.label).toBe("You're a guest on this device. Secure this account");
  });

  it("is asked to secure it to show what it earned, and to post a score: its sign-in address signs neither for a guest", async () => {
    Object.assign(fake, asGuest());
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    const show = vi.fn(async () => ({ ok: false, said: "" }));
    const post = vi.fn(async () => ({ ok: false, said: "" }));
    addAchievementControls(c, { achievements: { list: [{ id: "first", title: "First steps" }], earned: () => ["first"], shown: () => [], holders: () => new Promise<never>(() => {}), show, onChange: () => () => {}, onEarn: () => () => {} } as never, signedIn: () => true });
    addScoreControls(c, { scores: { boards: [{ id: "laps", title: "Laps" }], best: () => 12, posted: () => null, words: (_: string, n: number) => `${n} laps`, standings: () => new Promise<never>(() => {}), post, onChange: () => () => {} } as never, signedIn: () => true });
    expect(row(c, "achievements").map((i) => i.label).slice(0, 2)).toEqual(["Secure this account", "Secure this account to show the 1 you have earned"]);
    expect(row(c, "scores")[0]?.label).toBe("Secure this account");
    c.run("achievements-show");
    c.run("scores-post-laps");
    await new Promise((ok) => setTimeout(ok, 0));
    expect(show).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("is not a guest when the sign-in address says an account", () => {
    Object.assign(fake, asGuest(), { guest: false });
    const c = createControls({ title: "A world" });
    c.add(signerAction(c));
    c.add(signInHere(c, "my-tab"));
    expect(guestHere(c)).toBe(false);
    expect(row(c, "my-tab")).toEqual([]);
  });
});

