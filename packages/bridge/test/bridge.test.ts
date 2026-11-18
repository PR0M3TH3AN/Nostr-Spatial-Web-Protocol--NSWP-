/**
 * The Bridge, whole: a relay on this machine, throwaway keys, and a real
 * terminal. What matters most is who it turns away.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RTCPeerConnection, type RTCDataChannel } from "werift";
import { bridgeTopic, buildWorldGrant, decodeNpub, encodeNpub, buildBridgeGrant, buildBridgeSignal, buildRoomPass, finalizeEvent, getPublicKey, grantCode, openBridgeSignal, type NostrEvent } from "@nswp/core";
import { createBridge, type AskAbout, type Bridge } from "../src/bridge.js";
import { commandEars, wav, whisperEars } from "../src/ears.js";
import { startRelay, type TestRelay } from "./relay.js";

const key = () => Uint8Array.from(randomBytes(32));
const OWNER = key();
const BRIDGE = key();
const owner = getPublicKey(OWNER);
const theBridge = getPublicKey(BRIDGE);
const bridgeKey = theBridge;

let relay: TestRelay;
let bridge: Bridge;
const asked: AskAbout[] = [];
const log: string[] = [];
let answer = true;

interface Attempt {
  waited: boolean;
  refused?: string;
  grant: NostrEvent;
  channel?: RTCDataChannel;
  /** Everything the terminal has written so far. */
  text(): string;
  frames: Record<string, unknown>[];
  type(s: string): void;
  until(what: RegExp | ((a: Attempt) => boolean), ms?: number): Promise<void>;
  close(): Promise<void>;
}

/** Ask the Bridge for a terminal the way a home does. `signer` signs the grant; `make` may build something else to send as one. */
async function attempt(o: { signer?: Uint8Array; session?: Uint8Array; make?: (session: string) => NostrEvent; send?: NostrEvent; size?: [number, number]; to?: string; on?: string } = {}): Promise<Attempt> {
  const bridgeKey = o.to ?? theBridge;
  const sessionKey = o.session ?? key();
  const session = getPublicKey(sessionKey);
  const grant = o.send ?? o.make?.(session) ?? finalizeEvent(buildBridgeGrant({ session, bridge: bridgeKey }), o.signer ?? OWNER);
  const pc = new RTCPeerConnection({ iceServers: [], iceUseDefaultStunServer: false });
  const channel = pc.createDataChannel("term");
  let out = "";
  const a: Attempt = {
    ...({ pc } as object),
    waited: false,
    grant,
    text: () => out,
    frames: [],
    type: (s) => channel.send(Buffer.from(s)),
    async until(what, ms = 15000) {
      const ok = () => (typeof what === "function" ? what(a) : what.test(out));
      const end = Date.now() + ms;
      while (!ok()) {
        if (Date.now() > end) throw new Error(`waited ${ms} ms for ${what}; the terminal has written: ${JSON.stringify(out.slice(-400))}`);
        await new Promise((r) => setTimeout(r, 25));
      }
    },
    async close() {
      ws.close();
      await pc.close();
    },
  };
  channel.onMessage.subscribe((data) => {
    if (typeof data === "string") a.frames.push(JSON.parse(data) as Record<string, unknown>);
    else out += data.toString("utf8");
  });
  await pc.setLocalDescription(await pc.createOffer());
  if (pc.iceGatheringState !== "complete") await pc.iceGatheringStateChange.watch((s) => s === "complete", 5000);

  const open = buildBridgeSignal(bridgeKey, sessionKey, bridgeKey, { t: "open", grant, sdp: pc.localDescription!.sdp });
  const ws = new WebSocket(o.on ?? relay.url);
  await new Promise((r) => (ws.onopen = r));
  const settled = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("the Bridge never answered")), 8000);
    ws.onmessage = (msg) => {
      const data = JSON.parse(String(msg.data)) as unknown[];
      if (data[0] !== "EVENT") return;
      const note = openBridgeSignal(data[2], sessionKey, bridgeKey);
      // Only the Bridge, and only about this request.
      if (!note || note.from !== bridgeKey || note.re !== open.id) return;
      if (note.message.t === "wait") a.waited = true;
      if (note.message.t === "refused") {
        a.refused = note.message.why;
        clearTimeout(timer);
        resolve();
      }
      if (note.message.t === "answer") {
        clearTimeout(timer);
        void pc.setRemoteDescription({ type: "answer", sdp: note.message.sdp }).then(async () => {
          if (channel.readyState !== "open") await channel.stateChanged.watch((s) => s === "open", 8000);
          a.channel = channel;
          channel.send(JSON.stringify({ t: "size", cols: o.size?.[0] ?? 90, rows: o.size?.[1] ?? 28 }));
          resolve();
        }, reject);
      }
    };
  });
  ws.send(JSON.stringify(["REQ", "home", { kinds: [27301], "#x": [bridgeTopic(bridgeKey)], "#p": [session] }]));
  ws.send(JSON.stringify(["EVENT", open]));
  await settled;
  return a;
}

const idle = async () => {
  const end = Date.now() + 8000;
  while (bridge.state().busy !== "no" && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
  expect(bridge.state().busy).toBe("no");
};

beforeAll(async () => {
  relay = await startRelay();
  bridge = createBridge({
    key: BRIDGE,
    owner,
    relays: [relay.url],
    command: ["/bin/sh"],
    iceServers: [],
    strangerReplyMs: 0,
    name: "the test computer",
    log: (line) => log.push(line),
    ask(about) {
      asked.push(about);
      return Promise.resolve(answer);
    },
  });
  bridge.start();
  const end = Date.now() + 5000;
  while (!bridge.state().relays && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
});

afterAll(async () => {
  await bridge.stop();
  await relay.close();
});

describe("the owner", () => {
  it("opens a terminal, runs a command, and sees it end", async () => {
    const before = asked.length;
    const a = await attempt();
    expect(a.refused).toBeUndefined();
    expect(a.waited).toBe(true);
    // The person at the computer was asked, about this request, with the code the panel shows.
    expect(asked.slice(before)).toEqual([{ code: grantCode(a.grant.id), session: a.grant.tags[0]![1], open: 0, replaces: false }]);
    await a.until((x) => x.frames.some((f) => f.t === "ready"));
    expect(a.frames.find((f) => f.t === "ready")).toEqual({ t: "ready", name: "the test computer", speech: false });
    a.type("echo made-$((40 + 2))\n");
    await a.until(/made-42/);
    a.type("stty size\n");
    await a.until(/28 90/);
    a.channel!.send(JSON.stringify({ t: "size", cols: 120, rows: 40 }));
    a.type("stty size\n");
    await a.until(/40 120/);
    a.type("exit 3\n");
    await a.until((x) => x.frames.some((f) => f.t === "exit"));
    expect(a.frames.find((f) => f.t === "exit")).toEqual({ t: "exit", code: 3 });
    await a.close();
    await idle();
    expect(log.some((l) => l.startsWith("Terminal 1 open"))).toBe(true);
    expect(log.some((l) => l.startsWith("Terminal 1 closed"))).toBe(true);
  }, 30000);

  it("is turned away when nobody at the computer says yes", async () => {
    answer = false;
    const opened = bridge.state().opened;
    const a = await attempt();
    answer = true;
    expect(a.waited).toBe(true);
    expect(a.refused).toMatch(/Nobody at the computer/);
    expect(bridge.state().opened).toBe(opened);
    await a.close();
    await idle();
  }, 20000);

  it("has a few terminals at once, each its own, and each found again by its place", async () => {
    const other = await startRelay();
    const questions: AskAbout[] = [];
    const said: string[] = [];
    // What a lasting terminal is told: which of the few places it has.
    const b = createBridge({ key: key(), owner, relays: [other.url], iceServers: [], maxSessions: 2, command: (slot) => ["/bin/sh", "-c", `echo place-${slot}; exec /bin/sh`], log: (l) => said.push(l), ask: (q) => (questions.push(q), Promise.resolve(true)) });
    b.start();
    while (!b.state().relays) await new Promise((r) => setTimeout(r, 20));
    const go = () => attempt({ to: b.pubkey, on: other.url, make: (session) => finalizeEvent(buildBridgeGrant({ session, bridge: b.pubkey }), OWNER) });
    const pidOf = async (a: Attempt) => {
      a.type("echo pid-$$\n");
      await a.until(/pid-(\d+)/);
      return Number(/pid-(\d+)/.exec(a.text())![1]);
    };
    const alive = (pid: number) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    const gone = async (pid: number) => {
      const end = Date.now() + 6000;
      while (alive(pid) && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
      return !alive(pid);
    };

    const first = await go();
    await first.until(/place-1/);
    const second = await go();
    await second.until(/place-2/);
    expect(questions.map((q) => [q.open, q.replaces])).toEqual([[0, false], [1, false]]);
    expect(b.state().sessions).toBe(2);
    const [one, two] = [await pidOf(first), await pidOf(second)];
    expect(one).not.toBe(two);

    // As many as may be are open. A third, once allowed, takes the place of the one quiet longest: the first.
    await new Promise((r) => setTimeout(r, 300));
    second.type("echo still-here\n");
    await second.until(/still-here/);
    const third = await go();
    expect(third.refused).toBeUndefined();
    expect(questions.at(-1)).toMatchObject({ open: 2, replaces: true });
    await third.until(/place-1/); // the place that came free
    expect(await gone(one)).toBe(true);
    expect(alive(two)).toBe(true);
    expect(b.state().sessions).toBe(2);
    expect(said.some((l) => /Terminal 1 closed.*another was opened in its place/.test(l))).toBe(true);

    // Putting one away frees its place, and its program is hung up on.
    const three = await pidOf(third);
    await third.close();
    expect(await gone(three)).toBe(true);
    const again = await go();
    await again.until(/place-1/);
    expect(questions.at(-1)).toMatchObject({ open: 1, replaces: false });
    await Promise.all([first.close(), second.close(), again.close()]);
    await b.stop();
    await other.close();
  }, 60000);

  it("is not kept out by a question still waiting for its answer", async () => {
    let let_in: (yes: boolean) => void = () => {};
    const other = await startRelay();
    const b = createBridge({ key: key(), owner, relays: [other.url], command: ["/bin/sh"], iceServers: [], ask: () => new Promise((r) => (let_in = r)) });
    b.start();
    while (!b.state().relays) await new Promise((r) => setTimeout(r, 20));
    const make = (session: string) => finalizeEvent(buildBridgeGrant({ session, bridge: b.pubkey }), OWNER);
    const first = attempt({ to: b.pubkey, on: other.url, make });
    while (b.state().busy !== "asking") await new Promise((r) => setTimeout(r, 20));
    const second = await attempt({ to: b.pubkey, on: other.url, make });
    expect(second.refused).toMatch(/already answering/);
    let_in(false);
    expect((await first).refused).toMatch(/Nobody at the computer/);
    await (await first).close();
    await second.close();
    await b.stop();
    await other.close();
  }, 30000);

  it("is hung up on when its home goes quiet", async () => {
    const other = await startRelay();
    const said: string[] = [];
    const b = createBridge({ key: key(), owner, relays: [other.url], command: ["/bin/sh"], iceServers: [], quietMs: 1500, log: (l) => said.push(l), ask: () => Promise.resolve(true) });
    b.start();
    while (!b.state().relays) await new Promise((r) => setTimeout(r, 20));
    const a = await attempt({ to: b.pubkey, on: other.url, make: (session) => finalizeEvent(buildBridgeGrant({ session, bridge: b.pubkey }), OWNER) });
    await a.until((x) => x.frames.some((f) => f.t === "ready"));
    // The connection is still up, and nothing is said on it: a page that froze, a headset in a drawer.
    const end = Date.now() + 12000;
    while (b.state().busy !== "no" && Date.now() < end) await new Promise((r) => setTimeout(r, 100));
    expect(b.state().busy).toBe("no");
    expect(said.some((l) => /the home went quiet/.test(l))).toBe(true);
    await a.close();
    await b.stop();
    await other.close();
  }, 30000);
});

describe("anyone else", () => {
  const nothingOpened = async (a: Attempt, opened: number, askedBefore: number) => {
    expect(a.channel).toBeUndefined();
    expect(a.waited).toBe(false);
    expect(bridge.state().opened).toBe(opened);
    // And nobody at the computer was even bothered.
    expect(asked.length).toBe(askedBefore);
    await a.close();
  };

  it("a second key is refused, however well its grant is signed", async () => {
    const [opened, n] = [bridge.state().opened, asked.length];
    const a = await attempt({ signer: key() });
    expect(a.refused).toBe("This computer answers a different key.");
    await nothingOpened(a, opened, n);
  }, 20000);

  it("the Bridge's own key is refused too", async () => {
    const [opened, n] = [bridge.state().opened, asked.length];
    const a = await attempt({ signer: BRIDGE });
    expect(a.refused).toBeDefined();
    await nothingOpened(a, opened, n);
  }, 20000);

  it("a pass the owner signed for a world opens nothing", async () => {
    const [opened, n] = [bridge.state().opened, asked.length];
    const a = await attempt({ make: (session) => finalizeEvent(buildRoomPass({ session, origin: "https://world.example", ttlSec: 300 }), OWNER) });
    expect(a.refused).toBeDefined();
    await nothingOpened(a, opened, n);
  }, 20000);

  it("a grant for another computer opens nothing", async () => {
    const [opened, n] = [bridge.state().opened, asked.length];
    const a = await attempt({ make: (session) => finalizeEvent(buildBridgeGrant({ session, bridge: getPublicKey(key()) }), OWNER) });
    expect(a.refused).toBe("That was meant for a different computer.");
    await nothingOpened(a, opened, n);
  }, 20000);

  it("an old grant opens nothing", async () => {
    const [opened, n] = [bridge.state().opened, asked.length];
    const a = await attempt({ make: (session) => finalizeEvent(buildBridgeGrant({ session, bridge: bridgeKey, createdAt: Math.floor(Date.now() / 1000) - 400 }), OWNER) });
    expect(a.refused).toMatch(/too old/);
    await nothingOpened(a, opened, n);
  }, 20000);

  it("a grant overheard and sent again opens nothing: not by another key, and not by the same one", async () => {
    const session = key();
    const first = await attempt({ session });
    expect(first.refused).toBeUndefined();
    await first.until((x) => x.frames.some((f) => f.t === "ready"));
    first.type("exit\n");
    await first.until((x) => x.frames.some((f) => f.t === "exit"));
    await first.close();
    await idle();
    const [opened, n] = [bridge.state().opened, asked.length];
    const thief = await attempt({ send: first.grant });
    expect(thief.refused).toBeDefined();
    await nothingOpened(thief, opened, n);
    const again = await attempt({ session, send: first.grant });
    expect(again.refused).toMatch(/already used/);
    await nothingOpened(again, opened, n);
  }, 40000);

  it("learns nothing from the relay but two keys talking", () => {
    const text = JSON.stringify(relay.events);
    for (const secret of ["made-42", "stty", "nswp:bridge", "nswp:session", "a=candidate", "the test computer"]) expect(text, secret).not.toContain(secret);
    expect(relay.events.every((e) => e.kind === 27301)).toBe(true);
  });
});

describe("how often it asks, and how often it answers", () => {
  it("asks once, then not again for as long as it was told", async () => {
    const other = await startRelay();
    const k = key();
    const questions: AskAbout[] = [];
    const b = createBridge({ key: k, owner, relays: [other.url], command: ["/bin/sh"], iceServers: [], allowForSec: 3, ask: (q) => (questions.push(q), Promise.resolve(true)) });
    b.start();
    while (!b.state().relays) await new Promise((r) => setTimeout(r, 20));
    const go = async () => {
      const a = await attempt({ to: b.pubkey, on: other.url, make: (session) => finalizeEvent(buildBridgeGrant({ session, bridge: b.pubkey }), OWNER) });
      expect(a.refused).toBeUndefined();
      await a.until((x) => x.frames.some((f) => f.t === "ready"));
      a.type("exit\n");
      await a.until((x) => x.frames.some((f) => f.t === "exit"));
      await a.close();
      while (b.state().busy !== "no") await new Promise((r) => setTimeout(r, 20));
      return a;
    };
    expect((await go()).waited).toBe(true);
    expect((await go()).waited).toBe(false); // inside the three seconds: straight in
    expect(questions.length).toBe(1);
    // Still nobody but the owner, asked or not.
    const stranger = await attempt({ to: b.pubkey, on: other.url, make: (session) => finalizeEvent(buildBridgeGrant({ session, bridge: b.pubkey }), key()) });
    expect(stranger.refused).toBe("This computer answers a different key.");
    await stranger.close();
    await new Promise((r) => setTimeout(r, 3200));
    expect((await go()).waited).toBe(true);
    expect(questions.length).toBe(2);
    await b.stop();
    await other.close();
  }, 60000);

  it("answers a stranger once, however many times they ask", async () => {
    const other = await startRelay();
    const b = createBridge({ key: key(), owner, relays: [other.url], command: ["/bin/sh"], iceServers: [], ask: () => Promise.resolve(true) });
    b.start();
    while (!b.state().relays) await new Promise((r) => setTimeout(r, 20));
    const stranger = key();
    const first = await attempt({ to: b.pubkey, on: other.url, signer: stranger });
    expect(first.refused).toBeDefined();
    await first.close();
    await Promise.all([1, 2, 3, 4, 5].map(() => attempt({ to: b.pubkey, on: other.url, signer: stranger }).then((a) => a.close(), () => undefined)));
    expect(b.state().refused).toBe(6);
    // Six requests, one reply: the rest got silence.
    expect(other.events.filter((e) => e.pubkey === b.pubkey).length).toBe(1);
    await b.stop();
    await other.close();
  }, 40000);
});

describe("the program", () => {
  it("keeps its key to itself, remembers its owner, asks on its own screen, and won't change hands quietly", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nswp-bridge-test-"));
    const run = (args: string[]) => spawn("npx", ["tsx", "packages/bridge/src/index.ts", "--dir", dir, "--relays", relay.url, "--command", "echo from-the-program; exit 0", ...args], { stdio: ["pipe", "pipe", "pipe"] });
    const child = run(["--owner", encodeNpub(owner)]);
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (out += d.toString()));
    const seen = async (what: RegExp, ms = 20000) => {
      const end = Date.now() + ms;
      while (!what.test(out)) {
        if (Date.now() > end) throw new Error(`the program never said ${what}: ${out}`);
        await new Promise((r) => setTimeout(r, 30));
      }
      return what.exec(out)!;
    };
    const link = await seen(/#bridge=(npub1[a-z0-9]+)/);
    // It says whether a home can find it.
    await seen(/Listening on 1 of 1 relays/);
    const its = decodeNpub(link[1]!);
    expect(out).toContain(`Answers only    ${encodeNpub(owner)}`);
    expect(out).toContain("It asks here before every session.");
    // The key file: this user only, and not the key it printed.
    expect(statSync(join(dir, "bridge.key")).mode & 0o777).toBe(0o600);
    expect(out).not.toContain(readFileSync(join(dir, "bridge.key"), "utf8").trim());

    const going = attempt({ to: its, make: (session) => finalizeEvent(buildBridgeGrant({ session, bridge: its }), OWNER) });
    const code = await seen(/The code is (\d{4})\./);
    child.stdin.write("y\n");
    const a = await going;
    expect(a.refused).toBeUndefined();
    expect(code[1]).toBe(grantCode(a.grant.id));
    await a.until(/from-the-program/);
    await a.until((x) => x.frames.some((f) => f.t === "exit"));
    await a.close();
    await seen(/Terminal 1 closed/);

    // Anything but a yes is a no.
    const no = attempt({ to: its, make: (session) => finalizeEvent(buildBridgeGrant({ session, bridge: its }), OWNER) });
    await seen(/The code is \d{4}\.[^]*The code is \d{4}\./);
    child.stdin.write("sure, why not\n");
    expect((await no).refused).toMatch(/Nobody at the computer/);
    await (await no).close();
    child.kill("SIGTERM");
    await new Promise((r) => child.on("exit", r));

    // The same folder, another owner: it says whose it is and stops.
    const second = run(["--owner", encodeNpub(getPublicKey(key()))]);
    let said = "";
    second.stderr.on("data", (d: Buffer) => (said += d.toString()));
    const status = await new Promise((r) => second.on("exit", r));
    expect(status).toBe(1);
    expect(said).toContain(`already answers ${encodeNpub(owner)}`);

    // An example run as it was written is told so, and makes no settings.
    const fresh = mkdtempSync(join(tmpdir(), "nswp-bridge-test-"));
    const example = spawn("npx", ["tsx", "packages/bridge/src/index.ts", "--dir", fresh, "--owner", "npub1\u2026"], { stdio: ["pipe", "pipe", "pipe"] });
    let told = "";
    example.stderr.on("data", (d: Buffer) => (told += d.toString()));
    expect(await new Promise((r) => example.on("exit", r))).toBe(1);
    expect(told).toContain("is the example");
    expect(readdirSync(fresh)).toEqual([]);
  }, 90000);
});

describe("speaking to it", () => {
  /** Half a second of a tone, as the page sends it: 16-bit samples, 16,000 a second. */
  const tone = (seconds = 0.5) => {
    const pcm = Buffer.alloc(Math.round(seconds * 16000) * 2);
    for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 6) * 9000), i * 2);
    return pcm;
  };
  /** Say something on the speech channel of an open terminal's connection, and wait for what comes back. */
  const say = (a: Attempt, pcm: Buffer, lang = "en") =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const pc = (a as unknown as { pc: RTCPeerConnection }).pc;
      const ch = pc.createDataChannel("speech");
      const timer = setTimeout(() => reject(new Error("nothing came back on the speech channel")), 15000);
      ch.onMessage.subscribe((data) => {
        clearTimeout(timer);
        resolve(JSON.parse(String(data)) as Record<string, unknown>);
      });
      ch.stateChanged.subscribe((state) => {
        if (state === "closed") {
          clearTimeout(timer);
          resolve({ t: "closed" });
        }
        if (state !== "open") return;
        ch.send(JSON.stringify({ t: "begin", lang }));
        for (let i = 0; i < pcm.length; i += 16000) ch.send(pcm.subarray(i, i + 16000));
        ch.send(JSON.stringify({ t: "end" }));
      });
    });

  it("turns what was said into words on this computer, and tells a home it can", async () => {
    const other = await startRelay();
    const heard: { bytes: number; rate: number; lang: string }[] = [];
    const b = createBridge({
      key: key(),
      owner,
      relays: [other.url],
      command: ["/bin/sh"],
      iceServers: [],
      ask: () => Promise.resolve(true),
      // What a recogniser might hand back: line breaks, and something that would be a key.
      transcribe: async (pcm, o) => (heard.push({ bytes: pcm.length, ...o }), " list the files\r\nrm -rf ~\u001b[A "),
    });
    b.start();
    while (!b.state().relays) await new Promise((r) => setTimeout(r, 20));
    const a = await attempt({ to: b.pubkey, on: other.url, make: (session) => finalizeEvent(buildBridgeGrant({ session, bridge: b.pubkey }), OWNER) });
    await a.until((x) => x.frames.some((f) => f.t === "ready"));
    expect(a.frames.find((f) => f.t === "ready")).toMatchObject({ speech: true });
    const pcm = tone(1);
    // One line, and nothing in it that presses a key: speaking types, and never runs anything.
    expect(await say(a, pcm, "en-GB")).toEqual({ t: "text", text: "list the files rm -rf ~ [A" });
    expect(heard).toEqual([{ bytes: pcm.length, rate: 16000, lang: "en-GB" }]);
    // Too short to be anything is nothing, without waking the recogniser.
    expect(await say(a, tone(0.1))).toEqual({ t: "closed" }); // a second speech channel on one connection is not opened
    expect(heard.length).toBe(1);
    await a.close();
    await b.stop();
    await other.close();
  }, 40000);

  it("doesn't listen unless it was told to", async () => {
    const a = await attempt();
    await a.until((x) => x.frames.some((f) => f.t === "ready"));
    expect(a.frames.find((f) => f.t === "ready")).toMatchObject({ speech: false });
    expect(await say(a, tone())).toEqual({ t: "closed" });
    await a.close();
    await idle();
  }, 30000);

  it("hands the sound to any command, in a file only this user can read, and deletes it", async () => {
    const seen = join(mkdtempSync(join(tmpdir(), "nswp-bridge-test-")), "seen");
    // The command is given the file's path last. It notes the file's mode and size, and says some words.
    const ears = commandEars(`sh -c 'stat -c "%a %s" "$1" > ${seen}; echo "$1" >> ${seen}; echo "lang $NSWP_VOICE_LANG"' --`);
    const pcm = tone(1);
    expect((await ears(pcm, { rate: 16000, lang: "fr" })).trim()).toBe("lang fr");
    const [facts, path] = readFileSync(seen, "utf8").trim().split("\n");
    expect(facts).toBe(`600 ${pcm.length + 44}`);
    expect(() => statSync(path!)).toThrow(); // gone, with its folder
    expect(wav(pcm, 16000).subarray(0, 4).toString()).toBe("RIFF");
    await expect(commandEars("false")(pcm, { rate: 16000, lang: "en" })).rejects.toThrow();
  });

  it("keeps Whisper loaded and asks it each time, and says plainly when there is none", async () => {
    // A stand-in for Whisper: the same few calls, no model. The real one is the owner's to try.
    const dir = mkdtempSync(join(tmpdir(), "nswp-bridge-test-"));
    writeFileSync(join(dir, "whisper.py"), ["class _M:", "    def transcribe(self, audio, **k):", "        return {'text': ' heard %d samples in %s ' % (len(audio), k.get('language'))}", "def load_model(name):", "    return _M()", ""].join("\n"));
    const was = process.env.PYTHONPATH;
    process.env.PYTHONPATH = dir;
    const ears = whisperEars({ model: "small" });
    await ears.ready;
    expect((await ears.transcribe(tone(1), { rate: 16000, lang: "de-DE" })).trim()).toBe("heard 16000 samples in de");
    expect((await ears.transcribe(tone(0.5), { rate: 16000, lang: "en" })).trim()).toBe("heard 8000 samples in en");
    ears.close();
    // A model that only knows English is told nothing else.
    const english = whisperEars({ model: "base.en" });
    await english.ready;
    expect((await english.transcribe(tone(0.5), { rate: 16000, lang: "fr" })).trim()).toBe("heard 8000 samples in en");
    english.close();
    writeFileSync(join(dir, "whisper.py"), "raise ImportError('not here')\n");
    await expect(whisperEars({ model: "small" }).ready).rejects.toThrow(/Whisper isn't installed/);
    if (was === undefined) delete process.env.PYTHONPATH;
    else process.env.PYTHONPATH = was;
  }, 40000);
});

describe("a world the owner is building", () => {
  const WORLD = "http://127.0.0.1:5173";

  it("may open a terminal when this computer was told about it, is asked about by name, and may come back", async () => {
    const other = await startRelay();
    const questions: AskAbout[] = [];
    const said: string[] = [];
    const b = createBridge({ key: key(), owner, relays: [other.url], command: ["/bin/sh"], iceServers: [], worlds: [WORLD], log: (l) => said.push(l), ask: (q) => (questions.push(q), Promise.resolve(true)) });
    b.start();
    while (!b.state().relays) await new Promise((r) => setTimeout(r, 20));
    const session = key();
    const grant = finalizeEvent(buildWorldGrant({ session: getPublicKey(session), bridge: b.pubkey, world: `${WORLD}/` }), OWNER);
    const go = () => attempt({ to: b.pubkey, on: other.url, session, send: grant });

    const first = await go();
    expect(first.refused).toBeUndefined();
    await first.until((x) => x.frames.some((f) => f.t === "ready"));
    expect(questions[0]).toMatchObject({ world: WORLD, open: 0 });
    expect(said.some((l) => l.includes(`from the world ${WORLD}`))).toBe(true);
    first.type("echo in-the-world\n");
    await first.until(/in-the-world/);
    await first.close();
    while (b.state().busy !== "no") await new Promise((r) => setTimeout(r, 20));

    // A refresh: the same grant, the same key, a new connection. The computer is asked again, with new digits.
    const again = await go();
    expect(again.refused).toBeUndefined();
    await again.until((x) => x.frames.some((f) => f.t === "ready"));
    expect(questions.length).toBe(2);
    expect(questions[1]!.code).not.toBe(questions[0]!.code);
    await again.close();
    while (b.state().busy !== "no") await new Promise((r) => setTimeout(r, 20));

    // Somebody who overheard the grant has no use for it: they don't hold the key it names.
    const thief = await attempt({ to: b.pubkey, on: other.url, send: grant });
    expect(thief.refused).toBeDefined();
    expect(thief.waited).toBe(false);
    expect(questions.length).toBe(2);
    await thief.close();
    await b.stop();
    await other.close();
  }, 60000);

  it("opens nothing on a computer that wasn't told about it, whoever signed", async () => {
    // The main Bridge of these tests was started with no worlds at all.
    const [opened, n] = [bridge.state().opened, asked.length];
    const a = await attempt({ make: (session) => finalizeEvent(buildWorldGrant({ session, bridge: bridgeKey, world: WORLD }), OWNER) });
    expect(a.refused).toMatch(/wasn't told about this world/);
    expect(a.waited).toBe(false);
    expect(bridge.state().opened).toBe(opened);
    expect(asked.length).toBe(n);
    await a.close();

    const other = await startRelay();
    const b = createBridge({ key: key(), owner, relays: [other.url], command: ["/bin/sh"], iceServers: [], strangerReplyMs: 0, worlds: [WORLD], ask: () => Promise.resolve(true) });
    b.start();
    while (!b.state().relays) await new Promise((r) => setTimeout(r, 20));
    // Another world; and the right world, signed by somebody else.
    const elsewhere = await attempt({ to: b.pubkey, on: other.url, make: (session) => finalizeEvent(buildWorldGrant({ session, bridge: b.pubkey, world: "https://other.example" }), OWNER) });
    expect(elsewhere.refused).toMatch(/wasn't told about this world/);
    const stranger = await attempt({ to: b.pubkey, on: other.url, make: (session) => finalizeEvent(buildWorldGrant({ session, bridge: b.pubkey, world: WORLD }), key()) });
    expect(stranger.refused).toBe("This computer answers a different key.");
    expect(b.state().opened).toBe(0);
    await elsewhere.close();
    await stranger.close();
    await b.stop();
    await other.close();
  }, 40000);

  it("being let in for a while is not the home being let in, nor another world", async () => {
    const other = await startRelay();
    const questions: AskAbout[] = [];
    const b = createBridge({ key: key(), owner, relays: [other.url], command: ["/bin/sh"], iceServers: [], worlds: [WORLD, "https://second.example"], allowForSec: 600, ask: (q) => (questions.push(q), Promise.resolve(true)) });
    b.start();
    while (!b.state().relays) await new Promise((r) => setTimeout(r, 20));
    const session = key();
    const grant = finalizeEvent(buildWorldGrant({ session: getPublicKey(session), bridge: b.pubkey, world: WORLD }), OWNER);
    const done = async (a: Attempt) => {
      expect(a.refused).toBeUndefined();
      await a.until((x) => x.frames.some((f) => f.t === "ready"));
      await a.close();
      while (b.state().busy !== "no") await new Promise((r) => setTimeout(r, 20));
      return a;
    };
    expect((await done(await attempt({ to: b.pubkey, on: other.url, session, send: grant }))).waited).toBe(true);
    // The same world again, inside the ten minutes: straight in. This is the refresh that mustn't break the flow.
    expect((await done(await attempt({ to: b.pubkey, on: other.url, session, send: grant }))).waited).toBe(false);
    // The home, and another world, are each asked about for themselves.
    expect((await done(await attempt({ to: b.pubkey, on: other.url, make: (s) => finalizeEvent(buildBridgeGrant({ session: s, bridge: b.pubkey }), OWNER) }))).waited).toBe(true);
    expect((await done(await attempt({ to: b.pubkey, on: other.url, make: (s) => finalizeEvent(buildWorldGrant({ session: s, bridge: b.pubkey, world: "https://second.example" }), OWNER) }))).waited).toBe(true);
    expect(questions.map((q) => q.world)).toEqual([WORLD, undefined, "https://second.example"]);
    await b.stop();
    await other.close();
  }, 60000);
});
