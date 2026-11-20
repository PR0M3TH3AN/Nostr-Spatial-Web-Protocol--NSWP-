# Integrating a world

Everything a world needs to join the open spatial web and be good to arrive
in, in one place: what is required, what comes ready-made, and what you may
replace with your own.

There are two lists and they should not be confused.

- **The agreement.** A short list of things every world does, so that a
  visitor can cross between worlds made by strangers and still know where
  they are, how to leave, and that their own controls are theirs. You keep
  it or you are not a world on this web.
- **The defaults.** What the reference kit draws and plays so that you
  needn't: the menu, the sounds, the doorway, the way people move, how they
  look. Every one of these is yours to keep, restyle or replace.

## The agreement: required

| # | A world | Where it is written |
|---|---|---|
| 1 | Is an `https` site that says whose key may announce it (`/.well-known/nswp.json`) | [NSWP-01](../protocol/01-worlds.md) |
| 2 | Is announced with a signed note | [NSWP-01](../protocol/01-worlds.md), [add-your-site.md](add-your-site.md) |
| 3 | Reads how the visitor arrived, takes it out of the address, and keeps it nowhere | [NSWP-03](../protocol/03-arrival.md) |
| 4 | Sends visitors on through their own Airlock, never by itself | [NSWP-02](../protocol/02-doors.md) |
| 5 | Offers the way home wherever a visitor can reach it | [NSWP-02](../protocol/02-doors.md), [NSWP-09](../protocol/09-what-a-world-owes.md) |
| 6 | Never asks for a password, a key or a sign-in | [NSWP-09](../protocol/09-what-a-world-owes.md), [NSWP-10](../protocol/10-identity.md) |
| 7 | Lets a visitor summon their own controls, with the gesture that is theirs in every world, and uses that gesture for nothing else | [NSWP-11](../protocol/11-the-visitors-console.md) |
| 8 | Leaves nothing behind when those controls are put away | [NSWP-11](../protocol/11-the-visitors-console.md) |
| 9 | Starts a visitor in the form they left the last world in, where their device can | [NSWP-11](../protocol/11-the-visitors-console.md) |
| 10 | Starts from the settings they arrived with, and sends on what they have | [NSWP-11](../protocol/11-the-visitors-console.md) |
| 11 | Connects them to nobody they have blocked, and joins them to nobody on a link's word alone | [NSWP-02](../protocol/02-doors.md), [NSWP-06](../protocol/06-rooms.md) |

The first two are a file and a command. A world built with the template,
the kit or the engine script keeps the other nine without writing a line
for them. A world built from nothing keeps them by doing what those
documents say.

### Signing in is not a world's job

Who a visitor is belongs to the visitor, and they sign in at their own
sign-in address, which their client names. A world never shows a sign-in,
never holds a key and never needs to: for a visitor who chose to be known
by name, the world holds a pass that says so, made for that world and that
visit ([NSWP-10](../protocol/10-identity.md)).

In BitPortal, signing in is **BitLogin**. That is not one of the things a
world may replace, restyle or stand in for, because it isn't in a world at
all: it is at BitLogin's own address, `bitlogin.network`, in a window of its
own, and nowhere else. No page of BitPortal has a sign-in form either. A
visitor may also stay anonymous, and a world treats a guest as a full
visitor.

**A visitor signs in from inside your world.** The console has a row for it
under "You": "Sign in, at bitlogin.network". Pressing it opens a window at
the visitor's own sign-in address, where they sign in and say yes. They
never leave your world. Signed in, the row reads "Signed in as Alice. Sign
out here", under a card with their picture, name and key. A world built
with the kit or the template has it without a line of code; for another
engine, see [other-engines.md](other-engines.md). To put the button
somewhere of your own (a pause menu, a sign on a wall), press the same
control: `controls.run("signer")`. What you may not do is draw the sign-in
itself ([NSWP-10](../protocol/10-identity.md), "Signing from a world" and
"One sign-in"). `hereAs()`, from `nswp-sdk/three`, says who they are.

**They sign in at each world, once.** A visitor arrives from BitPortal as a
guest: its Airlock sends no pass, and tells your world nothing about them
but where their signer is. The first time they sign in at your world, the
window asks them once, and their signer makes the pass. A signer that
remembers your world answers as the page loads the next time, with nothing
pressed. Your world never has a sign-in of its own to keep in step with
anyone else's. A client that names no signer may still send a pass with the
visitor on arrival, and offers the way to that client under "You" instead
(`controls.run("identity")`, `portal.signIn()`). `hereAs()` is who they are
either way.

**Their name and picture are Nostr's.** A visitor who comes by name brings
the name and the picture from their Nostr profile, on the pass their own key
signed. The kit shows the picture over their name, and pressing it chooses
them. You do nothing for it. If you draw people yourself: `member.name` and
`member.picture` are there once their pass has checked out, `loadPicture()`
fetches a picture safely and respects the visitor's switch, and you never
ask a relay about your visitors ([NSWP-10](../protocol/10-identity.md),
"Pictures").

**Their look is the same.** "Change how you look" is beside "Sign in". It
leaves for their own client and comes back wearing it. Draw
their look your own way if your world has a style, but never edit it or send
one back ([NSWP-05](../protocol/05-looks.md), "Changing a look").

The protocol itself names no sign-in. Another client may use another signer.
What every client and every world share is the pass.

## The defaults: optional, and yours to change

Each of these comes with the kit. The middle column is how to change it. The
last is the one thing that has to stay true when you do.

| Default | To change it | What stays true |
|---|---|---|
| **The menu** (the visitor's console): the way home, sound, how they move, fullscreen, the way into VR | `controls.setPresence("quiet")` or `"hidden"`; `controls.claimInput(true)`; add sections of your own; or draw your own from `controls.view()` ([controls-kit.md](controls-kit.md)) | The visitor's things stay in it, and the summons still brings it up ([NSWP-11](../protocol/11-the-visitors-console.md)) |
| **Sounds**: seventeen cues, a room's hum | Name your own file for any cue, or `null` for silence, in the world's settings ([controls-kit.md](controls-kit.md), "Sound") | The visitor's volumes are theirs. Footsteps stay quieter than everything else |
| **Music**: a piece every world starts with | Name your own pieces, or `null` for none. Give the files names worth reading: the menu shows which is playing | The visitor can turn it off, and their own music is theirs |
| **The doorway** | Draw your own. In Godot, `NswpPortal` in place of `NswpGate`; in Three.js, your own mesh with `portal.go()` | It says where it leads, by whose site it is. It answers only from near it. Walking in goes through |
| **Moving**: casual and intense, running, jumping, how far a press reaches | Your own controls. Read the kit's numbers (`NSWP.kit()`, `Nswp.kit`) or choose your own | Nothing slides unless the visitor asked. Their choice of casual or intense is carried on |
| **Marks on the floor**: where a press would lead, and the way there | Leave them out, or draw your own | They are for that visitor alone |
| **The crossing's room**, which stands round a visitor as they leave by choosing a door, and as they arrive | Leave it out, or draw your own | It never asks for anything, and never says a destination is verified ([NSWP-02](../protocol/02-doors.md), "The chamber") |
| **How visitors look**: a figure drawn from each visitor's own look | Re-dress it in your own materials, recast it as something of your own, or make everyone the same ([NSWP-05](../protocol/05-looks.md), "What a world may change") | A visitor's mark stays recognisable wherever visitors are told apart |
| **Rooms**: seeing and hearing each other | Your own, or none | A microphone, a block and joining keep their own rules ([NSWP-06](../protocol/06-rooms.md)) |
| **Panels, the jukebox, the camera** | Leave out what you don't want | What a visitor keeps stays in their browser |

### The visitor's things, in your own interface

You don't have to choose between the kit's menu and none. Any of the
visitor's things can go into a menu, a wall or a wrist of your own, drawn
your own way: the way home on your pause screen, their volumes in your
settings, a button that brings their whole console up. Behind each is the
same thing the console has, so it uses the visitor's own settings and their
own home ([NSWP-11](../protocol/11-the-visitors-console.md), "Drawing it
yourself").

```js
const { sections, hotbar } = controls.view();      // everything, with the words as they stand now
controls.run("home");                              // their home, wherever their own client says that is
controls.run("sound-music");                       // their music volume: the console shows the same
hud.setOpen(true);                                 // bring the whole console up from a button of your own
controls.subscribe(() => redrawMyMenu(controls.view()));
```

In another engine: `NSWP.view()`, `NSWP.run("home")`, `NSWP.open("1")` and
the `changed` event. In Godot: `Nswp.console_view()`, `Nswp.run("home")`,
`Nswp.open_console()` and `console_changed`.

"World skin" is all of the above together: a world with its own doorway, its
own sounds and music, its own look for its visitors and its own interface on
screen is still a world on this web, as long as the agreement holds.

## Four ways to build

| You have | Use | You write |
|---|---|---|
| Nothing yet | [`nswp-world-template`](https://github.com/PR0M3TH3AN/nswp-world-template): copy it, edit one scene file | The place |
| A Three.js site | The kit (`nswp-sdk`): [controls-kit.md](controls-kit.md), [add-your-site.md](add-your-site.md) | A few lines where you start up, and one per door |
| A Godot project, or another engine that exports to a web page | The engine script and, for Godot, the addon: [other-engines.md](other-engines.md) | The place. The menu, the sounds and the standard doorway come with it |
| A site you want to keep exactly as it is | The protocol alone: the documents in [`protocol/`](../protocol/README.md) | Everything in the agreement, yourself |

## What goes with a visitor

Everything a world tells the next place about its visitor goes on the link
to their Airlock, after the `#`. Their client decides what to pass on, and
the next world reads it from the arrival context. A world never reads
another world's link.

| On the link | In the arrival | What it is | Asked about? |
|---|---|---|---|
| `entry` | `entry` | Where in the next world to arrive | No |
| `xr=1` | `immersive` | They left a headset session | No |
| `form` | `form` | Touch screen or desk | No |
| `moving=intense` | `moving` | How they move | No |
| `set` | `settings` | Volumes, text size, motion, a headset's hands, the screen filled, the tabs kept on their bar | No |
| `joined=1` | `joined` | They were in a room | Shown, and theirs to untick |
| `mic=1` | `mic` | Their microphone was on | Off until they say it may be |
| `blocked` | `blocked` | Who they blocked | Shown who, and theirs to tick |
| | `look` | How they chose to be seen | Their choice at the Airlock |
| | `pass`, `sessionKey` | Who they are, from a client that sends them by name. BitPortal sends neither: their signer makes the pass at your world, when they sign in there | Their choice at the Airlock |
| | `signer` | Where their signer is: the address the "Sign in" row opens a window at | No |
| | `airlock` | Where to send them back through | No |
| | `home` | This world is where they start | No |

A visitor's client may also keep their settings with their profile, so
another device starts from them (BitPortal does, sealed, when asked). That
is between a visitor and their client. A world never reads it: the arrival
is the only place a world learns anything about its visitor.

The top five are preferences: a false one has changed a setting. The rest
are things a visitor decides, and a world acts on them only as they arrive
in the arrival context, never as a link says them.

## Saying what devices a world is for, and being checked

A world says what it is for in its announcement: `mode` (`immersive-vr`,
`inline-3d`, `2d`) and `perf` (`mobile`, `standalone`, `desktop`). That is
its maker's word, and a client shows it as that.

Whoever lists worlds can also look for themselves:

```bash
node scripts/probe-world.mjs https://your-world.example/
```

It visits the world on a phone-sized touch screen, at a desk, and with a
made-up headset, and says for each whether the world loaded and drew
(`works`), didn't load at all (`fails`), or couldn't be confirmed either
way. BitPortal runs it over its list and tells a visitor, at the Airlock,
what it found before what the world's maker says. A world is never called
broken for something only a software renderer or a made-up headset might get
wrong, so "couldn't be confirmed" is common and means only that.

An Airlock can't do this at the moment of crossing. Loading a world is
visiting it, and the visit is what the Airlock is there to ask about.

## Checking your own world

| What | How |
|---|---|
| The announcement and the manifest, and how old its kit is | `nswp check <address>` |
| Whether a newer kit is out, for a world from the template | `npm run update -- --check`; `npm run update` takes it in ([keeping-up.md](keeping-up.md)) |
| Each form a visitor can be in | `node scripts/probe-world.mjs <address>` |
| The whole journey, on your own machine | [local-server.md](local-server.md): links between the sites served there lead to those copies |
| A headset | [headset-checklist.md](headset-checklist.md) |
| The agreement, by hand | Hide the menu, claim the keys, and press the key left of 1. Go through a door with the music turned down and see that it still is |
