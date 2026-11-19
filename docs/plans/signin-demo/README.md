# Notebook: a flat demo of signing in by the window

A plain website, standing in for an app that isn't a world. It has no
sign-in box. It embeds its visitor's sign-in address's hidden signer, opens
that address's window when asked, and then has notes signed. It signs and
shows what was signed. It sends nothing to a relay.

It is here to try what
[signing by the window](../signing-in-worlds.md) is like outside a world.
It is a demo, and is never deployed.

## Trying it

```bash
node docs/plans/signin-demo/build.mjs
```

```bash
node scripts/serve-local.mjs --lan --https
```

Then open the address the server prints for "Notebook" (port 4310 when the
first port is 4300). It must be the `https` address. Its sign-in address is
the BitPortal copy on the same machine, on the first port: open that once
first, so the browser accepts its certificate.

Press **Sign in with BitLogin**. A window opens at BitPortal. Sign in there
if you aren't already, then press Allow. Back on the page: sign a note, ask
for something it may not, sign out.

Adding `?signer=test` to the address makes the window hand over a throwaway
identity in place of anyone's. That is how automation tries it.

## What it shows, and what it doesn't

- The password is typed at the sign-in address, in a window this page
  can't read. This page learns a public key and a name.
- The signer signs a note and a reaction for this site, and refuses the
  rest: the same list a world gets.
- **A real app needs more than that list.** See "Apps that aren't worlds"
  in the plan. This demo is the sign-in, not yet an app's worth of
  permissions.
- On this server the demo and BitPortal share a site, so the browser
  doesn't wall their storage apart. The signer behaves the same either way:
  it never uses what the browser keeps for BitPortal.
