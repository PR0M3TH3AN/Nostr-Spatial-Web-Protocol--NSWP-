# BitPortal Browser: specification and development plan

**Version:** 0.1 (a first draft, written before any of it is built)
**Date:** November 18, 2026
**Status:** Proposed. Nothing here exists yet except where a line says so.
**License:** CC0 1.0, like the protocol.

This is the plan for the part of the spatial web that a website can't be: the
browser a visitor stands in. It sits beside the protocol, not inside it.

| | What it is | Where it is written |
|---|---|---|
| **NSWP** | The protocol: how worlds are announced, linked, entered | [`protocol/`](../protocol/README.md) |
| **BitPortal Web** | The reference client, as a website. Works in any WebXR browser | [`spec.md`](../spec.md) Part II, and the `bitportal` repo |
| **BitPortal Browser** | A browser of the visitor's own, for what a website is not allowed to do | This document |

## 1. What it is for

A page in someone else's browser can't keep a headset session across a
crossing, can't draw a web page onto a panel, and can't draw anything a world
couldn't fake. A browser can do all three. Those are the reasons to build one,
in order of how much they change a visit:

1. **A crossing with no flat pages.** Today a headset session ends at every
   door: three actions, two of them on a flat panel
   ([NSWP-02](../protocol/02-doors.md)). A browser owns what the headset
   shows, so it can keep showing while the page underneath changes and let
   the next page begin with no press (section 5). One action: the door.
2. **An Airlock a world can't forge, inside the headset.** The Airlock is a
   flat page today because a world draws everything a visitor sees in VR. A
   browser draws above the world, where no world can reach. The check moves
   into the headset and keeps its meaning.
3. **A sign-in page a world can't forge.** The browser holds no key and
   signs nothing (decided: section 2a). The visitor's identity stays where
   it is today, at their sign-in address, as a web page. What the browser
   adds is a place to show that page above the world, with its address
   drawn by the browser, in a headset too: today a world can draw a copy of
   a sign-in panel, and nothing can show one in a headset at all.
4. **Web pages as panels.** Any website on a surface the visitor can place,
   beside whatever else they have open.
5. **Things that stay with the visitor.** Their panels, their running
   programs and their place, kept from one world to the next.

Most of what makes a room useful needs none of this. Panels that show our own
content, a shared screen, a terminal and passthrough all work in BitPortal
Web, and are built there first (section 8, stage A).

## 2. What must stay true

- **A world is a website, and never needs this browser.** Every world works in
  Quest Browser, Wolvic, Safari and whatever comes next. A world that says
  "install BitPortal Browser to enter" has left the open web. The furthest a
  listing goes is "more is possible in a browser that offers X".
- **Worlds run as they are.** A Three.js world loads from its own address and
  runs its own code. Nothing is converted, wrapped or rebuilt.
- **The visitor's home is a web app too.** The room they start in is BitPortal
  Web: Three.js, the same kit worlds use. The browser gives that one page
  extra abilities. It is not rewritten in a native toolkit.
- **A world gets nothing new by default.** Not the visitor's key, their
  panels, the pixels of another site, their programs or their files. Standing
  in a world never grants any of them.
- **What the browser draws, a world can't.** Its Airlock, its warnings and its
  menu sit on a layer above every world, and look unlike anything a world's
  page can produce at that depth.
- **Ask what a browser can do; never ask which browser it is.** Features are
  found by asking for them, so a second browser can offer the same ones.
- **The privacy rules carry over.** Looking at a door contacts no site.
  Opening a panel is a visit, and is made on purpose.

## 2a. What the browser never contains

The owner, 2026-11-21: "We have decided to fork Wolvic and enable some of
the features we need by default. This way none of the bitcoin stuff related
to bitpotal ships with the bitbrowsers code." And of the browser and
BitPortal: "separate projects but they are to be one cohesive system."

So there is a line, and the browser stays on one side of it. It was agreed
between the session building the browser and the one building the kit, and
it is the owner's in substance. In the browser's code and in what it ships:

1. **No wallet, payment, invoice, receipt, share or price code.** None of
   BitLogin's or BitUnlock's code, copied or linked. Nothing on
   `window.nswp` that pays, tips, buys or asks what is held, and
   `nswp.can()` answers no to any such name.
2. **No payment drawn by the browser.** A payment is always a web page's
   own pixels (the sign-in address's own page), shown by the browser as it
   shows any page.
3. **The browser is never "the client that brought the buyer"**
   (`docs/plans/paying-for-things.md`, section 8). It takes no share and
   names itself to no payment service. Inside it, that client is still
   BitPortal the website.
4. **No address with special powers written into it.** Not BitPortal's, not
   a sign-in address's, not a selling service's. What a site may do is
   granted per site, and asked for.
5. **No signer.** The browser holds no Nostr key, signs nothing and makes no
   pass. (The owner, asked "Drop the browser-held Nostr signer from the
   first versions, leaving identity with BitLogin's web panel?": "Yes, drop
   it". A browser that signs any note a page hands it would be signing
   payments too.) Nothing in the kit needed it: since 2026-11-19 a world
   signs through a hidden frame of the visitor's sign-in address
   ([NSWP-10](../protocol/10-identity.md), "Signing from a world").
6. **The first page it opens, and any starting bookmarks, are settings and
   not code:** an address that can be changed with no new build.
7. **It never reads, shows or keeps a receipt, a price or whether something
   is paid for,** not even as a mark in its own menus.

Nothing here is asked of a world, of BitPortal the website, or of the
visitor. It is what lets the browser be reviewed and shipped as a browser.

## 3. The parts

```text
┌──────────────────────────────────────────────────────────────────┐
│ Shell      small, native, different on each kind of device       │
│            owns the headset session; draws the Airlock, panels   │
│            and warnings above everything; holds no key           │
├──────────────────────────────────────────────────────────────────┤
│ Engine     an existing browser engine; runs every page           │
├────────────────────────────────┬─────────────────────────────────┤
│ Home                           │ Worlds                          │
│ BitPortal Web, at its own      │ any site, as it is              │
│ address, chosen by the visitor │                                 │
│ may ask the shell for more     │ may ask the shell for a door    │
└────────────────────────────────┴─────────────────────────────────┘
         the bridge: `window.nswp`, the only way a page asks
```

- **The shell** is the only native code, and it is kept small. It composites:
  the page's headset frames underneath, panels and the browser's own interface
  on top.
- **The engine** is not ours. Section 6 says which, per device.
- **The home** is a web page the visitor chose, the way they would choose a
  search engine. It is the only origin given the wider half of the bridge, and
  the visitor can change it. That keeps BitPortal one home among possible
  others, and keeps the browser from being a walled garden with our logo on.
- **The bridge** is the specification proper: section 4.

One consequence worth stating: the home never touches another site's pixels.
It asks the shell to put a page on a panel at a place, and the shell draws it.
A home that could read a panel could read the visitor's mail.

## 4. The bridge: `window.nswp`

The SDK already looks for it: `portal.go()` calls `window.nswp.navigate()`
when it exists and uses an Airlock page when it doesn't. So a world built
today needs no change to cross without flat pages in this browser.

Everything is found by asking. `nswp.can("panels")` answers true or false, and
a method that isn't offered isn't there.

### For every page

| Call | What it does |
|---|---|
| `nswp.navigate(destination, carried)` | Cross to another place. The shell shows its Airlock above the world and waits for the visitor. `carried` is what the visitor takes with them (that they are in a headset, in a room, how they move, their settings): what the kit would have put in an Airlock's address. The shell puts it in the arrival it makes for the place they approve, keeps none of it, and shows none of it but what its Airlock needs to say how they will go |
| `nswp.home()` | Go to the visitor's home |
| `nswp.can(name)` | Whether this browser offers a feature |

A page is told nothing about the visitor by any of these. On arrival it gets
the same arrival context as today ([NSWP-03](../protocol/03-arrival.md)), with
whatever the visitor chose at the Airlock and nothing else.

**Names `can()` answers to**, as agreed on 2026-11-21 between the sessions
building the browser and the kit:

| Name | Means |
|---|---|
| `navigate` | A door is taken by the shell, with the visitor kept in the headset view |
| `airlock` | The shell draws its own Airlock, above the page |
| `windows` | A window this page opens at the visitor's press is shown to them where they are, a headset included, as a surface of the shell's with the address drawn by the shell. One at a time for a page, and it stays the opener's window in every other way, so what a page and its window say to each other is unchanged. This is how a sign-in address's page is shown: nothing in it knows whose page it is |
| `panels` | Later: web pages on surfaces the visitor places |

**What the shell's Airlock checks** is what any Airlock checks, and it is
held to the same examples as the kit, with no code shared: a destination's
address (`vectors/destinations.json`), a world's announcement
(`world-events.json`), the site vouching for it (`manifests.json`), and the
arrival it then makes (`arrivals.json`). It may be stricter than BitPortal
Web's Airlock, and never looser.

**Letting the next page start in the headset.** The kit listens for
`sessiongranted` from the moment its code loads and asks once, when the
world has built its scene: `immersive-vr`, with `local-floor` and
`hand-tracking` optional and nothing required. So the shell's leave has to
last as long as a world takes to load, which for a heavy one is a while:
it belongs to the arriving page until that page asks once or goes
elsewhere, and not to a timer.

### For a page the visitor has granted them to

| Group | Calls | Notes |
|---|---|---|
| Panels | `panels.open({ url \| media \| stream, place })`, `move`, `close`, `list` | The shell draws them. The home never sees inside one |
| Workspace | `workspace.save()`, `restore()` | Which panels are open and where, kept on the device |
| Programs | `bridge.pair()`, `list()`, `open(program)` | Section 7. Each returns a stream to put on a panel |

Rules:

- **Being the home grants nothing by itself** (section 2a, 4). Panels, the
  workspace and programs are each something the visitor gives one site, at
  the shell's own prompt, and can take back. The home is only the site most
  likely to be given them. To a page that hasn't been, the method is as if
  it didn't exist.
- There is no identity on the bridge, for the home or anyone (section 2a,
  5). An earlier draft had the shell hold the visitor's signer.
- Nothing here lets a page read a panel, type into one, or learn what is open.

### BitPortal Web without the browser

Every call has a fallback in an ordinary browser, written once in the SDK:
`navigate` goes to the Airlock page, `panels.open` with a web address opens a
new tab, identity comes from BitLogin. So the home is written against the
bridge from the start, and gains abilities when it finds itself in the
browser. This is built in stage A, before any native code exists.

## 5. A crossing, in the browser

1. The visitor selects a door. The world calls `portal.go()`, which calls
   `nswp.navigate()`. The visitor stays in the headset view: the shell is
   what is drawing from here on.
2. The shell draws the chamber round the visitor and the Airlock on its wall:
   the real address, whether the site vouches for its announcement, how they
   will go (by name, as a guest, plain). This is the shell's drawing, so for
   the first time the chamber is part of the check instead of scenery.
3. For a world they have approved before, the doors close and open with a
   moment to cancel. Otherwise they select **Continue**.
4. The world's own session ends, and the shell keeps presenting. The shell
   loads the destination underneath and lets it start a new session of its
   own with no press (the `sessiongranted` event, which the SDK already
   listens for). The doors open when the world has drawn its first frame.

Nothing is handed from one site to the next. A session belongs to the page
that asked for it and ends with it; what carries across is the visitor's
view, which is the shell's, and the shell's leave for the next page to begin
at once. (Corrected on 2026-11-21: this step used to say the shell "grants
it the session", which read as if the second site inherited the first
one's. No browser works that way. The stock Meta Quest browser has the
event behind a setting; it is in neither upstream Chromium nor Wolvic, so
a browser of ours has to make it.)

One action for a familiar world, two for a new one, none of them on a flat
panel. If the destination never asks for a session, it is a flat site, and it
opens as a panel in the chamber instead.

## 6. Which engine, on which device

Checked on the date above. "Unverified" means I found no source I trust.

| Device | Shell | Engine | Standing |
|---|---|---|---|
| Desktop, no headset (Linux, Windows, macOS) | Electron | Chromium | Buildable now. Electron renders a page off-screen and hands the app its pixels, which is how a real web page gets onto a panel. No headset session, so it proves panels, the bridge and the Airlock, not crossings |
| PC headset on Windows | Electron | Chromium | Chromium's headset support on Windows is real (OpenXR). Untested by us |
| PC headset on Linux | Electron | Chromium | **Blocked upstream.** Chromium has no headset support on Linux. Unofficial patches exist. A talk at FOSDEM 2026 suggests Steam Frame may change this |
| Quest, Pico and other Android headsets | A fork of Wolvic | Gecko or Chromium | Wolvic is an open-source browser for exactly these devices, with web pages as panels and headset sessions already working. Its shell is Android code, not Three.js: our home runs inside it as a page |
| Steam Frame | The Android build, or a Linux ARM64 build | as above | Valve documents both Android packages and Linux ARM64 as supported. Whether Wolvic runs there is unverified |
| Apple Vision Pro | None planned | Safari | BitPortal Web runs in Safari. An app's own web view does not appear to support headset sessions, so a shell could not run worlds |

Three things follow:

- **There is no one program for every device.** The engine differs, so the
  shell differs. What is shared is everything above it: the home, the SDK, the
  bridge and this document. That is most of the code, and all of the design.
- **Two shells cover nearly everything:** Electron for desktops, a Wolvic fork
  for standalone headsets. Each is small if the bridge is the same.
- **The developer's own machine is the weakest target for headset work.**
  Linux desktop is where panels and the bridge get built, and where headset
  crossings can't be tested.

## 7. Programs from your own computer

"Claude Code on a panel while I stand in my home" is its own piece, and needs
no browser. It needs a small program on the computer: **the Bridge**.

| Stage | What crosses | What it takes |
|---|---|---|
| Terminal | Text and keystrokes | A terminal the home draws itself, as characters on a panel. The Bridge runs the shell (inside `tmux`, so it outlives the headset) |
| Window, to look at | Video | The Bridge captures one window the user picks |
| Window, to use | Video, plus pointer and keys going back | The Bridge injects input. This is remote control of the computer |

How it connects, and why:

- **Paired by key.** The Bridge is told one Nostr public key: the owner's. It
  answers nobody else. No password, no account, no port opened to the
  network.
- **Connected the way rooms are.** A page served over `https` can't open a
  plain connection to a computer on the local network: browsers block it. So
  the headset and the Bridge find each other the way two visitors in a room
  do, with encrypted notes through relays, and then talk directly. This is
  code the SDK already has.
- **It belongs to the home, never to a world.** No world can see a terminal,
  learn that one is open, or reach the Bridge. The one exception is a world
  its owner is building and has named in their home and at their computer
  ([`bridge.md`](bridge.md), "A world of your own").

A terminal that runs commands is the most dangerous thing in this document.
The Bridge starts with nothing shared, lists what it will run, asks on the
computer's own screen before anything opens, and shows there when something
is connected. The terminal stage is built: [`bridge.md`](bridge.md).

## 8. The plan

Each stage ends in something a person can use, and says what would stop it.

### Stage A: in BitPortal Web, now

No native code, and testable on the machine this is written on.

| | Build | Done when |
|---|---|---|
| A1 | **Panels** in the SDK: a surface with a frame, grabbed, moved, resized and put away. Pictures, video, and text the kit draws itself | A visitor in an emulated headset can place a video and a note, and find them there next visit. **Built and live** (`createPanels`; [`docs/controls-kit.md`](../docs/controls-kit.md), "Panels"), with a keyboard and a library of the visitor's own files in the headset. Tried in an emulated headset only |
| A2 | **The bridge, as a contract**, with its fallbacks. The home calls `nswp.*` and nothing else | BitPortal Web runs unchanged in behaviour, with every crossing and sign-in going through the bridge's fallback |
| A3 | **A terminal panel and the Bridge**, terminal only | The owner pairs a computer by key and runs a command from a panel in their home. A second key is refused. **Built** ([`bridge.md`](bridge.md): what it trusts, the grant, the wire, how to run it). BitPortal's side is live, and the owner has run Claude Code in a panel in their room with their own sign-in, over public relays. Not tried on a real headset, or with the browser and the computer on different networks |
| A4 | **A shared screen in a room**, to look at | One visitor shares a window; another sees it on a panel. Rooms carry sound and position today, so this adds video to the connection. **Built** (0.13.2): offered to the room and sent only to those who choose to watch, on a panel of the watcher's own. Tried with three visitors on one machine and a drawn picture in place of a screen. Not tried with a real screen, across two networks, or in a headset |

Stops if: text on a panel can't be made sharp enough to read in a headset.
That needs a real headset to judge, and is the first thing to test on one.

### Stage B: the desktop shell

| | Build | Done when |
|---|---|---|
| B1 | An Electron shell with BitPortal Web as its home and the bridge for real | Any website opens on a panel in the home, and the home can't read it |
| B2 | The shell's own Airlock, drawn above the page | A crossing from the home to a world shows the Airlock without leaving the 3D view |
| B3 | A window a page opens, shown above the page by the shell | The sign-in address's own page comes up over the home with its address drawn by the shell, and signing in works unchanged. (Was "the signer in the shell": dropped, section 2a.) |

Stops if: off-screen pages are too slow to scroll and type in. Then panels
show pages at a lower rate, or the shell changes.

### Stage C: the headset shell

**Needs a headset.** Nothing in this stage can be judged in an emulator.

| | Build | Done when |
|---|---|---|
| C0 | Build Wolvic unchanged and run it | BitPortal Web's room and one crossing work in it as they do in Quest Browser |
| C1 | `nswp.navigate` and the shell's Airlock, in a fork | A crossing between two worlds keeps the visitor in the headset view: one action, no flat panel |
| C2 | The rest of the bridge | Panels opened by the home appear in the headset |

Stops if: Wolvic can't keep a session across a page change without deep
changes to its engine. Then the browser is a desktop program, and headsets
keep the three-action crossing until their own browsers improve.

### Stage D: only if asked for

Using a window from the headset (the Bridge's third stage), a Linux headset
build once Chromium supports it, Steam Frame, and anything for Apple.

### What to buy

One standalone headset, before stage C. Everything headset-related in this
project so far has run in an emulator only. A Quest 3S is the cheapest device
that runs both its own browser and Wolvic.

## 9. Where this differs from the plan it started from

This document began as a review of a plan drafted in a ChatGPT conversation.
Most of that plan's final shape is kept: three layers, worlds that never need
the browser, existing engines instead of a new one, Wolvic as the place to
start on headsets, and a companion for desktop programs. The changes:

| Its plan | Here | Why |
|---|---|---|
| The browser's point is websites on floating panels | Its point is the crossing and the Airlock; panels are fourth | Those are what a visitor feels at every door, and what no website can fix |
| A shared TypeScript and Three.js application inside a native shell | The home is BitPortal Web, loaded as a page; the shell is small and native | Otherwise the room is written twice, and worlds and home drift apart |
| First milestone: Chromium on Linux with headset support | First: BitPortal Web, then a desktop shell with no headset | Chromium has no headset support on Linux. That milestone rests on unofficial patches |
| Tauri set aside; no desktop shell named | Electron | It can hand a page's pixels to the app. That is the one thing a panel needs |
| An encrypted WebSocket to the computer over the local network | Paired by Nostr key, connected like a room | A secure page can't open that connection. Browsers block it |
| Apple: a WebKit shell using a new immersive setting | None planned | I could not find that setting documented, and an app's web view doesn't appear to run headset sessions |
| Listings marked "enhanced in BitPortal Browser" | Listings name the feature, not the browser | A second browser should be able to offer it |
| New capability names added to announcements | None yet | Nothing a world announces changes until a browser exists to read it |

## 10. Not decided

- ~~Who may be a home.~~ Settled on 2026-11-21: any address the visitor
  chooses, since being the home grants nothing (section 4, "Rules"). A
  malicious home gets what any site gets, until the visitor grants it more
  at the shell's prompt.
- **How the shell's layer is made unmistakable** in a headset, where there is
  no address bar. A colour or a sound can be copied. A secret the visitor
  chose, shown only by the shell, is the usual answer.
- **Depth.** Panels drawn by the shell sit in front of or behind a world's
  whole picture, not among its objects.
- **Sharp text.** Whether panels need the headset's own text layers, and
  whether Wolvic and Electron both expose them.
- **Updates.** A browser must ship engine security fixes for as long as it is
  installed. A fork carries that duty. This is the largest standing cost in
  the whole plan, and the reason to keep the fork small.

## Sources

Checked November 18, 2026.

- Electron, off-screen rendering: <https://electronjs.org/docs/latest/tutorial/offscreen-rendering>
- Chromium, headset support by platform: <https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.96/device/vr/README.md>
- Chromium on Linux, the developers' answer: <https://groups.google.com/a/chromium.org/g/chromium-dev/c/Kwwr0rQ9mKc>
- Unofficial Linux patch: <https://github.com/mrxz/webxr-linux/>
- Monado at FOSDEM 2026: <https://fosdem.org/2026/events/attachments/T38AKM-monado-and-beyond/slides/266219/monado_an_tfzl8ak.pdf>
- Wolvic: <https://github.com/Igalia/wolvic>, and its Chromium version: <https://www.uploadvr.com/wolvic-switching-to-chromium/>
- Steam Frame, for developers: <https://partner.steamgames.com/doc/steamhardware/steamframe>
- Web views and headset sessions on visionOS: <https://developer.apple.com/forums/thread/749924>
