# In-game sign-in and avatar editing: plan and tests

**Status (2026-11-19):** a plan. Nothing in it is built. Part 1 is a set of
tests for the owner to run on real devices. Part 2 is what gets built once
those tests have answers. Nothing in Part 2 starts before then.

**What exists today:** signing in and changing a look both leave the world.
The world's menu takes the visitor by the crossing's room to BitPortal's
sign-in place or room, and back
([NSWP-10](../../protocol/10-identity.md), "Signing in from inside a world";
[NSWP-05](../../protocol/05-looks.md), "Changing a look"). It is secure, and
the owner has said it is not good enough.

> **See also:** [Signing from inside a world](signing-in-worlds.md), written
> later the same day. It widens what the in-world signer may sign, adds a
> password fallback in a window of the visitor's client, and replaces two of
> this plan's rules ("never a general signer", "used and dropped") if the
> owner agrees to its decisions 2 and 3.

## What the owner asked for

1. Signing in (BitLogin) and editing the avatar happen **in-game**: in the
   same menu as everything else, with no trip out of the world.
2. It works **the same in every world**, on any domain.
3. It works on **phone, desk and headset**.
4. It is the **most secure** way that meets 1 to 3. Nostr notes may be used,
   and BitLogin may be changed.

## The rule the design follows from

A world's menu is drawn by the world's own page, and in a headset nothing
else can draw at all. So whatever is typed into that menu, the world's code
can read. Therefore:

> **The in-game menu never takes a secret. It only asks. Something the world
> can't touch answers.**

That rules out typing a password in-game, on any device, for good. It leaves
three things that can answer, and all three give the world the same thing it
gets at a door today: a pass for that one world
([NSWP-10](../../protocol/10-identity.md), "The pass").

| What answers | When | What the visitor does |
|---|---|---|
| Their own client, at the door | They are already signed in on this device | Nothing. This is "Signed in everywhere", and it is built |
| The device's passkey | They are not signed in on this device, or want to switch | One fingerprint, face or PIN, on a prompt the browser draws |
| Another device of theirs | No passkey prompt is possible (perhaps a headset) | Approve on their phone |

## The design in short

### Sign-in

- "Sign in" is an ordinary row in the kit's menu, the same in every world.
- The kit embeds a **hidden component served by the visitor's own client**
  (for BitPortal, a page of BitPortal's). It has no interface. The world
  can't read it or script it.
- Asked to sign in, the component asks the browser for the visitor's
  **passkey**. The browser draws that prompt, and binds it to the client's
  address, so a fake can't get one.
- BitLogin already derives a login from a passkey's secret, and already
  keeps the encrypted account on relays. So the component, holding the
  passkey's secret, fetches the account, unlocks it, signs **one pass for
  the world that asked**, and forgets the key.
- The pass goes to the world as a message. The world applies it live: no
  reload, no elevator.
- Nothing depends on browser storage, which browsers wall off between
  sites. That is what makes it the same on every domain.

### Avatar

- The look editor (the "Your look" controls now in BitPortal's room) moves
  into the kit's menu, in every world. The visitor's figure changes live.
- What is edited in a world is a **draft**, worn there at once.
- It becomes the visitor's look everywhere only after **one press on a
  surface their client draws**: their next door shows the new figure and
  asks "Keep it everywhere?". Without that press a hostile world could put
  a look on a visitor and follow them by it.
- Once kept, it is a signed Nostr note and part of the sealed settings
  note, so it follows them across worlds and devices.

### Headset

Unknown until tested (Part 1, test C). If a passkey prompt can appear during
a VR session, a headset is the same as every other device. If not, see
"If a test fails", below.

## What is already known

Tested on 2026-11-19 with two local sites on different domains and each
browser's own **simulated** passkey device. This checks the browsers'
rules, not a real fingerprint prompt.

| Check | Chrome 157 | Firefox 160 |
|---|---|---|
| A component embedded from another site can ask for the passkey | Yes | Yes |
| It gets the same secret as on the client's own page | Yes | Yes |
| No press inside the component is needed: a press in the world's menu is enough | Yes | Yes |
| The signed answer records which world asked | Yes | Yes |
| Refused unless the world explicitly allows it | Yes | Yes |
| Works with the cross-site storage wall in place | Not shown: the test browser had the wall off | Yes |

Looked up, not tested:

- **Safari, and so every iPhone browser:** sources disagree. Google's guide
  lists Safari as not supporting passkeys from an embedded component. A May
  2026 vendor FAQ says it does for signing in, not for creating one. **This
  is the biggest open risk.**
- **The passkey's secret (the "PRF" feature BitLogin relies on):** reported
  solid on Android; on Apple from macOS 15 and iOS 18.4; on Windows Hello
  only since a February 2026 update; not on Firefox for Android. Secondary
  sources.
- **Quest:** passkeys work on Quest by approving on a phone over Bluetooth.
  Nothing found on whether a prompt can appear during a VR session.

Sources are at the end.

---

# Part 1: the tests

These need real devices. They are the owner's to run.

## The test pages

Two small pages on two different sites. They sign in to nothing and send
nothing anywhere: every result stays on the page until it is copied.

| | Address | Stands in for |
|---|---|---|
| Page 1 | https://nswp-passkey-client.vercel.app | BitPortal (the client) |
| Page 2 | https://nswp-passkey-world.vercel.app | Any world, on another domain |

Their source is in [`passkey-test/`](passkey-test/README.md), with how to
put them up again if they have been taken down.

Each device that is tested ends up with one test passkey, called **NSWP
passkey test**. Delete it in the device's passkey settings afterwards.

## What to press

Start on **page 2** on the device being tested.

1. Tap **page 1** in the first sentence.
2. Press **1. Make a test passkey**. Approve the prompt.
3. Press **2. Use it here**. Approve again. Note the `secret` mark: eight
   letters and digits.
4. Tap **page 2: the world** to go back.
5. Press **A. Ask from the world's own menu**. Approve the prompt if one
   appears.
6. If nothing appears within a few seconds, press **B**, inside the dashed
   box.
7. Press **Copy results** and keep them (paste them into the table below,
   or to Claude).

On a headset, do 1 to 7 on the flat browser first. Then:

8. Press **C. Headset only: enter VR, then pull the trigger**.
9. In VR there is one flat colour. Pull the trigger once and watch it.

   | Colour | Meaning |
   |---|---|
   | Grey | Waiting for the trigger |
   | Blue | It asked for the passkey |
   | Green | It got it |
   | Red | Refused, or failed |

10. Note whether a prompt appeared, where (in VR, or on a flat panel), and
    whether VR was still running afterwards.
11. Leave VR with the headset's own button. Press **Copy results**.

## How to read a result

A result line looks like this:

```text
result: {"how":"A: pressed in the world's own menu","asker":"https://nswp-passkey-world.vercel.app",
"storage":"walled off from what the client kept on its own page","ok":true,"secret":"3df8d3a2",
"signedFor":"https://nswp-passkey-client.vercel.app","embedded":true,"askedBy":"https://nswp-passkey-world.vercel.app"}
```

| Field | Success looks like | If not |
|---|---|---|
| `ok` | `true` | `false` comes with `error`. `NotAllowedError` means the browser refused or the prompt was cancelled. Note the `message` |
| `secret` | The **same eight characters** as step 3 on this device | `none` means the passkey gives no secret on this device: BitLogin's passkey sign-in can't work here |
| `signedFor` | The client's address (page 1) | Anything else is a fault in the test |
| `embedded` | `true` | `false` on page 2 would mean the browser doesn't mark embedded requests |
| `askedBy` | The world's address (page 2) | `null` means this browser doesn't record who asked. Not fatal: it is an extra safeguard |
| `storage` | Either answer is fine. "walled off" is what a normal browser says | Nothing depends on it |

On page 1, the line `this browser says` reports `secretFeature` and
`fromAPhone`. `true` for `secretFeature` is what is wanted.

## What to test, and what success is

Fill this in. One row per device and browser.

| # | Device and browser | Why it matters | Step 2: `secret` | A works | B works | Same `secret` | Notes |
|---|---|---|---|---|---|---|---|
| 1 | iPhone, Safari (note the iOS version) | The biggest unknown. Every iPhone browser is Safari underneath | | | | | |
| 2 | Android phone, Chrome | Expected to work. Confirms a real fingerprint prompt | | | | | |
| 3 | The desk computer, Brave or Chrome | Linux has no built-in passkey, so this should offer "use a phone": tests the phone-over-Bluetooth route | | | | | |
| 4 | The desk computer, Firefox | Same, in the other engine | | | | | |
| 5 | A Mac, Safari (if there is one) | Safari on a desk | | | | | |
| 6 | Headset, flat browser | Can a headset make and use a passkey at all | | | | | |
| 7 | Headset, in VR (test C) | Can a prompt appear during a VR session | colour: | prompt seen: | VR survived: | | |

Two extra checks, if the devices allow:

- **Synced passkeys.** Make the passkey on one Apple device (or one Android
  device) and, without making another, press **2. Use it here** on a second
  device signed in to the same Apple or Google account. Success: the same
  `secret`. That is what lets a new device sign in with no setup.
- **A passkey for the real account.** On BitPortal's sign-in page, see
  whether BitLogin offers to add a passkey to your existing account, and
  add one. Nothing in this plan works for an account with only a password.

### Success, in one line each

| Test | Success |
|---|---|
| Rows 1 to 6, step 2 | A `secret` mark is shown, not `none` |
| Rows 1 to 6, A | `ok: true` and the same `secret` as step 2, with **no press inside the dashed box** |
| Rows 1 to 6, B (only if A failed) | `ok: true` and the same `secret` |
| Row 7 | Green, with VR still running afterwards |

### What each outcome means for the plan

| Outcome | Meaning |
|---|---|
| A works everywhere | Build as written. "Sign in" is a plain menu row on every flat device |
| A fails but B works (likely Safari) | Still buildable. On that browser the "Sign in" row has to be the client's own component, drawn to look like a menu row, so the press lands inside it. Same look, more work, and it can't be done in VR |
| Neither works on iPhone | Passkeys can't be used in-game on iPhone. See "If a test fails" |
| `secret` is `none` somewhere | That device can't use BitLogin's passkey sign-in. It signs in once at BitPortal and relies on "Signed in everywhere" |
| Row 7 is green and VR survived | A headset is the same as every other device |
| Row 7 is red, or blue for ever, or VR ended | No passkey in VR. A headset is linked once instead. See "If a test fails" |

## If a test fails

Decided now, so a failed test changes the plan and doesn't stop it.

**iPhone can't do it embedded.** Options, best first:

1. The "Sign in" row opens the client in a small window of its own, where
   the passkey works because the client is the page. The world stays loaded
   behind it and gets the pass when the window closes. Not in the menu, but
   no elevator and no reload.
2. Keep today's trip by the crossing's room on iPhone only.

**No passkey prompt in VR.** Options:

1. **Recommended:** a headset is linked once, in the visitor's own BitPortal
   room in VR, by approving a code on their phone. After that it is signed
   in everywhere, like any device. In other worlds an unlinked headset is
   told to go and link.
2. Approving a code from inside any world. It is fully in-game, and it is
   weaker: a hostile world can show a code for a different world, and get up
   to an hour of being the visitor there. Not recommended. It is the only
   fully in-world choice if passkeys don't work in VR.

**Linking a headset** needs one new thing: the visitor's identity signs a
note saying a device's own key may issue passes for them, until a date, and
may be taken back. A pass then carries that note. This is a protocol change
([NSWP-10](../../protocol/10-identity.md)) and is only built if test C
fails.

## Tidying up after the tests

- Delete the passkey **NSWP passkey test** on each device.
- Delete the two Vercel projects `nswp-passkey-client` and
  `nswp-passkey-world`, or leave them: they do nothing but run the test.

---

# Part 2: what gets built, once the tests pass

## Decisions the owner still has to make

| # | Decision | Recommendation |
|---|---|---|
| 1 | Let one page of BitPortal be embedded by any world. Every other page stays unembeddable. This is the security setting Claude declined to change on its own | Yes: the design needs it, and that page has no interface to trick anyone with |
| 2 | Let every world embed its visitor's client, and let that client ask for a passkey there | Yes: a world's own security policy has to say so |
| 3 | Passwords are never typed in-game. People with only a password add a passkey once, or sign in once at BitPortal | Yes. It is the rule the whole design rests on |
| 4 | A look edited in a world is kept after one press at the next door | Yes. The alternative is keeping it silently from worlds on BitPortal's list, with an undo. Smoother, and it trusts listed worlds not to forge a look |
| 5 | The headset fallback, if test C fails | Link once in the BitPortal room |

## What changes, by repository

### BitLogin

It already has: passkey sign-in that derives the login from the passkey's
secret; the encrypted account on relays; a headless signer that can restore
a session.

It needs:

1. **To start a session from a passkey with no stored state.** Embedded in
   another site, its storage is walled off, so it starts from the passkey
   and the relays every time. Today's headless signer can restore a session
   and can't start one.
2. **A narrow mode for use inside a world.** It can do two things only:
   sign a pass (kind 27300) for the world that is asking, and sign a look
   note. It is never a general signer there, and never hands out a key.
3. **To take the asking world's address from the browser.** From what the
   browser reports for the message and in the passkey's signed answer.
   Never from what the world says about itself.
4. **An easy "add a passkey" for accounts that have only a password.**

This is inferred from the copy of BitLogin vendored into BitPortal. Reading
BitLogin's own source is the first step of the work, and may change this
list.

### The protocol (this repository)

- **[NSWP-10](../../protocol/10-identity.md):** a new section, "Signing in
  without leaving", beside "Signing in from inside a world", which stays as
  the way for a client that hasn't got this. It says: what the component
  is, the messages below, that the pass is the same pass, and the rules.
- **[NSWP-05](../../protocol/05-looks.md):** "Changing a look" changes. A
  world may now *edit a draft*. It still never keeps one. The draft goes
  out on the door link as a proposal, and the client keeps it only on the
  visitor's own press.
- **[NSWP-02](../../protocol/02-doors.md):** a `look=` flag for the
  proposal, with the rule that a client never applies it unseen. The same
  shape as `blocked=`.
- **[NSWP-11](../../protocol/11-the-visitors-console.md):** the new menu
  rows, and the standard "Your look" section in every world.
- Schema, vectors and `@nswp/core` together, as always.

**The messages (draft).** Between a world's page and the client's
component. Each side checks the other's address as the browser reports it.

| From | Message | Meaning |
|---|---|---|
| World | `nswp:who?` | Say whether a passkey could be asked for here. No prompt |
| Component | `nswp:who` with `can: true or false` | The answer |
| World | `nswp:sign-in` | The visitor pressed "Sign in" |
| Component | `nswp:pass` with `pass`, `sessionKey` | A pass for this world, as at arrival |
| Component | `nswp:no` with a `code` | Cancelled, refused, no passkey, or the world isn't verified |
| World | `nswp:keep-look` with the draft | Flat screens only: ask the component to keep a look now (optional, later) |

The world checks a pass exactly as it checks one from an arrival. A
component can only ever hand over what an Airlock could have.

### The kit (this repository)

- **A hidden embed of the visitor's client**, added by `arrival.read()` when
  they came through a client that says it has the component. Removed if the
  client doesn't answer.
- **The menu rows under "You".** "Sign in" becomes: ask the component;
  if it can't (no passkey here, an older client), fall back to today's trip
  by the crossing's room. So nothing gets worse anywhere.
- **Applying a pass live:** the room, the name over the visitor's figure and
  the menu's words all follow, with no reload.
- **The look editor moves into the kit** (`ui/figure-editor.ts`, from
  BitPortal's `walk/you.ts` and `shared/look.ts`): the "Your look" section,
  the visitor's own figure shown to them, the same on every device. The
  draft goes out through `currentSettings`' neighbour, a new `currentLook()`.
- **The engine script and the Godot addon** get the same: `NSWP.signIn()`
  asks the component first; a `pass` event when one arrives; the look
  editor's controls through `view()` and `run()` as now.
- **Each world's security policy** (the template's and the reference
  builds') allows embedding the visitor's client and delegates the passkey.

### BitPortal

- **The component page** (`/in/`): no interface, loads BitLogin's narrow
  mode, answers the messages above. It is the one page that may be
  embedded.
- **It checks the world before signing**, as the Airlock does: the site's
  manifest names the publisher, and BitPortal's host policy allows it. An
  unverified world gets `nswp:no`.
- **The Airlock** shows a proposed look and asks, once, with both figures
  drawn. It never keeps one unseen, and going straight through never skips
  the question.
- **Finishing a first sign-in.** Someone who first signed in on a device
  from inside a world is asked for one more passkey press at their next
  door, so the device itself is signed in. Once per device.
- **The look as a signed note** (kind 37301, already in NSWP-05) for someone
  signed in, published by BitPortal, as well as the sealed settings note.
- The sign-in place and the room's look editor stay, as the fallback and
  for anyone who starts there.

### The world template

Takes all of the above in through `npm run update`
([keeping-up.md](../keeping-up.md)).

## Order of work

Each step ends with something that can be tried.

1. **Read BitLogin's source**, and confirm or correct the list above.
2. **BitLogin's narrow mode**, tried on its own with a simulated passkey.
3. **The component page in BitPortal and the kit's embed**, with the
   messages. First thing to try: sign in from the Tour's menu with a real
   passkey, on the desk.
4. **Applying a pass live in the kit.**
5. **The look editor in the kit**, and the proposal at the door.
6. **The engine script and Godot.**
7. **The headset path**, whichever one test C chose.
8. **The protocol documents, schemas and vectors**, written with each step
   and finished here.
9. **One deploy of everything together**, on the owner's word.

## How it will be checked

- Unit tests for every rule in the next section.
- Browser tests in Chrome and Firefox with simulated passkeys, across two
  sites, as the tests above were run.
- **What only the owner can check:** a real passkey on each device, a real
  BitLogin account (Claude may not create or sign in to one), Safari, a
  headset.

## Rules that must hold

For whoever builds this, and for review.

- The in-game menu never asks for, shows or relays a password, a recovery
  phrase or a key.
- The component signs a pass only for the address the browser says is
  asking, only for a verified world, and only after a passkey prompt. It
  never signs on a message alone.
- The component is never a general signer. Two kinds of note, nothing else.
- The key the component unlocks is used and dropped. It is never stored in
  the component's walled-off storage, and never leaves it.
- A world never keeps a look. A client never applies a proposed look
  unseen.
- A world that isn't allowed, or a client that hasn't got this, falls back
  to the trip by the crossing's room. Nothing is ever worse than today.
- Only one page of the client may be embedded, and it has no interface.
- A link, or anything a world says, never signs anyone in and never chooses
  "by name".

## Open questions

- Whether BitLogin's passkey sign-in, as built, works embedded. The tests
  above use the browser's passkey feature directly, not BitLogin.
- Whether a pass should say it was issued in-game, so a room can tell.
- How often a passkey prompt is acceptable. One per world per four hours
  until the device is signed in, then none.
- Whether a look's signed note should be readable by worlds directly, so a
  world can draw a visitor who has just arrived by name without the look
  being in the arrival.

## Sources

- [Passkeys within iframes (web.dev)](https://web.dev/articles/webauthn-within-iframe)
- [Cross-origin iframe passkey challenges (Corbado)](https://www.corbado.com/faq/cross-origin-iframe-passkey-challenges)
- [WebKit bug 222240](https://bugs.webkit.org/show_bug.cgi?id=222240)
- [Passkeys and the PRF extension (Corbado)](https://www.corbado.com/blog/passkeys-prf-webauthn)
- [Passkey support matrix (MojoAuth)](https://mojoauth.com/blog/passkey-support-matrix-browser-os-feature-support)
- [Cross-device passkey authentication for XR devices (Meta Engineering)](https://engineering.fb.com/2026/02/04/security/cross-device-passkey-authentication-for-xr-devices-meta-quest/)
