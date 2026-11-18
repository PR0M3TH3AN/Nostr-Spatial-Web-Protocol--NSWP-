/**
 * The home's end of the Bridge (browser/bridge.md): ask one computer for a
 * terminal, on its owner's say-so.
 *
 * A throwaway session key is made for the one connection. The owner's signer
 * signs a grant for it. The request goes to the Bridge as an encrypted note
 * through relays, and the terminal itself runs over a direct connection.
 * Nothing here holds the owner's key, and nothing a relay carries can be read.
 */
import {
  BRIDGE_GRANT_KIND,
  BRIDGE_LIMITS,
  bridgeTopic,
  buildBridgeGrant,
  buildBridgeSignal,
  cleanSize,
  getPublicKey,
  grantCode,
  openBridgeSignal,
  parseBridgeControl,
  ROOM_SIGNAL_KIND,
  verifyEvent,
  type EventTemplate,
  type NostrEvent,
} from "@nswp/core";

export type BridgeStatus =
  /** The owner's signer is being asked for a grant. */
  | { at: "signing" }
  /** The request is out. `code` is what the computer will show if it asks. */
  | { at: "finding"; code: string }
  /** Someone at the computer is being asked. */
  | { at: "asking"; code: string }
  | { at: "connecting" }
  | { at: "open"; name: string }
  /** The program ended. */
  | { at: "ended"; code: number }
  /** It never opened, or stopped. `why` can be shown as it is. */
  | { at: "closed"; why: string };

export interface BridgeLinkOptions {
  /** The Bridge's public key, as 64 hex characters. */
  bridge: string;
  relays: string[];
  /** The owner's signer. It is asked for one thing: the grant. */
  sign(template: EventTemplate): Promise<NostrEvent>;
  /** The owner's public key, so a grant signed by anyone else is never sent. */
  owner: string;
  cols: number;
  rows: number;
  onStatus(status: BridgeStatus): void;
  /** What the terminal wrote. */
  onData(bytes: Uint8Array): void;
  iceServers?: RTCIceServer[];
  /** How long to wait for the computer to answer at all. */
  answerMs?: number;
}

export interface BridgeLink {
  readonly status: BridgeStatus;
  /** Keys typed. Nothing is sent until the terminal is open. */
  send(bytes: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  close(): void;
}

const DEFAULT_ICE: RTCIceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
const encoder = new TextEncoder();

export function openBridgeLink(o: BridgeLinkOptions): BridgeLink {
  let status: BridgeStatus = { at: "signing" };
  let over = false;
  let pc: RTCPeerConnection | null = null;
  let channel: RTCDataChannel | null = null;
  let size = cleanSize(o.cols, o.rows) ?? { cols: 80, rows: 24 };
  const sockets: WebSocket[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const set = (next: BridgeStatus) => {
    status = next;
    o.onStatus(next);
  };
  const hangUp = () => {
    for (const t of timers.splice(0)) clearTimeout(t); // a timeout and an interval are stopped the same way
    for (const ws of sockets) ws.close();
    sockets.length = 0;
  };
  const end = (next: BridgeStatus) => {
    if (over) return;
    over = true;
    hangUp();
    try {
      channel?.close();
      pc?.close();
    } catch {
      /* already gone */
    }
    set(next);
  };

  void (async () => {
    // A throwaway key for this one connection.
    const sessionKey = crypto.getRandomValues(new Uint8Array(32));
    const session = getPublicKey(sessionKey);
    const grant = await o.sign(buildBridgeGrant({ session, bridge: o.bridge }));
    // Send only what was asked for, signed by the one who was asked.
    if (!verifyEvent(grant) || grant.pubkey !== o.owner || grant.kind !== BRIDGE_GRANT_KIND) throw new Error("The signer didn't sign the request as it was.");
    if (over) return;
    const code = grantCode(grant.id);

    pc = new RTCPeerConnection({ iceServers: o.iceServers ?? DEFAULT_ICE });
    const ch = pc.createDataChannel("term", { ordered: true });
    channel = ch;
    ch.binaryType = "arraybuffer";
    ch.onopen = () => {
      hangUp(); // the relays have done their part
      ch.send(JSON.stringify({ t: "size", ...size }));
      // Say "still here" every few seconds, so a computer whose home has gone doesn't keep a terminal open for nobody.
      timers.push(setInterval(() => ch.readyState === "open" && ch.send('{"t":"here"}'), 10_000));
    };
    ch.onmessage = (e) => {
      if (over) return;
      if (typeof e.data === "string") {
        const said = parseBridgeControl(e.data);
        if (said?.t === "ready") set({ at: "open", name: said.name });
        if (said?.t === "exit") end({ at: "ended", code: said.code });
        return;
      }
      const bytes = new Uint8Array(e.data as ArrayBuffer);
      if (bytes.length <= BRIDGE_LIMITS.frameBytes) o.onData(bytes);
    };
    ch.onclose = () => end({ at: "closed", why: "The connection to your computer closed." });
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === "failed") end({ at: "closed", why: "Your computer answered, but the two couldn't connect directly. They may need to be on the same network." });
    };
    await pc.setLocalDescription(await pc.createOffer());
    if (pc.iceGatheringState !== "complete") {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 3000);
        pc!.addEventListener("icegatheringstatechange", () => {
          if (pc!.iceGatheringState === "complete") {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
    if (over) return;

    const open = buildBridgeSignal(o.bridge, sessionKey, o.bridge, { t: "open", grant, sdp: pc.localDescription!.sdp });
    const seen = new Set<string>();
    const onNote = (raw: unknown) => {
      const note = openBridgeSignal(raw, sessionKey, o.bridge);
      // Only the Bridge, only about this request, and each note once.
      if (!note || note.from !== o.bridge || note.re !== open.id || seen.has(note.id) || over) return;
      seen.add(note.id);
      const m = note.message;
      if (m.t === "wait") {
        if (status.at === "finding") set({ at: "asking", code });
        // Someone has a minute to say yes at the computer, and a little over.
        timers.push(setTimeout(() => status.at === "asking" && end({ at: "closed", why: "Nobody at the computer said yes." }), 75_000));
      } else if (m.t === "refused") end({ at: "closed", why: m.why || "Your computer said no." });
      else if (m.t === "answer" && pc?.signalingState === "have-local-offer") {
        set({ at: "connecting" });
        void pc.setRemoteDescription({ type: "answer", sdp: m.sdp }).catch(() => end({ at: "closed", why: "Your computer's answer couldn't be used." }));
        timers.push(setTimeout(() => status.at === "connecting" && end({ at: "closed", why: "Your computer answered, but the two couldn't connect directly. They may need to be on the same network." }), 25_000));
      }
    };
    set({ at: "finding", code });
    let reached = 0;
    for (const url of o.relays) {
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        continue;
      }
      sockets.push(ws);
      ws.onopen = () => {
        reached++;
        ws.send(JSON.stringify(["REQ", "bridge", { kinds: [ROOM_SIGNAL_KIND], authors: [o.bridge], "#x": [bridgeTopic(o.bridge)], "#p": [session], since: Math.floor(Date.now() / 1000) - 5 }]));
        ws.send(JSON.stringify(["EVENT", open]));
      };
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(String(msg.data)) as unknown[];
          if (Array.isArray(data) && data[0] === "EVENT" && data[1] === "bridge") onNote(data[2]);
        } catch {
          /* not for us */
        }
      };
    }
    timers.push(
      setTimeout(() => {
        if (status.at === "finding") end({ at: "closed", why: reached ? "Your computer didn't answer. Is the Bridge running on it?" : "No relay could be reached, so your computer couldn't be asked." });
      }, o.answerMs ?? 20_000),
    );
  })().catch((e: unknown) => end({ at: "closed", why: e instanceof Error && e.message ? e.message : "The request couldn't be made." }));

  return {
    get status() {
      return status;
    },
    send(bytes) {
      if (over || status.at !== "open" || channel?.readyState !== "open") return;
      const data = typeof bytes === "string" ? encoder.encode(bytes) : bytes;
      // A long paste goes in pieces no larger than a frame may be.
      for (let i = 0; i < data.length; i += 16384) channel.send(data.slice(i, i + 16384));
    },
    resize(cols, rows) {
      const next = cleanSize(cols, rows);
      if (!next) return;
      size = next;
      if (!over && channel?.readyState === "open") channel.send(JSON.stringify({ t: "size", ...size }));
    },
    close: () => end({ at: "closed", why: "You closed it." }),
  };
}
