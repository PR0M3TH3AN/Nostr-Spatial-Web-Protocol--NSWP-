# What changed

Newest first. Version numbers are the spec's. Section numbers (§) are `spec.md`'s.

## 0.10.3

A terminal on your own computer, from a panel in your home. Stage A3 of [`browser/spec.md`](browser/spec.md). Nothing a world implements changes.

- **The Bridge** ([`browser/bridge.md`](browser/bridge.md), `packages/bridge`): a small program a person runs on their own computer. It answers one Nostr key, its owner's. The home and the Bridge find each other with sealed notes through relays, as two visitors in a room do, then talk directly.
- **A grant** (kind 27302): the owner's signed word that one throwaway session key may open a terminal on one Bridge, for five minutes, once. It has its own kind and names a Bridge, never a site, so a pass a world holds opens nothing, and a grant is worth nothing to a world. Schema and vectors beside the others.
- **It asks at the computer.** Before a terminal opens, the Bridge asks on its own screen and shows four digits both ends work out from the grant. No page can answer for the person there. `--allow-for` loosens that, knowingly.
- **Anyone else is refused before anyone is asked:** another key, the Bridge's own key, a pass, a grant for another computer, an old grant, a grant sent twice. A stranger gets one reply, however often they ask.
- **A terminal panel** in the SDK (`nswp-sdk/terminal`, its own entry, so nothing else pays for the emulator). It shows each stage of connecting, with the code. Press it to type: a real keyboard anywhere, and in a headset the kit's drawn keyboard in a new mode with Esc, Tab, Ctrl and the arrows, every key sent as it is pressed.
- **One terminal at a time, and never locked out.** The owner asking again, and being let in, takes the place of a terminal left open by a closed page. A home that goes quiet for a minute is hung up on.
- **Found by trying it:** a reply was not tied to the request it answered, so an answer to an earlier request could be taken for an answer to this one. Every reply now names its request. And the Bridge did not notice a page that had simply gone, which is where the two rules above came from.
- **The Bridge says whether a home can find it** ("Listening on 4 of 4 relays"), tells someone who ran the example as written that they did, and makes nothing on disk until the command it was given is a good one. All three came from the first real run.
- **Status (2026-11-18):** built, and BitPortal's side deployed: the live room offers **Your computers**, a pairing link opened by someone not signed in asks them to sign in and adds nothing, and the terminal's code is fetched only when a terminal is opened. Tried with throwaway keys and a relay on one machine, from BitPortal's room in Chrome: a computer added from its link, the same code on the panel and at the computer, commands typed on a flat screen and on the drawn keyboard in an emulated Quest 3, and a second key refused with nothing opened and nobody asked. The owner's own Bridge has been started with a real key and reaches the four public relays. **Not tried:** a terminal opened by a real sign-in, a real headset, two networks, macOS. The Bridge is not on npm.

## 0.10.2

A keyboard and a library, so a headset is no longer the place where a visitor can only move things about.

- **A keyboard drawn in the scene** (`panels.keyboard`). Keys are pressed with a select, so it works on every headset. A real keyboard and a paste type into it too, and nothing behind hears them. Where a headset's browser offers its own keyboard to a page, one key hands over to it.
- **A library** (`panels.library`): the pictures and video of the visitor's own that their browser keeps, on a board to choose from in the headset. A page can't show a device's files; it can show what it was given.
- **The camera** can hand everything it takes to the library (`onCapture`).
- **Found by trying it:** the keyboard comes up where the console's own button sits, and the button was taking the presses. The keyboard is asked first now, and the console steps aside while it is up.
- **Status (2026-11-18):** built and deployed to BitPortal and the seven worlds. On the live BitPortal room, inside an emulated Quest 3: a note typed by pointing and on a real keyboard and hung; a picture taken with the camera and found in the library, chosen from the board and hung; and all of it there on the next visit. Only BitPortal's own site was asked for anything. The headset's own keyboard has been tried nowhere, and none of this on a real headset.

## 0.10.1

Panels. No change to any format: this is the SDK, and the first stage of [`browser/spec.md`](browser/spec.md).

- **`browser/spec.md`**: a plan for a browser of the visitor's own, beside the protocol and not part of it. What only a browser can do, the bridge a page asks through, which engine fits which device, and a staged plan that starts in BitPortal Web.
- **`createPanels`** in the SDK: a note, a picture or a video in a frame a visitor can hang anywhere. Dragged by its bar on a flat screen; taken with a grip or a pinch in a headset; made smaller, larger or put away with a select. Kept in the visitor's browser where the page asks, with files of their own.
- **A panel is never another website.** The kit draws what it shows.
- **Grabbing** gains `pull: false`, for something large that should stay at arm's length instead of coming to the hand.
- **The Workshop** has a panel to try.
- **Status (2026-11-18):** built and deployed. On the live Workshop: its panel dragged by the bar on a flat screen, and in an emulated Quest 3 made larger with a select and taken by the bar with the grip. Not on a real headset, where the first thing to judge is whether a note's text is sharp enough to read. The world template is not wired for panels yet.

## 0.10.0

Crossing from one world to another, with as little asked as a browser allows, and the same room at both ends.

- **A count, and rules to keep it** ([NSWP-02](protocol/02-doors.md), "How many actions a crossing takes"). In a headset a crossing is three actions at most: leave, confirm, go back in. Two to a world the visitor approved before, one where a browser carries the session over. A world leaves at once with no confirmation of its own; an Airlock asks one thing; a world asks for nothing on arrival but the way back into the headset.
- **`xr=1`** on a door's address, and **`immersive`** in the arrival context: the visitor left a headset session to make this trip. The destination uses it to put **Enter VR** first, large and alone, before it has finished loading.
- **The chamber.** A small round room in the SDK (`createCrossing`). Walls rise round a visitor as they leave; they arrive standing in it, and its doors open onto the new world when it is ready. It is scenery and proves nothing, and the rules say so: nothing to press, no claim of verification, never a delay.
- **`sessiongranted`** is listened for. Where a browser gives it, nothing is asked on arrival. Few do, and none has been tried.
- **Status (2026-11-18):** built and deployed to BitPortal, the seven worlds and the Starter Home. One whole crossing was run on the live sites in an emulated Quest 3: from BitPortal's room in a headset session, through a door (one action), the Airlock told `xr=1` and reading large (Continue, the second), to the Grove, where **Enter VR** was first and focused and the chamber's doors waited for it (the third), then opened in the headset; and home again in one action, into the chamber in BitPortal's room, facing the door left through. The two sites were the only hosts asked for anything. **Not tried:** any real headset, and `sessiongranted` on any browser.

## 0.9.1

Hands in a headset. No change to any format: this is the SDK, and three lines in what a world owes.

- **An input layer of our own** (`createXrInput`), on the WebXR standard and nothing else. It reads any tracked controller through the layout WebXR already fixes, so nothing knows a make or a model. Sticks turn and step; a grip or a pinch picks things up, near or from across a room; B or Y opens the console; the hand buzzes where it can.
- **Comfortable unless asked.** Turning and moving are in steps by default. Smooth walking and turning are a visitor's choice under Moving, with a darkened edge to the view, kept in their browser for that site.
- **Drawn here, downloaded from nowhere.** Controllers are one plain model for every make, and tracked hands are their joints. A request for a controller's model would tell its host which headset each visitor owns.
- **What a world owes** ([NSWP-09](protocol/09-what-a-world-owes.md)) gains three lines: sticks, grips and buttons are extras and never the only way; nothing slides unless the visitor asked; no request says what a visitor is holding.
- **Not adopted:** Meta's Immersive Web SDK. Its input manager is good, but it needs three.js swapped for Meta's fork at the root of every world. The door stays open: `actions.ts` is small and separate.
- **The Workshop** has three things to pick up. The headset checklist has a section for all of this.
- **Status (2026-11-18):** built and deployed to the seven worlds, the Starter Home and BitPortal's room. Driven in an emulated Quest 3 only: every row of the table in `docs/controls-kit.md` on a local build, and on the live Workshop, Starter Home and BitPortal room a stick's step, a turn with its buzz, the menu button, a grab that goes home, and the switch to tracked hands. Each page asked its own site for everything. Not on any real headset.

## 0.9.0

Who someone is ([NSWP-10](protocol/10-identity.md)). Until now everyone in a room was a guest, and a name or a mark proved nothing.

- **Passes are built.** At the Airlock, the visitor's own client makes a throwaway session key and signs a pass with their identity key: "at this site, until this time, this key speaks for me". The world gets the pass and the session key; the identity key never leaves the client. This is §9.2 as designed, with one difference: there are no room events yet, so a pass is good in any room at its site.
- **A name is shown only when it is proved.** A pass may carry the name its owner chose, so showing it needs no request to anyone. A guest can't choose the text they are shown by.
- **The mark, honestly.** It is fifteen bits and proves nothing alone. A member whose pass checks out wears their identity key's mark, drawn with a lit frame. A look whose seed is someone's key is not honoured without a pass for that key.
- **In a room** a pass travels member to member as `id:<pass>`, never through a relay, and counts only if it names the session key the member's handshake was signed with.
- **The arrival context** gains `pass` and `sessionKey`, which travel together or not at all.
- **The library:** `buildRoomPass`, `verifyRoomPass`, `cleanName`, `claimsKey`, `encodeNpub`; a schema and twelve vectors. **The SDK:** `arrival.identity()`, and rooms that check passes.
- **What going by name gives away** is written down, for a client to say before the first time: the world and everyone in the room learn the key, with the visitor's IP address, and a pass can't be taken back.
- **Status (2026-11-18):** built and deployed. On the live sites, in headless Chrome: a visitor went from BitPortal's Airlock to the Grove by name, with a throwaway test identity (`?signer=test`), and a guest in the same private room saw them by that name, proven, wearing that key's mark with its frame; the named visitor saw the guest as a guest. The address was scrubbed on arrival and the pass kept for the tab. **Not tried:** a real BitLogin session signing a pass, which needs a person. **Found:** a private room's name (`#room=`) doesn't travel through the Airlock, which keeps a world's address as announced. That is the arrival context's `room` field, still proposed.

## 0.8.3

How worlds are found, beyond one client's own list ([NSWP-08](protocol/08-lists.md)).

- **Lists are a format of their own now,** with a reader and a writer in the library (`parseListEvent`, `buildListEvent`), a schema and test vectors. A reader keeps a list's worlds in order, passes over anything on it that isn't a world, and stops at 200.
- **Following a list.** A list is followed by its coordinate, shared as an `naddr`. A newer copy counts only if the same key signed it. Whose lists a visitor follows stays with them.
- **Worlds nobody has listed.** The rules for a client that shows them: kept apart and labelled, shown when the visitor asks, pictures held, a limit on what one key can take up, and no second claim on an address the visitor already has a door to.
- **Asking to be listed** needs no message: announcing a world is the request. `nswp worlds --verify --not-on <list>` is what a curator reads.
- **The tool** signs lists (`nswp sign-list`) and validates them.
- **Status (2026-11-18):** built and deployed. On the live lobby, in headless Chrome: the find bar, and BitPortal's own list looked up by its address on the public relays. The page contacted its own site and relays and nothing else. Following someone else's list was tried only against a stand-in relay, since nobody else has published one. No world outside this project has announced itself yet, so the shelf of unlisted worlds is empty.

## 0.8.2

No change to the protocol. How it is written down changed.

- **Protocol documents.** `protocol/` holds nine short documents, one per part of the protocol: worlds, doors and the Airlock, arriving, previews, looks, rooms, homes, lists, and what a world owes a visitor. Each says what is implemented and what is only proposed, and points at its schema, its test vectors and its code. They are what an implementer reads. `spec.md` remains the full design, with the reasoning.
- **Written down for the first time:** exactly how a look is generated from a key, and what the members of a room send each other (the handshake, the 88-byte position packet, and the `look:` and `rec:` messages). These existed only in code.
- **Looks have a schema and test vectors** (`schemas/look.schema.json`, `vectors/looks.json`), so a second implementation can check it draws the same figure from the same key.
- **This change log** moved out of the front of the spec.
- **A test** checks that every protocol document states its status and that everything it links to exists.

## 0.8.1

The first of the things people do together, and the first that needs no account.

- **A camera of the visitor's own** in the controls kit: a picture, a selfie, a clip of up to thirty seconds, saved to their device. Nothing is sent anywhere.
- **Recording is said out loud** (§21.3). A member who records a clip tells the others, and each sees a light on the recorder's figure and is told once. It is said over the connection the members already share, and again every two seconds while it is true, so a lost message can't leave the light stuck on or off. An honest client says so; nothing can make a dishonest one.
- **People**: a list of who else is in the room, and a way to point one of them out.
- **What comes next, and where it can live.** Names, profiles, a feed, messages and notifications need a person's key. A world is someone else's website, so those belong in the visitor's own client and reach a world only by a hand-off, the way a door goes through the Airlock. Not designed in detail yet.
- **Status (2026-11-18):** built and deployed. On the live sites, in headless Chrome: a picture, a selfie and a clip taken in the Grove, in BitPortal's room and in the Starter Home; and two visitors in a private room in the Grove, where one recording a clip put "recording" beside their name in the other's People list, told them once, and cleared when it stopped. Not tried in a headset, where a clip can't be recorded at all.

## 0.8.0

Avatars are worked out in detail (§4.2). The earlier sketch had two colours, three heads and five accessories.

- **A look**: three colours and one choice from each of eight closed lists (build, head, face, accessory, body, shoulders, pattern, finish). It is data, never a file.
- **Everyone has one already.** A key generates its own look, the same in every world, with nothing published. Choosing a look overrides parts of the generated one.
- **A mark that isn't a choice.** A five-by-five pattern from the key, on every figure. It follows a person through any change of clothes, and a copied look comes out with the copier's mark.
- **How a look travels**: by key, by the avatar event, inline in the arrival context for a guest, or in a room's hello. And the cost said plainly: a look that is the same everywhere makes its wearer recognisable everywhere, so the Airlock offers going plain.
- **What a world may change**: draw it as it is, re-dress it in its own material and palette, recast it as something of its own, or ignore it. A world that tells visitors apart at all should keep the mark.
- **Built:** the format in `@nswp/core`; a figure in the SDK that draws any look and can be re-dressed; looks carried in the arrival context and between a room's members; and in BitPortal an editor, the visitor's own figure in their room, and the Airlock's choice. **Not built:** publishing a look for someone signed in, proof of a key behind a mark, and an editor usable inside a headset.

## 0.7.9

No change to the protocol. The reference app and its worlds get real addresses and real jobs.

- **Addresses under `bitblocks.network`.** BitPortal is at `portal.bitblocks.network`, and each world at a name of its own (`gallery`, `grove`, `tour`, `arcade`, `observatory`, `workshop`, `library`, `starter`). The worlds send visitors through BitPortal's Airlock by default, as §6.2's example always showed. The old `vercel.app` addresses send visitors on to the new ones.
- **Every world is for something.** The two test worlds became the Gallery (sculptures made in code) and the Grove (somewhere to sit and talk). Five are new: the Tour (five stops for someone's first minute), the Arcade (a small game), the Observatory (a terrace for looking at the sky), the Workshop (every part the worlds are built from, named) and the Library (eight notes on why it is built this way). The Starter Home is the world template, deployed unchanged. Each has two doors to others, and all eight are in BitPortal's room.
- **The worlds share one harness** (`sites/shared/world.ts`): several doors, each showing where it leads; stepping by pointing at the floor; signs; where a visitor may stand. The Gallery and the Grove keep their identities (`d`), so doors saved to them still lead there.
- **A caution kept in mind.** All of these sit under one registrable domain with BitLogin's sign-in page, which browsers treat as the same site. That is acceptable because they are all ours and set no cookies. A world made by anyone else does not belong under `bitblocks.network`.
- **Live.** All nine sites answer at their new addresses, and the old `vercel.app` addresses redirect. The eight worlds' announcements are on six public relays, and `nswp check` reports each as verified for its site. BitPortal's starter list and its four listings, signed again by the curator, are on the same relays. `bitblocks.network` lists BitPortal, marked experimental. On the live sites, on a flat screen: from BitPortal's room through the Airlock (which shows "Verified") into the Tour, through the Tour's door and the Airlock into the Gallery, and Home back to the room, with the arrival context read and scrubbed each time. Not tried: a real headset; BitLogin sign-in at the new address; and doors saved at the old address, which stay there, because a browser keeps them per address.

## 0.7.8

No change to the protocol. The reference places are modelled now, not stacked from boxes (`docs/grid-look.md`).

- **A modelling kit in the SDK.** Shapes are made in code the way a modeller makes them: boxes with bevelled edges and panels pressed in, profiles swept along a path or turned on a lathe. Everything that stays still in a place is one mesh, drawn in one surface shader with no lights. The doorway's frame, walls, furniture, sculptures, trees and a visitor's figure are parts made with it, and a world can use them or make its own.
- **A sky worth looking at.** Another world hangs low in it, ruled with the same grid, with lights on its night side and rings its shadow falls across. Behind it: stars, one faint band of them, and constellations drawn like a map of a network. Every world's sky is arranged differently. The skyline is modelled towers and, far off, great arches.
- **Deployed and published.** BitPortal, both reference worlds and the template demo are deployed in this look. The reference worlds' preview pictures were retaken and their announcements signed again; the new announcements are on six public relays, and `nswp check` reports both as verified. On the live sites, on a flat screen: from BitPortal's room, through the Airlock (which shows World A as verified), into World A with its arrival context read and scrubbed. The template demo's announcement is still unpublished. No real headset has drawn any of this: the pictures come from a software renderer, and frame rate on a headset is unmeasured.

## 0.7.7

- **How a world's own interface and the traveller's controls share a screen** (§21.3, new). There is no layer above a world, so the controls are a short list of things every world agrees to offer, drawn by the world. The world leads; they stay out of its way and are never more than one action off.
- **The controls kit has three levels** to match: full, quiet (one mark in a corner) and hidden. A world can place it, change or switch off its keys, and claim all input during play.

## 0.7.6

No change to the protocol. How the reference places are drawn changed (`docs/grid-look.md`).

- **One look for the reference places:** a dark plane ruled with a grid of light, a skyline of blocks, and furniture built from dark blocks with lit edges. BitPortal's room and site, the reference worlds, and a home drawn by the SDK share it from one copy in the SDK.
- **The reference worlds have arched doorways** (§6.7), like everything else. Their preview pictures were retaken and their announcements signed again.
- **Deployed and published.** BitPortal, both reference worlds and the template demo are deployed in this look. The reference worlds' new announcements are on six public relays, and `nswp check` reports both as verified. On the live sites, in the emulated headset: from BitPortal's room, through the Airlock, into World A, and back to the room from its console. The template demo's announcement is still unpublished. No real headset.

## 0.7.5

- **One controls kit for every world** (§21.2, `docs/controls-kit.md`). A world lists what a visitor can do once. The SDK draws that list as a HUD on a flat screen and as a console in a headset, on the wrist where a hand is tracked. The template, the reference worlds and BitPortal's room all use it, in place of four hand-written sets of buttons.
- **A visitor can change how the controls look**, and each site remembers their choice. Whether a look should follow them between worlds is a new open question (Q32).
- **Deployed** to BitPortal, both reference worlds and the template demo. On the live sites, in the emulated headset: from BitPortal's room, through the Airlock, into World A, where the console's Back to your lobby returned to the room. The wrist gesture and a controller's ray on the console have been tried only in the emulator, driven by a script.

## 0.7.4

- **A world's controls must be reachable in a headset** (§21.2). In an immersive session the page is gone, and its buttons with it. The SDK has a menu that goes in the scene, and the template, the reference worlds and BitPortal's room use it.
- **The way home works in VR, and the reference worlds have one** (§6.3).
- **BitPortal's room works from a chair** (§14.1): Turn around, stepping, and larger buttons clear of the doors.
- **A headset checklist** (`docs/headset-checklist.md`), to run the first time anyone has a headset on. Nothing has been.

## 0.7.3

- **The start room is built** (§14.1), in BitPortal's walk-in page: two walls of doors, the visitor's own ahead and suggested ones behind.
- **Saving a place needs no sign-in** (§8.3, §14.1). A client may keep a visitor's saved places on their device, and BitPortal does. Each saved door keeps its place on the wall for as long as it is saved.
- **The world template was tried by AI assistants** (§19.1, §20 Phase 4c). Three trials. Every rule held, including when the request asked to break one. The gap was that an assistant can't see what it builds, and the template now gives it a way to.
- **The standard portal is an arched doorway** (§6.7): the same shape in BitPortal, in a home and in a world built from the template.

## 0.7.2

- **The world template is built** (§19.1, §20 Phase 4c), in its own `nswp-world-template` repository, with a demo deployed from an unchanged copy.
- **Home layouts are in the library** (§4.5): building and reading kind 37302, with a first built-in catalogue of eight items and two room templates. The SDK draws one.
- **Going home works** (§6.3): `portal.home()` is in the SDK, and BitPortal's Airlock takes a visitor to the lobby when opened with no destination.

## 0.7.1

Design only. None of it is built.

- **Where a visitor starts** (§14.1): BitPortal starts everyone in one room, drawn by BitPortal itself. The visitor's own doors are on the wall they face, and suggestions are on the wall behind them. On a desktop or phone the start is the flat list, in the same order.
- **Going home** (§6.3, §6.6): an Airlock opened with no destination takes the visitor to their client's start place, and the SDK gets `portal.home()`.
- **Saved places stay private** (§4.5, §14.1): guests in a home see only the doors its owner placed in the public layout. Saved places are drawn by the owner's client, for the owner alone.
- **Invitations arrive as portals** (§8.4), at one fixed spot, and only from people the visitor follows.
- Saved doors and a jump list move forward into Phase 3a, because they need only sign-in and bookmarks.

## 0.7

Three additions and one correction. None is built yet.

- **Items** (§10.4): a thing is described once by a signed event from its maker, with a 3D file, a size, simple collision shapes and named animations. A home layout places items by reference, in metres from the home's origin. Items carry data and never code.
- **Items you hold and carry** (§10.5): a maker can grant an item to a person, and that person can carry it into worlds that agree to draw it. Anyone can check who made it and who it was given to. The protocol does not make items scarce or resellable.
- **A world template** (§19.1): a repository to copy, with the protocol's plumbing already done, whose starting scene is a home you host yourself.
- **Correction:** 0.6 said version one of homes has no custom 3D models. Custom models are now allowed as items, under ceilings, when the renderer chooses to draw them (§4.5).
- New phases **4c** (world template), **8b** (items) and **8c** (granted and carried items). Existing phase numbers are unchanged.

## 0.6.1

- **Previews are built** (§5.8, §20 Phase 1b). The library reads and checks them, the SDK captures one and draws one through a portal, both reference worlds have one, and BitPortal shows them in its list and its hall.
- **A portal's view is widened from a distance** (§5.8, "Drawing one"). A true window seen from across a room shows a sliver too narrow to recognise.
- **BitPortal mirrors previews itself** and fetches nothing else while a world is only listed, which is stricter than §5.8 requires.
- **Both Airlocks now say what kind of place a destination is** (§6.7).

## 0.6

Four additions, each with a stated limit. None is built yet.

- **Who owns what** (§3.2): the rule for what belongs in the protocol, and a table of what each party owns.
- **Previews** (§5.8): a world can publish a 360° still of its entry point, so a portal looks into the place it leads to. Previews are fetched by hash, never from the world's own server, and are shown automatically only for worlds the visitor's own choices brought in.
- **What every portal shows** (§6.7): the minimum a door, a portal or the Airlock must display, and how ordinary web pages are handled.
- **Avatars in three tiers** (§4.2): generated, simple and model. The protocol does not define an avatar customization system.
- **Homes** (§4.5, §7.5): a user-owned place described by a signed layout event and drawn by any renderer. Layouts place items from a fixed catalogue; they are not a scene format.
- New phases **1b** (previews) and **8** (chosen avatars and homes). Existing phase numbers are unchanged.

## 0.5.2

- **Phase 2 is started** (§20): BitPortal has a sign-in page using a pinned BitLogin build, and a page for announcing a world. Neither has been tried with a real account yet.
- **BitLogin's build is now pinned by hash** (§21.1). Rebuilding it from source is byte-identical and matches the live site, which settles which of the builds in circulation is the real one. BitLogin's own release-manifest script is merged, and BitPortal's pin points at BitLogin's `main`.

## 0.5.1

- **The walk-in lobby is built** (§20, Phase 1): BitPortal's doors as a hall, usable in a headset, with a shared room. The avatar and voice code moved into the SDK as `nswp-sdk/three` so worlds and BitPortal share it.

## 0.5

- **Phase 1 is built** (§20): BitPortal's read-only lobby and its own Airlock, in a separate `bitportal` repository, deployed at `portal.bitblocks.network` (first at `bitportal.vercel.app`, which now sends visitors on).
- **Rooms that outlive their host** (§9.10): a heartbeat so a dead room stops reading as live, succession so a room survives its host leaving, and a salted fingerprint of the guest list for private rooms. All three are taken from COMBATRIG, where they were worked out in play.
- **Found while building the lobby:** a shelf can't require "verified" without contacting every listed world (§14); a site that hasn't adopted NSWP gets a plain visit with no arrival context (§4.4); the Airlock knows the starter set's worlds without asking a relay (§6.2).

## 0.4.1

- **The rooms spike is built** (§20, Phase 4b): a guests-only, peer-to-peer room with avatars and voice in both reference worlds. Its findings are recorded in §9.4 and §9.8.

## 0.4

**Shared rooms** (§9): how two or more people share a world, without requiring anyone's server.

- A room's traffic travels **peer-to-peer** between participants, or through a **hosted** room server that anyone can run. Identity, access rules, moderation, invitations and the developer's code are the same either way, and a room can be promoted from one to the other while it is running.
- Rooms are described with the existing NIP-53 room event (kind 30312).
- **The room pass** (§9.2) lets a world prove who is in a room without ever holding the user's signer.
- Access can be open, by invitation, by a Nostr list of people, by the host's follows, or by ticket (§9.3).
- New phases: **4b** (peer-to-peer rooms) and **7** (hosted rooms). Existing phase numbers are unchanged.
- Rooms are not built yet. The Phase 0 library, schemas and vectors cover the 0.3.1 formats; room formats get their own fixtures in Phase 4b.

## 0.3.1

- **Phase 0 is built** (§20): `@nswp/core`, the `nswp` CLI, the portal SDK, JSON Schemas, test vectors, and two reference worlds plus an Airlock, deployed for testing.
- **Real kind numbers**: 37300 for worlds and 37301 for avatars (§5.1), replacing the placeholders.
- **Curation uses NIP-51 curation sets (kind 30004)**, which already exist (§5.4).
- **Registrable domains must use the private section of the Public Suffix List** (§6.2). Building the Airlock showed that without it, every `*.vercel.app` site displays as the same domain.
- **Target devices** (§21.2), including Valve's Steam Frame.

## 0.3

0.3 is a review pass over 0.2. It corrects claims that were wrong or couldn't work, checks the BitBlocks sections against the block repositories (as of 2026-11-17), and fills gaps.

**Corrections**

| 0.2 said | Problem | 0.3 |
|---|---|---|
| Headsets sign in by passkey or by scanning a NIP-46 QR with a phone | A phone can't scan a QR shown inside a standalone headset. Passkey PRF support is uneven. BitLogin is password-first today and its NIP-46 sessions don't survive a reload | §13.1: set up on another device, then pair; pairing without a QR is an open design (Q12) |
| The source world "learns nothing about where they went" | The source world triggers the navigation, so it knows which portal was activated | §6.2 states exactly what each party learns |
| Users can choose their own Airlock | A world has no way to know which Airlock a user chose | §6.3: the arrival context carries a return Airlock address |
| Ordinary websites appear as floating windows | A web app can't render other sites inside an immersive session | §2: websites are cards that open in the 2D browser |
| The signed-out lobby uses a seed recipe, and there are no default moderators | Together these leave new users with an unfiltered feed of anyone who owns a domain | §15: a disclosed, replaceable starter set |
| BitFeed recipes can be shared as events | Publishing recipes over Nostr is planned in BitFeed's spec, not shipped | §14: JSON export and import until it ships |
| BitGate may not support origin targets | Confirmed: BitGate targets are user, event and address only | §15 and Q6 |
| World servers "check BitUnlock's signed entitlement" (no detail) | The real format is known | §16 describes the service-signed receipt and how to verify it |
| `["l", "en", "ISO-639-1"]` | NIP-32 requires the matching `L` namespace tag | §5.2 |
| One click crosses a portal | A crossing needs two gestures: one at the Airlock and one to start the next immersive session | §6.5, with a fast path for destinations the user already approved |

**Additions**

- Manifest serving rules (CORS, no redirects), tighter verification, publisher-change warnings and a listing opt-out (§7).
- Lobby network privacy: no contact with world origins until the user shows interest (§5.7).
- Relay strategy (§5.6).
- Airlock hardening: HTTPS-only destinations, registrable-domain display, the fake-Airlock threat (§6.2, §12).
- Entry assertion: fragment scrubbing, the non-repudiation caveat, behaviour for static worlds (§4.4).
- Device performance tier tag and world retirement (§5.3, §5.5).
- An adoption ladder for world creators, starting with zero integration (§19).
- Phase 3 is split so social discovery doesn't wait on BitGate's relicense (§20).
- Operator policy for a hosted instance (§15).
- Prior art to review (Appendix C).

---

# Part I — The Protocol (NSWP)
