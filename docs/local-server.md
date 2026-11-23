# Trying sites on your own machine

```bash
npm run build && node scripts/serve-local.mjs --lan --https
```

Each built site is served at one address: `https`, at this machine's
address on the network, on a port of its own. That address is chosen
(`scripts/lan-address.mjs`): a private one (192.168, 10 or 172.16), never a
VPN's own end and never a container's or a virtual machine's network. At
start the server waits up to 30 seconds for the network to come up before
falling back to whatever address there is, and says so if it had to. Set
`LOCAL_HOST` to name the address yourself. On a machine at
`192.168.1.20`, BitPortal is at `https://192.168.1.20:4300`, the
reference worlds on 4301 to 4307, the world template on 4308, and the Godot
example on 4309 if it has been exported (`npm run build:godot`). A flat
demo of signing in by the window is on 4310 if it has been built
(`node docs/plans/signin-demo/build.mjs`, see
[its notes](plans/signin-demo/README.md)). BitLogin's own site, the
sign-in address that demo and every world ask, is on 4311 if it has been
built (`npm run build:demo` in the bitlogin checkout). It is the local copy
of `https://bitlogin.network`, so a world that is told its visitor's signer
is there asks the copy. BitPortal
and the template are served from their own repositories beside this one, if
they are built. The address is the same from this machine and from a phone
or a headset on the same network, and each device warns about the
certificate the first time (below). Run without `--lan --https`, the script
still serves plain `http://localhost` on the same ports, to this machine
only.

## Links lead to the copies served here

A world is built for its real address, and stays that way: what you try is
the same build that gets deployed. But while it is being served from your
machine, the links between sites lead to the copies on your machine:

- A door in the local Gallery leads to the local BitPortal's Airlock.
- That Airlock sends you on to the local Grove.
- The way home from there leads to the local BitPortal.

A site that isn't being served locally still leads to the real one.

Once a site is deployed, every link leads to the real address. Nothing has
to be switched, because nothing in the build was changed.

## How it works

The server publishes a map at `/.well-known/nswp-local.json`, real address to
local copy:

```json
{
  "https://portal.bitblocks.network": "https://192.168.1.20:4300",
  "https://gallery.bitblocks.network": "https://192.168.1.20:4301"
}
```

A page reads its own server's map, and follows it at one moment only: when it
sends the browser somewhere (`toLocal` in `packages/core/src/local.ts`). The
kit's doors, the way home and BitPortal's Airlock all do.

Three limits keep this from mattering anywhere else:

- **Only a page on a local address asks for a map.** That means a page whose
  host is `localhost`, a loopback address, or a private network address,
  over `http` or `https`. A deployed site is at a name, never at one of
  those, and never asks.
- **A map can only lead to a local address.** Each entry must go from a real
  `https` origin to an `http` or `https` origin on a local host. Anything
  else in the map is ignored.
- **Only the last step is changed.** What a door says, what an Airlock checks
  and shows, and what an announcement is signed over are all still the real
  address. The Airlock says so on its card: "Development server: you will be
  taken to the copy at 192.168.1.20:4302, not to grove.bitblocks.network."

So an Airlock on a development server still checks the real site and its
real announcement. A world that hasn't been deployed yet can't be checked,
and is shown as unverified, as it would be for anyone.

## What a local address can't do

With `--lan --https`, each site's one address is a secure one, and what is
left that doesn't work is listed under "https, for a phone or a headset",
below.

Without them, the script serves `http://localhost`, which a browser counts
as a secure address on the machine itself. It is another address for the
same site, and no other device can use it.

From another device, with `--lan` and no `--https`, plain
`http://192.168…` is not a secure address, and a browser withholds three
things there: its cryptography, the microphone, and a headset session.
Without the first, nobody can sign in: BitLogin finds the account and can't
open it, and says "Account not found or credentials incorrect" for a correct
name and password.

### https, for a phone or a headset

```bash
node scripts/serve-local.mjs --lan --https
```

Each site then has **one address**, the same from every device, the machine
itself included: `https://192.168…:4300` and so on. Anything else (plain
`http`, `localhost`, `127.0.0.1`) is sent on to it.

One address, because to a browser two addresses for one site are two sites.
Signed in at `localhost` is not signed in at `192.168…`. A room joined at
one is not the room at the other, so a phone and the desk beside it never
met. And at a plain `http` address a world can't embed a signer at all. One
address behaves the way the real one will.

Links between the sites lead to the `https` copies.

- **The certificate is made on your machine,** the first time, with
  `openssl`, and kept in `~/.config/nswp/dev-https/`, outside every
  repository. It is for `localhost` and your machine's own local addresses
  and nothing else, it can't vouch for any other certificate, and it is made
  again when it is about to run out or your address changes.
- **Each device warns about it the first time,** because nobody vouches for
  it but your machine. The server prints the certificate's fingerprint:
  check the one the device shows is the same, and accept. That is you
  trusting your own computer.
- **After that the page is a secure one:** signing in, the microphone and VR
  all work.
- **Passkeys don't.** A browser refuses a passkey on a page whose
  certificate it was told to accept. Use a deployed site for those.
- **A firewall must let each port through.** Twelve of them from the first:
  the last two are the flat sign-in demo and BitLogin's own site, which
  every world asks for its visitor's signer.

Never use this certificate, or this server, for anything but your own
network.

A pass that says who you are is made for the place it is shown at, so on a
development server it is made for the local copy. Beside a local copy of
BitLogin, a local BitPortal may have passes and grants signed: the sign-in
address decides which sites it signs those for, and its local copy signs
them for the local BitPortal.

Going to a world you are building with leave to open terminals on your
computer (BitPortal's "bring") is not changed by any of this. That grant is
for the world's real address and no other.

## Your own server

Any development server can do the same: answer
`/.well-known/nswp-local.json` with a map like the one above. A page built
with the kit, served from that server on a local address, follows it.
