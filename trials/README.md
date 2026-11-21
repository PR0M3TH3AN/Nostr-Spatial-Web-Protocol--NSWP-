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
| `front-room.mjs` | The front room of a paid world: this checkout's own Gallery (`npm run build` first) with its gate switched on in the scripted browser only, a visitor who holds nothing, a purchase from the sandbox, the gate opening on the receipt, the kit as shipped refusing it, another visitor kept out, and the pass running out with the visitor inside. The sign-in address is a stand-in, and so are relays: BitLogin's own screen is not tried here |
| `room-tip.mjs` | A tip to a person in BitPortal's room, two throwaway visitors, a stand-in for BitLogin's client |
| `panel.mjs` | BitLogin's real panel opening over a local world and closing, desk and phone sizes, signed out |
| `xr-test-look.mjs` | The headset test page loads and sends nothing by itself |
| `xr-test-guided.mjs` | A whole guided run of the headset test with a made-up headset and made-up relays: each step lands, asks, and is sent; the notes are signed and whole. Needs only `npm run build`, nothing running. `LIVE_SHELL=1` also takes the two steps inside BitPortal's page, through the live one, read only |
| `live.mjs` | After a deploy, read-only: every public site is on this kit, the shell is the way in, the real panel opens |

## Rules

- A trial that would make an account, type a password, or publish anything
  says so in its first lines, and is not run without the owner's word.
- A trial found failing is fixed or deleted, not left: a folder of scripts
  nobody trusts is worse than none.
- What a trial proved goes in the plan it belongs to, with the date and who
  ran it. "Passes here" is not "works live".
