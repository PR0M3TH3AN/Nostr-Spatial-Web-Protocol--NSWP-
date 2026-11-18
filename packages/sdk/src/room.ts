/**
 * Peer-to-peer rooms (spec §9.4) — the Phase 4b SPIKE.
 *
 * Guests only: each visitor gets a throwaway session key, rooms are named by
 * a string, and there are no room events, passes, access rules or moderation
 * yet. Browsers connect directly with WebRTC; Nostr relays carry only the
 * encrypted handshake.
 *
 * Joining a room shows your IP address to the other members. Callers must
 * get the user's consent first (the reference worlds use a Join button).
 */
import { schnorr } from "@noble/curves/secp256k1.js";
import {
  buildHello,
  buildSignal,
  DEFAULT_RELAYS,
  getPublicKey,
  guestColor,
  guestName,
  openSignal,
  packPose,
  ROOM_LIMITS,
  ROOM_SIGNAL_KIND,
  roomTopic,
  shouldInitiate,
  unpackPose,
  type NostrEvent,
  type Pose,
  decodeLook,
  generatedLook,
  type Look,
} from "@nswp/core";

export interface Member {
  /** Session public key. In the spike everyone is a guest. */
  pubkey: string;
  guest: true;
  name: string;
  color: number;
  /** How they look (spec §4.2). What their session key generates, until they say otherwise. */
  look: Look;
}

export interface JoinOptions {
  /** Room name. People who share a world URL and a name share a room. Default "lobby". */
  name?: string;
  /** The world this room is in. Default: this page, without query or fragment. */
  world?: string;
  relays?: string[];
  maxMembers?: number;
  iceServers?: RTCIceServer[];
  /**
   * Your look, in its inline form (spec §4.2), to be drawn as by the others.
   * It is sent to each member directly, once connected, never to a relay.
   * Left out, you are drawn as your session key generates: new every visit.
   */
  look?: string;
}

export type RoomStatus = "connecting" | "open" | "no-relays" | "closed";

interface Events {
  member: (member: Member) => void;
  leave: (member: Member) => void;
  pose: (member: Member, pose: Pose) => void;
  /** A member said how they look. Arrives shortly after `member`. */
  look: (member: Member, look: Look) => void;
  audio: (member: Member, stream: MediaStream) => void;
  status: (status: RoomStatus) => void;
}

interface Peer {
  member: Member;
  pc: RTCPeerConnection;
  pose?: RTCDataChannel;
  open: boolean;
  lastSeen: number;
  startedAt: number;
}

const DEFAULT_ICE: RTCIceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
const HELLO_EVERY_MS = 20_000;
const CONNECT_TIMEOUT_MS = 25_000;
const SILENT_TIMEOUT_MS = 8_000;
const GATHER_TIMEOUT_MS = 2_500;

export class RoomSession {
  readonly self: Member;
  readonly name: string;
  readonly topic: string;
  status: RoomStatus = "connecting";

  private readonly key: Uint8Array;
  private readonly relays: string[];
  private readonly maxMembers: number;
  private readonly iceServers: RTCIceServer[];
  private readonly sockets = new Map<string, WebSocket>();
  private readonly peers = new Map<string, Peer>();
  private readonly seen = new Set<string>();
  private readonly listeners: { [K in keyof Events]: Set<Events[K]> } = {
    member: new Set(),
    leave: new Set(),
    pose: new Set(),
    look: new Set(),
    audio: new Set(),
    status: new Set(),
  };
  private readonly look: string | null;
  private mic: MediaStreamTrack | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private closed = false;

  constructor(opts: JoinOptions = {}) {
    this.key = schnorr.utils.randomSecretKey();
    const pubkey = getPublicKey(this.key);
    const mine = opts.look ? decodeLook(opts.look) : null;
    this.look = mine?.ok ? opts.look! : null;
    this.self = { pubkey, guest: true, name: guestName(pubkey), color: guestColor(pubkey), look: mine?.ok ? mine.value.look : generatedLook(pubkey) };
    this.name = (opts.name ?? "lobby").slice(0, ROOM_LIMITS.maxNameChars);
    this.topic = roomTopic(opts.world ?? `${location.origin}${location.pathname}`, this.name);
    this.relays = opts.relays ?? DEFAULT_RELAYS;
    this.maxMembers = opts.maxMembers ?? ROOM_LIMITS.defaultMaxMembers;
    this.iceServers = opts.iceServers ?? DEFAULT_ICE;
  }

  on<K extends keyof Events>(event: K, fn: Events[K]): () => void {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  private emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    for (const fn of this.listeners[event]) {
      try {
        (fn as (...a: Parameters<Events[K]>) => void)(...args);
      } catch (err) {
        console.error("nswp-sdk room listener failed", err);
      }
    }
  }

  get members(): Member[] {
    return [...this.peers.values()].filter((p) => p.open).map((p) => p.member);
  }

  /** How many relays are currently connected. */
  get relayCount(): number {
    return [...this.sockets.values()].filter((s) => s.readyState === WebSocket.OPEN).length;
  }

  start(): void {
    for (const url of this.relays) this.connectRelay(url);
    this.timers.push(
      setInterval(() => this.announce(), HELLO_EVERY_MS),
      setInterval(() => this.sweep(), 2000),
    );
    addEventListener("pagehide", this.onPageHide);
    setTimeout(() => {
      if (!this.closed && this.relayCount === 0) this.setStatus("no-relays");
    }, 8000);
  }

  private onPageHide = () => this.leave();

  private setStatus(s: RoomStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.emit("status", s);
  }

  private connectRelay(url: string): void {
    if (this.closed) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    this.sockets.set(url, ws);
    ws.onopen = () => {
      ws.send(JSON.stringify(["REQ", "room", { kinds: [ROOM_SIGNAL_KIND], "#x": [this.topic], since: Math.floor(Date.now() / 1000) - 5 }]));
      ws.send(JSON.stringify(["EVENT", buildHello(this.topic, this.key)]));
      this.setStatus("open");
    };
    ws.onmessage = (msg) => {
      let data: unknown;
      try {
        data = JSON.parse(String(msg.data));
      } catch {
        return;
      }
      if (Array.isArray(data) && data[0] === "EVENT" && data[1] === "room") void this.onEvent(data[2]);
    };
    ws.onclose = () => {
      if (this.sockets.get(url) === ws) this.sockets.delete(url);
      if (!this.closed) setTimeout(() => this.connectRelay(url), 5000);
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  private publish(event: NostrEvent): void {
    const frame = JSON.stringify(["EVENT", event]);
    for (const ws of this.sockets.values()) if (ws.readyState === WebSocket.OPEN) ws.send(frame);
  }

  private announce(): void {
    if (!this.closed && this.peers.size < this.maxMembers - 1) this.publish(buildHello(this.topic, this.key));
  }

  private async onEvent(raw: unknown): Promise<void> {
    const id = (raw as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || this.seen.has(id)) return;
    this.seen.add(id);
    if (this.seen.size > 2000) this.seen.clear();
    const opened = openSignal(raw, this.key, this.topic);
    if (!opened || this.closed) return;
    const { from, message } = opened;
    const existing = this.peers.get(from);
    try {
      switch (message.t) {
        case "hello":
        case "welcome": {
          if (existing) return;
          if (this.peers.size >= this.maxMembers - 1) return; // room is full for us
          if (shouldInitiate(this.self.pubkey, from)) await this.offerTo(from);
          else if (message.t === "hello") this.publish(buildSignal(this.topic, this.key, from, { t: "welcome" }));
          return;
        }
        case "offer": {
          if (existing?.open) return;
          if (shouldInitiate(this.self.pubkey, from)) return; // they aren't the initiator for this pair
          if (!existing && this.peers.size >= this.maxMembers - 1) return;
          if (existing) this.drop(from, false);
          await this.answerTo(from, message.sdp);
          return;
        }
        case "answer": {
          if (!existing || existing.pc.signalingState !== "have-local-offer") return;
          await existing.pc.setRemoteDescription({ type: "answer", sdp: message.sdp });
          return;
        }
        case "bye":
          this.drop(from, true);
          return;
      }
    } catch (err) {
      console.warn("nswp-sdk room handshake failed", err);
      this.drop(from, false);
    }
  }

  private createPeer(pubkey: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = {
      member: { pubkey, guest: true, name: guestName(pubkey), color: guestColor(pubkey), look: generatedLook(pubkey) },
      pc,
      open: false,
      lastSeen: Date.now(),
      startedAt: Date.now(),
    };
    this.peers.set(pubkey, peer);
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      this.emit("audio", peer.member, stream);
    };
    pc.onconnectionstatechange = () => {
      if ((pc.connectionState === "failed" || pc.connectionState === "closed") && this.peers.get(pubkey) === peer) this.drop(pubkey, peer.open);
    };
    return peer;
  }

  private wirePoseChannel(peer: Peer, ch: RTCDataChannel): void {
    ch.binaryType = "arraybuffer";
    peer.pose = ch;
    ch.onopen = () => {
      if (peer.open || this.peers.get(peer.member.pubkey) !== peer) return;
      peer.open = true;
      peer.lastSeen = Date.now();
      this.emit("member", peer.member);
      this.sayLook(ch);
    };
    ch.onmessage = (e) => {
      if (typeof e.data === "string") {
        // The one text message there is: how this member looks. Anything unreadable is ignored.
        const said = e.data.startsWith("look:") ? decodeLook(e.data.slice(5)) : null;
        if (said?.ok && JSON.stringify(said.value.look) !== JSON.stringify(peer.member.look)) {
          peer.member.look = said.value.look;
          this.emit("look", peer.member, said.value.look);
        }
        return;
      }
      if (!(e.data instanceof ArrayBuffer)) return;
      const pose = unpackPose(e.data);
      if (!pose) return;
      peer.lastSeen = Date.now();
      this.emit("pose", peer.member, pose);
    };
    ch.onclose = () => {
      // An old connection closing must not remove a newer one to the same member.
      if (this.peers.get(peer.member.pubkey) === peer) this.drop(peer.member.pubkey, peer.open);
    };
  }

  /**
   * Tell one member how you look. The channel drops what it can't deliver at
   * once, so it is said a few times over the first seconds.
   */
  private sayLook(ch: RTCDataChannel): void {
    if (!this.look) return;
    const text = `look:${this.look}`;
    let left = 4;
    const say = () => {
      if (this.closed || ch.readyState !== "open") return;
      try {
        ch.send(text);
      } catch {
        /* the channel closed under us */
      }
      if (--left > 0) setTimeout(say, 1500);
    };
    say();
  }

  private async gathered(pc: RTCPeerConnection): Promise<string> {
    if (pc.iceGatheringState !== "complete") {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, GATHER_TIMEOUT_MS);
        pc.addEventListener("icegatheringstatechange", () => {
          if (pc.iceGatheringState === "complete") {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
    return pc.localDescription!.sdp;
  }

  private audioTransceiver(pc: RTCPeerConnection): RTCRtpTransceiver | undefined {
    return pc.getTransceivers().find((t) => t.receiver.track.kind === "audio");
  }

  private async offerTo(pubkey: string): Promise<void> {
    const peer = this.createPeer(pubkey);
    // The audio line is negotiated up front, so turning the microphone on
    // later is just a track swap with no second handshake.
    const audio = peer.pc.addTransceiver("audio", { direction: "sendrecv" });
    if (this.mic) await audio.sender.replaceTrack(this.mic);
    this.wirePoseChannel(peer, peer.pc.createDataChannel("pose", { ordered: false, maxRetransmits: 0 }));
    await peer.pc.setLocalDescription(await peer.pc.createOffer());
    const sdp = await this.gathered(peer.pc);
    if (this.peers.get(pubkey) === peer) this.publish(buildSignal(this.topic, this.key, pubkey, { t: "offer", sdp }));
  }

  private async answerTo(pubkey: string, sdp: string): Promise<void> {
    const peer = this.createPeer(pubkey);
    peer.pc.ondatachannel = (e) => {
      if (e.channel.label === "pose") this.wirePoseChannel(peer, e.channel);
    };
    await peer.pc.setRemoteDescription({ type: "offer", sdp });
    const audio = this.audioTransceiver(peer.pc);
    if (audio) {
      audio.direction = "sendrecv";
      if (this.mic) await audio.sender.replaceTrack(this.mic);
    }
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    const answer = await this.gathered(peer.pc);
    if (this.peers.get(pubkey) === peer) this.publish(buildSignal(this.topic, this.key, pubkey, { t: "answer", sdp: answer }));
  }

  private drop(pubkey: string, announce: boolean): void {
    const peer = this.peers.get(pubkey);
    if (!peer) return;
    this.peers.delete(pubkey);
    try {
      peer.pc.close();
    } catch {
      /* already closed */
    }
    if (announce && peer.open) this.emit("leave", peer.member);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [pubkey, peer] of this.peers) {
      if (!peer.open && now - peer.startedAt > CONNECT_TIMEOUT_MS) this.drop(pubkey, false);
      else if (peer.open && now - peer.lastSeen > SILENT_TIMEOUT_MS) this.drop(pubkey, true);
    }
  }

  /** Send your pose to everyone. Call 10–20 times a second, from a timer rather than the render loop. */
  sendPose(pose: Pose): void {
    if (this.closed) return;
    let packet: ArrayBuffer | undefined;
    for (const peer of this.peers.values()) {
      if (peer.open && peer.pose?.readyState === "open" && peer.pose.bufferedAmount < 4096) {
        packet ??= packPose(pose);
        peer.pose.send(packet);
      }
    }
  }

  /** Start or stop sending a microphone track to everyone. */
  async setMicrophone(track: MediaStreamTrack | null): Promise<void> {
    this.mic = track;
    await Promise.all(
      [...this.peers.values()].map(async (peer) => {
        try {
          await this.audioTransceiver(peer.pc)?.sender.replaceTrack(track);
        } catch {
          /* peer is going away */
        }
      }),
    );
  }

  leave(): void {
    if (this.closed) return;
    for (const pubkey of this.peers.keys()) {
      try {
        this.publish(buildSignal(this.topic, this.key, pubkey, { t: "bye" }));
      } catch {
        /* best effort */
      }
    }
    this.closed = true;
    for (const t of this.timers) clearInterval(t);
    removeEventListener("pagehide", this.onPageHide);
    for (const pubkey of [...this.peers.keys()]) this.drop(pubkey, true);
    for (const ws of this.sockets.values()) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    this.sockets.clear();
    this.setStatus("closed");
  }
}

export const room = {
  /**
   * Join a peer-to-peer room. Other members will see your IP address, so
   * call this only after the user has agreed.
   */
  async join(opts: JoinOptions = {}): Promise<RoomSession> {
    if (typeof RTCPeerConnection === "undefined") throw new Error("nswp-sdk: this browser has no WebRTC support");
    const session = new RoomSession(opts);
    session.start();
    return session;
  },
};
