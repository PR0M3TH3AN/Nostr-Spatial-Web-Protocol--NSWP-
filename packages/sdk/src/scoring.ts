/**
 * "Scores", in a world's menu: the visitor's best on each of the world's boards, the way to post it, and who
 * else is on the board (protocol/15-scores.md).
 *
 * A world adds this itself, for the boards it names. A world that keeps no score has no such tab.
 *
 * The same on a phone, at a desk and on a headset's wrist. People the visitor follows are listed first, where
 * this world has been let see who they follow; everyone else after. Every score here is a claim, and it says so.
 */
import { shortNpub, type Standing, type Standings } from "@nswp/core";
import type { Profiles } from "./profiles.js";
import type { Scores } from "./scores.js";
import type { Controls, UiAction } from "./ui/model.js";

export interface ScoringOptions {
  scores: Scores;
  /** Names for the people on a board. Without it they are shown by the short form of their key. */
  profiles?: Profiles | null;
  /** Someone on the board was chosen: show who they are (in Following, say). */
  choose?: (pubkey: string) => void;
  /** Whether the visitor is signed in here. */
  signedIn(): boolean;
}

export interface Scoring {
  refresh(): void;
}

export function addScoreControls(controls: Controls, opts: ScoringOptions): Scoring {
  const { scores } = opts;
  let shown: string[] = [];
  const read = new Map<string, Standings | null>();
  const looking = new Set<string>();
  const nameOf = (pubkey: string) => opts.profiles?.get(pubkey)?.name || shortNpub(pubkey);
  const look = (board: string, fresh = false) => {
    if (looking.has(board)) return;
    looking.add(board);
    void scores
      .standings(board, fresh)
      .catch(() => null)
      .then((got) => {
        looking.delete(board);
        read.set(board, got);
        const people = [...(got?.known ?? []), ...(got?.others ?? [])].map((s) => s.by);
        if (people.length) void opts.profiles?.fetch(people);
        refresh();
      });
  };

  const refresh = () => {
    for (const id of shown) controls.remove(id);
    shown = [];
    if (scores.boards.length === 0) return;
    const add = (...actions: UiAction[]) => {
      for (const a of actions) shown.push(a.id);
      controls.add(...actions.map((a) => ({ section: "scores", ...a })));
    };
    controls.addSection({
      id: "scores",
      label: "Scores",
      icon: "list",
      note: () => "A score here is what someone says they made: nothing checks it. People you follow are listed first. Posting yours says publicly that you were here, and how you did.",
    });
    for (const b of scores.boards) {
      const best = scores.best(b.id);
      const posted = scores.posted(b.id);
      const many = scores.boards.length > 1 ? `${b.title}: ` : "";
      add({
        id: `scores-post-${b.id}`,
        icon: "check",
        tone: best !== null && best !== posted ? "primary" : "normal",
        label: () =>
          best === null
            ? `${many}No score of yours yet`
            : !opts.signedIn()
              ? `${many}Your best: ${scores.words(b.id, best)}. Sign in to post it`
              : best === posted
                ? `${many}Your best, ${scores.words(b.id, best)}, is on the board`
                : `${many}Post my best to the board: ${scores.words(b.id, best)}`,
        short: "Post",
        act: async () => {
          if (best === null) return controls.say("Make a score first: it is kept on this device until you post it.");
          const done = await scores.post(b.id);
          controls.say(done.said);
          if (done.ok) look(b.id, true);
          refresh();
        },
      });
      const got = read.get(b.id);
      if (got === undefined) {
        look(b.id);
        continue;
      }
      add({ id: `scores-look-${b.id}`, icon: "turn", label: got === null ? `${many}The board couldn't be reached. Look again` : `${many}Look again`, short: "Look", act: () => look(b.id, true) });
      if (!got) continue;
      const row = (s: Standing): UiAction => ({
        // A row each, in order: a board is read from the top down, and who is known is told from who isn't by
        // where they stand in it.
        id: `scores-${b.id}-${s.by.slice(0, 16)}`,
        icon: "you",
        label: () => `${s.rank}. ${nameOf(s.by)}: ${scores.words(b.id, s.score)}`,
        act: () => (opts.choose ? opts.choose(s.by) : controls.say(`${nameOf(s.by)}: ${scores.words(b.id, s.score)}, as they say.`)),
      });
      add(...got.known.map(row));
      if (got.others.length) {
        // Said apart: nobody the visitor has reason to know. Anyone can make a key and claim a score.
        add({ id: `scores-others-${b.id}`, icon: "people", label: `${many}${got.known.length ? "Everyone else" : "Everyone"} (${got.count - got.known.length})`, act: () => controls.say("These are people you don't follow. A score is only what its owner says it is.") });
        add(...got.others.map(row));
      }
    }
  };

  let drawing = false;
  const soon = () => {
    if (drawing) return;
    drawing = true;
    queueMicrotask(() => {
      drawing = false;
      refresh();
    });
  };
  scores.onChange(soon);
  opts.profiles?.onChange(soon);
  refresh();
  return { refresh };
}
