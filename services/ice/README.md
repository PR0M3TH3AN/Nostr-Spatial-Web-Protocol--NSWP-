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

## The free tier, and what the stop can't see

Cloudflare's pricing page for Realtime (https://developers.cloudflare.com/realtime/pricing/) gives the first 1,000 GB
each month free, shared between its SFU and TURN. Past that, TURN costs $0.05 per GB sent from Cloudflare to a
visitor (https://developers.cloudflare.com/realtime/turn/).

- **The stop is for the whole account,** not for one TURN key. It counts every TURN key's traffic.
- **It can't see SFU use.** We use no SFU. If one is ever used on this account, the 800 GB stop no longer keeps the
  month free, and has to be lowered.
- Cloudflare's analytics measure all traffic, which is more than it bills, so the count is on the safe side.

Nothing here has been deployed or run against Cloudflare. That is the owner's to do, with the commands below.

## What the owner does, once

The commands run in this folder (`services/ice/`). `npx wrangler` asks you to sign in to Cloudflare the first time.

The four secrets, in the order they are put in, and where each is found in the Cloudflare dashboard:

| Secret | What it is | Where it is found |
|---|---|---|
| `TURN_KEY_ID` | The TURN key's id | **Realtime**, **TURN Server**, your key: its **Turn Token ID**. Make the key there with **Create** if you haven't. |
| `TURN_KEY_API_TOKEN` | The TURN key's own API token | The same key: its **API Token**, shown when the key is made. Keep it then, since it may not be shown again. |
| `CF_ANALYTICS_TOKEN` | A read-only token for usage | **My Profile**, **API Tokens**, **Create Token**, **Custom token**: the one permission **Account, Account Analytics, Read**, for your account only. |
| `CF_ACCOUNT_ID` | Your account's id, which the usage query needs | Your account's home page in the dashboard: **Account ID**, on the right (also in the address bar after `dash.cloudflare.com/`). |

Put them in as secrets. Each command asks for the value, so it isn't in your shell history:

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

Then deploy it:

```bash
npx wrangler deploy
```

Check that it answers. Your browser gets `{ "iceServers": [...], "ttl": 3600 }` from a bitblocks.network page,
and anything else is refused:

```bash
curl -s -H "Origin: https://bitblocks.network" https://bitblocks-ice.<your-subdomain>.workers.dev/
```

Then tell the orchestrator its address. It goes in the kit's `ICE_FROM`, and then into a release.

## To stop it at once

```bash
npx wrangler delete bitblocks-ice
```

Rooms then go back to STUN only, as before. Credentials already handed out run out within the hour, and can be
revoked earlier in the dashboard.
