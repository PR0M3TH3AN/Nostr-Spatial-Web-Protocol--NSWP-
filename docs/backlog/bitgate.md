# BitGate for who may sell, who may be paid, and what is shown

- **Asked:** 2026-11-21. Asked who may register to be paid a share, the
  owner answered: "Id like to go with the bitvid model of both a whitelist
  and black list. So early content is curated until all the kinks are
  worked out. We have a project called BitGate that is for this." And:
  "For gated stuff id like to intigrate and even improve the BitGate
  project."
- **Who:** BitGate (its session was started and briefed 2026-11-21; its
  first report is owed).
- **State:** briefed

## What BitGate is

The owner's own project (`PR0M3TH3AN/bitgate` on GitHub; not on this
machine yet): moderation and access control for Nostr apps. It answers
"what may you see, and what may you do" where BitLogin answers "who are
you". Allow and block lists kept as signed Nostr events, and one evaluation
that gives four answers: how something is ranked, whether it is shown,
whether it may be interacted with, and whether it may be transacted with.
It carries no policy of its own: each application supplies one.

## Where it would be asked, as far as anyone has looked

- **BitUnlock:** who may register to sell, who may register to be paid a
  share, whether a listing may be sold. Today: one invitation list.
- **BitPortal and the kit:** which worlds a door or a list shows, and
  which people; today BitPortal has its own blocked list and a curator's
  starter set.
- **BitLogin:** whether a purchase or a tip is offered at all.

## What BitUnlock's session says of itself (2026-11-21, read only, its report)

BitUnlock does not use BitGate anywhere today. (Its folder
`bitunlock-moderation` is not this: it is a second checkout on another
branch, named for an experiment that was dropped.) Where a decision would
be asked in its code:

- **"This key may not sell":** when a key signs up as a seller
  (`src/onboarding-gate.ts`, asked by `POST /v1/tenants`), which today
  reads the operator's key and one invitation list in its database; and
  the suspension check at quote time (`src/api/quote.ts`).
- **"This key may not be paid a share":** payee registration
  (`src/api/payees.ts`), behind the same invitation gate, and the point in
  a quote where the people to pay are resolved.
- **"This listing may not be sold":** when a listing is registered
  (`src/api/product.ts`), and at quote time. There is no operator block on
  one listing today; only its seller can withdraw it.

Two rules its code already keeps, and any design keeps (the orchestrator
agrees, as a matter of design):

- A block stops new sales only. It never stops a paid buyer's unlock,
  refresh or recovery.
- Every such decision is answered from BitUnlock's own database, never by
  asking another service during a quote. BitGate's lists are copied into
  a table it reads.

## Done looks like

To be written when briefed. The first piece is a report from a session
that has read BitGate: what it does today, what each of the three projects
would ask it and when, what it lacks for that ("improve"), and what stays
as it is meanwhile. Until then nothing changes: BitUnlock's invitation
list is the whitelist.

## Must not

Put a second, different list of who is allowed in each project.
