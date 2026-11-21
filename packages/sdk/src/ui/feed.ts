/**
 * My public feed: the visitor's own Nostr posts, and the place to send out
 * another, as the controls hold it (protocol/10-identity.md, "Posting from a
 * world").
 *
 * This is not the room's chat, and is kept apart from it on purpose. What is
 * written to the room goes to the people in it and is kept nowhere. What is
 * sent out here is public: anyone can read it, anywhere, and it can't be
 * taken back. So it has a window of its own, with its own name, showing what
 * the visitor has already posted: it is plain what kind of place it is.
 *
 * The room fills it (three.ts): it is there once there is something that
 * signs for the visitor, and gone when there isn't. Every renderer draws it.
 * The posts are fetched when the visitor opens it, and not before: nothing is
 * asked of a relay on a visitor's behalf until they ask to see it.
 */
import { CHAT_LIMITS, cleanChat, cleanLine } from "@nswp/core";

/** How much of a post is shown, and how many of them. A post written elsewhere may be long. */
export const FEED_LIMITS = { shown: 420, kept: 30 } as const;

/** One post in the feed. */
export interface FeedPost {
  /** Tells it from every other post here. */
  key: string;
  text: string;
  /** When it was posted, in seconds. */
  at: number;
  /** "out": it is on a relay. "sending": on its way. "failed": it wasn't sent. "removing": its deletion is being asked for. */
  state: "out" | "sending" | "failed" | "removing";
  /** The note's own id, once it is known: what a deletion names. */
  id?: string;
}

export interface FeedView {
  /** There is a feed: something signs for the visitor here. */
  ready: boolean;
  /** What the window is called. */
  title: string;
  /** Whose feed it is, as words: their name, or the short form of their key. */
  who: string;
  /** Newest first. */
  posts: FeedPost[];
  /** The posts are being asked for. */
  loading: boolean;
  /** How the last thing sent, or the asking, went, in a few words. "" for nothing to say. */
  said: string;
  /** What the window says where they write: that it is public, as whom, and how a post is marked. */
  lead: string;
  /** The most characters in one post written here. */
  limit: number;
  /** A post here can be asked to be deleted: the visitor's sign-in address can be asked to sign that. */
  removable: boolean;
  /** Goes up whenever anything above changes. */
  version: number;
}

/** A post as it comes from wherever posts come from. */
export interface FeedSource {
  id: string;
  text: string;
  at: number;
}

export interface FeedOptions {
  /** Whose feed: their name, or the short form of their key. A function is asked each time: a name may arrive late. */
  who: string | (() => string);
  /**
   * The site every post sent from here is marked with, or "" for none. A world's signer marks each note with
   * the world that asked (protocol/10-identity.md, "Signing from a world"), and the visitor is told so.
   */
  marked?: string;
  /** Sign and send what they wrote. Resolves to a few words on how it went, whether it did, and the note's id if it went. */
  send(text: string): Promise<{ ok: boolean; said: string; id?: string }>;
  /**
   * Ask for one of their posts to be deleted, by the note's id: a deletion they sign themselves, at their own
   * sign-in address (protocol/10-identity.md, "Asking the person"). Left out where nothing can ask them.
   */
  remove?(id: string): Promise<{ ok: boolean; said: string }>;
  /** Their posts so far, or null if they couldn't be had. */
  load?(): Promise<FeedSource[] | null>;
}

export interface UiFeed {
  /** There is something to post with now. */
  attach(opts: FeedOptions): void;
  /** There isn't any more: what was shown is put away. */
  detach(): void;
  /** The visitor is looking at it: their posts are asked for, if they haven't been lately. */
  opened(): void;
  /** Send out what the visitor wrote. Returns a few words if it couldn't even be tried, or null. */
  send(text: string): string | null;
  /** Ask for the post with this key to be deleted. Returns a few words if it couldn't even be tried, or null. */
  remove(key: string): string | null;
  view(): FeedView;
}

/** The feed a set of controls holds. `changed` is called whenever a renderer should draw again. */
export function createUiFeed(changed: () => void, now: () => number = () => Date.now()): UiFeed {
  let opts: FeedOptions | null = null;
  let posts: FeedPost[] = [];
  let loading = false;
  let said = "";
  let version = 0;
  let count = 0;
  let asked = 0;
  const bump = () => {
    version++;
    changed();
  };
  const sort = () => {
    posts.sort((a, b) => b.at - a.at);
    // What is on its way, or didn't go, is never dropped to make room.
    const kept = posts.filter((p, i) => p.state !== "out" || i < FEED_LIMITS.kept);
    posts = kept;
  };
  return {
    attach(next) {
      opts = next;
      posts = [];
      loading = false;
      said = "";
      asked = 0;
      bump();
    },
    detach() {
      if (!opts) return;
      opts = null;
      posts = [];
      loading = false;
      said = "";
      bump();
    },
    opened() {
      const mine = opts;
      // Asked once, and again only after a minute: opening and closing the window isn't a flood of questions.
      if (!mine?.load || loading || (asked && now() - asked < 60000)) return;
      asked = now();
      loading = true;
      bump();
      void mine
        .load()
        .catch(() => null)
        .then((got) => {
          if (opts !== mine) return;
          loading = false;
          if (!got) said = "Your earlier posts couldn't be fetched just now.";
          else {
            const seen = new Set(posts.map((p) => p.key));
            for (const p of got) {
              const text = cleanLine(p.text, FEED_LIMITS.shown);
              if (!text || seen.has(p.id) || !Number.isFinite(p.at)) continue;
              seen.add(p.id);
              posts.push({ key: p.id, text, at: p.at, state: "out", id: p.id });
            }
            sort();
          }
          bump();
        });
    },
    send(text) {
      const mine = opts;
      if (!mine) return "There is nothing to post with: sign in first.";
      const words = cleanChat(text);
      if (!words) return null;
      const post: FeedPost = { key: `new-${++count}`, text: words, at: Math.floor(now() / 1000), state: "sending" };
      posts.unshift(post);
      said = "";
      bump();
      void mine
        .send(words)
        .catch((): { ok: boolean; said: string; id?: string } => ({ ok: false, said: "That wasn't sent." }))
        .then((how) => {
          if (opts !== mine) return;
          post.state = how.ok ? "out" : "failed";
          if (how.ok && how.id) post.id = how.id;
          said = how.said;
          bump();
        });
      return null;
    },
    remove(key) {
      const mine = opts;
      const post = posts.find((p) => p.key === key);
      if (!mine?.remove || !post?.id || post.state !== "out") return "That post can't be deleted from here.";
      const id = post.id;
      post.state = "removing";
      said = "";
      bump();
      void mine
        .remove(id)
        .catch(() => ({ ok: false, said: "That wasn't deleted." }))
        .then((how) => {
          if (opts !== mine) return;
          // Gone from here once relays have been asked. Where it was refused, it is as it was.
          if (how.ok) posts = posts.filter((p) => p !== post);
          else post.state = "out";
          said = how.said;
          bump();
        });
      return null;
    },
    view() {
      const who = typeof opts?.who === "function" ? opts.who() : (opts?.who ?? "");
      // A deletion is a request relays may honour: said plainly, so nobody posts on the strength of it.
      const back = opts?.remove ? "and deleting it later only asks relays to drop it: copies may remain" : "and it can't be taken back";
      const lead = `Public, like a tweet: anyone can read what you send out here, as ${who}, ${back}.${opts?.marked ? ` Each post is marked as sent from ${opts.marked}.` : ""}`;
      return { ready: !!opts, title: "My public feed", who, posts, loading, said, lead, limit: CHAT_LIMITS.chars, removable: !!opts?.remove, version };
    },
  };
}

/** How long ago, in a few words: "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function ago(at: number, nowSec: number): string {
  const s = Math.max(0, nowSec - at);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const days = Math.floor(s / 86400);
  if (days < 30) return days === 1 ? "1 day ago" : `${days} days ago`;
  return new Date(at * 1000).toISOString().slice(0, 10);
}
