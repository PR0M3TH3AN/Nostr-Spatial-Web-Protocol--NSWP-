# Trials

Scripts that try the real things together on one machine: the local sites, a
sign-in address's local copy, a selling service's sandbox. They are not unit
tests (`npm test` is) and they are not part of `npm run gate`: each needs
something running that the gate doesn't start. They are kept here so they
outlive whichever session wrote them.

Every one uses throwaway keys and pretend sats, signs in nowhere, and sends
nothing to a real relay or a real service unless its first lines say otherwise.
None names a machine: the address is this machine's own on its network
(`LOCAL_HOST` to override).

## What has to be running

| Needed by | What | How |
|---|---|---|
| nearly all | The local sites, over https on the network address | On the owner's machine: a service, always up (below). Anywhere else: `node scripts/serve-local.mjs --lan --https` (docs/local-server.md) |
| anything with a relay | The stand-in relay: `ws://127.0.0.1:4313` and `wss://<this machine>:4314` | On the owner's machine: a service, always up. Anywhere else: `npm run relay` |
| `sandbox-*`, `buy-screen*`, `front-room` | BitUnlock's sandbox at `https://<this machine>:4312` | Its own repository's session runs it |
| `buy-screen*`, `panel` | BitLogin's local copy at port 4311 | The local sites serve its built folder |

**The two services** (on the owner's machine since 2026-11-21, at their
word, so that neither stops with a session or a restart):
`scripts/services/nswp-local-sites.service` and
`nswp-stand-in-relay.service`, copied into `~/.config/systemd/user/` and
turned on with `systemctl --user enable --now <name>`. They run from this
repository's main folder, so they serve what is on `main` and built there.
`systemctl --user status nswp-local-sites` says how one is;
`systemctl --user restart nswp-local-sites` picks up a site's changed
headers; `journalctl --user -u nswp-local-sites -n 50` shows what it said.
Don't start a second copy of either by hand: the ports are taken. The
relay keeps nothing across a restart, so a test listing put on it is gone
after one: run `sandbox-buy.mjs` again to put a fresh one up.

Node's own requests need this machine's certificate: run a trial with
`npm run trial -- trials/<name>.mjs`, which sets it.

## The trials

| File | What it tries |
|---|---|
| `stand-in-relay.mjs` | Not a trial: the relay itself. Checks signatures, keeps the newest of a replaceable event, memory only |
| `stand-in-relay-try.mjs` | That the relay takes an event by one address and gives it back by the other |
| `sandbox-buy.mjs` | A whole purchase against the sandbox: seller, listing, quote, half paid, paid, the receipt read by the kit, a renewal |
| `sandbox-shares.mjs` | The same with shares, every payment held to the kit's own rule. `KEEP=1` leaves the listing registered |
| `buy-screen.mjs`, `buy-screen-run.mjs` | A world built on the kit asking BitLogin's real screen to buy from the sandbox. Sealed: nothing but this machine is reached. Signing in is not done here: give `SIGN_IN=<a module>` whose default export does it, under the rules of whoever may |
| the same, with shares | `LISTING=<a listing with shares>` `CLIENT_SHARE=<a key registered to be paid>` `WANT_ON_SCREEN="for the maker\|for the client"`: the local page that keeps the screen names that key as the client's, in the scripted browser only, and every share must be on the screen before the press |
| `owner-lists.mjs` | A world owner keeps someone out: this checkout's own Gallery (`npm run build` first) with a keeper and `named_only` named in the scripted browsers only, the owner's block list on the stand-in relay, three visitors by name. The one blocked is stopped at the gate and refused at Join; with a kit told nothing of the list he joins, and the others' rooms let him go; a guest is refused where only named people are shown, and one whose kit ignores that is never shown; and a world by invitation, where the invited are let in, a guest is asked to sign in, and someone not invited is kept out at the gate and from the room. No sandbox needed |
| `front-room.mjs` | The front room of a paid world: this checkout's own Gallery (`npm run build` first) with its gate switched on in the scripted browser only, a visitor who holds nothing, a purchase from the sandbox, the gate opening on the receipt, the kit as shipped refusing it, another visitor kept out, and the pass running out with the visitor inside. The sign-in address is a stand-in, and so are relays: BitLogin's own screen is not tried here |
| `room-tip.mjs` | A tip to a person in BitPortal's room, two throwaway visitors, a stand-in for BitLogin's client |
| `panel.mjs` | BitLogin's real panel opening over a local world and closing, desk and phone sizes, signed out |
| `xr-test-look.mjs` | The headset test page loads and sends nothing by itself |
| `xr-test-guided.mjs` | A whole guided run of the headset test with a made-up headset and made-up relays: each step lands, asks, and is sent; the notes are signed and whole. Needs only `npm run build`, nothing running. `LIVE_SHELL=1` also takes the two steps inside BitPortal's page, through the live one, read only |
| `live.mjs` | After a deploy, read-only: every public site is on this kit, the shell is the way in, the real panel opens and closes. The shell keeps the panel's box between openings (`data-kept`): kept is closed, and it is checked that a kept box can't be seen and takes no press |
| `menu-above.mjs` | A framed world stepping its menu aside for a client that has it: this checkout's own Gallery (`npm run build` first) in a frame of a stand-in client on another site, which draws nothing and only speaks the words. A client that answers (the world draws no menu and never fetches it, describes itself, takes a setting, a press and the menu coming and going, and forwards the visitor's few keys), one that never does (the world's own menu), and one that answers late (the world's own is put away). Needs nothing running |
| `menu-client.mjs`, `stand-in-client/` | The client has the menu, both ends together: a stand-in client (a page that frames a world and mounts the menu from this checkout's kit, loaded only by the kit's entries as a client with a copy of the kit would, never by a path into it; no sign-in, no bag, a way home) over this checkout's own Gallery (`npm run build` first). One menu, the client's; the world's tabs in it; who has the keys; a row typed into, a row that copies; a setting changed above; a page that doesn't speak the words; Home with a world that never answers; and the visitor's own music, chosen at the browser's chooser from the client's own row, played by the client's page, who has the keys a moment after the sheet closes (by Escape, by its Close, by its mark) with the menu brought up from its mark as a visitor brings it up; a press outside the sheet closing the menu and reaching nothing in the world; and still playing when the next world comes into the frame, with its playback controls (what is playing on a bar that is moved along, the time running, the song before and after, back and forward, shuffle and repeat, play and pause on the bar, and the same rows in the world's own menu); and a file handed down and a picture handed up (the client's page opens the browser's chooser for the world's "Hang a picture or video" and hands the chosen file down, a file of another kind is refused, and "Take a picture" in the client's menu is saved by the client's page under a name of its own, with every chooser and every save counted in the page that made it). A real mouse and keyboard at places on the screen. Needs nothing running **Six visits, each of which can be run alone:** `node trials/menu-client.mjs` runs them all (about two minutes on a busy laptop, with Chrome drawing on the graphics card, and it says what in fact drew the pages; `--software` draws without the card, in about three and a half, and is wanted too before a kit version), `node trials/menu-client.mjs music file` only those, `--list` names them with what each takes, `--times` says how long each check waited. Each visit's beginning and end are said as it goes. A run stopped from outside says STOPPED, with what ran to its end and the command for the rest, and reports no failed check for it (exit 143, or 3 for a browser that went away; 1 is only ever a failed check) |
| `menu-above-engine.mjs` | The same as `menu-above.mjs`, for a world made with another engine: a bare page that loads only this checkout's engine script (`npm run build:engine` first), in a frame of a stand-in client. A client that answers (no menu from the first moment; the world's own words in Help and nothing of the visitor's; the menu coming and going told to the engine; the summons forwarded), one that never does, and one that answers late. Needs nothing running |
| `godot-pixels.mjs` | What it costs to bring a picture the page drew into a Godot world, before the console in a headset there is settled: this checkout's export of the Godot example (`npm run build:godot` first, and the local sites service up for Godot's audio worklets), a page's canvas of the console's size drawn afresh and brought in thirty times each of five ways (its pixels as they are, the canvas told it will be read often, two smaller sizes, a PNG). Each step is timed where it happens. A measurement, with no checks: it prints the figures. Not a headset's |
| `menu-cost.mjs` | What the client's menu costs: the Gallery, the Grove (`npm run build` first) and the Godot example (`npm run build:godot` first), each in a frame of a page that says nothing (the world draws its own menu) and of the stand-in client (the client draws it). Frames a second in the world's page, each page's main-thread work, the words that cross and their size, how soon the menu is there, what each page holds, and every file the world asked for, with the menu down and up. Draws with this machine's own graphics card; `--uncapped` for as many frames as it can, `--once`, `--only=gallery`, `--out=file.json`. It measures and judges nothing: it fails only if a visit never came up. The result of 2026-11-23 is `docs/plans/the-clients-menu-cost.md` |
| `presses-handed-over.mjs` | Four more presses, and whether the page above can do the browser's part and hand the result over: choosing a file (the frame's own chooser, then a file chosen above and handed down, 64 MB too), saving a picture (the frame's own save, then a picture handed up and saved above), and sharing the screen (the frame asking, as the shell allows it and with `display-capture`, then the page above sharing and handing the picture down over a connection). Two made-up sites served by the script; nothing is run inside either page. `xvfb-run -a -s "-screen 0 1280x900x24" node trials/presses-handed-over.mjs --shown` photographs the browser's own screen chooser, which is part of no page. The result of 2026-11-23 is `docs/plans/the-clients-menu-handed-over.md` |
| `godot-hands.mjs` | Moving in a headset in a Godot world, on the flat page: the Godot example (`npm run build:godot` first) is handed hands this script makes up (where each stick is, where the hand is, the way it points), since no scripted browser can be in a headset in a Godot world. From there on it is the same code as in a headset: the kit says what the hands mean (`NSWP.hands`) and the add-on's visitor does it. Casual: notch turns, the ring where a hand points, the step, no step at the sky, a step back, a step's reach and its pace, a door lit. Intense: a smooth walk and turn. It can't show a real controller, the fade, or the hands drawn. Needs the local sites service, for Godot's two worklets |
| `godot-leave-vr.mjs` | A headset session in a Godot world, with a made-up headset put in the page (`npm run build:godot` first): the example comes up, is offered "Enter VR" and asks the headset for a session. **No session starts** (Godot needs WebXR Layers, which the made-up headset lacks), and the trial says so; where one does, the menu button brings the console up and the visitor stays in the session. Written for the stopgap, when that button left the session |
| `godot-console.mjs` | The console in a headset in a Godot world, on the flat page with hands this script makes up (`npm run build:godot` first, and the local sites service up): the menu button brings the kit's console up in front of them; Godot holds the kit's own list of rows; a hand pointed at a row lights a box at the row's place and size; pointing never changes the picture or brings it across (counted in the page); a row the kit gives no light for isn't lit; a trigger presses, the picture changes and crosses once; Close and the button put it away; and opened with `#pixels` in its address the example says what the console's picture costs to bring across. Not a headset |
| `xr-console.mjs` | The console in a headset in a Three.js world: this checkout's Gallery (`npm run build` first) in a made-up headset, its console opened, read, pressed and closed through the world's test hook, and its picture read from the panel's own canvas. For the drawing the two kinds of world share (`console-drawing.ts`) |
| `menu-rows.mjs` | The row typed into and the row that copies, and a press outside the sheet closing the menu and reaching nothing of the world's view, as the kit's own menu draws them: this checkout's own Gallery (`npm run build` first), two rows added through its test hook, a real keyboard. What is half typed stays while the menu is drawn again; nothing is given before the press; nothing is kept after. Needs nothing running Words said for a moment with the menu up are in a strip of the sheet's own, between its rows and its foot, at a desk's width and a phone's: always there, one line high, one line showing, over nothing that can be pressed, with every row where it was (checked by where things are, with one, two and three lines said). Words too long for one line are shown whole, on up to four, with the sheet kept its size and the room taken from the foot of the rows' own scrolling area: checked for three of the kit's long lines and for its longest, found from the code as the trial runs. With the menu down they are at the lower left, and a line moved with the menu doesn't come in a second time A press made while the menu is told to draw again is still a press; what changed is drawn once the press is over; a press that never ends, is cancelled, or loses the keys is not waited for; and a bar moved along meanwhile goes where it is put. Drawn with the graphics card (`--software` draws without) |
| `presses-from-above.mjs` | Which things a framed world can do from a press on the page above it, and which need a press in its own page: a headset session, the pointer, the microphone, sound, copying and reading what was copied, filling the screen, a window (in a second Chrome with its window blocker on), and a pointer the world holds as the menu comes up and goes. Two made-up sites served by the script; needs nothing running. The result is `docs/plans/the-clients-menu-presses.md` |

## Rules

- **A trial routes every request and every WebSocket, and lists what was asked for.** Routing pages and files
  is not enough: a world opens relays by WebSocket, which a route for requests doesn't see. A trial that says
  nothing else is reached answers every socket itself (`ctx.routeWebSocket`), with the relay's "nothing more"
  to each request and nothing else, and prints which addresses were asked for. (`menu-above.mjs` and
  `menu-rows.mjs` went onto `main` on 2026-11-23 with their sockets unrouted. Nothing was asked for in any
  run, but nothing would have stopped it.)
- **A trial about presses or keys never runs anything inside the page it is
  asking about.** A scripted call into a page counts there as the visitor's own
  press, and so does the call a scripting tool makes to find a button
  (Playwright's `evaluate`, and every `locator` action or wait). Such a trial
  then passes wrongly: everything looks allowed. Learnt on 2026-11-23, when the
  first two runs of `presses-from-above.mjs` said a framed world could start a
  headset session from a press above it. So:
  - press with a mouse at a place on the screen (`page.mouse.click(x, y)`) and
    with keys (`page.keyboard`), as a person does;
  - have each page read what to try from its own address, and say what
    happened on its console; read only that (`page.on("console")`);
  - have the page say whether the browser counts it as pressed
    (`navigator.userActivation.hasBeenActive`) before anything is pressed, and
    fail the run if it already does;
  - know what a scripted browser can't show at all: its window blocker is off
    unless turned back on (`ignoreDefaultArgs: ["--disable-popup-blocking"]`),
    a scripted Escape doesn't reach the browser's own handling (leaving
    fullscreen, ending a held pointer), and a scripted mouse goes to a place on
    the screen whatever holds the pointer. Those need a person.
- A trial that would make an account, type a password, or publish anything
  says so in its first lines, and is not run without the owner's word.
- A trial found failing is fixed or deleted, not left: a folder of scripts
  nobody trusts is worse than none.
- What a trial proved goes in the plan it belongs to, with the date and who
  ran it. "Passes here" is not "works live".
