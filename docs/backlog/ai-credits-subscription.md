# AI credits: a subscription for agents' AI use, beside a visitor's own keys

- **Asked:** 2026-11-24. The owner: "So for the AI agents. Id like for the
  user to have the advanced option of using and managing their own API keys
  for their agents. But I'd also like to incorporate a kind of unified API
  credit system that will allow bitlogin to populate the session with valid
  keys up to a certain amount of usage a month and then per credit after
  that. Like a subscription service for all the AI agents across the
  world's. Is that something we could do safely with our infra like
  bitunlock? I have already built an integration kinda like this for the
  Satisfied app."
- **Who:** a written design first. BitUnlock (selling it, counting use,
  making the calls), BitLogin (who the visitor is, and the only thing that
  asks on their behalf), the kit (how a world asks). Not briefed.
- **State:** asked. Part of `ai-keys-and-agents`, which is last and not a
  priority.

## The two ways to pay for an agent's thinking

1. **A visitor's own keys** (the advanced way): already the shape of
   `ai-keys-and-agents`. Kept in BitLogin's vault like its other secrets,
   spent at the visitor's own choice and limit.
2. **Credits from BitPortal** (this entry): the visitor pays a subscription
   and gets an amount of AI use a month across every world, then pays for
   more as it is used.

## The one thing that can't be done as asked

A provider's real key must not be put into a visitor's session. A key in a
browser can be copied and used anywhere, without limit; a monthly amount
can't be held to on a key the visitor has. So "populate the session with
valid keys" becomes one of:

- **A go-between that makes the calls.** The session never has a key. It
  asks a service to make each call; the service holds the key, counts the
  use, and stops at the limit.
- **A key of the visitor's own with a ceiling, made by the provider,** if a
  provider offers that (to be confirmed for OpenRouter and ElevenLabs): a
  leak costs at most the ceiling, and nothing a visitor asks passes through
  our service. Kept at the sign-in address, never given to a world.

Either way the rule already written holds: a key never leaves the sign-in
address, and a world asks BitLogin.

## What BitUnlock has today (read from its code, 2026-11-24)

- **It is already a go-between for AI.** A product can be an AI result. The
  seller's provider key is stored encrypted, the service makes the call, the
  answer is checked and sent back sealed to the buyer. A buyer never gets a
  key. This is what Satisfied uses, at about 100 sats an analysis.
- **It signs a receipt** a third service can check without asking it, for
  access that is for ever or for a term, and says publicly whether one has
  been taken back.
- **It holds nobody's money:** each payment goes to the seller's own wallet
  and BitUnlock only checks it was paid.
- **Access for a term, renewed by paying again,** exists, for things that
  are not AI.

## What it does not have

- **One paid order for each call is its only way to sell AI.** An agent
  that decides several times a second can't pay an invoice each time.
- **No count of anyone's use:** not by buyer, not by tokens, not by spend.
  No amount included, no credits, no balance. Its own code argues against a
  balance.
- **No term on an AI product:** refused in so many words today.
- **No paying by itself each month.** A renewal is the buyer paying again.
  Lightning can't pull a payment; a standing order from a wallet is planned
  there and not built.
- **No way to ask "has this key a subscription":** by design the visitor
  shows the receipt.
- **What a buyer sent is kept, sealed, with nothing that clears it.** Right
  for one photograph; wrong for a stream of what a visitor says to an agent.

## What it would take

1. **An allowance:** a term's receipt that carries an amount of use, and a
   count kept against it for each visitor, checked before every call.
2. **A session, not an invoice, for each call:** the visitor shows the
   receipt once (through BitLogin), is given something short-lived, and
   calls are made under it. Quick enough to sit in an agent's loop.
3. **Use counted in the provider's own terms** (tokens, characters,
   seconds) and turned into credits by a published table.
4. **More after the amount is used:** either credits bought ahead, or paid
   as used from the visitor's BitLogin wallet under a limit they set (the
   ecash plan BitUnlock already has on paper).
5. **Nothing kept of what is asked or answered.**
6. **A ceiling on the whole account each day,** whatever the counts say, so
   a fault or a thief can't empty it.

## The owner's, and a lawyer's

- Selling AI use on is selling a service: credits owed to people, refunds,
  and tax on it. To be added to the questions already waiting for a lawyer.
- Each provider's terms on selling its use on.
- One account shared by every subscriber: one person's misuse can have the
  whole account closed. Use must be traceable to a subscriber.
- The price, the amount included, and what a credit is worth.
- Whether a wallet may pay a renewal by itself, which is a standing consent
  to spend.

## Must not

- Put a provider's key in a session, a world's page or a client's page.
- Let a count kept in the browser decide what may be spent.
- Deploy any of it to BitUnlock before its waiting database changes and its
  staging copy are in order, and never without the owner's word.
