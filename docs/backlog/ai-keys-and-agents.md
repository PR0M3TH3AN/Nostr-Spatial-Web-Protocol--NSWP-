# AI provider keys kept in BitLogin, and AI agents in the worlds

- **Asked:** 2026-11-23. The owner: "Add a new data type to BitLogin to
  store AI provider keys like OpenRouter for use in game. Include different
  categories. Like Intelligence for OpenRouter. Voice for ElevenLabs or
  others. System 1 for JEV and a way to add "other" for whatever else we
  thing up and want to use in game. AI agents in the game could use be
  created by a nostr event kind with associated short and long term memory
  as encrypted nostr notes. And sets of info like System prompts SOUL.md
  etc. Could also be nostr note all associated with the AI agent. Uesers who
  have credit usage turned on can see and interact with these agents using
  their accounts."
- **Who:** a written design first. BitLogin (the keys, and whatever uses
  them), the kit (what an agent is, and how a world shows one), BitPortal.
  Not briefed.
- **State:** asked. Not a priority (the owner, 2026-11-23: "This is not a
  priority. Id like for each to be added to the backlog."). Its pieces are
  `agents-0-contracts` to `agents-8-a-companion-across-worlds`.

## The two halves

### 1. Provider keys, as a kind of thing BitLogin keeps

A new kind of record in the visitor's own account at their sign-in address,
beside their wallet and files: keys for services that AI in the worlds can
use. In categories:

- **Intelligence** (OpenRouter, or another that answers in words);
- **Voice** (ElevenLabs, or others);
- **System 1** (JEV: a fast provider that chooses among typed actions, as
  the owner's design pack describes it);
- **Other**, named by the visitor, for whatever comes next.

Each key is the visitor's own, bought from that service, and using it costs
them money there.

### 2. Agents, as things in the worlds

An AI agent is made by a signed note of a new kind: who it is and what it is
for. With it go other notes: its instructions (a system prompt, a `SOUL.md`
and the like) and its memory, short and long, kept as encrypted notes. A
visitor who has turned on the use of their credit can see these agents in
the worlds and talk with them, the cost falling on the visitor's own key.

## What the design must hold to (the orchestrator)

- **A key never leaves the sign-in address.** It is a secret that spends
  money. No world, and no client, is ever given one, whole or in part. If a
  world wants an agent to answer, it asks the sign-in address, whose own
  page makes the call to the provider and hands back only the answer. This
  is how a wallet is used today, and for the same reason.
- **Kept as the vault's other secrets are:** sealed before it leaves the
  browser, never in the clear at rest, never in a note anyone else can open,
  never in a log, a link or a message between pages. Shown again only as its
  last few characters.
- **Spending is the visitor's own choice, with a ceiling.** "Credit usage
  on" is theirs to turn on, off by default, with limits they set (for a
  world, for a day), asked at the first use in each world, and shown as it
  is spent. A world or an agent must not be able to run a visitor's credit
  down: an agent's own instructions are somebody else's words, and they
  decide how much is sent to a provider.
- **What leaves the worlds is said.** What a visitor says to an agent goes
  to that provider, under the provider's own terms. The screen says which
  provider, before the first word.
- **An agent's words are a stranger's words.** Its instructions and what it
  says are untrusted content, drawn as text, never run, and never able to
  press anything in the visitor's menu or ask their sign-in address for
  anything by itself.
- **New kinds are given, not taken** (fleet rule 11): the agent's kind, its
  instructions' and its memory's, and BitLogin's record for keys.

## For the design to settle

- **Whose key pays, and whose memory it is.** If each visitor pays with
  their own key, is an agent's memory one memory everyone adds to (then who
  holds the key that opens it, and who can write to it?), or one per
  visitor, sealed to that visitor? What an agent "remembers" about a person
  is that person's private matter.
- Who may make an agent, and whether a world's keeper chooses which agents
  are in their world; BitGate's lists for agents that may be shown.
- Where an agent runs when nobody who pays is present.
- Voice: speech made by a provider, played in a world, and who hears it.
- A guest (an account not yet secured) and credit: nothing that spends
  before the account is secured.
- What a visitor without credit turned on sees: the agent as a figure that
  doesn't answer, or nothing.
- Whether a provider's own browser rules allow a call from the sign-in
  address's page at all, for each service named.

## The owner's design pack (handed over 2026-11-23), and what the orchestrator made of it

The owner handed over a fuller design the same day: "NSWP Agent Platform,
Modular Design Pack", 0.3 draft, eleven documents written for the private
repository `PR0M3TH3AN/nswp-agents` (which exists, with an experimental
companion in it). It is the owner's document and lives with that repository
(under `docs/plans/agent-platform/`, saved there on 2026-11-23 by the
session that has it, "NSWP-Agents Agent"); it is not copied here. It is planning, not anything built.

**It holds to every line above, and adds its own:** an agent's identity, its
placement in a world, its running, its memory and its authority are five
separate things; a visitor sees and talks with a local agent without joining
a room or giving any key; a `SOUL.md` changes personality and never
authority; nothing waits on a model to draw a frame; every paid call is
opt-in with a budget; and no key is revealed to a world's own code.

**What was checked against the repositories:**

- BitLogin already has an encrypted Connection Vault
  (`docs/connection-vault.md`, "design with core implementation"). So "a new
  data type for AI keys" is a new profile on what exists (the pack's M6
  steps 1 and 2), not a new store.
- The pack's candidate kinds 37309, 37310 and 37311 are the next three after
  the kinds NSWP uses today (37300 to 37308). They are still to be given
  (fleet rule 11) and checked against the wider registry.

**What is possible, by how hard:**

1. *Now, touching nothing shared* (the pack's M0 to M2, in `nswp-agents`):
   several agents in one world, running in the visitor's own browser, moving
   and talking by a free local model or simple rules, placed by data a
   world's maker writes. No protocol change, no BitLogin change, no key.
2. *With a reviewed protocol change* (M3): agents and their documents as
   signed notes, so two clients agree on who an agent is.
3. *In BitLogin, modest* (M6, steps 1 to 3): provider keys kept in the vault
   by category, with a screen to add, rotate and remove them, and asking
   permission without revealing anything.
4. *The hard part* (M6, step 4): spending a visitor's key for a world
   without the world ever holding it. The pack is right that revealing a key
   to a page, or passing it through a frame, is not this. The orchestrator's
   view: for a provider that takes calls from a browser, the sign-in
   address's own page can make the call and hand back only the answer, as it
   pays from a wallet today, with its own limits and the provider's own cap
   on the key. For a provider that doesn't, it needs a service somebody
   runs, which is a new host resource and the owner's word.
5. *Needs a service* (M7): an agent that goes on while nobody who pays is
   there, and one agent shared by everyone in a room.
6. *Easier here than the pack assumes* (M8): the pack takes it that going
   through a door ends everything running, so a companion is saved and
   restored. BitPortal's shell now stays as one page with each world in a
   frame, so a companion could run in the shell and simply stay, as the
   visitor's music will. It would need words between the shell and a world
   for what the agent sees and may do there.

**Where it meets today's other decisions:** one identity across BitPortal
(`guest-accounts`) settles who the visitor is to an agent everywhere; a guest
account spends nothing until it is secured; and the client's menu is where a
visitor turns credit on, sees what is spent and mutes or removes an agent.

**The owner's direction for `nswp-agents`, 2026-11-23** (after "Not yet" to
the pack's M1): "id like for it to get the memory, SOUL.md and other
personality things worked out in the webUI i started in on. So we can see
how steerable an agent like this is in its personality and in conversation
history and memory loaded in from nostr. As well as if we can get JEV
working to allow the agent to actually "play" like a player or NPC. We can
use my little dev app over there as our testing playground". So that
repository's session works, in the owner's own dev app and for one agent, on
personality that can be steered, on history and memory loaded from Nostr,
and on JEV choosing the agent's actions: the pack's documents 03, 04 and 05
in small. It uses no note kinds of its own, keeps keys the owner's to type,
and sends nothing test-made to real relays. The first milestone
(`agents-0-contracts`) is done there, on a branch, unmerged.

**Decided by the owner the same day:** it is not a priority. Each piece is
in the backlog. The first, `agents-0-contracts`, was started the same day in
`nswp-agents` on the owner's word to that repository's session.
The pack itself is committed there on the branch
`docs/agent-platform-spec-v0.3` (c9d77eb).

## Talking to an agent by voice (2026-11-23 and 24)

The owner asked the orchestrator whether the kit's speech-to-text "is fast
enough to voice chat with an agent that uses an open router LLM", and to
have it measured ("Yes, measure it").

**Measured in `nswp-agents`' playground (commit 0d6ab91), on this machine
while it was very busy, with a made voice and not a person's:** the kit's
way (hold, speak, release; then OpenAI's Whisper on the visitor's own
computer, one pass) takes about 2 s for a two-second order and about 3 s
for a sentence with `base.en`, which misheard some words of a long clip.
`small` heard everything and took 8 to 18 s. The model's own time and the
whole turn were not measured: they need the owner's key, and the playground
now times them on screen.

**The owner's direction, said to the `nswp-agents` session when asked to
confirm a download of a faster Whisper:** "the thing is, we need to use
tech that can be in the browser session. I am not sure that is the right
fit." And: "we might need to use a remote API for our voice to text".
Nothing was downloaded.

**What that leaves for a design, none of it decided:**

- A remote speech service the page calls: quickest and most accurate, paid
  by the minute, and what the visitor says leaves their device.
- Whisper run in the browser tab itself: in the browser session, and the
  sound stays on the device; a model is fetched on first use and it is slow
  on a phone or a headset. Not measured.
- The browser's own recognition, which the kit already uses where no
  computer of the visitor's is listening (`packages/sdk/src/speech.ts`).
- Speaking the answer aloud is not built anywhere. It is the Voice key's
  job.
- In the playground a service may be called straight from the page with
  the owner's own key. In BitPortal that is never the shape: a visitor's
  key stays at the sign-in address (the first rule above), so the page asks
  BitLogin, and BitLogin calls the service.
- TypeSafe's own JEV address refuses calls from a browser, so in a browser
  alone JEV goes by OpenRouter's route unless TypeSafe allows the page's
  origin.

## Two kinds of character (decided 2026-11-24)

The owner: "Yes I like your agent split." A **cast member** is a record
under its host's key, with a throwaway key while it is in a room, for one
game in one world; a **lasting agent** has a Nostr identity of its own and
its memory as sealed notes. The same sheet for both, filled to different
depths. Set out in `docs/plans/agents-lessons.md`, "What the protocol would
have to settle".

## A first trial in a world, on this machine (the owner, 2026-11-24)

Asked for by the owner in the `nswp-agents` session ("lets also document
the elements we need to get done and elements that bitportal needs to get
done. Or bitlogin needs to get done to get us ready to test in-game"),
which wrote `docs/READINESS.md` in that repository; the orchestrator
corrected its rows for the kit, BitPortal and BitLogin from the kit's
code (read, not run). Then, asked whether to start a first in-game trial
on this machine in a local copy of the world template, the owner said:
"Yes, start it".

**What it is:** a copy of `nswp-world-template`, outside every
repository, served on this machine only; the playground's agent loaded
into it as a module; the world's things written beside its scene in the
playground's declared format; the kit's `canStand` for walking, its
figure (with the playground's legs) for a body, its sprites for what the
agent says. The owner is the only visitor. Nothing live, nothing
published, no real relay.

**What it does not need:** any change to the kit, to BitPortal or to
BitLogin, or any note kind. A world is a page built with the kit, and
the adapter is that one world's own code. What a world has no way to say
today (a list of its things with ids and what each can do) is written by
the world's maker for the trial; whether and how the kit should carry it
is for after, by names given (fleet rule 11).

**What is still the owner's, each time:** a server on this machine that
holds his key and gives only answers, for that one page only, off when
not testing; any paid run; anything fetched.

So the standing "not a priority" of 2026-11-23 holds for the kit,
BitPortal and BitLogin, whose order of work is unchanged (the menu
first). In the playground the owner is driving, and this trial is his
word.

## The first trial ran (the playground's D81, 2026-11-24)

On the free rules, in the copy at `~/agent-trials/first-world` on
127.0.0.1 only: the kit's own figure on the playground's legs switched on
the lamp it was asked for and fetched a box to the visitor. The page
contacted nothing off this machine. The owner has not yet tried it.
Nothing of the kit, BitPortal or BitLogin changed, and none is asked for
now. What the trial found for the kit, the template and a figure (how a
module gets the world's three, a declared place for using a thing, one
convention for which way a figure faces, a local setting for the
template, a kit piece that hands back its own declaration, orders through
the chat pane) is in `docs/plans/agents-lessons.md`, as things to design
later by names given, behind the menu.

Since, the same day, each on the owner's word in the playground's own
session: the memory rule mended (D82, free); a key server for the trial
page built ("Yes, build it": this machine only, that one page's origin
only, two paths, a cap, off when not in use; D83); and JEV deciding in
the world through it ("Yes, run it": three orders of four, 8 requests,
$0.00025; D84). Both servers were stopped after. Next there: the chat
model as the companion's mind in the world, quoted to him first; an
order of two steps mended, free; the second body.

## Must not

- Put a provider's key anywhere a world, a client, a relay or another
  visitor could read it.
- Spend a visitor's credit without their own press, or past their limit.
- Let an agent act as the visitor.
