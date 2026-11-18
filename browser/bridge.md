# The Bridge: a terminal on your own computer, from your room

**Version:** 0.1 · **Status:** A first version is built: a terminal, for one owner. Windows of other programs are proposed · **Kinds:** 27302 (a grant), 27301 (notes) · **Vectors:** [`grants`](../vectors/grants.json) · **Code:** [`bridge.ts`](../packages/core/src/bridge.ts), [`packages/bridge`](../packages/bridge)

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

If that is more trust than you want to give a website, don't run it.

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
| Text `{"t":"ready","name":"…"}` | Bridge | The terminal has started |
| Text `{"t":"exit","code":0}` | Bridge | The program ended. The Bridge then closes the channel |

A frame over 65,536 bytes is dropped. A text frame the other side doesn't
know is ignored.

## What the Bridge does

- **Answers one owner.** Set when it is first run, shown every time it starts.
- **Asks at the computer** before each session, unless told `--allow-for`.
  An unanswered question is a refusal after 60 seconds.
- **One session at a time.** A second `open` while one is running is refused.
- **Says so on its own screen** when a session opens and when it ends, with
  the time.
- **Ends a session** that has been silent for 30 minutes, or has run for 12
  hours.
- **Keeps its own key** in a file only its user can read, and never sends it.
- **Uses relays only to be found.** It never publishes anything readable.

## Pairing

The Bridge prints its public key, and a link to the owner's home with that
key in it. Opening the link while signed in as the owner adds the computer to
their home. From then on the home offers "A terminal on this computer".

The home keeps the list of its owner's computers in the browser. It is never
published.

## Running it

```bash
npx nswp-bridge --owner npub1…                # asks before every session
npx nswp-bridge --owner npub1… --tmux         # one lasting terminal: it outlives the headset
npx nswp-bridge --owner npub1… --allow-for 480 --command "claude" --cwd ~/code/project
```

It needs Node 22 and Python 3 (for the terminal itself), on Linux or macOS.

## Proposed, not built

- **Windows of other programs**, to look at and then to use
  ([`spec.md`](spec.md), section 7).
- **More than one computer's worth of sessions at once**, and more than one
  owner.
- **Ending a session from another device.**
- **A relay of last resort** for networks where the two can't connect
  directly: the same gap rooms have.
