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
| nearly all | The local sites, over https on the network address | `node scripts/serve-local.mjs --lan --https` (docs/local-server.md) |
| anything with a relay | The stand-in relay: `ws://127.0.0.1:4313` and `wss://<this machine>:4314` | `npm run relay` |
| `sandbox-*`, `buy-screen*` | BitUnlock's sandbox at `https://<this machine>:4312` | Its own repository's session runs it |
| `buy-screen*`, `panel` | BitLogin's local copy at port 4311 | The local sites serve its built folder |

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
| `room-tip.mjs` | A tip to a person in BitPortal's room, two throwaway visitors, a stand-in for BitLogin's client |
| `panel.mjs` | BitLogin's real panel opening over a local world and closing, desk and phone sizes, signed out |
| `xr-test-look.mjs` | The headset test page loads and sends nothing by itself |
| `live.mjs` | After a deploy, read-only: every public site is on this kit, the shell is the way in, the real panel opens |

## Rules

- A trial that would make an account, type a password, or publish anything
  says so in its first lines, and is not run without the owner's word.
- A trial found failing is fixed or deleted, not left: a folder of scripts
  nobody trusts is worse than none.
- What a trial proved goes in the plan it belongs to, with the date and who
  ran it. "Passes here" is not "works live".
