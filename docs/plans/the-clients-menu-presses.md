# Which presses must land in the world's own page: what Chrome said

**Status:** a trial's result, for step 1 of `docs/plans/the-clients-menu.md` (its step
0b). NSWP builder, 2026-11-23, in two parts: the first list, and then windows and a
pointer the world holds. Tried in Chrome 157, scripted, with
`trials/presses-from-above.mjs`. Not tried: Firefox, Safari, Meta's browser on a Quest,
a real headset, or anything only a person's keyboard can show (below).

## The question

When the client draws the menu above a framed world, a press on the menu is a press in
the client's page. A browser lets a page do some things only at a press in that page.
Which of the things a world does at a press stop working when the press is above it?

## How it was asked

Two pages on two different sites, as a client and a world are. The page in the frame
was given exactly what BitPortal's shell gives a world (`allow`, from its
`src/shell/index.html`). Each thing was tried three ways, each on freshly loaded pages:

- **none:** nothing pressed anywhere; the page above tells the frame in words.
- **above:** a button in the page above is pressed, which tells the frame in words.
- **own:** a button in the frame's own page is pressed. The control.

The frame also said, each time, whether the browser counted it as pressed.

**One trap, worth knowing for every trial of this kind:** a scripted call into a page
counts there as a press, and so does the call a scripting tool makes to find a button.
The first two runs said everything worked from above, wrongly. The trial now runs
nothing inside either page: presses are a mouse at a place on the screen, each page
reads what to try from its own address, and results are read from the console. It
checks that the frame says "never pressed" before anything is pressed.

## What Chrome said

| What the world does | Nothing pressed | Pressed above | Pressed in its own page | So |
|---|---|---|---|---|
| Counted as pressed, by the browser | no | **no** | yes | A press above is not a press in the frame |
| Start a headset session | refused, for want of a press | **refused, for want of a press** | got as far as "no headset here" | **Needs a press in the world's own page** |
| Take the pointer (the intense way) | refused | **refused** | taken | **Needs a press in the world's own page** |
| Use the microphone | given | given | given | Needs no press. The frame is allowed it by name, and the browser's own question is the visitor's |
| Start sound | stays silent | **starts** | starts | A press above is enough |
| Write to what the visitor copies ("Copy key") | refused | **refused** | written | Needs the frame to have the keys, which it doesn't after a press above |
| Read what the visitor copied | refused | refused | **refused** | Refused to a framed world whatever is pressed: the shell doesn't allow it. The page above can (it read it, at a press) |
| Fill the screen | refused | refused | refused | As designed: the client holds the screen |
| Open a window | blocked | **blocked** | opened | **Needs a press in the world's own page.** Tried in a second Chrome with its window blocker on: the scripted one starts with it off, and there every window opens |

And three more things:

- **The keys.** After a press on the page above, keys no longer reach the frame. When
  the page above gives the frame the keys again, they do. So the client hands the keys
  back as its menu goes, as the shell already does for the sign-in panel.
- **The pointer, once the frame holds it.** The page above sees nothing of it, and its
  own "let go" does nothing: the frame still held it. Only the frame's page can let go.
- **Handing a press down in the words.** A browser lets a page hand a press to a frame
  for a few named things. Chrome named none of the two that matter: asked to hand down
  a headset or the pointer, it said it doesn't know them.

## A pointer the world holds, as the client's menu comes up and goes

The second part. A world moving the intense way holds the pointer. The frame took it at
a press on its own view, and was then told in words, with nothing pressed, that the
menu came up (`open: true`) and went (`open: false`).

| What was tried | What Chrome said |
|---|---|
| The frame lets the pointer go when told the menu is up | It let go |
| A press on the page above, once let go | The page above got it |
| The frame takes the pointer again as the menu goes, about a second after its last press | Taken. The browser still counted the frame as pressed |
| The same, six and a half seconds after its last press | **Taken, though the browser no longer counted the frame as pressed** |

So Chrome lets a page that let the pointer go by itself take it again without a new
press. That is its rule for a page that gave the pointer up by its own call. It is
not its rule after the visitor's own Escape: there a new press is needed, which the
kit already knows ("a click on the view").

## What a scripted browser can't show

Each of these needs a person at a keyboard, and is on step 1's list for the owner:

- **Escape with the pointer held.** It is the browser's own key there. A scripted
  Escape doesn't reach the browser's handling (as one doesn't leave fullscreen), so
  the trial doesn't press it. Still to see: that the world hears no key, only that
  its hold ended, and that taking the pointer again then needs a press.
- **Where a press goes while the pointer is held.** A scripted mouse is sent to a
  place on the screen whatever holds the pointer, so the page above "got" a press
  that a person's mouse could never have given it. That line of the trial's output
  says nothing, and is marked so.
- **Escape in fullscreen,** for the same reason as the first.

## What follows for the design

1. **Entering a headset from the client's menu takes one more press, in the world.**
   The client's row tells the world; the world shows its own press across its view,
   as it already does for a visitor who left a headset to come here. That is one
   press more than today, and there is no way round it short of a browser of our
   own. **Decided (the owner, 2026-11-23): two presses, each with its own name. The
   client's row is "Enter VR"; the world's press across its view is "Launch",**
   wherever the world shows that screen.
2. **The pointer for the intense way is unchanged.** It is taken at a press on the
   view, which is the world's page. But after the client's menu goes, the next press
   on the view takes it, not the menu's own Close: a visitor moving the intense way
   presses once on the world to look round again. The kit already says "a click on the
   view" where a browser refuses it after Escape, so the words exist.
3. **The world must let go of the pointer when told the menu is up** (`open: true`).
   The client can't do it for it. A world built some other way that doesn't is left
   to the browser's own Escape, which always lets go. When the menu goes, the plan
   has the pointer taken again at a press on the view; Chrome would also let the
   world take it at once (above), which is a question put to the orchestrator.
4. **Copying is the client's to do.** A `press` reaches the world as words, with no
   press in its page, so a world's row that copies fails, and fails quietly: nothing
   tells the visitor. So a described row may be of the kind `copy`, carrying its
   text, and the client copies it at the press (the name was given on 2026-11-23).
5. **Opening a window is the client's to do, for the same reason.** A world can't
   open one from a press on the client's menu: the browser blocks it, and says
   nothing to the visitor. The windows the menu needs are the sign-in address's
   pages, which the client shows in its own panel.
6. **Reading what the visitor copied is a known fault for a framed world, and gets
   no quick fix.** "Put in the item I copied" (the Bag), "Someone whose key I copied"
   (Who comes in) and following someone by a copied key can't work in a world shown
   in BitPortal's frame, now, before any of this design: the shell doesn't allow a
   framed page to read what was copied. That follows from the same `allow` the shell
   uses; it wasn't tried in the shell itself.
   - **`clipboard-read` is not added to the frame's `allow`** (the orchestrator,
     2026-11-23). A world would then read the visitor's clipboard under the client's
     name.
   - **The fix is step 1's.** The Bag's and Following's rows become the client's own.
     The keeper's "by key" row is a world's: it becomes a row of the kind `field`
     (the name given, in place of `ask`), which the visitor types or pastes into and
     whose text goes to the world only at their press. The visitor sees what is
     handed over.
   - **Until then the three rows say why.** In a frame they no longer ask the visitor
     to "allow this site", which there is a switch that doesn't exist. They say the
     world is shown inside another page, and to open it by its own address.
7. **Sound and the microphone need nothing.**

## Questions this raised, and their answers

- **The two small words:** given by the orchestrator on 2026-11-23 as `copy` and
  `field`.
- **A quick fix for the clipboard fault:** none (item 6).
- **"Enter VR" as two presses in a framed world:** yes, the owner, 2026-11-23, with
  the names "Enter VR" and "Launch" (item 1).
- **Still open, for the orchestrator:** whether a world tries to take the pointer
  again as the menu goes, before waiting for a press on the view (item 3).
