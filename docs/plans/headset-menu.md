# In a headset, the flat screen's menu: a design, with pictures

**State:** a design, 2026-11-24. **The owner has seen the pictures and
answered the same day: it is B, the sheet 1.0 m wide; the menu is never
drawn over the hands** (his words are below, under "Hands are never under
the menu"); **and the wrist has the narrow layout with no bar** ("On the
wrist", below). **One thing is still open,** at the end of this page:
whether the headset shows the flat menu itself as a picture, which waits on
his five minutes with the Quest. **No code on that until he has.** The ask is in
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
| `3-proposed-a-1m20-wide.png` | Proposed, and not chosen. The same sheet, 1.2 m wide, a little over a metre away. The bar under it, leaning back. "Effects: medium" is pointed at, and has come forward |
| `3-proposed-a-from-the-side.png` | The same from a step to the left: the bar's lean |
| `3-proposed-a-the-you-tab.png` | The same on You |
| `4-proposed-b-1m00-wide.png` | **Chosen by the owner.** The same sheet at 1.0 m wide: less to turn the head for, smaller words. The key on the bar is pointed at |
| `5-proposed-c-one-column-0m80-wide.png` | The flat menu's narrow layout, as a phone has it: one column, 0.8 m wide, and tall |
| `…-as-sharp-as-a-quest.png` | The middle of pictures 2 to 5 at about 20 pixels to a degree, which is what a Quest 3S shows. **Judge the size of words from these,** not from the others, which are three times coarser than the headset |
| `6-flat-menu-made-into-a-picture.png` | The flat menu's own elements, turned into a picture by the browser (below). Beside it, `6-flat-menu-as-the-browser-shows-it.png` |

**The pictures are wrong in one thing.** In pictures 3 to 5 the edges of the
sheet are drawn over the rings of both controllers. That is what the owner
has said must not be: "Hands are never under the menu", below.

## What is proposed

### Closed

**Nothing changes.** The floating Menu button stays as it is, and so does
the summons from a controller.

### Open

- **The flat menu's sheet, as it is at a desk:** the tab strip, the rows in
  two columns, cards and tiles, the foot with its pin and Close. The
  visitor's own order of tabs and their pins. Picture 4.
- **1.0 m wide, 1.05 m away,** where today's console opens. Its middle is a
  little below the eyes. It takes up 51 degrees across and 27 down. **The
  owner's choice, 2026-11-24: "B I think."**
- **The bar floats under it,** 5 cm below, leaning back 28 degrees so that
  it faces the eyes. Everything pinned is on it, as on a flat screen.
- **It stays where it opened,** as today's does, so it can be aimed at; it
  closes when the visitor has walked 2.6 m from it, as today's does.
- **The glass is darker than on a flat screen.** There a sheet blurs what is
  behind it. In a headset that would be drawn for both eyes each frame, so
  the sheet is dark glass that nothing shows through sharply.

**How big the words are.** A row's words are 17 mm tall at 1.05 m: nine
tenths of a degree, about 18 of a Quest 3S's pixels. Today's console has its
row words at 1.4 degrees and its small words at 1.0. So the menu's words are
a little smaller than today's small words, and there is more on it. **The
visitor's own text size (Display) makes them larger,** as on a flat screen.
Reading a row without leaning in is the first thing for the owner's Quest to
say (Done looks like).

| | Across | Down | A row's words |
|---|---|---|---|
| Today's console | 44° | 28° | 1.4° |
| A: two columns, 1.2 m | 60° | 32°, 41° with the bar | 1.1° |
| **B: two columns, 1.0 m. Chosen** | 51° | 27°, about 35° with the bar (worked out, not measured) | 0.9° |
| C: one column, 0.8 m | 42° | 52° | 1.2° |

**It is B.** I had proposed A, since B's words are smaller than anything on
today's console; the owner looked at pictures 3, 4 and 5 and their sharp
ones and chose B. C is taller than is comfortable to look up and down, and
is not what a desk shows.

### Hands are never under the menu

**The owner, 2026-11-24:** "B I think. But we need to make sure that the
menu is not drawn above the hands in VR."

**How that is read** (the orchestrator's reading, and mine is the same): a
visitor's hands and controllers are always seen in front of the menu. Never
hidden by the sheet, the bar, the wrist's panel or the Menu button, wherever
the hands are held.

**Mended for today's console, 2026-11-24** (`drawnLast`, input.ts, and the
same in the Godot add-on; `trials/hands-over-menu.mjs`): hands are drawn
after the console and the Menu button, and over them. The owner, told of the
fault: "ok lets draw the hands last". What follows is what was true before
it, and is live in 0.87.0.

**What was true, by how the console is made** (`console.ts`; not looked
at in a headset by me): the panel and the Menu button are drawn last and
over everything, with no regard to what is nearer. I take that to have been
so that a wall couldn't hide the menu. It also means **today's console is
drawn over the hands, wherever they are held.** The mocks were made the same
way, which is
why the sheet's edges cover the controllers in pictures 3 to 5. So the rule
is broken by today's console too, and not only by this design.

**The rule, for the build:**

- **Hands, controllers and tracked hands' joints are drawn after the menu,
  and over it.** The menu is still drawn over the room, so a wall still
  can't hide it. Nothing of the menu is ever drawn over a hand: the sheet,
  the bar, a thing that has come forward, the wrist's panel, the Menu
  button.
- **That holds wherever the hand is,** nearer than the menu or reached past
  it. A hand reached past the sheet is still seen whole.
- **No ray is drawn from a hand today:** what is pointed at is lit on the
  menu itself. If a ray is ever drawn, it is drawn over the menu as the
  hand is.
- **Where the menu is put helps, and is not relied on.** At 1.05 m the sheet
  and the bar are beyond an arm's reach, so a hand held up to point is
  nearer than they are. The wrist's panel sits above the wrist that carries
  it and not over that hand.
- **The same for a world made with another engine:** the add-on draws its
  hands over the console's picture.

**Whether the sheet should also be moved** (lower, higher or further, so that
hands held at rest don't overlap it in view at all) is for the headset to
say, and is asked of the owner there. Worked out and not measured: hands
held at rest are below the bar's lower edge in view; hands raised to point
are in front of the sheet, which is where they must be to point at it.

### Pointed at

- **The thing under the pointer comes forward 3.5 cm** and is lit round its
  edge: a row, a tab, a key on the bar. In 120 ms, eased.
- **It doesn't flicker when the ray shakes.** A thing that has come forward
  stays forward until the ray is a centimetre clear of it.
- **For someone who turned movement down** (`motion: reduced`) nothing
  moves: it is lit, as today.

### On the wrist

**The owner, 2026-11-24:** "Yes, narrow layout on the wrist with no bar."

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
   line back: yes or no. **Built, 2026-11-24, on the owner's "Go for
   quest".** Two files in `trials/pages/quest-picture/`, since the Gallery's
   rules refuse a script written into a page; answered by the local service
   at `/trial-pages/quest-picture/` under the Gallery's local copy only,
   with the Gallery's own headers, never from a `dist/`; and a test in the
   gate that no site's build carries a trial's page. In Chrome on the
   laptop, as served: "Yes.", 32 ms the first time and 1 ms after. **Not yet
   opened in the Quest:** "The five minutes on the Quest", below.
2. **The picture in the scene,** behind an address flag, in the Gallery:
   the sheet and the bar, pointing and pressing. Today's console stays the
   default. **Hands drawn over the menu come with this step, and their
   check with them:** nothing of the new menu is shown, even behind a flag,
   that covers a hand.
3. **What the picture loses** (the table above), each with a check.
4. **Coming forward,** and still for `motion: reduced`.
5. **The wrist,** and hands with no controllers.
6. **The engine script and the Godot add-on.**
7. **The default,** once the owner has used it in the headset.

Each is a pull request. Names for anything new are proposed with each.

## The five minutes on the Quest

For the owner, with the headset on and the local service running.

1. **Open the Quest's browser and go to the address the service prints** on
   the line "a trial's page", under the Gallery's. It is
   `https://`, this machine's address on the network, `:4301/trial-pages/quest-picture/`.
2. **The first time, the browser warns about the certificate.** Before
   accepting, check the fingerprint it shows is the one the service prints.
   That is you trusting your own computer, and nothing else.
3. **Read out what the page says.** It answers in a second or two.

| It says | What that means |
|---|---|
| **"Yes."** in green, with two times in milliseconds, and two boxes | The Quest's browser makes the picture. Read out the two times, and say whether the right box looks like the left one: the words, the two drawn icons, the round corners, the bar to move along |
| **"No."** in red, with "Step that failed:" one, two or three | It doesn't. Read out the whole line: which step failed is what decides the next thing to try |
| **"Not started."** still there after a few seconds | The page's own script did not run. Say that |

And the last line on the page, "This browser says it is:", as far as its
first number: it tells the Quest's browser from another.

**On the same visit, since it costs nothing:** in the Gallery (the same
address with nothing after `:4301/`), enter VR, open the menu, and hold each
hand in front of it. Today the menu is drawn over the hands; say what you
see, so that it is known before the mend and again after it.

## Done looks like

- Pictures from the made-up headset beside the flat menu, for the owner,
  before each merge that changes what is seen.
- **The owner's Quest 3S:** open; read a row without leaning in; change tab;
  press a row; press a pinned thing on the bar; see each come forward under
  the pointer; scroll a long tab; close. The same on the wrist.
- **Hands, on the owner's Quest 3S,** since a made-up headset can't settle
  it. With the menu open, hold each hand up in front of it: at the left
  edge, the middle and the right edge, near the face and at arm's length,
  and over the bar. Then reach past the sheet. With controllers, and again
  with bare hands. **Each time the whole hand or controller is seen, and the
  menu covers none of it.** The same over the wrist's panel with the other
  hand, and over the Menu button when the menu is closed. And say whether
  hands held at rest are in the way of reading it.
- **A check that can fail,** in the made-up headset: a trial, run by hand
  (`trials/hands-over-menu.mjs`, built for today's console), since the gate
  has no browser. A test the gate does run holds the order of drawing. Each
  hand in turn, as a controller and as a tracked hand, is held at nine
  places across the sheet and three across the bar, at 0.3 m, 0.5 m and
  0.7 m from the eyes, and once reached 0.2 m past the sheet; and over the
  wrist's panel, and over the Menu button with the menu closed. At each
  place the view is drawn twice: once with the menu, once with the menu
  taken out. **Every pixel that is a hand's or a controller's in the second
  is the same in the first.** One pixel that differs fails it. It is tried
  first against today's way of drawing, where it must fail, so that it is
  known to be able to.
- A check, in the made-up headset, that every tab and every row the flat
  menu has is in the headset's, in the same order, and nothing else.

## Must not

- Lose the floating Menu button, or the summons from a controller.
- Put anything in the headset's menu that the flat one doesn't have, or the
  other way round. With one menu this holds by how it is made.
- **Draw any part of the menu over a hand or a controller.** The owner,
  2026-11-24: "we need to make sure that the menu is not drawn above the
  hands in VR."

## Not checked

- **Any headset.** Every picture here is from a made-up one, with one eye
  and no lenses. Distance, the bar's lean and how far a thing comes forward
  are proposals to be looked at in the Quest. So is the size, though the
  owner has chosen it from the pictures.
- **Hands over the menu, drawn that way.** It is a rule here and nothing is
  built. That today's console covers the hands is read from its code, and
  seen at the sheet's edges in the mocks.
- **The Quest's browser making the picture.** Chrome on a laptop does.
- A tab with people's pictures or tiles in it: the Gallery's menu, as a
  guest alone in the room, has none.
- How long the picture takes to make on a headset's own processor.

## For the owner

1. **A, B or C** (pictures 3, 4 and 5, and their sharp ones)? **Answered,
   2026-11-24: "B I think. But we need to make sure that the menu is not
   drawn above the hands in VR."** So B, and the hands rule above.
2. **Is the headset showing the flat menu itself, as a picture, the right
   way to keep the two the same?** It needs five minutes on your Quest
   first. **Not answered yet.**
3. **The wrist:** the narrow layout there, with no bar. Yes? **Answered,
   2026-11-24: "Yes, narrow layout on the wrist with no bar."**
