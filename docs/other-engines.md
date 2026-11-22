# Worlds in other engines

A world is a website. Nothing in the protocol says how it is drawn, and the
reference worlds use Three.js only because something had to. An engine that
can export to a web page can make a world.

## What has to happen, whatever the engine

1. **It is an https site** with `/.well-known/nswp.json`, the file that says
   whose key may announce it ([add-your-site.md](add-your-site.md)).
2. **It is announced** with a signed note. The `nswp` command does this.
3. **It reads how the visitor arrived** from the page's address when it comes
   up, and takes that out of the address
   ([NSWP-03](../protocol/03-arrival.md)).
4. **It sends visitors on** through their own Airlock, with where they are
   going after the `#` ([NSWP-02](../protocol/02-doors.md)).
5. **It offers the way home.**

The first two are files and a command. The last three are a little
JavaScript on the page that holds the engine's canvas.

## The script: `engines/nswp-engine.js`

One file, no rendering, built from `packages/sdk/src/engine.ts` by
`node scripts/build-engine.mjs`. It puts `NSWP` on the page. Every function
takes text and returns text or a yes or no, because text is what every
engine can pass to a page:

| Call | Does |
|---|---|
| `NSWP.start(options)` | Call once. `options` is JSON; `airlock` names the Airlock for a visitor who arrived without one. Returns the arrival. |
| `NSWP.arrival()` | How they arrived, as JSON: `arrived`, `entry`, `immersive`, `home`, `joined`, `mic`, `moving`, `blocked`, `look`, `guest`, `name`, `pubkey`, `canGoHome`. |
| `NSWP.go(destination, state)` | Through a door. `destination` is JSON with `url`, and `naddr` and `entryPoint` if the door has them, and `title`: what the door is called, for the sign in the crossing's room. Returns `""`, or one word for why not. The room shuts round them first, and then the page is left. |
| `NSWP.home(state)` | To their own start. False if there is no way there. |
| `NSWP.doors(state)` | To their doors, for a world that is someone's home. |
| `NSWP.changeLook(state)` | To their own client, to change how they look, and back here wearing it. The menu offers it under "You" and sends a `figure` event when it is pressed. A world never edits a look. |
| `NSWP.signIn(state)` | To their own client, to say who they are, for a visitor whose client named no sign-in address. Where it named one (the reference client does), signing in is the menu's own row, in a window of that address, and they never leave your world: see "The same sign-in" below. False if they came through no client. |
| `NSWP.who()` | Who they are here, now, as JSON: `guest` true, or `name`, `pubkey`, `picture` and `about`. A `who` event says when it changes: they signed in or out in the menu. |
| `NSWP.save(data, slot)` | Keep this text for the visitor, in a slot (`"main"` unless named). On their device at once, and with their account if they are signed in here. A `saved` event says where: `kept` is `account`, `device` or `nowhere`, with `said` as words for them. |
| `NSWP.load(slot)` | Ask for what was kept. A `loaded` event answers: `found`, and then `data`, `at` and `from`. |
| `NSWP.crossing()` | Where the crossing's room is: `"arriving"`, `"opening"`, `"none"`, `"leaving"`, `"shut"` or `"failed"`. A `crossing` event says when it changes. |
| `NSWP.loading(fraction, words?)` | How much of the world has arrived, 0 to 1 (-1 where it can't be said). Before the doors open, the line of light over them fills: the page that starts the engine calls it. Once the visitor is in, it is a line in their menu, with `words` (plain text, at most 80 characters). |
| `NSWP.loaded()` | The world has finished loading: the line in the menu goes. `loading(1)` does the same. |
| `NSWP.ready()` | The world is ready: the room's doors open. Asking for the menu does this by itself, unless it was asked for with `hold` true. |
| `NSWP.failed(words)` | The world couldn't start: the doors stay shut and the sign says why. |

`NSWP.KIT` is the version of the kit the script was built from. Put it in
your manifest as `"kit"`, so a visitor's client can tell how old your
world's controls are, and copy the newer script in when `nswp check` says
there is one ([keeping-up.md](keeping-up.md)).

`NSWP.kit()` has two numbers the visitor sets for themselves, and they are
the same in every world: `lookSpeed` and `dragLook` are already scaled by
how fast they like the view to turn, and `fov` is how wide they asked to see
at a desk, in degrees top to bottom (0 for your world's own). Read `kit()`
again when a `changed` event comes. The menu has the controls for both. The
Godot addon's visitor does this for you.

`state` is JSON saying how they are leaving: `immersive`, `joined`, `mic`,
`moving`, `blocked`. The engine ends a headset session itself before `go`.

It works under a strict content policy (`script-src 'self'`): nothing in it
is evaluated from text.

## The crossing's room, the same at both ends

A visitor who leaves a Three.js world leaves from a small room whose walls
rise round them, and arrives in the next standing in that room, whose doors
open once the world is ready. An engine has two things in the way of that.
It takes a long while to arrive (Godot's is forty megabytes), and what its
export shows meanwhile is the engine's own loading screen.

So the script draws the room itself, flat, as the page: the view from
inside it, facing its doors. It needs no engine and no renderer.

- **It is there from the page's first moment,** before the engine has begun
  to load, wearing the world's name and colour. Those are said on the page,
  since the engine can't say them yet:
  `<meta name="nswp:title" content="My world">` and
  `<meta name="nswp:accent" content="#4cc9f0">`, before the script's tag.
- **The line of light over the doors is the loading bar.** The page that
  starts the engine tells it how far along it is: `NSWP.loading(0.4)`.
- **The doors open when the world asks for its menu,** which is the world
  saying it is up. A world with more to load first asks for the menu with
  `hold` true and calls `NSWP.ready()` when it is.
- **A world that takes a while to be playable** opens the doors as soon as
  there is something to see, and then says what it is still loading:
  `NSWP.loading(0.4, "Loading the arena")`, and `NSWP.loaded()` when it is
  ready to play. A line in the visitor's menu says so, and their menu, the
  way home and everything else work throughout, which they don't in a room
  whose doors are kept shut.
- **Leaving, it comes up again.** `go`, `home` and `doors` bring the room up
  round the visitor, with the door's name and address on the sign, shut its
  doors, and only then leave the page. Give `go` the door's name as `title`.
- **It is scenery, and proves nothing,** as the room it copies is
  ([NSWP-02](../protocol/02-doors.md)). It asks for nothing and has nothing
  in it to press.
- A page that wants none says so on the script's tag:
  `data-crossing="off"`.

Your engine's own loading screen has to go for this to be seen. For Godot
the addon has the page to export with (`addons/nswp/web/shell.html`).

## The same sign-in

The menu has the same sign-in as a Three.js world
([NSWP-10](../protocol/10-identity.md), "One sign-in"): under You, "Sign in,
at bitlogin.network" opens a window of the visitor's own sign-in address.
Signed in, the card at the head of You has their picture, name and key, and
"Signed in as" is said at the top of the view. Your engine is told
(`{"type":"who", ...}`), and `NSWP.who()` says who they are now. A name is
theirs only while they are signed in here: write none over a guest.

It is the same row however the visitor came. Someone a client brought signs
in where that client says. Someone who opened your address themselves signs
in at the address you pass as `signer` to `NSWP.start` (the Godot addon:
the project setting `nswp/signer`, which is BitLogin's unless you change
it; `""` offers none).

## Keeping a visitor's progress

A world with something to remember keeps it as a save
([NSWP-12](../protocol/12-saves.md)): text of its own, 32 KB at most, in a
named slot. `NSWP.save(data, slot)` keeps it on the visitor's device at once,
and with their account if they are signed in here, encrypted so that only
they can read it; then it is there on their next device. `NSWP.load(slot)`
asks for the newer of the two, and a `loaded` event answers. In Godot these
are `Nswp.save(data, slot)` and `Nswp.load_save(slot)`, with the signals
`saved` and `loaded`.

Ask once the menu is up, and again on a `who` event if a save matters to
your world: someone who signs in may have one from another device. Your
world can read its own saves and nobody else's, and never needs to know
where one is kept.

## A paid world's gate

A world that is paid ([NSWP-01](../protocol/01-worlds.md), "A paid world")
has the same gate in any engine as in a Three.js world, because none of it
is drawing ([NSWP-10](../protocol/10-identity.md), "The front room").
`NSWP.gate()`, called once after `start()`, asks what the visitor holds,
reads what is for sale, and puts the one control that asks to buy
(`gate-buy`) in the kit's menu. It returns how the gate stands, and a
`gate` event with the same fields comes whenever that changes. Act on
`open`: while it is false, nobody goes past. It is false until the gate
knows. `why` is why it is shut, in plain words; `offers` is what can be
bought, with `words` such as "500 sats, for 1 hour".

The engine draws the gate and stops the visitor at it: something solid
across the way, wherever the world likes, with everything before it free.
`NSWP.run("gate-buy")` presses the control, for a gate pressed in the
world. What the world is entered by is its own manifest's word (`access`);
a world that isn't paid never calls this, or calls it with
`{"paid":false}` and gets "free" with nothing made, read or asked. A world
never takes the money and never draws the question about paying: the
visitor's own sign-in address does. In Godot: `Nswp.gate(paid)`,
`Nswp.gate_open()`, `Nswp.gate_press()`, and the signal `gate_changed`.

When a timed pass runs out with the visitor inside, `open` stays true for
two minutes (`state` "ending") and then turns false: stand them before the
gate again, and load nothing.

A world that keeps lists (its manifest names `keepers`), whose rooms show
only named people (`named_only`), or that is by invitation
(`by_invitation`), calls `NSWP.gate()` too, paid or not: that
is what reads its own rules ([NSWP-10](../protocol/10-identity.md), "A
world's own lists"). The gate then also shuts for someone its owner keeps
out (`reason` "blocked") or hasn't invited (`reason` "not-invited"), and the room the kit's script keeps for the
engine takes the same rules with nothing more to do.

## The latest, always

Serve your export's page and its scripts with `Cache-Control: no-cache`, as
every world is ([NSWP-09](../protocol/09-what-a-world-owes.md), "They always
get the latest"). The engine and the game's package are large and change
with every export: let a browser ask about those too, and it will be told in
a few bytes when it has the latest. The menu here tells a visitor whose page
has been open since before an update, as a Three.js world's does.

## The same menu and the same sounds

A visitor should find the same controls in every world: the same menu in the
same corner, the same sounds at the volumes they set, the same words. None of
that needs a renderer, so the script carries the reference kit's own menu
(`packages/sdk/src/ui/`) and its own sounds (`packages/sdk/src/sound.ts`),
not copies of them. The menu is drawn by the page over the engine's canvas.

**It is there from the first moment.** While the engine is still arriving,
which can be minutes, the visitor already has their console over the
crossing's room: Home (or their doors, at home), the world's address, and a
line saying it is still loading. The key left of 1, or two fingers held
still, brings it up, as in every world. `NSWP.menu()` fills that same
console in with the world's name, colour and controls; it never makes a
second one. A world that opens its doors without asking for the menu (it
draws its own) sees the early console go as they open. A page with no room
(`data-crossing="off"`) has none.

| Call | Does |
|---|---|
| `NSWP.menu(options)` | Call once. Puts the menu over the canvas and starts the sounds. `options` is JSON: `title`, `accent`, `kit` (where the page serves the kit's sound files), `sounds` (the world's own), `help`. Returns how the visitor starts out moving. |
| `NSWP.events()` | What the visitor did in the menu since the engine last asked, as a JSON list. Ask every frame. |
| `NSWP.play(cue)` | Play a cue by name: `cross`, `arrive`, `hover`, `press` and the rest. |
| `NSWP.moved(metres)` | How far the visitor walked this frame. Their steps are heard. |
| `NSWP.bump()` | They walked into something. |
| `NSWP.say(text)` | A few words shown for a moment. |
| `NSWP.target(name, detail)` | What the visitor is pointing at, shown in a card beside the controls. |
| `NSWP.capturePreview(width)` | For whoever makes the world, called from the page: resolves to its 360° picture (`{ base64, width, height, bytes }`, a WebP file), which a world must have for doors to show ([NSWP-04](../protocol/04-previews.md)). The engine hears `{ type: "preview", size }`, takes six square views from the main entrance at eye height, and answers with `previewFaces`. |
| `NSWP.previewViews()` | The six views, as JSON, in the order to hand them back: each one's `forward` and `up`. 90° wide. |
| `NSWP.previewFaces(faces)` | The six views, as JSON: `faces`, six PNG files as base64. The kit paints them into the picture. Taken with nobody and nothing carried in them, and without fog or glow. |
| `NSWP.headset(state)` | Whether a headset session can start (`supported`), whether one is running (`presenting`), and whether one just failed to start (`failed`). The menu offers the way in. Someone who left a headset to come here is offered it by the page, as in every world: a press anywhere reaches the engine as `{ type: "vr", enter: true }`. |
| `NSWP.door(entry)` | List a door in the menu. |
| `NSWP.view()` | Everything in the visitor's console, as JSON, for an engine that draws some of it in an interface of its own. |
| `NSWP.run(id)` | Press one of them by its id: `home`, `fullscreen`, `sound-music`, `jump`. The same button, with the visitor's own settings and home. |
| `NSWP.open(on)` | Bring the console up, or put it away, from a button of the engine's own. |
| `NSWP.presence(level)` | How much of the screen the controls take: `full`, `quiet` or `hidden`. For an engine with an interface of its own. |
| `NSWP.claim(on)` | Take every key for the game, or give them back. |
| `NSWP.kit()` | The numbers every world shares: walking pace, how far a tap takes a visitor, how a mouse turns the view, the size of the standard doorway. |
| `NSWP.check(url)` | How a door's address should be read on its sign. |
| `NSWP.offers(world)` | What a world offers, for the tiles beside its door: thirteen lines in a set order, each lit or dark with a sentence for it, and a drawing for the eight a door shows. From what the place's announcement says (`modes`, `capabilities`, `items`, `access`), and nothing else. Draw them in that order beside the door, and say the sentence when one is pointed at. |
| `NSWP.gate(options)` | A paid world's gate: what the visitor holds, what is for sale, and `gate-buy` in the menu. Returns JSON (`state`, `open`, `reason`, `why`, `offers`, `until`); a `gate` event with the same fields comes when it changes. `{"paid":false}` makes nothing. See "A paid world's gate" |

The events are `moving` (they chose casual or intense), `menu` (it opened or
closed: stop moving them, and let the pointer go), `vr` (they pressed Enter
VR or Leave VR), `jump` (they pressed Jump, which is how it is asked for
where there is no keyboard), `home`, `doors`, `door`, and `changed`
(something in the console changed: an engine drawing its own reads
`NSWP.view()` again).

**The visitor can always bring the menu up,** whatever level the engine has
set and whatever it has done with the keys: the key left of 1 at a desk, or
two fingers held still on a touch screen
([NSWP-11](../protocol/11-the-visitors-console.md)). The script hears those
before the engine's canvas does, and the engine never hears them. It hears a
`menu` event instead, and should leave the visitor's input alone until the
next one. Never bind that key or that hold to anything in the game.

The visitor's settings travel with them: their volumes, the size of their
text, whether their screen was filled. The script's menu and sounds begin
from what they arrived with and send on what they have, with nothing for
the engine to do. `NSWP.arrival()` gives them as `settings`, for an engine
with an interface of its own.

`NSWP.arrival()` also says the form the visitor is in on a flat screen
(`form`: `touch` or `desk`), so an engine with its own interface can lay it
out the way they were using the last world. The script carries it on through
a door.

The sound files go beside the page, in a folder the engine names (`kit`).
Without them the sounds are the ones the kit makes in the browser.

## Things visitors carry

A visitor has a bag, and may take one thing from it in hand; some things do
something, such as a toy blaster that sends out darts
([NSWP-17](../protocol/17-items.md)). **An item is made once and works in
every world, whatever the world is made with.** It is a signed description,
a model as a binary glTF (which every engine reads), small sounds, and
perhaps a script in plain JavaScript that runs in the browser's own locked
box. There is nothing in one to convert from engine to engine.

So everything about an item that isn't drawing is in the script, and is the
very code a Three.js world runs: the Bag tab, fetching and checking each
file, the item's own logic in its locked box, how what it sends out flies,
and how the visitor is. An engine does only what only it can:

| Call | Does |
|---|---|
| `NSWP.items(options)` | Call once, after `menu`. `options` is JSON: `rule`, what the world's announcement says of items (`allowed`, which is what saying nothing means, or `play`); `box`, where the page serves the locked box (left out, `item-box.html` beside the page; `false` for none); `relays`. The Bag tab joins the menu. |
| `NSWP.frame(view)` | Every frame. `view` is JSON: `dt`; `head` and `turn`, where the visitor's view is and which way it faces (x, y, z, w); `floor`, how high the floor under them is; `fov`; `aspect`; `presenting`; `sighting`; and the engine's answers, `met` and `floors`. Returns what to draw. |
| `NSWP.model(hash)` | A model's bytes as base64, by the hash its file is named by. They have been fetched, checked against that hash and counted. `""` while they are on their way; `"!"` where the file failed: draw a plain box of the thing's size. |
| `NSWP.itemTap(press)` | The view was pressed: `from`, `dir` and `heldMs`. True if that was the item's first press, sent the way they pressed: do nothing else with it. A press held is still how they walk. |
| `NSWP.itemUse(toward)`, `NSWP.itemSecond()` | The item's two presses, from a control of the engine's own. |

What `frame` gives back:

- `held`: the thing in their hand, or null: `model` and `size` (draw it
  fitted to that box, standing on the middle of its base, its front toward
  -Z), `tints` (a colour for each material named `tint:<slot>` or
  `tint_<slot>`), `aim` (where its sight is and how far it asks to zoom),
  and `acts`.
- `sight`: whether they are holding the press that aims. Bring the item up
  to the eye and narrow the view, and say `sighting` once it is there.
- `things`: each thing in the air or stuck, the visitor's own and anyone
  else's in the room: `model`, `size`, `tints`, where it is (`at`, `turn`,
  `scale`), what it is stuck to (`on`: "world", or a person's key), and
  `test`: a step it took, from `a` to `b`. **Test that against your world's
  own shapes,** and say what it met in the next frame's `met` (`key`,
  `step`, how far along as `f`, where as `at`). It then sticks there. A
  thing falls as it flies, so a step that took a while is a curve: `via`
  is then the places it passed on the way. Test from `a` through each to
  `b`, in order, and give `f` along the whole step. Without that, a device
  drawing few frames a second lands a thing somewhere else than the others
  see it land. For one with `down` true, say where the floor is under it,
  in `floors`.
- `trails`: a streak of light behind a thing: points along its middle, each
  with how bright it is there. Draw a ribbon through them facing the
  viewer, tapering, with nothing behind it darkened.
- `own`: how the visitor is, for an engine that draws it itself (in a
  headset): the ring to aim by, the mark of a hit, their health, how red
  the edge of their view is, and their item's counter. **On a flat screen
  the page draws all of these over the canvas,** as it does the menu.
- `clips`: animations of an item's own that began: play each by name on
  what you drew.

A thing sticks to whatever your engine's test says it met. Nothing of your
world has to be an item.

The Bag tab's own pictures are not yours to draw: the page draws each thing
in the bag from its model, in a small view of its own, as it draws the rest
of the menu. That is why the script carries a renderer of its own (it is
about 2.3 MB before the server squeezes it, a third of that for this).

A world that draws items serves the locked box as `item-box.html` beside
its page: write out `ITEM_BOX_HTML` from `@nswp/core`, serve it with exactly
`ITEM_BOX_CSP`, and leave your site's other content rules off that page.
Its page may reach any https address (`connect-src`), since a model is
wherever its maker keeps it.

**Making an item from an engine's own scene.** Write the scene out as a
binary glTF and describe it:

```
nswp make-item thing.glb --title "Thing" --host https://your.site/items/
```

That reads the file as every world will, measures it, names it by its hash
and writes a description ready for `nswp sign-item`. A material named
`tint:<name>` (or `tint_<name>`) becomes a colour its holder may choose.
The Godot addon has a script that writes any scene out for it
(`nswp_item_model.gd`).

## Other people

A visitor may join the room of the place they are in, and then sees and
hears whoever else is there (spec §9.4). **Everything about a room that
isn't drawing is in the script, and is the very code a Three.js world
runs:** joining and leaving, who is here and where, their voices from where
they stand, chat, the list of people and a card for each, muting and
blocking. Their figures, their names and what they write are made there
too, so people look the same in every world.

| Call | Does |
|---|---|
| `NSWP.people(options)` | Call once, after `menu`. The room's part of the menu is added: Join, the microphone, chat, who is here. `options` is JSON: `sharedMusic` false for a place that wants none of its visitors' music shared. Nobody is joined to anything until they ask. |
| `NSWP.frame(view)` | The same call as for items, once a frame: it now also returns `people`, `room` and sometimes `nudge`. |
| `NSWP.figure(name)` | What to draw a person's figure with, by the name a frame gave. |
| `NSWP.board(key)` | A board's picture, as a PNG in base64, by the key a frame gave. |

What `frame` gives back for people:

- `people`: everyone to draw. For each: `key`; `name`; `figure`, the name
  of what to draw them with; `opacity`, less than 1 as they come very
  close (nobody may fill another's view); where their `head`, their `body`
  and each of their `hands` is (`p`, a place, and `q`, a turn; a hand is
  null when it isn't being tracked); and their `boards`.
- A **figure** is three shapes: `head`, `body` and `hand` (one shape, drawn
  twice). Each is a list of triangles' corners as 32-bit floats in base64:
  `position`, `normal`, `tone` (the metal's own colour there, as sRGB),
  `glow` (how much of a light it is) and `flow` (how far along its seam).
  With them come `accent`, `gloss` and `sheen`. They are for the kit's
  metal, the surface everything the kit models is drawn in
  (`gate/alloy.gdshader` is it, written for Godot). A head faces -Z with its
  origin between the eyes.
- A **board** is a flat picture that always faces the viewer: a name, a
  picture, a few written words, a light. `at` is where its middle is (or
  the middle of its bottom edge, where `foot` is true), `w` and `h` its
  size in metres, `opacity`, and sometimes `tint`, a colour to draw it in.
- `held`, on a person: what they hold, where this world draws what people
  carry: `model` and `size` (as for the visitor's own, from `NSWP.model`),
  `tints`, and where it is (`p` and `q`). `clips` in the same frame names
  animations of it that began, by whose it is (`who`).
- How someone is, where items are in play, is one of their boards: a bar
  over their head, drawn over again as it changes (a new `key` each time).
- `room`: whether they are joined, whether their microphone is on, and how
  many others are here.
- `nudge`: two numbers, x and z in metres. Add them to where the visitor
  stands: two people who arrive in the same spot step apart.

Voices and chat are the page's own. There is nothing of sound for an
engine to do: say where the visitor's view is each frame, as `frame`
already asks, and voices come from where their speakers stand.

## What an engine draws for itself

Its doors, and how its visitors move. An engine's side should take both from
the kit all the same, so that a door is recognisable and moving feels the
same: `NSWP.kit()` has the numbers, and the Godot addon has the doorway's
frame as a mesh made from the kit's own modelling code.

The rest of the reference kit's Three.js parts don't come along: other
people's figures, the view through a door, panels, the console in a
headset. (The crossing's room does, as the page's picture of it: above.) The protocol lets a world draw its visitors its own
way ([NSWP-05](../protocol/05-looks.md)), so that is allowed. It is also
work.

Rooms are in the script ("Other people", above), and so is everything
between people: what each holds, what their items send out, a hit, how
someone is, muting one person's items.

## Godot

[`engines/godot/addons/nswp/`](../engines/godot/addons/nswp/README.md): an
addon. Godot 4 exports to the Web and supports headsets in the browser
itself, so it is the one engine besides Three.js where every part is the
engine's own.

| Part | What it is |
|---|---|
| `Nswp` | An autoload: how the visitor arrived, the doors out, the menu and the sounds. |
| `NswpGate` | The standard doorway. Its frame is the kit's own model, exported as a mesh; its three surfaces are the kit's shaders, written for Godot. |
| `NswpVisitor` | A visitor who moves the casual way or the intense way, as they choose in the menu, at the kit's own speeds. |
| `NswpPortal` | A door with nothing drawn, for a world that draws its own. |

Each default can be replaced. A world that wants its own door uses
`NswpPortal` and draws what it likes; one that wants its own sounds names
them, as any world does ([controls-kit.md](controls-kit.md), "Sound").

There is an example world beside it
([`engines/godot/example/`](../engines/godot/example/)): **The Foundry**, at
<https://foundry.bitblocks.network>. It has two entry points, a door to the
Gallery and one to the Workshop, and nothing else of its own; the Workshop
has a door back to it, so the trip between a Three.js world and a Godot one
can be made both ways. `npm run build:godot` exports it, given Godot 4 and
its web export templates, and writes beside the export what any world's
site carries: its manifest (`.well-known/nswp.json`, from
[`engines/godot/world.json`](../engines/godot/world.json)) and the headers
it is served with. [`node scripts/serve-local.mjs`](local-server.md) serves
it with the other sites, and `npm run release:all` deploys it with them.

**Status (2026-11-18):** run in Godot 4.7.2, exported for the Web, in Chrome
on a flat screen, with a mouse and keyboard:

- The kit's menu over the canvas, with the way home, the sound volumes, how
  to move, and fullscreen. The kit's sound files are loaded.
- The standard doorway, lit when pointed at, with a card saying where it
  leads.
- Moving the casual way: a click on the floor walks no further than the
  kit's reach, and a drag looks round: sideways it turns the visitor, up and
  down it tilts the view within `tiltLimit`, and walking brings it back
  level at `levelRate`.
- Moving the intense way: the mouse looks round, and taking the pointer back
  opens the menu.
- The summons: with the controls hidden, the key left of 1 brought them up
  over the canvas and put them away, and Godot never saw the key.
- Marks on the floor moving the casual way (a ring where a press would lead,
  a dot and a dotted line once pressed), and the reach of a door: nine
  metres off it was not lit and a press walked towards it; at three it lit
  and a press went through.
- Running and jumping, both ways: Shift runs at 4.3 metres a second against
  2.4 walking, two clicks on the floor run there, and Space jumps 0.45 m.
- Arriving by an ordinary link and by an arrival, each entry point, a door
  through to the Airlock, and the way home.

**Not tried:** a real phone (a tap on an emulated touch screen walks as it
should), Firefox, Safari, and a real headset. With a made-up headset on the page the way in is offered; a session
itself wasn't started, since Godot needs the browser's WebXR Layers and the
made-up headset has none. Nobody has listened to it: the sound files are
asked for and decoded, and that is all a test can say.

**Added 2026-11-20,** run in Godot 4.7.2 exported for the Web, in Chrome on
a flat screen:

- The crossing's room in place of Godot's loading screen: up from the first
  moment, its line of light filling as the engine downloads, its doors
  opening on the world; and coming up and shutting on the way out by a door.
- The page the addon exports with has no script written into it.
- The same sign-in row, card and "Signed in as" as a Three.js world. Tried
  signed out only: nobody signs in to an account from a test.
- A path pressed out as they walk, with a ring at each turn, and the view
  turning to face the way they walk.
- A tab of the menu kept on the bar, as in every world.

**Added 2026-11-20, things visitors carry** (`NswpItems`), run in Godot
4.7.2 exported for the Web, in Chrome on a flat screen, signed in through
a stand-in signer:

- The Bag tab in the menu, and the dart blaster taken in hand: asked about
  first, since it runs its maker's code; then drawn in the same place as in
  a Three.js world, with its two animations and its counter.
- Fire and Reload leading the bar. A dart flying with its streak of light,
  sticking to the ground, letting go and gone.
- A click on the view firing where it was clicked, R reloading, and a press
  held still walking.
- Accent and dart colours chosen in the Bag tab, showing on what Godot drew.
- A mallet made in Godot itself (`nswp_item_model.gd`, then
  `nswp make-item`) held here, and the same mallet held in a Three.js
  world, where another visitor saw it in its holder's colour.

Not tried there: aiming along the sight with the mouse (it is wired; a test
can't take the pointer), a phone, a headset.

**Added 2026-11-20, other people** (`NswpPeople`), run the same way, with
two visitors in two browsers, each signed in through a stand-in signer, on
stand-in relays:

- Join the room from the bar. Each sees the other by name, as the kit's
  own figure in the kit's own metal, where they stand; and sees them walk.
- Two people who arrive in the same spot step apart.
- Leave, Mic and Chat on the bar. What one writes is in the other's chat,
  and over the writer's head.
- A microphone turned on is heard by the other (a test tone, measured).
- Someone standing very close thins out and never fills the view.
- One leaves, and is gone for the other.

**Added the same day, items between people:** with the same two visitors,
one holding the dart blaster.

- The other sees it in her hand.
- She fires at him from two metres: it reaches him once, he has four of
  five left, she is shown the mark of a hit, the dart is on him for her,
  and a bar over his head says how he is. It lets go and is gone, and what
  he lost comes back.
- She taps the floor to one side: both see the dart stuck in the same
  place, to the tenth of a metre.

Not tried there: a real microphone and two real people, more than two
people, a picture over a name, pressing a person, a phone.

**Not in the Godot addon:** moving in a headset (a session starts, and the
visitor stands where they are), the view through a door, posting from a
world, and a screen someone shares. The crossing's room is the page's picture of it:
it can't be looked round in, as a Three.js world's can.

A Godot export is large (about 40 MB, nearly all the engine), which is what
the line of light in the crossing's room is for. The page the addon exports
with runs nothing written into it, so it can be served under a policy with
no inline script; the engine itself is WebAssembly and needs
`'wasm-unsafe-eval'` in `script-src`.

## Others

Not done. Unity exports to the Web, and reaches headsets in a browser only
through a community package. Unreal has no web export from its maker. The
script above is what either would call.
