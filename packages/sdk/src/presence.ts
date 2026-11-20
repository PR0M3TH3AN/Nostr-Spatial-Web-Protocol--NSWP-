/**
 * Other people in a room, for a world drawn with Three.js: their figures, their names and pictures, what they
 * write, what they hold, and their voices from where they stand (spec §9.4, §9.8). It sends the visitor's own
 * pose, and keeps personal space.
 *
 * Everything here that isn't drawing is the same for a world made with another engine: `drawn()` gives such a
 * world each person as plain shapes and pictures to draw for itself (engine-people.ts), from this one copy.
 */
import * as THREE from "three";
import { bubbleSeconds, buildTints, cleanItemsRule, cleanTints, itemCoordinate, parseTints, type Item, decodeLook, spawnOffset, type Pose, type Transform } from "@nswp/core";
import { createFigure, type Figure, type FigureStyle } from "./figure.js";
import { room, type JoinOptions, type Member, type RoomSession } from "./room.js";
import { loadBlocked, storeBlocked, withBlocked, withoutBlocked, type Blocked } from "./blocks.js";
import { MUSIC_DUCK, MUSIC_RANGE, musicFade, musicToHear } from "./sound-store.js";

import { loadPicture, onPicturesChange, showsPictures } from "./picture.js";
import { onChatChange, showsChat, wrapWords } from "./ui/chat.js";
import { setAimScale } from "./desk.js";
import { applyTints, showsItems, type Items } from "./items.js";
import { createPlay, mayHold, type Play, type PlayOptions } from "./play.js";
import type { ItemBoxOptions } from "./item-box.js";
import { byName } from "./ui/identity.js";


export interface PresenceOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** The object that moves the visitor around; the camera is inside it. */
  rig: THREE.Object3D;
  /**
   * What says whether the visitor is in a headset: a Three.js renderer, or for a world drawn by something else,
   * anything that answers the same two questions.
   */
  renderer: { xr: { readonly isPresenting: boolean; getSession(): XRSession | null } };
  /** XR controller target-ray spaces, as from `renderer.xr.getController(i)`. */
  controllers: THREE.Object3D[];
  /** CSS colour for name labels. */
  labelColor?: string;
  /**
   * What fetches and checks items (items.ts), for a world that lets visitors carry things in
   * (protocol/17-items.md). Left out, nothing anyone holds is drawn.
   */
  items?: Items | null;
  /** What this world does with items: "none", "allowed" or "play". Asked each time. Left out, none. */
  itemsRule?: () => string;
  /**
   * Whether an item's own logic runs in this world, in its locked box (item-box.ts), and where the box's page is
   * served. Left out, items are shapes here and do nothing of their own.
   */
  itemScripts?: boolean | ItemBoxOptions;
  /** The world's sounds: an item's own sounds are played through them, at the visitor's own volume. */
  sounds?: PlayOptions["sounds"];
  /** Whether a shape of this world is solid to things items send out. Left out, every mesh that can be seen is. */
  solid?: PlayOptions["solid"];
  /** Be told when something an item sent out sticks to a shape of this world: what that means is the world's rule. */
  onStruck?: PlayOptions["onStruck"];
  /** The world's own colour and whether things may move for the visitor, for what is drawn of how they are. */
  theme?: PlayOptions["theme"];
  /**
   * True for a world drawn by another engine: things in play are kept as places and directions, and that engine
   * draws them and says what each ran into (`play.snapshot()`, `play.met()`).
   */
  deferredPlay?: boolean;
  /**
   * Whether the item in hand is up at the visitor's eye, where something other than this draws it there. Left
   * out, this brings it up itself (`setSighting`).
   */
  sighting?: () => boolean;
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
  /** The item this visitor is holding, by its coordinate, or "". */
  readonly holding: string;
  /**
   * Take an item in hand, or put it away with "" (protocol/17-items.md). It is drawn for the visitor and said to
   * the room. Refused, with a few words why, where the world has no items, the item can't be held, or it has to
   * be granted.
   */
  setHolding(item: string, tints?: Record<string, string>): Promise<{ ok: boolean; said: string }>;
  /**
   * Choose the colours of what is in hand (protocol/17-items.md, "A holder's own colours"): for each of the item's
   * tints, a colour. It is recoloured at once, and the room is told. A tint left out is as its maker made it.
   */
  setTints(tints: Record<string, string>): void;
  /** The colours chosen for what is in hand now. */
  readonly tints: Record<string, string>;
  /**
   * Items in play (play.ts): what the item in hand does on a press, the things sent out, and how this visitor is.
   * Null in a world that draws no items.
   */
  readonly play: Play | null;
  /** Which hand holds the item in a headset: the index of its controller, or -1 at a desk or with nothing held. */
  readonly holdingHand: number;
  /**
   * Aim along the sight of what is in hand, at a desk, or stop: it is brought up to the eye, and they see as much
   * narrower as the item asks (never narrower than a little under half). Nothing happens for an item with no sight.
   */
  setSighting(on: boolean): void;
  readonly sighting: boolean;
  /** Stop, or let again, what one person's items do from reaching this visitor. Nobody is told. For a place that only allows items. */
  muteItems(pubkey: string, on: boolean): void;
  isItemsMuted(pubkey: string): boolean;
  /** What this world does with items: "none", "allowed" or "play". */
  readonly itemsRule: string;
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
  /**
   * Everyone who is being drawn, as what they are drawn with: for a world that draws people with something other
   * than Three.js (engine-people.ts). Their figures, names, pictures and words are made here whatever draws them,
   * so they look the same in every world, and nothing about who is where is worked out twice.
   */
  drawn(): PersonDrawn[];
}

/** One person as they are being drawn now. Every part is where it is in the world: read it, and change nothing. */
export interface PersonDrawn {
  pubkey: string;
  name: string;
  /** Between 0 and 1: less as they come very close, so that nobody fills another's view. */
  opacity: number;
  /** Their head, body and hands. A change of look, or a pass that checked out, makes a new one. */
  figure: Figure;
  /** Their name, over their head. */
  label: THREE.Sprite;
  /** Their own picture, over their name. */
  picture: THREE.Sprite | null;
  /** What they last wrote, for a few seconds. */
  bubble: THREE.Sprite | null;
  /** Lit while they say they are recording. */
  light: THREE.Sprite | null;
  /** A column of light while they are being pointed out. */
  beam: THREE.Sprite | null;
  /** The item they say they hold, by its coordinate, or "": the colours they chose for it, and where it is. */
  holding: string;
  tints: Record<string, string>;
  held: THREE.Object3D | null;
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
  /** The item they say they hold, and what is drawn for it. */
  heldItem?: string;
  held?: THREE.Object3D;
  /** The colours they say they chose for it. */
  tints?: Record<string, string>;
  /** Shown while they are being pointed out. */
  beam?: THREE.Sprite;
  beamUntil?: number;
  target: Pose | null;
  placed: boolean;
  /** Every material, with its normal opacity, for the personal-space fade. */
  materials: { material: THREE.Material; opacity: number }[];
  /** How much of them is shown, from 0 to 1, by how near they are. */
  near?: number;
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

  // ---- What people hold (protocol/17-items.md). Each visitor says only an item's coordinate. Everyone who sees
  // them fetches the description and the model for themselves, checks both, and draws it or draws nothing.
  const itemsRule = () => cleanItemsRule(d.itemsRule?.());
  const canBeHeld = (item: Item) => item.behaviors.includes("holdable") || item.fits.includes("hand-right") || item.fits.includes("hand-left");
  let mine = "";
  let mineModel: THREE.Object3D | null = null;
  let mineTints: Record<string, string> = {};
  /** Someone said the colours of what they hold: it is recoloured, and what they send out next is too. */
  const heardTints = (a: Avatar | undefined, said: string): void => {
    const described = a?.heldItem ? d.items?.known(a.heldItem) : null;
    const tints = parseTints(said);
    if (!a || !tints) return;
    // Before what they hold has been read, their words are kept as they are, and tidied when it is drawn.
    a.tints = described ? cleanTints(described, tints) : tints;
    if (described && a.held) applyTints(a.held, described, a.tints);
  };
  const sayTints = (): void => {
    if (mine) session?.tellPlay(buildTints(mineTints));
  };
  /** An item whose script this visitor was just asked about: a second press lets it run. */
  const askedScript = { sha: "" };
  const itemMutes = new Set<string>();
  /** In a headset the item is in a hand: the right, where there is one. */
  const hand = (): number => {
    if (!d.renderer.xr.isPresenting || !d.controllers.length) return -1;
    const sources = [...(d.renderer.xr.getSession()?.inputSources ?? [])];
    const right = sources.findIndex((s) => s.handedness === "right");
    return right >= 0 && right < d.controllers.length ? right : 0;
  };
  let inHand = -2;
  // ---- Where what they hold sits in their view, at a desk or on a phone, and bringing it up to the eye.
  /** Whether they are aiming along its sight, and how far the item has come up to the eye for it, from 0 to 1. */
  let sightWant = false;
  let sightK = 0;
  /** How wide they saw before they began to aim: put back when they stop. */
  let fovBase: number | null = null;
  const hip = new THREE.Vector3();
  const up = new THREE.Vector3();
  const endSight = () => {
    sightWant = false;
    sightK = 0;
    if (fovBase !== null) {
      d.camera.fov = fovBase;
      d.camera.updateProjectionMatrix();
      fovBase = null;
    }
    setAimScale(1);
  };
  /** Put what they hold where they see it from: in a hand in a headset, low and to the right of a screen. */
  const placeMine = (dt = 0) => {
    const now = hand();
    if (!mineModel) return;
    const described = mine ? (d.items?.known(mine) ?? null) : null;
    if (now < 0) {
      // Near enough to fill about a third of the height of the view, whatever its size: a thing in the hand, not a
      // speck in the corner. To the right, clear of the bar in the middle; and on a screen taller than it is wide,
      // where the bar runs the whole way across, above it.
      const size = described?.size ?? [0.2, 0.3, 0.2];
      const acts = !!described?.does.use;
      const tall1 = Math.tan(THREE.MathUtils.degToRad((fovBase ?? d.camera.fov) / 2));
      const narrow = d.camera.aspect < 1;
      // On a screen taller than it is wide there is less room across: it is a smaller share of the height there.
      const far = THREE.MathUtils.clamp(size[1] / (2 * tall1 * (narrow ? 0.24 : acts ? 0.4 : 0.3)), 0.4, 0.95);
      const tall = tall1 * far;
      const wide = tall * d.camera.aspect;
      hip.set(narrow ? wide * 0.5 : Math.min(wide * 0.6, wide - size[0] * 0.6), narrow ? -tall * 0.56 : -tall * 0.99, -far);
      const aim = described?.aim ?? null;
      sightK += ((sightWant && aim ? 1 : 0) - sightK) * (dt > 0 ? Math.min(1, dt * 14) : 1);
      if (aim) {
        // Up to the eye: the mark of its sight on the middle of the view, an arm's length off.
        up.set(-aim.at[0], -aim.at[1], -0.36 - aim.at[2]);
        mineModel.position.lerpVectors(hip, up, sightK);
        if (sightK > 0.002 || fovBase !== null) {
          fovBase ??= d.camera.fov;
          const share = THREE.MathUtils.lerp(1, Math.max(0.45, aim.zoom), sightK);
          d.camera.fov = fovBase * share;
          d.camera.updateProjectionMatrix();
          setAimScale(share);
          if (sightK <= 0.002 && !sightWant) endSight();
        }
      } else mineModel.position.copy(hip);
      // Something that is pointed is turned a little toward the middle, as a hand holds it.
      mineModel.rotation.set(0, acts ? 0.1 * (1 - sightK) : 0, 0);
    }
    if (now === inHand) return;
    inHand = now;
    if (now >= 0) {
      endSight();
      mineModel.rotation.set(0, 0, 0);
      mineModel.position.set(0, -0.06, 0.02);
      d.controllers[now]!.add(mineModel);
    } else d.camera.add(mineModel);
  };
  const play: Play | null = d.items
    ? createPlay({
        scene: d.scene,
        camera: d.camera,
        rig: d.rig,
        items: d.items,
        sounds: d.sounds ?? null,
        rule: () => itemsRule(),
        // Asked each time it matters: an engine's world says whether items' own logic runs after this is made.
        get scripts() {
          return d.itemScripts ?? false;
        },
        ...(d.deferredPlay ? { deferred: true } : {}),
        me: () => session?.self.pubkey ?? null,
        people: () =>
          [...avatars.values()]
            .filter((a) => a.target && a.root.visible)
            .map((a) => ({ pubkey: a.member.pubkey, head: a.head.getWorldPosition(new THREE.Vector3()), body: a.torso, over: a.head, root: a.root, holding: a.heldItem ?? "", held: a.held ?? null })),
        itemsMuted: (pubkey) => itemMutes.has(pubkey),
        tell: (said) => session?.tellPlay(said),
        tintsOf: (pubkey) => (pubkey === null ? mineTints : (avatars.get(pubkey)?.tints ?? {})),
        presenting: () => d.renderer.xr.isPresenting,
        sighting: () => (d.sighting ? d.sighting() : sightK > 0.5),
        ...(d.theme ? { theme: d.theme } : {}),
        // In a headset a thing goes where the hand that holds the item points.
        aim: () => {
          const i = hand();
          const c = i >= 0 ? d.controllers[i] : null;
          if (!c) return null;
          const from = c.getWorldPosition(new THREE.Vector3());
          return { from, to: from.clone().add(new THREE.Vector3(0, 0, -18).applyQuaternion(c.getWorldQuaternion(new THREE.Quaternion()))) };
        },
        ...(d.solid ? { solid: d.solid } : {}),
        ...(d.onStruck ? { onStruck: d.onStruck } : {}),
        onChange: () => changed(),
      })
    : null;
  const showHeld = async (a: Avatar | undefined, item: string) => {
    if (!a) return;
    // Their colours were for what they held before: what they hold now comes as its maker made it, until they say.
    if (a.heldItem !== item) delete a.tints;
    a.heldItem = item;
    a.held?.removeFromParent();
    delete a.held;
    // Nothing of anyone's is fetched or drawn where the world has no items, or the visitor has turned them off.
    if (!item || !d.items || itemsRule() === "none" || !showsItems()) return;
    const described = await d.items.describe(item);
    if (!described || a.heldItem !== item || !canBeHeld(described) || described.use === "granted") return;
    const model = await d.items.model(described, a.tints);
    if (a.heldItem !== item) return;
    // They may have said their colours while it was being fetched.
    if (a.tints) applyTints(model, described, a.tints);
    // At their right side, a little in front: where a hand that isn't being tracked rests.
    model.position.set(0.3, -0.12, -0.22);
    a.torso.add(model);
    a.held = model;
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
    // What they hold stays in their hand through a change of look.
    if (a.held) figure.torso.add(a.held);
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
    // A person is reached by what an item sends out as a simple shape (play.ts), never by their drawn figure.
    root.userData.nswpNoHit = true;
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
    play?.left(pubkey);
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
    s.on("holding", (m, item) => {
      void showHeld(avatars.get(m.pubkey), item);
      changed();
    });
    // What this visitor already holds is said to the room they have just joined.
    if (mine) s.setHolding(mine);
    s.on("play", (m, said) => (said.startsWith("tint:") ? heardTints(avatars.get(m.pubkey), said) : play?.heard(m.pubkey, said)));
    sayTints();
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
    get holding() {
      return mine;
    },
    get tints() {
      return mineTints;
    },
    setTints(tints) {
      const described = mine ? d.items?.known(mine) : null;
      if (!described) return;
      mineTints = cleanTints(described, tints);
      if (mineModel) applyTints(mineModel, described, mineTints);
      sayTints();
      changed();
    },
    async setHolding(itemIn, tints) {
      const item = itemCoordinate(itemIn);
      const put = () => {
        mine = "";
        mineModel?.removeFromParent();
        mineModel = null;
        inHand = -2;
        endSight();
        void play?.held(null, null);
        session?.setHolding("");
      };
      if (!item) {
        const had = !!mine;
        put();
        return { ok: true, said: had ? "Put away." : "You are holding nothing." };
      }
      if (!d.items) return { ok: false, said: "Nothing carried is drawn or works in this place." };
      // The same rules, and the same words, in every world whatever draws it (`mayHold`).
      const described = itemsRule() === "none" || !showsItems() ? null : await d.items.describe(item);
      const may = mayHold(described, { rule: itemsRule(), scripts: !!d.itemScripts, asked: askedScript });
      if (!may.ok || !described) return may.ok ? { ok: false, said: "That item's description couldn't be found." } : may;
      mineTints = cleanTints(described, tints ?? {});
      const model = await d.items.model(described, mineTints);
      put();
      mine = item;
      mineModel = model;
      placeMine();
      session?.setHolding(item);
      sayTints();
      await play?.held(described, model);
      return { ok: true, said: `You are holding ${described.title}. People here can see it.` };
    },
    get play() {
      return play;
    },
    get holdingHand() {
      return mine ? hand() : -1;
    },
    setSighting(on) {
      sightWant = on && !!mine && !d.renderer.xr.isPresenting;
    },
    get sighting() {
      return sightK > 0.5;
    },
    muteItems(pubkey, on) {
      if (on) itemMutes.add(pubkey);
      else itemMutes.delete(pubkey);
      changed();
    },
    isItemsMuted(pubkey) {
      return itemMutes.has(pubkey);
    },
    get itemsRule() {
      return itemsRule();
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
      placeMine(dt);
      const k = 1 - Math.exp(-dt * 14);
      d.camera.getWorldPosition(v);
      for (const a of avatars.values()) {
        if (!a.target) continue;
        // Personal space: nobody's avatar can fill your view.
        const near = THREE.MathUtils.clamp((a.head.position.distanceTo(v) - FADE_END) / (FADE_START - FADE_END), 0, 1);
        for (const m of a.materials) m.material.opacity = m.opacity * near;
        a.near = near;
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
      play?.update(dt);
    },
    drawn() {
      return [...avatars.values()]
        .filter((a) => a.target && a.placed && a.root.visible)
        .map((a) => ({
          pubkey: a.member.pubkey,
          name: a.member.name,
          opacity: a.near ?? 1,
          figure: a.figure,
          label: a.label,
          picture: a.picture ?? null,
          bubble: a.bubble ?? null,
          light: a.light?.visible ? a.light : null,
          beam: a.beam?.visible ? a.beam : null,
          holding: a.heldItem ?? "",
          tints: a.tints ?? {},
          held: a.held ?? null,
        }));
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
          // What they say they hold, and whether anything is drawn for it: for tests.
          holding: a.heldItem || null,
          heldDrawn: !!a.held,
          tints: a.tints ?? null,
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
