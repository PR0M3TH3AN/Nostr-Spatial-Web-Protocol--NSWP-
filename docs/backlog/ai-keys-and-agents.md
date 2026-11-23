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
- **State:** asked. After the client's menu and the identity work
  (`guest-accounts`), which it builds on.

## The two halves

### 1. Provider keys, as a kind of thing BitLogin keeps

A new kind of record in the visitor's own account at their sign-in address,
beside their wallet and files: keys for services that AI in the worlds can
use. In categories:

- **Intelligence** (OpenRouter, or another that answers in words);
- **Voice** (ElevenLabs, or others);
- **System 1** (JEV; the orchestrator doesn't know what JEV is, and has
  asked the owner);
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

## Must not

- Put a provider's key anywhere a world, a client, a relay or another
  visitor could read it.
- Spend a visitor's credit without their own press, or past their limit.
- Let an agent act as the visitor.
