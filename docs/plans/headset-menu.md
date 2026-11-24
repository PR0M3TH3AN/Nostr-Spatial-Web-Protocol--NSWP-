# In a headset, the flat screen's menu: a design, with pictures

**State:** a design for the owner to look at, 2026-11-24. **No code, and none
until the owner has seen the pictures.** The ask is in
`docs/backlog/headset-menu-like-the-flat-one.md`, in the owner's words: the
exact same menu as on a flat screen, larger, floating in front, the bar
below it tilted a little to the player, and whatever is pointed at coming
forward.

**The pictures are mocks.** Each is the flat menu's own picture hung in the
Gallery's own scene, in a made-up headset, at the sizes proposed here.
Nothing on them can be pressed. They show where things are, how big, and how
the design reads. They don't show how it feels in a headset: that is the
owner's Quest 3S, at the end of this page.

## The pictures

In the sessions' notes folder, `headset-menu/`, numbered in the order to
look at them.

| Picture | What it is |
|---|---|
| `1-flat-menu-at-a-desk.png` | The flat menu today, on Sound, at a desk's width. What the headset is to match |
| `2-headset-today.png` | A headset today: the kit's console, on the same tab. Sections down the side, no tab strip, no bar |
| `3-proposed-a-1m20-wide.png` | **Proposed.** The same sheet, 1.2 m wide, a little over a metre away. The bar under it, leaning back. "Effects: medium" is pointed at, and has come forward |
| `3-proposed-a-from-the-side.png` | The same from a step to the left: the bar's lean |
| `3-proposed-a-the-you-tab.png` | The same on You |
| `4-proposed-b-1m00-wide.png` | The same sheet at 1.0 m wide: less to turn the head for, smaller words. The key on the bar is pointed at |
| `5-proposed-c-one-column-0m80-wide.png` | The flat menu's narrow layout, as a phone has it: one column, 0.8 m wide, and tall |
| `…-as-sharp-as-a-quest.png` | The middle of pictures 2 to 5 at about 20 pixels to a degree, which is what a Quest 3S shows. **Judge the size of words from these,** not from the others, which are three times coarser than the headset |
| `6-flat-menu-made-into-a-picture.png` | The flat menu's own elements, turned into a picture by the browser (below). Beside it, `6-flat-menu-as-the-browser-shows-it.png` |

## What is proposed

### Closed

**Nothing changes.** The floating Menu button stays as it is, and so does
the summons from a controller.

### Open

- **The flat menu's sheet, as it is at a desk:** the tab strip, the rows in
  two columns, cards and tiles, the foot with its pin and Close. The
  visitor's own order of tabs and their pins. Picture 3.
- **1.2 m wide, 1.05 m away,** where today's console opens. Its middle is a
  little below the eyes. It takes up 60 degrees across and 32 down.
- **The bar floats under it,** 5 cm below, leaning back 28 degrees so that
  it faces the eyes. Everything pinned is on it, as on a flat screen.
- **It stays where it opened,** as today's does, so it can be aimed at; it
  closes when the visitor has walked 2.6 m from it, as today's does.
- **The glass is darker than on a flat screen.** There a sheet blurs what is
  behind it. In a headset that would be drawn for both eyes each frame, so
  the sheet is dark glass that nothing shows through sharply.

**How big the words are.** A row's words are 20 mm tall at 1.05 m: just over
one degree, about 22 of a Quest 3S's pixels. Today's console has its row
words at 1.4 degrees and its small words at 1.0. So the proposed menu's
words are the size of today's small words, and there is more on it. **The
visitor's own text size (Display) makes them larger,** as on a flat screen.

| | Across | Down | A row's words |
|---|---|---|---|
| Today's console | 44° | 28° | 1.4° |
| **A: two columns, 1.2 m** | 60° | 32°, 41° with the bar | 1.1° |
| B: two columns, 1.0 m | 51° | 27° | 0.9° |
| C: one column, 0.8 m | 42° | 52° | 1.2° |

**I'd build A.** B's words are smaller than anything on today's console. C
is taller than is comfortable to look up and down, and is not what a desk
shows. The headset decides between A and B: the owner looks at both.

### Pointed at

- **The thing under the pointer comes forward 3.5 cm** and is lit round its
  edge: a row, a tab, a key on the bar. In 120 ms, eased.
- **It doesn't flicker when the ray shakes.** A thing that has come forward
  stays forward until the ray is a centimetre clear of it.
- **For someone who turned movement down** (`motion: reduced`) nothing
  moves: it is lit, as today.

### On the wrist

**The wrist stays, as a second way in.** It shows the flat menu's narrow
layout, the one a phone has, as wide as today's wrist console is, with its
rows scrolled where a tab is long. The same tabs and rows. No bar: there is
no room for one above a wrist, and the tabs are all there.

### What a headset can't show, and says so

- **Wallet and Files** say to take the headset off, as buying does (the
  client's-menu plan, section 8). Their tabs are there; their pages are not.
- **A row to type in** brings up the headset's own keyboard, as today.

### Hands with no controllers

A pinch is a press, as today. What is pointed at is where the hand's ray
meets the menu, and it comes forward the same.

## One menu, drawn twice: how the two are kept the same

**Proposed: it is not drawn twice. The headset shows the flat menu itself.**

A headset can't show a page's own elements. But a browser can turn them into
a picture, and a picture can be hung in the scene. **Tried** (in Chrome, on
the Gallery, under that world's own content rules): the flat menu's elements
and its styles, written out and drawn to a canvas.

- **It is the flat menu:** picture 6 beside its neighbour. The marks, the
  tab strip, every row, the foot and the bar, each in the same place.
- **13 ms the first time, 2 ms after,** at twice the menu's size.
- **A page may read it and hand it to the graphics card,** which a headset
  needs. Nothing is fetched to make it.

So:

- **The flat menu is kept in the page during a headset session,** out of
  sight, laid out at the width proposed above. Whenever it changes, its
  picture is made again.
- **Where each thing is, is asked of the elements themselves.** A ray that
  meets the picture at a place points at the element whose box is there.
- **A press from a ray is a press on that element:** the same code a mouse
  runs. Nothing a row does is written a second time.
- **A new kind of row reaches the headset the day it reaches the flat
  menu,** with no work, because there is one menu.
- **What comes forward** is a piece of the same picture, moved forward. The
  picture is not made again for it.

**What that way loses, each to be mended in the build:**

| What | Why | The mend |
|---|---|---|
| Where a list or the tab strip is scrolled to | A picture is made of the elements, not of how they are scrolled (picture 6 shows the strip from its start) | Shift each scrolled part by its own scroll before the picture is made |
| Where a bar stands along its length | The same: its place is not in the elements | Written in as the picture is made |
| People's pictures, and tiles drawn on a canvas | Nothing may be fetched from inside the picture, and a canvas is not an element with words | Put in as they are already held: the kit has each as pixels |
| The blur behind the glass | Nothing is behind it in a picture | Darker glass, above |
| A sheet sliding up | A picture is of one moment | It unfolds in the scene, as today's console does |

**What is not known, and is the first thing to try: the Quest's own
browser.** It is built on the same engine as Chrome, so it should do the
same. It is one page and five minutes on the owner's headset, before
anything else is built.

**Where a browser won't make the picture, today's console stays.** Safari,
as far as I know and not tried here, refuses to let a page read such a
picture, so a headset that runs it gets the console as it is now. That is
found out once, as a session starts. So today's console is not thrown away;
it stops being the first choice.

**The other way, not proposed:** drawing the flat layout a second time on a
canvas, by hand, as today's console is drawn. It works in every browser. It
is two drawings to keep the same for ever, which is how the two came to
differ.

## Another engine

**A world made with another engine is handed the same picture,** as it is
handed today's console (`NSWP.consolePixels`), with where each thing is
beside it. The engine script keeps the flat menu in the page for it. The
picture is larger than today's (1560 by about 800, against 1024 by 640), so
bringing it across costs more than was measured for the Godot example
(`docs/plans/godot-headset-controls.md`); it is brought across only when it
changes. To be measured with the build.

## With the client's menu

In a headset only the world's page can draw. So the world's part draws this,
from the same code and the visitor's own settings (the client's-menu plan,
section 8). It is one design whether the menu on a flat screen is the
world's own or the client's.

## The build, in order, when the owner has said yes

1. **A page for the owner's Quest:** does its browser make the picture. One
   line back: yes or no.
2. **The picture in the scene,** behind an address flag, in the Gallery:
   the sheet and the bar, pointing and pressing. Today's console stays the
   default.
3. **What the picture loses** (the table above), each with a check.
4. **Coming forward,** and still for `motion: reduced`.
5. **The wrist,** and hands with no controllers.
6. **The engine script and the Godot add-on.**
7. **The default,** once the owner has used it in the headset.

Each is a pull request. Names for anything new are proposed with each.

## Done looks like

- Pictures from the made-up headset beside the flat menu, for the owner,
  before each merge that changes what is seen.
- **The owner's Quest 3S:** open; read a row without leaning in; change tab;
  press a row; press a pinned thing on the bar; see each come forward under
  the pointer; scroll a long tab; close. The same on the wrist.
- A check, in the made-up headset, that every tab and every row the flat
  menu has is in the headset's, in the same order, and nothing else.

## Must not

- Lose the floating Menu button, or the summons from a controller.
- Put anything in the headset's menu that the flat one doesn't have, or the
  other way round. With one menu this holds by how it is made.

## Not checked

- **Any headset.** Every picture here is from a made-up one, with one eye
  and no lenses. Size, distance, the bar's lean and how far a thing comes
  forward are proposals to be looked at in the Quest.
- **The Quest's browser making the picture.** Chrome on a laptop does.
- A tab with people's pictures or tiles in it: the Gallery's menu, as a
  guest alone in the room, has none.
- How long the picture takes to make on a headset's own processor.

## For the owner

1. **A, B or C** (pictures 3, 4 and 5, and their sharp ones)? I'd build A.
2. **Is the headset showing the flat menu itself, as a picture, the right
   way to keep the two the same?** It needs five minutes on your Quest
   first.
3. **The wrist:** the narrow layout there, with no bar. Yes?
