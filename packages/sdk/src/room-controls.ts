/**
 * The room's part of the menu: joining and leaving, the microphone, chat, the list of who is here and a card for
 * each, screens and music shared, blocking, and the visitor's public feed. It asks a `Presence` and never a
 * renderer, so it is the same in a world drawn with Three.js and in one made with another engine.
 */
import * as THREE from "three";
import { mayShareScreen, screenNotHere } from "./client-frame.js";
import { CHAT_LIMITS, cleanLightningAddress, DEFAULT_RELAYS, guestName, DELETION_KIND, encodeNpub, shortNpub, verifyEvent, type NostrEvent, type SignerMore } from "@nswp/core";
import { askOwn, relaysOf, sendWell } from "./relay-book.js";
import { type Member, type RoomSession } from "./room.js";

import type { Controls } from "./ui/model.js";
import { signInFirst } from "./ui/sign-in-here.js";
import { filesAnywhere, setFilesAnywhere } from "./file-hosts.js";
import { chatSwitch, modelsSwitch, picturesSwitch } from "./visitor-switches.js";
import { showsPictures } from "./picture.js";
import { onChatChange, showsChat, wrapWords } from "./ui/chat.js";
import { ago, FEED_LIMITS, type FeedSource } from "./ui/feed.js";
import { rgb } from "./ui/theme.js";
import { addFollowingControls, type Following, type FollowingHand } from "./following.js";
import { createMessages } from "./messages.js";
import type { PersonLines } from "./person-lines.js";
import { addMessagingControls, type Messaging, type MessagingHand } from "./messaging.js";
import { hereAs, onHereAs, signerNamed, unansweredWords, worldPeople, worldSigner } from "./ui/identity.js";
import type { Panel, Panels } from "./panels.js";
import type { Sounds } from "./sound.js";
import { LEVEL_WORDS, levelStep, nextLevel } from "./sound-store.js";

import type { Presence } from "./presence.js";
import { wasRefreshed } from "./stay.js";

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
  /** Whether that is a panel in the visitor's client rather than a window (signer.ts, `panel`). */
  panel?(): boolean;
  /**
   * Put a note of a careful kind to the visitor themselves, at their sign-in address (signer.ts, `propose`): what
   * deleting a post takes. Left out where nothing can ask them, and then no post offers to be deleted.
   */
  propose?(note: { kind: number; content: string; tags: string[][] }): Promise<NostrEvent | null>;
  /** Where that happens, as an address to name, or null. */
  host?(): string | null;
  /** A signer was named and didn't answer: then what to say about it. Null when that isn't so. */
  unanswered?(): string | null;
  /** Whose key signs, once it can: their feed is that key's posts. Left out, the feed shows only what is sent from here. */
  pubkey?(): string | null;
  /** What to call them over their feed: their name, or null for the short form of their key. */
  who?(): string | null;
  /**
   * The site each post is marked with by whatever signs it, as a host to name, or null for none. A client whose
   * sign-in marks what it signs says so here, and the visitor is told where they write.
   */
  marked?(): string | null;
}

/** What follows and unfollows someone for the visitor: from a person's card in a room, and in Following (protocol/14-people-and-messages.md). */
export type RoomFollows = FollowingHand;

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
    /**
     * The usual relays: where the visitor's own relay list is looked for, and where a post goes when they have
     * published none (or too thin a one). Left out, the kit's own list. A post goes to the relays the visitor
     * says they write to (NIP-65), and their earlier posts are read from the same.
     */
    noteRelays?: string[];
    /**
     * What signs a post when the visitor sends one out. Left out, the page's own signer: the hidden one
     * their client named, unlocked in that client's window (`worldSigner()`), which is what a world has. A
     * visitor's own client, in a room of its own where they are already signed in, gives its own.
     */
    notes?: RoomNotes;
    /**
     * What follows and unfollows someone when the visitor asks (protocol/14-people-and-messages.md). Left out,
     * the page's own signer, once the visitor has let this world do so. A visitor's own client gives its own.
     */
    follows?: RoomFollows;
    /**
     * What sends and reads the visitor's private messages (protocol/14-people-and-messages.md). Left out, the
     * page's own signer, once the visitor has let this world do so. A visitor's own client gives its own.
     */
    messages?: MessagingHand;
    /**
     * A few lines about someone, for their card in People and in Following: where they stand on this world's
     * boards, which of its achievements they show (person-lines.ts). Left out, a card says nothing of that.
     */
    about?: PersonLines | null;
    /** Whether the visitor is in a headset: a window that opens can't be seen from in there. */
    presenting?: () => boolean;
    /**
     * What sends a tip when the visitor asks (docs/plans/paying-for-things.md, 7.5): a person, by their key, or
     * with no `to` this place itself. Left out, the page's own signer, which puts it to the visitor at their
     * sign-in address. A visitor's own client gives its own. Resolves whether it went, and never why not. Null
     * where nothing here can send one: then no tip is offered at all.
     */
    tip?: ((o: { to?: string; sats: number }) => Promise<boolean>) | null;
    /**
     * Whether this place takes tips. Left out, it is read from the place's own `/.well-known/nswp.json`, which
     * names an address for them (`tip`) if it does: the same file the visitor's sign-in address reads the address
     * from. The address itself is never passed here. False for a place that should offer no such row.
     */
    tipsWorld?: boolean;
  } = {},
): { refresh(): void; travelling(): Travelling; following: Following; messaging: Messaging } {
  const useTone = new URLSearchParams(opts.search ?? location.search).get("mic") === "tone";
  // For tests: a drawn picture that changes, in place of the browser's screen picker.
  const useTestScreen = new URLSearchParams(opts.search ?? location.search).get("screen") === "test";
  const canShare = useTestScreen || typeof navigator.mediaDevices?.getDisplayMedia === "function";
  // In another site's frame the browser may refuse this page the screen whatever is pressed. Where it says so, the
  // row is not offered and two lines say why. Where it doesn't say, the row stays and a refusal says what may be why.
  const mayShare = useTestScreen ? true : mayShareScreen();
  const notHere = screenNotHere();
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
    const now = Date.now();
    const lost = [...unreachedAt.values()].filter((at) => now - at < UNREACHED_HELD_MS).length;
    const reached = s.status === "no-relays" ? "can't reach any relay" : others === 0 ? (lost ? "nobody else connected" : "nobody else here yet") : others === 1 ? "1 other person here" : `${others} other people here`;
    const who = lost && s.status !== "no-relays" ? `${reached}, and ${lost === 1 ? "1 person" : `${lost} people`} couldn't be reached` : reached;
    const thin = thinRelays && s.status !== "no-relays" && s.relays.length >= 2 && s.relayCount < 2 ? ` ${relaysWords(s)}` : "";
    // Say how the others see this visitor: by a name their own client vouched for, or as a guest.
    const as = s.self.guest ? "" : ` You are here as ${s.self.name}.`;
    return `${presence.roomName ? "Private room" : s.name.startsWith("lobby-") ? `Open room, ${s.name.replace(/^lobby-/, "Lobby ")}` : "Open room"}: ${who}.${thin}${as}${presence.micOn ? " Your microphone is on." : ""}${presence.musicOn ? ` Your music is offered to people near you: ${presence.musicListeners === 0 ? "nobody is hearing it" : presence.musicListeners === 1 ? "1 person is hearing it" : `${presence.musicListeners} people are hearing it`}.` : ""}${presence.screenOn ? ` You are sharing your screen: ${presence.screenViewers === 0 ? "nobody is watching" : presence.screenViewers === 1 ? "1 person is watching" : `${presence.screenViewers} people are watching`}.` : ""}`;
  };
  // ---- Following (protocol/14-people-and-messages.md). A world follows for its visitor only once they have let
  // it, at their own sign-in address. So the first press here says what is wanted and opens that address's window;
  // what they pressed is done when the answer comes back.
  /**
   * Ask the visitor to let this world do one thing more: say what is wanted, and open their sign-in address's
   * window, from the press that needed it. What they pressed is done when their answer comes back.
   */
  const waitingFor = new Map<SignerMore, { then: () => void; at: number }>();
  let watchingSigner = false;
  const askSigner = (what: SignerMore, to: string, then: () => void): string => {
    const signer = worldSigner();
    if (!watchingSigner) {
      watchingSigner = true;
      signer.onChange(() => {
        for (const [name, was] of [...waitingFor]) {
          if (!signer.more.includes(name)) continue;
          waitingFor.delete(name);
          // A say-so that comes long after the press isn't acted on: they may have forgotten what they pressed.
          if (Date.now() - was.at < 300_000) was.then();
        }
      });
    }
    const where = signer.host ?? "your sign-in address";
    // A sign-in address that says what it offers, and doesn't offer this: its window would have nothing to ask.
    if (signer.offers && !signer.offers.includes(what)) return `${where} doesn't let a world ${to} yet. It can be done at your home.`;
    if (opts.presenting?.()) return `This world needs your say before it can ${to}, once. ${where} asks that itself, which can't be seen from in here. Step out of the headset and press this again.`;
    waitingFor.set(what, { then, at: Date.now() });
    // Everything they have let it do already is asked for again beside it: an answer is for the whole of it.
    signer.want([...signer.more, what]);
    const here = signer.panel;
    return signer.unlock() ? (here ? `This world needs your say before it can ${to}: once. ${where} is asking, here.` : `This world needs your say before it can ${to}: once, in the window of ${where} that has opened.`) : `The window of ${where} couldn't be opened. Allow this site to open windows, and press again.`;
  };
  const signedInHere = () => (signerNamed() && worldSigner().state === "unlocked" ? worldSigner().pubkey : null);
  const worldFollows = (): RoomFollows => ({
    people: worldPeople(),
    pubkey: signedInHere,
    allowed: () => worldSigner().more.includes("follows"),
    ask: (then) => askSigner("follows", "change who you follow", then),
  });
  const worldMessages = (): MessagingHand => ({
    messages: createMessages({
      hand: {
        pubkey: signedInHere,
        ready: () => worldSigner().more.includes("messages"),
        seal: (to, text) => worldSigner().seal(to, text),
        open: (wrap) => worldSigner().unwrap(wrap),
        reach: (relays) => worldSigner().reach(relays),
      },
      known: (pubkey) => !!follows().people.follows()?.includes(pubkey),
      ...(opts.noteRelays ? { relays: opts.noteRelays } : {}),
    }),
    pubkey: signedInHere,
    allowed: () => worldSigner().more.includes("messages"),
    ask: (then) => askSigner("messages", "send and read your private messages", then),
  });
  let followsKept: RoomFollows | null = null;
  const follows = (): RoomFollows => (followsKept ??= opts.follows ?? worldFollows());
  // ---- Tips (docs/plans/paying-for-things.md, 7.5 and 7.6). A world says who and how much, and nothing else: the
  // visitor's sign-in address finds where the money goes, shows them, and pays at their press there. Nothing is
  // owned afterwards, and nobody takes a share. Three amounts and no more: a row to type a number in is a row a
  // headset can't use, and the visitor's own limit is theirs to keep at their sign-in address.
  const TIP_AMOUNTS = [21, 100, 500] as const;
  const tipper = opts.tip === null ? null : (opts.tip ?? ((o: { to?: string; sats: number }) => worldSigner().tip(o)));
  /** Whose amounts are showing: a person's key, "world", or nobody's. */
  let tipping: string | null = null;
  const sendTip = (to: string | null, name: string, sats: number): void => {
    const host = notes.host?.() ?? worldSigner().host ?? "your sign-in address";
    // A headset draws nothing but the world, so the page that asks them can't be seen from in one.
    if (opts.presenting?.() ?? presence.presenting) return tell(`${host} has to ask you this itself, which can't be seen from in here. Step out of the headset and press this again.`);
    tipping = null;
    tell(`${host} is asking: ${sats} sats to ${name}. Say yes there, and it goes.`);
    if (!tipper) return;
    void tipper({ sats, ...(to ? { to } : {}) })
      .catch(() => false)
      .then((went) => tell(went ? `${sats} sats went to ${name}.` : `The tip to ${name} didn't go.`));
    refresh();
  };
  /** The rows for tipping someone: one to say so, and under it the amounts, shown only once it is pressed. */
  const tipRows = (key: string, section: string, to: string | null, name: string, ask: string): { id: string }[] => {
    const rows: { id: string }[] = [{ id: `${key}-tip` }];
    controls.add({
      id: `${key}-tip`,
      section,
      icon: "key",
      on: () => tipping === (to ?? "world"),
      label: ask,
      short: "Tip",
      act: () => {
        tipping = tipping === (to ?? "world") ? null : (to ?? "world");
        refresh();
      },
    });
    if (tipping === (to ?? "world")) {
      for (const sats of TIP_AMOUNTS) {
        rows.push({ id: `${key}-tip-${sats}` });
        controls.add({ id: `${key}-tip-${sats}`, section, icon: "check", label: `${sats} sats to ${name}`, act: () => sendTip(to, name, sats) });
      }
    }
    return rows;
  };
  /** Whether this place takes tips: as it was told, or as its own file says, once that has been read. */
  let takesTips = opts.tipsWorld ?? false;
  if (opts.tipsWorld === undefined && typeof fetch === "function") {
    void fetch("/.well-known/nswp.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((file: { tip?: unknown } | null) => {
        takesTips = !!cleanLightningAddress(file?.tip);
        if (takesTips) refresh();
      })
      .catch(() => undefined);
  }
  /** The world's own tip rows, taken away and put back as they open and close. */
  let worldTipRows: string[] = [];
  const tendWorldTip = (): void => {
    for (const id of worldTipRows) controls.remove(id);
    worldTipRows = [];
    // Only for someone signed in here: a tip is paid from their own wallet, at their sign-in address.
    if (!tipper || !takesTips || !follows().pubkey()) return;
    worldTipRows = tipRows("world", "travel", null, "this world", "Tip this world").map((r) => r.id);
  };
  // Who they follow, in a tab of its own: the same in every world and at their home (following.ts).
  const following = addFollowingControls(controls, {
    follows: follows(),
    ...(opts.noteRelays ? { relays: opts.noteRelays } : {}),
    keyboard: () => opts.panels?.keyboard ?? null,
    ...(opts.presenting ? { presenting: opts.presenting } : {}),
    ...(opts.about ? { about: opts.about } : {}),
    more: (who) => [{ id: "following-write", icon: "chat", label: `Write to ${who.name}, privately`, act: () => messaging.write(who.pubkey) }],
  });
  // Their private messages, in a tab of their own, and a conversation on its own panel (messaging.ts).
  const messaging: Messaging = addMessagingControls(controls, {
    hand: opts.messages ?? worldMessages(),
    profiles: following.profiles,
    panels: opts.panels ?? null,
    ...(opts.presenting ? { presenting: opts.presenting } : {}),
  });
  // Signed in, signed out, or let do more: what the tabs offer changes with it.
  if (signerNamed()) {
    worldSigner().onChange(() => {
      if (!opts.follows) following.refresh();
      if (!opts.messages) messaging.refresh();
    });
  }
  const followPress = (key: string, name: string, adding: boolean) => following.press(key, name, adding);

  const refresh = () => {
    const s = presence.session;
    opts.onState?.(
      s ? { name: s.name, private: !!presence.roomName, status: s.status, self: s.self.pubkey, members: s.members.map((m) => m.pubkey), relays: s.relayCount, mic: presence.micOn, screen: presence.screenOn, music: presence.musicOn, musicListeners: presence.musicListeners, sharing: s.members.filter((m) => m.sharing).map((m) => m.pubkey), watching: [...watching.keys()] } : null,
    );
    controls.addSection({ id: "room", label: "Room", icon: "room", note: status });
    tendChat();
    tendFeed();
    people();
    tendWorldTip();
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
  controls.add(picturesSwitch(controls));
  // Whether this visitor sees people's own models, where this world draws them (protocol/05-looks.md). Theirs, and it travels.
  if (presence.drawsModels())
    controls.add(modelsSwitch(controls));
  // Where other people's files may be fetched from (protocol/17-items.md, "Where a file is fetched from"). Off, only
  // from the file hosts on the visitor's own list. Theirs, and it goes with them.
  controls.add({
    id: "files-anywhere",
    section: "people",
    icon: "link",
    on: () => filesAnywhere(),
    label: () => (filesAnywhere() ? "Load people's files from anywhere: on" : "Load people's files from anywhere: off"),
    short: "Files",
    act: () => {
      setFilesAnywhere(!filesAnywhere());
      controls.say(
        filesAnywhere()
          ? "What people carry is fetched from wherever they keep it, in this place. The place that keeps a file learns your address, and when you were near it: anyone can choose that place. It stays off in other places until you turn it on there."
          : "People's files are fetched only from the file hosts you already use. Anything kept elsewhere is shown as a plain box.",
      );
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
              ? "What they say about themselves is their own words. Muting and blocking are yours alone: nobody is told. Who you follow is public."
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
            // What they have done here, as they say. Only someone who came by name has anything to show.
            ...(who.identity ? (opts.about?.lines(who.identity) ?? []) : []),
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
    // Following them (protocol/14-people-and-messages.md): only someone who came by name can be followed, and
    // only by a visitor who is signed in here. It is their own Nostr follow list that changes, the same one every
    // other Nostr client reads. The first time in a world, their sign-in address asks whether this world may.
    const me = follows().pubkey();
    if (who?.identity && me && who.identity !== me) {
      const them = who.identity;
      const people = follows().people;
      // Who they follow is looked for only where they have let this place change it: until then nothing is asked
      // of a relay about them, and the control says "Follow".
      if (follows().allowed() && people.follows() === null) void people.load().then(() => refresh());
      extras.push("person-follow");
      controls.add({
        id: "person-follow",
        section: "people",
        icon: "check",
        on: () => people.isFollowing(them) === true,
        label: () => (people.isFollowing(them) ? `Unfollow ${who.name}` : `Follow ${who.name}`),
        act: () => followPress(them, who.name, !people.isFollowing(them)),
      });
    }
    // Writing to them privately: to someone who came by name, from a visitor who is signed in.
    if (who?.identity && me && who.identity !== me) {
      const them = who.identity;
      extras.push("person-write");
      controls.add({ id: "person-write", section: "people", icon: "chat", label: `Write to ${who.name}, privately`, act: () => messaging.write(them) });
      // A tip to them: to someone who came by name (their key is what their sign-in address is asked about).
      if (tipper) for (const row of tipRows("person", "people", them, who.name, `Send ${who.name} a tip`)) extras.push(row.id);
    }
    if (who) {
      extras.push("person-mute", "person-music", "person-block");
      // Someone wearing a model of their own may be drawn as their simple look instead, for this visitor alone.
      if (who.model && presence.drawsModels()) {
        extras.push("person-simple");
        controls.add({
          id: "person-simple",
          section: "people",
          icon: "look",
          on: () => presence.isSimple(who.pubkey),
          label: () => (presence.isSimple(who.pubkey) ? `Show ${who.name}'s own model` : `Show ${who.name} as their simple look`),
          act: () => {
            const now = !presence.isSimple(who.pubkey);
            presence.showSimple(who.pubkey, now);
            controls.say(now ? `${who.name} is drawn as their simple look for you. They aren't told.` : `${who.name} is drawn as their own model again.`);
          },
        });
      }
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
        // What their items do, in a place that only allows items: muted, they can't reach this visitor, and none of
        // it is seen or heard. Where items are the game, nobody is out of their reach, and this isn't offered.
        ...(presence.itemsRule === "allowed"
          ? [
              {
                id: "person-mute-items",
                section: "people",
                icon: "close" as const,
                on: () => presence.isItemsMuted(who.pubkey),
                label: () => (presence.isItemsMuted(who.pubkey) ? `Unmute ${who.name}'s items` : `Mute ${who.name}'s items`),
                act: () => {
                  const now = !presence.isItemsMuted(who.pubkey);
                  presence.muteItems(who.pubkey, now);
                  controls.say(now ? `What ${who.name}'s items do can't reach you, and you won't see or hear it. They aren't told.` : `${who.name}'s items are no longer muted.`);
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
  /**
   * The people here who couldn't be connected to, and when that was last said of them. A room says it again after
   * each failed try (about every 45 seconds while they are here), so one not heard of for a while has gone.
   */
  const unreachedAt = new Map<string, number>();
  const UNREACHED_HELD_MS = 90_000;
  /** How long a room's relays are given to answer before fewer than two of them is said. */
  const RELAYS_SETTLE_MS = 10_000;
  /** This room reached fewer than two of its relays when they were looked at (and is said to while it lasts). */
  let thinRelays = false;
  const relaysWords = (s: RoomSession) => `Only ${s.relayCount} of ${s.relays.length} room relays answered here; people may not find you.`;
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
    unreachedAt.clear();
    thinRelays = false;
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
      // Someone here who couldn't be connected to (room.ts, `unreached`): said once for each, and counted in the
      // room's line while they are still being tried, so "in the room" is never all it says.
      s.on("unreached", (pubkey) => {
        if (chatFor !== s) return;
        const first = !unreachedAt.has(pubkey);
        unreachedAt.set(pubkey, Date.now());
        if (first) tell(`Someone else is here (${guestName(pubkey)}), but your computers couldn't connect directly. Trying again.`);
        refresh();
      }),
      s.on("member", (m) => {
        if (unreachedAt.delete(m.pubkey)) refresh();
      }),
    );
    // A room that reached fewer than two of its relays, once they have had time to answer: others reaching other
    // relays may never find this visitor, so it is said, once, and kept in the room's line while it lasts.
    const relaysLook = setTimeout(() => {
      if (chatFor !== s || s.status === "no-relays" || s.relays.length < 2 || s.relayCount >= 2) return;
      thinRelays = true;
      tell(relaysWords(s));
      refresh();
    }, RELAYS_SETTLE_MS);
    chatStops.push(() => clearTimeout(relaysLook));
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
    panel: () => worldSigner().panel,
    propose: (n) => worldSigner().propose(n),
    host: () => worldSigner().host,
    unanswered: () => (worldSigner().unanswered ? unansweredWords(worldSigner()) : null),
    pubkey: () => worldSigner().pubkey,
    who: () => hereAs()?.name || worldSigner().name,
  };
  const usualRelays = () => opts.noteRelays ?? DEFAULT_RELAYS;
  /**
   * Where this visitor's posts go and are read from: the relays they say they write to, in their own relay list
   * (NIP-65, kind 10002), by the relay book's rules for a person's list (relay-book.ts, `relaysOf`): asked for
   * when they open their feed or send a post, kept on the device once known, a miss never kept. Like their posts,
   * it is their own key's, asked of a relay only then.
   */
  const ownRelays = (key: string | null | undefined): Promise<string[]> => (key ? relaysOf(key, { usual: usualRelays(), mine: true }) : Promise.resolve([]));
  /** They pressed the row while signed out: once they are signed in, their feed is what they asked for. */
  let wantsFeed = false;
  const postNote = async (words: string): Promise<{ ok: boolean; said: string; id?: string }> => {
    const signed = await notes.sign({ kind: 1, content: words, tags: [] }).catch(() => null);
    // Whatever signed it, what is sent on is checked first: a real signature, on a note, saying what was written.
    const note = signed && verifyEvent(signed) && signed.kind === 1 && signed.content === words ? signed : null;
    if (!note) return { ok: false, said: "That wasn't sent: your sign-in said no." };
    // Their own relays, the ones that have been answering first, and a few of the usual ones if too few of theirs
    // are up (relay-book.ts).
    const to = await sendWell(note, { own: await ownRelays(note.pubkey), usual: usualRelays() }).catch(() => null);
    const kept = to?.took ?? 0;
    // Whose relays they were is said: their own list's, or the usual ones for someone who has published none.
    const n = to?.relays.length ?? 0;
    const own = to?.own ?? 0;
    const where = own === n ? `${kept} of your ${n} relays` : own ? `${kept} of ${n} relays: yours, and the usual ones because too few of your own were answering` : `${kept} of the ${n} usual relays: you have published no relay list of your own`;
    return kept ? { ok: true, said: `Sent out, to ${where}. Anyone can read it now.`, id: note.id } : { ok: false, said: "Signed, but no relay took it. It wasn't sent." };
  };
  /**
   * Delete one of their own posts (NIP-09): a deletion they sign themselves. No world's signer signs one on a
   * world's word, so it is put to them at their sign-in address, which shows them what it is (protocol/10-identity.md,
   * "Asking the person"), and sent to the relays their posts go to. A relay may honour it; a copy elsewhere may stay.
   */
  const removeNote = async (id: string): Promise<{ ok: boolean; said: string }> => {
    const host = notes.host?.() ?? "your sign-in address";
    // A headset draws nothing but the world, so the page that asks them can't be seen from in one.
    if (presence.presenting) return { ok: false, said: `Not deleted: ${host} has to ask you this itself, which can't be seen from in here. Step out of the headset and press Delete again.` };
    const key = notes.pubkey?.();
    const signed = await notes.propose?.({ kind: DELETION_KIND, content: "", tags: [["e", id], ["k", "1"]] }).catch(() => null);
    // Whatever signed it, what is sent on is checked first: a real signature, by them, deleting this post and nothing else.
    const names = signed ? signed.tags.filter((t) => t[0] === "e" || t[0] === "a") : [];
    const note = signed && verifyEvent(signed) && signed.kind === DELETION_KIND && (!key || signed.pubkey === key) && names.length === 1 && names[0]![1] === id ? signed : null;
    if (!note) return { ok: false, said: `Not deleted: ${host} didn't sign it. Either you said no there, or it can't do this yet.` };
    const to = await sendWell(note, { own: await ownRelays(note.pubkey), usual: usualRelays() }).catch(() => null);
    const kept = to?.took ?? 0;
    return kept ? { ok: true, said: `Deleted: ${kept} ${kept === 1 ? "relay was" : "relays were"} asked to drop it. A copy kept somewhere else may remain.` } : { ok: false, said: "Signed, but no relay took it. It wasn't deleted." };
  };
  /**
   * The visitor's own posts, asked of the relays their posts go to. This is the one thing a world asks a relay
   * about a person, and it is the visitor's own key, in their own browser, when they open their own feed.
   */
  const loadPosts = async (): Promise<FeedSource[] | null> => {
    const key = notes.pubkey?.();
    if (!key) return [];
    // Their posts get the first look of a person's own note (their relays and the usual ones, "none" never on one
    // relay's word), and not the waves: a feed is opened often, and has nothing to put back.
    const got = await askOwn({ kinds: [1], authors: [key], limit: FEED_LIMITS.kept }, key, { usual: usualRelays(), timeoutMs: 5000 });
    if (!got.events.length && got.state === "unreached") return null;
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
    // A world's signer marks each note with the world that asked. A client signing in its own room says whether
    // its sign-in marks what it signs, and with what.
    controls.feed.attach({ who: () => notes.who?.() || (key ? shortNpub(key) : "you"), marked: opts.notes ? (opts.notes.marked?.() ?? "") : location.host, send: postNote, load: loadPosts, ...(notes.propose ? { remove: removeNote } : {}) });
  };
  /** The feed in a headset: the same posts, on a panel of the visitor's own. Where to write is at the top. */
  const drawFeedPanel = () => {
    if (!feedPanel) return;
    const view = controls.feed.view();
    const stamp = `${view.version}:${Math.floor(Date.now() / 60000)}:${view.lead}`;
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
    g.font = "27px system-ui, sans-serif";
    wrapWords(view.lead, measure, CHAT_W - 56, 4).forEach((row, r) => g.fillText(row, 28, 24 + r * 33));
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
      g.fillText(post.state === "sending" ? "Sending…" : post.state === "failed" ? "Not sent" : post.state === "removing" ? "Deleting…" : ago(post.at, nowSec), 28, y + 20);
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
  if (signerNamed()) {
    worldSigner().onChange(() => void asWhoTheyAre());
    // A pass from the signer arrives a moment after signing in: then the room sees them by name.
    onHereAs(() => {
      void asWhoTheyAre();
      refresh();
    });
  }

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
        const here = !!notes.panel?.();
        wantsFeed = !!notes.unlock?.();
        tell(
          wantsFeed
            ? here
              ? `${host} is asking, here. Sign in there if it asks, and say yes. Then your public feed opens.`
              : `A window from ${host} has opened. Sign in there if it asks, and say yes. Then your public feed opens here.`
            : `Your browser didn't let a window open. Allow pop-ups for this site and press this again. Nothing is typed in this world: ${host} asks.`,
        );
      },
    },
    chatSwitch(tell),
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
          const why = `Couldn't join: ${err instanceof Error ? err.message : String(err)}`;
          // A room only for people who are signed in: signing in starts there and then, as from You.
          if (/Sign in, then join\.$/.test(why)) {
            last = why;
            signInFirst(controls, why);
          } else tell(why);
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
      hidden: () => !presence.session || !canShare || mayShare === false,
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
          tell(mayShare === null ? `Nothing was shared. ${notHere[0]} ${notHere[1]}` : "Nothing was shared.");
        }
        refresh();
      },
    },
    // Where this page is in a frame that doesn't hand the screen down: said, in place of a row that could only fail.
    { id: "room-screen-not-here", section: "room", kind: "line", icon: "panel", label: notHere[0], hidden: () => !presence.session || !canShare || mayShare !== false, act: () => {} },
    { id: "room-screen-how", section: "room", kind: "line", icon: "link", label: notHere[1], hidden: () => !presence.session || !canShare || mayShare !== false, act: () => {} },
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
    following,
    messaging,
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
