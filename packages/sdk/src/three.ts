/**
 * nswp-sdk/three — shared presence for Three.js worlds (spec §9.4, §9.8).
 *
 *   const presence = createPresence({ scene, camera, rig, renderer, controllers });
 *   attachRoomControls(presence, { roomButton, micButton, inviteButton, status });
 *   // each frame:
 *   presence.update(dt);
 *
 * It draws other members as avatars (head, body, hands), plays their voices
 * from where they stand, sends your own pose, and keeps personal space.
 *
 * This is the Phase 4b spike: guests only. Joining a room shows your IP
 * address to the other members, so join only after the visitor has agreed.
 */
import * as THREE from "three";
import { bubbleSeconds, CHAT_LIMITS, decodeLook, DEFAULT_RELAYS, encodeNpub, publishEvent, queryRelays, shortNpub, spawnOffset, verifyEvent, type NostrEvent, type Pose, type Transform } from "@nswp/core";
import { createFigure, type Figure, type FigureStyle } from "./figure.js";
import { room, type JoinOptions, type Member, type RoomSession } from "./room.js";
import { loadBlocked, storeBlocked, withBlocked, withoutBlocked, type Blocked } from "./blocks.js";
import { MUSIC_DUCK, MUSIC_RANGE, musicFade, musicToHear } from "./sound-store.js";

import { turnVisitor } from "./turn.js";
export { turnVisitor } from "./turn.js";
export { createConsole, type XrConsole } from "./console.js";
import type { Controls } from "./ui/model.js";
import { fullscreenAction } from "./ui/fullscreen.js";
import { loadPicture, onPicturesChange, setShowsPictures, showsPictures } from "./picture.js";
import { onChatChange, setShowsChat, showsChat, wrapWords } from "./ui/chat.js";
import { ago, FEED_LIMITS, type FeedSource } from "./ui/feed.js";
import { rgb } from "./ui/theme.js";
import { addDeskControls, watchFov } from "./desk.js";
import { byName, figureAction, hereAs, identityAction, identityHost, identitySection, signerAction, signerNamed, unansweredWords, worldSigner, type Leaving } from "./ui/identity.js";
import type { GoOptions } from "./index.js";
import type { Panel, Panels } from "./panels.js";
import type { Sounds } from "./sound.js";
import { LEVEL_WORDS, levelStep, nextLevel } from "./sound-store.js";

export interface PresenceOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** The object that moves the visitor around; the camera is inside it. */
  rig: THREE.Object3D;
  renderer: THREE.WebGLRenderer;
  /** XR controller target-ray spaces, as from `renderer.xr.getController(i)`. */
  controllers: THREE.Object3D[];
  /** CSS colour for name labels. */
  labelColor?: string;
  /**
   * The visitor's own look, in its inline form (spec §4.2), for the others in a
   * room to draw them by: usually `arrival.look()`. A function is asked each
   * time a room is joined. Left out, they are drawn as their session key generates.
   */
  look?: string | (() => string | undefined);
  /**
   * Who the visitor is, if they came by name (protocol/10-identity.md):
   * usually `() => arrival.identity()`. Asked each time a room is joined.
   * Left out, they are a guest.
   */
  identity?: JoinOptions["identity"] | (() => JoinOptions["identity"] | undefined);
  /** Draw other people in this world's own way (spec §4.2, "What a world may change"). */
  figureStyle?: FigureStyle;
  /** Called whenever membership, status or the microphone changes. */
  onChange?: () => void;
  /** False where this world draws what people write in a way of its own: no line is drawn over anyone's head. */
  bubbles?: boolean;
}

export interface AvatarInfo {
  pubkey: string;
  name: string;
  visible: boolean;
  opacity: number;
  head: number[] | null;
  hands: [boolean, boolean];
  audioLevel: number;
  /** How they are being drawn. */
  look: Member["look"];
  /** True until their pass has checked out. */
  guest: boolean;
  /** The identity key behind them, if proven. */
  identity: string | null;
  /** What is written over their head now, or "". */
  saying: string;
  /** This visitor has stopped hearing them. */
  muted: boolean;
  /** They are offering their music to people nearby. */
  music: boolean;
  /** Their music is being asked for and played here. */
  hearing: boolean;
  /** How loud their music is being played here, after distance and ducking, from 0 to 1. */
  musicVolume: number;
  /** How loud their music is arriving, before any of that. */
  musicLevel: number;
}

export interface Presence {
  readonly session: RoomSession | null;
  /** Whether the visitor is in a headset now. */
  readonly presenting: boolean;
  /** The private room's name, or null in a world's open room. */
  readonly roomName: string | null;
  readonly micOn: boolean;
  join(name: string | null): Promise<void>;
  leave(): void;
  setMicrophone(track: MediaStreamTrack | null): Promise<void>;
  /** A quiet test tone to use in place of a microphone. */
  testTone(): MediaStreamTrack;
  /** Tell the others you are recording what you see, or have stopped. They are shown a light on your figure. */
  setRecording(on: boolean): void;
  /** How this visitor looks to the others: for a selfie, or a mirror. */
  selfLook(): Member["look"] | string;
  /** Show for a few seconds where one member is: a column of light over their head. */
  pointOut(pubkey: string): void;
  /**
   * Whose picture a ray is on, by their session key, or null. A picture over someone's head is a button: a world
   * asks this wherever it asks what a pointer is on. The ray's `camera` must be set, as for any sprite.
   */
  personAt(raycaster: THREE.Raycaster): string | null;
  /**
   * Where someone is from the visitor's own head: how far in metres, and how far to one side (-1 is hard left, 1
   * hard right). For a sound they made. Null for someone not drawn yet.
   */
  whereIs(pubkey: string): { distance: number; pan: number } | null;
  /** Press whoever's picture the ray is on, as choosing them from the People list does. True if someone was. */
  pressAt(raycaster: THREE.Raycaster): boolean;
  /** What pressing a picture does. The room's controls set it. */
  onPerson(cb: (pubkey: string) => void): void;
  /** Everyone else in the room, as they are being drawn. */
  people(): Member[];
  /** How loud other people's voices are for this visitor, from 0 to 1. Theirs to set, and nobody else's. */
  setVolume(volume: number): void;
  /**
   * Stop drawing the others, or draw them again: for the moments a visitor is shut in the crossing's room, where
   * someone standing in the same spot would otherwise be in it with them. They are still there, and still heard.
   */
  setHidden(hidden: boolean): void;
  /** Whether this visitor is offering their music to people nearby. */
  readonly musicOn: boolean;
  /** How many members their music is going to now. */
  readonly musicListeners: number;
  /**
   * Offer music to people nearby, or stop (null). It is sent only to members who are near and have turned on
   * hearing shared music. It ends when the visitor leaves the room.
   */
  shareMusic(track: MediaStreamTrack | null): Promise<void>;
  /** Whether to hear music people nearby share, and how loud. Off until the visitor turns it on. */
  setHearShared(on: boolean, volume: number): void;
  /** Stop hearing one member's music, or hear it again, whether or not they are sharing any now. Their voice is not affected. */
  muteMusic(pubkey: string, on: boolean): void;
  isMusicMuted(pubkey: string): boolean;
  /** Whether this visitor is offering their screen to the room. */
  readonly screenOn: boolean;
  /** How many members their screen is going to now. */
  readonly screenViewers: number;
  /**
   * Offer a screen to the room, or stop (null). It is sent only to members who ask to watch. It ends when the
   * visitor leaves the room, or stops it from the browser's own bar.
   */
  shareScreen(track: MediaStreamTrack | null): Promise<void>;
  /** Ask to be sent a member's screen, or stop. */
  watch(pubkey: string, on: boolean): void;
  isWatching(pubkey: string): boolean;
  /** The line a member's screen arrives on, or null before they are connected. It is empty unless watched. */
  screenOf(pubkey: string): MediaStream | null;
  /**
   * Stop hearing one member's voice, or hear it again. They are still seen, and still see and hear this
   * visitor. Their music, if they share any, is a separate choice (`muteMusic`). Nobody is told. It lasts while
   * they are here.
   */
  mute(pubkey: string, on: boolean): void;
  isMuted(pubkey: string): boolean;
  /**
   * Stop being in a room with one member: the connection to them is closed and not made again. To them, this
   * visitor has left. Someone who came by name stays blocked on this site when they come back; a guest is a new
   * key each visit, so that block lasts this visit. Returns their name, or null if they aren't here.
   */
  block(pubkey: string): string | null;
  /** Let someone back, by the key `blocked()` lists them under. */
  unblock(key: string): void;
  /** Everyone this visitor has blocked: named people, kept on this site, and guests blocked this visit. */
  blocked(): { key: string; name: string; kept: boolean }[];
  /**
   * People the visitor has blocked everywhere: their own client's list, as it arrived with them. Nobody on it
   * is connected to during this visit. It isn't kept here, and isn't undone here: it is their client's.
   */
  blockAlso(keys: string[]): void;
  /** How many people are blocked by the visitor's own client's list. */
  readonly blockedElsewhere: number;
  /**
   * The named people blocked here during this visit, by identity key: what a world reports to the visitor's
   * client as they leave, so the client can ask whether to block them everywhere.
   */
  newlyBlocked(): string[];
  /** Call once per frame with the seconds since the last one. */
  update(dt: number): void;
  /** What this visitor currently sees of each member (for tests and debugging). */
  info(): AvatarInfo[];
}

interface Avatar {
  member: Member;
  /** Their shared music, while this visitor hears it. */
  tune?: THREE.PositionalAudio;
  tuneElement?: HTMLAudioElement;
  tuneMeter?: AnalyserNode;
  tuneVolume?: number;
  root: THREE.Group;
  head: THREE.Group;
  torso: THREE.Mesh;
  hands: [THREE.Mesh, THREE.Mesh];
  figure: Figure;
  label: THREE.Sprite;
  /** Their own picture, over their name, when their pass says where it is and this visitor sees pictures. */
  picture?: THREE.Sprite;
  /** The address the picture shown, or being fetched, came from. */
  pictureFrom?: string;
  /** What they last wrote, over their head for a few seconds. */
  bubble?: THREE.Sprite;
  bubbleText?: string;
  /** When the bubble went up and when it comes down, in milliseconds. */
  bubbleFrom?: number;
  bubbleUntil?: number;
  /** Shown while they say they are recording. */
  light?: THREE.Sprite;
  /** Shown while they are being pointed out. */
  beam?: THREE.Sprite;
  beamUntil?: number;
  target: Pose | null;
  placed: boolean;
  /** Every material, with its normal opacity, for the personal-space fade. */
  materials: { material: THREE.Material; opacity: number }[];
  audio?: THREE.PositionalAudio;
  element?: HTMLAudioElement;
  analyser?: AnalyserNode;
}

const SEND_EVERY_MS = 66; // 15 poses a second
/** Personal space: avatars fade out between these distances from your head (metres). */
const FADE_START = 0.9;
const FADE_END = 0.45;
/** Two people arriving closer than this are moved apart to ARRIVAL_GAP. */
const TOO_CLOSE = 1.0;
const ARRIVAL_GAP = 1.4;

/** A text panel that always faces the viewer. `width` is in metres. */
export function textSprite(text: string, color: string, width: number): THREE.Sprite {
  const lines = text.split("\n");
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 64 + lines.length * 72;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "rgba(10,12,18,0.72)";
  g.beginPath();
  g.roundRect(0, 0, canvas.width, canvas.height, 32);
  g.fill();
  g.fillStyle = color;
  g.textBaseline = "top";
  lines.forEach((line, i) => {
    g.font = i === 0 ? "bold 56px system-ui, sans-serif" : "44px system-ui, sans-serif";
    g.fillText(line, 40, 32 + i * 72, canvas.width - 80);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(width, (width * canvas.height) / canvas.width, 1);
  return sprite;
}

/**
 * A few written words in a speech bubble, facing the viewer: light paper, dark ink, a small tail underneath. It is
 * as wide as its words need, up to `width` metres, and stands on its own bottom edge. The words are drawn as text
 * and as nothing else.
 */
export function speechSprite(text: string, width = 0.8): THREE.Sprite {
  const FULL = 768; // pixels across, at its widest
  const PAD = 30;
  const LINE = 54;
  const TAIL = 22;
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d")!;
  const font = "500 42px system-ui, sans-serif";
  g.font = font;
  const rows = wrapWords(text, (t) => g.measureText(t).width, FULL - PAD * 2, 5);
  const wide = Math.ceil(Math.max(80, ...rows.map((r) => g.measureText(r).width))) + PAD * 2;
  canvas.width = Math.min(FULL, wide);
  canvas.height = rows.length * LINE + PAD * 1.4 + TAIL;
  const h = canvas.height - TAIL;
  g.fillStyle = "rgba(246,248,251,0.95)";
  g.beginPath();
  g.roundRect(0, 0, canvas.width, h, 26);
  g.moveTo(canvas.width / 2 - 18, h - 1);
  g.lineTo(canvas.width / 2, canvas.height);
  g.lineTo(canvas.width / 2 + 18, h - 1);
  g.fill();
  g.fillStyle = "#141a22";
  g.font = font;
  g.textBaseline = "middle";
  rows.forEach((row, i) => g.fillText(row, PAD, PAD * 0.7 + LINE * (i + 0.5), canvas.width - PAD * 2));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  const metres = width / FULL;
  sprite.scale.set(canvas.width * metres, canvas.height * metres, 1);
  sprite.center.set(0.5, 0);
  return sprite;
}

export function createPresence(d: PresenceOptions): Presence {
  const labelColor = d.labelColor ?? "#ffffff";
  const changed = () => d.onChange?.();
  const listener = new THREE.AudioListener();
  d.camera.add(listener);

  const avatars = new Map<string, Avatar>();
  const pendingStreams = new Map<string, MediaStream>();
  let session: RoomSession | null = null;
  let roomName: string | null = null;
  let sendTimer: ReturnType<typeof setInterval> | undefined;
  let micTrack: MediaStreamTrack | null = null;
  let offsetApplied = false;
  let plainSeed: string | undefined;

  // A soft dot of light: red over someone recording, in their own colour when they are pointed out.
  let dot: THREE.Texture | null = null;
  const glow = (color: THREE.ColorRepresentation): THREE.Sprite => {
    if (!dot) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const g = canvas.getContext("2d")!;
      const fade = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      fade.addColorStop(0, "rgba(255,255,255,1)");
      fade.addColorStop(0.35, "rgba(255,255,255,0.85)");
      fade.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = fade;
      g.fillRect(0, 0, 64, 64);
      dot = new THREE.CanvasTexture(canvas);
    }
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, depthWrite: false }));
  };
  /** The light that says a member is recording: over their name, where it can't be missed. */
  const showRecording = (a: Avatar, on: boolean) => {
    if (on && !a.light) {
      a.light = glow(0xff3b30);
      a.light.scale.setScalar(0.16);
      a.light.position.set(0, 0.46, 0);
    }
    if (a.light) {
      a.light.visible = on;
      a.head.add(a.light);
    }
  };

  /** Put a member's figure together from how they look, in place of any they had. */
  const dress = (a: Avatar, look: Member["look"]) => {
    const was = a.figure;
    const figure = createFigure(look, d.figureStyle, { proven: !a.member.guest });
    figure.head.position.copy(was?.head.position ?? figure.head.position);
    figure.head.quaternion.copy(was?.head.quaternion ?? figure.head.quaternion);
    figure.head.add(a.label);
    if (a.picture) figure.head.add(a.picture);
    figure.hands.forEach((h, i) => {
      h.visible = was?.hands[i]!.visible ?? false;
      if (was) {
        h.position.copy(was.hands[i]!.position);
        h.quaternion.copy(was.hands[i]!.quaternion);
      }
    });
    if (was) {
      if (a.audio) figure.head.add(a.audio);
      a.root.remove(was.group);
      was.dispose();
    }
    if (a.light) figure.head.add(a.light);
    if (a.beam) figure.head.add(a.beam);
    if (a.bubble) figure.head.add(a.bubble);
    a.root.add(figure.group);
    a.figure = figure;
    a.head = figure.head;
    a.torso = figure.torso;
    a.hands = figure.hands;
    a.materials = [figure.metal, a.label.material, ...(a.picture ? [a.picture.material] : [])].map((material: THREE.Material) => {
      const opacity = material === a.label.material || material === a.picture?.material ? 1 : material.opacity;
      material.transparent = true;
      return { material, opacity };
    });
  };

  /** Take what a member wrote from over their head. */
  const dropBubble = (a: Avatar) => {
    if (!a.bubble) return;
    a.bubble.removeFromParent();
    a.bubble.material.map?.dispose();
    a.bubble.material.dispose();
    delete a.bubble;
    delete a.bubbleText;
  };
  /** Put what a member wrote over their head for a while: over their name, and over their picture if they have one. */
  const showBubble = (a: Avatar, text: string, seconds: number) => {
    dropBubble(a);
    if (d.bubbles === false || !showsChat()) return;
    a.bubble = speechSprite(text);
    a.bubbleText = text;
    a.bubbleFrom = performance.now();
    a.bubbleUntil = a.bubbleFrom + seconds * 1000;
    a.bubble.material.opacity = 0;
    a.head.add(a.bubble);
  };
  onChatChange(() => {
    if (!showsChat()) for (const a of avatars.values()) dropBubble(a);
  });

  /** Take a member's picture off them, and let go of what it was drawn with. */
  const dropPicture = (a: Avatar) => {
    if (!a.picture) return;
    a.picture.removeFromParent();
    a.picture.material.map?.dispose();
    a.picture.material.dispose();
    delete a.picture;
  };
  /**
   * A member's own picture, as a round badge over their name: theirs, because their own key signed where it is.
   * It is also a button: pressing it is choosing them (`pressAt`). Nothing is shown for a guest, for someone with
   * no picture, or to a visitor who has turned pictures off.
   */
  const showPicture = (a: Avatar) => {
    const from = !a.member.guest && showsPictures() ? (a.member.picture ?? "") : "";
    if (from === (a.pictureFrom ?? "")) return;
    a.pictureFrom = from;
    dropPicture(a);
    if (!from) return void dress(a, a.member.look);
    void loadPicture(from).then((canvas) => {
      // They may have gone, or changed, while it was fetched.
      if (!canvas || a.pictureFrom !== from || !avatars.has(a.member.pubkey)) return;
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthWrite: false }));
      sprite.scale.set(0.2, 0.2, 1);
      sprite.position.set(0, 0.63, 0); // over the name, which is over the tallest head
      sprite.userData.person = a.member.pubkey;
      a.picture = sprite;
      dress(a, a.member.look);
      changed();
    });
  };
  onPicturesChange(() => {
    for (const a of avatars.values()) showPicture(a);
  });
  let onPerson: (pubkey: string) => void = () => {};

  const makeAvatar = (member: Member): Avatar => {
    const root = new THREE.Group();
    root.visible = false;
    const label = textSprite(member.name, labelColor, 0.5);
    label.position.set(0, 0.42, 0); // clear of the tallest head with a hat on it
    d.scene.add(root);
    const a = { member, root, label, target: null, placed: false } as unknown as Avatar;
    dress(a, member.look);
    showPicture(a);
    return a;
  };

  // Music: what this visitor shares, the lines other members' music arrives on, and whether they want to hear any.
  let hiddenAll = false;
  let tuneTrack: MediaStreamTrack | null = null;
  const tunes = new Map<string, MediaStream>();
  const tuneMuted = new Set<string>();
  let hearShared = false;
  let sharedVolume = 0.7;
  let voiceVolume = 1;
  let duck = 1;
  let sinceChoosing = 0;
  const playTune = (a: Avatar, stream: MediaStream) => {
    if (a.tune) return;
    // As with a voice: Chrome feeds a remote line into Web Audio only while a media element holds it too.
    const el = new Audio();
    el.muted = true;
    el.srcObject = stream;
    void el.play().catch(() => {});
    const pa = new THREE.PositionalAudio(listener);
    pa.setMediaStreamSource(stream);
    // Where it comes from is heard; how it fades with distance is worked out here, to reach nothing at the edge.
    pa.setRefDistance(MUSIC_RANGE);
    pa.setVolume(0);
    a.head.add(pa);
    const meter = listener.context.createAnalyser();
    meter.fftSize = 512;
    listener.context.createMediaStreamSource(stream).connect(meter);
    a.tune = pa;
    a.tuneElement = el;
    a.tuneMeter = meter;
    a.tuneVolume = 0;
  };
  const stopTune = (a: Avatar) => {
    a.tune?.disconnect();
    a.tune?.removeFromParent();
    if (a.tuneElement) a.tuneElement.srcObject = null;
    delete a.tune;
    delete a.tuneElement;
    delete a.tuneMeter;
    a.tuneVolume = 0;
  };
  const rms = (meter: AnalyserNode | undefined, buf: Float32Array<ArrayBuffer>): number => {
    if (!meter) return 0;
    meter.getFloatTimeDomainData(buf);
    return Math.sqrt(buf.reduce((sum, x) => sum + x * x, 0) / buf.length);
  };
  const levelBuf = new Float32Array(512);
  const headAt = new THREE.Vector3();
  const theirs = new THREE.Vector3();
  /** Whose music to ask for, and how loud each is: called every frame, choosing a couple of times a second. */
  const tendMusic = (dt: number) => {
    if (!session) return;
    d.camera.getWorldPosition(headAt);
    const away = (a: Avatar) => a.head.getWorldPosition(theirs).distanceTo(headAt);
    sinceChoosing += dt;
    if (sinceChoosing > 0.4) {
      sinceChoosing = 0;
      const sharing = [...avatars.values()].filter((a) => a.member.music).map((a) => ({ pubkey: a.member.pubkey, metres: away(a), refused: tuneMuted.has(a.member.pubkey) }));
      const want = new Set(musicToHear(sharing, hearShared));
      for (const a of avatars.values()) {
        const on = want.has(a.member.pubkey);
        session.listen(a.member.pubkey, on);
        const stream = tunes.get(a.member.pubkey);
        if (on && stream) playTune(a, stream);
        else if (!on && a.tune) stopTune(a);
      }
    }
    // Music steps back while anyone is speaking, and comes forward again after.
    let speaking = false;
    for (const a of avatars.values()) if (a.analyser && !mutedKeys.has(a.member.pubkey) && rms(a.analyser, levelBuf) > 0.02) speaking = true;
    duck += ((speaking ? MUSIC_DUCK : 1) - duck) * Math.min(1, dt * (speaking ? 8 : 1.5));
    for (const a of avatars.values()) {
      if (!a.tune) continue;
      a.tuneVolume = sharedVolume * duck * musicFade(away(a));
      a.tune.setVolume(a.tuneVolume);
    }
  };
  // A screen this visitor is sharing, and the lines other members' screens arrive on.
  let screenTrack: MediaStreamTrack | null = null;
  const screens = new Map<string, MediaStream>();
  const stopScreen = () => {
    if (!screenTrack) return;
    screenTrack.onended = null;
    screenTrack.stop();
    screenTrack = null;
  };
  // Who this visitor won't be in a room with. Named people are kept on this site; guests only for this visit,
  // because a guest's key is new every time and a list of them would promise what it can't do.
  let keptBlocks: Blocked[] = loadBlocked();
  const blockedNow = new Map<string, string>(); // a session key from this visit -> what they were called
  /** The visitor's own client's list, for this visit. */
  const fromClient = new Set<string>();
  /** Named people blocked here during this visit. */
  const reported = new Set<string>();
  const blockedKeys = () => [...new Set([...keptBlocks.map((b) => b.key), ...blockedNow.keys(), ...fromClient])];
  // Whom they have stopped hearing, by session key: it lasts while that person is here.
  const mutedKeys = new Set<string>();

  const attachAudio = (avatar: Avatar, stream: MediaStream) => {
    if (avatar.audio) return;
    // Chrome only feeds a remote WebRTC stream into Web Audio while it is also
    // attached to a media element, so keep a muted one alongside.
    const el = new Audio();
    el.muted = true;
    el.srcObject = stream;
    void el.play().catch(() => {});
    const pa = new THREE.PositionalAudio(listener);
    pa.setMediaStreamSource(stream);
    pa.setRefDistance(1.5);
    pa.setRolloffFactor(1.2);
    avatar.head.add(pa);
    const analyser = listener.context.createAnalyser();
    analyser.fftSize = 512;
    listener.context.createMediaStreamSource(stream).connect(analyser);
    pa.setVolume(mutedKeys.has(avatar.member.pubkey) ? 0 : voiceVolume);
    avatar.audio = pa;
    avatar.element = el;
    avatar.analyser = analyser;
  };

  const removeAvatar = (pubkey: string) => {
    const a = avatars.get(pubkey);
    if (!a) return;
    avatars.delete(pubkey);
    a.audio?.disconnect();
    stopTune(a);
    if (a.element) a.element.srcObject = null;
    d.scene.remove(a.root);
    dropPicture(a);
    dropBubble(a);
    a.figure.dispose();
  };

  const v = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const worldTransform = (o: THREE.Object3D): Transform => {
    o.getWorldPosition(v);
    o.getWorldQuaternion(q);
    return { position: [v.x, v.y, v.z], quaternion: [q.x, q.y, q.z, q.w] };
  };
  const ownPose = (): Pose => {
    const pose: Pose = { head: worldTransform(d.camera) };
    if (d.renderer.xr.isPresenting) {
      if (d.controllers[0]?.visible) pose.left = worldTransform(d.controllers[0]);
      if (d.controllers[1]?.visible) pose.right = worldTransform(d.controllers[1]);
    }
    return pose;
  };

  /**
   * When someone first appears almost on top of you, one of the pair (the one
   * with the higher session key, so only one moves) steps away. A person in a
   * headset is never moved.
   */
  const stepApart = (self: string, other: string, pose: Pose) => {
    if (self < other || d.renderer.xr.isPresenting) return;
    d.camera.getWorldPosition(v);
    const dx = v.x - pose.head.position[0];
    const dz = v.z - pose.head.position[2];
    const dist = Math.hypot(dx, dz);
    if (dist >= TOO_CLOSE) return;
    const ux = dist > 0.01 ? dx / dist : 1;
    const uz = dist > 0.01 ? dz / dist : 0;
    d.rig.position.x += ux * (ARRIVAL_GAP - dist);
    d.rig.position.z += uz * (ARRIVAL_GAP - dist);
  };

  const leave = () => {
    if (sendTimer) clearInterval(sendTimer);
    sendTimer = undefined;
    session?.leave();
    session = null;
    // A screen is shared with a room, and stops with it. So is music.
    stopScreen();
    screens.clear();
    tuneTrack = null;
    tunes.clear();
    for (const key of [...avatars.keys()]) removeAvatar(key);
    pendingStreams.clear();
    changed();
  };

  const join = async (name: string | null) => {
    leave();
    roomName = name;
    void listener.context.resume();
    // Joined without a press (kept from the last world, or through a refresh), a browser holds sound back until the
    // visitor touches the page. So the first touch lets the others be heard.
    if (listener.context.state !== "running") {
      const wake = () => {
        void listener.context.resume();
        for (const a of avatars.values()) void a.element?.play().catch(() => {});
        removeEventListener("pointerdown", wake, true);
        removeEventListener("keydown", wake, true);
      };
      addEventListener("pointerdown", wake, true);
      addEventListener("keydown", wake, true);
    }
    const look = typeof d.look === "function" ? d.look() : d.look;
    // By name only while they are signed in here: where their client named a signer, a pass they arrived with counts
    // once that signer is unlocked for this world, as the same person (ui/identity.ts).
    const identity = await byName(typeof d.identity === "function" ? d.identity() : d.identity);
    const s = await room.join({ ...(name ? { name } : {}), ...(look ? { look } : {}), ...(identity ? { identity } : {}), blocked: blockedKeys() });
    session = s;
    if (!offsetApplied) {
      // Step aside from the spawn point so two people don't arrive inside each other.
      const off = spawnOffset(s.self.pubkey);
      d.rig.position.x += off.x;
      d.rig.position.z += off.z;
      offsetApplied = true;
    }
    s.on("status", changed);
    s.on("recording", (m, on) => {
      const a = avatars.get(m.pubkey);
      if (a) showRecording(a, on);
      changed();
    });
    s.on("look", (m, look) => {
      const a = avatars.get(m.pubkey);
      if (a) dress(a, look);
      changed();
    });
    // A pass checked out, or ran out: their name changes, and so does the frame round their mark.
    s.on("identity", (m) => {
      const a = avatars.get(m.pubkey);
      if (a) {
        const label = textSprite(m.name, labelColor, 0.5);
        label.position.copy(a.label.position);
        a.label.removeFromParent();
        a.label.material.map?.dispose();
        a.label.material.dispose();
        a.label = label;
        dress(a, m.look);
        showPicture(a);
      }
      changed();
    });
    s.on("member", (m) => {
      const a = makeAvatar(m);
      avatars.set(m.pubkey, a);
      const pending = pendingStreams.get(m.pubkey);
      if (pending) attachAudio(a, pending);
      changed();
    });
    s.on("leave", (m) => {
      screens.delete(m.pubkey);
      tunes.delete(m.pubkey);
      removeAvatar(m.pubkey);
      pendingStreams.delete(m.pubkey);
      changed();
    });
    // Someone wrote to the room: it goes over their head for a while. The visitor's own goes over nobody's.
    s.on("said", (m, line) => {
      const a = avatars.get(m.pubkey);
      if (a) showBubble(a, line.text, bubbleSeconds(line.text));
    });
    s.on("pose", (m, pose) => {
      const a = avatars.get(m.pubkey);
      if (!a) return;
      if (!a.target) stepApart(s.self.pubkey, m.pubkey, pose);
      a.target = pose;
    });
    s.on("video", (m, stream) => {
      screens.set(m.pubkey, stream);
    });
    s.on("screen", () => changed());
    s.on("music", (m, stream) => {
      tunes.set(m.pubkey, stream);
    });
    s.on("tune", () => changed());
    s.on("audio", (m, stream) => {
      pendingStreams.set(m.pubkey, stream);
      const a = avatars.get(m.pubkey);
      if (a) attachAudio(a, stream);
    });
    if (micTrack) await s.setMicrophone(micTrack);
    sendTimer = setInterval(() => s.sendPose(ownPose()), SEND_EVERY_MS);
    changed();
  };

  const tp = new THREE.Vector3();
  const tq = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const apply = (o: THREE.Object3D, t: Transform, k: number) => {
    o.position.lerp(tp.set(...t.position), k);
    o.quaternion.slerp(tq.set(...t.quaternion), k);
  };

  return {
    get session() {
      return session;
    },
    get presenting() {
      return d.renderer.xr.isPresenting;
    },
    get roomName() {
      return roomName;
    },
    get micOn() {
      return !!micTrack;
    },
    get screenOn() {
      return !!screenTrack;
    },
    get screenViewers() {
      return session?.screenViewers ?? 0;
    },
    async shareScreen(track) {
      if (!session) {
        track?.stop();
        return;
      }
      stopScreen();
      screenTrack = track;
      if (track) {
        // Words on a screen should stay sharp.
        track.contentHint = "detail";
        // The browser's own "Stop sharing" ends it here too.
        track.onended = () => {
          if (screenTrack !== track) return;
          screenTrack = null;
          void session?.setScreen(null);
          changed();
        };
      }
      await session.setScreen(track);
      changed();
    },
    watch(pubkey, on) {
      session?.watch(pubkey, on);
      changed();
    },
    isWatching(pubkey) {
      return !!session?.isWatching(pubkey);
    },
    screenOf(pubkey) {
      return screens.get(pubkey) ?? null;
    },
    join,
    leave,
    async setMicrophone(track) {
      if (!track && micTrack) micTrack.stop();
      micTrack = track;
      await session?.setMicrophone(track);
      changed();
    },
    setRecording(on) {
      session?.setRecording(on);
    },
    selfLook() {
      if (session) return session.self.look;
      const mine = typeof d.look === "function" ? d.look() : d.look;
      const read = mine ? decodeLook(mine) : null;
      // Not in a room and wearing nothing: a figure of their own for this visit.
      return read?.ok ? read.value.look : (plainSeed ??= `plain-${Math.random().toString(36).slice(2, 12)}`);
    },
    personAt(raycaster) {
      const badges = [...avatars.values()].filter((a) => a.picture && a.root.visible).map((a) => a.picture!);
      if (!badges.length) return null;
      const hit = raycaster.intersectObjects(badges, false)[0];
      return hit ? String(hit.object.userData.person) : null;
    },
    whereIs(pubkey) {
      const a = avatars.get(pubkey);
      if (!a?.target) return null;
      d.camera.getWorldPosition(v);
      const to = new THREE.Vector3().fromArray(a.target.head.position).sub(v);
      const distance = to.length();
      if (distance < 0.001) return { distance: 0, pan: 0 };
      // How far to the right of where the visitor is facing. Someone very close is in the middle, whichever way they stand.
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(d.camera.getWorldQuaternion(q));
      const pan = THREE.MathUtils.clamp(to.normalize().dot(right), -1, 1) * Math.min(1, distance / 1.5);
      return { distance: Math.round(distance * 100) / 100, pan: Math.round(pan * 100) / 100 };
    },
    pressAt(raycaster) {
      const who = this.personAt(raycaster);
      if (who) onPerson(who);
      return who !== null;
    },
    onPerson(cb) {
      onPerson = cb;
    },
    pointOut(pubkey) {
      const a = avatars.get(pubkey);
      if (!a) return;
      if (!a.beam) {
        a.beam = glow(a.member.look.light);
        a.beam.scale.set(0.5, 3.2, 1);
        a.beam.position.set(0, 2.1, 0);
      }
      a.head.add(a.beam);
      a.beam.visible = true;
      a.beamUntil = performance.now() + 4000;
    },
    people() {
      return [...avatars.values()].map((a) => a.member);
    },
    setHidden(hidden) {
      hiddenAll = hidden;
      if (hidden) for (const a of avatars.values()) a.root.visible = false;
    },
    setVolume(volume) {
      // Voices alone: other people's music has a volume of its own.
      voiceVolume = Math.min(1, Math.max(0, volume));
      for (const a of avatars.values()) a.audio?.setVolume(mutedKeys.has(a.member.pubkey) ? 0 : voiceVolume);
    },
    get musicOn() {
      return !!tuneTrack;
    },
    get musicListeners() {
      return session?.musicListeners ?? 0;
    },
    async shareMusic(track) {
      if (!session) return;
      tuneTrack = track;
      await session.setMusic(track);
      changed();
    },
    setHearShared(on, volume) {
      hearShared = on;
      sharedVolume = Math.min(1, Math.max(0, volume));
      sinceChoosing = 1; // choose again at once
    },
    muteMusic(pubkey, on) {
      if (on) tuneMuted.add(pubkey);
      else tuneMuted.delete(pubkey);
      sinceChoosing = 1;
      changed();
    },
    isMusicMuted(pubkey) {
      return tuneMuted.has(pubkey);
    },
    mute(pubkey, on) {
      if (on) mutedKeys.add(pubkey);
      else mutedKeys.delete(pubkey);
      avatars.get(pubkey)?.audio?.setVolume(on ? 0 : voiceVolume);
      changed();
    },
    isMuted(pubkey) {
      return mutedKeys.has(pubkey);
    },
    block(pubkey) {
      const gone = session?.block(pubkey);
      if (!gone) return null;
      mutedKeys.delete(pubkey);
      if (gone.identity) {
        // By name: the key behind the name is the same next visit, so this is kept.
        keptBlocks = withBlocked(keptBlocks, { key: gone.identity, name: gone.name });
        storeBlocked(keptBlocks);
        reported.add(gone.identity);
      } else blockedNow.set(gone.session, gone.name);
      changed();
      return gone.name;
    },
    unblock(key) {
      reported.delete(key);
      // Someone on the visitor's own client's list stays blocked: that list is undone there, not here.
      if (!fromClient.has(key)) session?.unblock(key);
      if (blockedNow.delete(key)) return changed();
      keptBlocks = withoutBlocked(keptBlocks, key);
      storeBlocked(keptBlocks);
      changed();
    },
    blocked() {
      return [...keptBlocks.map((b) => ({ key: b.key, name: b.name, kept: true })), ...[...blockedNow].map(([key, name]) => ({ key, name, kept: false }))];
    },
    blockAlso(keys) {
      for (const k of keys) if (/^[0-9a-f]{64}$/.test(k)) fromClient.add(k);
    },
    get blockedElsewhere() {
      return [...fromClient].filter((k) => !keptBlocks.some((b) => b.key === k)).length;
    },
    newlyBlocked() {
      return [...reported];
    },
    testTone() {
      const ctx = listener.context;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.2;
      const dest = ctx.createMediaStreamDestination();
      osc.connect(gain).connect(dest);
      osc.start();
      return dest.stream.getAudioTracks()[0]!;
    },
    update(dt) {
      tendMusic(dt);
      const k = 1 - Math.exp(-dt * 14);
      d.camera.getWorldPosition(v);
      for (const a of avatars.values()) {
        if (!a.target) continue;
        // Personal space: nobody's avatar can fill your view.
        const near = THREE.MathUtils.clamp((a.head.position.distanceTo(v) - FADE_END) / (FADE_START - FADE_END), 0, 1);
        for (const m of a.materials) m.material.opacity = m.opacity * near;
        (a.materials[0]!.material as { tick?: (t: number) => void }).tick?.(performance.now() / 1000);
        if (a.beam?.visible && performance.now() > (a.beamUntil ?? 0)) a.beam.visible = false;
        if (a.bubble) {
          const t = performance.now();
          if (t > (a.bubbleUntil ?? 0)) dropBubble(a);
          else {
            // It arrives quickly and goes slowly, and is never in the face of someone standing close.
            a.bubble.material.opacity = near * Math.min(1, (t - (a.bubbleFrom ?? t)) / 160, ((a.bubbleUntil ?? t) - t) / 600);
            a.bubble.position.y = a.picture ? 0.78 : 0.5;
          }
        }
        const snap = a.placed ? k : 1;
        apply(a.head, a.target.head, snap);
        a.placed = true;
        a.root.visible = !hiddenAll;
        euler.setFromQuaternion(a.head.quaternion, "YXZ");
        a.torso.position.set(a.head.position.x, a.head.position.y - 0.45, a.head.position.z);
        a.torso.rotation.set(0, euler.y, 0);
        const hands = [a.target.left, a.target.right] as const;
        hands.forEach((t, i) => {
          const mesh = a.hands[i as 0 | 1];
          if (t) {
            apply(mesh, t, mesh.visible ? k : 1);
            mesh.visible = true;
          } else mesh.visible = false;
        });
      }
    },
    info() {
      const buf = new Float32Array(512);
      return [...avatars.values()].map((a) => {
        let level = 0;
        if (a.analyser) {
          a.analyser.getFloatTimeDomainData(buf);
          level = Math.sqrt(buf.reduce((s, x) => s + x * x, 0) / buf.length);
        }
        return {
          pubkey: a.member.pubkey,
          name: a.member.name,
          visible: a.root.visible,
          opacity: Math.round((a.materials[0]?.material.opacity ?? 1) * 100) / 100,
          head: a.target?.head.position.map((n) => Math.round(n * 100) / 100) ?? null,
          hands: [!!a.target?.left, !!a.target?.right] as [boolean, boolean],
          audioLevel: Math.round(level * 1000) / 1000,
          saying: a.bubbleText ?? "",
          muted: mutedKeys.has(a.member.pubkey),
          music: !!a.member.music,
          hearing: !!a.tune,
          musicVolume: Math.round((a.tuneVolume ?? 0) * 1000) / 1000,
          musicLevel: Math.round(rms(a.tuneMeter, levelBuf) * 1000) / 1000,
          look: a.member.look,
          guest: a.member.guest,
          identity: a.member.identity ?? null,
        };
      });
    },
  };
}

// ------------------------------------------------------------ page controls

function roomNameFromHash(hash: string): string | null {
  for (const part of hash.replace(/^#/, "").split("&")) {
    if (part.startsWith("room=")) {
      try {
        const v = decodeURIComponent(part.slice(5));
        if (/^[A-Za-z0-9_-]{4,48}$/.test(v)) return v;
      } catch {
        /* not a room name */
      }
    }
  }
  return null;
}

export interface CaptureOptions {
  /** Width of the panorama in pixels; the height is half of it. Default 2048, at most 4096. */
  width?: number;
  /** Objects to leave out, such as text that is specific to one visitor. */
  hide?: THREE.Object3D[];
  /** WebP quality from 0 to 1. Default 0.82. */
  quality?: number;
}

/**
 * Capture a world's preview (spec §5.8): a 360° still, twice as wide as tall,
 * taken from `position` (use the default entry point, at eye height). The
 * centre of the image is the view along -Z from there.
 *
 * Returns a WebP file. Publish it by hash; the announcement's `preview` tag
 * carries the address, the type `pano`, the SHA-256 and the dimensions.
 */
export async function capturePanorama(renderer: THREE.WebGLRenderer, scene: THREE.Scene, position: THREE.Vector3, opts: CaptureOptions = {}): Promise<Blob> {
  const width = Math.min(4096, Math.max(256, Math.round(opts.width ?? 2048)));
  const height = width / 2;
  const hidden = (opts.hide ?? []).filter((o) => o.visible);
  const xrWasEnabled = renderer.xr.enabled;
  const previousTarget = renderer.getRenderTarget();
  const autoClearWas = renderer.autoClear;
  // Fog is worked out per camera direction, so each of the six views would fade
  // differently and leave seams. A preview is taken without it.
  const fog = scene.fog;
  // Six ordinary 90° views, one at a time, each painted onto the part of the
  // panorama it covers. (Half-float, so dark scenes don't band on the way.)
  const faceTarget = new THREE.WebGLRenderTarget(Math.min(2048, width / 2), Math.min(2048, width / 2), { type: THREE.HalfFloatType });
  const flatTarget = new THREE.WebGLRenderTarget(width, height);
  flatTarget.texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    uniforms: { face: { value: faceTarget.texture }, forward: { value: new THREE.Vector3() }, up: { value: new THREE.Vector3() }, right: { value: new THREE.Vector3() } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `uniform sampler2D face; uniform vec3 forward; uniform vec3 up; uniform vec3 right; varying vec2 vUv;
      void main(){
        float lon = (vUv.x - 0.5) * 6.283185307179586;
        float lat = (vUv.y - 0.5) * 3.141592653589793;
        vec3 dir = vec3(sin(lon) * cos(lat), sin(lat), -cos(lon) * cos(lat));
        float along = dot(dir, forward);
        // Only the directions this view is the best one for (with a hair of overlap).
        if (along < max(abs(dir.x), max(abs(dir.y), abs(dir.z))) - 0.0005) discard;
        vec2 p = vec2(dot(dir, right), dot(dir, up)) / along;
        gl_FragColor = texture2D(face, clamp(p * 0.5 + 0.5, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const faceCamera = new THREE.PerspectiveCamera(90, 1, 0.05, 700);
  faceCamera.position.copy(position);
  // [looking along, with this way up]
  const views: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)],
    [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
    [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
    [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)],
    [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
    [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1)],
  ];
  try {
    for (const o of hidden) o.visible = false;
    scene.fog = null;
    renderer.xr.enabled = false; // a capture is never an XR frame
    renderer.setRenderTarget(flatTarget);
    renderer.clear();
    for (const [forward, up] of views) {
      faceCamera.up.copy(up);
      faceCamera.lookAt(position.clone().add(forward));
      faceCamera.updateMatrixWorld(true);
      renderer.autoClear = true;
      renderer.setRenderTarget(faceTarget);
      renderer.render(scene, faceCamera);
      material.uniforms.forward!.value.copy(forward);
      material.uniforms.up!.value.copy(up);
      material.uniforms.right!.value.crossVectors(forward, up);
      renderer.autoClear = false;
      renderer.setRenderTarget(flatTarget);
      renderer.render(quadScene, quadCamera);
    }
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(flatTarget, 0, 0, width, height, pixels);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d")!;
    const image = g.createImageData(width, height);
    // WebGL rows run bottom-up; images run top-down.
    for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
    g.putImageData(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", opts.quality ?? 0.82));
    if (!blob) throw new Error("nswp-sdk: this browser couldn't encode the preview");
    return blob;
  } finally {
    for (const o of hidden) o.visible = true;
    scene.fog = fog;
    renderer.xr.enabled = xrWasEnabled;
    renderer.autoClear = autoClearWas;
    renderer.setRenderTarget(previousTarget);
    faceTarget.dispose();
    flatTarget.dispose();
    material.dispose();
    quad.geometry.dispose();
  }
}

/** Prepare a loaded panorama image for use in a portal window. */
export function panoramaTexture(image: TexImageSource): THREE.Texture {
  const texture = new THREE.Texture(image as HTMLImageElement);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  // No mipmaps: the wrap-around behind the viewer would show as a seam.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export interface PortalWindowOptions {
  /** An alpha texture that cuts the window's shape (an arch, say) out of the geometry. */
  mask?: THREE.Texture;
  /**
   * How far back, at most, the view is taken from, in metres (default 1.5).
   * A true window seen from across a room shows only a sliver of what is
   * behind it, which for a preview is usually nothing recognisable. So the
   * view is worked out as if the viewer stood no further away than this:
   * from a distance they see a wide view, and close up it behaves like a real
   * window. `Infinity` gives a true window at every distance.
   */
  reach?: number;
}

/**
 * A window into a panorama: the mesh shows the part of the destination that
 * lies behind it from where the viewer stands, so the view shifts as they
 * move, like looking through a doorway. The mesh's local -Z is "into" the
 * destination and lines up with the centre of the panorama.
 */
export function createPortalWindow(geometry: THREE.BufferGeometry, pano: THREE.Texture, opts: PortalWindowOptions = {}): THREE.Mesh {
  const reach = opts.reach ?? 1.5;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pano: { value: pano },
      mask: { value: opts.mask ?? null },
      useMask: { value: opts.mask ? 1 : 0 },
      toLocal: { value: new THREE.Matrix3() },
      center: { value: new THREE.Vector3() },
      reach: { value: Number.isFinite(reach) ? reach : 0 },
    },
    vertexShader: `varying vec3 vWorld; varying vec2 vUv;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D pano; uniform sampler2D mask; uniform float useMask; uniform mat3 toLocal; uniform vec3 center; uniform float reach;
      varying vec3 vWorld; varying vec2 vUv;
      void main(){
        if (useMask > 0.5 && texture2D(mask, vUv).a < 0.5) discard;
        vec3 eye = cameraPosition;
        if (reach > 0.0) {
          vec3 away = cameraPosition - center;
          eye = center + away * (reach / (length(away) + reach));
        }
        vec3 dir = normalize(toLocal * (vWorld - eye));
        float lon = atan(dir.x, -dir.z);
        float lat = asin(clamp(dir.y, -1.0, 1.0));
        gl_FragColor = vec4(texture2D(pano, vec2(lon / 6.283185307179586 + 0.5, lat / 3.141592653589793 + 0.5)).rgb, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const rotation = new THREE.Matrix4();
  mesh.onBeforeRender = () => {
    rotation.extractRotation(mesh.matrixWorld);
    (material.uniforms.toLocal!.value as THREE.Matrix3).setFromMatrix4(rotation).invert();
    (material.uniforms.center!.value as THREE.Vector3).setFromMatrixPosition(mesh.matrixWorld);
  };
  return mesh;
}

/**
 * A room's controls, added to a world's controls (ui/model.ts): join or leave,
 * the microphone, and a private room to invite someone to. The HUD and the
 * headset console both draw them from there, so neither has room logic of its own.
 *
 * Joining shows a visitor's IP address to the others in the room. The Room
 * section says so before they join, on a flat screen and in a headset.
 */
export interface Travelling {
  /** They are in this place's open room. A private room doesn't travel: the next place's open room is other people. */
  joined: boolean;
  /** Their microphone is on. */
  mic: boolean;
  /** Named people they blocked here during this visit, for their own client to ask about. */
  blocked: string[];
}

/** Where a page keeps whether its visitor was joined, so a refresh doesn't put them out of the room. This tab only. */
const JOINED_KEY = () => `nswp:joined:${location.pathname}`;

/** What signs a post for the visitor when they send one out from their public feed. */
export interface RoomNotes {
  /** Whether a note can be signed now. While it can't, posting isn't offered. */
  ready(): boolean;
  /** Sign a note. Null, or a rejection, if it won't be signed. What comes back is checked before it is sent anywhere. */
  sign(note: { kind: number; content: string; tags: string[][] }): Promise<NostrEvent | null>;
  /** Be told when `ready()` may have changed. */
  onChange?(fn: () => void): unknown;
  /** A signer is there and the visitor hasn't unlocked it for this place: posting is offered, and leads there first. */
  locked?(): boolean;
  /** Start unlocking it, from a press. False if nothing could be opened. */
  unlock?(): boolean;
  /** Where that happens, as an address to name, or null. */
  host?(): string | null;
  /** A signer was named and didn't answer: then what to say about it. Null when that isn't so. */
  unanswered?(): string | null;
  /** Whose key signs, once it can: their feed is that key's posts. Left out, the feed shows only what is sent from here. */
  pubkey?(): string | null;
  /** What to call them over their feed: their name, or null for the short form of their key. */
  who?(): string | null;
}

export function addRoomControls(
  controls: Controls,
  presence: Presence,
  opts: {
    search?: string;
    onState?: (state: Record<string, unknown> | null) => void;
    /**
     * The visitor arrived joined: their own client says they were among people where they came from
     * (`arrival.read().context`, its `joined` and `mic`). The open room is joined without asking again.
     */
    arrived?: { joined?: boolean; mic?: boolean; blocked?: string[] } | null;
    /**
     * The visitor's panels. With them, a screen someone shares in the room can be watched: it opens on a panel
     * of the watcher's own, which they move, size and put away like any other. Without them nobody here can watch.
     */
    panels?: Panels | null;
    /**
     * The place's sounds. With them, a visitor can share the music they are playing with people near them, and
     * choose to hear what others share: both off until they turn them on.
     */
    sounds?: Sounds | null;
    /** False where this world wants no shared music: a concert, a library. Its visitors' own music still plays for them. */
    sharedMusic?: boolean;
    /** The relays a post the visitor sends out goes to, and their earlier posts are read from. Left out, the kit's own list. */
    noteRelays?: string[];
    /**
     * What signs a post when the visitor sends one out. Left out, the page's own signer: the hidden one
     * their client named, unlocked in that client's window (`worldSigner()`), which is what a world has. A
     * visitor's own client, in a room of its own where they are already signed in, gives its own.
     */
    notes?: RoomNotes;
  } = {},
): { refresh(): void; travelling(): Travelling } {
  const useTone = new URLSearchParams(opts.search ?? location.search).get("mic") === "tone";
  // For tests: a drawn picture that changes, in place of the browser's screen picker.
  const useTestScreen = new URLSearchParams(opts.search ?? location.search).get("screen") === "test";
  const canShare = useTestScreen || typeof navigator.mediaDevices?.getDisplayMedia === "function";
  const sounds = opts.sharedMusic === false ? null : (opts.sounds ?? null);
  let invited = roomNameFromHash(location.hash);
  let busy = false;
  let last = invited
    ? "You were invited to a private room. Joining shows your IP address to the others in it."
    : "Joining lets you see and hear others here. It shows your IP address to them.";
  const tell = (text: string) => {
    last = text;
    controls.say(text);
  };
  const status = () => {
    const s = presence.session;
    if (!s) return last;
    const others = s.members.length;
    const who = s.status === "no-relays" ? "can't reach any relay" : others === 0 ? "nobody else here yet" : others === 1 ? "1 other person here" : `${others} other people here`;
    // Say how the others see this visitor: by a name their own client vouched for, or as a guest.
    const as = s.self.guest ? "" : ` You are here as ${s.self.name}.`;
    return `${presence.roomName ? "Private room" : "Open room"}: ${who}.${as}${presence.micOn ? " Your microphone is on." : ""}${presence.musicOn ? ` Your music is offered to people near you: ${presence.musicListeners === 0 ? "nobody is hearing it" : presence.musicListeners === 1 ? "1 person is hearing it" : `${presence.musicListeners} people are hearing it`}.` : ""}${presence.screenOn ? ` You are sharing your screen: ${presence.screenViewers === 0 ? "nobody is watching" : presence.screenViewers === 1 ? "1 person is watching" : `${presence.screenViewers} people are watching`}.` : ""}`;
  };
  const refresh = () => {
    const s = presence.session;
    opts.onState?.(
      s ? { name: s.name, private: !!presence.roomName, status: s.status, self: s.self.pubkey, members: s.members.map((m) => m.pubkey), relays: s.relayCount, mic: presence.micOn, screen: presence.screenOn, music: presence.musicOn, musicListeners: presence.musicListeners, sharing: s.members.filter((m) => m.sharing).map((m) => m.pubkey), watching: [...watching.keys()] } : null,
    );
    controls.addSection({ id: "room", label: "Room", icon: "room", note: status });
    tendChat();
    tendFeed();
    people();
    remember();
  };
  // What a refresh needs to put the visitor back among the people they were with.
  const remember = () => {
    try {
      if (presence.session) sessionStorage.setItem(JOINED_KEY(), presence.micOn ? "mic" : "joined");
      else if (!busy) sessionStorage.removeItem(JOINED_KEY());
    } catch {
      /* no storage: a refresh leaves the room, as before */
    }
  };
  const microphone = async (): Promise<boolean> => {
    try {
      const track = useTone
        ? presence.testTone()
        : (await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })).getAudioTracks()[0]!;
      await presence.setMicrophone(track);
      return true;
    } catch {
      return false;
    }
  };
  // Who else is here: one entry each, in their own colour. Selecting one shows where they are.
  // ---- Screens. Someone sharing theirs is never put in front of anyone: each person chooses to watch, and what
  // they watch hangs on a panel of their own. A room is open to strangers, and a picture nobody asked for is the
  // easiest way to spoil one.
  const watching = new Map<string, { video: HTMLVideoElement; texture: THREE.VideoTexture | null; panel: Panel | null }>();
  const sharers = new Set<string>();
  const stopWatching = (pubkey: string, panelGone = false) => {
    const w = watching.get(pubkey);
    if (!w) return;
    watching.delete(pubkey);
    presence.watch(pubkey, false);
    w.video.srcObject = null;
    w.texture?.dispose();
    if (!panelGone) w.panel?.close();
  };
  const startWatching = (m: Member) => {
    const stream = presence.screenOf(m.pubkey);
    if (!opts.panels || !stream || watching.has(m.pubkey)) return false;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    const w: { video: HTMLVideoElement; texture: THREE.VideoTexture | null; panel: Panel | null } = { video, texture: null, panel: null };
    watching.set(m.pubkey, w);
    // The panel opens when the first picture arrives, at the shape it arrives in.
    const show = () => {
      if (w.panel || watching.get(m.pubkey) !== w || !video.videoWidth || !video.videoHeight) return;
      w.texture = new THREE.VideoTexture(video);
      w.texture.colorSpace = THREE.SRGBColorSpace;
      w.panel = opts.panels!.open(
        { kind: "custom", title: `${m.name}'s screen`, texture: w.texture, aspect: video.videoWidth / video.videoHeight, onClose: () => stopWatching(m.pubkey, true) },
        { keep: false },
      );
      refresh();
    };
    video.addEventListener("loadedmetadata", show);
    video.addEventListener("resize", show);
    void video.play().catch(() => {});
    presence.watch(m.pubkey, true);
    return true;
  };
  const testScreen = (): MediaStreamTrack => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const g = canvas.getContext("2d")!;
    let n = 0;
    const draw = () => {
      g.fillStyle = "#10243a";
      g.fillRect(0, 0, 1280, 720);
      g.fillStyle = "#ffd166";
      g.font = "64px sans-serif";
      g.fillText(`A shared screen, frame ${++n}`, 80, 380);
    };
    draw();
    const timer = setInterval(draw, 200);
    const track = canvas.captureStream(10).getVideoTracks()[0]!;
    track.addEventListener("ended", () => clearInterval(timer));
    return track;
  };

  let listed: string[] = [];
  /** What is offered about the person last selected, and the way back for anyone blocked. */
  let extras: string[] = [];
  let chosen: string | null = null;
  let headcount = 0;
  let toldOfMusic = false;
  // Who is blocked is always in sight here, in a room or out of one, with the way to undo it beside each name.
  const blockedNote = () => {
    const n = presence.blocked().length;
    const e = presence.blockedElsewhere;
    return `${n === 0 ? "" : `You have blocked ${n === 1 ? "1 person" : `${n} people`} here: you don't see or hear each other. Unblock anyone below. `}${
      e === 0 ? "" : `${e === 1 ? "1 person is" : `${e} people are`} blocked wherever you go: that list is kept by the place you set out from, and is changed there. `
    }`;
  };
  // The visitor's own list came with them. Nobody on it is connected to, from the first moment.
  if (opts.arrived?.blocked?.length) presence.blockAlso(opts.arrived.blocked);
  const recorders = new Set<string>();
  /** Choose someone: from the list, or by pressing the picture over their head. What can be done about them follows. */
  const choose = (m: Member) => {
    chosen = m.pubkey;
    people();
    presence.pointOut(m.pubkey);
    // A name is not unique and a mark can be matched, so the key behind a name is one action away, in full.
    controls.say(m.identity ? `${m.name} is under the column of light. Their key: ${encodeNpub(m.identity)}` : `${m.name} is under the column of light. A guest: nobody has vouched for who they are.`);
  };
  // A picture over someone's head is a button, and pressing it is choosing them.
  presence.onPerson((pubkey) => {
    const m = presence.people().find((x) => x.pubkey === pubkey);
    if (!m) return;
    choose(m);
    // And what can be done about them is put in front of the visitor: the menu, on People.
    controls.signal("show:people");
  });
  // Whether this visitor sees pictures at all. It is theirs, and goes with them from world to world.
  controls.add({
    id: "people-pictures",
    section: "people",
    icon: "selfie",
    on: () => showsPictures(),
    label: () => (showsPictures() ? "Profile pictures: on" : "Profile pictures: off"),
    short: "Pictures",
    act: () => {
      setShowsPictures(!showsPictures());
      controls.say(showsPictures() ? "People's own pictures are shown over their names. Each is fetched from wherever its owner keeps it, which tells that place your address." : "No pictures are fetched or shown, here or in the next world.");
    },
  });
  const people = () => {
    const here = presence.session ? presence.people() : [];
    // Someone came, or someone went: heard, as well as listed.
    if (presence.session && here.length !== headcount) controls.signal(here.length > headcount ? "join" : "leave");
    headcount = presence.session ? here.length : 0;
    for (const id of [...listed, ...extras]) controls.remove(id);
    extras = [];
    listed = here.map((m) => `person-${m.pubkey.slice(0, 12)}`);
    if (!here.some((m) => m.pubkey === chosen)) chosen = null;
    controls.addSection({
      id: "people",
      label: "People",
      icon: "people",
      note: () =>
        `${blockedNote()}${
          !presence.session
          ? "Join the room to see who else is here."
          : here.length === 0
            ? "Nobody else is here yet."
            : here.some((m) => m.pubkey === chosen)
              ? "What they say about themselves is their own words. Muting and blocking are yours alone: nobody is told."
              : `${here.length === 1 ? "1 person is" : `${here.length} people are`} here with you. Select one, or press the picture over their head, to see who they are, and to mute their voice or their music, or block them.`
        }`,
      // Whoever was chosen, at the head of the section: who they are here, and what they say of themselves.
      card: () => {
        const who = here.find((m) => m.pubkey === chosen);
        if (!who) return null;
        return {
          title: who.name,
          tag: who.guest ? "Guest" : "By name",
          proven: !who.guest,
          // A name is not unique and a picture can be copied: the key behind them is what tells two people apart.
          sub: who.identity ? shortNpub(who.identity) : "Nobody has vouched for who they are.",
          copy: who.identity ? encodeNpub(who.identity) : "",
          text: who.guest ? "" : (who.about ?? ""),
          picture: !who.guest && showsPictures() ? (who.picture ?? "") : "",
          color: who.look.light,
          now: [
            ...(who.recording ? ["Recording what they see"] : []),
            ...(who.sharing ? ["Sharing their screen"] : []),
            ...(who.music ? ["Sharing music"] : []),
            ...(presence.isMuted(who.pubkey) ? ["You have muted their voice"] : []),
          ],
        };
      },
    });
    here.forEach((m, i) =>
      controls.add({
        id: listed[i]!,
        section: "people",
        kind: "swatch",
        color: m.look.light,
        label: () => `${m.name}${m.recording ? ", recording" : ""}${m.sharing ? ", sharing their screen" : ""}${m.music ? ", sharing music" : ""}`,
        act: () => choose(m),
      }),
    );
    // Said once a visit, to someone who hasn't turned shared music on: that it is there, and where the switch is.
    if (sounds && !toldOfMusic && !sounds.levels.hearShared && here.some((m) => m.music)) {
      toldOfMusic = true;
      controls.say(`${here.find((m) => m.music)!.name} is sharing music. To hear what people near you share, turn it on in Sound.`);
    }
    // A screen that is no longer offered, or whose owner has gone, comes down.
    for (const key of [...watching.keys()]) if (!here.some((m) => m.pubkey === key && m.sharing)) stopWatching(key);
    // Say it once when someone starts sharing. Nothing is shown until this visitor asks.
    for (const m of here) {
      if (m.sharing && !sharers.has(m.pubkey)) controls.say(opts.panels ? `${m.name} is sharing their screen. Select them in People to watch.` : `${m.name} is sharing their screen.`);
      if (m.sharing) sharers.add(m.pubkey);
      else sharers.delete(m.pubkey);
    }
    // The person last selected: stop hearing them, or stop being in a room with them. Both are this visitor's own
    // doing, on their own device, and nobody is told.
    const who = here.find((m) => m.pubkey === chosen);
    if (who?.sharing && opts.panels) {
      extras.push("person-watch");
      controls.add({
        id: "person-watch",
        section: "people",
        icon: "panel",
        on: () => watching.has(who.pubkey),
        label: () => (watching.has(who.pubkey) ? `Stop watching ${who.name}'s screen` : `Watch ${who.name}'s screen`),
        act: () => {
          if (watching.has(who.pubkey)) stopWatching(who.pubkey);
          else if (startWatching(who)) controls.say(`${who.name}'s screen is opening on a panel of your own. Put the panel away to stop.`);
          else controls.say(`${who.name}'s screen can't be shown here.`);
          refresh();
        },
      });
    }
    if (who) {
      extras.push("person-mute", "person-music", "person-block");
      controls.add(
        {
          id: "person-mute",
          section: "people",
          icon: () => (presence.isMuted(who.pubkey) ? "mic" : "micOff"),
          on: () => presence.isMuted(who.pubkey),
          label: () => (presence.isMuted(who.pubkey) ? `Unmute ${who.name}'s voice` : `Mute ${who.name}'s voice`),
          act: () => {
            const now = !presence.isMuted(who.pubkey);
            presence.mute(who.pubkey, now);
            controls.say(now ? `You no longer hear ${who.name} speak. They still see and hear you, and aren't told.` : `You hear ${who.name} speak again.`);
          },
        },
        // Their music is a choice of its own: someone's voice without their music, or their music without their voice.
        ...(sounds
          ? [
              {
                id: "person-music",
                section: "people",
                icon: (() => (presence.isMusicMuted(who.pubkey) ? "sound" : "soundOff")) as () => "sound" | "soundOff",
                on: () => presence.isMusicMuted(who.pubkey),
                label: () => (presence.isMusicMuted(who.pubkey) ? `Unmute ${who.name}'s music` : `Mute ${who.name}'s music`),
                act: () => {
                  const now = !presence.isMusicMuted(who.pubkey);
                  presence.muteMusic(who.pubkey, now);
                  controls.say(
                    now
                      ? `You won't hear music ${who.name} shares. You still hear them speak.`
                      : sounds.levels.hearShared
                        ? `You hear ${who.name}'s music again when they share it and you are near.`
                        : `${who.name}'s music is no longer muted. To hear anyone's shared music, turn it on in Sound.`,
                  );
                },
              },
            ]
          : []),
        {
          id: "person-block",
          section: "people",
          icon: "exit",
          label: `Block ${who.name}`,
          act: () => {
            stopWatching(who.pubkey);
            const name = presence.block(who.pubkey);
            if (!name) return;
            chosen = null;
            controls.say(
              who.identity
                ? `${name} is blocked. You won't see or hear each other here, now or when they come back by that name. To them, you have left.`
                : `${name} is blocked for this visit. You won't see or hear each other. A guest gets a new key each visit, so it can't hold beyond this one.`,
            );
            refresh();
          },
        },
      );
    }
    // Anyone blocked can be let back, here, by the visitor who blocked them.
    for (const b of presence.blocked()) {
      const id = `unblock-${b.key.slice(0, 12)}`;
      extras.push(id);
      controls.add({
        id,
        section: "people",
        icon: "check",
        label: `Unblock ${b.name}${b.kept ? "" : " (blocked this visit)"}`,
        act: () => {
          presence.unblock(b.key);
          controls.say(`${b.name} is no longer blocked. You'll see each other again within half a minute if they are here.`);
          refresh();
        },
      });
    }
    // Say it once when someone starts recording: a light alone is easy to miss.
    for (const m of here) {
      if (m.recording && !recorders.has(m.pubkey)) controls.say(`${m.name} is recording what they see.`);
      if (m.recording) recorders.add(m.pubkey);
      else recorders.delete(m.pubkey);
    }
  };

  // ---- Written chat (protocol/06-rooms.md, "Words"): a few words to the people in the room, on the connection the
  // room already has. The controls hold the lines (ui/chat.ts); a flat screen draws them at its side, and a headset
  // on a panel of the visitor's own. Nothing is kept: leaving the room forgets all of it.
  let chatFor: RoomSession | null = null;
  let chatStops: (() => void)[] = [];
  const CHAT_W = 768;
  const CHAT_H = 900;
  const WRITE_H = 132;
  let chatPanel: { panel: Panel; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; drawn: number } | null = null;
  const drawChatPanel = () => {
    if (!chatPanel) return;
    const view = controls.chat.view();
    if (view.version === chatPanel.drawn) return;
    chatPanel.drawn = view.version;
    const t = controls.theme;
    const g = chatPanel.canvas.getContext("2d")!;
    g.fillStyle = t.glass;
    g.fillRect(0, 0, CHAT_W, CHAT_H);
    g.textBaseline = "middle";
    const ROW = 46;
    const measure = (text: string) => g.measureText(text).width;
    // The newest at the bottom, and as many above it as there is room for.
    let y = CHAT_H - WRITE_H - 18;
    for (let i = view.lines.length - 1; i >= 0; i--) {
      const line = view.lines[i]!;
      const lead = line.note ? "" : `${line.mine ? "You" : line.who}:`;
      g.font = line.note ? "italic 32px system-ui, sans-serif" : "34px system-ui, sans-serif";
      const rows = wrapWords(lead ? `${lead} ${line.text}` : line.text, measure, CHAT_W - 56, 6);
      y -= rows.length * ROW;
      if (y < 12) break;
      rows.forEach((row, r) => {
        const at = y + ROW * (r + 0.5);
        let x = 28;
        let rest = row;
        // Their name starts the first row, in their own colour; what they wrote follows it.
        if (r === 0 && lead && row.startsWith(lead)) {
          g.font = "600 34px system-ui, sans-serif";
          g.fillStyle = line.mine ? t.ink : line.color || t.accent;
          g.globalAlpha = line.mine ? 0.62 : 1;
          g.fillText(lead, x, at);
          x += measure(lead);
          rest = row.slice(lead.length);
          g.font = "34px system-ui, sans-serif";
        }
        g.globalAlpha = line.note ? 0.62 : 1;
        g.fillStyle = t.ink;
        g.fillText(rest, x, at);
      });
      g.globalAlpha = 1;
      y -= 10;
    }
    if (!view.lines.length) {
      g.font = "32px system-ui, sans-serif";
      g.fillStyle = t.ink;
      g.globalAlpha = 0.7;
      wrapWords("Nobody has written anything yet. What is written here goes to the people in this room, and is kept nowhere.", measure, CHAT_W - 80, 6).forEach((row, r) => g.fillText(row, 40, 200 + r * ROW));
      g.globalAlpha = 1;
    }
    // The one button: it puts the keyboard up, with its Speak key where there is one.
    g.strokeStyle = t.accent;
    g.lineWidth = 3;
    g.fillStyle = `rgba(${rgb(t.accent)}, 0.16)`;
    g.beginPath();
    g.roundRect(20, CHAT_H - WRITE_H + 12, CHAT_W - 40, WRITE_H - 32, 22);
    g.fill();
    g.stroke();
    g.font = "600 36px system-ui, sans-serif";
    g.fillStyle = t.ink;
    g.textAlign = "center";
    g.fillText("Write to the room", CHAT_W / 2, CHAT_H - WRITE_H / 2 - 4);
    g.textAlign = "left";
    chatPanel.texture.needsUpdate = true;
    controls.chat.seen();
  };
  const closeChatPanel = () => {
    const was = chatPanel;
    chatPanel = null;
    was?.texture.dispose();
    was?.panel.close();
  };
  /** Ask for a line on the headset's keyboard, and say it. */
  const writeInHeadset = () => {
    if (!opts.panels || !controls.chat.view().ready) return;
    void opts.panels.keyboard.ask({ title: "Write to the room. Done sends it.", maxLength: CHAT_LIMITS.chars }).then((text) => {
      const trouble = text ? controls.chat.send(text) : null;
      if (trouble) tell(trouble);
    });
  };
  /** The chat as a panel of the visitor's own: it floats where they put it, and comes with them while it is pinned. */
  const openChatPanel = () => {
    if (!opts.panels || chatPanel || !controls.chat.view().ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = CHAT_W;
    canvas.height = CHAT_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    try {
      const panel = opts.panels.open(
        {
          kind: "custom",
          title: controls.chat.view().title,
          texture,
          aspect: CHAT_W / CHAT_H,
          onPress: (_x, y) => {
            if (y > 1 - WRITE_H / CHAT_H) writeInHeadset();
          },
          onClose: () => {
            if (chatPanel?.texture === texture) chatPanel = null;
            texture.dispose();
          },
        },
        // To one side of where they are looking, an arm's reach away, and pinned: it comes with them until they unpin it.
        { id: "room-chat", keep: false, place: { width: 0.46 }, pin: [-0.46, -0.04, -0.8] },
      );
      chatPanel = { panel, canvas, texture, drawn: -1 };
      drawChatPanel();
    } catch (err) {
      texture.dispose();
      tell(err instanceof Error ? err.message.replace(/^nswp-sdk: /, "") : "The chat panel couldn't be opened.");
    }
  };
  controls.subscribe(drawChatPanel);
  const tendChat = () => {
    const s = presence.session;
    if (s === chatFor) return;
    for (const stop of chatStops) stop();
    chatStops = [];
    chatFor = s;
    controls.chat.detach();
    closeChatPanel();
    if (!s) return;
    controls.chat.attach(
      (text) => {
        const how = s.say(text);
        if (how === "slow") return "That is a lot at once. Wait a moment, then send it again.";
        if (how === "said" && s.members.length === 0) controls.chat.add({ note: true, text: "Nobody else is in the room yet, so nobody read that." });
        return null;
      },
      { title: presence.roomName ? "Private room chat" : "Room chat" },
    );
    chatStops.push(
      s.on("said", (m, line) => {
        const mine = m.pubkey === s.self.pubkey;
        controls.chat.add({ id: line.id, who: m.name, text: line.text, mine, color: `#${m.color.toString(16).padStart(6, "0")}` });
        if (mine || !showsChat()) return;
        controls.signal("heard");
        // Heard as well as seen, from where they stand: nearer is louder and brighter, and it is on their side.
        const where = presence.whereIs(m.pubkey);
        opts.sounds?.play("chat", where ?? { distance: 3 });
      }),
      // Who comes and goes is said in the chat too. A moment is waited for a name: a pass is shown just after arriving.
      s.on("member", (m) => {
        setTimeout(() => {
          if (chatFor === s && s.members.includes(m)) controls.chat.add({ note: true, text: `${m.name} is here.` });
        }, 1500);
      }),
      s.on("leave", (m) => controls.chat.add({ note: true, text: `${m.name} left.` })),
    );
  };
  onChatChange(() => {
    if (!showsChat()) closeChatPanel();
    refresh();
  });
  // ---- My public feed (protocol/10-identity.md, "Posting from a world"). What is written in a room stays in the
  // room. A post is another thing, in a window of its own: a public Nostr note, signed by the visitor's sign-in and
  // sent to relays from here, shown among the posts they have already made. It needs no room.
  const notes: RoomNotes = opts.notes ?? {
    ready: () => worldSigner().state === "unlocked",
    sign: (n) => worldSigner().sign(n),
    onChange: (fn) => worldSigner().onChange(fn),
    locked: () => worldSigner().state === "locked",
    unlock: () => worldSigner().unlock(),
    host: () => worldSigner().host,
    unanswered: () => (worldSigner().unanswered ? unansweredWords(worldSigner()) : null),
    pubkey: () => worldSigner().pubkey,
    who: () => hereAs()?.name || worldSigner().name,
  };
  const noteRelays = () => opts.noteRelays ?? DEFAULT_RELAYS;
  /** They pressed the row while signed out: once they are signed in, their feed is what they asked for. */
  let wantsFeed = false;
  const postNote = async (words: string): Promise<{ ok: boolean; said: string }> => {
    const signed = await notes.sign({ kind: 1, content: words, tags: [] }).catch(() => null);
    // Whatever signed it, what is sent on is checked first: a real signature, on a note, saying what was written.
    const note = signed && verifyEvent(signed) && signed.kind === 1 && signed.content === words ? signed : null;
    if (!note) return { ok: false, said: "That wasn't sent: your sign-in said no." };
    const sent = await publishEvent(noteRelays(), note).catch(() => null);
    const kept = sent ? Object.values(sent.relays).filter((said) => said === "ok").length : 0;
    return kept ? { ok: true, said: `Sent out, to ${kept === 1 ? "1 relay" : `${kept} relays`}. Anyone can read it now.` } : { ok: false, said: "Signed, but no relay took it. It wasn't sent." };
  };
  /**
   * The visitor's own posts, asked of the relays their posts go to. This is the one thing a world asks a relay
   * about a person, and it is the visitor's own key, in their own browser, when they open their own feed.
   */
  const loadPosts = async (): Promise<FeedSource[] | null> => {
    const key = notes.pubkey?.();
    if (!key) return [];
    const got = await queryRelays(noteRelays(), { kinds: [1], authors: [key], limit: FEED_LIMITS.kept }, 5000);
    if (!got.events.length && !Object.values(got.relays).some((said) => said === "eose")) return null;
    // Their posts, and not their replies to other people: out of its thread a reply reads as nonsense.
    return got.events.filter((e) => e.pubkey === key && e.kind === 1 && !e.tags.some((t) => t[0] === "e")).map((e) => ({ id: e.id, text: e.content, at: e.created_at }));
  };
  /** Whose feed the controls hold: a key, "" for someone whose key isn't told, null for nobody. */
  let feedFor: string | null = null;
  const FEED_LEAD = 150;
  let feedPanel: { panel: Panel; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; drawn: string } | null = null;
  const closeFeedPanel = () => {
    const was = feedPanel;
    feedPanel = null;
    was?.texture.dispose();
    was?.panel.close();
  };
  const tendFeed = () => {
    const key = notes.ready() ? (notes.pubkey?.() ?? "") : null;
    if (key === feedFor) return;
    feedFor = key;
    if (key === null) {
      controls.feed.detach();
      return closeFeedPanel();
    }
    controls.feed.attach({ who: notes.who?.() || (key ? shortNpub(key) : "you"), send: postNote, load: loadPosts });
  };
  /** The feed in a headset: the same posts, on a panel of the visitor's own. Where to write is at the top. */
  const drawFeedPanel = () => {
    if (!feedPanel) return;
    const view = controls.feed.view();
    const stamp = `${view.version}:${Math.floor(Date.now() / 60000)}`;
    if (stamp === feedPanel.drawn) return;
    feedPanel.drawn = stamp;
    const t = controls.theme;
    const g = feedPanel.canvas.getContext("2d")!;
    g.fillStyle = t.glass;
    g.fillRect(0, 0, CHAT_W, CHAT_H);
    g.textBaseline = "middle";
    g.textAlign = "left";
    const ROW = 44;
    const measure = (text: string) => g.measureText(text).width;
    g.font = "30px system-ui, sans-serif";
    g.fillStyle = t.ink;
    g.globalAlpha = 0.72;
    wrapWords(`Public, like a tweet: anyone can read what you send out here, as ${view.who}, and it can't be taken back.`, measure, CHAT_W - 56, 3).forEach((row, r) => g.fillText(row, 28, 34 + r * 38));
    g.globalAlpha = 1;
    // The one button: it puts the keyboard up.
    g.strokeStyle = t.accent;
    g.lineWidth = 3;
    g.fillStyle = `rgba(${rgb(t.accent)}, 0.16)`;
    g.beginPath();
    g.roundRect(20, FEED_LEAD, CHAT_W - 40, WRITE_H - 32, 22);
    g.fill();
    g.stroke();
    g.font = "600 36px system-ui, sans-serif";
    g.fillStyle = t.ink;
    g.textAlign = "center";
    g.fillText("Send out a post", CHAT_W / 2, FEED_LEAD + (WRITE_H - 32) / 2);
    g.textAlign = "left";
    let y = FEED_LEAD + WRITE_H;
    const say = (text: string) => {
      g.font = "italic 30px system-ui, sans-serif";
      g.globalAlpha = 0.7;
      wrapWords(text, measure, CHAT_W - 56, 3).forEach((row, r) => g.fillText(row, 28, y + ROW * (r + 0.5)));
      g.globalAlpha = 1;
      y += ROW * 2;
    };
    if (view.said) say(view.said);
    if (!view.posts.length) say(view.loading ? "Fetching your posts…" : "Nothing here yet. What you send out appears here, and on Nostr for anyone to read.");
    const nowSec = Math.floor(Date.now() / 1000);
    // The newest at the top, and as many under it as there is room for.
    for (const post of view.posts) {
      g.font = "33px system-ui, sans-serif";
      const rows = wrapWords(post.text, measure, CHAT_W - 56, 5);
      if (y + (rows.length + 1) * ROW > CHAT_H - 10) break;
      g.fillStyle = t.ink;
      g.globalAlpha = post.state === "sending" ? 0.6 : 1;
      rows.forEach((row, r) => g.fillText(row, 28, y + ROW * (r + 0.5)));
      y += rows.length * ROW;
      g.font = "26px system-ui, sans-serif";
      g.fillStyle = post.state === "failed" ? t.warn : t.ink;
      g.globalAlpha = post.state === "failed" ? 1 : 0.55;
      g.fillText(post.state === "sending" ? "Sending…" : post.state === "failed" ? "Not sent" : ago(post.at, nowSec), 28, y + 20);
      g.globalAlpha = 0.14;
      g.fillStyle = t.ink;
      g.fillRect(28, y + ROW + 4, CHAT_W - 56, 2);
      g.globalAlpha = 1;
      y += ROW + 16;
    }
    feedPanel.texture.needsUpdate = true;
  };
  const openFeedPanel = () => {
    if (!opts.panels || feedPanel || !controls.feed.view().ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = CHAT_W;
    canvas.height = CHAT_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    try {
      const panel = opts.panels.open(
        {
          kind: "custom",
          title: controls.feed.view().title,
          texture,
          aspect: CHAT_W / CHAT_H,
          onPress: (_x, y) => {
            if (y < FEED_LEAD / CHAT_H || y > (FEED_LEAD + WRITE_H) / CHAT_H || !opts.panels) return;
            void opts.panels.keyboard.ask({ title: "Write a post. Done sends it out, for anyone to read.", maxLength: CHAT_LIMITS.chars }).then((text) => {
              const trouble = text ? controls.feed.send(text) : null;
              if (trouble) tell(trouble);
            });
          },
          onClose: () => {
            if (feedPanel?.texture === texture) feedPanel = null;
            texture.dispose();
          },
        },
        // On the other side from the room's chat, so both can be up.
        { id: "my-feed", keep: false, place: { width: 0.46 }, pin: [0.46, -0.04, -0.8] },
      );
      feedPanel = { panel, canvas, texture, drawn: "" };
      controls.feed.opened();
      drawFeedPanel();
    } catch (err) {
      texture.dispose();
      tell(err instanceof Error ? err.message.replace(/^nswp-sdk: /, "") : "Your feed couldn't be opened.");
    }
  };
  controls.subscribe(drawFeedPanel);
  /** In a headset it is a panel in the world; on a screen, the other side of the panel the chat is on. */
  const openFeed = () => {
    if (presence.presenting && opts.panels) return feedPanel ? closeFeedPanel() : openFeedPanel();
    controls.signal("toggle:feed");
  };
  notes.onChange?.(() => {
    tendFeed();
    if (notes.ready() && wantsFeed) {
      wantsFeed = false;
      openFeed();
    }
    refresh();
  });

  // ---- Signing in or out here changes who the room sees. A room joined as one is left and joined again as the
  // other: a pass can't be shown late or taken back, and saying one thing while the room sees another is worse.
  let turning = false;
  const asWhoTheyAre = async () => {
    const s = presence.session;
    if (!s || busy || turning) return;
    const who = hereAs();
    if (!!who === !s.self.guest) return;
    turning = busy = true;
    const mic = presence.micOn;
    const name = presence.roomName;
    for (const key of [...watching.keys()]) stopWatching(key);
    presence.leave();
    try {
      await presence.join(name);
      if (mic) await microphone();
      tell(presence.session?.self.guest ? "The room sees a guest now." : `The room sees you as ${presence.session?.self.name} now.`);
    } catch {
      tell("You left the room, and joining it again didn't work. Join it again from here.");
    } finally {
      turning = busy = false;
      refresh();
    }
  };
  if (signerNamed()) worldSigner().onChange(() => void asWhoTheyAre());

  controls.add(
    {
      id: "room-chat",
      section: "room",
      hotbar: true,
      icon: "chat",
      label: () => {
        const n = controls.chat.view().unread;
        return n ? `Chat: ${n} new` : "Chat";
      },
      short: () => {
        const n = controls.chat.view().unread;
        return n ? `Chat ${n}` : "Chat";
      },
      on: () => controls.chat.view().unread > 0,
      hidden: () => !presence.session || !showsChat(),
      act: () => {
        // In a headset it is a panel in the world; on a screen, a panel at the side of it.
        if (presence.presenting && opts.panels) return chatPanel ? closeChatPanel() : openChatPanel();
        controls.signal("toggle:chat");
      },
    },
    {
      id: "feed",
      section: "room",
      icon: "note",
      // It is here whenever there is something to post with, signed in or not: a row that isn't there can't be
      // found. Signed out, it says what comes first, and pressing it starts that.
      label: () => {
        if (notes.ready()) return "Send out a post";
        const host = notes.host?.() ?? "your sign-in address";
        return notes.unanswered?.() ? `Sending out a post isn't available: ${host} didn't answer` : `Send out a post: sign in at ${host} first`;
      },
      short: "Post",
      hidden: () => !(notes.ready() || notes.locked?.() || notes.unanswered?.()),
      act: () => {
        if (notes.ready()) return openFeed();
        const why = notes.unanswered?.();
        if (why) return tell(why);
        const host = notes.host?.() ?? "your sign-in address";
        // A headset draws nothing but the world, so no window can open in one.
        if (presence.presenting) return tell(`A window from ${host} is needed first, and none can open in a headset. Leave the headset view for a moment, press this again, and come back in.`);
        wantsFeed = !!notes.unlock?.();
        tell(
          wantsFeed
            ? `A window from ${host} has opened. Sign in there if it asks, and say yes. Then your public feed opens here.`
            : `Your browser didn't let a window open. Allow pop-ups for this site and press this again. Nothing is typed in this world: ${host} asks.`,
        );
      },
    },
    {
      id: "room-chat-show",
      section: "room",
      icon: "chat",
      label: () => (showsChat() ? "Written chat: on" : "Written chat: off"),
      on: () => showsChat(),
      act: () => {
        setShowsChat(!showsChat());
        tell(showsChat() ? "What people write in a room is shown to you, and you can write. It goes only to the people in the room, and is kept nowhere." : "Nothing anyone writes is shown to you, here or in the next world, and nobody is told.");
      },
    },
    {
      id: "room-join",
      section: "room",
      hotbar: true,
      icon: () => (presence.session ? "leave" : "room"),
      label: () => (presence.session ? "Leave the room" : "Join the room"),
      short: () => (presence.session ? "Leave" : "Join"),
      on: () => !!presence.session,
      hidden: () => busy,
      act: async () => {
        if (presence.session) {
          for (const key of [...watching.keys()]) stopWatching(key);
          presence.leave();
          controls.signal("leave");
          tell("You left the room.");
          return refresh();
        }
        busy = true;
        try {
          await presence.join(invited);
          controls.signal("join");
        } catch (err) {
          tell(`Couldn't join: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          busy = false;
          refresh();
        }
      },
    },
    {
      id: "room-mic",
      section: "room",
      hotbar: true,
      icon: () => (presence.micOn ? "mic" : "micOff"),
      label: () => (presence.micOn ? "Turn microphone off" : "Turn microphone on"),
      short: "Mic",
      on: () => presence.micOn,
      hidden: () => !presence.session,
      act: async () => {
        if (presence.micOn) {
          await presence.setMicrophone(null);
          controls.signal("micOff");
        } else if (await microphone()) controls.signal("micOn");
        else tell("The microphone is blocked or unavailable.");
        refresh();
      },
    },
    // ---- Music shared with people nearby. Both halves are off until the visitor turns them on: nobody's music
    // reaches anyone who didn't ask, and nobody's music leaves their device unless they offer it.
    ...(sounds
      ? [
          {
            id: "sound-share",
            section: "sound",
            icon: "sound" as const,
            on: () => presence.musicOn,
            label: () => (presence.musicOn ? "Sharing your music with people near you: on" : "Share your music with people near you"),
            hidden: () => !presence.session || sounds.jukebox.list().length === 0,
            act: async () => {
              if (presence.musicOn) {
                await presence.shareMusic(null);
                tell("You stopped sharing your music.");
                return refresh();
              }
              await presence.shareMusic(sounds.jukebox.output());
              tell(
                `Your music is offered to people near you. It reaches only those who have chosen to hear shared music, and fades with distance.${presence.micOn ? " With your microphone on, wear headphones, or they hear it twice." : ""}`,
              );
              refresh();
            },
          },
          {
            id: "sound-hear",
            section: "sound",
            icon: "sound" as const,
            on: () => sounds.levels.hearShared,
            label: () => (sounds.levels.hearShared ? "Hear music others share: on" : "Hear music others share: off"),
            act: () => {
              sounds.setLevels({ hearShared: !sounds.levels.hearShared });
              controls.say(sounds.levels.hearShared ? "You'll hear music that people near you share, quieter the further they are." : "You won't hear anyone's shared music.");
            },
          },
          {
            id: "sound-shared",
            section: "sound",
            hidden: () => !sounds.levels.hearShared,
            on: () => sounds.levels.shared > 0,
            label: () => `Others' music: ${LEVEL_WORDS[levelStep(sounds.levels.shared)]}`,
            act: () => sounds.setLevels({ shared: nextLevel(sounds.levels.shared) }),
          },
        ]
      : []),
    {
      id: "room-screen",
      section: "room",
      icon: "panel",
      on: () => presence.screenOn,
      label: () => (presence.screenOn ? "Stop sharing your screen" : "Share your screen"),
      // A phone or a headset's browser can't offer a screen. It can still watch one.
      hidden: () => !presence.session || !canShare,
      act: async () => {
        if (presence.screenOn) {
          await presence.shareScreen(null);
          tell("You stopped sharing your screen.");
          return refresh();
        }
        try {
          const track = useTestScreen ? testScreen() : (await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false })).getVideoTracks()[0]!;
          await presence.shareScreen(track);
          tell("Your screen is offered to this room. It is sent only to people who choose to watch. Share one window if anything else on your screen is private.");
        } catch {
          tell("Nothing was shared.");
        }
        refresh();
      },
    },
    {
      id: "room-invite",
      section: "room",
      icon: "link",
      label: () => (presence.roomName ? "Copy invite link" : "Make a private room"),
      hidden: () => !presence.session,
      act: async () => {
        if (!presence.roomName) {
          const bytes = crypto.getRandomValues(new Uint8Array(9));
          const code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
          history.replaceState(history.state, "", `${location.pathname}${location.search}#room=${code}`);
          invited = code;
          await presence.join(code);
        }
        try {
          await navigator.clipboard.writeText(location.href);
          tell("Invite link copied. Anyone with it can join.");
        } catch {
          tell("Copy this page's address to invite someone.");
        }
        refresh();
      },
    },
  );
  // The visitor's volumes reach the room: how loud voices are, and whether and how loud to hear shared music.
  (opts.sounds ?? null)?.onChange((l) => {
    presence.setVolume(l.off ? 0 : l.voices);
    presence.setHearShared(!!sounds && !l.off && l.hearShared, l.shared);
  });

  // Staying joined. Two ways a visitor is in the room without pressing Join here: their own client brought them
  // from a place where they were joined, or this page was refreshed while they were. Either way they are told at
  // once, and Leave is where Join was.
  let kept: string | null = null;
  try {
    kept = wasRefreshed() ? sessionStorage.getItem(JOINED_KEY()) : null;
  } catch {
    /* no storage */
  }
  refresh();
  const carried = opts.arrived?.joined ? { mic: !!opts.arrived.mic, from: "there" as const } : kept ? { mic: kept === "mic", from: "refresh" as const } : null;
  // A private room is entered by its link, never by a hint: arriving joined means the open room, and a visitor
  // holding an invitation who wasn't in the room is still asked.
  if (carried && (carried.from === "refresh" || !invited)) {
    busy = true;
    void (async () => {
      try {
        await presence.join(carried.from === "refresh" ? invited : null);
        const heard = carried.mic ? await microphone() : false;
        // Joining can be done before the page has finished coming up. Words said then are words nobody reads, so
        // these wait until the visitor has had a moment to see where they are.
        const early = 2500 - performance.now();
        if (early > 0) await new Promise((done) => setTimeout(done, early));
        tell(
          `You are still in the room${carried.from === "there" ? ", as you were where you came from" : ""}: others here can see you${heard ? " and hear you" : ""}.${carried.mic && !heard ? " Your microphone is off here: the browser didn't allow it." : ""} Leave is where Join was.`,
        );
      } catch (err) {
        tell(`Couldn't stay joined: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        busy = false;
        refresh();
      }
    })();
  }

  return {
    refresh,
    travelling: () => ({ joined: !!presence.session && !presence.roomName, mic: !!presence.session && !presence.roomName && presence.micOn, blocked: presence.newlyBlocked() }),
  };
}

/**
 * The controls every world's view needs: enter or leave VR, and turn around.
 * Returns whether this device can enter VR at all.
 *
 * It also hides the flat HUD while a headset session runs. The page can't be
 * seen from inside one, and the console takes over.
 */
/**
 * The one thing asked of someone who has just arrived from a headset session:
 * a large way back in, over everything, that one press answers either way.
 * A browser won't let a page start a headset session unasked, so this is the
 * least that can be asked (protocol/02-doors.md).
 */
function offerHeadset(title: string, enter: () => void, stay: () => void): { remove(): void } {
  const scrim = document.createElement("div");
  scrim.id = "nswp-enter";
  scrim.setAttribute("role", "dialog");
  scrim.setAttribute("aria-label", `You've arrived at ${title}`);
  Object.assign(scrim.style, { position: "fixed", inset: "0", zIndex: "50", display: "grid", placeContent: "center", justifyItems: "center", gap: "18px", padding: "24px", background: "rgba(4, 7, 11, 0.62)", textAlign: "center" });
  const heading = document.createElement("p");
  heading.textContent = title;
  Object.assign(heading.style, { margin: "0", font: "700 clamp(28px, 6vw, 56px)/1.1 system-ui, sans-serif", color: "#eef5fb" });
  const go = document.createElement("button");
  go.type = "button";
  go.id = "nswp-enter-vr";
  go.textContent = "Enter VR";
  // Large enough to hit with a controller's ray on a headset's flat panel, first try.
  Object.assign(go.style, { font: "700 clamp(24px, 5vw, 40px)/1 system-ui, sans-serif", minWidth: "min(78vw, 520px)", minHeight: "120px", padding: "0 32px", border: "0", borderRadius: "18px", background: "#eef5fb", color: "#04070b", cursor: "pointer" });
  const flat = document.createElement("button");
  flat.type = "button";
  flat.id = "nswp-enter-flat";
  flat.textContent = "Look around on this screen";
  Object.assign(flat.style, { font: "500 18px/1 system-ui, sans-serif", padding: "14px 20px", border: "0", background: "none", color: "#eef5fb", textDecoration: "underline", cursor: "pointer" });
  scrim.append(heading, go, flat);
  const remove = () => {
    removeEventListener("keydown", onKey);
    scrim.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") stay();
  };
  go.addEventListener("click", enter);
  flat.addEventListener("click", stay);
  addEventListener("keydown", onKey);
  document.body.append(scrim);
  go.focus();
  return { remove };
}

export async function addViewControls(
  controls: Controls,
  d: {
    renderer: THREE.WebGLRenderer;
    rig: THREE.Object3D;
    camera: THREE.Camera;
    hud?: { setHidden(hidden: boolean): void };
    onState?: (state: string) => void;
    /**
     * The visitor left a headset session to come here (`arrival.read().context?.immersive`,
     * or however a client knows). They are offered the way back in before anything else.
     */
    arrived?: { title: string };
    /** The offer above has gone up, or been answered. */
    onOffer?: (showing: boolean) => void;
    /**
     * The visitor's state as they leave to say who they are (in a room, their microphone on, moving the intense
     * way), so they come back as they left. The headset session is added here.
     */
    leaving?: (to: { title: string; address: string }) => GoOptions | Promise<GoOptions>;
    /** False for a world that sets its camera's width itself, and so applies the visitor's own (`watchFov`, `visitorFov`). */
    fov?: boolean;
  },
): Promise<boolean> {
  const xr = navigator.xr;
  let supported = false;
  try {
    supported = xr ? await xr.isSessionSupported("immersive-vr") : false;
  } catch {
    /* stays false */
  }
  const presenting = () => d.renderer.xr.isPresenting;
  d.renderer.xr.addEventListener("sessionstart", () => d.hud?.setHidden(true));
  d.renderer.xr.addEventListener("sessionend", () => d.hud?.setHidden(false));
  let offer: { remove(): void } | null = null;
  const answered = () => {
    if (!offer) return;
    offer.remove();
    offer = null;
    d.onOffer?.(false);
  };
  const enter = async () => {
    if (presenting()) return;
    try {
      const session = await xr!.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "hand-tracking"] });
      await d.renderer.xr.setSession(session);
      d.onState?.("presenting");
      session.addEventListener("end", () => d.onState?.("ended"));
      answered();
    } catch (err) {
      d.onState?.(`error: ${err instanceof Error ? err.message : String(err)}`);
      controls.say("Couldn't start VR on this device.");
    }
  };
  // Where a browser lets a headset session carry on across a crossing, it says so with this event, and
  // nothing need be asked at all. It is a proposal that few browsers have; everywhere else, nothing happens.
  try {
    (xr as unknown as EventTarget | undefined)?.addEventListener?.("sessiongranted", () => void enter());
  } catch {
    /* not offered here */
  }
  if (supported && d.arrived && !presenting()) {
    offer = offerHeadset(d.arrived.title, () => void enter(), answered);
    d.onOffer?.(true);
  }
  controls.add(
    {
      id: "vr",
      section: "view",
      icon: "vr",
      tone: "primary",
      hotbar: true,
      hidden: () => !supported,
      label: () => (presenting() ? "Leave VR" : "Enter VR"),
      short: "VR",
      act: async () => {
        if (presenting()) return void (await d.renderer.xr.getSession()?.end());
        await enter();
      },
    },
    { id: "turn", section: "view", icon: "turn", label: "Turn around", act: () => turnVisitor(d.rig, d.camera, 180) },
    fullscreenAction(controls, presenting),
  );
  // How fast the view turns under their hand, and how wide they see at a desk: theirs, and the same in every world.
  addDeskControls(controls, { presenting });
  // The camera is kept as wide as they asked. A world that fits its own view to the window keeps its own watch.
  if (d.fov !== false && (d.camera as THREE.PerspectiveCamera).isPerspectiveCamera) watchFov(d.camera as THREE.PerspectiveCamera, { presenting });
  // Who they are here, and the way to sign in: their own client's to ask, so this leaves for it and comes back
  // (ui/identity.ts). A world that has put its own control there keeps it, and a place with no client to go back
  // to (a client's own room, a world opened by itself with no Airlock named) has none.
  if (!controls.has("identity") && identityHost()) {
    const leaving: Leaving = async (to) => ({ ...(await d.leaving?.(to)), xrSession: d.renderer.xr.getSession() });
    controls.addSection(identitySection());
    controls.add(figureAction(controls, leaving), identityAction(controls, leaving), signerAction(controls, { presenting: () => d.renderer.xr.isPresenting }));
  }
  // Leaving fullscreen with the browser's own key changes what the control should say.
  document.addEventListener("fullscreenchange", () => controls.setTarget(""));
  controls.addSection({
    id: "view",
    label: "View",
    icon: "vr",
    note: supported ? "In a headset, raise your wrist or select the small Menu button low in front of you to reach these controls." : "This device can't enter VR. Everything here works without it.",
  });
  return supported;
}

export { createFigure, type Figure, type FigureFacts, type FigureStyle } from "./figure.js";
export { createXrInput, type GrabOptions, type XrInput, type XrInputInfo, type XrInputOptions } from "./input.js";
export { CASUAL_COMFORT, DEFAULT_COMFORT, INTENSE_COMFORT, isIntense, readPad, type Comfort, type PadState } from "./actions.js";
export { addPanelControls, createPanels, type Panel, type PanelContent, type PanelInfo, type Panels, type PanelsOptions } from "./panels.js";
export { LIBRARY_LIMITS, PANEL_LIMITS, PANEL_LOOKS, type LibraryItem, type PanelLook, type PanelPlace, type PanelRecord, type PanelSource } from "./panel-store.js";
import { wasRefreshed } from "./stay.js";
export { createStay, wasRefreshed, type Stay, type Stood } from "./stay.js";
export { createStroll, dotsBetween, DOUBLE_TAP, DRAG_LOOK, reachOf, RUN, TAP_REACH, WALK_SPEED, type Stroll } from "./stroll.js";
export { createFloorMarks, type FloorMarks } from "./floor-mark.js";
export { DOOR_REACH } from "./gate-size.js";
export { addJump, createJump, JUMP_GRAVITY, JUMP_HEIGHT, JUMP_SPEED, type AddJumpOptions, type Jump } from "./jump.js";
export { viewScale } from "./sign.js";
export { arrivedSettings, arriveWith, currentSettings, reportSettings, type TravelSettings } from "./settings.js";
export { fullscreenWaiting, prefersFullscreen, resumeFullscreen } from "./ui/fullscreen.js";
export { loadPicture, onPicturesChange, PICTURE_LIMITS, setShowsPictures, showsPictures } from "./picture.js";
export { addDeskControls, FOV_STEPS, LOOK_STEPS, lookScale, onDeskChange, setLookScale, setVisitorFov, visitorFov, watchFov } from "./desk.js";
export { byName, figureAction, hereAs, identityAction, identityHost, identitySection, identityWords, signerAction, signerNamed, worldSigner, youCard, type Leaving } from "./ui/identity.js";
export { createWorldSigner, type SignerState, type WorldSigner } from "./signer.js";
export { currentForm, deviceForms, formFor, startingForm, usedForm, type DeviceForms, type Form } from "./form.js";
export { createFps, heldKey, lookAfter, strideOf, LOOK_SPEED, PITCH_LIMIT, SPRINT, type Fps, type FpsOptions, type Held } from "./fps.js";
export { addSoundControls, createSounds, CUES, type Cue, type Jukebox, type Song, type SoundLevels, type Sounds, type SoundsOptions, type SoundTheme } from "./sound.js";
export { browserVoice, computerVoice, createVoice, recordVoice, toPcm16, type Hearing, type Voice, type VoiceSource, type VoiceState } from "./speech.js";
export { createKeyboard, type AskOptions, type Keyboard, type KeyboardOptions } from "./keyboard.js";
export { createLibrary, type Library, type LibraryOptions } from "./library.js";
export { CHAMBER_ORDER, createChamber, createCrossing, type ArriveOptions, type Chamber, type Crossing, type CrossingOptions, type CrossingState } from "./chamber.js";

export { addCameraControls, canRecord, recordClip, saveFile, takePicture, takeSelfie, type Camera, type CameraOptions, type Capture, type Clip } from "./camera.js";
