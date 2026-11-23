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
  buildSay,
  buildSignal,
  CHAT_LIMITS,
  createChatGate,
  parseSay,
  type ChatGate,
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
  claimsKey,
  decodeLook,
  generatedLook,
  markFor,
  PASS_LIMITS,
  shortNpub,
  verifyRoomPass,
  type Look,
  type VerifiedPass,
  createRate,
  itemCoordinate,
  AVATAR_KIND,
  LOOK_NOTE_LIMIT,
  readLookModel,
  verifyEvent,
  type LookModel,
} from "@nswp/core";

export interface Member {
  /** Session public key: a throwaway, new each visit. */
  pubkey: string;
  /** True until their pass has checked out (protocol/10-identity.md). */
  guest: boolean;
  /** The identity key behind them, once their pass has checked out. Never taken on their say-so. */
  identity?: string;
  /** A proven member's own name, or the short form of their key. A guest is "Guest" and four digits. */
  name: string;
  /** Where a proven member's picture is, as their pass says. Never there for a guest. */
  picture?: string;
  /** What a proven member wrote about themselves, as their pass says. Their own words. Never there for a guest. */
  about?: string;
  color: number;
  /** How they look (spec §4.2). What their session key generates, until they say otherwise. */
  look: Look;
  /**
   * The model of their own they wear (protocol/05-looks.md, "A model of your own"), from the look note they handed
   * the room: only once their pass has checked out, and only if that note is really signed by the key the pass
   * names. Left out for a guest, and for someone who wears none.
   */
  model?: LookModel;
  /** They have said they are recording what they see (spec §9). */
  recording: boolean;
  /** The item they say they are holding, by its coordinate (protocol/17-items.md). Left out when they hold nothing. */
  holding?: string;
  /**
   * They joined after this visitor did: their joining hello was signed after this visitor joined. Such a person is
   * the one arriving, and steps aside themselves if they find themselves inside this visitor (protocol/01-worlds.md,
   * "Places to arrive"): this visitor is never moved for them.
   */
  joinedAfterYou?: boolean;
  /** They are offering their screen to the room. It is sent only to members who ask to watch. */
  sharing?: boolean;
  /** They are offering their music to people near them. It is sent only to members who ask to hear it. */
  music?: boolean;
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
  /**
   * Who you are, if you chose to go by name: the pass your own client signed
   * and the session key it names, usually from `arrival.identity()`. It is
   * checked here, and shown to each member directly, never to a relay.
   */
  identity?: { pass: NostrEvent; sessionKey: string };
  /**
   * Your look note (kind 37301), signed by your own key, where it names a model of your own: handed to each member
   * directly, never to a relay, so nobody has to ask one for it (NSWP-06, the `avatar` message). Only sent when you
   * came by name, and only if it is signed by the key your pass names. At most `LOOK_NOTE_LIMIT` bytes.
   */
  avatar?: NostrEvent | null;
  /**
   * Keys this visitor has blocked: the identity keys of people who came by
   * name, or session keys from this visit. Nobody on it is connected to.
   */
  blocked?: Iterable<string>;
  /**
   * Identity keys the world's owner keeps out (protocol/10-identity.md, "A world's own lists"): someone whose pass
   * names one is not shown, heard or answered here. Kept apart from `blocked`, which is the visitor's own: this is
   * never kept, never reported and never carried on to another world.
   */
  ownerBlocked?: Iterable<string>;
  /**
   * This world's rooms show only people whose pass checks out (its manifest's `named_only`): a member is shown and
   * heard only once their pass has checked out, and one who shows none within a few seconds is let go.
   */
  namedOnly?: boolean;
  /**
   * Where the world is by invitation: the identity keys that may be in its rooms (the people its owner invited,
   * and the keepers). A member is shown and heard only once their pass names one of them, as for `namedOnly`, and
   * anyone else is let go. Left out or null, the world isn't by invitation.
   */
  invited?: Iterable<string> | null;
}

export type RoomStatus = "connecting" | "open" | "no-relays" | "closed";

interface Events {
  member: (member: Member) => void;
  leave: (member: Member) => void;
  pose: (member: Member, pose: Pose) => void;
  /** A member said how they look. Arrives shortly after `member`. */
  look: (member: Member, look: Look) => void;
  /** A member's pass checked out, or ran out: `member.guest`, `identity` and `name` have changed. */
  identity: (member: Member) => void;
  /** A member started or stopped recording what they see. */
  recording: (member: Member, on: boolean) => void;
  /** A member took an item in hand, or put it away: its coordinate, or "". */
  holding: (member: Member, item: string) => void;
  /** A member said something of an item in play (protocol/17-items.md): a thing sent out, a hit, a sound, their state. */
  play: (member: Member, said: string) => void;
  audio: (member: Member, stream: MediaStream) => void;
  /** A member started or stopped offering their screen. */
  screen: (member: Member, on: boolean) => void;
  /** A member started or stopped offering their music. */
  tune: (member: Member, on: boolean) => void;
  /** The line a member's music arrives on. It carries sound only while they share and this visitor listens. */
  music: (member: Member, stream: MediaStream) => void;
  /** The line a member's screen arrives on. It carries pictures only while they share and this visitor watches. */
  video: (member: Member, stream: MediaStream) => void;
  /**
   * Someone wrote a few words to the room (protocol/06-rooms.md, "Words"): another member, or this visitor
   * themselves (`member` is then `self`). The words are tidied and safe to show as text. Nothing keeps them.
   */
  said: (member: Member, line: SaidLine) => void;
  status: (status: RoomStatus) => void;
}

/** A few words someone wrote to the room. */
export interface SaidLine {
  /** Tells this line from any other of theirs. */
  id: string;
  text: string;
  /** When it was read here, in milliseconds. A line carries no time of its own. */
  at: number;
}

interface Peer {
  member: Member;
  pc: RTCPeerConnection;
  /** Until when their last "I am recording" holds. */
  recordingUntil?: number;
  /** Until when their last "I am sharing my screen" holds. */
  sharingUntil?: number;
  /** Until when their last "I am watching your screen" holds. */
  watchingUntil?: number;
  /** Whether this visitor's screen is going to them now. */
  fed?: boolean;
  /** Until when their last "I am sharing my music" holds. */
  tuneUntil?: number;
  /** Until when their last "I am listening to your music" holds. */
  hearingUntil?: number;
  /** Whether this visitor's music is going to them now. */
  tuned?: boolean;
  /** What they last said about how they look, as it was read. */
  said?: { look: Look; seed: string };
  /** The look note they last handed the room, word for word: believed only once their pass names its author. */
  avatar?: string;
  /** The last pass they showed, word for word, so the same one isn't checked twice. */
  shown?: string;
  /** How many passes of theirs have failed. Past a few, they are not checked any more. */
  refused: number;
  /** What they have written lately, counted: a repeat is taken once, and nobody floods the room. */
  words: ChatGate;
  /** How much this member may say of items in play: a burst, and then so many a second. */
  plays: { take(nowMs: number): boolean };
  /** When their pass stops, in seconds. */
  passUntil?: number;
  pose?: RTCDataChannel;
  open: boolean;
  /** When their channel opened, in milliseconds. */
  openedAt?: number;
  lastSeen: number;
  startedAt: number;
}

/** What may be said of an item in play, and how much of it one member may say. */
const PLAY_WORD = /^(shot|hit|did|st|tint):/;
const PLAY_SAID = { burst: 40, perSecond: 30 } as const;

const DEFAULT_ICE: RTCIceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
const HELLO_EVERY_MS = 20_000;
/** How long one "I am recording" keeps the light on. It is repeated every two seconds. */
const RECORDING_HOLD_MS = 6000;
const CONNECT_TIMEOUT_MS = 25_000;
const SILENT_TIMEOUT_MS = 8_000;
/**
 * How long a member has to show a pass in a room that shows only named people. A pass is said as the channel
 * opens and three more times, a second and a half apart, so a member who has one has shown it well before this.
 */
export const NAMED_WAIT_MS = 7_000;
const GATHER_TIMEOUT_MS = 2_500;

const hexToBytes = (hex: string): Uint8Array => {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error("not a key");
  return Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
};

/**
 * How a member is drawn (protocol/10-identity.md, "The mark"). A proven
 * member wears their identity key's mark whatever their look says. A look
 * whose seed is a key is a claim to it, and without a pass the claim isn't
 * honoured: the mark is the session key's.
 */
/** The model a look note names, if it is really a look note signed by `author`. */
function modelOf(note: unknown, author: string): LookModel | undefined {
  if (!verifyEvent(note) || note.kind !== AVATAR_KIND || note.pubkey !== author) return undefined;
  return readLookModel(note) ?? undefined;
}
function modelFrom(text: string, author: string): LookModel | undefined {
  try {
    return modelOf(JSON.parse(text), author);
  } catch {
    return undefined;
  }
}

function seenLook(member: Pick<Member, "pubkey" | "identity">, said?: { look: Look; seed: string }): Look {
  const look = said?.look ?? generatedLook(member.pubkey);
  if (member.identity) return { ...look, mark: markFor(member.identity) };
  if (said && claimsKey(said.seed)) return { ...look, mark: markFor(member.pubkey) };
  return look;
}

/** How many passes that fail are checked from one member before they are ignored. */
const PASS_TRIES = 4;

export class RoomSession {
  readonly self: Member;
  readonly name: string;
  readonly topic: string;
  status: RoomStatus = "connecting";

  private readonly key: Uint8Array;
  private readonly relays: string[];
  /** Keys this visitor won't be in a room with: session keys, and the identity keys behind names. */
  private readonly blocked = new Set<string>();
  /** Identity keys the world's owner keeps out. Never the visitor's own: never kept or carried on. */
  private ownerBlocked = new Set<string>();
  /** Session keys let go this visit for the world's rules (the owner's list, or no pass where one is needed): not answered again. */
  private readonly turnedAway = new Set<string>();
  /** Whether this room shows only people whose pass checks out: so where it is by invitation, too. */
  readonly namedOnly: boolean;
  /** Where the world is by invitation, who may be in its rooms; null where it isn't. */
  private invited: Set<string> | null = null;
  /** In a room that shows only named people: the members shown, by session key, and what arrived for each before. */
  private readonly announced = new Set<string>();
  private readonly waiting = new Map<string, { kind: "audio" | "music" | "video"; stream: MediaStream }[]>();
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
    identity: new Set(),
    recording: new Set(),
    holding: new Set(),
    play: new Set(),
    screen: new Set(),
    video: new Set(),
    tune: new Set(),
    music: new Set(),
    audio: new Set(),
    said: new Set(),
    status: new Set(),
  };
  private readonly look: string | null;
  /** The world's origin: the only place a pass shown here may have been made for. */
  private readonly origin: string;
  /** This visitor's own pass, as it is said to the others, and when it stops. */
  private pass: string | null = null;
  /** This visitor's own look note, as it is handed to each member: only where it is their pass's key's. */
  private avatar: string | null = null;
  /** The item this visitor says they are holding, by its coordinate, or "". */
  private held = "";
  /** The colours this visitor chose for what they hold, as they are said ("tint:…"), or "". */
  private tints = "";
  private passUntil = 0;
  private recordingTimer: ReturnType<typeof setInterval> | undefined;
  /** This visitor's shared screen, while they share one. */
  private screen: MediaStreamTrack | null = null;
  private screenTimer: ReturnType<typeof setInterval> | undefined;
  /** This visitor's music, while they share it. */
  private tune: MediaStreamTrack | null = null;
  private tuneTimer: ReturnType<typeof setInterval> | undefined;
  /** Whose music this visitor is listening to. */
  private readonly heard = new Set<string>();
  private hearTimer: ReturnType<typeof setInterval> | undefined;
  /** Whose screens this visitor is watching. */
  private readonly watched = new Set<string>();
  private watchTimer: ReturnType<typeof setInterval> | undefined;
  private mic: MediaStreamTrack | null = null;
  /** This visitor's own words, counted as everyone's are. */
  private readonly words = createChatGate();
  private timers: ReturnType<typeof setInterval>[] = [];
  private closed = false;
  /** When this visitor joined, in unix seconds, and who has joined since (by a joining hello signed after it). */
  private joinedAt = Math.floor(Date.now() / 1000);
  private readonly newer = new Set<string>();

  constructor(opts: JoinOptions = {}) {
    const world = opts.world ?? `${location.origin}${location.pathname}`;
    this.origin = new URL(world).origin;
    // Going by name: the session key is the one the pass names. Anything that doesn't check out is a guest.
    let key: Uint8Array = schnorr.utils.randomSecretKey();
    let proven: VerifiedPass | null = null;
    if (opts.identity) {
      try {
        const named = hexToBytes(opts.identity.sessionKey);
        const checked = verifyRoomPass(opts.identity.pass, { origin: this.origin, session: getPublicKey(named) });
        const text = JSON.stringify(opts.identity.pass);
        if (checked.ok && text.length <= PASS_LIMITS.chars) {
          key = named;
          proven = checked.value;
          this.pass = text;
          this.passUntil = checked.value.expiresAt;
        }
      } catch {
        /* not a usable key: a guest */
      }
    }
    this.key = key;
    const pubkey = getPublicKey(this.key);
    const mine = opts.look ? decodeLook(opts.look) : null;
    this.look = mine?.ok ? opts.look! : null;
    this.self = { pubkey, guest: true, name: guestName(pubkey), color: guestColor(pubkey), look: generatedLook(pubkey), recording: false };
    if (proven) Object.assign(this.self, { guest: false, identity: proven.pubkey, name: proven.name || shortNpub(proven.pubkey), ...(proven.picture ? { picture: proven.picture } : {}), ...(proven.about ? { about: proven.about } : {}) });
    this.self.look = seenLook(this.self, mine?.ok ? mine.value : undefined);
    // A model of their own goes only with a name: a guest has no key it could be tied to.
    if (proven && opts.avatar) {
      const text = JSON.stringify(opts.avatar);
      const model = text.length <= LOOK_NOTE_LIMIT ? modelOf(opts.avatar, proven.pubkey) : undefined;
      if (model) {
        this.avatar = text;
        this.self.model = model;
      }
    }
    this.name = (opts.name ?? "lobby").slice(0, ROOM_LIMITS.maxNameChars);
    this.topic = roomTopic(world, this.name);
    this.relays = opts.relays ?? DEFAULT_RELAYS;
    this.maxMembers = opts.maxMembers ?? ROOM_LIMITS.defaultMaxMembers;
    this.iceServers = opts.iceServers ?? DEFAULT_ICE;
    for (const k of opts.blocked ?? []) if (/^[0-9a-f]{64}$/.test(k)) this.blocked.add(k);
    for (const k of opts.ownerBlocked ?? []) if (/^[0-9a-f]{64}$/.test(k)) this.ownerBlocked.add(k);
    this.invited = opts.invited ? new Set([...opts.invited].filter((k) => /^[0-9a-f]{64}$/.test(k))) : null;
    this.namedOnly = opts.namedOnly === true || this.invited !== null;
  }

  /** Who may be in this world's rooms, as its gate last read the owner's allow list. Anyone here not on it is let go at once. */
  setInvited(keys: Iterable<string> | null): void {
    if (keys === null || this.invited === null) return;
    this.invited = new Set([...keys].filter((k) => /^[0-9a-f]{64}$/.test(k)));
    for (const peer of [...this.peers.values()]) if (peer.member.identity && !this.invited.has(peer.member.identity)) this.turnAway(peer.member.pubkey);
  }

  /**
   * The keys the world's owner keeps out, as the world's gate last read them. Anyone here whose pass names one is
   * let go at once: to them, this visitor has left. Nobody is told, and nothing is kept.
   */
  setOwnerBlocked(keys: Iterable<string>): void {
    this.ownerBlocked = new Set([...keys].filter((k) => /^[0-9a-f]{64}$/.test(k)));
    for (const peer of [...this.peers.values()]) if (peer.member.identity && this.ownerBlocked.has(peer.member.identity)) this.turnAway(peer.member.pubkey);
  }

  /** Let someone go for the world's rules, and answer them no more this visit. */
  private turnAway(pubkey: string): void {
    this.turnedAway.add(pubkey);
    try {
      this.publish(buildSignal(this.topic, this.key, pubkey, { t: "bye" }));
    } catch {
      /* the closed connection says it */
    }
    this.drop(pubkey, true);
  }

  /**
   * Stop being in a room with someone. The connection to them is closed and
   * no new one is made, by their session key and, if they came by name, by
   * the key behind the name: so it holds when they come back. It is this
   * visitor's decision alone and nobody else is told; to the blocked person,
   * this visitor has left. Returns what was blocked, or null if they aren't
   * here.
   */
  block(pubkey: string): { session: string; identity?: string; name: string } | null {
    const peer = this.peers.get(pubkey);
    if (!peer) return null;
    const { identity, name } = peer.member;
    this.blocked.add(pubkey);
    if (identity) this.blocked.add(identity);
    try {
      this.publish(buildSignal(this.topic, this.key, pubkey, { t: "bye" }));
    } catch {
      /* they find out when the connection closes */
    }
    this.drop(pubkey, true);
    return { session: pubkey, ...(identity ? { identity } : {}), name };
  }

  /** Let someone back: they are connected to again the next time either side announces itself. */
  unblock(key: string): void {
    this.blocked.delete(key);
  }

  isBlocked(key: string): boolean {
    return this.blocked.has(key);
  }

  on<K extends keyof Events>(event: K, fn: Events[K]): () => void {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  private emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    // In a room that shows only named people, nothing of a member is passed on until their pass has checked out:
    // not that they are here, not how they look or where they stand, not a word. The lines their sound and pictures
    // come on are kept until then; everything else is let go.
    const about = args[0] as Member | undefined;
    if (this.namedOnly && about && typeof about === "object" && about !== this.self && !this.announced.has(about.pubkey)) {
      if (event === "audio" || event === "music" || event === "video") {
        const kept = this.waiting.get(about.pubkey) ?? [];
        this.waiting.set(about.pubkey, [...kept.filter((w) => w.kind !== event), { kind: event as "audio" | "music" | "video", stream: args[1] as MediaStream }]);
      }
      return;
    }
    for (const fn of this.listeners[event]) {
      try {
        (fn as (...a: Parameters<Events[K]>) => void)(...args);
      } catch (err) {
        console.error("nswp-sdk room listener failed", err);
      }
    }
  }

  get members(): Member[] {
    return [...this.peers.values()].filter((p) => p.open && (!this.namedOnly || this.announced.has(p.member.pubkey))).map((p) => p.member);
  }

  /** How many relays are currently connected. */
  get relayCount(): number {
    return [...this.sockets.values()].filter((s) => s.readyState === WebSocket.OPEN).length;
  }

  start(): void {
    this.joinedAt = Math.floor(Date.now() / 1000);
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
      // The joining hello says it is one (`first`), while it is still the joining: a relay reached late, or again,
      // is not someone joining anew.
      ws.send(JSON.stringify(["EVENT", buildHello(this.topic, this.key, undefined, { first: Math.floor(Date.now() / 1000) - this.joinedAt < 15 })]));
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
    // Someone this visitor blocked is not answered, whatever they send; nor anyone let go for the world's rules.
    if (this.blocked.has(from) || this.turnedAway.has(from)) return;
    const existing = this.peers.get(from);
    try {
      switch (message.t) {
        case "hello":
        case "welcome": {
          if (existing) return;
          if (this.peers.size >= this.maxMembers - 1) return; // room is full for us
          // Someone's joining hello (`first`), signed after this visitor joined: they arrived after them. Those already
          // here answer this visitor's own hello instead, and their hello every 20 seconds isn't marked. Two who
          // joined in the same second are told apart by their session keys, so exactly one is the later.
          const at = (raw as { created_at?: unknown }).created_at;
          if (message.t === "hello" && message.first === true && typeof at === "number" && (at > this.joinedAt || (at === this.joinedAt && from > this.self.pubkey))) this.newer.add(from);
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
      member: { pubkey, guest: true, name: guestName(pubkey), color: guestColor(pubkey), look: generatedLook(pubkey), recording: false, ...(this.newer.has(pubkey) ? { joinedAfterYou: true } : {}) },
      pc,
      refused: 0,
      words: createChatGate(),
      plays: createRate(PLAY_SAID.burst, PLAY_SAID.perSecond),
      open: false,
      lastSeen: Date.now(),
      startedAt: Date.now(),
    };
    this.peers.set(pubkey, peer);
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      // Three lines to each member: their voice, their screen, and their music. The last two are there from the
      // start and stay empty until they share and this visitor asks. Voice is the first sound line, music the second.
      if (e.track.kind === "video") this.emit("video", peer.member, stream);
      else this.emit(e.transceiver && e.transceiver === this.musicTransceiver(pc) ? "music" : "audio", peer.member, stream);
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
      peer.openedAt = Date.now();
      this.emit("member", peer.member);
      this.introduce(ch);
    };
    ch.onmessage = (e) => {
      if (e.data === "scr:1" || e.data === "scr:0") {
        // Said again every couple of seconds while it is true, as recording is, on a channel that may lose words.
        peer.sharingUntil = e.data === "scr:1" ? Date.now() + RECORDING_HOLD_MS : 0;
        this.markSharing(peer);
        return;
      }
      if (e.data === "mus:1" || e.data === "mus:0") {
        peer.tuneUntil = e.data === "mus:1" ? Date.now() + RECORDING_HOLD_MS : 0;
        this.markTune(peer);
        return;
      }
      if (e.data === "hear:1" || e.data === "hear:0") {
        peer.hearingUntil = e.data === "hear:1" ? Date.now() + RECORDING_HOLD_MS : 0;
        void this.feedTune(peer);
        return;
      }
      if (e.data === "watch:1" || e.data === "watch:0") {
        peer.watchingUntil = e.data === "watch:1" ? Date.now() + RECORDING_HOLD_MS : 0;
        void this.feed(peer);
        return;
      }
      if (e.data === "rec:1" || e.data === "rec:0") {
        // "I am recording" is said again every couple of seconds while it is true, so a lost message can't leave the light stuck either way.
        peer.recordingUntil = e.data === "rec:1" ? Date.now() + RECORDING_HOLD_MS : 0;
        this.markRecording(peer);
        return;
      }
      if (typeof e.data === "string") {
        if (e.data.startsWith("avatar:")) {
          // Their look note, kept as it came: it counts only once their pass names the key that signed it.
          const text = e.data.slice(7);
          if (text.length <= LOOK_NOTE_LIMIT && text !== peer.avatar) {
            peer.avatar = text;
            this.redraw(peer);
          }
        } else if (e.data.startsWith("look:")) {
          // How this member looks. Anything unreadable is ignored.
          const said = decodeLook(e.data.slice(5));
          if (said.ok) {
            peer.said = said.value;
            this.redraw(peer);
          }
        } else if (e.data.startsWith("id:")) this.checkPass(peer, e.data.slice(3));
        else if (e.data.startsWith("hold:")) {
          // What they hold, by its coordinate: anything that isn't an item's coordinate is "nothing".
          const item = itemCoordinate(e.data.slice(5));
          if ((peer.member.holding ?? "") !== item) {
            if (item) peer.member.holding = item;
            else delete peer.member.holding;
            this.emit("holding", peer.member, item);
          }
        }
        else if (PLAY_WORD.test(e.data)) {
          // Something of an item in play. Passed on as it was said: whoever draws the room reads it, and reads it
          // strictly. No more than so many from one member, whatever their client does.
          if (peer.plays.take(Date.now())) this.emit("play", peer.member, e.data);
        }
        else if (e.data.startsWith("say:")) {
          // A few words to the room. Each is sent several times; the first is taken, and no more than a few in a while.
          const line = parseSay(e.data);
          const now = Date.now();
          if (line && peer.words.take(line.id, now)) this.emit("said", peer.member, { ...line, at: now });
        }
        // Anything else is a message from a newer client, and is not for us.
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

  /** Draw a member again if what is known about them changes how they look. */
  private redraw(peer: Peer): void {
    const look = seenLook(peer.member, peer.said);
    const model = peer.member.identity && peer.avatar ? modelFrom(peer.avatar, peer.member.identity) : undefined;
    if (JSON.stringify(look) === JSON.stringify(peer.member.look) && JSON.stringify(model) === JSON.stringify(peer.member.model)) return;
    peer.member.look = look;
    if (model) peer.member.model = model;
    else delete peer.member.model;
    this.emit("look", peer.member, look);
  }

  /**
   * A member has shown a pass. It counts only if it checks out for this site
   * and names the session key they are speaking with, which they have already
   * proved they hold: the handshake was signed with it.
   */
  private checkPass(peer: Peer, text: string): void {
    if (text === peer.shown || text.length > PASS_LIMITS.chars || peer.refused >= PASS_TRIES) return;
    peer.shown = text;
    let event: unknown;
    try {
      event = JSON.parse(text);
    } catch {
      peer.refused++;
      return;
    }
    const checked = verifyRoomPass(event, { origin: this.origin, session: peer.member.pubkey });
    if (!checked.ok) {
      peer.refused++;
      return;
    }
    // Who someone is comes out only once they are connected and show a pass, which they do at once. If this
    // visitor blocked that person before, the connection ends here, a moment after it began.
    if (this.blocked.has(checked.value.pubkey)) {
      this.blocked.add(peer.member.pubkey);
      try {
        this.publish(buildSignal(this.topic, this.key, peer.member.pubkey, { t: "bye" }));
      } catch {
        /* the closed connection says it */
      }
      this.drop(peer.member.pubkey, true);
      return;
    }
    // Someone the world's owner keeps out, or hasn't invited where it is by invitation: let go the moment who they are is known.
    if (this.ownerBlocked.has(checked.value.pubkey) || (this.invited && !this.invited.has(checked.value.pubkey))) return this.turnAway(peer.member.pubkey);
    peer.passUntil = checked.value.expiresAt;
    Object.assign(peer.member, { guest: false, identity: checked.value.pubkey, name: checked.value.name || shortNpub(checked.value.pubkey) });
    // In a room that shows only named people, they are shown from now: that they are here, then what was kept.
    if (this.namedOnly && !this.announced.has(peer.member.pubkey)) {
      this.announced.add(peer.member.pubkey);
      if (peer.open) this.emit("member", peer.member);
      for (const w of this.waiting.get(peer.member.pubkey) ?? []) this.emit(w.kind, peer.member, w.stream);
      this.waiting.delete(peer.member.pubkey);
    }
    if (checked.value.picture) peer.member.picture = checked.value.picture;
    else delete peer.member.picture;
    if (checked.value.about) peer.member.about = checked.value.about;
    else delete peer.member.about;
    this.emit("identity", peer.member);
    this.redraw(peer);
  }

  /** A pass that has run out leaves a guest behind. */
  private expire(now: number): void {
    for (const peer of [...this.peers.values()]) {
      if (!peer.passUntil || now < peer.passUntil) continue;
      // In a room that shows only named people, someone whose pass has run out is let go.
      if (this.namedOnly) {
        this.turnAway(peer.member.pubkey);
        continue;
      }
      delete peer.passUntil;
      delete peer.shown;
      delete peer.member.identity;
      delete peer.member.picture;
      delete peer.member.about;
      Object.assign(peer.member, { guest: true, name: guestName(peer.member.pubkey) });
      this.emit("identity", peer.member);
      this.redraw(peer);
    }
    if (this.pass && now >= this.passUntil) {
      this.pass = null;
      delete this.self.identity;
      delete this.self.picture;
      delete this.self.about;
      delete this.self.model;
      this.avatar = null;
      Object.assign(this.self, { guest: true, name: guestName(this.self.pubkey) });
      const mine = this.look ? decodeLook(this.look) : null;
      this.self.look = seenLook(this.self, mine?.ok ? mine.value : undefined);
      this.emit("identity", this.self);
    }
  }

  /**
   * Tell one member how you look and, if you came by name, who you are. The
   * channel drops what it can't deliver at once, so each is said a few times
   * over the first seconds.
   */
  private introduce(ch: RTCDataChannel): void {
    if (!this.look && !this.pass && !this.held) return;
    const avatar = this.pass ? this.avatar : null;
    let left = 4;
    const say = () => {
      if (this.closed || ch.readyState !== "open") return;
      try {
        if (this.look) ch.send(`look:${this.look}`);
        if (this.pass) ch.send(`id:${this.pass}`);
        if (avatar) ch.send(`avatar:${avatar}`);
        if (this.held) ch.send(`hold:${this.held}`);
        // And the colours they chose for it, which go with it.
        if (this.held && this.tints) ch.send(this.tints);
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

  /** The second sound line: music. Voice is the first. */
  private musicTransceiver(pc: RTCPeerConnection): RTCRtpTransceiver | undefined {
    return pc.getTransceivers().filter((t) => t.receiver.track.kind === "audio")[1];
  }

  private videoTransceiver(pc: RTCPeerConnection): RTCRtpTransceiver | undefined {
    return pc.getTransceivers().find((t) => t.receiver.track.kind === "video");
  }

  private async offerTo(pubkey: string): Promise<void> {
    const peer = this.createPeer(pubkey);
    // The audio line is negotiated up front, so turning the microphone on
    // later is just a track swap with no second handshake.
    const audio = peer.pc.addTransceiver("audio", { direction: "sendrecv" });
    if (this.mic) await audio.sender.replaceTrack(this.mic);
    // And a line for a screen, agreed now and left empty, so sharing later needs no second handshake either.
    peer.pc.addTransceiver("video", { direction: "sendrecv" });
    // And one for music shared with people nearby, the same way.
    peer.pc.addTransceiver("audio", { direction: "sendrecv" });
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
    const video = this.videoTransceiver(peer.pc);
    if (video) video.direction = "sendrecv";
    const music = this.musicTransceiver(peer.pc);
    if (music) music.direction = "sendrecv";
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    const answer = await this.gathered(peer.pc);
    if (this.peers.get(pubkey) === peer) this.publish(buildSignal(this.topic, this.key, pubkey, { t: "answer", sdp: answer }));
  }

  private markRecording(peer: Peer): void {
    const on = (peer.recordingUntil ?? 0) > Date.now();
    if (on === peer.member.recording) return;
    peer.member.recording = on;
    this.emit("recording", peer.member, on);
  }

  private markSharing(peer: Peer): void {
    const on = (peer.sharingUntil ?? 0) > Date.now();
    if (on === !!peer.member.sharing) return;
    peer.member.sharing = on;
    if (!on) this.watched.delete(peer.member.pubkey);
    this.emit("screen", peer.member, on);
  }

  /** Send this visitor's screen to a member who is watching it, and stop when they aren't or there is none. */
  private async feed(peer: Peer): Promise<void> {
    const wants = !!this.screen && (peer.watchingUntil ?? 0) > Date.now();
    if (wants === !!peer.fed) return;
    peer.fed = wants;
    try {
      const sender = this.videoTransceiver(peer.pc)?.sender;
      await sender?.replaceTrack(wants ? this.screen : null);
      if (wants && sender) {
        // A screen is mostly words: keep them sharp, and let the rate drop instead.
        const params = sender.getParameters();
        params.degradationPreference = "maintain-resolution";
        for (const e of params.encodings ?? []) e.maxBitrate = 2_500_000;
        await sender.setParameters(params).catch(() => {});
      }
    } catch {
      /* that connection is closing */
    }
  }

  private markTune(peer: Peer): void {
    const on = (peer.tuneUntil ?? 0) > Date.now();
    if (on === !!peer.member.music) return;
    peer.member.music = on;
    if (!on) this.heard.delete(peer.member.pubkey);
    this.emit("tune", peer.member, on);
  }

  /** Send this visitor's music to a member who is listening to it, and stop when they aren't or there is none. */
  private async feedTune(peer: Peer): Promise<void> {
    const wants = !!this.tune && (peer.hearingUntil ?? 0) > Date.now();
    if (wants === !!peer.tuned) return;
    peer.tuned = wants;
    try {
      await this.musicTransceiver(peer.pc)?.sender.replaceTrack(wants ? this.tune : null);
    } catch {
      /* that connection is closing */
    }
  }

  /**
   * Offer music to the room, or stop. Like a screen, offering sends nothing
   * by itself: it goes only to members who ask to hear it, and they ask only
   * while they are near and have said they want to hear shared music at all.
   */
  async setMusic(track: MediaStreamTrack | null): Promise<void> {
    this.tune = track;
    this.self.music = !!track;
    clearInterval(this.tuneTimer);
    const say = () => this.tellAll(this.tune ? "mus:1" : "mus:0");
    say();
    if (track) this.tuneTimer = setInterval(say, 2000);
    else setTimeout(say, 400);
    await Promise.all(
      [...this.peers.values()].map(async (peer) => {
        peer.tuned = false;
        await this.feedTune(peer).catch(() => {});
        if (!track) await this.musicTransceiver(peer.pc)?.sender.replaceTrack(null).catch(() => {});
      }),
    );
  }

  /** How many members this visitor's music is going to now. */
  get musicListeners(): number {
    return this.tune ? [...this.peers.values()].filter((p) => p.open && p.tuned).length : 0;
  }

  /** Ask to be sent a member's music, or to stop being sent it. Asked again every couple of seconds while listening. */
  listen(pubkey: string, on: boolean): void {
    if (on === this.heard.has(pubkey)) return;
    if (on) this.heard.add(pubkey);
    else this.heard.delete(pubkey);
    const peer = this.peers.get(pubkey);
    if (peer?.open && peer.pose?.readyState === "open") {
      try {
        peer.pose.send(on ? "hear:1" : "hear:0");
      } catch {
        /* that connection is closing */
      }
    }
    clearInterval(this.hearTimer);
    if (this.heard.size) this.hearTimer = setInterval(() => this.tellAll("hear:1", (p) => this.heard.has(p.member.pubkey)), 2000);
  }

  isListening(pubkey: string): boolean {
    return this.heard.has(pubkey);
  }

  private tellAll(word: string, to?: (peer: Peer) => boolean): void {
    for (const peer of this.peers.values()) {
      if (!peer.open || peer.pose?.readyState !== "open" || (to && !to(peer))) continue;
      try {
        peer.pose.send(word);
      } catch {
        /* that connection is closing */
      }
    }
  }

  /**
   * Offer a screen to the room, or stop. Offering sends nothing by itself:
   * each member is told it is there, and it goes only to those who ask to
   * watch. Stopping takes it from everyone at once.
   */
  async setScreen(track: MediaStreamTrack | null): Promise<void> {
    this.screen = track;
    this.self.sharing = !!track;
    clearInterval(this.screenTimer);
    const say = () => this.tellAll(this.screen ? "scr:1" : "scr:0");
    say();
    if (track) this.screenTimer = setInterval(say, 2000);
    else setTimeout(say, 400);
    // Changing what is shared, or stopping, goes to whoever was being sent it.
    await Promise.all(
      [...this.peers.values()].map(async (peer) => {
        peer.fed = false;
        await this.feed(peer).catch(() => {});
        if (!track) await this.videoTransceiver(peer.pc)?.sender.replaceTrack(null).catch(() => {});
      }),
    );
  }

  /** Whether this visitor is offering their screen. */
  get sharing(): boolean {
    return !!this.screen;
  }

  /** How many members this visitor's screen is going to now. */
  get screenViewers(): number {
    return this.screen ? [...this.peers.values()].filter((p) => p.open && p.fed).length : 0;
  }

  /**
   * Ask to be sent a member's screen, or to stop being sent it. Nothing
   * arrives unless they are sharing. It is asked again every couple of
   * seconds while watching, so a member who stops being asked stops sending.
   */
  watch(pubkey: string, on: boolean): void {
    if (on) this.watched.add(pubkey);
    else this.watched.delete(pubkey);
    const peer = this.peers.get(pubkey);
    if (peer?.open && peer.pose?.readyState === "open") {
      try {
        peer.pose.send(on ? "watch:1" : "watch:0");
      } catch {
        /* that connection is closing */
      }
    }
    clearInterval(this.watchTimer);
    if (this.watched.size) this.watchTimer = setInterval(() => this.tellAll("watch:1", (p) => this.watched.has(p.member.pubkey)), 2000);
  }

  isWatching(pubkey: string): boolean {
    return this.watched.has(pubkey);
  }

  /**
   * Say that you are recording what you see, or have stopped. The others are
   * shown a light on your figure while it is true. An honest client says so
   * whenever it records other people; nothing can make a dishonest one.
   */
  /**
   * Say what this visitor is holding, or "" for nothing (protocol/17-items.md). The others are told its
   * coordinate and nothing else: each fetches and checks the item for themselves, or draws nothing.
   */
  setHolding(item: string): void {
    const next = itemCoordinate(item);
    if (next === this.held) return;
    this.held = next;
    if (next) this.self.holding = next;
    else delete this.self.holding;
    // Said a few times, because the channel doesn't try again.
    let left = 3;
    const say = () => {
      if (this.closed || this.held !== next) return;
      for (const peer of this.peers.values()) {
        if (!peer.open || peer.pose?.readyState !== "open") continue;
        try {
          peer.pose.send(`hold:${next}`);
        } catch {
          /* that connection is closing */
        }
      }
      if (--left > 0) setTimeout(say, 700);
    };
    say();
  }

  /**
   * Say something of an item in play to everyone: a thing sent out, a hit, a sound, this visitor's state
   * (`buildShot`, `buildHit`, `buildDid`, `buildState` in the core). Anything that isn't one of those is not sent.
   */
  tellPlay(said: string): void {
    if (this.closed || typeof said !== "string" || said.length > 200 || !PLAY_WORD.test(said)) return;
    // The colours of what they hold are said again to whoever comes in later.
    if (said.startsWith("tint:")) this.tints = said;
    this.tellAll(said);
    // The channel doesn't try again, and a dart nobody else heard of can't reach them. So everything but a sound or
    // an animation (which would be heard twice) is said a second time a moment later; a reader takes the first.
    if (!said.startsWith("did:")) setTimeout(() => !this.closed && this.tellAll(said), 90);
  }

  setRecording(on: boolean): void {
    if (on === this.self.recording) return;
    this.self.recording = on;
    clearInterval(this.recordingTimer);
    const say = () => {
      for (const peer of this.peers.values()) {
        if (!peer.open || peer.pose?.readyState !== "open") continue;
        try {
          peer.pose.send(on ? "rec:1" : "rec:0");
        } catch {
          /* that connection is closing */
        }
      }
    };
    say();
    if (on) this.recordingTimer = setInterval(say, 2000);
    else setTimeout(say, 400);
  }

  private drop(pubkey: string, announce: boolean): void {
    const peer = this.peers.get(pubkey);
    if (!peer) return;
    this.peers.delete(pubkey);
    this.waiting.delete(pubkey);
    try {
      peer.pc.close();
    } catch {
      /* already closed */
    }
    if (announce && peer.open) this.emit("leave", peer.member);
    this.announced.delete(pubkey);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [pubkey, peer] of this.peers) {
      this.markRecording(peer);
      this.markSharing(peer);
      void this.feed(peer);
      this.markTune(peer);
      void this.feedTune(peer);
      if (!peer.open && now - peer.startedAt > CONNECT_TIMEOUT_MS) this.drop(pubkey, false);
      // A room that shows only named people lets go of a member who showed no pass in time.
      else if (this.namedOnly && peer.open && !this.announced.has(pubkey) && now - (peer.openedAt ?? now) > NAMED_WAIT_MS) this.turnAway(pubkey);
      else if (peer.open && now - peer.lastSeen > SILENT_TIMEOUT_MS) this.drop(pubkey, true);
    }
    this.expire(Math.floor(now / 1000));
  }

  /** Send your pose to everyone. Call 10–20 times a second, from a timer rather than the render loop. */
  /**
   * Write a few words to the room. They go straight to each member, as poses do: no relay sees them and nothing
   * keeps them. They are sent a few times over, because the channel doesn't try again, and each reader takes the
   * first. Returns "said" (and `said` fires here too, with `self`), "nothing" if there was nothing to say, or
   * "slow" if this visitor has said too much in a short while: nothing is sent then.
   */
  say(text: string): "said" | "nothing" | "slow" {
    const word = buildSay(text);
    const line = word ? parseSay(word) : null;
    if (!word || !line || this.closed) return "nothing";
    const now = Date.now();
    if (!this.words.take(line.id, now)) return "slow";
    this.tellAll(word);
    for (let i = 1; i < CHAT_LIMITS.repeats; i++) setTimeout(() => !this.closed && this.tellAll(word), i * CHAT_LIMITS.repeatGapMs);
    this.emit("said", this.self, { ...line, at: now });
    return "said";
  }

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
    clearInterval(this.screenTimer);
    clearInterval(this.watchTimer);
    clearInterval(this.tuneTimer);
    clearInterval(this.hearTimer);
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
