# The controls kit

One set of controls for every world: what a visitor can do, drawn as a HUD on
a flat screen and as a console inside a headset. It is part of the SDK, and
the template, the reference worlds and BitPortal's room all use it.

## How it fits together

```
your world ──► controls (a list of actions) ──┬─► HUD      flat screen   nswp-sdk/ui
                                              └─► console  in a headset  nswp-sdk/three
```

- **The controls** (`createControls`) hold everything: the actions, their
  sections, what the visitor is pointing at, and the look. All the logic is
  here.
- **The HUD** (`mountHud`) is real HTML in a shadow root: a hotbar of the
  things always at hand, and a sheet with everything else by section. Keys 1
  to 6 press the hotbar, M opens the sheet, Escape closes it.
- **The console** (`createConsole`) is one panel drawn in the scene. Where a
  hand or controller is tracked, raising that wrist in front of the face
  brings it up above the wrist. A small arched Menu button, low in front of
  the visitor, opens the same console for anyone, including with
  gaze-and-pinch, which tracks no hand.

Neither renderer knows what the actions do. That is why they always offer the
same things, and why a change to the controls shows up in both.

## Using it

```ts
import { createControls, mountHud } from "nswp-sdk/ui";
import { addCameraControls, addRoomControls, addViewControls, createConsole } from "nswp-sdk/three";

const controls = createControls({ title: "My world", address: "example.org", theme: { accent: "#62d9ff" } });
const hud = mountHud(controls);
const xrConsole = createConsole(controls, { renderer, rig });
scene.add(xrConsole.group);

controls.add({ id: "home", section: "travel", icon: "home", label: "Go home", short: "Home", hotbar: true, act: () => portal.home() });
await addViewControls(controls, { renderer, rig, camera, hud }); // Enter VR, Turn around
addRoomControls(controls, presence);                             // Join, microphone, invite
addCameraControls(controls, { renderer, scene, camera,           // Picture, selfie, clip
  look: () => presence.selfLook(), recording: (on) => presence.setRecording(on) });

// each frame
xrConsole.update(dt, camera, renderer.xr.isPresenting);
// when a controller's ray is aimed
const hit = xrConsole.pick(raycaster); xrConsole.aim(hit);
// on select
if (hit) xrConsole.press(hit);
```

## Adding to it

| To add | Do this |
|---|---|
| A button | `controls.add({ id, label, icon, section, act })`. Add `hotbar: true` to keep it at hand, `on: () => boolean` if it is on or off |
| A section | `controls.addSection({ id, label, icon, note })`. The note is where to say what a visitor should know first |
| Words for a moment | `controls.say("Saved")` |
| What is being pointed at | `controls.setTarget("World B, at example.org")` |
| Still loading, though they are in | `controls.setLoading({ fraction: 0.4, words: "Loading the arena" })`, and `controls.setLoading(null)` when it is done. Plain text, at most 80 characters; nothing is held up by it |
| An icon | One line of SVG path data in `packages/sdk/src/ui/icons.ts`. Both renderers draw from it |
| A new kind of control | A `kind` in `ui/model.ts`, and one drawing function for it in `ui/hud.ts` and in `console.ts`. `"swatch"`, a choice of colour, is the worked example. `"tile"` is a thing with a picture of itself (`picture`), laid out side by side with its neighbours: what is in a bag. Rows are drawn in the order they were added, and swatches or tiles that come together are one strip or one grid, where they were put `"line"` is something to read and not to press: an icon, a whole sentence (`label`) and whether it is so (`on`); `run` refuses it, it is never focused or on the hotbar, and the console wraps it whole. A door's details list what its world offers as lines (`door-controls.ts`). |
| Something about a tile at a glance | `mark` (an icon from the console's own set, drawn small in the tile's corner) and `faint` (drawn greyed, and still pressable). The Bag gives its items the bag mark when they are in the visitor's bag or hand, and draws an item offered here faint: grey means not theirs yet, never unavailable |
| The menu as a file of your own build | `const { mountMenu, portHere } = await import("nswp-sdk/menu")`, then `mountMenu(portHere(controls))`, and take `createControls` from `nswp-sdk/three`, not `nswp-sdk/ui` (which carries the menu with it). The menu is then fetched apart from your first file. `mountHud(controls)` is the same thing under its old name, in one file |

## People and the camera

Two sections come with the kit and need no account.

**People** lists who else is in the room, each in the colour of their own
light. Selecting one stands a column of light over them for a few seconds, so
they can be found in a crowd. `addRoomControls` fills it.

**Camera** takes a picture of what the visitor sees, a selfie, or a clip of up
to thirty seconds, and saves it to their device. Nothing is sent anywhere.
`addCameraControls` adds it.

- A picture is the scene drawn once more into a file, so the HUD is never in
  it. Pass `hide` for things in the scene that shouldn't be either.
- A selfie is taken from a camera held out in front of the visitor, with their
  own figure put in for the moment.
- A clip records the page's canvas: picture only, no sound. It isn't offered
  inside a headset, where the page's canvas isn't what is drawn.
- Inside a headset a save can't be shown, so pictures are kept and offered
  under **Save** once the visitor is out.
- **Recording is said out loud.** While a clip is being recorded the others in
  the room see a red light over the recorder, their name in the People list
  says so, and each is told once. A single picture gives no notice.

A world with a camera of its own can use the pieces directly: `takePicture`,
`takeSelfie` and `recordClip`.

## Hands in a headset

`createXrInput` is the kit's part for whatever a visitor is holding:
controllers of any make, or their own tracked hands. It adds to pointing and
selecting and never replaces it.

```js
import { createXrInput } from "nswp-sdk/three";

const input = createXrInput({
  renderer, scene, rig, camera, controls,
  canStand: (x, z) => insideMyWorld(x, z),
  stepFrom: (slot) => stepWhere(controllers[slot]),   // the same step a select on the floor makes
  onMenu: () => xrConsole.setOpen(!xrConsole.open),
});
// each frame:           input.update(dt)
// in your select handler: if (input.claimed(slot)) return;   // that pinch picked something up
input.grabbable(mesh, { release: "return" });
```

| A visitor does this | And this happens |
|---|---|
| Flicks a stick left or right | Turns 30° at once. Held, it turns once |
| Pushes a stick forward, points at the floor, lets go | Steps there, as a select would |
| Pulls a stick back | One step back |
| Squeezes the grip on a thing, or pinches it with tracked fingers | Picks it up. Lets go, and it stays or goes home |
| Points at a thing across the room and squeezes | It comes to their hand |
| Presses B or Y | Opens or closes the console |

- **Any controller.** WebXR gives every tracked controller the same layout, so
  nothing here knows a make or a model. A wand with a touchpad and no stick
  uses the touchpad, counted only while it is clicked. With one stick, that
  stick turns and steps.
- **Comfortable unless asked.** The defaults turn and move in steps. Under
  **Moving** a visitor can choose to walk and turn smoothly, change how far a
  turn goes, swap which hand moves them, and keep or drop the darkened edge
  that goes with moving smoothly. Their choices are kept in their browser, for
  that site.
- **A buzz** in the hand on a turn, a step, a grab and a press, where the
  controller can. `input.pulse(slot, strength, ms)` sends one.
- **What is drawn.** A plain controller in the kit's own style, the same for
  every make, with lights that answer the trigger and the grip; and a tracked
  hand as its joints. Nothing is downloaded, so no request says which headset
  someone owns. A world with hands of its own passes `models: false`.
- **The kit's held hands, for a Quest's controllers:** pass `handsAt` with
  where your page serves the kit's hand files, copied from
  `packages/sdk/assets/hands/` beside it as its sounds are (the reference
  worlds use `"/hands/kit/"`). A Quest's controllers are then drawn as a
  see-through hand holding a see-through controller, whose fingers follow the
  trigger, grip and thumb. About 490 KB, fetched on the first Quest
  controller only, from your own site. Left out, or for any other
  controller, the kit's own drawing is kept. The files' licence and where they
  come from go with them (`LICENSE-webxr-input-profiles.md`, `PROVENANCE.md`).
- **What is drawn never blocks pointing.** The visitor's own controller and
  fingers are skipped by rays, so they can't be "in the way" of a step.
- **Held things are local.** What a visitor picks up moves on their screen
  only. Others in a room don't see it move: rooms carry people, not objects.

The pure part, `actions.ts`, turns a gamepad into intent and has no three.js in
it: `readPad`, `Locomotion`, `Comfort`. Use it alone in a world that draws and
moves things its own way.

## Panels

A panel is a flat thing a visitor hangs in the air: a note, a picture or a
video, in a frame with a bar along its top.

```js
import { addPanelControls, createPanels } from "nswp-sdk/three";

const panels = createPanels({ scene, camera, accent, input, keep: "my-site:panels" });
panels.open({ kind: "note", title: "Read me", text: "Welcome." }, { keep: false });   // the world's own
addPanelControls(controls, panels, { presenting: () => renderer.xr.isPresenting, kept: true });
// each frame:   panels.update(t, dt)
// with a ray:   const hit = panels.pick(raycaster); panels.aim(hit);
// on select:    if (hit) panels.press(hit);
// flat screen:  pointerdown -> if (panels.pointer("down", raycaster)) the panel has the drag
//               pointermove -> panels.pointer("move", raycaster);  pointerup -> panels.pointer("up", raycaster)
```

| A visitor does this | And this happens |
|---|---|
| Drags the bar with a mouse or a finger | The panel follows, and turns to face them |
| Squeezes a grip on the bar, or pinches it | The same, in a headset. From across a room it stays at arm's length and moves from there |
| Selects **−** or **+** | It gets smaller or larger |
| Selects **×** | It is put away |
| Selects a video, or its play button | It plays or pauses |

- **What a panel shows is drawn by the kit:** words it lays out, a picture or
  video the page may load, or a file the visitor chose from their own device.
  It is never another website. No page can draw one into a 3D scene; a browser
  that could is a different thing ([`browser/spec.md`](../browser/spec.md)).
- **Kept, where the page asks.** With `keep`, a visitor's panels are stored
  in their browser, for that site, and hang where they left them next visit.
  A file they chose is kept there too, up to 64 MB. Nothing is sent anywhere.
- **A world's own panels** are opened with `keep: false`. They are there for
  every visitor and belong to none of them.
- **Loading tells.** A picture or video from another site tells that site who
  is looking. The kit loads whatever the page's own rules allow, and the
  reference sites allow only their own files and the visitor's.
- **Writing works in a headset.** The kit draws a keyboard in the scene
  (below), so "Write a note" is offered everywhere.
- **The device's own files are shown by the browser,** as a flat window, so
  "Hang a picture or video from this device" is offered outside a headset.
  Inside one, the visitor chooses from their library (below).
- **A panel is in the way of what is behind it,** like any solid thing: a
  select on a panel is not a step onto the floor past it.
- **Yours only.** Others in a room don't see a visitor's panels.

`panel-store.ts` is the part with no three.js in it: what may be kept, where a
new panel goes, how a note is wrapped.

### See-through, and pinned in the view

Every panel's bar has two more buttons beside − + ✕.

```js
panel.setLook({ opacity: 1, dark: 0.08 });   // dark parts gone: letters hanging in the air
panel.setPinned(true);                        // it comes along, where it now sits in the view
```

- **How see-through.** `opacity` is the whole panel. `dark` is how much of
  its dark parts is left, so a dark panel can let the world through between
  its bright parts. The button goes round four looks (`PANEL_LOOKS`).
- **Pinned.** On a flat screen a pinned panel keeps its place on the screen.
  In a headset it does not: something glued to the eyes is tiring and makes
  people ill. It stays put while the visitor looks about, so it can be read,
  and comes round when they have turned or moved well away.
- Both are kept with the panel.

### Staying put through a refresh

```js
const stay = createStay();
const stood = cameThroughADoor ? null : stay.before;   // { x, z, yaw, headset } after a refresh, null on any arrival
// now and then, and on pagehide:  stay.keep({ x, z, yaw, headset: renderer.xr.isPresenting })
```

Someone building a world refreshes it all day, and being sent back to the
entrance each time makes every change feel like starting again. It is kept
for the tab, and given back only when the page was refreshed. A refresh
always ends a headset session, which is the browser's rule: `headset` says
they were in one, so the way back in can be offered first and alone
(`addViewControls`' `arrived`).

### Speaking instead of typing

`panels.keyboard.voice` is one button's worth of speech: press to start,
press again to finish, and the words are typed. The drawn keyboard has a
**Speak** key wherever something can do the work.

```js
panels.keyboard.voice.toggle({ onText: (words) => field.value += words, say: (line) => status.textContent = line });
panels.keyboard.voice.add(computerVoice("my computer", (pcm, lang) => sendSomewhereOfTheirs(pcm, lang)));
```

- **Who turns the sound into words is the whole question.** A visitor's own
  computer is preferred when one is connected
  ([`browser/bridge.md`](../browser/bridge.md)). Otherwise the browser's own
  recognition is used where it exists, on the device where the browser can.
- **Where the browser would send the sound away, the visitor is told first,**
  once, and a second press goes ahead.
- **Speaking never presses Enter.** Words come back as one line.
- Not every browser has it. Where nothing can listen there is no Speak key.

### A keyboard in the headset

`panels.keyboard` is a keyboard the kit draws: its keys are pressed with a
select, like everything else, so it works on every headset.

```js
const text = await panels.keyboard.ask({ title: "A name for the room", maxLength: 48 });   // null if they gave up
```

- It comes up low in front of the visitor, leaning back like something on a
  desk, with what they have written above the keys.
- Letters, a second layer of numbers and marks, shift (once for one capital,
  twice to stay), and a capital at the start of each sentence.
- **A real keyboard types into it too,** and so does a paste. While it is up,
  nothing behind hears the keys: no walking, no shortcuts.
- **It is in front of everything.** Its keys are found by `panels.pick()` and
  pressed by `panels.press()`, with no wiring of their own. A world that has a
  console should ask `panels.keyboard.pick()` before its console, and put the
  console away while `panels.keyboard.open`: the two come up in the same
  place.
- **The headset's own keyboard,** where its browser offers one to a page, is
  one key away. It is the visitor's choice, because it has been tried on no
  headset here.

`keys.ts` is the part with no three.js in it: the layout, and what each press
does to the words.

For something that takes keys as they are typed, a terminal, the same
keyboard has a second mode: `panels.keyboard.live({ title, onKey, onClose })`.
It has Esc, Tab, Ctrl and the arrows, sends each key as it is pressed, and
stays up until it is put away. Ctrl is pressed first and the letter after,
because there is one pointer and not ten fingers. `term-keys.ts` is its part
with no three.js in it.

### A panel of the page's own

A `custom` panel shows a texture the page draws, and can hear about it:

```js
panels.open({ kind: "custom", title: "Scores", texture, aspect: 16 / 9,
  onPress: (x, y) => {},      // where on the picture, each from 0 to 1, y downwards
  onClose: () => {} });
```

It is never kept between visits. The terminal panel (`nswp-sdk/terminal`,
[`browser/bridge.md`](../browser/bridge.md)) is one of these. That entry is
for a home: it needs the visitor's signer, which a world is never given.

### A library of the visitor's own

A page can't show the files on a visitor's device. What it can hold is what
they have already given it. `panels.library` keeps every picture and video
they hang, in their browser, and shows them on a board to choose from.

```js
panels.library.showing = true;                       // the board, in front of them
addCameraControls(controls, { ..., onCapture: (c) => void panels.library.add(c.blob, c.name) });
```

- Select one to hang it. **Remove one** turns the next select into removing:
  the file goes, and any panel showing it goes with it.
- With `onCapture`, every picture taken with the kit's camera goes into the
  library, so a picture taken in a headset can be hung without leaving it.
- Sixty files at most, 64 MB each, with a small picture of each to recognise
  it by. Kept for this site, in this browser. Nothing is sent anywhere.

## Leaving and arriving

A crossing between two sites can't be made seamless: a browser shows flat
pages in between and asks for a press to go back into a headset. The kit makes
the two ends the same place, and makes that press the only thing asked.

```js
import { addViewControls, createCrossing } from "nswp-sdk/three";

const crossing = createCrossing({ scene, camera, accent, motion: () => controls.theme.motion });
let offered = !!context?.immersive;
if (context) crossing.arrive({ title, address: location.host, ready: loaded, hold: () => offered });
await addViewControls(controls, { renderer, rig, camera, hud,
  ...(context?.immersive ? { arrived: { title } } : {}), onOffer: (showing) => (offered = showing) });
// each frame:  crossing.update(t, dt)
// on a door:   await crossing.leave({ title, address }); portal.go(dest, { xrSession });
// may they stand here?  crossing.allows(x, z) && ...
```

- **Arriving,** a visitor who came through an Airlock starts inside the
  chamber. Its doors open when `ready` settles, and then it sinks away.
- **From a headset,** they are first shown one large **Launch**, focused,
  with a quiet "Look around on this screen" under it. The whole page is
  that button: a press anywhere but on the quiet link, with anything,
  starts the session (`ui/headset.ts`). The doors wait for their answer,
  so they are seen to open from inside.
- **Leaving,** the walls rise round them with the destination over the doors,
  and the page goes on to their Airlock about half a second later.
- **Where a browser carries the session over** (`sessiongranted`), the offer
  is answered for them.
- **Asked for from a menu above the world,** the same screen comes up, saying
  **Launch**. Where a visitor's client draws the menu above a world in its frame,
  their press on **Enter VR** is a press in the client's page, and a browser
  starts a headset session only at a press in the world's own. So the world asks
  for one: two presses, each with its own name (the owner, 2026-11-23).
- It is scenery: it asks nothing, claims nothing and has nothing to press.
  [NSWP-02](../protocol/02-doors.md) says why.

## Who the visitor is, and signing in

`addViewControls` adds what says who the visitor is here, under "You".
Where their client named a signer, as the reference client does, it is the
signer's row, "Sign in, at bitlogin.network", and they never leave your
world ("Signing as the visitor", below). Where it named none, it is a
control that offers the way to change it: "You are a guest here. Sign in",
or "Here as Alice. Switch profile, or go as a guest". A world writes nothing
for either. Pressed, the second leaves for the visitor's own client
(`portal.signIn()`), which asks them on its own page and brings them back to
this world, by name if they chose that
([NSWP-10](../protocol/10-identity.md), "Signing in from inside a world").

- Pass `leaving` to `addViewControls` to send their state along, so they
  come back as they left: `leaving: () => ({ ...travelling(), moving })`.
- To put the button somewhere of your own, press the same one:
  `controls.run("signer")` for the signer's row, `controls.run("identity")`
  for the other. `identityWords()` has the second's words, and
  `identityHost()` the host it leads to.
- The second is absent when there is no Airlock to go back to, and where
  the visitor's client named a signer: then signing in is the signer's row
  ("Signing as the visitor", below), and there is one sign-in, not two.
- When they come back, `arrival.identity()` has their name and key, checked.

A world never draws the sign-in itself, in a panel or anywhere else.

"Change how you look" is added beside it (`figureAction`, `controls.run("figure")`,
`portal.changeLook()`), and leaves and comes back the same way. Pass
`leaving` as a function that brings your crossing's room up first, and both
leave by it, as through any door:

```js
leaving: async (to) => { await crossing.leave(to); return { ...travelling(), moving }; }
```

### What a visitor prefers, in every world

Four things are the visitor's standing preferences. They arrive with them,
the kit starts from them, and its controls change them everywhere:

| Preference | Control | In your world |
|---|---|---|
| A filled screen | `fullscreen` | Nothing to do: it is taken at their first press (`resumeFullscreen`, called by `arrival.read()`) |
| The intense way at a desk | `fps` | Nothing to do with `createFps` |
| How fast the view turns | `look-speed` | `createFps` uses it. Multiply your own drag-to-look by `lookScale()` |
| How wide they see at a desk | `fov` | `addViewControls` keeps your camera to it. If you set `camera.fov` yourself (to fit a window, say), pass `fov: false` and use `visitorFov() ?? yours`, calling your fit again from `onDeskChange` |

They are what the visitor chose, not how things stand: `prefersFullscreen()`
stays true after Escape, and the next world fills the screen again. Never
report `full` from `document.fullscreenElement`.

On a desk, while the screen isn't filled, the HUD shows a small "Full
screen" button at the top centre (`fullscreenButton`): never on a touch
screen or in a headset, and gone once the screen is filled. Keep the top
centre of your own interface clear for it. In fullscreen the kit holds
Escape where the browser lets a page (Chromium's Keyboard Lock): the first
Escape brings up the menu, and Escape again with the menu open leaves
fullscreen (`escapeDoes` is the one rule; don't answer Escape yourself as
well). Firefox and Safari don't let a page hold it, so there the first
Escape leaves fullscreen and the menu comes up then. A long hold of Escape
always leaves, whatever the page does.

A visitor can keep a tab of the menu on their bar: each tab has "Keep this
tab on your bar" beside Close, and a pinned tab stands after your own keys
and brings the menu up on it. Four at most. It is theirs: `controls.pins`
says which, and `controls.setPinned(tab, pinned)` is what the button calls,
but don't pin for them. What they pinned travels with their other settings,
so a tab pinned in one world is on their bar in the next that has it. Give a
tab of your own a short plain id (a lowercase word of twelve letters at
most) and it can be pinned and travel too. A tab with any other id is in
your world's own menu and in no client's, rows and all, and the console
says so once as you add it.

Six keys of your own and four pinned tabs are wider than a phone. The bar
then slides sideways, with an arrow at each end that has more, as the
menu's tab row does. The arrows stand beside the keys, never over one.
What is in hand (Fire, Reload) leads the bar, and taking something up
brings the bar back to its start.

### People's names and pictures

Someone who came by name is shown by the name and the picture from their
Nostr profile, both off their pass. `createPresence` draws the picture as a
round badge over the name. It is a button: wherever your world asks what a
pointer is on, ask the room too.

```js
if (presence.pressAt(raycaster)) return; // someone's picture: they are chosen, and the menu comes up on People
```

`presence.personAt(raycaster)` says whose picture it is without pressing.
`controls.signal("show:people")` brings the menu up on a section from
anywhere. (Where a client above your world has the menu, the same signal
asks the client for that tab, as the word `show` in NSWP-02. The client
brings its menu up there, and never puts it away for the asking.) The visitor's switch is `people-pictures`; `showsPictures()` reads
it, and `loadPicture(address)` fetches one the safe way for anything you
draw yourself.

### Signing as the visitor

A world never holds its visitor's key. The kit embeds their own client's
hidden signer and asks it ([NSWP-10](../protocol/10-identity.md), "Signing
from a world"). `addViewControls` adds the control: **Sign in, at
bitlogin.network**, under You, in every world. It opens a window of the
visitor's sign-in address, where they say yes. Nothing is typed in your
world.

Where a signer is named, that is the one sign-in in your world
([NSWP-10](../protocol/10-identity.md), "One sign-in"). Signed in, the row
reads "Signed in as Alice. Sign out here", under a card with their picture,
name and key. Until then they are a guest in a room, whatever pass they
arrived with, and the older "Here as Alice" row is not shown. `hereAs()` is
who they are now; `signerNamed()` says whether this applies; `youCard()` is
the card. `createPresence({ identity: () => arrival.identity() })` is still
what you write: the kit holds the pass until they are signed in. Signed in
with no pass for that key, the kit asks their signer for one
(`signer.pass(session)`, "A pass from the signer"), checks it, and keeps it
where `arrival.identity()` finds it; `onHereAs(fn)` says when who they are
here has changed.

A tab of yours that says to sign in can have the same press right there:
`controls.add(signInHere(controls, "my-tab"))` (from `nswp-sdk/ui`), before
the tab's other rows, puts a **Sign in, at bitlogin.network** row at its top,
with the id `sign-in-my-tab`. It does what You's row does, in one press (the
client's sign-in under a client that has one, the sign-in window otherwise),
and isn't there once they are signed in or where no signer is named. The
kit's own Achievements and Scores tabs use it while something waits on
signing in. And a press of the kit's that needs signing in, made signed out
(Follow, Write, Show, Post, joining a room only for people who are signed
in), says why and starts the sign-in there and then.

When who they are here changes, the HUD says so once at the top centre of
the view: their picture and name under "Signed in as", for a few seconds, and
"Signed out" the same way. It reads the card at the head of You, so a client
that fills that card in its own room (`card` on the section) gets the same
badge. Nothing is shown to a guest who never signed in.

A signer that was named and says nothing is loaded once more by the kit
before anyone is told. After that the row reads "bitlogin.network didn't
answer. Press to ask again", and a press does (`signer.retry()`).

```js
const signer = worldSigner();        // the page's one signer: where the visitor's client said, or beside its Airlock
// or, for a site that isn't a world: createWorldSigner({ at: { signer, window } })
signer.state;                        // "none" (no client offers one), "locked", "unlocked"
signer.onChange(() => {});
const note = await signer.sign({ kind: 1, content: "Hello", tags: [] });  // null if locked or refused
if (note) await publishEvent(relays, note);                               // sending it is yours to do
```

- Once allowed, your world stays allowed on that device until the visitor
  signs out of it there, or the signer's own limit (BitLogin's is thirty
  days). `signer.state` is "unlocked" from the first answer after a page
  load: nothing is asked again.
- A note (kind 1) and a reaction (kind 7) are signed once the visitor has
  allowed your world. Everything else is refused, and a refusal never says
  why. Three a minute, twenty an hour.
- What comes back carries `["nswp:world", "<your origin>"]`, put there by
  the signer. `sign()` returns only a note that checks out.
- `signer.unlock()` must be called from a press: a browser opens a window
  for nothing else. Never draw anything that looks like the visitor's
  sign-in, and never ask for a password: there is nothing you could do
  with one, and asking is how a visitor is robbed.
- Under Room, **Send out a post** is there whenever the visitor has a
  signer. Signed out, the row says where they sign in first, and pressing it
  opens that window. Signed in, it opens **My public feed**: their own posts,
  newest first, and the place to write another. It is the other side of the
  panel the chat is on (`controls.signal("toggle:feed")`,
  `hud.setChatOpen(true, "feed")`), and a panel of its own in a headset.
  Nothing said to the room is posted. A post goes to the relays the visitor
  says they write to, in their own relay list (NIP-65), and their earlier
  posts are read from the same. `addRoomControls(..., { noteRelays })`
  names the usual relays: where that list is looked for, and where a post
  goes for someone who has published none. `controls.feed.view()` has `{ ready, title, who, posts, loading,
  said }` if you draw it yourself.
- A world has nothing more to do. `{ notes }` is for a visitor's own client,
  in a room of its own where they are already signed in: it gives a signer
  of its own in place of the world signer. A world never passes one: it has
  no key to sign with, and must not acquire one.
- Your site's security policy must let the client be embedded:
  `frame-src 'self' https:`.

### Which relays

Whatever a world sends for a visitor (a post, a save) goes to the relays
they say they write to, in their own relay list (NIP-65): that is where
anyone looking for it will look. The kit adds one thing, which is knowing
which relays are working.

```ts
import { askOwn, askWell, sendWell } from "nswp-sdk/three";

const sent = await sendWell(event, { own: theirWriteRelays, usual: DEFAULT_RELAYS }); // { took, relays, own }
const got = await askWell(filter, { own: theirWriteRelays, usual: DEFAULT_RELAYS });
// A person's own note: their relay list found for you, and "none" said only when it is so.
const mine = await askOwn(filter, theirKey, { usual: DEFAULT_RELAYS, mine: { kept } }); // { events, state, relays, own }
```

- **It remembers how each relay answered,** on the device, and puts the ones
  that have been answering first. Lately counts for more, and a relay that
  hasn't been tried for a week is given another chance.
- **Their own relays are never dropped** for being down. If fewer than three
  of them are up, the best of the usual relays are added, so what is sent is
  kept somewhere that is.
- **A note is sent once three relays took it** (`RELAY_PICK.took`), counted
  from what they said. Fewer: the rest of the usual relays are tried once,
  and `took` says how many have it, so you can tell the visitor and send it
  again later. The Bag says "Only 1 relay has it so far" and sends it again
  at the next look. **And a visitor's own newest note is put back** on the
  relays that answered a look without it: their own first, then the usual
  ones, up to six a look (`RELAY_PICK.mend`), each once a day. So it can
  reach more usual relays than `RELAY_PICK.usual` says for a send: a
  reader without their list looks there.
- **A person's own note always reaches at least one usual relay too**
  (`RELAY_PICK.usual`), however many of their own took it: a world that
  hasn't their relay list yet looks only there, and the list itself is
  found only there. Never a wrapped private message, which goes only where
  its reader said.
- **A relay that refuses for a sign-in or a payment takes no place.** Told
  from how it said no: CLOSED to a question, or OK false to a note, with
  "auth-required:" or "restricted:" (NIP-01), or a monitor's finding.
  Closed to reading and to writing are kept apart: a paid relay that
  refuses a note still answers a question. A challenge to sign in followed
  by an answer to the end is an answer like any other.
- **`askOwn` looks for a person's own note.** Their relay list is asked of
  the best of the usual relays while those are asked for the note, and
  taken once one has given it and the rest have had a second
  (`RELAY_PICK.graceMs`), or once all have answered, never waited for longer
  than six (`RELAY_PICK.listWaitMs`); their own relays are asked as it
  comes. Each step of the look is done the same way once something is
  found, so a relay that never answers holds nothing up once another has
  answered. `relaysOf(who, …)` gives a person's relays by the same rules,
  for sending something of theirs. With
  `mine`, the visitor's own note on their own device: where nothing is
  found, the rest of their relays (up to `RELAY_PICK.listed`, 24) are asked
  four at a time (`RELAY_PICK.wave`, three seconds each), then any that ran
  out of time once more for six (`RELAY_PICK.lateMs`); their newest note is
  put back on up to six relays that answered without it
  (`RELAY_PICK.mend`), each once a day; their relay list is kept on the
  device and put back on a usual relay that lacks it. `state` is "none"
  only once every relay there was to ask was asked and at least half of
  them, never fewer than three, answered to the end; otherwise
  "unreached", never "empty". Someone else's note gets the first look only.
- **If nothing takes it at all,** the rest of the usual relays are tried once.
- **If still nothing, there is a backup** (NIP-66). Relay monitors publish
  which relays they found working. The kit asks for that only then, takes
  relays that at least two monitors found open to anyone (no proof of who
  you are, no payment), and tries a few. The same when nothing answers a
  question. One monitor is never believed alone, and nothing depends on
  any of them: with no monitor to ask, everything is as it was.
  `relayBackup(false)` turns it off for a page. A private message is never
  sent to a backup: it goes where its reader said, or nowhere.
- **For a page that calls relays itself,** `queryBacked` and
  `publishBacked` (from `nswp-sdk/ui`) are called exactly as the core's
  `queryRelays` and `publishEvent`, with the backup behind them.
- What is remembered is about relays, never about a person, and is sent
  nowhere. A visitor's relay list is theirs: the kit never changes it.

Not built: taking a relay monitor's word (NIP-66) for relays the device has
never tried. A monitor's report is someone's claim, so it would only ever be
a first guess.

### Following people

A person's card in a room has **Follow** on it, for someone who came by
name, when your visitor is signed in. There is nothing for you to add: it
comes with `addRoomControls`. It changes their own Nostr follow list
([NSWP-14](../protocol/14-people-and-messages.md)), the same one every other
Nostr client reads.

The first time in your world, their sign-in address asks them whether your
world may change who they follow. After that it works there without asking.
To use it yourself, say for a leaderboard row:

```ts
import { worldPeople, worldSigner } from "nswp-sdk/three";

const people = worldPeople();
if (worldSigner().more.includes("follows")) {
  const done = await people.follow(theirKey, "Ada"); // { ok, why, said }
  controls.say(done.said);
}
```

The menu also has a **Following** tab: who they follow, by name, with
unfollowing and following by a copied key. It is there for a visitor who is
signed in, and asks them once before it shows anything.

There is a **Messages** tab as well: their private messages (NIP-17), and a
conversation with one person on a panel of its own, beside the room's chat.
A person's card and the Following tab each have "Write to them, privately".
It asks them once, in their sign-in address's window, before your world can
send or read anything. You add nothing; and there is nothing for your code
to read: the kit holds the messages, and shows them to the visitor.

Where they haven't let your world yet, call `worldSigner().want(["follows"])`
and then `worldSigner().unlock()`, both from the same press. Don't ask on
arrival: ask when they press the thing that needs it.

### Keeping score

Optional. If your world keeps score, name a board and record what a visitor
makes ([NSWP-15](../protocol/15-scores.md)):

```ts
import { addScoreControls, createScores, worldSigner } from "nswp-sdk/three";

const scores = createScores({
  world: "37300:<your publisher key>:<your world's d>",
  worldUrl: location.origin,
  boards: [{ id: "lantern-run", title: "Lantern Run", order: "low", format: "time" }],
  hand: { pubkey: () => worldSigner().pubkey, sign: (w, b, s) => worldSigner().score(w, b, s) },
});
addScoreControls(controls, { scores, signedIn: () => worldSigner().state === "unlocked" });

scores.record("lantern-run", 42_500); // a run just ended
```

- **Their best is kept on the device,** for anyone, as they make it.
- **Posting it is theirs to do,** from the Scores tab this adds to the menu.
  A posted score is public: it says they were here, and how they did.
- **The tab lists who else is on the board:** people they follow first,
  where they have let your world see who that is, then everyone else.
- **A score is a claim.** Nothing checks it, and the tab says so. Don't call
  anyone a winner or a record holder on it.

### Marking what they did

Optional, and built like scores. Name your achievements, and say when a
visitor earns one ([NSWP-16](../protocol/16-achievements.md)):

```ts
import { addAchievementControls, createAchievements, worldSigner } from "nswp-sdk/three";

const achievements = createAchievements({
  world: "37300:<your publisher key>:<your world's d>",
  worldUrl: location.origin,
  list: [
    { id: "all-twelve", title: "All twelve", about: "Catch every lantern in one run" },
    { id: "under-thirty", title: "Lamplighter", about: "In less than thirty seconds", hidden: true },
  ],
  hand: { pubkey: () => worldSigner().pubkey, sign: (w, id, title) => worldSigner().achieve(w, id, title) },
});
addAchievementControls(controls, { achievements, signedIn: () => worldSigner().state === "unlocked" });

achievements.earn("all-twelve"); // they just did it
```

- **What they earn is kept on the device,** for anyone, and they are told
  as it happens.
- **Showing it as theirs is their choice,** from the Achievements tab this
  adds. Shown, it is public.
- **A hidden one isn't named** until it is earned.
- **It is a claim.** Nothing checks it, and the tab says so.

### What people thought, on your doors

Optional. A door can say what the people your visitor follows thought of
where it leads ([NSWP-13](../protocol/13-ratings.md)):

```ts
import { createDoorRatings, worldPeople, worldSigner } from "nswp-sdk/three";

const signedIn = () => worldSigner().state === "unlocked";
const ratings = createDoorRatings({
  doors: [{ world: "37300:<publisher>:arcade", url: "https://arcade.example/" }],
  me: () => (signedIn() ? worldSigner().pubkey : null),
  counted: () => (signedIn() && worldSigner().more.includes("follows") ? worldPeople().follows() : null),
});
ratings.onChange(() => gate.setRating(ratings.mark("37300:<publisher>:arcade")));
void ratings.load();
```

A guest sees nothing and nothing is asked. Someone signed in sees their own
rating; the people they follow are counted once they have let your world
see who that is. Your world only shows ratings: giving one is done at the
visitor's own client.

### Keys in the menu

Left and right go along the menu's tabs, from anywhere in the menu that has
no use of its own for them (a box being typed in, a slider); Home and End
go to the first and last. The Tab key stops once on the strip, at the tab
that is up. A wheel turned over the strip slides it. While the menu has an
arrow key the world doesn't hear it.

### What they carry, and hold

A world has items unless its announcement says `none`
([NSWP-17](../protocol/17-items.md)). It draws the one thing each person
holds, and lets its visitor take something from their bag, by giving its
presence somewhere to fetch items from. A world that doesn't do this can't
draw them, and says `"items": "none"` in its announcement:

```ts
import { addBagControls, createBag, createItems, createPresence, worldSigner } from "nswp-sdk/three";

const items = createItems();
const presence = createPresence({ scene, camera, items, itemsRule: () => "allowed" /* …the rest */ });
const me = () => (worldSigner().state === "unlocked" ? worldSigner().pubkey : null);
addBagControls(controls, {
  bag: createBag({ me }),
  items,
  me,
  rule: () => "allowed",
  holding: () => presence.holding,
  hold: (item) => presence.setHolding(item),
});
```

- A guest has no Bag tab. Someone signed in looks through theirs and holds
  one thing; everyone in the room sees it.
- Your world can't change a bag. Things are put in and taken out at the
  visitor's own client.
- **A thing's picture, anywhere you draw one yourself:** `createItemPreviews`
  from `nswp-sdk/three` is what the Bag's own pictures are made with. Give
  it what gives an item's model (`{ model, size? }`), and it answers a
  still or a turning picture of the item as a canvas. The same code as a
  world's Bag, so a thing looks the same wherever it is drawn. It needs the
  renderer, so it is in this entry and not in `nswp-sdk/bag`, which hands
  on only its type.
- Each person fetches what another holds for themselves, checks it against
  its hash, and counts it (`ITEM_BUDGET`). Where it fails, a plain marker of
  its size is drawn.
- **Your page has to be let fetch models from wherever makers keep them:**
  `connect-src` with `https:`. A world with no items shouldn't have that.
- The visitor's own switch, "Items: off", holds in every world
  (`showsItems`).
- A visitor's own client, which can change the bag, may pass `offered`: a
  few items to put in with one press. A world never does.
- A client may start someone's first bag with things of its own (a guest's
  starter set): `bag.start(items)`, one note and one signature. It writes
  only where there is surely none (enough of their relays answered, every
  relay on their own list was asked, and the device keeps none), and never
  over a bag found anywhere. A world never does.
- **Items that do something** (a blaster that sends out darts) need three
  more things from your world:
  - `itemScripts: true` and `sounds` on `createPresence`, to let an item's
    own logic run and be heard;
  - the locked box served as `item-box.html` beside your page: write out
    `ITEM_BOX_HTML` from `@nswp/core`, serve it with exactly `ITEM_BOX_CSP`
    as its Content-Security-Policy, and leave your world's own content
    rules off that one page;
  - `addItemControls(controls, { play: () => presence.play, holdingHand: () => presence.holdingHand, dom: renderer.domElement })`
    for the two presses, and a call to its `trigger(hand)` where you handle
    a headset's trigger, after your own console.
- Where you handle a press on the view yourself, call
  `itemControls.tap(raycaster.ray, heldMs)` after your own panels and before
  anything else: it returns true when the press was the item's (a tap, with
  something in hand that does something), and you do nothing more with it.
  A press held (`TAP_MS` or longer) is still yours, for walking.
- Pass `sight: (on) => presence.setSighting(on)` to `addItemControls` for
  aiming along an item's sight, and `theme` to `createPresence` so that how
  a visitor is shown is in your world's colour.
- Things an item sends out stick to any mesh of your scene. Nothing of
  yours has to be an item. Give `solid` to say what isn't solid, and
  `onStruck` to be told what was struck and decide what that means.
- In a world that says nothing about items, the tab still shows the bag,
  says nothing carried works there, and offers nothing to hold.

### What someone has done, on their card

Optional. Where your world keeps score or marks achievements, a person's
card (in People, and in Following) can say where they stand and what they
show:

```ts
import { worldPersonLines } from "nswp-sdk/three";

const about = worldPersonLines({ scores, achievements });
addRoomControls(controls, presence, { about });
```

It reads your world's own boards and achievements, once, when a card is
first shown, and asks no relay about the person on it.

### Keeping their progress

A world with something to remember for a visitor keeps it as a save
([NSWP-12](../protocol/12-saves.md)):

```ts
import { worldSaves } from "nswp-sdk/three";

const saves = worldSaves();
const last = await saves.load();                    // { data, at, from: "account" | "device" } or null
const r = await saves.save(JSON.stringify(state));  // { kept: "account" | "device" | "nowhere", said }
```

- **A save is text,** the world's own, 32 KB at most, in a slot (`"main"`
  unless you name another). `saves.clear(slot)` empties one.
- **It is kept on the device at once,** whoever they are. For a visitor who
  is signed in here it is also kept with their account, on their own relays,
  encrypted so that only they can read it. `load` gives the newer of the two.
- **A world reaches its own saves and nobody else's.** It never says where
  one is kept: their signer works that out from the site's address.
- **Say where it went** when it matters: `r.said` is words for them ("Saved
  to your account", "Saved on this device. Sign in to keep it with your
  account").
- **Load again when they sign in** (`worldSigner().onChange`): they may have
  a save from another device. The Arcade does this for its best time.
- A signer has to implement its side. Until the visitor's does, `kept` is
  `"device"`, and nothing else changes for the world.

### Who someone is

Choosing someone, from People or by the picture over their head, puts a card
at the head of the People section: their picture, name, whether they came by
name, their key, and what they wrote about themselves. `addRoomControls`
does it. On a flat screen it is in the menu; in a headset, on the console.

A section of your own can have a card too:

```js
controls.addSection({ id: "shop", label: "Shop", card: () => ({
  title: "The keeper", tag: "", proven: false, sub: "Open until six", copy: "",
  text: "", picture: "", color: "#ffb65c", now: [],
}) });
```

Every field is plain text. `text` is drawn as a quotation: for a person it
is what they say about themselves, and never the world's word for it.
`picture` is fetched with `loadPicture` and nothing else.

### What people write

Join a room and there is written chat, with nothing to add: `addRoomControls`
wires it. A line someone writes is drawn over their head for a few seconds,
and listed in a panel.

- **On a flat screen** the panel is at the right-hand side (across the
  bottom on a phone). Put away, the newest lines pass by for a few seconds.
  Enter or T opens it to write in; Enter sends; Enter on an empty line, or
  Escape, puts it away. No key pressed in its field reaches your world.
- **In a headset** it is a panel of the visitor's own, pinned beside them
  until they move it. Its one button puts the kit's keyboard up, with its
  Speak key.
- **The control** is `room-chat`, on the taskbar once a room is joined, with
  a count of what hasn't been read. `room-chat-show` is the visitor's switch;
  `showsChat()` reads it.

```js
controls.chat.view();              // { ready, title, lines, unread, limit, version }
controls.chat.send("Hello");       // says it; returns a few words if it couldn't be said
controls.signal("toggle:chat");    // open the panel, or put it away
presence.whereIs(pubkey);          // { distance, pan }: where someone is from the visitor's head
controls.setKeys({ chat: null });  // your world needs T and Enter for itself
createPresence({ ..., bubbles: false }); // you draw what people write your own way
presence.session.on("said", (member, line) => {}); // every line, the visitor's own included
```

A line that arrives is heard as well: the `chat` cue, played from where its
writer stands (`sounds.play("chat", { distance, pan })`). It is quieter and
duller the further off they are, never silent, and nothing like the kit's
`notice`. A theme can give `chat` a file of its own, or `null` for none.

A line is plain text, already cleaned: draw it as text and as nothing else.
Never make a link in one open by itself, and never fetch anything a line
names. What the rules are, and why, is in
[NSWP-06](../protocol/06-rooms.md), "Words".

### One order everywhere

`controls.view()` puts the things every place has in one order, whatever
order your code added them in (`STANDARD_ORDER`): home, doors, the headset,
the room, the microphone, chat, jump. So the taskbar and its number keys are the
same in every world. Your own controls follow in the order you added them.
Sections have a standard order too, and "Sound" and "Display" are part of
it. `hud.setOpen(true, "sound")` brings the menu up on a section by name.
Named a section the menu doesn't have yet, it comes up where it last was,
and goes to that section if you add it within two seconds
(`MENU_SHOW_KEEP_MS`), unless the visitor has chosen another or put the
menu away.

## Sharing the screen with a world's own interface

A world with an interface of its own leads, and the kit stays out of its way
(spec §21.3). Three levels, set at the start or changed as the world goes:

```ts
const controls = createControls({ title, presence: "quiet", corner: "top-right", keys: { hotbar: false } });

controls.setPresence("full");   // a lobby, a menu screen
controls.setPresence("quiet");  // during play: one mark in a corner
controls.setPresence("hidden"); // a cutscene, or a world that draws these itself
```

| Level | Flat screen | Headset |
|---|---|---|
| `"full"` | Name, hotbar, the menu's button (the mark, no words; "Menu, M" on hover with a mouse) | The Menu button low in front, the same mark, and the wrist |
| `"quiet"` | One mark in the chosen corner; it opens the same sheet. Where the visit started by touch (a phone), the bar too: there is no keyboard to keep for play, and without it nothing is there to press for what it carries | The wrist. The Menu button, smaller, only where no hand is tracked |
| `"hidden"` | Nothing | Nothing, until the visitor summons it or the world calls `xrConsole.setOpen(true)` or `hud.setOpen(true)` |

The menu's button is the mark in every form: a lit doorway in a glass tile, in the world's colours, with no words. Its name, "Menu", is read aloud, and its key opens it; with a mouse, a hint says both on hover. `markSvg()` (from `nswp-sdk/ui`) gives the same mark as a picture, from the same numbers, for a page's or an app's icon: `markSvg({ accent: "#4fd08b" })` in a place's own colour, `markSvg({ tile: false })` for the doorway alone. The kit's own pictures of it are in `packages/sdk/assets/mark/` (`mark.svg`, `mark-tile.svg`, and the tile at 180, 192 and 512, and 512 maskable), made by `sh scripts/heavy.sh npx tsx scripts/make-mark.mjs`; `--accent '#rrggbb' --out <dir>` makes a set in another colour. Each reference site's page has the mark as its icon, in its own accent, and the tile for a phone's home screen.

- **The summons.** At every level, and whatever the world has done with the
  keys, the visitor can bring the controls up with the one gesture that is
  theirs in every world ([NSWP-11](../protocol/11-the-visitors-console.md)):
  the key left of 1 at a desk, two fingers held still on a touch screen, B
  or Y held in a headset. `mountHud` listens for the first two before your
  page hears anything, so you can't take them by accident; give
  `createXrInput` an `onSummon: () => xrConsole.setOpen(true)` for the
  third. Never bind any of them to something of your own.
- **Coming and going.** The sheet is drawn over everything while it is up.
  `controls.onSignal` says `menuOpen` and `menuClose`: pause, or stop reading
  keys, in between. When it goes, whatever had the keys has them back, and
  at `"hidden"` nothing at all is left on screen.

- **Where it sits.** `controls.setCorner("bottom-right")` moves the quiet mark.
  `hud.bounds()` returns the rectangle of every visible part, to lay your own
  interface out around; `hud.cover()` says how much of each edge the full HUD
  takes: `{ top, bottom, left, right }`, in pixels. **Both answer the same
  whoever draws the menu.** Where a client above your world has the menu, the
  kept menu (`keepMenu`) answers them from what the client says it covers of
  your view (`covers`, NSWP-02), so a world's code is one code. `cover()`
  leaves the sheet out, since it comes and goes and a view moved clear of the
  menu shouldn't move each time; the sheet is in `bounds()` while it is up.
  Neither tells you when it changes: read them as you lay out. In a headset
  session nothing is covered.
- **Keys.** `controls.setKeys({ menu: "p" })` moves the menu key,
  `{ menu: null }` removes it, `{ hotbar: false }` frees 1 to 6.
  `controls.claimInput(true)` takes every key for the world until you give
  them back. Escape still closes a sheet the kit has opened, and the mark can
  still be clicked.
- **The visitor's things, wherever you like.** You needn't choose between
  the kit's menu and none: put the way home on your pause screen, their
  volumes in your settings, a button that brings the whole console up on a
  wall. `controls.run("home")`, `controls.run("sound-music")`,
  `hud.setOpen(true)`. Each is the same thing the console has, with the
  visitor's own settings and home
  ([NSWP-11](../protocol/11-the-visitors-console.md), "Drawing it
  yourself", has the names).
- **Your own menu instead.** Use the list without either renderer: don't call
  `mountHud` or `createConsole`, read `controls.view()` for the sections and
  their buttons, call `controls.run(id)` when one is pressed, and
  `controls.subscribe()` to hear of changes. `addViewControls` and
  `addRoomControls` still fill the list for you.
- **Hiding it.** A world that hides the kit needn't put the visitor's things
  in menus of its own, since they can summon it. A good pause menu still
  offers the way home. The one case where the duty stands is a headset with
  tracked hands and no controllers, which has no summons for a hidden
  console yet: there, offer the way home, leaving VR, the room and the
  microphone, and turning and stepping somewhere of your own.
- **Settings that travel.** A visitor's volumes, the size of their text,
  whether things move, their hands in a headset, whether their screen was
  filled and the tabs they keep on their bar go with them from world to world
  ([NSWP-11](../protocol/11-the-visitors-console.md)). The kit does all of
  it: `arrival.read()` takes them in, each part begins from them, and
  `portal.go()` and `portal.home()` send on what the visitor has now. A
  screen that was filled is filled again at their first key or press. If
  you keep a setting of your own that should begin from theirs, read
  `arrivedSettings()`; to send one on, `reportSettings(name, () => ({...}))`.
- **The form a visitor arrives in.** `startingForm()` is `"touch"` or
  `"desk"`: how they were in the place they came from, where this device
  can do the same, and otherwise what the device is. Lay your own interface
  out by it. The kit carries it on through a door for you.

## The look

Seven values in `ui/theme.ts`: the accent, the ink, the glass, the warning
colour, whether things move, the size, and which wrist carries the console.
Three sources, weakest first:

1. The kit's defaults.
2. What the world asks for: `createControls({ theme })`. The template passes
   the home's accent, so the console takes the colour of the place.
3. What the visitor chose, in the Display section every world gets. It is
   kept in that browser, for that site.

The visitor wins, because the controls are theirs to read. Someone whose
device asks for less motion gets less without choosing it.

The one shape is the arch, from this project's doors: hotbar keys, colour
swatches, the mark beside a world's name, the Menu button in a headset.

## Updating it across worlds

There is one source, in `packages/sdk/src/`. There is not one live copy: every
world is its own site with its own bundled copy, so a world gets an update
when it takes the new SDK and rebuilds.

| Site | To update |
|---|---|
| Reference worlds, the Starter Home, The Foundry, BitPortal | All ten together, from here: `npm run release:all -- --go` (below), once BitPortal and the template carry this kit (`npm run vendor` in each) |
| A world from the template | `npm run update && npm run build` in a copy of the template (`npm run vendor` in the template's own repository beside this one), then upload `dist/` |

Loading the kit live from one address into every world would mean one site's
code running inside all of them, able to read how each visitor arrived. The
template's checker refuses exactly that.

So what keeps them together is knowing when they aren't. Every world says
the kit it was built with, in its manifest (`"kit"`), and BitPortal says its
own in `/version.json`. One command sets them side by side:

```
npm run kits              # the public sites
npm run kits -- --local   # the copies on the development server
```

It lists each site with its kit, marks any that differ from this repo's, and
exits 1 if any do. A portal on a newer kit than the worlds it sends people to
is the case to avoid, so they are deployed in one sitting, by one command:

```
npm run release:all            # a look: what is public, what would change, what stands in the way
npm run release:all -- --go    # all ten sites: the worlds, the Starter Home, The Foundry, then BitPortal
```

It starts only when this repo, BitPortal and the world template are each on
main, clean, the same as GitHub, and carrying this repo's kit; when Godot is
here to export The Foundry; when Vercel has room for ten deployments; and,
with `--go`, after every test and build
has passed. Then it deploys the worlds first and BitPortal last, and checks
what came up. If it stops part way it says which sites were deployed.
Deploying is the owner's to approve each time: `--go` is run on their word.

### The latest, in a page that is already open

`addViewControls` adds one more control, which shows only when it has
something to say: **This place has been updated. Reload for the latest**, on
the bar and under Help. The page asks its own site, now and then and
whenever the visitor comes back to it, whether the page or its script has
changed since it was loaded (`watchFresh`: a HEAD request for each, compared
by the mark the host puts on a file). A visitor who comes back to the tab
with nothing in hand is given the latest at once, and the plumbing puts them
back where they stood. Someone in a room, in a headset or writing is told
and left to choose.

```js
import { freshAction, watchFresh } from "nswp-sdk/three";

controls.add(freshAction(controls, { busy: () => inTheMiddleOfMyGame() }));   // addViewControls does this already
const fresh = watchFresh({ onStale: () => showMyOwnNotice() });                // or watch it yourself
```

It needs your host to put an `ETag` or `Last-Modified` on what it serves,
which nearly all do. And it is the second half of a rule whose first half is
your host's: serve your page and scripts with `Cache-Control: no-cache`
([NSWP-09](../protocol/09-what-a-world-owes.md)).

## Not built

- **A look that follows the visitor from world to world.** Today each site
  remembers its own. Carrying it across means sending a preference to every
  world visited, which is one more thing to tell visitors apart by. It needs a
  decision first (spec Q32).
- **Controls that aren't buttons:** a compass of where the doors are, a
  slider, a map. The `kind` mechanism is where they go.
- **A layout a visitor can rearrange.**
- **Things two people can hand each other.** One thing held is seen by the
  rest of a room ([NSWP-17](../protocol/17-items.md)); it does nothing yet.
- **A hand drawn as a hand.** Tracked hands are shown as their joints.
- **Controllers drawn as the ones in the visitor's hands.** That needs each
  make's model served from the world's own site.
- **Any test on a real headset.** Sticks, grips, hands and the buzz have been
  driven only in an emulated Quest 3. The wrist gesture is tuned by guesswork: it
  opens when the chosen hand is held within about half a metre of the face,
  near the middle of the view, for a third of a second.

## It is the world's console

Every world draws its own copy. A world can change it, or draw something that
only looks like it. So it is never a trusted surface, and nothing security
depends on it: a visitor's sure way out of any world is their headset's or
browser's own controls (spec §3.2, §21.2).

## Sound

```js
import { createSounds, addSoundControls } from "nswp-sdk/three";

const sounds = createSounds({
  context: THREE.AudioContext.getContext(),
  seed: "The Grove",                       // what the place's own music is made from
  theme: { cues: { step: "sounds/step.ogg", hover: null }, music: "sounds/loop.ogg" },
});
addSoundControls(controls, sounds);        // the Sound part of the menu, and the controls made audible
sounds.play("cross");                      // a cue, by name
// each frame, with how far the visitor was moved (not how their head swayed):
sounds.moved(metres);
```

- **Cues** are a closed list (`CUES`): `step`, `land`, `bump`, `grab`, `drop`,
  `hover`, `press`, `menuOpen`, `menuClose`, `cross`, `arrive`, `join`,
  `leave`, `micOn`, `micOff`, `notice`, `chat`, `error`. Each has a default
  made in the browser. `play(cue, { distance, pan })` plays one from where
  somebody stands: `chat` is, when someone writes.
- **The kit's own files.** Serve `packages/sdk/sounds/` from your site and
  pass its address: `createSounds({ kit: "/sounds/kit/" })`. The defaults are
  then recorded: seventeen cues, a room's hum, a piece of music. Without it,
  or where a file can't be played, the defaults are made in the browser.
- **A theme** names a file on the world's own site for any cue, or `null` for
  silence; a list of files is chosen among each time. `music` is a file, a
  list to play in turn, or `null` for none. `hum` is a file or `null`. What a
  theme leaves out keeps the default.
- **Limits.** A cue file is at most 512 KB and three seconds, and is brought
  down to the loudness of the defaults. Everything passes one limiter.
- **Footsteps** are quieter than any other cue (under half as loud), and no
  two are alike: each is a little higher or lower, lighter or heavier, softer
  or brighter than the last, and a touch to the side of the foot that made
  it. This is done as each is played (`stepShape`), to the kit's step and to
  a world's own alike, so one step file is enough. None is heard in the air.
- **What is playing.** The Sound section names the piece of the place's
  music that is playing now, by its file's name ("Playing here: room-e. Next
  of 8"), so a visitor can say which one they mean. Pressing it goes on to
  the next. `sounds.piece` and `sounds.nextPiece()` are the same from code.
  Give your music files names worth reading.
- **The visitor's volumes** (effects, music, voices, all off) are in the menu
  and are kept for the site. Wire voices with
  `sounds.onChange((l) => presence.setVolume(l.off ? 0 : l.voices))`.
- **Their own music** is added from their device in the same menu, kept in
  the browser, and heard by nobody else.
- **Anything the controls signal** that is a cue's name is played:
  `controls.signal("join")`. A press and the menu are signalled already.
- **Music shared with people nearby** comes with the room's controls when they
  are given the sounds: `addRoomControls(controls, presence, { sounds })`. A
  visitor offers what their jukebox is playing, and others hear it only if
  they turned that on, by distance. `sharedMusic: false` leaves it out.

## Casual and intense: the two ways of moving

```js
import { createFps } from "nswp-sdk/three";

const fps = createFps({
  dom: renderer.domElement, camera, rig, controls, hud,
  canStand: (x, z) => insideMyWorld(x, z),
  presenting: () => renderer.xr.isPresenting,
  onUse: () => useWhatTheMiddleOfTheViewPointsAt(),
  arrived: context?.moving === "intense" && !context.immersive,   // their own client says so, for a desk
});
// each frame, in place of your own keys:      if (!fps.update(dt)) walkWithKeys(dt);
// in your own click and drag handlers:        if (fps.enabled) return;
// when sending the visitor on:                portal.go(dest, { moving: (presenting ? input.intense : fps.enabled) ? "intense" : "casual" })
```

- The menu, under Moving, has "Desk controls: casual / intense" (this) and
  "Headset controls: casual / intense" (`createXrInput`, which takes
  `arrivedIntense` the same way). Each is kept for the site, by itself.
- The mouse looks, at once: a visitor who arrives moving the intense way is
  moving that way before they have pressed anything. A browser hands a page
  the pointer only after a press, so until then the kit turns the view from
  the mouse's own movement over the canvas, with the pointer's picture
  hidden, and takes the pointer at the first key or click. Leave the
  canvas's `cursor` alone while `fps.enabled`. W A S D and the arrows
  walk, Shift runs, F or a click uses, Escape brings up the menu.
- While they are on, aim from the middle of the view: set your pointer to
  (0, 0) when `fps.update` returns true.
- `addViewControls` adds Fullscreen to the menu.

### Marks on the floor, and the reach of a door

Moving the casual way on a flat screen, a visitor is shown where a press
would take them before they press, and the way there once they have:

```js
import { createFloorMarks, DOOR_REACH } from "nswp-sdk/three";

const marks = createFloorMarks(accent);
scene.add(marks.group);
// each frame, on a flat screen, moving the casual way:
marks.update({ hover: stroll.reach(spot.x, spot.z), from: [head.x, head.z], path: stroll.path, t });
// in a headset, or moving the intense way:
marks.update({ hover: null, from: [head.x, head.z], path: null, t });
```

A press on the floor is `stroll.tap(x, z)`, with the spot pressed, however
far off it is. And each frame of a walk, the view turns to face the way they
are going, unless they are turning it themselves:

```js
stroll.update(dt);
if (stroll.going && !dragging) rig.rotation.y = stroll.face(rig.rotation.y, dt);
```

- **A ring** under the pointer, on the spot a press would walk them to. It
  is never further off than one press reaches (`TAP_REACH`, six metres), so
  it also shows how far that is. A finger has nothing to hover with, so on a
  touch screen there is no ring.
- **A dot** where they are headed, once they have pressed, and **a dotted
  line** from their feet to it.
- **A path, pressed out as they walk.** A press while they are walking adds
  a stretch to the way they are going, from where the last press ended, as
  far as one press reaches from there. The line is drawn through every spot
  with a small ring at each turn, and they walk it in order at the same
  pace. Twelve stretches may be waiting (`PATH_MOST`). Something in the way
  ends the whole of it.
- **They face the way they walk.** The view turns to look along the stretch
  being walked, no faster than `FACE_RATE` (a little under half a turn a
  second), and settles there. So a press ahead is a press where they are
  looking. It never turns anyone in a headset, and it waits while they drag
  the view themselves.
- **Two presses close together are a run straight to that spot,** with the
  rest of the path forgotten. That is how to change one's mind. A key
  pressed to walk does the same as before: the keys take over.
- **Only they see them.** Nothing about them is sent to anyone else.
- **A door is chosen from within `DOOR_REACH`** of it, ten feet, and no
  further. Nearer than that it lights when pointed at, and a press goes
  through. From further off it is not lit, and a press on it is a few steps
  towards it, so nobody crosses to another world by a stray click on a door
  at the far end of the room. The menu still lists every door, for someone
  who means to go from where they stand.
- **Moving the intense way, a doorway is walked into.** F and a click use
  panels and buttons, never a door.

### Running and jumping, however they move

A visitor can run and jump in every way of moving, and it is the same run
(`RUN`, 1.75 times a walk) and the same jump (`JUMP_HEIGHT`, 0.45 m) in all
of them.

| Moving | Run | Jump |
|---|---|---|
| Casual, at a desk | Shift with the keys, or two clicks on the floor | Space |
| Intense, at a desk | Shift | Space |
| A touch screen | Two taps on the floor | The Jump control, with the ones always at hand |
| Intense, in a headset | Press the moving stick in; it lasts until the stick is let go | A or X |
| Casual, in a headset | Nothing to speed up: they move a step at a time, at the pace of a run | A or X |

### Nobody outruns a run

`TOP_SPEED` is the fastest anyone goes on foot: a run, 4.2 m a second. Every
way of moving the kit gives keeps to it, so nobody in a room has an edge
from what they hold or wear ([NSWP-06](../protocol/06-rooms.md), "What a
client owes the people in a room"). Two things in your own boot code keep it
true:

- **A press on the floor is always a walk on a flat screen:**
  `stroll.tap(x, z)`, on a phone as at a desk, whether Motion is on or off.
  (`stroll.to` is for a walk the page starts itself, up to a door, say.)
  Never move a visitor there at once outside a headset. A phone that
  asks for less motion used to get an instant step of up to six metres for
  every tap, and tapping fast was many times a run.
- **A step in a headset is paced:**

```js
const pace = createStepPace();
// a step is asked for, by a press on the floor or a stick let go:
if (renderer.xr.isPresenting) {
  if (!pace.take(distance)) return;   // too soon: the last step is still being paid for
  moveTowards(spot.x, spot.z);
}
// each frame: dim the ring on the floor while a press would do nothing
reticle.material.opacity = pace.ready ? 0.8 : 0.22;
// and give it to the kit's input layer, so a step backwards with a stick is paced too
createXrInput({ ..., pace });
```

A short step is ready again almost at once; the longest waits a little over
a second. It is your visitors' own pages that keep to this, so it is a
courtesy every honest world extends, not a guard against someone who has
changed their own page.

```js
import { addJump, RUN } from "nswp-sdk/three";

const jump = addJump(controls, { presenting: () => renderer.xr.isPresenting, sounds, hud });
createXrInput({ ..., onJump: () => jump.jump() });
// each frame:
rig.position.y = floorY + jump.update(dt);
if (!jump.airborne) sounds.moved(metresWalked);
// in your own key walking:  pace = WALK_SPEED * (shiftHeld ? RUN : 1)
```

- `createStroll` runs by itself: `stroll.tap(x, z)` twice within
  `DOUBLE_TAP` milliseconds is a run, and each tap after, while they are
  still running, adds to the path at a run. `stroll.to(x, z, true)`, for a
  walk the page starts itself, runs at once.
- A jump changes nothing about where a visitor may stand. They come down
  where the floor is.
- Space stands down while the menu is open, while the visitor is typing, and
  while a world has claimed the keys (`controls.claimInput`).

## Signs

A sign is a size in a visitor's view, not in the world.

A door's sign says where it leads, and what kind of place that is when the
door was told: `createPortalGate(destination, { label: "The Arcade",
category: "game" })` reads "The Arcade" over "A game at example.com". The
category is the destination's own word, from its announcement
([NSWP-01](../protocol/01-worlds.md), "What kind of place it is"): copy it
when you place the door, as you copy its picture.

- **On a flat screen,** say what is pointed at beside the controls:
  `controls.setTarget("The Tour, at tour.example", ["Five stops that teach
  looking and moving.", "Click to visit"])`. It is a small card, always the
  same size, and never in front of the thing.
- **In the world,** keep a sign the same size in the view, every frame:
  `sign.scale.copy(natural).multiplyScalar(viewScale(distance, { at: 6 }))`,
  where `at` is the distance it was made to be read from. It stops shrinking
  and growing at `least` and `most`.
