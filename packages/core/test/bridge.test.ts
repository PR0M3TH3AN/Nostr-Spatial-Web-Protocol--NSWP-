/** The Bridge (browser/bridge.md). The vectors cover reading a grant; these cover the notes, the code and the channel. */
import { describe, expect, it } from "vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import {
  BRIDGE_GRANT_KIND,
  BRIDGE_LIMITS,
  bridgeTopic,
  buildBridgeGrant,
  buildBridgeSignal,
  buildRoomPass,
  buildSignal,
  cleanSize,
  finalizeEvent,
  getPublicKey,
  grantCode,
  openBridgeSignal,
  openSignal,
  parseBridgeControl,
  parseSpeechControl,
  cleanSpeechText,
  ROOM_PASS_KIND,
  roomTopic,
  verifyBridgeGrant,
  verifyRoomPass,
} from "../src/index.js";

const OWNER = sha256(utf8ToBytes("bridge test owner"));
const BRIDGE = sha256(utf8ToBytes("bridge test bridge"));
const SESSION = sha256(utf8ToBytes("bridge test session"));
const STRANGER = sha256(utf8ToBytes("bridge test stranger"));
const [owner, bridge, session] = [OWNER, BRIDGE, SESSION].map(getPublicKey) as [string, string, string];
const T = 1_800_000_000;
const at = { owner, bridge, session, now: T + 5 };

describe("a grant", () => {
  const grant = finalizeEvent(buildBridgeGrant({ session, bridge, createdAt: T }), OWNER);

  it("opens the Bridge it names, for the session key it names", () => {
    const r = verifyBridgeGrant(grant, at);
    expect(r.ok && r.value).toEqual({ id: grant.id, session, expiresAt: T + BRIDGE_LIMITS.grantTtlSec });
  });

  it("never lives longer than five minutes, however it is asked for", () => {
    const exp = (ttlSec: number) => Number(buildBridgeGrant({ session, bridge, createdAt: T, ttlSec }).tags.find((t) => t[0] === "expiration")![1]) - T;
    expect(exp(86400)).toBe(300);
    expect(exp(0)).toBe(30);
  });

  it("is refused from anyone but the owner, however well it is signed", () => {
    const theirs = finalizeEvent(buildBridgeGrant({ session, bridge, createdAt: T }), STRANGER);
    const r = verifyBridgeGrant(theirs, at);
    expect(!r.ok && r.errors.map((e) => e.code)).toEqual(["not_owner"]);
    // Even one the Bridge's own key signed.
    expect(verifyBridgeGrant(finalizeEvent(buildBridgeGrant({ session, bridge, createdAt: T }), BRIDGE), at).ok).toBe(false);
  });

  it("is used once", () => {
    const seen = new Set<string>();
    expect(verifyBridgeGrant(grant, { ...at, seen }).ok).toBe(true);
    seen.add(grant.id);
    expect(verifyBridgeGrant(grant, { ...at, seen }).ok).toBe(false);
  });

  it("is not a pass, and a pass is not a grant", () => {
    expect(BRIDGE_GRANT_KIND).not.toBe(ROOM_PASS_KIND);
    // The owner really did sign this pass, for this session key, and a world really was handed it.
    const pass = finalizeEvent(buildRoomPass({ session, origin: "https://world.example", createdAt: T, ttlSec: 300 }), OWNER);
    expect(verifyRoomPass(pass, { origin: "https://world.example", session, now: T + 5 }).ok).toBe(true);
    expect(verifyBridgeGrant(pass, at).ok).toBe(false);
    // The pass's tags under the grant's kind, with the Bridge named too: still nothing.
    const both = finalizeEvent({ kind: BRIDGE_GRANT_KIND, created_at: T, tags: [...pass.tags, ["nswp:bridge", bridge]], content: "" }, OWNER);
    expect(verifyBridgeGrant(both, at).ok).toBe(false);
    // And a grant is worth nothing to a world, even with a site added.
    expect(verifyRoomPass(grant, { origin: "https://world.example", session, now: T + 5 }).ok).toBe(false);
    const dressed = finalizeEvent({ ...buildBridgeGrant({ session, bridge, createdAt: T }), tags: [...grant.tags, ["nswp:origin", "https://world.example"]] }, OWNER);
    expect(verifyRoomPass(dressed, { origin: "https://world.example", session, now: T + 5 }).ok).toBe(false);
  });

  it("gives both ends the same four digits", () => {
    expect(grantCode(grant.id)).toMatch(/^\d{4}$/);
    expect(grantCode(grant.id)).toBe(grantCode(grant.id));
    const other = finalizeEvent(buildBridgeGrant({ session, bridge, createdAt: T + 1 }), OWNER);
    expect(new Set([grant.id, other.id, "00", "01", "02"].map(grantCode)).size).toBeGreaterThan(3);
  });
});

describe("notes between a home and a Bridge", () => {
  const grant = finalizeEvent(buildBridgeGrant({ session, bridge, createdAt: T }), OWNER);

  const RE = "ab".repeat(32);

  it("reach the one they are for, and only them", () => {
    const note = buildBridgeSignal(bridge, SESSION, bridge, { t: "open", grant, sdp: "v=0" }, { createdAt: T });
    expect(note.tags).toContainEqual(["x", bridgeTopic(bridge)]);
    expect(note.content).not.toContain("v=0");
    const opened = openBridgeSignal(note, BRIDGE, bridge, T + 1);
    expect(opened?.from).toBe(session);
    expect(opened?.message).toMatchObject({ t: "open", sdp: "v=0" });
    expect(openBridgeSignal(note, STRANGER, bridge, T + 1)).toBeNull();
    expect(openBridgeSignal(note, SESSION, bridge, T + 1)).toBeNull(); // our own
    const back = buildBridgeSignal(bridge, BRIDGE, session, { t: "answer", sdp: "v=0" }, { re: note.id, createdAt: T });
    expect(openBridgeSignal(back, SESSION, bridge, T + 1)).toMatchObject({ from: bridge, re: note.id, message: { t: "answer" } });
  });

  it("say which request a reply answers, and a request answers nothing", () => {
    expect(openBridgeSignal(buildBridgeSignal(bridge, BRIDGE, session, { t: "wait" }, { createdAt: T }), SESSION, bridge, T + 1)).toBeNull();
    expect(openBridgeSignal(buildBridgeSignal(bridge, SESSION, bridge, { t: "open", grant, sdp: "v=0" }, { re: RE, createdAt: T }), BRIDGE, bridge, T + 1)).toBeNull();
    expect(openBridgeSignal(buildBridgeSignal(bridge, BRIDGE, session, { t: "wait" }, { re: "nonsense", createdAt: T }), SESSION, bridge, T + 1)).toBeNull();
  });

  it("are ignored when stale, on another Bridge's topic, or not something either side says", () => {
    const note = buildBridgeSignal(bridge, BRIDGE, session, { t: "wait" }, { re: RE, createdAt: T });
    expect(openBridgeSignal(note, SESSION, bridge, T + 1)?.message.t).toBe("wait");
    expect(openBridgeSignal(note, SESSION, bridge, T + 61)).toBeNull();
    expect(openBridgeSignal(note, SESSION, bridge, T - 61)).toBeNull();
    expect(openBridgeSignal(note, SESSION, owner, T + 1)).toBeNull();
    expect(openBridgeSignal({ ...note, content: "x" }, SESSION, bridge, T + 1)).toBeNull();
    for (const bad of [{ t: "open", sdp: "v=0" }, { t: "open", grant, sdp: "" }, { t: "answer", sdp: "x".repeat(20001) }, { t: "refused" }, { t: "run", command: "rm" }, "open", null]) {
      const event = buildBridgeSignal(bridge, SESSION, bridge, bad as never, { createdAt: T });
      expect(openBridgeSignal(event, BRIDGE, bridge, T + 1), JSON.stringify(bad).slice(0, 40)).toBeNull();
    }
  });

  it("are not a room's notes, and a room's are not theirs", () => {
    const topic = roomTopic("https://world.example/", "lobby");
    const roomNote = buildSignal(topic, SESSION, bridge, { t: "offer", sdp: "v=0" }, T);
    expect(openBridgeSignal(roomNote, BRIDGE, bridge, T + 1)).toBeNull();
    const bridgeNote = buildBridgeSignal(bridge, SESSION, bridge, { t: "answer", sdp: "v=0" }, { re: RE, createdAt: T });
    expect(openSignal(bridgeNote, BRIDGE, topic, T + 1)).toBeNull();
  });
});

describe("the channel", () => {
  it("holds a terminal's size to what a Bridge will make", () => {
    expect(cleanSize(100, 30)).toEqual({ cols: 100, rows: 30 });
    expect(cleanSize(1e9, 0)).toEqual({ cols: 300, rows: 5 });
    expect(cleanSize(80.9, 24.2)).toEqual({ cols: 80, rows: 24 });
    expect(cleanSize("80", 24)).toBeNull();
    expect(cleanSize(NaN, 24)).toBeNull();
  });

  it("reads the few things either side says, and nothing else", () => {
    expect(parseBridgeControl('{"t":"size","cols":120,"rows":40}')).toEqual({ t: "size", cols: 120, rows: 40 });
    expect(parseBridgeControl('{"t":"ready","name":"  bash\\n on \\u202edesk  "}')).toEqual({ t: "ready", name: "bash on desk", speech: false });
    expect(parseBridgeControl('{"t":"ready","name":"desk","speech":true}')).toEqual({ t: "ready", name: "desk", speech: true });
    expect(parseBridgeControl('{"t":"ready","name":"desk","speech":"yes"}')).toEqual({ t: "ready", name: "desk", speech: false });
    expect(parseBridgeControl('{"t":"exit","code":0}')).toEqual({ t: "exit", code: 0 });
    expect(parseBridgeControl('{"t":"here","extra":1}')).toEqual({ t: "here" });
    for (const bad of ['{"t":"run","command":"rm -rf ~"}', '{"t":"size","cols":"80","rows":24}', '{"t":"exit"}', "[]", "null", "not json", `{"t":"ready","name":"${"x".repeat(2000)}"}`]) expect(parseBridgeControl(bad), bad.slice(0, 30)).toBeNull();
  });
});

describe("speech", () => {
  it("comes back as words to type: one line, and never a key", () => {
    expect(cleanSpeechText("  list the files\n and\tgo ")).toBe("list the files and go");
    // Nothing spoken can press Enter, escape, or hide what it is.
    expect(cleanSpeechText("rm -rf ~\r\n")).toBe("rm -rf ~");
    expect(cleanSpeechText("a\u001b[2Jb\u202ec")).toBe("a [2Jb c");
    expect([...cleanSpeechText("x".repeat(9000))].length).toBe(BRIDGE_LIMITS.speechChars);
  });

  it("is a few things said on its own channel, and nothing else", () => {
    expect(parseSpeechControl('{"t":"begin","lang":"en-GB"}')).toEqual({ t: "begin", lang: "en-GB" });
    expect(parseSpeechControl('{"t":"begin","lang":"../../etc"}')).toEqual({ t: "begin", lang: "en" });
    expect(parseSpeechControl('{"t":"begin"}')).toEqual({ t: "begin", lang: "en" });
    expect(parseSpeechControl('{"t":"end"}')).toEqual({ t: "end" });
    expect(parseSpeechControl('{"t":"text","text":"hello\\nworld"}')).toEqual({ t: "text", text: "hello world" });
    expect(parseSpeechControl('{"t":"sorry","why":"too long"}')).toEqual({ t: "sorry", why: "too long" });
    for (const bad of ['{"t":"text"}', '{"t":"run"}', "[]", "nope", '{"t":"size","cols":80,"rows":24}']) expect(parseSpeechControl(bad), bad).toBeNull();
  });
});
