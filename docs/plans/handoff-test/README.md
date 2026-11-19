# The hand-off test pages

Two small sites that answer one question: can a window of one site (the
client) give a secret to that site's own hidden frame inside another site
(a world), without the world being able to read it or pose as the frame?

What it is for, and what was found, is in
[the plan](../signing-in-worlds.md), "What was tried".

They use nothing but the browser. They do not use BitLogin, they sign in to
nothing, the "session" is a made-up string, and nothing is sent anywhere.

## Running it

From the repository root:

```bash
node docs/plans/handoff-test/serve.mjs
```

That serves the client at `http://127.0.0.1:4391` and the world at
`http://localhost:4392`. To a browser those are two different sites, which
is the point. Then, in another terminal:

```bash
node docs/plans/handoff-test/try.mjs chrome
```

```bash
node docs/plans/handoff-test/try.mjs brave /usr/bin/brave-browser
```

```bash
node docs/plans/handoff-test/try-firefox.mjs
```

Each prints what the signer said before and after Allow, everything the
world heard, and what a hostile world got.

## One thing to know

Playwright starts Chrome with the walls between sites' storage switched
off. `try.mjs` switches them back on, because real browsers have them on
and the test means nothing without them. If "seesStoredSession" is ever
`true`, the walls are off and the run doesn't count.

## By hand

Open `http://127.0.0.1:4391/?signin=1`, then `http://localhost:4392/`.
Press Connect, press Allow in the window, press Sign. The list on the page
is everything the world was told. `http://localhost:4392/hostile.html` is
a world with no real signer: its window never offers Allow.
