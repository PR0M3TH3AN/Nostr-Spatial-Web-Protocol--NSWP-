# The Bridge: a terminal on your own computer, from your room

**Version:** 0.1 · **Status:** A first version is built: a terminal, for one owner. Windows of other programs are proposed · **Kinds:** 27302 (a grant), 27303 (a world grant), 27301 (notes) · **Vectors:** [`grants`](../vectors/grants.json) · **Code:** [`bridge.ts`](../packages/core/src/bridge.ts), [`packages/bridge`](../packages/bridge)

This is stage A3 of [`spec.md`](spec.md). The Bridge is a small program a
person runs on their own computer. It lets them open a terminal on that
computer from a panel in their home, in a headset or out of one. It answers
one Nostr key, its owner's, and nobody else.

It is not part of the protocol, and no world ever needs it or can reach it.

## Read this first: what you are trusting

A terminal runs commands. Whoever can open one on your computer can read and
change anything you can.

- **You are trusting your home page completely.** The page that draws the
  terminal sees every key you type and every line that comes back, and can
  type for you. If that site were ever taken over, an open session would be
  the attacker's. This is true of any terminal in a web page.
- **So a session can't start without you at the computer.** By default the
  Bridge asks on its own screen before each session, and shows a four-digit
  code that the panel shows too. No page can press that key for you.
- **You can loosen that, knowingly:** `--allow-for 480` accepts sessions for
  eight hours after you allow one. During that time, your home page alone
  decides when a terminal opens.
- **You can narrow what it runs:** one command instead of a shell, a starting
  folder, or the whole Bridge inside a container.
- **Add only your own computer to your home.** A Bridge started by someone
  else, with your key as its owner, would answer you too. A terminal on it
  would show its owner everything you typed there. The home shows a
  computer's whole key before adding it, and adds nothing until you press.

If that is more trust than you want to give a website, don't run it.

What it doesn't trust: relays (they carry sealed notes and can read none of
them), other people's keys (refused before anyone is asked), and worlds (a
world is never given your signer, your panels or the list of your computers,
and a pass it holds opens nothing here). The one exception is a world you
are building and have named at both ends: see "A world of your own".

## How it connects

A page served over `https` may not open a plain connection to a computer on
the local network. So the page and the Bridge meet the way two visitors in a
room do ([NSWP-06](../protocol/06-rooms.md)): encrypted notes through relays
to find each other, then a direct connection.

```text
home page (session key S)                         Bridge (key B, owner O)
  │  open  { grant, sdp }            ─────────▶   checks the grant, asks at the computer
  │                                  ◀─────────   wait
  │                                  ◀─────────   answer { sdp }      or   refused { why }
  │  ════════ a direct, encrypted channel: keys one way, output the other ════════
```

Every note is an event of kind `27301`, tagged `["x", <topic>]` and
`["p", <recipient>]`, with its content encrypted to the recipient (NIP-44).
The topic is the SHA-256, in hex, of `nswp/bridge/1`, a newline, and the
Bridge's public key. A note more than 60 seconds old or new is ignored.

`open` begins a conversation. Every reply carries `["e", <the id of the open
note>]`, and the page takes no reply that doesn't name its own request, so an
answer to an earlier request is never taken for an answer to this one.

Nothing a relay carries says what is typed, or that a terminal is involved,
beyond the two keys talking.

## The grant

The page makes a throwaway session key for each connection, and the owner's
signer signs a grant for it:

```json
{
  "kind": 27302,
  "created_at": 1794430800,
  "tags": [
    ["nswp:session", "<session public key>"],
    ["nswp:bridge", "<the Bridge's public key>"],
    ["expiration", "1794431100"]
  ],
  "content": ""
}
```

It says: "this session key may open a terminal on that Bridge, for the next
five minutes." The Bridge believes a grant only when all of this holds:

- It is a validly signed event of kind 27302, **signed by the owner's key**.
- It has exactly one `nswp:session`, one `nswp:bridge` and one `expiration`,
  and **no `nswp:origin`**.
- `nswp:bridge` is this Bridge's own key.
- `nswp:session` is the key that signed the `open` note, and is neither the
  owner's key nor the Bridge's.
- `expiration` is in the future, and at most 300 seconds after `created_at`.
- `created_at` is not more than 120 seconds ahead of the Bridge's clock.
- It has not been used before. The Bridge remembers each grant until it expires.

A grant is five minutes to *connect*. The connection it opens lasts until
either side closes it, the terminal exits, or the Bridge's limits end it.

**A grant is not a pass, and a pass is not a grant.** A pass
([NSWP-10](../protocol/10-identity.md)) is kind 27300, and names a site and
never a Bridge. A grant is kind 27302, and names a Bridge and never a site.
Each check refuses the other on both counts, so the pass a world is handed can
never open a terminal, and a signer that is asked for a grant can see that it
is not being asked for a pass.

**The code.** Both ends work out four digits from the grant: the first eight
hex characters of the SHA-256 of `nswp/bridge/code`, a newline, and the
grant's id, read as a number, modulo 10,000. The Bridge shows them when it
asks; the panel shows them while it waits. They are never sent.

## On the channel

One data channel, named `term`, ordered and reliable.

| Frame | From | Meaning |
|---|---|---|
| Binary | Page | Keys typed, as bytes |
| Binary | Bridge | What the terminal wrote, as bytes |
| Text `{"t":"size","cols":100,"rows":30}` | Page | The panel's size, 20 to 300 columns and 5 to 120 rows. The first frame sent |
| Text `{"t":"here"}` | Page | "Still here", every ten seconds |
| Text `{"t":"ready","name":"…","speech":true}` | Bridge | The terminal has started. `speech` says whether this computer will turn what is said into text |
| Text `{"t":"exit","code":0}` | Bridge | The program ended. The Bridge then closes the channel |

A frame over 65,536 bytes is dropped. A text frame the other side doesn't
know is ignored.

## A world of your own

Someone building a world wants their terminals in it, to work on it from
inside. The rule above is that no world can reach any of this, and for every
world but their own it stands. This is the one way round it, decided by the
owner on 2026-11-18, and it is narrow on purpose.

**What it costs.** In a world, the world's own page draws the terminal. So
that world's code can read what is typed and type for its owner. That is fine
for code they wrote. If the world's site, or anything it loads, were ever
tampered with, this is a way to a shell on their computer. Only the owner
sees the terminals there: panels are never sent to anyone else in a room.

**Three locks, and all three must be open.**

1. **In the home**, the owner names the world as one they are building: they
   type its address themselves, on a flat screen, and press the button. No
   link, door or world can add one.
2. **At the computer**, the Bridge is started naming that world
   (`--world https://my-world.example`). It is never remembered between
   runs, and nothing a page sends can add one.
3. **Each time a terminal opens**, the Bridge asks at the computer, and says
   which world is asking.

**The world grant.** Going there from their home, the owner's signer signs a
second kind of grant, and the home hands it to that world's address and to no
other:

```json
{
  "kind": 27303,
  "created_at": 1794430800,
  "tags": [
    ["nswp:session", "<session public key>"],
    ["nswp:bridge", "<the Bridge's public key>"],
    ["nswp:world", "https://my-world.example"],
    ["expiration", "1794459600"]
  ],
  "content": ""
}
```

A Bridge believes one only when it is signed by its owner; names this Bridge;
names, as `nswp:world`, an origin the Bridge was started with; names the
session key that sent it, which is neither the owner's nor the Bridge's;
carries no `nswp:origin`; expires in the future and at most 12 hours after
`created_at`; and is not dated ahead. `nswp:world` is an origin: `https`, or
this computer itself (`http://localhost`, `http://127.0.0.1`) for a world
still being built.

It differs from a home's grant in two ways, both so that a refresh doesn't
end the work: it lasts hours, eight unless asked otherwise, and it is good
for every connection until then. Only the key it names can use it, and that
key is held by the world's page for the tab. The four digits shown at both
ends come from each request's own note, not from the grant.

Three things are now signed with similar tags, and none is taken for
another: a pass (27300, `nswp:origin`), a home's grant (27302, a Bridge and
no site), a world grant (27303, a Bridge and `nswp:world`). Each check
refuses the other two; the vectors hold all the crossings.

**The hand-over.** The home goes straight to the world's address, with
`#nswp-bring=` and a packed copy of the grant, the throwaway key, the
Bridge's key, the computer's name and its relays. The part after `#` is sent
to no server. The world takes it out of its address at once, keeps it for
the tab, and checks that it was made for its own origin and has not run out.
A world never learns its owner's key from this, and never holds a signer.

`--allow-for` is counted separately for the home and for each world: a yes
to one is not a yes to another.

## Speaking instead of typing

A second channel, named `speech`, opened by the page the first time something
is said. Sound goes one way and words come back:

| Frame | From | Meaning |
|---|---|---|
| Text `{"t":"begin","lang":"en-GB"}` | Page | Something is about to be said |
| Binary | Page | What the microphone heard: 16-bit samples, one channel, 16,000 a second |
| Text `{"t":"end"}` or `{"t":"cancel"}` | Page | That was all of it, or never mind |
| Text `{"t":"text","text":"…"}` | Bridge | The words |
| Text `{"t":"sorry","why":"…"}` | Bridge | It couldn't, and why |

- **The sound goes to the owner's computer and nowhere else.** It is written
  to a file only that user can read, handed to a program on that computer,
  and deleted. Nothing here calls a service.
- **Speaking types. It never presses a key.** The words come back as one
  line: no line break, nothing that is Enter, Escape or anything but a
  letter. The owner reads what was typed and presses Enter themselves.
- **At most 90 seconds at a time.**
- **Off unless asked for.** A Bridge started without `--voice` or
  `--transcribe` closes the channel and says `"speech": false`.

`--voice` uses OpenAI's Whisper where it is installed
(`pip install openai-whisper`), kept loaded so a sentence takes about a
second. The first use of a model downloads it, and Whisper says so on the
Bridge's screen. `--voice-model small` picks another model. `--transcribe
"<command>"` uses any program instead: it is given a `.wav` file's path and
prints the words.

Where no computer listens, a home may use the browser's own speech
recognition if it has one. Some browsers do that on the device; others send
the sound to their maker. The SDK says so before the first word is heard,
and prefers the owner's own computer whenever one is connected.

## What the Bridge does

- **Answers one owner.** Set when it is first run, shown every time it starts.
- **Asks at the computer** before each session, unless told `--allow-for`.
  An unanswered question is a refusal after 60 seconds.
- **A few terminals at a time:** four. Each is asked about at the computer,
  and the question says how many are open already. When four are open and
  the owner is let in again, the one whose home has been quiet longest is
  hung up and the new one takes its place. So terminals left open by a
  closed page or a headset in a drawer can never keep their owner out. The
  question says when a yes will do this.
- **Gives each terminal a place**, 1 to 4, the lowest that is free. With
  `--tmux` each place is a lasting terminal of its own (`nswp-bridge-1`, and
  so on), found again when that place is next opened.
- **Hangs up on a home that has gone quiet.** A session that hasn't heard
  from its page for a minute is ended, whatever the connection claims.
- **Says so on its own screen** when a session opens and when it ends, with
  the time.
- **Ends a session** that has been silent for 30 minutes, or has run for 12
  hours.
- **Keeps its own key** in a file only its user can read, and never sends it.
- **Uses relays only to be found.** It never publishes anything readable.

## Pairing

The Bridge prints its public key, and a link to the owner's home:

```text
https://portal.bitblocks.network/walk/#bridge=npub1…
```

with `&relay=wss://…` for each relay, when it was told to listen somewhere
other than the usual four. Opening the link while signed in as the owner
shows the key and asks; pressing the button adds the computer. A link can
ask and can't add. From then on the home offers "A terminal on" that
computer.

The home keeps the list of its owner's computers in the browser. It is never
published.

## Running it

It is not on npm yet. From a copy of this repository:

```bash
npm install
npm run bridge -- --owner npub1…                # asks before every session
npm run bridge -- --owner npub1… --tmux         # lasting terminals: they outlive the headset
npm run bridge -- --owner npub1… --voice         # and turns what you say into text, here
npm run bridge -- --world http://127.0.0.1:5173 # and lets a world you are building ask, when you bring your terminals to it
npm run bridge -- --owner npub1… --allow-for 480 --command "claude" --cwd ~/code/project
```

`npm run build -w nswp-bridge` makes one file, `packages/bridge/dist/nswp-bridge.mjs`,
that runs anywhere Node does.

It needs Node 22 and Python 3 (for the terminal itself), on Linux or macOS.
Its key and its owner are kept in `~/.config/nswp/`, readable by you alone.
To give the computer to another key, delete `bridge.json` there: it won't
change hands because a command line said so.

## What has been tried, and what hasn't

Tried, with throwaway keys and a relay on one machine: the owner opens a
terminal and runs commands; a second key, the Bridge's own key, a pass, a
grant for another computer, an old grant and a replayed grant are all
refused before anyone is asked; a no at the computer is a no; the whole path
from BitPortal's room in Chrome, on a flat screen and in an emulated headset
with the drawn keyboard.

Also tried, once, for real: on the live BitPortal room, the owner's own
sign-in signed the grant, the four public relays carried it, the code on the
panel matched the one at the computer, and a program with a full-screen
display ran in the panel. The browser and the Bridge were on one computer.

Also tried, with throwaway keys: the whole trip to a world of the owner's
own. Named in BitPortal's room, gone to with one press, a terminal opened in
a world built from the template as it ships, the computer asked and told
which world, and everything back after a refresh; a visitor to the same
world given nothing; a Bridge not told about the world refusing it.

Not tried: a real headset; a browser on one network and the computer on
another; macOS.

A terminal started by a plain `nswp-bridge` ends when its panel is closed,
and whatever was running in it ends too. Start the Bridge with `--tmux` to
keep terminals going between visits.

## In the home

The SDK's terminal panel (`nswp-sdk/terminal`) is what a home hangs. Press
it to type. Along its foot are six buttons, each one press, so they work
with any controller and a mouse alike:

| | |
|---|---|
| Speak | Say it instead. Press again when you have finished; the words are typed, and Enter is yours to press |
| ▲ ▼ | Look back and forward through what has scrolled away. Typing returns to the end. A mouse wheel does the same |
| A+ A− | Larger or smaller letters: 60 to 160 across. The program is told its new size. The panel's own + and − change how large the whole panel is |
| Copy | What is on the screen, to the clipboard |

In a headset the kit's keyboard comes up under the panel, with Esc, Tab,
Ctrl and the arrows, and page up, page down, home and end on its last layer.
A stick does not scroll: every action here is a press, as everywhere in the
kit. Selecting text with a pointer is not built.

On the panel's bar, beside − + ✕, are two more: one goes round how
see-through the panel is (solid; dark parts see-through; dark parts clear,
so it is letters hanging in the air; all of it faint), and one pins it in
the view so it comes along. A home may bring a terminal back after a refresh
where it hung, as BitPortal does: each needs a new grant, so the computer
asks again unless it was told `--allow-for`, and with `--tmux` what was
running is still there.

## Proposed, not built

- **Windows of other programs**, to look at and then to use
  ([`spec.md`](spec.md), section 7).
- **More than one owner.**
- **Selecting text on the panel**, and pasting in a headset.
- **Running as a service**, with nobody at the computer to ask. Today the
  first yes is always typed there.
- **Ending a session from another device.**
- **A relay of last resort** for networks where the two can't connect
  directly: the same gap rooms have.
