# What a game world like COMBATRIG needs from the kit

- **Asked:** 2026-11-21. The owner wants COMBATRIG (their multiplayer mech
  game) to become a BitPortal world people play together in, with a seated
  VR cockpit, "and wants BitPortal improved so games like ours integrate
  without friction" (the COMBATRIG dispatcher's words for the owner's ask).
  Asked which headset to aim at, the owner said "whatever BitPortal would
  need, ask the BitPortal Orchestrator".
- **Who:** the kit (NSWP builder, BitPortal session) for the gaps; the
  COMBATRIG "BitPortal world & VR" session for COMBATRIG itself (bitp-1, a
  verified door, 12-01; bitp-2, arrival through doors, 12-08; bitp-3, a VR
  cockpit prototype, 12-15).
- **State:** asked (the orchestrator answered COMBATRIG's questions; the
  gaps below are not briefed)

## The orchestrator's answers

- **Headset first:** Meta Quest 3 and 3S, in Meta's own browser,
  standalone. That is what the owner has, what BitPortal's VR is tried on
  (the guided headset test, run 36NOPX), and what most visitors will
  bring. PC VR in a desktop browser second. COMBATRIG's flat frames today
  (48 to 63 ms, 450 to 1000 draws) are far from what a Quest needs (about
  14 ms at 72 Hz), so bitp-3 is about performance first.
- **Pointer lock:** drag to look and full menus until the first click,
  with no splash and no "click to begin", and the pointer taken on that
  first click in the game, is what the kit's own intense way of moving
  does, and is right. Also: read the visitor's choice of casual or intense
  as it arrives (`intense` in the settings, asked once since kit 0.76.0),
  and never take the gesture that opens the visitor's console (NSWP-09).
- **The kit:** the world template's `vendor/nswp` at a kit version, with
  its `integrity.json`, copied whole and updated by copying again; not
  built from `packages/sdk`.

## The gaps, in the order COMBATRIG needs them

| Gap | Where it stands | When |
|---|---|---|
| A presence source: a world with its own netcode and voice feeds the kit's room, microphone and recording signs and its leave and mute | COMBATRIG reported 2026-11-23 (below); the shape is the client's menu's step 3, built then | first (bitp-2) |
| A seated or vehicle mode: a seat anchor, recentring, a comfort vignette, smooth movement asked for at the Airlock through the world's comfort notes (`comfort.seated` exists in the announcement) | designed, waiting for the orchestrator's names: [`docs/plans/seated-mode.md`](../plans/seated-mode.md); touches "never slide unasked" | second (bitp-3) |
| A "you're in, still loading" signal, and the Airlock reading `budgets.initial_download_mb` (the manifest already carries it) | merged 2026-11-22: kit 0.80.0 (`controls.setLoading`, engine `loading`/`loaded`, `worldDownload`), the engine script's console from the first moment (NSWP 311), the Airlock's line (BitPortal 192); not live | done |
| Touch sticks and dragging to look up and down | being looked into (`touch-look-and-item-presses`) | with that |
| A 3D panel for a cockpit's own displays, and a stated rule for a world's own menu | partly: visitors' panels exist; the rule is NSWP-09/11's | later |
| Lever, slider and axis controls | not planned | later |
| Arriving as a group | written in the spec (§9.7), not built; see `rooms-start-or-join` | later |
| A per-world key for saves | tried end to end 2026-11-22 (BitLogin's trial against a kit world); not needed: saves (NSWP-12) go through the visitor's sign-in, and BitLogin's side has been live since 2026-11-20 (the orchestrator said otherwise to COMBATRIG on 2026-11-21, wrongly); a world never gets more than a session key from a pass, by design | available now |
| A TURN relay | see `rooms-stun-servers`; someone has to run and pay for one | the owner's |
| A public template with a game example, and testing on a real headset | the template is public; no game example | later |

## COMBATRIG's presence report (2026-11-23), and the orchestrator's answer

Read from its code at its main ce275a9, not run or measured:

- **Shape:** one host and up to N clients over WebRTC, clients linked only
  to the host, which forwards every voice track. Signalling over Nostr on
  its own relays. A room is one multiplayer session; solo play has none.
- **In a room:** a clean yes or no, with events as it opens and closes.
- **Who:** a roster of `{ id, pubkey, name, chassis, team? }`, with join and
  leave events. Names are the pilot's own callsign and are not pass-checked;
  the key is their BitLogin key or an anonymous one.
- **Our own microphone:** three states: none; armed (a track held, silent);
  live (push-to-talk held).
- **Other people's:** only who is audibly talking now, from metering. No
  signalled state; it offered to add a `mic:<0|1|2>` message per pilot.
- **Recording:** none exists. Photo mode takes stills only.
- **Leave:** abandoning the contract from its pause menu; not confirmed to
  close the session cleanly. A host leaving hands over to another pilot.
- **Mute:** its own mic by dropping the track's `enabled`; per person
  `voice.mute(pubkey, on)` exists with no screen calling it; the host can
  mute and kick.
- **Its suggestion:** the world pushes `setRoom({ in, members, selfMic,
  recording })` on change, and the kit calls back `onLeave()`,
  `onSelfMute(on)`, `onMute(id, on)`.

**Answered the same day:** the shape is right in spirit, and it is not built
yet, because it is the same shape as the client's menu's step 3 ("Rooms and
people, from facts", `docs/plans/the-clients-menu.md`): one shape for the
kit's own rooms and for a world with its own netcode. Settled now: pushed on
change, never polled; a member's id is their key; a name is the world's word
and the kit never takes "verified" from a world (a proven mark comes only
from a pass the kit or client checks itself); the three states of one's own
microphone; a per-person `mic` message is wanted, with `talking` kept;
"nobody recording" is fine while there are no clips; leave is one function
that really closes the session, and a world must also survive the page just
going, since the client's Home is a guarantee; mute as suggested, plus the
visitor's travelling block list, which the world must honour for voice and
names. The words go to COMBATRIG for comment before step 3 is built.
