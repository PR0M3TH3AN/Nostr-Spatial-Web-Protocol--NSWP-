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
import { addRoomControls, addViewControls, createConsole } from "nswp-sdk/three";

const controls = createControls({ title: "My world", address: "example.org", theme: { accent: "#62d9ff" } });
const hud = mountHud(controls);
const xrConsole = createConsole(controls, { renderer, rig });
scene.add(xrConsole.group);

controls.add({ id: "home", section: "travel", icon: "home", label: "Back to your lobby", short: "Home", hotbar: true, act: () => portal.home() });
await addViewControls(controls, { renderer, rig, camera, hud }); // Enter VR, Turn around
addRoomControls(controls, presence);                             // Join, microphone, invite

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
| An icon | One line of SVG path data in `packages/sdk/src/ui/icons.ts`. Both renderers draw from it |
| A new kind of control | A `kind` in `ui/model.ts`, and one drawing function for it in `ui/hud.ts` and in `console.ts`. `"swatch"`, a choice of colour, is the worked example |

## The look

Seven values in `ui/theme.ts`: the accent, the ink, the glass, the warning
colour, whether things move, the size, and which wrist carries the console.
Three sources, weakest first:

1. The kit's defaults.
2. What the world asks for: `createControls({ theme })`. The template passes
   the home's accent, so the console takes the colour of the place.
3. What the visitor chose, in the Look section every world gets. It is kept in
   that browser, for that site.

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
| Reference worlds | `npm run build && npm run deploy:sites` here |
| BitPortal | `npm run vendor && npm run build && npm run deploy` there |
| A world from the template | `npm run vendor && npm run build`, then upload `dist/` |

Loading the kit live from one address into every world would mean one site's
code running inside all of them, able to read how each visitor arrived. The
template's checker refuses exactly that.

## Not built

- **A look that follows the visitor from world to world.** Today each site
  remembers its own. Carrying it across means sending a preference to every
  world visited, which is one more thing to tell visitors apart by. It needs a
  decision first (spec Q32).
- **Controls that aren't buttons:** a compass of where the doors are, a
  slider, a map. The `kind` mechanism is where they go.
- **A layout a visitor can rearrange.**
- **Any test on a real headset.** The wrist gesture is tuned by guesswork: it
  opens when the chosen hand is held within about half a metre of the face,
  near the middle of the view, for a third of a second.

## It is the world's console

Every world draws its own copy. A world can change it, or draw something that
only looks like it. So it is never a trusted surface, and nothing security
depends on it: a visitor's sure way out of any world is their headset's or
browser's own controls (spec §3.2, §21.2).
