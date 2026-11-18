/**
 * The Bridge (browser/bridge.md): answers one owner's key, and opens a
 * terminal for a session that owner granted, once someone at this computer
 * has said yes.
 *
 * Everything that decides whether a terminal opens is in `consider()`, in the
 * order the document gives it. Nothing is started before it has run.
 */
import { hostname, userInfo } from "node:os";
import { RTCPeerConnection, type RTCDataChannel } from "werift";
import {
  BRIDGE_LIMITS,
  bridgeTopic,
  buildBridgeSignal,
  getPublicKey,
  grantCode,
  openBridgeSignal,
  parseBridgeControl,
  parseSpeechControl,
  cleanSpeechText,
  ROOM_SIGNAL_KIND,
  verifyBridgeGrant,
  verifyWorldGrant,
  BRIDGE_WORLD_GRANT_KIND,
  type BridgeMessage,
} from "@nswp/core";
import type { Transcribe } from "./ears.js";
import { openTerminal, type Terminal } from "./pty.js";
import { openRelays, type RelayLinks } from "./relays.js";

export interface AskAbout {
  /** The four digits the panel is showing, if the request is the owner's own. */
  code: string;
  /** The throwaway key asking. */
  session: string;
  /** The world asking, when it is one the owner is building and not their home. */
  world?: string;
  /** How many terminals are open already. */
  open: number;
  /** As many are open as may be. A yes closes the one that has been quiet longest and opens this one in its place. */
  replaces: boolean;
}

export interface BridgeOptions {
  /** This Bridge's own secret key. */
  key: Uint8Array;
  /** The one public key it answers, as 64 hex characters. */
  owner: string;
  relays: string[];
  /**
   * What a terminal runs: a shell, or one program. As a function, it is told
   * which of the few places the terminal has (1, 2, …), so that each can be a
   * lasting terminal of its own and be found again.
   */
  command: string[] | ((slot: number) => string[]);
  /** How many terminals may be open at once. Four unless told. */
  maxSessions?: number;
  /**
   * The worlds the owner is building, as origins. A page at one of these may
   * open a terminal with a world grant its owner signed. Left out or empty,
   * only the owner's home can: every world grant is refused.
   */
  worlds?: readonly string[];
  /**
   * Turn what the owner says into text, on this computer. Left out, this
   * Bridge doesn't listen: a home is told so, and nothing it sends is kept.
   */
  transcribe?: Transcribe;
  cwd?: string;
  /** Ask the person at the computer. Resolves true only for a yes. */
  ask(about: AskAbout): Promise<boolean>;
  /** After a yes, open without asking for this long. 0, the default, asks every time. */
  allowForSec?: number;
  log?(line: string): void;
  iceServers?: { urls: string | string[] }[];
  /** A session that has been silent this long is ended. */
  idleMs?: number;
  /** A session whose home hasn't been heard from for this long is ended: the page was closed, or the headset is off. */
  quietMs?: number;
  /** No session lasts longer than this. */
  maxMs?: number;
  askTimeoutMs?: number;
  /** A key that isn't the owner's is answered no more often than this. */
  strangerReplyMs?: number;
  /** What the panel is told this computer is called. */
  name?: string;
  /** Told how many relays are connected, whenever that changes. With none, no home can find this computer. */
  onRelays?(open: number, of: number): void;
  now?(): number;
}

export interface Bridge {
  readonly pubkey: string;
  readonly topic: string;
  start(): void;
  stop(): Promise<void>;
  /** What it is doing now. */
  state(): { busy: "no" | "asking" | "connecting" | "open"; relays: number; opened: number; refused: number; sessions: number };
}

const DEFAULT_ICE = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
const CHUNK = 16 * 1024;
const HIGH_WATER = 1024 * 1024;
const WHY: Record<string, string> = {
  not_owner: "This computer answers a different key.",
  world_not_allowed: "This computer wasn't told about this world. Start its Bridge again, naming it with --world.",
  bridge_mismatch: "That was meant for a different computer.",
  grant_expired: "That request was too old. Try again.",
  created_in_future: "This computer's clock and yours disagree.",
  grant_reused: "That request was already used. Try again.",
};

export function createBridge(o: BridgeOptions): Bridge {
  const pubkey = getPublicKey(o.key);
  const log = o.log ?? (() => undefined);
  const now = o.now ?? (() => Math.floor(Date.now() / 1000));
  const seen = new Map<string, number>(); // grant id -> when it expires
  let relays: RelayLinks | null = null;
  let asking = false;
  interface Session {
    at: "connecting" | "open";
    /** Which of the few places it has: 1, 2, … */
    slot: number;
    /** When its home was last heard from. */
    heard: number;
    end(why: string): void;
  }
  /** The few terminals there may be, connecting or open. */
  const sessions = new Set<Session>();
  const most = Math.max(1, Math.min(o.maxSessions ?? 4, 8));
  /** Until when each asker is let in without asking again: the home, and each world, by itself. A yes to one is not a yes to another. */
  const allowedUntil = new Map<string, number>();
  let opened = 0;
  let refused = 0;
  let lastReply = 0;

  /** Every note this program writes answers a request: `re` is that request's id. */
  const say = (to: string, re: string, message: BridgeMessage) => relays?.publish(buildBridgeSignal(pubkey, o.key, to, message, { re }));

  /**
   * Say no. A stranger is answered at most once in a while, so nobody gets to
   * make this computer chatter; the owner is always answered.
   */
  const refuse = (to: string, re: string, why: string, note: string, theirs = false) => {
    refused++;
    const t = Date.now();
    if (!theirs && t - lastReply < (o.strangerReplyMs ?? 1000)) return;
    if (!theirs) lastReply = t;
    log(`Refused: ${note}.`);
    say(to, re, { t: "refused", why });
  };

  async function consider(raw: unknown): Promise<void> {
    const note = openBridgeSignal(raw, o.key, pubkey, now());
    if (!note || note.message.t !== "open") return;
    const from = note.from;
    for (const [id, until] of seen) if (until < now() - BRIDGE_LIMITS.skewSec) seen.delete(id);
    // Two kinds of grant, never taken for each other: a home's, for one connection in the next five minutes, and a
    // world's, for a world the owner is building and this computer was told about, good until it expires.
    const fromWorld = (note.message.grant as { kind?: unknown } | null)?.kind === BRIDGE_WORLD_GRANT_KIND;
    const asWorld = fromWorld ? verifyWorldGrant(note.message.grant, { owner: o.owner, bridge: pubkey, session: from, worlds: o.worlds ?? [], now: now() }) : null;
    const grant = asWorld ?? verifyBridgeGrant(note.message.grant, { owner: o.owner, bridge: pubkey, session: from, now: now(), seen });
    if (!grant.ok) {
      const codes = grant.errors.map((e) => e.code);
      return refuse(from, note.id, WHY[codes[0]!] ?? "That request wasn't one this computer accepts.", codes.join(", "));
    }
    const world = asWorld?.ok ? asWorld.value.world : undefined;
    // From here the request is the owner's. A home's grant is used up whatever happens next.
    if (!fromWorld) seen.set(grant.value.id, grant.value.expiresAt);
    // One question at a time, and one connection being made at a time.
    if (asking || [...sessions].some((x) => x.at === "connecting")) return refuse(from, note.id, "This computer is already answering a request. Try again in a moment.", "busy with another request", true);

    // The four digits come from the grant, or for a world from this very request: its grant is used many times.
    const code = grantCode(fromWorld ? note.id : grant.value.id);
    const asker = world ?? "home";
    if (now() >= (allowedUntil.get(asker) ?? 0)) {
      asking = true;
      say(from, note.id, { t: "wait" });
      const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), o.askTimeoutMs ?? 60_000).unref());
      const yes = await Promise.race([o.ask({ code, session: from, ...(world ? { world } : {}), open: sessions.size, replaces: sessions.size >= most }).catch(() => false), timeout]);
      asking = false;
      if (!yes) return refuse(from, note.id, "Nobody at the computer said yes.", "not allowed at the computer", true);
      if (o.allowForSec) allowedUntil.set(asker, now() + o.allowForSec);
    }
    // A few terminals at a time. When as many are open as may be, the owner being let in again takes the place
    // of the one whose home has been quiet longest: a headset in a drawer, a page that froze. So terminals
    // nobody is at can never keep the owner out.
    if (sessions.size >= most) [...sessions].sort((a, b) => a.heard - b.heard)[0]!.end("another was opened in its place");
    try {
      await connect(from, note.id, note.message.sdp, world);
    } catch (e) {
      for (const x of sessions) if (x.at === "connecting") x.end("it couldn't be made");
      refuse(from, note.id, "This computer couldn't make the connection.", `could not connect: ${(e as Error).message}`, true);
    }
  }

  async function connect(to: string, re: string, offer: string, world?: string): Promise<Session> {
    const pc = new RTCPeerConnection({ iceServers: o.iceServers ?? DEFAULT_ICE, iceUseDefaultStunServer: false });
    let terminal: Terminal | null = null;
    let channel: RTCDataChannel | null = null;
    let over = false;
    let idle: NodeJS.Timeout | undefined;
    const started = Date.now();
    // The lowest place that is free, so a terminal put away and opened again is the same one.
    let slot = 1;
    while ([...sessions].some((x) => x.slot === slot)) slot++;
    const mine: Session = { at: "connecting", slot, heard: Date.now(), end: (why) => end(why) };
    sessions.add(mine);
    const command = typeof o.command === "function" ? o.command(slot) : o.command;
    const label = most > 1 ? `Terminal ${slot}` : "Terminal";

    const end = (why: string) => {
      if (over) return;
      over = true;
      clearTimeout(idle);
      clearTimeout(waiting);
      clearTimeout(longest);
      clearInterval(listening);
      terminal?.close();
      sessions.delete(mine);
      const minutes = Math.round((Date.now() - started) / 60000);
      if (mine.at === "open") log(`${label} closed after ${minutes ? `${minutes} min` : "under a minute"}: ${why}.`);
      else log(`No terminal opened: ${why}.`);
      // Let the last frames leave before the connection goes.
      setTimeout(() => void pc.close().catch(() => undefined), 300).unref();
    };
    const touch = () => {
      clearTimeout(idle);
      idle = setTimeout(() => end("nothing happened for a long while"), o.idleMs ?? 30 * 60_000);
      idle.unref();
    };
    const waiting = setTimeout(() => !terminal && end("the other end never connected"), 30_000);
    const longest = setTimeout(() => end("it had been open as long as a session may be"), o.maxMs ?? 12 * 3600_000);
    // The home says it is there every few seconds. One that stops has gone, whatever the connection thinks.
    const listening = setInterval(() => Date.now() - mine.heard > (o.quietMs ?? 60_000) && end("the home went quiet"), 5000);
    waiting.unref();
    longest.unref();
    listening.unref();

    const begin = (cols: number, rows: number) => {
      if (terminal || over || !channel) return;
      const ch = channel;
      terminal = openTerminal({
        command,
        ...(o.cwd ? { cwd: o.cwd } : {}),
        cols,
        rows,
        onData(data) {
          touch();
          if (ch.readyState !== "open") return;
          for (let i = 0; i < data.length; i += CHUNK) ch.send(data.subarray(i, i + CHUNK));
          // A program that writes faster than the link carries is made to wait, not kept in memory.
          if (ch.bufferedAmount > HIGH_WATER) terminal?.pause();
        },
        onExit(code) {
          if (ch.readyState === "open") ch.send(JSON.stringify({ t: "exit", code }));
          end("the program ended");
        },
      });
      mine.at = "open";
      opened++;
      clearTimeout(waiting);
      touch();
      log(`${label} open${world ? `, from the world ${world}` : ""}. Running ${command.join(" ")}.`);
      ch.send(JSON.stringify({ t: "ready", name: o.name ?? `${userInfo().username}@${hostname()}`, speech: !!o.transcribe }));
    };

    // What the owner says, to be typed: sound in, words back. Only where this computer was told to listen.
    let ears: RTCDataChannel | null = null;
    const listen = (ch: RTCDataChannel) => {
      ears = ch;
      const most = BRIDGE_LIMITS.speechSeconds * BRIDGE_LIMITS.speechRate * 2;
      let said: { chunks: Buffer[]; bytes: number; lang: string } | null = null;
      let working = false;
      const reply = (message: object) => ch.readyState === "open" && ch.send(JSON.stringify(message));
      ch.onMessage.subscribe((data) => {
        if (over) return;
        mine.heard = Date.now();
        touch();
        if (typeof data !== "string") {
          if (!said) return;
          said.bytes += data.length;
          if (said.bytes <= most) said.chunks.push(Buffer.from(data));
          return;
        }
        const control = parseSpeechControl(data);
        if (control?.t === "begin") said = { chunks: [], bytes: 0, lang: control.lang };
        else if (control?.t === "cancel") said = null;
        else if (control?.t === "end" && said) {
          const heard = said;
          said = null;
          if (working) return void reply({ t: "sorry", why: "Still working out the last thing you said." });
          if (heard.bytes > most) return void reply({ t: "sorry", why: `That was more than ${BRIDGE_LIMITS.speechSeconds} seconds. Say it in shorter pieces.` });
          if (heard.bytes < BRIDGE_LIMITS.speechRate / 2) return void reply({ t: "text", text: "" });
          working = true;
          o.transcribe!(Buffer.concat(heard.chunks), { rate: BRIDGE_LIMITS.speechRate, lang: heard.lang }).then(
            (text) => reply({ t: "text", text: cleanSpeechText(text) }),
            (e: Error) => {
              log(`Couldn't make out what was said: ${e.message}`);
              reply({ t: "sorry", why: "Your computer couldn't make that out." });
            },
          ).finally(() => (working = false));
        }
      });
    };

    pc.onDataChannel.subscribe((ch) => {
      if (ch.label === "speech" && o.transcribe && !ears) return listen(ch);
      // One terminal channel, and one for speech where this computer listens. Anything else is not something this program does.
      if (ch.label !== "term" || channel) return ch.close();
      channel = ch;
      ch.bufferedAmountLowThreshold = HIGH_WATER / 4;
      ch.bufferedAmountLow.subscribe(() => terminal?.resume());
      ch.onMessage.subscribe((data) => {
        if (over) return;
        mine.heard = Date.now();
        if (typeof data === "string") {
          const said = parseBridgeControl(data);
          if (said?.t !== "size") return;
          if (terminal) terminal.resize(said.cols, said.rows);
          else begin(said.cols, said.rows);
          return;
        }
        if (data.length > BRIDGE_LIMITS.frameBytes) return;
        touch();
        if (!terminal) begin(100, 30);
        terminal?.write(data);
      });
      ch.stateChanged.subscribe((state) => {
        if (state === "closed" || state === "closing") end("the panel was closed");
      });
    });
    pc.connectionStateChange.subscribe((state) => {
      if (state === "failed" || state === "closed") end("the connection was lost");
      // A headset that fell asleep may wake; one that doesn't is gone.
      if (state === "disconnected") setTimeout(() => pc.connectionState !== "connected" && end("the connection was lost"), 20_000).unref();
    });

    await pc.setRemoteDescription({ type: "offer", sdp: offer });
    await pc.setLocalDescription(await pc.createAnswer());
    if (pc.iceGatheringState !== "complete") await Promise.race([pc.iceGatheringStateChange.watch((s) => s === "complete"), new Promise((r) => setTimeout(r, 3000).unref())]);
    if (!over) say(to, re, { t: "answer", sdp: pc.localDescription!.sdp });
    return mine;
  }

  return {
    pubkey,
    topic: bridgeTopic(pubkey),
    start() {
      if (relays) return;
      relays = openRelays(
        o.relays,
        { kinds: [ROOM_SIGNAL_KIND], "#x": [bridgeTopic(pubkey)], "#p": [pubkey] },
        (event) => {
          void consider(event).catch((e) => log(`Something went wrong reading a request: ${(e as Error).message}`));
        },
        (open) => o.onRelays?.(open, o.relays.length),
      );
    },
    async stop() {
      for (const x of [...sessions]) x.end("the Bridge was stopped");
      relays?.close();
      relays = null;
      await new Promise((r) => setTimeout(r, 350));
    },
    state: () => ({
      busy: asking ? "asking" : [...sessions].some((x) => x.at === "connecting") ? "connecting" : sessions.size ? "open" : "no",
      relays: relays?.count() ?? 0,
      opened,
      refused,
      sessions: sessions.size,
    }),
  };
}
