# Which presses must land in the world's own page: what Chrome said

**Status:** a trial's result, for step 1 of `docs/plans/the-clients-menu.md` (its step
0b). NSWP builder, 2026-11-23. Tried in Chrome 157, scripted, with
`trials/presses-from-above.mjs`. Not tried: Firefox, Safari, Meta's browser on a Quest,
or a real headset.

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
| Open a window | not shown here | not shown here | not shown here | The scripted Chrome has its window blocker off, so this said nothing. A window needs a press in the page that opens it, by every browser's own account |

And three more things:

- **The keys.** After a press on the page above, keys no longer reach the frame. When
  the page above gives the frame the keys again, they do. So the client hands the keys
  back as its menu goes, as the shell already does for the sign-in panel.
- **The pointer, once the frame holds it.** The page above sees nothing of it, and its
  own "let go" does nothing: the frame still held it. Only the frame's page can let go.
- **Handing a press down in the words.** A browser lets a page hand a press to a frame
  for a few named things. Chrome named none of the two that matter: asked to hand down
  a headset or the pointer, it said it doesn't know them.

## What follows for the design

1. **Entering a headset from the client's menu takes one more press, in the world.**
   The client's row tells the world; the world shows its own "press to enter" across
   its view, as it already does for a visitor who left a headset to come here. That is
   one press more than today, and there is no way round it short of a browser of our
   own. The plan's section 8 said this was likely; it is now measured.
2. **The pointer for the intense way is unchanged.** It is taken at a press on the
   view, which is the world's page. But after the client's menu goes, the next press
   on the view takes it, not the menu's own Close: a visitor moving the intense way
   presses once on the world to look round again. The kit already says "a click on the
   view" where a browser refuses it after Escape, so the words exist.
3. **The world must let go of the pointer when told the menu is up** (`open: true`).
   The client can't do it for it. A world built some other way that doesn't is left
   to the browser's own Escape, which always lets go.
4. **Copying is the client's to do.** A row a world describes that copies something
   (a key, an address) can't be done by the world at a press above. So a described row
   or card may carry the text to copy, and the client copies it at the press. This
   needs one small word, a row's `copy` (a name to ask for).
5. **Reading what the visitor copied is the client's too, and is broken in the frame
   today.** "Put in the item I copied" (the Bag) and "Someone whose key I copied" (Who
   comes in) can't work in a world shown in BitPortal's frame, now, before any of this
   design: the shell doesn't allow a framed page to read what was copied. That follows
   from the same `allow` the shell uses; it wasn't tried in the shell itself. With the
   client's menu, the Bag's row is the client's own and works. The keeper's "by key"
   row is a world's row: it needs either a field in the client's menu to type or paste
   into, whose text goes down to the world (a second small word, a row's `ask`), or
   the shell allowing `clipboard-read` to the frame. The first is better: the visitor
   sees what is handed over.
6. **Sound and the microphone need nothing.**

## Questions this raises

- For the orchestrator: the two small words, a row's `copy` and a row's `ask` (names to
  give), and whether the present fault (item 5) wants a fix before step 1: the shell
  could allow `clipboard-read` to the worlds it frames, which is BitPortal's to decide.
- For the owner, with step 1's questions: "Enter VR" in BitPortal's menu will take two
  presses in a framed world (one on the menu, one on the world). The other way is to
  keep that one button drawn by the world itself, inside its frame, which breaks "one
  menu, the client's". *Recommend the two presses.*
