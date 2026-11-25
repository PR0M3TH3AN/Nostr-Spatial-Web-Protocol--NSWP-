# NSWP-17: Items

**Status:** Decided by the owner on 2026-11-20, and built in the reference library and kit: for worlds drawn with Three.js and for worlds made with Godot, on a flat screen (in a headset, only with Three.js). Built: an item's description, a world's rule for items, the warning on a door, a visitor's bag, holding one item, the visitor's switch for all items, an item's own logic in its locked box, things an item sends out, people being reached by them (the person reached decides), health where a world has no rule of its own, and muting one person's items. Every reference world draws what its visitors hold and runs their items' logic, since a world has items unless it says otherwise; the Grove keeps five starter items ([`sites/items`](../sites/items)); and a dart blaster. Not built: a ceiling the visitor sets on how loud and bright items may be, granted items, a world giving an item, items in a headset in a world made with Godot · **Kinds:** 37303, 37308 · **Vectors:** [`items`](../vectors/items.json) · **Code:** core [`item.ts`](../packages/core/src/item.ts), [`bag.ts`](../packages/core/src/bag.ts), [`play.ts`](../packages/core/src/play.ts), [`item-box.ts`](../packages/core/src/item-box.ts), [`constants.ts`](../packages/core/src/constants.ts) (`ITEM_RULES`); SDK [`items.ts`](../packages/sdk/src/items.ts), [`bag.ts`](../packages/sdk/src/bag.ts), [`bagging.ts`](../packages/sdk/src/bagging.ts), [`play.ts`](../packages/sdk/src/play.ts), [`item-box.ts`](../packages/sdk/src/item-box.ts), [`item-controls.ts`](../packages/sdk/src/item-controls.ts)

An **item** is a thing a person can carry from world to world, or put in
their home: a lantern, a book, a map, a chair, a tool, a weapon. It has a
shape, and it may do something.

**A world has items unless it turns them off** (the owner, 2026-11-20:
"allow items in all the worlds unless its turned off specifically"). One
that says nothing about items lets them work. One that says `none` has
none: nothing carried is drawn there, and nothing runs. A world that can't
draw what its visitors carry says `none`, so that its doors tell the truth.

## The rules everything else follows from

1. **An item never touches another person's device or account.** Whatever
   an item does of its own runs only on the device of the person carrying
   it. Nothing of theirs runs on anyone else's machine, reads anyone else's
   data, or signs anything as anyone else.
2. **A world has the last word.** An item says what it did: "I was swung",
   "I hit that with power 3". What that means, if anything, is decided by
   the world it is in. This is what lets one item work across worlds that
   have nothing else in common.
3. **In a world, a person is part of the game.** Where a world lets items
   work, the people in it can be reached by them: not ghosts who can be
   seen and never touched, but as much a part of its rules as anything the
   world made itself.
4. **A visitor is told before they go in,** and where items are not what
   the place is for, they can turn them off for themselves.

## What a world does with items

A world says which of three kinds of place it is, with an `items` tag in its
announcement ([NSWP-01](01-worlds.md)):

| | What it means |
|---|---|
| `none` | Nothing carried is drawn or works there |
| `allowed` (or nothing said) | Items work, and can affect other people. Anyone there may mute them |
| `play` | Items are part of the game. Nobody there is out of their reach |

A word that isn't one of the three is read as `none`: a place that said
something a reader doesn't understand is taken to have turned items off,
never on.

**A door says so, where it isn't the ordinary rule.** A door to a place
where items are part of play says "Items are part of play here" on its
sign, and so does the visitor's Airlock before they cross. A place that has
turned them off says "No items here", for whoever is carrying something. A
place that only allows them says nothing: it is what a visitor expects.
The words are the core's (`itemsWords`), so they are the same everywhere.

## An item's description

What a thing is, is said once by its maker, in an addressable note
(experimental kind **37303**; `d` names it among its maker's items):

```json
{
  "kind": 37303,
  "tags": [
    ["d", "brass-lantern"],
    ["title", "Brass lantern"],
    ["summary", "A lantern that swings as you walk."],
    ["model", "https://items.example/<sha256>.glb", "glb", "<sha256>"],
    ["thumb", "https://items.example/<sha256>.webp", "<sha256>"],
    ["size", "0.18 0.42 0.18"],
    ["collider", "box", "0 0.21 0", "0.18 0.42 0.18"],
    ["clip", "idle", "Swing"],
    ["clip", "use", "Flare"],
    ["behavior", "holdable"],
    ["fits", "place", "hand-left", "hand-right"],
    ["script", "https://items.example/<sha256>.js", "<sha256>"],
    ["sound", "fire", "https://items.example/<sha256>.ogg", "<sha256>"],
    ["sends", "dart", "https://items.example/<sha256>.glb", "glb", "<sha256>", "0.02 0.02 0.09", "lands=impact", "strikes=hit"],
    ["effect", "dart", "health", "-1"],
    ["does", "use", "Fire"],
    ["does", "second", "Reload"],
    ["license", "CC-BY-4.0"],
    ["alt", "Item: Brass lantern"]
  ],
  "content": ""
}
```

- **Every file is named with its hash.** The model, the picture and the
  script are each checked against it before they are used. What is drawn
  or run is exactly what the maker signed, and can't be changed later.
- **`model`** is a GLB file, which Three.js and Godot both read.
- **`size`** is its box in metres, 4 at most a side. A file that is larger
  is scaled down to fit.
- **`collider`** is its hit box, as simple shapes: a `box` (centre, size), a
  `sphere` (centre, radius) or a `capsule` (centre, radius, height). What
  touches what is worked out from these, never from the drawn shape.
- **`clip`** ties a moment (`idle`, `touch`, `held`, `move`, `use`) to an
  animation in the file.
- **`behavior`** is what it can be, from a closed list: `holdable`,
  `sittable`, `touchable`, `readable`, `wearable`. A reader ignores one it
  doesn't know.
- **`fits`** is where it may go: `place` (in a room), or a person's `head`,
  `back`, `hand-left`, `hand-right` or `side`.
- **`use`** is `anyone` (the default) or `granted`: only for someone its
  maker has granted it to.
- **`guests`**, `no`: a guest account may not use it, wherever they are
  ("Guests", below). Left out, guests may, where the world lets them.
- **`script`** is what it does of its own, where it does anything. See
  below.
- **`sound`** is one of its own sounds, by a short plain name: twelve at
  most, each a small file (150 KB) no longer than four seconds. A sound
  may have more takes than one, named `<name>-2` up to `<name>-4`: a
  renderer plays one of them each time, and not the same twice running.
- **`sends`** is a thing it may send out: a dart, a ball. It has a name, a
  model of its own, and its box. After those it may say which of the item's
  sounds go with what happens to it: `lands` (it stuck to something),
  `drops` (it let go and fell), `strikes` (it reached a person), and `tells`
  (heard only by whoever sent it, when it reached a person). And `trail`:
  a streak of light behind it as it flies, so many seconds of its flight
  long (0.6 at most). Four things at most.
- **`effect`** is what one of those things asks of a person it reaches. It
  is words, never code: take 1 to 5 from their `health`. A reader ignores
  an effect on anything else.
- **`does`** is what its two presses are called, for the buttons a visitor
  is shown: `use` and `second`, sixteen letters at most each.
- **`aim`** is how it is aimed, where it has a sight: the point of the
  sight in the item's own space as it is drawn (metres from the middle of
  its base, its front toward -z), and how much narrower the holder sees
  while they aim, from just over 0 to 1. It asks; a renderer decides, and
  none goes narrower than a little under half.
- **`tint`** is a colour of the item that whoever holds it may choose:
  `["tint", "accent", "Accent", "#f2691c"]` is its name, what a visitor is
  shown it as, and the colour it is until they choose. Four at most. Every
  material in the item's models named `tint:<name>` (or `tint_<name>`,
  for a tool that won't write a colon) takes that colour, and
  a part that glows, glows in it. See "A holder's own colours".

**One site can hold any number of items.** An item is a note and some
files, and the files can be anywhere that serves them over `https`. A
maker keeps as many as they like in one place. Where most viewers will
fetch them from is a file host they already use: see "Where a file is
fetched from".

**A file is served so that any world can fetch it:** with
`Access-Control-Allow-Origin: *`, since each viewer fetches it from the
world they are in. It is named by its hash and never changes, so it can be
kept for ever by whoever fetched it.

### Where a file is fetched from

Fetching a file tells the place that keeps it the viewer's address, and
when they were near the thing. The place was chosen by whoever made or
carries the item, not by the viewer, so an item could be used to follow
people. So a file is fetched **by its hash, only from file hosts on the
viewer's own list**, and the address beside each hash is a hint:

- **A file host** is an `https` address prefix ending in `/` that serves a
  file at `<prefix><sha256><ext>`, the extension (`.glb`, `.ogg`, `.js`)
  taken from the hint. A Blossom server is one, at its root; so is any
  folder of files named by their hashes.
- **The viewer's list** is, in order: the file hosts their own sign-in
  address keeps their files on, which is their file host list (kind
  **10063**, Blossom's user server list: a `server` tag for each, six
  at most, from the newest list really signed by their key), then the
  kit's short default list (`FILE_HOSTS`: hosts BitBlocks runs). A guest
  has only the default list.
- **Each host on the list is asked for the hash itself.** The hint is
  used too where it is inside one of those hosts, and is tried first.
  Whatever comes is taken only if its bytes have the hash.
- **Anywhere else, only with the viewer's word.** A file kept only off
  their list is not fetched: the item is drawn as its marker, and its
  card says it is kept somewhere they don't load files from. A viewer
  may turn on "Load people's files from anywhere" (`files-anywhere` in
  the console, off by default), in the place they are in, by their own
  press. Off travels with them (`filesAnywhere: false`); on never does,
  since any world can write the link they arrive by
  ([NSWP-11](11-the-visitors-console.md), "Settings that travel").
- **A world's own files** (its scenery, the items it offers from its own
  site) are not this: they come from the site the visitor chose to visit.

The hosts on the list still learn the viewer's address and which hash they
asked for, as any file host does; but those are hosts the viewer already
uses, and no maker can choose them. A maker who wants their items drawn
for everyone keeps the files on such a host. The starter items are kept
in the first of the kit's own, `https://grove.bitblocks.network/items/`.

As built: `fetchByHash(sha256, hint)` in the kit, with the list as
`fileHosts()`; every file of an item (its model, its sounds, its script,
the things it sends out) is fetched this way, in every engine, since the
page fetches for all of them.

**Made once, for every world.** An item is a description, a binary glTF,
small sounds and perhaps a script: nothing in it belongs to an engine, so
the same item works in a world drawn with Three.js and one made with Godot,
and there is nothing to convert. `nswp make-item thing.glb --title … --host
…` describes one from a model made in any tool: it reads the file as every
world will, measures it and names it by its hash.

**Signing one.** `nswp sign-item item.json --key-file <key>` signs a
description from a file of what `buildItem` takes (`d`, `title`, `model`
with its address and hash, `size`, and the rest), or each of a list of
them with `--out-dir`. `nswp publish` sends it.

**The maker is always on show.** A description is signed, so anything that
draws an item can say who made it.

## What an item does

**Most items need no script.** A book says it is `readable`, a chair that
it is `sittable`, a hat that it is `wearable`. Each world knows what those
mean, and they work in every world that draws items, including one that
runs no scripts.

**An item's own logic** is for a thing that does more: a tool, an
instrument, a weapon.

- **It runs only for the person carrying it.** Everyone else sees what it
  did, never its code.
- **It runs shut away.** No network, no storage, nothing of the scene,
  nothing of the visitor: not their key, their name, or where they are. It
  can be stopped at once if it hangs.
- **It hears about its own item and nothing else:** picked up, put away,
  used, touched, and the passing of time.
- **It may ask for things from a fixed list:** play one of its own
  animations or sounds, show its own words, glow, send out one of the
  things it has described (a bolt, a ball), change its own state. Each has
  a ceiling on how often and how much.
- **It says what happened** to the world: "I was used", "I hit that with
  power 3". The world decides what that means.
- **Two switches.** A world chooses whether scripted items run there at
  all. A visitor approves an item's script the first time they use it, and
  is shown who made it.

One form serves every engine: the script is JavaScript, run in the
browser's own locked box, and the kit passes what it asks for to whichever
engine is drawing the world.

### The box

The box is a page of its own (`ITEM_BOX_HTML` in the core), which a world
that runs items' logic serves as `item-box.html`.

- **It may reach nothing.** It is served with exactly these content rules,
  and with none of the world's own: `default-src 'none'; script-src
  'unsafe-inline' blob:; worker-src blob:; frame-ancestors 'self'`. No
  address may be fetched, and nothing may be worked out from text as code.
- **It is nobody.** The world frames it with `sandbox="allow-scripts"`: an
  origin of its own that is no site's, with no storage and no way to the
  page that holds it.
- **The script runs in a worker inside it,** given one object, `item`. The
  names it might reach anything else by are empty for it.
- **A script that stops answering is ended,** after three seconds. It can
  hang nothing but itself. A device that was only busy for a moment isn't
  mistaken for a script that hung: silence has to be seen twice.
- Where the page isn't served, or is served under other rules, no script
  runs there, and an item is a shape.

### What a script is given

```js
item.on("held", fn)      // taken in hand
item.on("away", fn)      // put away
item.on("use", fn)       // its first press
item.on("second", fn)    // its second press
item.on("tick", fn)      // ten times a second, with the milliseconds since it began
item.play("fire")        // one of its own sounds, by name
item.clip("reload")      // one of the animations in its own model, by name
item.send("dart", { speed: 40, stick: 3, spread: 0.015 })   // one of the things it described
item.show("4 / 5")       // its own few words: a counter, shown on it
item.after(1400, fn)     // later, by the kit's clock
```

**A pose stays.** An animation whose name begins `pose` is a pose and not
a moment: the thing stays as the animation ended, until another pose is
played. Anything else is played once, over whatever pose the thing is in,
and the thing is as it was. So a magazine shows the darts that are left,
and a lid stays open. Which is which is the maker's to say, in the name
they give the animation in the model; a model has eight at most.

**A little off, each time.** `spread` throws what is sent out off its aim
at random, by up to that many radians (a tenth at most, about six degrees):
no two go quite the same way. It is worked out once, by the device of
whoever sent it, and what is told to the room is where it really went.

That is all of it. Each ask has a ceiling (`ITEM_ASKS`): six sounds, eight
animations, six things sent out and eight changes of its words a second,
after a small burst. What it shows is 24 plain characters at most, so it
can't pass for anything of the kit's. It is told nothing of the visitor,
the world, or anyone in it: not even whether what it sent out reached
anything.

### Two switches, as built

- **The world's:** `itemScripts` on its presence. Left out, items are
  shapes there.
- **The visitor's:** the first time they take in hand an item that has a
  script, they are told so, and who made it; a second press lets it. It is
  remembered by the script's hash, so a changed script is asked about
  again.

## Things sent out

A script decides *when* something is sent out. Everything after that is
the kit's, the same on every device.

- **It flies on an arc.** Straight on from where it left, and falling at
  9.8 m/s². So it only goes so far, and has to be aimed higher to go
  further (`shotAt`). 40 m/s is the fastest anything may leave.
- **It leaves from the carrier,** toward the middle of what they see; in a
  headset, from the hand that holds the item, the way it points.
- **It sticks to whatever solid shape it meets.** Any mesh of the world: a
  wall, a bench, the floor. **Nothing of a world has to be an item** for
  items to meet it. A sky drawn from the inside and a glow are passed
  through, and a world may say what else isn't solid (`solid`).
- **It lets go after its time** (ten seconds at most), drops to the floor,
  and is gone.
- **Its trail follows its arc.** Where its item gives it one, a streak of
  light runs back from it along the very path it flew, bright at the thing
  and fading to nothing, in the colour of the tint that has the thing's own
  name. It draws itself in once the thing has stopped. It is the kit's to
  draw: how wide and how bright it is are not the item's to say.
- **A world may be told what was struck** (`onStruck`), and decide what
  that means by its own rule: a target that counts, a bell that rings.

What is said in a room, on the connection poses use, each once:

| | |
|---|---|
| `shot:<n>,<name>,<x>,<y>,<z>,<vx>,<vy>,<vz>,<stick>` | A thing sent out: its number, which of the item's things, where from, how fast in metres a second, and how long it sticks |
| `hit:<sender>,<n>,<dx>,<dy>,<dz>` | "That thing reached me", said by the person it reached, with where on them, from their feet |
| `did:sound,<name>` or `did:clip,<name>` | The item in their hand made one of its sounds, or played one of its animations |
| `st:health,<value>,<full>` | How they are |
| `tint:<name>=<rrggbb>,…` | The colours they chose for what they hold. Said when they take it up, when they change them, and to whoever comes in later |

A reader takes a thing sent out only from someone who holds an item that
says it sends that thing, only if it starts where they stand, and no more
than six a second from one person.

The channel these are said on doesn't try again, so everything but `did` is
said twice, a moment apart, and **a reader takes each thing once, by its
sender and its number**. It must remember that for a little while after the
thing is gone: one sent from close by has arrived, and gone, before its
second saying, which would otherwise be a second thing and a second hit.

## People as part of the game

For an item to matter, a world has to be able to treat a visitor as it
treats anything else in its game. The kit gives every world the same
picture of a person:

- **A body:** a simple shape that things can hit.
- **State the world defines:** health, a score, a side, whatever its rules
  need, shared with the room.
- **Things done to them:** "hit, with power 3, by that item of that
  person's". The world's rules decide what follows.

**Who decides.** These worlds are pages with no server behind them, so
there is no referee. **The person something was done to decides what it
did to them, by the world's own rules running on their own device**, and
tells the room. Nobody's code runs on anyone else's device for it.

As built: a person is a standing capsule, from their feet to the top of
their head. A thing that crosses it has reached them, **if their own
device says so**: it says `hit`, and only then is whoever sent it shown the
mark that says so. To everyone else the thing looks stuck to them at once,
and drops off if they never say it reached them. Nobody can say they were
reached by a thing that never flew, or say so twice.

**Where a world has no rule of its own,** a person has `health`: five, of
which a thing takes what its `effect` says.

- **It comes back by itself:** after four seconds with nothing reaching
  them, one each second until they are full.
- **With none left,** they are out for three seconds: nothing more reaches
  them, their figure blinks to everyone else, and their own view breaks up
  for a moment. Then it is all back.
- **Nothing else happens to them.** Nobody dies, is moved, sent away,
  made to watch or stopped from doing anything, unless the world's own
  rules say so.

**How it is shown is the kit's, never an item's.** Several people's items
may reach someone at once, and an item's code doesn't run on the device of
the person it reaches: so there is one display of how someone is, in the
look of the kit's other controls and the world's own colour. To them: a
pill low in their view, a block for each of what they have, the next one
filling as it comes back; the edge of their view reddening for a moment
when something reaches them. To the others: a bar over their head. In a
headset, and for anyone who has asked for stillness, nothing flashes or
breaks up. An item says only how much a thing takes.

That is honest in the way a claimed score is honest ([NSWP-15](15-scores.md)):
someone who alters their own page could shrug off a hit. It is enough for
play among people who came to play. A world that needs more needs a
referee, which is a later thing, laid over this one.

## Muting

In a place where items are **allowed**, a visitor may:

- **Mute one person's items.** They no longer see or hear what those items
  do, and those items can't affect them. Nobody is told, as with muting a
  voice.
- **Mute all items,** with a switch of their own that goes with them from
  world to world.

In a place where items are **part of play**, nobody is out of their reach:
that is what the door said. A visitor can still leave.

**Everywhere, whatever the place:**

- A ceiling on how loud and how bright anything an item does may be, set by
  the visitor, holds.
- Blocking a person removes them and everything of theirs.

As built: muting one person's items is on their card in a place that
allows items, and isn't offered where items are the game. An item's sounds
are played at the visitor's own volume for effects, each levelled as it is
read so that none is louder than the kit's own, heard from where it
happened, quieter and duller the further off, and not at all beyond 45
metres. A ceiling of the visitor's own for items alone is not built.

## What is the item's, and what is not

As little as possible is fixed for everyone, and as much as possible is
the item's own.

- **Said the same by everyone** (the least there can be): what people must
  agree on to see the same thing, and the ceilings. A thing left from here
  going this way; it reached me; how I am; the colours I chose.
- **The kit's, and a world may do it differently:** drawing, how someone's
  state is shown, and turning a tap, a click or a trigger into one of the
  item's two presses.
- **The item's:** its shape, its sounds, its numbers and its logic. How
  many darts, how long a reload, what a press does when it is empty, where
  its sight is and how far it asks to zoom.

An item never sees a tap, a key or where anyone is looking. It hears
"use" and "second", and anything it wants of the view (a zoom) it asks
for in its description, for a renderer to grant within a ceiling.

**The two presses, in the kit:**

- On a touch screen, both presses are under the thumb: a sight in the
  middle of the view, the first press as a large round button by the right
  thumb, the second as a smaller one beside it (by the left thumb, if the
  visitor says so). The first sends along the sight. A tap on the view is a
  walk, exactly as with nothing in hand, so a walk never fires. With
  nothing that does something in hand, none of it shows.
- At a desk, a click on the view is the first press, and what it sends out
  goes where the visitor clicked. A press held is still how they walk.
- Moving the intense way at a desk, the mouse button is the first press.
  The other mouse button brings the item's sight up to the eye and leaves
  it there; pressed again, it puts it down. Nothing is held while aiming.
- What is in the hand sways a little in step with the visitor's walking.
  It is how the thing looks and nothing else: where it is aimed is worked
  out from the view, so no shot is moved by it. Not while it is up at the
  eye, in a headset, or where they asked for no motion.
- R is the second press at a desk; both are on the bar everywhere but a
  touch screen, where they are under the thumb (and in the menu's Bag tab).
- In a headset, the trigger of the hand that holds it.

## A holder's own colours

An item may leave some of its colours to whoever holds it (`tint`). A
blaster's accent, and the colour of its darts.

- **They choose in the Bag tab,** from a short list of colours
  (`TINT_PALETTE`), wherever they are. It is recoloured at once.
- **The others are told,** in the room, and see the item, what it sends
  out and its trail in those colours. A reader takes only colours for
  tints the item says it has, each written as a colour.
- **The choice goes with the thing.** At the visitor's own client, which
  can change their bag, it is written into the bag beside the item (a
  `tint` line: the item's coordinate, then `<name>=#rrggbb` for each), a
  moment after the choosing stops. In a world, which can't change a bag,
  it is kept for that place on that device, over what the bag says.
- **It is only ever a colour.** Nothing about how bright, how large or how
  loud anything is can be chosen this way.

## A visitor's bag

A person keeps a list of the items they have: ones they made, ones they
took up from someone else's site, ones a world gave them. It is theirs,
signed by their key, and public to begin with: what someone carries is on
show anyway.

It is one addressable note (experimental kind **37308**, `d` is `bag`),
naming each item by its coordinate:

```json
{
  "kind": 37308,
  "tags": [
    ["d", "bag"],
    ["a", "37303:<maker>:brass-lantern"],
    ["a", "37303:<maker>:old-book"],
    ["alt", "A bag: the items this person has"]
  ],
  "content": ""
}
```

- **It is changed the way a follow list is** ([NSWP-14](14-people-and-messages.md)):
  from the newest that can be found, one item at a time, with everything
  else kept; nothing is changed when no relay could be reached; and a first
  bag is written only when the person has said they have none (`changeBag`).
- **It is changed at the visitor's own client.** A world can look through
  its visitor's bag, which is public, and can't change it. A world giving
  an item is a later thing.
- **A client may offer a few items to start with,** to put in with one
  press. They are items like any other: someone else's, taken up.
- 200 items at most are read from one.

Carrying an item into a world is tied to who they are there. A guest of
one visit, with no key of their own, carries nothing.

### Guests

A **guest account** ([NSWP-10](10-identity.md), "A guest") has a key of its
own and a bag, the same in every world: its client may start it with a
few things (BitPortal's starter set). A guest holds and uses an item where
both of these let them:

- **the world:** its announcement's own entry says `"guest_items": false`
  to keep guests from its items ([NSWP-01](01-worlds.md)). Left out, guests
  may use items wherever its `items` rule lets anyone;
- **the item's maker:** its description says `["guests", "no"]` to keep
  guests from it, wherever they are.

Where either says no, a guest is told so when they reach for it, with
"Secure your account" to use it. Nobody else draws what a guest holds there
either, since nobody there may use it. A guest has no wallet, so what they
have is what was given to them free.

## Holding one

A visitor takes one thing from their bag in hand, in a world that draws
items, and puts it away again.

- **They say only what it is.** In a room, a visitor tells the others the
  coordinate of what they hold, and nothing else.
- **Everyone who sees them fetches it for themselves:** the description
  from relays, taken only with a real signature by the maker its
  coordinate names; the model from where the description says, taken only
  if its bytes have the hash the description gives.
- **A model is read and counted before anything draws it,** by one reader
  that every engine shares (`readGlb`): a binary glTF with everything it
  needs inside itself. One that names a file outside itself, or needs a
  special reader, is refused: a model can't send a browser to an address
  of its maker's choosing. Then: 2 MB, 20,000 triangles, 40
  meshes, 16 materials, and pictures no larger than 1024 on a side. Lights
  and cameras a file brings are left out. Then it is scaled to the box its
  description gives.
- **Where any of that fails, a plain marker of the item's size is drawn**
  in its place. Nobody is left holding nothing because a file was missing.
- **Only something that can be held:** `holdable`, or one that fits a hand.
- **Not one that has to be granted,** yet: nothing checks a grant.
- **A world that draws items reaches further.** It fetches models from
  wherever their makers keep them, so its page has to be allowed to. A
  world with no items reaches only itself and relays. Since a world has
  items unless it says otherwise, that wider reach is what most worlds'
  pages allow: whoever wants the narrow one says `none`.

**A bag shows the things themselves.** In the Bag tab each item is drawn
from its own model: the model that would be in the visitor's hand, read and
checked the same way, in the colours they chose. So nobody makes a thumbnail
for an item, and nobody can make one that misleads. The one they choose is
shown large, turning, with taking it in hand as the first thing under it.
Where it can't be held, the tab says so there, and says why: each place
says whether things can be carried in it. The page draws these pictures, in
a small view of its own, whatever draws the world. So looking in a bag
fetches the models of the things on show, from wherever their makers keep
them, in a place with no items too: unless the visitor has items off.

**What is in their hand goes through a door with them.** It is one of the
settings that travel ([NSWP-11](11-the-visitors-console.md), `holding`):
the item's address, the colours they chose, and the hash of its script if
that was running for them. A link says it, and anyone can write a link. So
the world they arrive in takes the thing in hand only if it is in their
own bag, as they signed it; and lets its logic run unasked only if it is
the very script the link names, since they were told of that one and let
it. Anything else is as if nothing had been said. Someone who put it away
themselves arrives with nothing. A site also keeps what its visitor last
held there, for when they come back or load it again.

**The visitor's switch.** "Items: off" in the Bag tab, and nothing of
anyone's is fetched, drawn or run for them. It is one of the settings that
travel ([NSWP-11](11-the-visitors-console.md)), so it is off in the next
world too.

## What is not here

- **Scarcity.** Nostr can prove who made a thing and who it was given to.
  It can't stop a maker giving the same thing a thousand times, and there
  is no ledger here that would. A maker may number what they give
  ("12 of 100"), and anyone can count; enforcing it needs a service a
  reader trusts.
- **Winning an item that must be granted.** A world that is only a page
  can't sign a grant. It can add an item anyone may use to its visitor's
  bag; a granted one waits for that same service.

## The order it is being built in

1. **Done:** an item's description; a world's rule for items; the warning
   on a door.
2. **Done:** a visitor's bag, and holding one thing in a hand, drawn in
   worlds that allow it; the switch for all items.
3. **Done:** a person's body and state, and things done to them, with the
   affected person deciding.
4. **Done in part:** muting one person's items. The visitor's own ceilings
   for items are not built.
5. **Done:** an item's own logic, in its locked box; the things it sends
   out.
