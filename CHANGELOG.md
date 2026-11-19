# What changed

Newest first. Version numbers are the spec's. Section numbers (§) are `spec.md`'s.

## 0.26.1

One address on a development server, and a menu that says when a signer doesn't answer.

- **The development server has one address for each site** with `--lan --https`: `https` at the machine's address on the network, the same from every device. Plain `http`, `localhost` and `127.0.0.1` are sent on to it. Two addresses for one site were two sites to a browser: signed in at one and not the other, a room at one that a phone at the other never joined, and at plain `http` no signer at all, with nothing to say why.
- **A signer that was named and doesn't answer is said so.** Where a visitor's client named a signer and it can't be loaded (unreachable, or kept out by the browser), the menu's row reads "Signing isn't available: bitlogin.network didn't answer", and pressing it says what that means. Before, the row was simply not there. Where no signer was named, there is still no row.
- **In the kit:** `signer.unanswered`.

## 0.26.0

A visitor's signer is where their client says it is, and BitPortal says BitLogin.

- **[NSWP-03](protocol/03-arrival.md), [NSWP-10](protocol/10-identity.md):** an arrival may name the visitor's signer (`signer`, an `https` address with `signer/` and `connect/` under it). A client that names none keeps its signer beside its Airlock, as in 0.25.0. So the place a password is typed can be one small site that does nothing else, shared by every client and site that uses it.
- **The control says whose window will open:** "Sign in to sign notes, at bitlogin.network". An arrival is something anyone can write, so the address is shown before it is pressed.
- **In the kit:** `arrival.signer()`, `createWorldSigner({ under })`, and in the library `signerAt()`. A signer named outright (`at`) is used as it is; a client's own is followed to its copy on a development server.
- **In BitPortal:** its Airlock names `https://bitlogin.network/` in every arrival (its `INSTANCE.signer`). BitPortal has no signer of its own, and no page of it may be embedded by another site: the first version's two pages were never shipped.
- **In BitLogin** (its own repository, live at `bitlogin.network` since 2026-11-19): the signer, the sign-in window, and remembering a site for thirty days.
- **The development server** serves BitLogin's own site as the copy of `https://bitlogin.network`.
- **Still two sign-ins.** BitPortal itself is signed in to on its own page, with BitLogin's widget, as before: it needs more signed than a world may ask for (passes, a sealed settings note, announcements). Signing from a world is a second sign-in, at BitLogin's site. They become one when BitLogin can give an application its own permissions.
- **Not built:** a headset (no window can open in one), the engine script and the Godot addon, anything but a note and a reaction.
- **Status (2026-11-19):** BitLogin's part is deployed. BitPortal and the worlds are not. On the local server, through BitPortal's Airlock into a world: the arrival named BitLogin, the menu said so, the signer answered from BitLogin's copy, and its window asked for a sign-in on BitLogin's own page. **Not tried:** signing in (automation never does), so a note signed from a world through BitLogin's live site is the owner's to try.

## 0.25.0

Signing from inside a world: a visitor can post a Nostr note as themselves, and the world never holds their key.

- **[NSWP-10](protocol/10-identity.md), "Signing from a world":** a client that offers signing serves a hidden signer and a sign-in window beside its Airlock. A world embeds the signer and asks it. It starts locked in every world. The visitor unlocks it for one world in the client's own window, which shows that world's address as the browser reported it; then the signer signs notes and reactions for that world until its page closes, four hours at most. Everything else is refused, and a refusal never says why.
- **Nothing secret is typed into a world.** A world's page can read whatever is typed on it, so the password stays in the client's window, which the world can't read. Decided by the owner on 2026-11-19, with the rest of [`docs/plans/signing-in-worlds.md`](docs/plans/signing-in-worlds.md).
- **Every note signed for a world says so:** the signer adds `["nswp:world", "<origin>"]`, sets the time itself, and signs at most six a minute and sixty an hour for one world.
- **In every world's menu:** "Sign in to sign notes", under You. In the room's chat, once unlocked: "Post what I write as Nostr notes", off at every visit.
- **In the kit:** `worldSigner()`, `createWorldSigner()`, `signerAction()`; in the library `signClass`, `prepareForWorld`, `signerAddresses`, `createSignGate`, and the two message formats. A world's security policy gains `frame-src 'self' https:`.
- **In BitPortal:** the signer page (`/signer/`) and the window (`/connect/`). The signer is the one page another site may embed; every other page still may not be. The key moves from the window to the signer inside BitLogin's crypto workers, and what arrives can only sign.
- **In BitLogin:** a signer hand-off (`docs/sign-in-window.md`). On a branch of its own: BitLogin's site is deployed when it is merged, so that waits for the owner.
- **The development server** sends each page the headers its build wrote for it, where it sent one set to all.
- **Not built:** a passkey, a browser extension or a phone as the way to unlock; the offer of a passkey after a password sign-in (BitLogin can't add one to an existing account yet); anything asked for every time (a profile, a follow list); payments; signing from a headset; the engine script and the Godot addon.
- **Status (2026-11-19):** not deployed, and BitPortal's part is not merged. Tried in Chrome on the local server, with a world on one site and BitPortal on another, the walls between sites' storage on, a throwaway identity, and stand-ins for every relay: the signer refused while locked; the window showed the world's address and offered Allow; the world could read neither the signer nor the window; a note was signed, marked for the world, and came out of the chat; a profile, a follow list, a private message, a pass and application data were refused; the seventh note in a minute was refused; locking from the menu ended it. **Not tried:** a real BitLogin account (automation never signs in to one), Firefox and Safari with BitPortal's own pages, a phone, a real relay.

## 0.24.0

Profile cards, and a sound when someone writes.

- **[NSWP-10](protocol/10-identity.md), "Who someone is":** choosing a person, from People or by the picture over their head, shows a card about them: their picture, their name, whether they came by name or as a guest, the short form of their key with the whole of it to copy, and what they wrote about themselves. Muting and blocking are beside it. It is the same card in the menu on a desk or a phone and on the console in a headset.
- **A pass may carry `about`:** the start of what the visitor wrote about themselves in their Nostr profile, put there by their own client and signed with the rest. One line of plain text, 280 characters at most, cleaned again by whoever reads it. It is their own words and is drawn as a quotation, never as a fact: anyone can write anything about themselves. A world still never asks a relay about a visitor.
- **A sound when someone writes** (`chat`), made in the browser like the other defaults: two soft low syllables, two octaves under the kit's own notice. It is heard from where the writer stands: quieter and duller the further off, to the side they are on, and never silent. It follows the visitor's effects volume, a world can replace or silence it, and it isn't played while they have written chat off. No sound file was added.
- **In the kit:** `Member.about`, a `card` on any section of the menu (`UiCard`), `presence.whereIs()`, `sounds.play(cue, { distance, pan })`, `heardFrom()`, and in the library `cleanAbout`, `cleanLine`. The signal that opens the chat panel is now `toggle:chat`, since `chat` is a cue.
- **In BitPortal:** a profile's `about` is read with its name and picture, and goes on the pass of someone going by name.
- **Not built:** a web address or a NIP-05 name on a card (a NIP-05 name on a pass would be the holder's own claim; checking one tells the domain who is looking), following or messaging from a card, cards on BitPortal's own pages.

## 0.23.0

Speech bubbles and a chat panel: the people in a room can write to each other.

- **[NSWP-06](protocol/06-rooms.md), "Words":** a new message on a room's channel, `say:<id>:<words>`. It goes straight from one browser to the others, as a pose does: no relay sees it, nothing signs it, and nobody keeps it. A line carries no name: who wrote it is whoever holds the connection it arrived on, shown by the name the room already knows them by. A reader makes it one line of plain text, drops what reorders or hides text, cuts it to 240 characters, and takes no more than five from one member in ten seconds. An older client ignores the message, as it ignores anything it doesn't know.
- **Over their head:** what someone writes is drawn in a bubble over their name (and their picture) for a few seconds, longer for more words.
- **A chat panel, the same in every world.** On a desk it is at the right-hand side of the screen; on a phone, across the bottom. Put away, the newest lines pass by for a few seconds. **Enter or T** opens it to write in, Enter sends, and Enter on an empty line or Escape puts it away. Nothing typed in it walks anybody anywhere. In a headset it is a panel of the visitor's own, pinned beside them, whose one button puts up the keyboard with its Speak key. `Chat` is on the taskbar once a room is joined, with a count of what hasn't been read.
- **Seeing chat is the reader's to turn off** (`room-chat-show`, "Written chat"). It is a setting that travels, `chat`, so off stays off in the next world. Nobody is told.
- **In the kit:** `session.say()` and the `said` event, `controls.chat`, `hud.setChatOpen()`, `controls.setKeys({ chat })`, `createPresence({ bubbles: false })`, `showsChat()`, and in the library `cleanChat`, `buildSay`, `parseSay`, `createChatGate`, `CHAT_LIMITS`.
- **What this is not:** notes on Nostr. Nothing is published or signed with the visitor's key, and nobody outside the room can read it. Writing and reading notes from inside a world needs the visitor's key to sign, which a world is never given, so it waits on in-game signing (`docs/plans/in-game-identity.md`).
- **Not built:** a sound when someone writes (no sound is added without the owner having heard it), links in a line, history for someone who joins late, chat in the engine script and the Godot addon.
- **Status (2026-11-19):** not deployed. On the local server in Chrome, with throwaway identities: two visitors wrote to each other with a real keyboard, each saw the other's line over their head and in the panel, markup arrived as text, the sixth line in ten seconds was refused, chat turned off showed nothing, and leaving forgot every line. A phone-sized window showed the panel across the bottom. In a made-up headset (IWER) the panel opened pinned, the keyboard came up from its button, and what was typed reached the other visitor. **Not tried:** a real phone's on-screen keyboard, a real headset, the Speak key, two people on different networks.

## 0.22.0

Nostr names and pictures, first class.

- **[NSWP-10](protocol/10-identity.md), "Pictures":** a pass may say where the visitor's picture is (`picture`, an `https` address): the one in their Nostr profile, put there by their own client and signed with everything else. A reader shows it over their name as a small round badge. It is a button: choosing it chooses the person and puts what can be done about them in front of the visitor. A guest has none, and a world never asks a relay about its visitors.
- **Seeing pictures is the viewer's to turn off.** A picture is fetched from wherever its owner keeps it, which tells that place the viewer's address, as reading Nostr anywhere does. `pictures` is a setting that travels ([NSWP-11](protocol/11-the-visitors-console.md)), on unless they turned it off, with a switch under People in every world.
- **In the kit:** `Member.picture`, `presence.personAt()` and `pressAt()`, `loadPicture()` (https only, nothing sent with the request, a size limit, redrawn small), `showsPictures()`, and `controls.signal("show:<section>")` to bring the menu up on a section. The reference worlds and the template press a picture like anything else pointed at.
- **In BitPortal:** people are shown by the name they chose on Nostr, never by a string of hex: the visitor themselves on every page, and whoever signed a list or announced a world, with the short form of their key beside the name where which key it is matters. Profiles are kept in the browser and asked for again in the background. The visitor's own picture is on the sign-in page and beside their name. Their own room signs a pass for itself, so people sharing it see each other's names and pictures. Settings has the pictures switch.
- **Fixed in BitPortal:** the Airlock's line saying how a visitor was going read "as a guest" for someone going by name, until they touched the choice.
- **A limit:** a picture shows only if the place that holds it lets a web page read it. Most Nostr picture hosts do. One that doesn't is not shown, and nothing can be done about that from a page.
- **Not built yet:** speech bubbles, a chat panel, profiles beyond a name and a picture. This is the ground they stand on.
- **Status (2026-11-19):** not deployed. On the local server in Chrome, with the Airlock's throwaway test identity and one of a world's own images standing in for a picture: a guest saw the named visitor's name and picture over their figure, pressing the picture chose them and listed mute and block, and the switch turned pictures off. **Not tried:** a real profile picture from a real host, two real people, a headset.

## 0.21.1

A phone or a headset on the same network can sign in and enter VR on a development server.

- **The development server answers https** (`node scripts/serve-local.mjs --lan --https`), on the same ports as http, with a certificate made on that machine and kept outside every repository. From another device, plain `http://192.168…` is not a secure address, so a browser withholds its cryptography, the microphone and a headset session: nobody could sign in there, and BitLogin reported it as "Account not found or credentials incorrect".
- **Local copies may be https.** A page asks for the map of local copies when its host is local, over http or https, and a map may lead to an https copy on a local host. What makes a page local is its host: `localhost`, a loopback address, or a private network address. No real site is at one. Nothing else about the three limits changes ([local-server.md](docs/local-server.md)).
- **Each device warns about the certificate once,** and whoever holds it accepts it after checking the fingerprint the server prints. Passkeys still don't work on such a page: a browser refuses them where it was told to accept a certificate.
- **Status (2026-11-19):** tried on this machine only, in Chrome and Brave with the certificate accepted. **Not tried:** a real phone or headset.

## 0.21.0

Keeping worlds up to date, without a script they all load.

- **[NSWP-01](protocol/01-worlds.md), "Which kit a world was built with":** a manifest may say `kit`, the version of the kit the site was built with. A client may tell a visitor that a world's controls are older than its own, and that is all: it is never a warning, never changes whether a door opens, and never stops a crossing. A world that is behind is not a world that is broken.
- **The kit has a version** (`KIT_VERSION`, the spec's own, kept the same as this file's newest heading by a test). The reference worlds' and the template's builds write it into the manifest; the kit writes it on the page as it reads the arrival; `nswp check` says a site's beside the tool's own; the probe reads which kit is really running; the engine script has `NSWP.KIT`.
- **Updating is one step, and can be none.** The template has `npm run update`, which takes the newest kit and plumbing from the template's own repository and leaves the world's own files alone, and `npm run update -- --check` to ask without changing anything. A scheduled job opens a pull request when a newer kit is out, for the owner to read and merge ([keeping-up.md](docs/keeping-up.md)).
- **In BitPortal:** the Airlock says, under "More about this place", when a world was built with an older kit than BitPortal knows, or doesn't say. It changes nothing else.
- **What was not built, on purpose:** a copy of the kit that every world loads live from one address. Whoever controlled that address would control every world at once, an owner would have no say in what ran on their own site, and one outage would take every world's controls with it. What must always be current (signing in, a look, the Airlock, lists) is in the visitor's client already, so worlds get the newest of it the day the client does.
- **Status (2026-11-19):** not deployed.

## 0.20.0

What a visitor prefers, in every world.

- **[NSWP-11](protocol/11-the-visitors-console.md), "Settings that travel":** a filled screen and the intense way of moving are now standing preferences, not a record of what the visitor last did. `full` means "prefers a filled screen" and a new `intense` means "prefers the intense way at a desk". Every world they enter starts that way. Pressing Escape, or being on a phone for a while, changes nothing: only their own hand on the control does. Before, `full` was whether the screen happened to be filled as they left, so leaving fullscreen for a moment in one world left the next one unfilled.
- **Two new settings for a flat screen:** `look`, how fast the view turns under a mouse or a finger (0.25 to 3 times the world's own), and `fov`, how wide they see at a desk (50 to 110 degrees; left out, each world's own). Both have a control in every world's console (`look-speed` under Moving, `fov` under View), travel with the visitor, and are the same everywhere.
- **In the kit:** `desk.ts` (`lookScale`, `visitorFov`, `watchFov`, `addDeskControls`, `onDeskChange`); `prefersFullscreen()`; `addViewControls` adds the controls and keeps the camera to the visitor's width. **For other engines:** `NSWP.kit()` gives `lookSpeed` and `dragLook` already scaled and `fov`, read again on a `changed` event; the Godot visitor follows them.
- **In BitPortal:** Settings has "In every world": fill the screen, move the intense way at a desk, how fast the view turns, how wide you see. The Airlock starts from what the browser keeps for the visitor, so a door opened from the front page takes their preferences along. With "Keep my settings with my profile" on, they are in that note.
- **Status (2026-11-19):** not deployed. On the local server in Chrome: preferences set once in Settings; two worlds in turn each started the intense way and filled the screen at the first key, the second after fullscreen had been left with the browser's own exit in the first; then fullscreen and intense turned off and the speed and width changed in a world's menu, and the room at home started that way and kept it. The Godot example, arriving with preferences, started the intense way with its speed doubled and its width at 90°, and followed both as they were changed in its menu. **Not tried:** a real mouse by hand (whether "fast" feels right), Firefox, Safari.

## 0.19.0

One coherent "you": signed in everywhere, one look everywhere, and the same menu everywhere.

- **[NSWP-10](protocol/10-identity.md), "Signed in everywhere":** a visitor signs in once, in their own client, and is signed in wherever they go. No world has a sign-in of its own, so there is nothing to sign in to one by one. A client that does this says so where they sign in, with what it gives away, and puts the way out beside it. A pass still never goes to a site that hasn't proved who it is, and never on a link's word.
- **The place a visitor signs in may be somewhere to stand,** reached by the crossing's room like any other place, so nobody is dropped from a world onto a page. In BitPortal it now is: the room's ground and sky, the crossing's room opening as they arrive and closing as they leave, and BitLogin on a panel in front of them.
- **[NSWP-05](protocol/05-looks.md), "Changing a look":** "Change how you look" is in every world's console, under "You". Like signing in, it leaves for the visitor's own client (`who=look`, [NSWP-02](protocol/02-doors.md)) and brings them back wearing it. A world never edits a look and never sends one back: a look a world could write is a mark it could follow a visitor by. In BitPortal the look is changed in the room, from the menu, with the visitor's own figure standing there to show them: the same controls on a phone, at a desk and on a headset's wrist.
- **[NSWP-11](protocol/11-the-visitors-console.md), "What is in it":** one order for every menu and taskbar. The kit orders the things every place has (home, the headset, the room, the microphone, jump), so the first key is the way home in every world whatever order a world's code added things in. Sections have one order too, with Sound and Display in it. The section for how the controls look is now called "Display", since "your look" is how other people see you.
- **What was different and is now the same:** the seven reference worlds had "Home, Join", the template "Home, Doors, Join", and their Travel sections began with different things. The worlds had no Panels section and the template did. Sound came after Help. All of them now have the same things in the same places. A world with no room has no Join, and that is the only kind of difference left.
- **[NSWP-07](protocol/07-homes.md):** a world that can be a home offers the way to their doors to the visitor whose home it is, where every other world offers the way home, not beside it for everyone.
- **In the kit:** `portal.changeLook()`, `figureAction`, `STANDARD_ORDER`, `hud.setOpen(true, section)`, a swatch whose colour follows what it shows, and `leaving` on `addViewControls` may bring the crossing's room up first. **For other engines:** `NSWP.changeLook(state)` and a `figure` event (script version 6); `Nswp.change_look()` in Godot.
- **What this does not do:** draw the sign-in inside a headset session. An immersive session can't show a page, and a password is typed into one. From a headset the sign-in is seen on the headset's flat screen, and the world offers the way back into VR after.
- **Status (2026-11-19):** not deployed. On the local server in Chrome: from a world's menu by its crossing's room to the sign-in place and back; to the room to change a look and back wearing it; with the Airlock's throwaway test identity, by name with nothing chosen, and as a guest once "as a guest" was set; the menus of the room, eight worlds and the Godot example listed side by side. **Not tried:** a real BitLogin sign-in, a headset, a real phone.

## 0.18.0

Signing in from inside a world.

- **[NSWP-10](protocol/10-identity.md), "Signing in from inside a world":** a visitor no longer has to go home to sign in. Every world's console has a control under "You" that says who they are there ("You are a guest here. Sign in", or "Here as Alice. Switch profile, or go as a guest"). Pressing it leaves for the visitor's own client, which asks them on its own page, and brings them back to the same world: by name if they chose that, as a guest if not. A world still never shows a sign-in and never holds a key. The control is a door, and that is all it is.
- **[NSWP-02](protocol/02-doors.md):** a new flag on a door, `who=1`, which a world puts on a door back to itself. It is a request and nothing more: it signs nobody in, sends nobody by name and skips no check. A client with no sign-in ignores it.
- **A world's own door** is the announcement its manifest lists for its address (`doorFor` in the core, `portal.here()` in the kit), so the visitor's client can check it like any other and hand over a pass.
- **In the kit:** `portal.signIn()`, and the control comes with `addViewControls`, so a world built with the kit or the template has it with no code. The console has a standard "You" section, second after Travel. **For other engines:** `NSWP.signIn(state)` and an `identity` event (engine script version 5); `Nswp.sign_in()` in Godot. A world may draw the button anywhere in its own interface: `identity` in [NSWP-11](protocol/11-the-visitors-console.md)'s table.
- **In BitPortal:** the Airlock sends a `who=1` door to the sign-in page, keeping the door for the tab. The page offers "Back to *the world*, by name", with what going by name gives away written under it, and "Go back as a guest". The way back leads only to BitPortal's own Airlock, which checks the door. Asking for a name that can't be given (the site hasn't proved who it is) stops at the Airlock and says so.
- **The sign-in page's profile box** was half the page's width with BitLogin's small text inside it. It now takes the page's width when signed in, and BitLogin's element is scaled as one piece to match the page's text.
- **What this does not do:** put the sign-in inside a world. The page changes to the client's and back. That is deliberate: a sign-in drawn inside a world is what a phishing world would draw, and a visitor's real protection is the address of the page they type into.
- **Status (2026-11-19):** not deployed. On the local server in Chrome: from a world's menu to the sign-in page and back to the same world as a guest; and by name with the Airlock's throwaway test identity, where the world's control then read "Here as Test visitor". A link with `who=1` to a site nobody announced showed the sign-in page and then the Airlock's whole screen. **Not tried:** a real BitLogin sign-in in this flow, a headset, a phone, Godot in a browser (the script and the addon were built, and the Godot example was not re-exported).

## 0.17.5

Settings between devices, and whose business that is.

- **[NSWP-11](protocol/11-the-visitors-console.md), "Settings that travel":** what goes through a door is the settings a visitor has now. Keeping them with the visitor's profile, so that another device starts from them, is the client's business and never a world's. A world never reads such a note: it couldn't open it, and a world asking relays about its visitors would be a way to follow them. The arrival stays the only place a world learns anything about its visitor.
- **In BitPortal:** a signed-in visitor can turn on "Keep my settings with my profile". One note on their relays (NIP-78, kind 30078), sealed with NIP-44 to their own key by BitLogin, fetched behind the browser's own copy, with the newer of each section kept. Where they have been, per-device consents, computers and files never go in it. Off until they turn it on.
- **Status (2026-11-18):** not deployed. Tried with throwaway keys and no relay: unit tests, and in Chrome with a stand-in key and a shelf in the tab's own storage, where a wiped browser got its settings, volumes, way of moving and a saved door back and nothing was sent to a relay. **Not tried:** a real sign-in, two real devices, a real relay.

## 0.17.4

The visitor's things in a world's own interface, and a filled screen back at the first press.

- **[NSWP-11](protocol/11-the-visitors-console.md), "Drawing it yourself":** a world may put any of the visitor's things into an interface of its own, wherever it likes and drawn its own way: the way home on its pause menu, the volumes on its settings screen, a button that brings the whole console up. What makes that safe is that it is the same thing behind the button: it does what the console's does, reads and writes the visitor's own settings, and "home" is the visitor's home, never the world's. The document lists them by the names a world presses them by.
- **For other engines:** `NSWP.view()`, `NSWP.run(id)`, `NSWP.open(on)` and a `changed` event in the engine script; `Nswp.console_view()`, `Nswp.run(id)`, `Nswp.open_console()` and `console_changed` in Godot. In the kit this was already `controls.view()`, `controls.run()` and `hud.setOpen()`.
- **Fullscreen is the first thing looked at on arriving.** It was looked for only once the place was built and the crossing's room had started to open, so the screen filled a moment after the doors did. Now it is looked for as the arrival is read, before anything is built, and taken at the visitor's very first press of any kind: a key, a click, a touch, or a key already held as they walked through the door. If a press isn't one the browser will take, the next is tried. A hint says so if the screen is still waiting.
- **What can't be done:** filling the screen with no press at all. A browser gives up fullscreen whenever the page changes and fills it again only on a press. That is the web's rule and no page gets round it.
- **Status (2026-11-18):** not deployed. In Chrome on the local server, arriving in the Gallery with the screen marked as filled: a key pressed while the crossing's room was still shut filled the screen before its doors opened; leaving fullscreen afterwards held. **Not tried:** a key held across the crossing (a test can't hold one through a page change), Firefox, Safari.

## 0.17.3

An Airlock that is only seen when there is something to see.

- **[NSWP-02](protocol/02-doors.md), "How many actions a crossing takes":** an Airlock goes straight through to a place the visitor knows. Its question is for somewhere new; asked at every door, it teaches people to press Continue without reading. "Knows" is narrow and every part has to hold: the site proves it is who it says, this time as before; the client's host lists it; the visitor has been through the Airlock to it before, with the same publisher; and nothing has changed, is warned about, or is waiting for an answer. If one fails, the whole screen is shown and they are asked.
- **In BitPortal:** on by default, and a switch in Settings ("Go straight through doors to places I've been before"). The first crossing to any world still stops and shows the real address. Later ones show where the visitor is going, with a Stop button, for the second or so the door takes to check, and then go. "Stop here" while it is checking, "Always stop here for this world", and the switch each bring the whole screen back.
- **Status (2026-11-18):** not deployed. On the local server in Chrome: the first crossing asked; the second went through in about a second with nothing pressed; from a room with a microphone on, joined went along and the microphone did not; Stop while checking, "always stop" for the world, the switch turned off, and a publisher that wasn't the one it had been each brought the whole screen back. **Not tried:** a headset, where it matters most.

## 0.17.2

One page for everything a world has to do and everything it may replace, and a probe that tries a world for itself.

- **[docs/integrating.md](docs/integrating.md):** the agreement and the defaults, on one page. Eleven things every world keeps, each with where it is written. Then what the kit gives by default (the menu, the sounds, the music, the doorway, moving, the marks on the floor, the crossing's room, how visitors look, rooms, panels), how to replace each, and the one thing that must stay true when you do. Four ways to build, and a table of everything that goes with a visitor and whether they are asked about it.
- **Signing in is not on either list.** It belongs to the visitor's client and never to a world. In BitPortal it is BitLogin, and a world can't replace it because it isn't in a world. The protocol itself names no sign-in.
- **`scripts/probe-world.mjs`:** tries a world on a phone-sized touch screen, at a desk and with a made-up headset, and says for each whether it loaded and drew, didn't load at all, or couldn't be confirmed. For whoever lists worlds, so that what a world's maker declares isn't the only thing a visitor is told. An Airlock can't do this at the moment of crossing: loading a world is visiting it.
- **In BitPortal:** the Airlock is cut down to where the door leads, what has to be known or answered, and the way through, with the rest under "More about this place", which holds a crossing while it is read. It says, before a visitor goes, when a world failed when tried on their kind of device or its maker says it isn't for it. And the sign-in page is BitLogin drawn in BitPortal's colours, with staying anonymous and switching profile beside it.
- **Proposed in [NSWP-08](protocol/08-lists.md):** carrying what a curator found in the list itself, signed with it.
- **Status (2026-11-18):** not deployed. The probe was run against the live reference worlds and the other sites on BitPortal's list; what it found is in BitPortal's repository. Its "works" means a page loaded and drew under a software renderer, or a session started with a made-up headset; it is not a person trying the world on a real phone or headset.

## 0.17.1

Marks on the floor for a casual walk, and a door that answers only from near it.

- **Where a press would take you.** Moving the casual way on a flat screen, a ring on the floor follows the pointer, on the spot a press would walk to. Once pressed, a dot marks where the visitor is headed and a dotted line runs from their feet to it. They are drawn for that visitor alone: nobody else in the room is told anything about them. A finger has nothing to hover with, so a touch screen has the dot and the line and no ring.
- **A door answers from within ten feet** (`DOOR_REACH`). Nearer than that it lights when pointed at, and a press goes through it. From further off it is not lit, and a press on it is a walk towards it, so a stray click on a door across the room no longer starts a crossing. Walking into a doorway always goes through. The menu still lists every door.
- **Moving the intense way, a doorway is walked into.** F and a click no longer go through a door; they still press panels and buttons.
- **A press reaches six metres, where it reached three** (`TAP_REACH`). Standing up and looking level, the floor nearer than about 2.8 metres is below the bottom of the screen, so at three metres the dot and nearly all of the line could not be seen. It is still a walk at the keys' pace, and it is shown before it is taken.
- **The reference worlds, BitPortal's room, the world template and the Godot addon** all have these.
- **Status (2026-11-18):** not deployed. In Chrome on the local server, in the Gallery: the ring sat where the pointer was and no further than six metres; a click showed the dot and seven dots of line, and the visitor arrived on the dot with the marks gone; moving the intense way there were no marks; on an emulated touch screen, a tap showed the dot and the line and no ring. Five metres from a door it was not lit and a press walked to two metres from it; there it lit, said where it led, and a press went through. Moving the intense way, F and a click on it did nothing and walking in went through. The same in the Godot example. **Not tried:** a headset, a real phone.

## 0.17.0

Settings that travel. A protocol change: one new flag on a link (`set=`) and one new field in the arrival context (`settings`), in [NSWP-11](protocol/11-the-visitors-console.md).

- **The problem.** Each world is a different website, and a website can only remember what a visitor chose on that site. So someone who turned the music down, made the text larger or filled their screen had to do it again in every world.
- **What travels now:** their volumes (all off, effects, music, voices, the room's hum), the size of text and controls, whether things move, their hands in a headset (which wrist, which stick, how far a turn goes, the view narrowed), and whether their screen was filled. A world says them on the link; the visitor's client passes them on; the world they arrive in starts from them in place of what it remembered. They go home too, so what was changed in a world is not forgotten on leaving it.
- **A screen that was filled is filled again** at the visitor's first key or press on arriving. A browser gives up fullscreen whenever the page changes and fills the screen only on a press, so that is as soon as it can be.
- **What never travels this way:** anything that would need asking about. A microphone, who is blocked and hearing other people's music keep their own rules. A world's colours stay the world's.
- **They are preferences.** A forged link has turned a volume down. Nothing is asked, nothing is shown, and a reader keeps what it knows and is in range and ignores the rest.
- **In the kit** (`settings.ts`): each part that holds a setting begins from `arrivedSettings()` and reports what the visitor has now; `arrival.read()` and `portal.go()` do the rest. Nothing for a world to do.
- **Fixed on the way:** on a development server, an arrival longer than 300 characters was not followed to its local copy and went to the real site. A long arrival is the normal case once it carries settings or a pass.
- **Status (2026-11-18):** not deployed. On the local server in Chrome: music off, effects low, larger text, less motion and a filled screen, set in the Gallery; the Grove began with all of them, and filled the screen again at the first key; a volume changed in the Grove was there in BitPortal's room on coming home, with the rest. The Godot example began from settings it arrived with (music off, larger text, the screen filled at the first key) and sent them on through its door. **Not tried:** a headset (its hands travel, untested), Firefox, Safari.

## 0.16.1

Arriving as you left, walking straight through a door, and knowing what is playing.

- **Intense stays intense through a door.** A visitor moving the intense way arrived in the next world with the grabbing-hand pointer of the casual way, and had to click before the mouse would look again. A browser hands a page the pointer only after a press, and they had pressed nothing there yet. Now the mouse looks round at once, by its own movement over the view, with the pointer's picture hidden and the dot in the middle; the pointer itself is taken at their first key or click, with nothing asked. Walking with the keys never needed the click, and now takes the pointer too.
- **Walking into a doorway goes through it.** The crossing's room came up round a visitor however they took a door. It still does for a door chosen from where they stand (a click, a trigger, the menu). A visitor who walks into a doorway is already going through it: nothing is brought up, and they go at once. They arrive standing in the room at the other end either way. In the reference worlds, walking into a doorway on a flat screen now goes through it at all; it only did in a headset.
- **What is playing.** The Sound section names the piece of the place's music that is playing, by its file's name ("Playing here: room-e. Next of 8"), and pressing it goes on to the next. "Music: off" still silences it.
- **Godot's visitor** arrives moving the intense way with nothing to click, the same.
- **Status (2026-11-18):** not deployed. In Chrome on the local server, arriving in the Gallery, BitPortal's room and the Godot example moving the intense way, with nothing pressed: the pointer's picture was hidden, the mouse turned the view (200 pixels, 25 degrees), and the first key took the pointer. In the Gallery, a door chosen brought the room up, and a doorway walked into led to the Airlock with the room never coming up. The Sound section read "Playing here: music. Next of 2" in the Gallery and "room-b. Next of 8" in BitPortal's room, and pressing it went on to the next. **Not tried:** a headset, Firefox, Safari (which may be stricter about taking the pointer on a key).

## 0.16.0

The visitor's console over a world's own interface, and arriving in the form you left in. Both are now part of the protocol: [NSWP-11](protocol/11-the-visitors-console.md).

- **The summons.** A world with an interface of its own could already put the traveller's controls away altogether. A visitor then had no way to bring them back unless the world offered one. Now one gesture on each kind of device is the visitor's in every world, and brings their console up over whatever the world is showing, at any level, whatever the world has done with the keys: the key left of 1 at a desk, two fingers held still on a touch screen, B or Y held in a headset. No world uses it for anything of its own.
- **Coming and going leaves nothing behind.** The console is drawn over everything while it is up. The world is told (`menuOpen`, `menuClose`). When it goes, a hidden console leaves the screen exactly as it was, whatever had the keys has them back (the world's own menu, if that was open), and the world never heard the key.
- **Hidden means hidden, and no longer means out of reach.** So a world that hides the console no longer has to rebuild the visitor's things in menus of its own. The one case where that duty stands is a headset with tracked hands and no controllers, which has no summons for a hidden console yet.
- **The same form on the other side** (`form=touch` or `form=desk` on a door's link, `form` in the arrival context). A visitor on a touch screen arrives laid out for touch, and one at a desk for a mouse and keys. Most devices can only be one, and a world worked that out already; this is for the ones that can be both. A world follows it where the device can and ignores it otherwise. Headset to headset was already carried (`xr=1`, `immersive`). It is not sent on the way home.
- **In the kit:** `mountHud` listens for the summons before the page hears anything (`ui/summon.ts`); `createXrInput` takes `onSummon`; `startingForm()` and `currentForm()` (`form.ts`) say what form a visitor is in, and the kit carries it through a door. The engine script has `NSWP.presence()` and `NSWP.claim()`, and Godot `Nswp.set_presence()` and `Nswp.claim_keys()`.
- **The menu comes up on Travel,** where the way home is, until the visitor picks another section. It was coming up on Look.
- **What this is not:** a layer above a world. A web page can't draw over another site, so the console is still drawn by the world's own page, and a world built some other way keeps this only by choosing to. A client that is there whatever a world does has to be the browser (`browser/spec.md`).
- **Status (2026-11-18):** not deployed. In Chrome on the local server, in the Gallery, BitPortal's room and the Godot example, each having hidden the console and claimed every key, with a menu of its own open and focused: the world's own menu key did nothing to ours; the key left of 1 brought the console up and put it away; the world heard neither press; nothing of ours was on screen before or after; and the world's menu had the keys again. On an emulated touch screen, two fingers held brought it up and put it away, and a pinch did not. A visitor told `touch` at a desk with no touch screen stayed at a desk, and one who used touch left with `form=touch`. **Not tried:** a headset (the held button is tested as arithmetic), a real phone, and a real device that is both touch and desk (that choice is tested as arithmetic too).

## 0.15.6

Footsteps that sound like footsteps, and running and jumping however a visitor moves. Nothing in the protocol changes.

- **Footsteps.** Each was the same recording at the same loudness, a thousand times a visit. Now a step is under half as loud as any other cue, and no two are alike: each is up to a semitone and a half higher or lower, lighter or heavier, softer or brighter, and a touch to the side of the foot that made it. One foot falls a little lower than the other. It is done as each is played (`stepShape` in `sound-store.ts`), so no sound file was added or changed, and a world's own step gets the same.
- **Running, in every way of moving.** It was Shift, moving the intense way at a desk, and nothing else. Now: Shift with the keys moving the casual way too; two clicks or two taps on the floor run there (`createStroll` does this itself); and in a headset, walking smoothly, pressing the moving stick in runs until the stick is let go. One number for all of them (`RUN`).
- **Jumping** (`jump.ts`, `addJump`): the same small jump everywhere. Space at a desk, a Jump control kept at hand where there is no keyboard, and A or X in a headset. It takes the same time at any frame rate, changes nothing about where a visitor may stand, and no step is heard in the air.
- **The reference worlds, BitPortal's room, the world template and the Godot addon** all have both. BitPortal's room and the template now walk at the kit's pace with the keys (they were a little slower).
- **A headset moving the casual way has no run:** it moves a step at a time, so there is nothing to speed up. It has the jump.
- **Status (2026-11-18):** not deployed. On the local server in Chrome, in the Gallery, BitPortal's room, the template and the Godot example: the ten or so steps of a short walk all differed, over about three semitones, at between 0.28 and 0.43 of a cue's level; Shift ran faster than a walk moving both ways; two taps ran and one walked; Space lifted the visitor 0.45 m and put them down, and didn't open the menu. In Godot: 2.4 m/s walking, 4.3 running, and the Jump control at hand on an emulated touch screen. **Not tried:** a headset (the stick and the A button are tested as arithmetic only), a real phone. **Nobody has heard the steps:** the numbers say they differ and are quieter, not that they sound right.

## 0.15.5

Links that lead to the local copies on a development server, and the kit's own menu, sounds, doorway and movement for a world made in Godot. Nothing in the protocol changes.

- **Links on a development server.** A site is built for its real address and stays that way, so what is tried is what gets deployed. While it is served from a developer's machine, the server publishes a map, real address to local copy (`/.well-known/nswp-local.json`), and a page follows it when it sends the browser on: a door in the local Gallery leads to the local Airlock, and on to the local Grove. Once deployed, a page asks for no map and every link is the real address. Nothing is switched. See [docs/local-server.md](docs/local-server.md).
- **Three limits on that** (`packages/core/src/local.ts`): only a page that is itself on a local address over plain http asks for a map; a map can only lead to a local address; and only the last step changes, so what a door says, what an Airlock checks and what an announcement is signed over are still the real address. The Airlock says on its card when it is sending a visitor to a copy.
- **The engine script carries the kit's menu and sounds** (`packages/sdk/src/engine-menu.ts`): the same menu, drawn by the page over an engine's canvas, and the same sounds, at the volumes the visitor set. An engine asks each frame what the visitor chose (`NSWP.events()`), and says how far they walked so their steps are heard. `NSWP.kit()` gives the numbers every world shares.
- **Godot gets the defaults.** `NswpGate` is the standard doorway: its frame is the kit's own model, written out as a mesh by the kit's modelling code, and its metal, its field of light and its glow are the kit's shaders written for Godot. `NswpVisitor` moves the casual way or the intense way at the kit's speeds. `Nswp.menu()` puts the menu and sounds on. Each can be replaced: `NswpPortal` is still a door with nothing drawn.
- **Shared, so they can't drift:** the doorway's size (`gate-size.ts`), the fullscreen control (`ui/fullscreen.ts`), the words on the desk control (`fps.ts`) and how far a drag turns the view (`DRAG_LOOK`) are each in one place that both the Three.js kit and the engine script read. A test fails if the numbers written into the Godot addon stop matching.
- **`npm run engine:check`** now covers the doorway's mesh and the sound files copied into the addon, as well as the script.
- **Status (2026-11-18):** not deployed. On the local server, in Chrome: from the Gallery, a door led through the local Airlock to the local Grove, and the way home to the local BitPortal, on this machine's address and on its network address; the Godot example's door did the same. The Godot example was tried with a mouse and keyboard: the menu, a door lit and described when pointed at, a click on the floor walking exactly the kit's reach, a drag turning the view, the mouse looking round, a run with Shift, and the menu opening when the pointer is taken back. A tap on an emulated touch screen walked the same reach. **Not tried:** a real phone, a real headset, Firefox, Safari, a pass by name on a development server. Nobody has listened to the sounds in Godot. **Not in the Godot addon:** moving in a headset, the crossing's room, the view through a door, other people.

## 0.15.4

The Godot addon has been run, and there is a world made with it to look at. Nothing in the protocol changes.

- **An example world in Godot** (`engines/godot/example/`, with a project file beside it): two entry points, a door to the Gallery, the way home and the way into a headset, in one script. `npm run build:godot` exports it for the web and puts the kit's script beside its page; it needs Godot 4 and its web export templates.
- **The local server** serves it with the other sites, when it has been exported.
- **The addon needed no changes** to run. Its README now says what was run and what wasn't, and that Godot needs the browser's WebXR Layers for a headset session.
- **Status (2026-11-18):** run in Godot 4.7.2, exported for the web, in Chrome on a flat screen: an ordinary link stands the visitor at the main entrance; an arrival naming the balcony stands them there, carries how they move, and is taken out of the address; walking into the door leads to their Airlock with where they are going; the way home leads home. With a made-up headset on the page, Enter VR is offered, and a session that can't start says why. **Not tried:** a session in a real headset (the made-up one lacks what Godot needs), a phone, Firefox or Safari.

## 0.15.3

Worlds in other engines, starting with Godot. Nothing in the protocol changes: it never said how a world is drawn.

- **`engines/nswp-engine.js`:** what makes a website a world, as one script with no rendering in it: how the visitor arrived, a door out, the way home. Text in and text out, since that is what any engine can pass to a page. It runs under the same strict content policy as the reference worlds.
- **A Godot addon** (`engines/godot/addons/nswp/`): an `Nswp` autoload (`arrival`, `place()`, `go()`, `home()`, `doors()`) and an `NswpPortal` node for a door. It ends a headset session before a crossing and carries how the visitor moves.
- **[docs/other-engines.md](docs/other-engines.md)** says what any engine has to do, and what it draws for itself.
- **Not in it:** rooms (other visitors and their voices), and Unity or Unreal.
- **Status (2026-11-18):** the script is built and tried in Chrome on a bare page: an ordinary link, a full arrival read and taken out of the address, a pass for this site giving a name and one for another site giving none, doors refused with a word for why, and `go`, `home` and `doors` each leading to the right Airlock address. **The Godot addon is written and has not been run:** Godot isn't on the machine this was written on.

## 0.15.2

Signs that are the right size wherever you stand, a crossing that nothing pokes into, and a way to try builds on your own machine.

- **Signs.** A sign made to be read from across a room filled the screen of anyone standing next to it: it was a size in the world, and what a reader needs is a size in their view. Two rules now. On a flat screen, what something is goes beside the controls: `controls.setTarget(name, detail)` shows a small card, always the same size, never in front of the thing. In the world, `viewScale(distance, { at })` keeps a sign the same size in the visitor's view, within limits.
- **BitPortal's room** follows both: pointing at a door shows its address, what it is, why it is there and how to go, in a card over the buttons. The sign that hung in front of the door is a headset's only, low on the door and a steady size. The first-visit hint moved the same way.
- **The crossing's room is drawn over everything.** It stands round the visitor wherever they are, which may be half inside a bench or another person. It is now drawn last, on a cleared depth, so nothing shows inside its walls or through them; the visitor's own hands and console are drawn after it; and other people aren't drawn while it stands.
- **A local server** (`node scripts/serve-local.mjs`): the built sites, each on a port of its own, on this machine or the local network with `--lan`. A door still leads to the deployed sites, since each world is built for its real address.
- **Found on the way:** a ranking reason with nothing to say for itself was showing as the bare word "Tastes" in BitPortal ("…ranks it highly and Tastes"). It is left out.
- **Status (2026-11-18):** built, not deployed, and running on the local server. Looked at in a browser: a door's card the same size from the middle of the room and from the doorway, with the view through the door clear; and the crossing's room stood in the middle of the Grove's hearth, with none of its crystals showing inside. The headset's sign was not looked at in a headset.

## 0.15.1

The two ways of moving have one pair of names, at a desk and in a headset: casual and intense.

- **"Game controls (FPS)" is now "Desk controls: casual / intense".** Nothing about them changed but the name.
- **A headset has the same switch:** "Headset controls: casual / intense". Casual is stepping, turning a notch at a time, with the view narrowed while moving, as it was. Intense is one stick walking and the other turning, smoothly, with the whole view. Until now those were four separate settings; they still are, underneath, for fine tuning.
- **Each device keeps its own.** Choosing intense at a desk never makes a headset slide. Smooth movement in a headset makes some people ill, and that choice is made in the headset.
- **The preference that travels is `moving=intense`,** on the link and in the arrival, in place of the `fps` flag 0.15.0 gave it for a few hours. Nothing had shipped with the old name. It applies to the device the visitor arrives on.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome and an emulated headset: both switches, the headset one setting and unsetting smooth walking, smooth turning and the narrowed view; arriving from a headset intense in the headset and casual at the desk, and the other way round.

## 0.15.0

Game controls on a desk, and fullscreen.

- **Two ways to move on a desk.** The one there was stays, and is what a visitor gets: click where you want to stand, drag to look round. The new one is for people who play games: the mouse looks, W A S D walk, Shift runs, F uses what is in the middle of the view (a click does too), and Escape brings up the menu. It is turned on in the menu, under Moving, and kept for the site.
- **Offered where there is a mouse.** Not on a phone, and it stands down in a headset.
- **Escape is the menu** because a browser takes the pointer back on Escape whatever a page wants. Closing the menu goes back to looking, and where the browser won't allow that yet, a click does.
- **Fullscreen,** in the menu under View. In fullscreen, where the browser allows it, one press of Escape is the menu and holding it leaves.
- **It travels** ([NSWP-02](protocol/02-doors.md), [NSWP-03](protocol/03-arrival.md)), so a visitor who chose it in one world has it in the next. A preference only: nothing is asked. (Its name on the wire changed in 0.15.1, before anything shipped.)
- **The kit:** `createFps`, with `lookAfter`, `strideOf` and `heldKey` for anyone building their own. The reference worlds, the template and BitPortal's room use it.
- **Not in it:** jumping and crouching (the kit has neither), moving a panel by its bar while the mouse is looking (bring up the menu first), and changing the keys.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome on one machine, in the Gallery, the template and BitPortal's room: off to begin with; turned on and kept; the first click taking the pointer; the mouse turning the view; W and S walking, Shift running at about one and three-quarter times the pace, and standing still with nothing held; Escape opening the menu with the pointer back, and a click looking again; F going through the door in the middle of the view; arriving with it on when the visitor's client says so; fullscreen on from the menu; and the ordinary way of moving still working when it is off. Not tried by a person with a real mouse, where how fast the view turns is the thing to judge.

## 0.14.2

A second piece of music for every place.

- **Twelve more pieces the owner picked** are in: one for each reference world and for the default (`music-2.ogg`, `music/default-2.ogg`), and four for BitPortal's room. Each place now plays two in turn, and the room eight.
- **They were made with YuE2,** a music model, on the owner's own machine. The agent that made them reported the model's terms for redistributing output as unclear, and they were left out of 0.14.1 for that reason. The owner settled it on 2026-11-18 ("YuE2 is clear for us to use. Ship them"), and the kit's sounds README records that.
- **Two to listen to:** the Observatory's second piece has one sharp sound at about 62 seconds, and the Workshop's has five between 57 and 84 seconds, which may be the plucks it was asked for. Measured, not judged by ear.
- **Status (2026-11-18):** built, not deployed.

## 0.14.1

The sounds are recorded now. The owner chose them by ear.

- **Seventeen cues, a room's hum and a piece of music** come with the kit as files (`packages/sdk/sounds/`), chosen by the owner from candidates made for this project. The cues came from a sound-effect model under the Apache licence and from code; the hum and the music were made in code. That folder's README lists each and where it came from.
- **The ones made in the browser stay** as what plays where the kit's files aren't served or a file can't be played.
- **Several for one cue.** A cue may have several files and one is chosen each time, never the same twice running: drop and hover have two each. A world may do the same.
- **Several pieces of music for a place** play in turn, each fading into the next with the loudness held level. A single piece fades into itself the same way, so a loop has no seam and no dip.
- **The room's hum** is its own layer under the music, with a switch of the visitor's own. A world names its own or says none.
- **Each reference world has its own music** (`sites/<name>/sounds/music.ogg`).
- **Nothing is fetched before a visitor's first touch** but a small list of what there is.
- **Played as it arrives, not held whole in memory:** a minute of music held whole is tens of megabytes.
- **Not included:** twelve more pieces of music the owner also picked, from a model whose terms for redistribution are unclear. They wait on the owner's decision.
- **Status (2026-11-18):** built, not deployed. Measured in Chrome on one machine: in the Grove, the template and BitPortal's room, only the list fetched before a touch, then nineteen cue files, the hum and the place's music; all seventeen cues heard from the files; the hum's switch changing what is heard; and, with two six-second pieces of steady noise as a world's music, three hand-overs in twenty seconds with the loudness staying within about three per cent. Not listened to in the game by anyone yet, and not tried in Safari, where the MP3 forms are what would play.

## 0.14.0

Blocks that travel: someone blocked in one world stays blocked in the next.

- **Why it needed the protocol.** A block is carried out in a visitor's own browser, on one site. Each world is its own site, so a block made in the Gallery meant nothing in the Grove. What goes everywhere a visitor goes is their own client, so the list is the client's.
- **`blocked` on the link** ([NSWP-02](protocol/02-doors.md)): a world reports the people its visitor blocked there during this visit, by identity key.
- **`blocked` in the arrival context** ([NSWP-03](protocol/03-arrival.md)): the visitor's client hands their list to each world they arrive in. The world leaves them unconnected to anyone on it, for that visit, and keeps nothing.
- **A link is something anyone can write,** so a client never adds to the list unseen: it names who, and the visitor says yes. It doesn't hurry past the question. Nobody is taken off the list by a link, ever.
- **Only people who go by name.** A guest is a new key each visit.
- **The cost:** each world arrived in learns the keys on the list. BitPortal says so where the list is kept.
- **BitPortal:** the Airlock shows who a world reported, with a box to tick ("Block this person everywhere you go"), unticked. Settings on the front page lists everyone blocked everywhere, with Unblock, and anyone reported on the way home, still waiting for an answer. People blocked in BitPortal's own room are part of the list already. In a world, the People part of the menu says how many are blocked wherever the visitor goes.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome with the Grove, the Gallery and BitPortal answered from their builds at their real addresses, every relay the test, and throwaway keys: someone who goes by name blocked in the Grove; the link reporting her; the Airlock naming her, unticked, with no countdown; ticked, the two never connected in the Gallery, which kept nothing; not ticked, she was there; a link somebody else wrote adding nobody; a report on the way home waiting, shown in Settings, and forgotten there; and Unblock in Settings emptying the list. Not tried with a real sign-in.

## 0.13.5

Muting, in two parts.

- **A person's voice and their music are muted apart.** Select someone in the People list: "Mute their voice" and "Mute their music" are two switches. Their voice without their music, their music without their voice, neither, or both. Muting someone's voice no longer takes their music with it, as it did for one release.
- **Their music can be muted before they share any,** so it never starts.
- Blocking is unchanged: it ends the connection, so a blocked person's figure, voice, music and screen are all gone for the visitor who blocked them, and nothing of theirs can reach that visitor. Everyone else still sees them: only a room's host could remove someone for all, and rooms have no hosts yet.
- **Unblocking is plain to find.** The People part of the menu says how many people are blocked, in a room or out of one, with "Unblock" beside each name.
- **Status (2026-11-18):** built, not deployed. Tried with three visitors on one machine: a voice muted with the music still heard, the music muted with the voice still heard, and each put back.

## 0.13.4

Music shared with people nearby. Nothing in the protocol's signed formats changes.

- **Sharing.** A visitor playing their own music in a room can offer it to people near them, from the Sound menu.
- **Hearing.** Off until a visitor turns on "Hear music others share". Nobody's music reaches anyone who didn't ask, and nobody's leaves their device unless they offer it.
- **By distance.** It is full beside the person sharing, fades with distance, and is nothing at twelve metres. Past that it isn't asked for and isn't sent.
- **Under voices.** Shared music steps back while anyone is speaking and comes forward after.
- **The nearest two.** One visitor hears at most two people's music at once.
- **One person's music** can be silenced without silencing their voice. Blocking them covers their music too.
- **The sharer is told how many are hearing it.** Stopping, or leaving the room, ends it for everyone.
- **A world can switch it off** in its space (`sharedMusic: false`): a concert, a library. Each visitor's own music still plays for them.
- **On the wire:** a third line to each member, for music, agreed from the start and left empty, like the screen's. `mus:1` says music is offered and `hear:1` asks for it; both repeated while true.
- **What to know:** it goes from one browser to another and never through a server of anyone's. It is still playing music to other people, and what a visitor shares is theirs to answer for. And a microphone hears speakers: with both on, headphones, or the others hear it twice.
- **Status (2026-11-18):** built, not deployed. Measured in Chrome on one machine with three visitors and a stand-in relay: offered and unheard until a listener turned hearing on; then heard, and the sharer told one person was hearing it; a third who never asked sent nothing; a quarter as loud at seven metres; stopped at twenty and the sharer told nobody was hearing it; heard again on coming back; a third as loud under a voice and back up after; one person's music silenced with their voice untouched; and ended for all when the sharer stopped. Not listened to, and not tried across two networks.

## 0.13.3

Sound. Until now a place was silent but for voices. Nothing in the protocol's formats changes.

- **Cues.** A short sound for something that happened: a step, landing a jump, walking into something, a press, the menu, going through a door and coming out, someone joining or leaving, the microphone, a notice, an error. A closed list of seventeen. Each has a default made in the browser from tones and noise, so there is no file to fetch or license.
- **A place's own music.** When a world names none, the kit makes a quiet one from the place's title: held notes that swell and fade, with single notes over them. The same for everyone there, different from place to place.
- **A world's own sounds.** For any cue, a file on the world's own site to play instead, or null for silence; for the music, a file, or null for none. Whatever it doesn't name keeps the default. A file on another site is refused: it would tell that site who is here.
- **How loud is not the world's to say.** A world's cue is brought down to the loudness of the defaults, a cue over three seconds or half a megabyte is refused, and everything goes out through one limiter.
- **The visitor's volumes** are theirs, kept for the site: effects, music, other people's voices, and all sound off. No world sets them.
- **The visitor's own music.** Songs added from their own device, kept in the browser for that site. Only they hear it, and the place's music steps back while it plays.
- **Steps are made from how far a visitor was moved,** not from how their head sways, and nobody sends anybody a sound: what is heard of other people is their voice.
- **Nothing before the first touch.** A browser holds sound back until then.
- **The kit:** `createSounds`, `addSoundControls`, `controls.signal()` and `onSignal()`; `createStroll` says when a wall stopped it. The reference worlds, the world template (a `sounds/` folder and `"sounds"` in `world.json`) and BitPortal's room use them.
- **Not built:** sound placed in space (another person's steps where they are), a sound for grabbing and dropping with a controller, and sharing music with people nearby, which is its own piece.
- **Status (2026-11-18):** built, not deployed. Measured in Chrome on one machine, since nobody was listening: silence before the first touch; every cue heard; a walk of two metres making two steps; the menu heard; the place's music playing; all sound off being silence; volumes and a song kept through a reload; a song added from a file, played and taken out; and, in a copy of the template with sounds of its own, its step and its music used, a silenced cue silent, a five-second file refused in favour of the default, and a loud file brought down. **Not judged:** what any of it sounds like. Whether the defaults are pleasant is for ears.

## 0.13.2

A shared screen in a room (the browser plan's stage A4). Nothing in the protocol's signed formats changes.

- **Share your screen** from the Room controls, where the browser can offer one: a desk or a laptop. A phone or a headset can't share, and can watch.
- **Offered, not shown.** Sharing sends nothing by itself. Everyone in the room is told it is there, and it goes only to members who choose to watch. A room is open to strangers, and a picture nobody asked for is the easiest way to spoil one.
- **Watching** is in the People list, for someone who is sharing. Their screen opens on a panel of the watcher's own, which they move, size, make see-through, pin and put away like any other. Putting it away stops it being sent.
- **The sharer is told how many are watching.** Stopping, leaving the room, or the browser's own "Stop sharing" takes it from everyone at once.
- **On the wire:** the connection to each member has a line for a screen from the start, left empty, so sharing needs no second handshake. `scr:1` says a screen is offered and `watch:1` asks for it; both are repeated while true, as "I am recording" is.
- **What to know:** a room runs in the world's own page, so that world's code can see a shared screen as it can everything else in a room (§9.8). Share one window, and share in worlds you trust.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome on one machine with three visitors, a stand-in relay and a drawn picture in place of a real screen: offered and announced with nothing shown; one visitor choosing to watch and seeing live pictures on a panel; the sharer told "1 person is watching", then 2; a third visitor sent nothing until they asked; a panel put away ending it for that watcher; and stopping taking it down for all. Not tried with a real screen, across two networks, or in a headset, where whether its words can be read is the thing to judge.

## 0.13.1

Rooms: a visitor can stop hearing someone, or stop being in a room with them. Nothing in the protocol's formats changes.

- **Stop hearing someone.** Select a person in the People list, then "Stop hearing". They are still seen, still see and hear the visitor, and aren't told. It lasts while they are here.
- **Block someone** (§9.4, §9.8). The visitor's own browser closes its connection to that person and makes no new one. Nobody is asked, nothing is published, and the others in the room carry on. To the blocked person, the visitor has left.
- **What a block can hold on to.** Someone who came by name showed a pass for a key of their own, so the block is kept, on that site, and holds when they come back. A guest is a new key every visit, so blocking one lasts the visit and the room says so plainly.
- **Letting someone back** is in the same list, and takes effect the next time either side announces itself.
- **One wart, said plainly:** who someone is comes out only once connected, so a blocked named person is connected to for a moment each time they return, and then dropped.
- **Not built:** removal by a host, which needs rooms to have hosts (a room is still named by a string), and carrying a block list from one site to another, which would be a job for the visitor's own client.
- **Status (2026-11-18):** built, not deployed.

## 0.13.0

Smaller things that were in the way: a tap that moved too far, and having to join again in every world.

- **A tap is a walk.** On a phone or a desk, a tap or click on the floor was a jump of up to five metres: the room lurched. It is now a walk at the pace the keys walk, to a spot three metres off at most, and a second tap changes where it is headed. A headset keeps the jump, which is what sits well there, and so does anyone who asked for less motion (a short one). The kit has it as `createStroll`, `reachOf`, `TAP_REACH` and `WALK_SPEED`; the reference worlds, the world template and BitPortal's room use it.
- **Staying joined** ([NSWP-02](protocol/02-doors.md), [NSWP-03](protocol/03-arrival.md)). Someone in a world's open room who goes through a door arrives joined in the next. `joined=1` on the link a world sends them through, and `joined` in the arrival context their client writes.
- **And heard, if they have said so.** `mic=1` beside `joined=1`, and `mic` in the arrival. A link is something anyone can write, so a microphone travels only when the visitor has told their own client that theirs may stay on between worlds: off until then, remembered after. Joined alone is passed on by default, shown on the Airlock, and theirs to untick.
- **What doesn't travel:** a private room (the next world's open room is other people), and a microphone without joined.
- **A refresh keeps them in the room too,** with the microphone as it was. This tab only.
- **Told at once.** Arriving joined, a visitor is told others can see them (and hear them), and Leave is where Join was. Sound from the others starts on their first touch, since a browser holds it back until then.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome on one machine, with the Gallery, the Grove and BitPortal answered from their builds at their real addresses, every relay the test itself, and a microphone the browser made up: a tap, a click and a touch each walking three metres at walking pace; joined carried from the Gallery to the Grove, where someone already there saw them arrive; the microphone left off the first time and carried once the box was ticked, and the choice remembered; unticking "stay" arriving unjoined; a link written by somebody else arriving joined with the microphone off; a private room not travelling; a refresh; and the way home to BitPortal's room, joined. Not tried on a real phone, a real headset, or with a real voice.

## 0.12.0

Who a world is for, and a copy of the client that shows only what its host has listed.

- **`audience`, a tag on a world's announcement** ([NSWP-01](protocol/01-worlds.md)): `kids`, `general` or `adult`, in the maker's own word. An `adult` world also carries `content-warning`, which readers that don't know `audience` already read. A careful reader takes a world as adult when it says so, and also when it carries a warning and names no audience. A world that says nothing is unrated.
- **What a rating can't do.** It keeps honest makers' worlds where they belong and does nothing about a maker who lies. So a client that must not show adult worlds does two things together ([NSWP-08](protocol/08-lists.md)): it shows only worlds on a list signed by a key its host trusts, and it drops from those any that say they are adult.
- **A host's list is an ordinary list.** Kind 30004, signed by the host's key, under a name the client knows. No new kind, and nothing a relay or a world has to do.
- **Hashtags.** `t` tags were already topics. A client may now let a visitor ask for more or less of one, and rank by that on the visitor's own device ([NSWP-08](protocol/08-lists.md)).
- **BitPortal, as hosted at bitblocks.network (§15):** shows a world only when its operator's key has listed it or it is in the starter set, and never a world for adults, in the lobby, the room, saved doors or the Airlock. The operator, signed in, sees what is waiting and lists or unlists a world with their own signature. Someone who hosts their own copy sets their own key and their own answers in one file.
- **The world template** asks for `audience` in `world.json` and announces it.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome with made-up sites, a throwaway key standing in for the operator's, and every relay answered by the test: a visitor shown listed worlds only, and none for adults; a world with a warning and no audience held back the same way; the Airlock refusing to send anyone to an adult world while still showing its address; the operator shown what is waiting, listing one with their own signature, and every visitor then shown it; someone else signed in shown none of that; a hashtag asked for more of moving worlds up and getting a shelf of its own. Not tried with the operator's real sign-in. The seven reference worlds' announcements carry no rating yet: they show as "Not rated by its maker" until they are signed again.

## 0.11.0

A home of your own to start in. Three small additions to the protocol, and one decision in BitPortal's own design changed.

- **The decision that changed (§14.1).** A visitor's start was always BitPortal's own room and never their own site, for three reasons: it costs a crossing before they have chosen anything, its code can observe them, and when it is down there is nowhere to start. The first two don't hold for a world that is theirs and that they chose. The third is answered by keeping BitPortal's room to fall back to. So someone who has built a world may now choose it as their home.
- **`home`, a capability** ([NSWP-01](protocol/01-worlds.md), [NSWP-07](protocol/07-homes.md)): a world says it can be the place its owner starts. It is a promise of one thing: wherever it offers the way home, it offers the way to the visitor's doors.
- **`doors=1`** on an Airlock opened with no destination ([NSWP-02](protocol/02-doors.md)): the way to the visitor's doors, which is the client's own place and never a world. A client with one place for home and doors takes them there either way.
- **`home` in the arrival context** ([NSWP-03](protocol/03-arrival.md)): a visitor's own client saying it has brought them home, so the world can leave the way home out and show the way to their doors.
- **What a client should hold to** before a world may be someone's home (NSWP-07): it is theirs both ways (they announced its address with their key, and its site admits that key), it says it can be one, it is on an encrypted address anyone can reach, they chose it, and the client keeps a start of its own to fall back to.
- **The kit.** `portal.doors()`, `arrival.atHome()`. The way home is now labelled "Go home", since home is no longer always a lobby.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome with two made-up sites and a throwaway key: a world from the template checked and chosen in BitPortal's Settings; a site that only claimed the visitor's key refused; going home with nothing asked; the way to their doors and back; and a home that doesn't answer, no longer admits them, or no longer says it can be a home, each ending in BitPortal's room with a word about why. Not tried with a real sign-in, a real announced world, or a headset.

## 0.10.6

Terminals in a world you are building. Nothing a world implements changes, and no world gains anything unless its owner gives it.

- **The rule was "never in a world", and for every world but your own it still is.** The owner decided on this one exception, behind three locks: the world is named in their home, by their own typing; their Bridge is started naming it (`--world`); and the computer asks before each terminal opens, saying which world.
- **A world grant** (kind 27303): names a Bridge and a world, lasts up to twelve hours, and is good for every connection until then, so a refresh doesn't end the work. A pass, a home's grant and a world grant are each refused as either of the others; the vectors hold every crossing.
- **Going there.** The home hands the grant to that world's address after the `#`, and the world takes it out of its address at once. A world never holds a signer or learns its owner's key.
- **The world template** is brought up to date: panels, the keyboard and library, speaking, see-through and pinned panels, staying put through a refresh, and "A terminal on your computer" for an owner who brought one. Anyone else who visits gets none of the last, and the terminal's code isn't even fetched for them.
- **`--allow-for` is counted for each asker by itself:** the home, and each world.
- **Found by trying it:** a world already open that is handed something in its address loaded nothing and left it there. It now notices, takes it out, and starts again. And thin letters went faint on a see-through panel; the step from gone to there is shorter now, so letters keep their weight.
- **Status (2026-11-18):** built, and BitPortal's side deployed. On the live room, with a throwaway identity and without leaving it: a world named on the sheet (a plain site refused), and what would be handed to it read back and checked: kind 27303, signed by the visitor, eight hours, readable at that world's address and nowhere else, accepted by a Bridge told about the world and refused by one that wasn't. Before that, on one machine with throwaway keys: the whole trip from BitPortal's room to a world built from the template, with a real Bridge told about that one world. The seven worlds and the Starter Home were not redeployed; they gain nothing from this but crisper see-through letters. Not tried on a real headset, or with a real sign-in signing the world grant.

## 0.10.5

Working in a place instead of visiting it: speaking, panels that come along, and a refresh that isn't a reset. Nothing a world implements changes.

- **Speak instead of typing.** A Speak key on the drawn keyboard and a Speak button on the terminal. Where a terminal's Bridge was started with `--voice`, the sound goes to the owner's own computer over the connection the terminal has, Whisper there turns it into words, and it goes nowhere else. Otherwise the browser's own recognition is used where there is one: on the device where the browser can, and after saying so where it would send the sound to its maker.
- **Speaking types, and never presses a key.** Words come back as one line. The Bridge and the page each strip anything else.
- **See-through panels.** A button goes round four looks. Dark parts can fade more than light ones, so a terminal can be letters hanging in the air.
- **Pinned in the view.** A pinned panel comes along. On a flat screen it keeps its place on the screen; in a headset it stays put while the visitor looks about and comes round when they turn or move well away.
- **A refresh is not an arrival.** `createStay` puts a visitor back where they stood, facing the way they faced, and offers the way back into a headset first. The reference worlds and BitPortal's room do it; BitPortal also brings back the terminals that were open, as they hung.
- **Found by trying it:** Whisper, when unsure, tries again and again, hotter: a few words took ten seconds. One pass takes under one.
- **Status (2026-11-18):** built and deployed to BitPortal and the seven worlds. On the live room, with a throwaway identity and every relay answered by the test itself: a terminal panel made see-through and pinned, keeping its place on the screen through a turn and a walk, with its Speak button; and a refresh that put the visitor back where they stood. On the live Workshop, a refresh that kept both place and heading. Before that, on one machine with throwaway keys, in Chrome and an emulated Quest 3, with a microphone the browser made up and a stand-in for the recogniser: every part above, and the real Whisper run once on a made-up sound. **Not tried:** a real voice; a real headset, where how a pinned panel feels and whether see-through letters can be read are the things to judge.

## 0.10.4

The terminal, after its first real use. Nothing a world implements changes, and nothing on the wire.

- **Larger and smaller letters** (A+ and A−, 60 to 160 across), on the panel's foot. The picture stays one size, so larger letters are sharper and the panel keeps its shape; the program is told its new size. The panel's own + and − still change how large the whole panel is.
- **Looking back** (▲ ▼) through what has scrolled away, a press at a time, and **Copy** for what is on the screen.
- **Page up, page down, home and end** on the drawn keyboard's last layer.
- **A few terminals at once.** The Bridge keeps four, each asked about at the computer, each with a place of its own that `--tmux` turns into a lasting terminal. At four, the owner being let in again takes the place of the one quiet longest.
- **Found by trying it:** in a headset the drawn keyboard sat between the hand and the panel's foot, so a press meant for a button typed a letter instead. Up for a terminal, the keyboard now sits lower and nearer, under the panel.
- **A key that only looks like one is refused.** About half of all 64-character hex strings are not public keys at all. `decodeNpub` now says so (`isPublicKey`), so such a key is never kept as a computer or as a Bridge's owner. And a panel shows only words written for the visitor, never what a library said when it failed. Found on the live site, with a made-up key.
- **Status (2026-11-18):** built, and BitPortal's side deployed, the refusal of keys that only look like keys included (checked live: such a link adds nothing and the room says it names no computer, one kept from before is dropped, and a real key is added as before). Tried on one machine with throwaway keys, in Chrome and an emulated Quest 3: each button pressed for real with a mouse and with a controller, two terminals open on one computer at once, and the earlier checks again. On the live room, with a throwaway identity and every relay answered by the test itself: a terminal panel with its five buttons, larger letters chosen and remembered, and a second panel beside the first. Not on a real headset, where whether the foot's buttons are large enough to point at is the first thing to judge.

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
- **Status (2026-11-18):** built, and BitPortal's side deployed: the live room offers **Your computers**, a pairing link opened by someone not signed in asks them to sign in and adds nothing, and the terminal's code is fetched only when a terminal is opened. Tried with throwaway keys and a relay on one machine, from BitPortal's room in Chrome: a computer added from its link, the same code on the panel and at the computer, commands typed on a flat screen and on the drawn keyboard in an emulated Quest 3, and a second key refused with nothing opened and nobody asked. Then the real thing, once: on the live site, a real sign-in signed the grant, public relays carried it, the same code showed on the panel and at the computer, a yes was typed there, and Claude Code ran in the panel in the owner's room. The browser and the Bridge were on one computer. **Not tried:** a real headset, a browser on one network and the computer on another, macOS. The Bridge is not on npm.

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
