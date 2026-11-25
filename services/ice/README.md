# bitblocks-ice

A small Cloudflare Worker that hands a room's visitors short-lived TURN credentials, so two people whose computers
can't reach each other directly still meet. The kit asks it once per room per visit (`iceFrom`), waits at most 3
seconds, and uses STUN alone where it doesn't answer.

- `GET /` answers `{ iceServers, ttl }`, to pages of bitblocks.network only.
- Credentials last **1 hour**. The kit asks again before they run out.
- URLs on port 53 are left out, because browsers block that port.
- Each address may ask **10 times a minute**.
- It reads this month's TURN traffic from Cloudflare's analytics, at most every 10 minutes in each isolate. **Past
  800 GB it hands out STUN only** until the month turns. If the analytics can't be read, it hands out no TURN at
  all. It counts traffic in and out, which is more than Cloudflare bills (outbound only), so it stops early rather
  than late.

Nothing here has been deployed or run against Cloudflare. That is the owner's to do, with the commands below.

## What the owner does, once

The commands run in this folder (`services/ice/`). `npx wrangler` asks you to sign in to Cloudflare the first time.

1. Make the TURN key: Cloudflare dashboard, **Realtime**, **TURN Server**, **Create**. Keep its **Turn Token ID**
   and its **API Token**.
2. Make a read-only analytics token: **My Profile**, **API Tokens**, **Create Token**, custom, with the one
   permission **Account, Account Analytics, Read**, for your account only.
3. Copy your **Account ID** from the dashboard's account home.
4. Put the four in as secrets. Each command asks for the value, so it isn't in your shell history:

```bash
cd services/ice
```

```bash
npx wrangler secret put TURN_KEY_ID
```

```bash
npx wrangler secret put TURN_KEY_API_TOKEN
```

```bash
npx wrangler secret put CF_ANALYTICS_TOKEN
```

```bash
npx wrangler secret put CF_ACCOUNT_ID
```

5. Deploy it:

```bash
npx wrangler deploy
```

6. Check that it answers. Your browser gets `{ "iceServers": [...], "ttl": 3600 }` from a bitblocks.network page,
   and anything else is refused:

```bash
curl -s -H "Origin: https://bitblocks.network" https://bitblocks-ice.<your-subdomain>.workers.dev/
```

7. Tell the orchestrator its address. It goes in the kit's `ICE_FROM`, and then into a release.

## To stop it at once

```bash
npx wrangler delete bitblocks-ice
```

Rooms then go back to STUN only, as before. Credentials already handed out run out within the hour, and can be
revoked earlier in the dashboard.
