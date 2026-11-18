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
   ([NSWP-02](../protocol/02-doors.md)). A browser owns the session, so it
   can keep it while the page underneath changes. One action: the door.
2. **An Airlock a world can't forge, inside the headset.** The Airlock is a
   flat page today because a world draws everything a visitor sees in VR. A
   browser draws above the world, where no world can reach. The check moves
   into the headset and keeps its meaning.
3. **An identity no world holds.** The browser keeps the visitor's signer and
   hands out passes ([NSWP-10](../protocol/10-identity.md)). Worlds get the
   pass, as now. Nothing changes for them.
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

## 3. The parts

```text
┌──────────────────────────────────────────────────────────────────┐
│ Shell      small, native, different on each kind of device       │
│            owns the headset session; draws the Airlock, panels   │
│            and warnings above everything; holds the signer       │
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
| `nswp.navigate(destination)` | Cross to another place. The shell shows its Airlock above the world and waits for the visitor |
| `nswp.home()` | Go to the visitor's home |
| `nswp.can(name)` | Whether this browser offers a feature |

A page is told nothing about the visitor by any of these. On arrival it gets
the same arrival context as today ([NSWP-03](../protocol/03-arrival.md)), with
whatever the visitor chose at the Airlock and nothing else.

### For the home only

| Group | Calls | Notes |
|---|---|---|
| Panels | `panels.open({ url \| media \| stream, place })`, `move`, `close`, `list` | The shell draws them. The home never sees inside one |
| Workspace | `workspace.save()`, `restore()` | Which panels are open and where, kept on the device |
| Identity | `identity.pubkey()`, `sign(template)`, `pass(origin)` | The shell holds the signer and shows what is being signed. A pass is made by the shell, for the world the visitor is going to |
| Programs | `bridge.pair()`, `list()`, `open(program)` | Section 7. Each returns a stream to put on a panel |

Rules:

- A call from any origin but the home's is as if the method didn't exist.
- Signing anything but a pass shows the visitor what is being signed, on the
  shell's layer, every time.
- Nothing here lets a page read a panel, type into one, or learn what is open.

### BitPortal Web without the browser

Every call has a fallback in an ordinary browser, written once in the SDK:
`navigate` goes to the Airlock page, `panels.open` with a web address opens a
new tab, identity comes from BitLogin. So the home is written against the
bridge from the start, and gains abilities when it finds itself in the
browser. This is built in stage A, before any native code exists.

## 5. A crossing, in the browser

1. The visitor selects a door. The world calls `portal.go()`, which calls
   `nswp.navigate()`. The session does not end.
2. The shell draws the chamber round the visitor and the Airlock on its wall:
   the real address, whether the site vouches for its announcement, how they
   will go (by name, as a guest, plain). This is the shell's drawing, so for
   the first time the chamber is part of the check instead of scenery.
3. For a world they have approved before, the doors close and open with a
   moment to cancel. Otherwise they select **Continue**.
4. The shell loads the destination underneath and grants it the session
   (the `sessiongranted` event, which the SDK already listens for). The doors
   open when the world has drawn its first frame.

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
  learn that one is open, or reach the Bridge.

A terminal that runs commands is the most dangerous thing in this document.
The Bridge starts with nothing shared, lists what it will run, and shows on
the computer's own screen when something is connected.

## 8. The plan

Each stage ends in something a person can use, and says what would stop it.

### Stage A: in BitPortal Web, now

No native code, and testable on the machine this is written on.

| | Build | Done when |
|---|---|---|
| A1 | **Panels** in the SDK: a surface with a frame, grabbed, moved, resized and put away. Pictures, video, and text the kit draws itself | A visitor in an emulated headset can place a video and a note, and find them there next visit. **Built and live** (`createPanels`; [`docs/controls-kit.md`](../docs/controls-kit.md), "Panels"), with a keyboard and a library of the visitor's own files in the headset. Tried in an emulated headset only |
| A2 | **The bridge, as a contract**, with its fallbacks. The home calls `nswp.*` and nothing else | BitPortal Web runs unchanged in behaviour, with every crossing and sign-in going through the bridge's fallback |
| A3 | **A terminal panel and the Bridge**, terminal only | The owner pairs a computer by key and runs a command from a panel in their home. A second key is refused |
| A4 | **A shared screen in a room**, to look at | One visitor shares a window; another sees it on a panel. Rooms carry sound and position today, so this adds video to the connection |

Stops if: text on a panel can't be made sharp enough to read in a headset.
That needs a real headset to judge, and is the first thing to test on one.

### Stage B: the desktop shell

| | Build | Done when |
|---|---|---|
| B1 | An Electron shell with BitPortal Web as its home and the bridge for real | Any website opens on a panel in the home, and the home can't read it |
| B2 | The shell's own Airlock, drawn above the page | A crossing from the home to a world shows the Airlock without leaving the 3D view |
| B3 | The signer in the shell | A pass is issued with no BitLogin widget on the page |

Stops if: off-screen pages are too slow to scroll and type in. Then panels
show pages at a lower rate, or the shell changes.

### Stage C: the headset shell

**Needs a headset.** Nothing in this stage can be judged in an emulator.

| | Build | Done when |
|---|---|---|
| C0 | Build Wolvic unchanged and run it | BitPortal Web's room and one crossing work in it as they do in Quest Browser |
| C1 | `nswp.navigate` and the shell's Airlock, in a fork | A crossing between two worlds keeps the session: one action, no flat panel |
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

- **Who may be a home.** Any origin the visitor types, or a short list? A
  malicious home gets the wide half of the bridge.
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
