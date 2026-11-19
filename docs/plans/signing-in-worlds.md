# Signing from inside a world: the plan

**Status:** partly built, the same day it was written. See "What is built"
at the end. Written as a plan on 2026-11-19, when nothing here was built. It extends
[the in-game identity plan](in-game-identity.md), which covers signing in
and changing a look; this one covers what comes after: signing notes, and
later spending. One part of it has been tried in browsers (the window, see
"What was tried"). The rest has not.

## What the owner asked for

> We need multiple ways of authentication with the most seamless available
> always being the preferred method. So if a one-time bitlogin sign in per
> world would work as a catch all fallback for signing nostr notes that
> would be fine for now. And maybe it should include a message about
> setting up passkey for a more seamless experience. [...] Eventually we
> will be signing messages, sending bitcoin and taking payment splits in
> vr. [...] Having bitlogin as a signer inside each worlds is an important
> part of that infra.

And, on being told the password must not be typed into the world's own
page: "Yes, use a window."

## The rule, unchanged

A world's page draws the world's menu, and in a headset the world draws
everything. Whatever is typed there, the world's code can read.

> **Nothing secret is ever typed into a world. A world only asks. Something
> the world can't touch answers.**

A BitLogin name and password open the same identity on every site, and a
Nostr key can't be changed once it is taken. So one hostile world reading
one password would have the visitor's identity for good, and later whatever
is behind it. That is why the fallback is a window, and not a box in the
world.

## The pieces

### 1. The signer

A hidden component, served by the visitor's own client (for BitPortal, one
page of BitPortal's), embedded by the kit in every world. It has no
interface. The world can't read it or script it. It runs BitLogin.

The world asks it to sign something. It answers with the signed note, or
with a refusal. It never hands out a key.

A browser walls off what a site stores when that site is embedded in
another. So the signer in each world starts locked, however signed in the
visitor is at their client. Each world is unlocked once. That is the "once
per world" the owner described, and it is the browser's doing.

### 2. Ways to unlock it, the most seamless first

| # | What unlocks it | What the visitor does | Where it works | Stands |
|---|---|---|---|---|
| 1 | It is already unlocked for this world | Nothing | Everywhere | New. Lasts while the world's page is open, four hours at most |
| 2 | Their passkey | One touch, on a prompt the browser draws, without leaving the world | Wherever a passkey prompt can appear embedded | Waits on the device tests in [the other plan](in-game-identity.md), Part 1 |
| 3 | A signer of their own: a browser extension, or a phone or bunker that approves | Approves there | Extension: desk. Phone or bunker: everywhere, a headset included | BitLogin already signs in by both. Not yet wired into a world |
| 4 | Their BitLogin name and password, in a window of their own client | Signs in once in a small window, presses Allow, and is back | Flat screens | New. Tried in three browsers. Does not wait on the passkey tests |
| 5 | The trip by the crossing's room to their client's sign-in room | What they do today | Everywhere | Built. It brings back a pass (their name), not a signer |

The kit offers the first that is available on that device, and says what
the others are. Whenever someone unlocks with a password (4), the window
says, after they are in: "Add a passkey, and next time it is one touch
without this window."

### 3. The window

1. The visitor presses "Sign in to sign" in the world's menu.
2. The world opens a small window at the visitor's client. It is a real
   window with its own address bar, and the world can't read it.
3. If the visitor isn't signed in at their client, they sign in there. If
   they are, there is nothing to type.
4. The window finds the client's own hidden signer inside the world that
   opened it, and is told by the signer which world that is. The address is
   the browser's word, never the world's.
5. The window shows: "Let *that address* ask this signer to sign notes as
   you?" and what it may sign (see "Permissions").
6. On Allow, the window gives the session to the signer and closes.

Step 4 is what makes it safe. The window speaks only to a frame of its own
site: a message addressed to the client's address is delivered to nothing
else. A world that poses as the signer hears nothing, and the window, having
found no signer, offers no Allow.

**What the window does not do** is make a fake impossible. A hostile world
can open a look-alike on an address of its own. What tells them apart is
the address bar, and a password manager, which fills a password in only at
the address it was saved for. BitLogin's passwords are generated, so they
live in a password manager, which is real protection. A passkey can't be
phished at all. That is one more reason the ladder prefers it.

### 4. Permissions

Unlocking is not agreeing to everything. What a world may have signed is
set per world, on a surface the client draws (the window, the Airlock, the
sign-in room), and is kept by the signer.

| Class | Asked | Kinds |
|---|---|---|
| Ordinary | Once per world | Notes (1), reactions (7), what is said in rooms, a zap request within a budget (9734) |
| Careful | Every time, on a surface the client draws | The visitor's profile (0), who they follow (3), their relay list (10002), deleting (5) |
| Never from a world | Refused | Reading private messages, anything in a BitLogin vault, a wallet's secret, a pass for another site, a grant for a Bridge |

Anything not named is "careful". A world is told only that a request was
refused, never why.

Every note the signer signs for a world says which world asked, in a tag,
so it can be told from one the visitor wrote in a client of their own.

### 5. In a headset

No window can open during a headset session, and nothing but the world can
draw. So in a headset:

- A passkey (2), if its prompt can appear there: the same as everywhere.
  That is test C of the other plan.
- A phone or bunker that approves (3): works, and is the fallback that
  needs nothing of the headset.
- With neither: the trip to the sign-in room (5). It brings back their
  name, not a signer. Signing real notes from a headset with only a
  password is not offered. Linking the headset once (decision 5 of the
  other plan) may close this, if a browser lets the embedded signer use
  what the client stores; that is not tested.

### 6. Money, later

In a headset the world draws every word the visitor sees. "Pay 10 sats?"
drawn by a world can't be trusted to say what is being paid. So:

- **A budget, set on a surface the client draws.** "This world may spend up
  to N sats a day without asking." The default is nothing. Small payments
  inside the budget need no prompt, and the most a hostile world can take
  is the budget.
- **BitLogin keeps the wallet's secret.** Its wallet-connection design
  already has per-site connections, budgets, and a mode in which it makes
  the payment and the site never sees the connection. That mode is designed
  and not built.
- **Above the budget, a confirmation the world can't draw:** the window on
  a flat screen, the sign-in room or the visitor's phone from a headset.
- **Splits are declared, not discovered.** Who is paid what share is in
  the world's signed listing, so the client can show it when a budget is
  set, and pays each share itself.

None of this is in the first build.

## What this means for every site that uses BitLogin

The owner asked whether every BitLogin site has this weakness.

Yes, by design, and BitLogin's spec says so. Its widget runs as part of
the page that embeds it, so a site that embeds it can read the password as
it is typed (spec §22.1, "A static web host can serve modified JavaScript
that captures passwords"). That is acceptable for one site trusted with one
account. It gets worse with every site added, because one BitLogin account
is one identity everywhere: the least careful site decides how safe the
whole identity is. Nobody has to be hostile for it to matter. One injected
script on one of them is enough.

BitLogin's passkeys have the mirror-image problem: a passkey belongs to the
site it was made on, so the same person gets a different account on every
site (passkey-login.md, "Per-site scoping").

Both have one answer, and the spec already points at it (§26.3, "Future
redirect flow"): **the password is typed, and the passkey lives, at one
address the visitor trusts, and every other site asks that address.** That
is what this plan builds for worlds. So:

- BitLogin gains a **sign-in window** mode: a site opens the visitor's
  sign-in address, and gets back a signer it can ask, never a password.
- The embedded widget stays for the sign-in address itself, and for a site
  that is its own visitor's home.
- A passkey made at the sign-in address is the same identity on every site
  that asks it.
- It is not an emergency for the owner's own sites, which are not hostile.
  It should be in place before anyone else's site embeds BitLogin, and
  before money is behind an account.

Which address is "the visitor's sign-in address" is a decision. In a world
it is the visitor's client, which the arrival already names. For a site
that isn't a world, BitLogin needs a default and a way for a visitor to
choose their own.

## Apps that aren't worlds

The owner's other apps embed BitLogin's widget today, and sign in on their
own pages. With the window, such an app has no sign-in box: a button opens
the sign-in address, the password is typed there (once for the device, not
once for each app), and the app is handed a signer.

What exists is built for worlds, and is too narrow for an app. From a
read of the two apps' own code on 2026-11-19:

| App | What it asks its signer for today |
|---|---|
| bitunlock | A public key; signatures on a web-request proof (27235) and private messages (4); a wallet connection |
| bitvid | Signatures on videos (21, 22), lists (30000, 30002, 30015), reactions, reposts, deletions, zap requests, application data (30078), a web-request proof; and encrypting and decrypting, for messages and private lists |

Nearly all of that is refused to a world, on purpose. So before either app
changes how it signs in, three things are needed:

1. **A permission an app declares and the visitor sees.** The window shows
   what this app asks for (which kinds, whether it may read private
   messages, whether it may spend), and the signer holds it to that. A
   world's list stays what it is.
2. **A session in BitLogin between "can only sign" and "everything".** A
   handed-over session refuses to decrypt. An app that shows private
   messages needs one that may, for that app, when the visitor said so.
3. **A sign-in address for an app that isn't a world.** A world's visitor
   arrives from their client, which is the address. An app needs a default,
   and a way for someone to name their own.

Until then nothing changes for those apps: they keep the widget, on pages
that are the owner's own. A flat demo of the sign-in half is in
[`signin-demo/`](signin-demo/).

## Where the sign-in address should be

The first build put the signer and the window in BitPortal, because a
world's visitor arrives from BitPortal. The owner's view, on trying it
(2026-11-19): "I think it should be bitlogin. As the central auth for any
bitlogin system including bitportal."

That is the better place, for three reasons:

- **The page that holds a key should be the smallest there is.** BitPortal
  is a large application: a 3D engine, relays, other people's names and
  pictures. Every part of it is somewhere a fault could be. BitLogin's own
  site does one thing.
- **One address is one identity.** A passkey belongs to the address it was
  made at. One sign-in address means one passkey, one sign-in for a device,
  and the same person in every app.
- **BitPortal stops being special.** It asks, like any app.

What follows from it:

1. **The signer and the window move to BitLogin's site.** They were
   written to: BitLogin's `docs/sign-in-window.md` describes them as a
   deployment's own pages. BitPortal's copies are a first version, tried
   and working, and are not shipped.
2. **BitPortal becomes an app that asks.** It signs passes, a sealed
   settings note and the announcements of worlds, none of which a world may
   have signed. So it needs what every app needs ("Apps that aren't
   worlds", above), and keeps its own sign-in until that exists.
3. **A world finds the signer through its visitor's client,** which today
   means "beside the Airlock". With the signer at BitLogin, the client says
   where it is. How (a field in the arrival, or a fixed place the client
   answers at) is decided when it is built.
4. **BitPortal's sign-in room stops taking a password.** If one address
   takes it, no other may. From a world, typing a password becomes a flat
   page of BitLogin's, on a headset's flat panel too; the way to sign in
   without leaving a world is a passkey, or a phone that approves. This
   goes against the owner's earlier wish for sign-in to be a place in the
   world, and is theirs to weigh.

**Done since (2026-11-19, the owner's "Yes, move them"):** the signer and
the window are pages of BitLogin's own site, on a branch of BitLogin's that
is not pushed (merging BitLogin deploys its site). Its own browser test
makes a throwaway account, opens the window from a site on another origin,
and has a note signed. The flat demo ([`signin-demo/`](signin-demo/)) asks
BitLogin's site now. Worlds still ask BitPortal's unshipped copy: how a
world finds a signer that isn't beside its visitor's Airlock is point 3
above, and is not built.

Still to decide:

| | Decision | Recommendation |
|---|---|---|
| A | The address, for good. Every passkey made there is bound to it: changing it later orphans them all | A domain of its own, kept for nothing else. BitLogin's tests name `bitlogin.network`, which would be exactly that. Beside the apps on `bitblocks.network` a browser would count them as one site, and wall less between them |
| B | Whether it is the only sign-in address, or the default | The default. Anyone can serve BitLogin's static site themselves, and an app lets a person name their own. One address for everyone is one thing to fail, and one thing to attack |
| C | BitLogin's site stops being a demo. Two of its pages change what they allow (its tests pin today's headers), and it becomes what every account depends on | Yes, with the review BitLogin's own documents ask for before it holds more |
| D | Point 4 above | Accept it. A password typed in one known place is the point of all this |

## What was tried

The window (piece 3), with two small sites standing in for a client and a
world, on different sites as a browser counts them, with the walls between
sites' storage on. The pages are in [`handoff-test/`](handoff-test/).

| Check | Chrome 157 | Brave 157 | Firefox 160 |
|---|---|---|---|
| The embedded signer can't see what the client stores | Yes | Yes | Yes |
| Before Allow, the signer refuses to sign | Yes | Yes | Yes |
| The world can't read the signer or the window | Refused | Refused | Refused |
| After Allow, the signer signs | Yes | Yes | Yes |
| The world never sees the session | Never | Never | Never |
| A world posing as the signer: is Allow offered? | No | No | No |
| That world learns anything | Nothing | Nothing | Nothing |

**Not tried:** Safari, any phone, a browser that blocks windows, BitLogin
itself (the test hands over a made-up secret), a world that cuts its link
to windows it opens. A world built for threads in the browser (some Godot
exports) sets headers that do exactly that, and may also refuse the
embedded signer. Such a world falls back to the trip by the crossing's
room.

## Decisions the owner has to make

| # | Decision | Recommendation |
|---|---|---|
| 1 | Two pages of BitPortal change what they allow: one (the signer) may be embedded by any world, and one (the window) keeps its link to the page that opened it. Every other page stays as it is. This is the setting Claude declined to change on its own | Yes. Neither page takes anything on a world's word |
| 2 | The signer in a world signs more than a pass and a look: the classes in "Permissions". This replaces "never a general signer" in the other plan | Yes, with that table as the whole list |
| 3 | The signer keeps the unlocked key in memory while the world's page is open, four hours at most, and never stores it. This replaces "used and dropped" | Yes. Unlocking for every note would be a prompt per note |
| 4 | BitLogin gains the sign-in window mode, and the embedded password widget is for the sign-in address only. Worlds first; other sites after | Yes |
| 5 | After a password sign-in, the window offers a passkey. That needs BitLogin to add a passkey to an account that already exists, which it can't today (a passkey makes an account of its own) | Yes. It is a change to how BitLogin keeps an account, so it goes through BitLogin's own review |
| 6 | The first build is notes only. Budgets and payments are a later plan of their own | Yes |

## What changes, by repository

### BitLogin

It has: sign-in by password, passkey, extension and bunker; a signer with
no interface that can restore a session on its own site; wallet
connections kept in a vault.

It needs:

1. **To hand a session from one of its windows to another on the same
   site,** from the worker that holds the key to the worker that will, so
   the key is never in a page's own memory. This is the window's last step.
2. **A permission list per asking site,** kept by the signer, and a
   refusal that says nothing.
3. **The asking site's address from the browser,** never from the site.
4. **A sign-in window page** a deployment can serve: sign in if needed,
   show who is asking and for what, Allow.
5. **A passkey added to an existing account** (decision 5).
6. Later: the wallet mode in which it pays and the site never sees the
   connection.

This list comes from BitLogin's documents and a first look at its source.
Reading the session code closely is the first step of the work.

### The protocol (this repository)

- NSWP-10 gains "Signing from a world": the signer, the ladder, the
  window, the permission classes, the tag that says which world asked.
- NSWP-09 says what a world may ask for and must never draw.
- The arrival already names the visitor's client. Nothing new travels on a
  link.

### The kit (this repository)

- `portal.sign(note)` and `portal.signer` (locked, unlocked, what would
  unlock it here), the embed, and "Sign in to sign" in the menu's You
  section, the same in every world.
- The chat panel's first use of it: "Also post this as a note".
- The engine script and the Godot addon get the same two calls.

### BitPortal

- The signer page and the window page, and the two settings of decision 1.
- A place in Settings to see which worlds may ask, and take any back.

### The world template

- Its security policy allows the visitor's client to be embedded and a
  window to be opened. Nothing else.

## Order of work

1. Read BitLogin's session code. Correct this plan where it is wrong.
2. BitLogin: the session hand-off and the permission list, tried on their
   own.
3. BitPortal: the signer page and the window page. The same test as
   "What was tried", now with BitLogin.
4. The kit: the embed, `portal.sign`, the menu row.
5. The chat panel posts a note. Two visitors, a relay of the test's own.
6. Extension and bunker (way 3).
7. Passkey (way 2), when the device tests have answers.
8. The documents, schemas and vectors, written with each step.
9. One deploy of everything, on the owner's word.

## Rules that must hold

- Nothing secret is typed into a world: no password, no recovery phrase,
  no key.
- The window gives a session only to a frame of its own site, and only
  after the visitor pressed Allow on a page that showed the world's
  address as the browser gave it.
- The signer signs only for the world the browser says is asking, only
  what that world's permission allows, and never hands out a key.
- The signer stores no key. Closing the world's page locks it.
- A world never learns why it was refused, and never learns whether the
  visitor is signed in at their client until they unlock.
- A link, or anything a world says, never unlocks the signer, never widens
  a permission, and never sets a budget.
- Nothing is spent without a budget the visitor set on a surface the
  client drew. The default budget is nothing.
- A world that can't embed the signer or open the window falls back to the
  trip by the crossing's room. Nothing is ever worse than today.

## What is built (2026-11-19)

The owner said yes to all six decisions. Built since, and tried end to end
on the local server (kit 0.25.0, [the changelog](../../CHANGELOG.md)):

- The signer and the window in BitPortal, the kit's embed, `worldSigner()`,
  "Sign in to sign notes" in every world's menu, and the chat's "Post what
  I write as Nostr notes".
- BitLogin's hand-off, worker to worker, to a session that can only sign.

Where the build differs from the plan above:

- **Permissions live in the client's signer page, not in BitLogin.**
  BitLogin's part is the floor under them: a handed-over session can sign
  and nothing else. The first list is two kinds: a note and a reaction.
  Zap requests wait for budgets.
- **The offer of a passkey isn't shown.** BitLogin can't add a passkey to
  an existing account yet, and a message offering what can't be done would
  be wrong. It waits on decision 5's work in BitLogin.
- **The window never gives Allow the keys unasked,** and ignores a press in
  its first second: a key meant for the world must not land on it.
- **A world on the same site as the client** (the reference worlds, beside
  BitPortal) is not walled off by the browser. The signer treats it like
  any other: it never uses what the browser keeps for the client.
- **BitLogin's change is on a branch, unmerged:** merging BitLogin deploys
  its site, which is the owner's to say. BitPortal's part waits on it.

Not built: ways 2 and 3 (passkey; extension, phone), "careful" kinds,
payments, a headset, the engine script and the Godot addon.

## Open questions

- Whether the window works on Safari and on phones, where a window is a
  tab.
- Whether a headset's browser lets the embedded signer use what the client
  stores once the visitor agrees. If so, a linked headset needs no phone.
- How a note signed from a world should be marked, and whether other Nostr
  clients will show the mark.
- Whether "what is said in rooms" should become notes at all, or stay as
  it is and be posted only when the visitor says so.
- What the default sign-in address is for a BitLogin site that isn't a
  world.
