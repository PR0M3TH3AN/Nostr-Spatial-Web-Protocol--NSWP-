/**
 * "Messages", in the menu every world has: the visitor's private messages, and a conversation with one person
 * on a panel of its own (protocol/14-people-and-messages.md).
 *
 * The tab lists who they have been writing with, people they would expect first and requests from anyone else
 * apart. Choosing someone puts the conversation up: beside the room's chat on a flat screen, and on a panel of
 * the visitor's own in a headset, where it is written to with the headset's keyboard.
 *
 * Nothing is asked of a relay about the visitor until they have let this place handle their messages. Until then
 * the tab has one control, which asks them.
 */
import { shortNpub, MESSAGE_LIMITS } from "@nswp/core";
import * as THREE from "three";
import type { Messages } from "./messages.js";
import type { Panel, Panels } from "./panels.js";
import type { Profiles } from "./profiles.js";
import { wrapWords } from "./ui/chat.js";
import { ago } from "./ui/feed.js";
import type { Controls, UiAction } from "./ui/model.js";
import { rgb } from "./ui/theme.js";

/** What sends and reads private messages for the visitor (three.ts gives a world's; a visitor's own client gives its own). */
export interface MessagingHand {
  messages: Messages;
  /** The visitor's key here, or null: a guest has no messages. */
  pubkey(): string | null;
  /** Whether the visitor has let this place send and read their private messages. */
  allowed(): boolean;
  /** From a press: have the visitor asked. Returns what to say meanwhile; `then` is run once they have allowed it. */
  ask(then: () => void): string;
}

export interface MessagingOptions {
  hand: MessagingHand;
  profiles: Profiles;
  panels?: Panels | null;
  presenting?: () => boolean;
  /** How often new messages are looked for while this place has been let, in milliseconds. 0 for never. */
  everyMs?: number;
}

export interface Messaging {
  refresh(): void;
  /** Put the conversation with someone up, asking the visitor first where this place hasn't been let. */
  write(pubkey: string): void;
}

const W = 768;
const H = 900;
const LEAD = 130;
const WRITE = 100;

export function addMessagingControls(controls: Controls, opts: MessagingOptions): Messaging {
  const { hand, profiles } = opts;
  const m = hand.messages;
  let shown: string[] = [];
  /** Who the conversation that is up is with. */
  let withWhom: string | null = null;
  let requests = false;
  let wasMe: string | null = null;
  const nameOf = (pubkey: string) => profiles.get(pubkey)?.name || shortNpub(pubkey);
  const say = (text: string) => controls.say(text);
  const inHeadset = () => !!opts.presenting?.() && !!opts.panels;

  // ---- The conversation in a headset: a panel of the visitor's own. Where to write is at the bottom.
  let panel: { panel: Panel; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; drawn: string } | null = null;
  const closePanel = () => {
    const was = panel;
    panel = null;
    was?.texture.dispose();
    was?.panel.close();
  };
  const drawPanel = () => {
    if (!panel) return;
    const view = controls.letters.view();
    if (!view.ready) return closePanel();
    const stamp = `${view.version}:${Math.floor(Date.now() / 60000)}:${view.title}`;
    if (stamp === panel.drawn) return;
    panel.drawn = stamp;
    const t = controls.theme;
    const g = panel.canvas.getContext("2d")!;
    g.fillStyle = t.glass;
    g.fillRect(0, 0, W, H);
    g.textBaseline = "middle";
    g.textAlign = "left";
    const measure = (text: string) => g.measureText(text).width;
    g.fillStyle = t.ink;
    g.globalAlpha = 0.72;
    g.font = "27px system-ui, sans-serif";
    wrapWords(view.lead, measure, W - 56, 3).forEach((row, r) => g.fillText(row, 28, 26 + r * 33));
    g.globalAlpha = 1;
    // The one button, at the foot: it puts the keyboard up.
    const top = H - WRITE;
    g.strokeStyle = t.accent;
    g.lineWidth = 3;
    g.fillStyle = `rgba(${rgb(t.accent)}, 0.16)`;
    g.beginPath();
    g.roundRect(20, top + 8, W - 40, WRITE - 24, 22);
    g.fill();
    g.stroke();
    g.font = "600 34px system-ui, sans-serif";
    g.fillStyle = t.ink;
    g.textAlign = "center";
    g.fillText(wrapWords(`Write to ${view.with}`, measure, W - 80, 1)[0] ?? "Write", W / 2, top + 8 + (WRITE - 24) / 2);
    g.textAlign = "left";
    // The newest at the foot, and as many above it as there is room for.
    const ROW = 40;
    const nowSec = Math.floor(Date.now() / 1000);
    let y = top - 12;
    if (view.said) {
      g.font = "italic 28px system-ui, sans-serif";
      g.fillStyle = t.warn;
      const rows = wrapWords(view.said, measure, W - 56, 2);
      y -= rows.length * ROW;
      rows.forEach((row, r) => g.fillText(row, 28, y + ROW * (r + 0.5)));
    }
    if (!view.lines.length) {
      g.font = "italic 30px system-ui, sans-serif";
      g.fillStyle = t.ink;
      g.globalAlpha = 0.7;
      wrapWords(`Nothing yet. What you write here is for ${view.with} alone.`, measure, W - 56, 3).forEach((row, r) => g.fillText(row, 28, LEAD + ROW * (r + 0.5)));
      g.globalAlpha = 1;
    }
    for (let i = view.lines.length - 1; i >= 0; i--) {
      const line = view.lines[i]!;
      g.font = "32px system-ui, sans-serif";
      const rows = line.text.split("\n").flatMap((part) => wrapWords(part, measure, W - 56, 6)).slice(0, 8);
      const tall = (rows.length + 1) * ROW + 10;
      if (y - tall < LEAD) break;
      y -= tall;
      g.font = "600 26px system-ui, sans-serif";
      g.fillStyle = line.mine ? t.accent : t.ink;
      g.globalAlpha = line.state === "failed" ? 1 : 0.75;
      if (line.state === "failed") g.fillStyle = t.warn;
      g.fillText(`${line.mine ? "You" : line.who}  ·  ${line.state === "sending" ? "Sending…" : line.state === "failed" ? "Not sent" : ago(line.at, nowSec)}`, 28, y + ROW * 0.5);
      g.font = "32px system-ui, sans-serif";
      g.fillStyle = t.ink;
      g.globalAlpha = line.state === "sending" ? 0.6 : 1;
      rows.forEach((row, r) => g.fillText(row, 28, y + ROW * (r + 1.5)));
      g.globalAlpha = 1;
    }
    panel.texture.needsUpdate = true;
    controls.letters.seen();
  };
  const openPanel = () => {
    if (!opts.panels || panel) return;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    try {
      const made = opts.panels.open(
        {
          kind: "custom",
          title: controls.letters.view().title,
          texture,
          aspect: W / H,
          onPress: (_x, y) => {
            if (y < (H - WRITE) / H || !opts.panels) return;
            const view = controls.letters.view();
            void opts.panels.keyboard.ask({ title: `Write to ${view.with}. Only they can read it. Done sends it.`, maxLength: MESSAGE_LIMITS.chars, multiline: true }).then((text) => {
              const trouble = text ? controls.letters.send(text) : null;
              if (trouble) say(trouble);
            });
          },
          onClose: () => {
            if (panel?.texture === texture) panel = null;
            texture.dispose();
          },
        },
        { id: "private-messages", keep: false, place: { width: 0.46 }, pin: [-0.46, -0.04, -0.8] },
      );
      panel = { panel: made, canvas, texture, drawn: "" };
      drawPanel();
    } catch (err) {
      texture.dispose();
      say(err instanceof Error ? err.message.replace(/^nswp-sdk: /, "") : "The conversation couldn't be opened.");
    }
  };
  controls.subscribe(drawPanel);

  /** Put the conversation with someone up, wherever this visitor reads one. */
  const open = (pubkey: string) => {
    withWhom = pubkey;
    void profiles.fetch([pubkey]);
    controls.letters.attach({
      with: () => nameOf(pubkey),
      lines: () => m.thread(pubkey).map((x) => ({ key: x.id, mine: x.from !== pubkey, who: nameOf(x.from), text: x.text, at: x.at })),
      send: (text) => m.send(pubkey, text, profiles.get(pubkey)?.name ?? ""),
      seen: () => m.seen(pubkey),
    });
    if (inHeadset()) {
      closePanel();
      openPanel();
    } else controls.signal("open:letters");
    refresh();
  };

  const write = (pubkey: string) => {
    const me = hand.pubkey();
    if (!me) return say("Sign in to write to people: it is under You.");
    if (pubkey === me) return;
    const go = () => void m.load().then(() => open(pubkey));
    if (hand.allowed()) return go();
    say(hand.ask(go));
  };

  const refresh = () => {
    for (const id of shown) controls.remove(id);
    shown = [];
    const me = hand.pubkey();
    if (me !== wasMe) {
      wasMe = me;
      withWhom = null;
      requests = false;
      controls.letters.detach();
      closePanel();
    }
    const allowed = !!me && hand.allowed();
    const state = allowed ? m.state() : "off";
    const all = allowed ? m.conversations() : [];
    const known = all.filter((c) => c.known);
    const asking = all.filter((c) => !c.known);
    const add = (...actions: UiAction[]) => {
      for (const a of actions) shown.push(a.id);
      controls.add(...actions.map((a) => ({ section: "messages", ...a })));
    };
    controls.addSection({
      id: "messages",
      label: "Messages",
      icon: "chat",
      note: () =>
        !me
          ? "Sign in to read and send private messages."
          : !allowed
            ? "Private messages are between you and one other person. This place hasn't been let send or read yours: say so below, and your sign-in address asks you once."
            : state === "looking"
              ? "Looking for your messages."
              : state === "unreachable"
                ? "No relay could be reached to look for your messages."
                : state === "no-inbox"
                  ? "Nobody can write to you privately yet: you haven't said where messages should reach you. Say so below. It is a short public list of relays, and you can change it in any Nostr app."
                  : known.length === 0 && asking.length === 0
                    ? "No messages yet. Write to someone from Following, or from their card in People."
                    : "Only you and the other person can read a conversation. A relay is told who each message is for, and nothing more.",
    });
    // A guest has no messages: the tab has nothing in it, and isn't shown.
    if (!me) return;
    if (!allowed) {
      add({ id: "messages-let", icon: "check", tone: "primary", label: "Let me send and read private messages here", act: () => say(hand.ask(() => void m.load().then(refresh))) });
      return;
    }
    if (state === "no-inbox") {
      const hosts = m.offered().map((r) => r.replace(/^wss:\/\//, ""));
      add({
        id: "messages-setup",
        icon: "check",
        tone: "primary",
        label: `Have messages reach me at ${hosts.join(", ")}`,
        act: async () => {
          const done = await m.setUp();
          say(done.said);
          refresh();
        },
      });
      return;
    }
    add({ id: "messages-look", icon: "turn", label: "Look for new messages", short: "Look", act: () => void m.load(true).then(refresh) });
    const row = (c: (typeof all)[number]): UiAction => ({
      id: `messages-${c.with.slice(0, 16)}`,
      kind: "swatch",
      color: `#${c.with.slice(0, 6)}`,
      on: () => withWhom === c.with,
      label: () => `${nameOf(c.with)}${c.unread ? `, ${c.unread} new` : ""}`,
      act: () => open(c.with),
    });
    add(...known.slice(0, 40).map(row));
    if (asking.length) {
      add({
        id: "messages-requests",
        icon: "list",
        on: () => requests,
        label: `From people you don't follow: ${asking.length}`,
        act: () => {
          requests = !requests;
          refresh();
        },
      });
      if (requests) add(...asking.slice(0, 40).map(row));
    }
    // Names for whoever is listed.
    void profiles.fetch(all.slice(0, 60).map((c) => c.with));
  };

  let drawing = false;
  const soon = () => {
    if (drawing) return;
    drawing = true;
    queueMicrotask(() => {
      drawing = false;
      refresh();
      controls.letters.touch();
    });
  };
  m.onChange(soon);
  profiles.onChange(soon);
  // Word of a new message, from someone they would expect: said once, wherever they are looking.
  m.onNew((message) => {
    const from = message.from;
    if (from === withWhom) return;
    if (m.conversations().find((c) => c.with === from)?.known) {
      say(`${nameOf(from)} wrote to you privately. It is in Messages.`);
      controls.signal("message");
    }
  });
  const every = opts.everyMs ?? 60_000;
  if (every > 0 && typeof setInterval === "function") {
    setInterval(() => {
      if (hand.pubkey() && hand.allowed() && (typeof document === "undefined" || document.visibilityState === "visible")) void m.load();
    }, every);
  }
  if (hand.pubkey() && hand.allowed()) void m.load();
  refresh();
  return { refresh, write };
}
