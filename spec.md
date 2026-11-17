# Nostr Spatial Web Protocol (NSWP) and BitPortal
## An open, decentralized spatial web built on Nostr and WebXR, with a reference app on the BitBlocks stack

**Version:** 0.2 (concept specification)
**Status:** Exploratory draft / proposed protocol
**Date:** November 17, 2026
**Previous version:** 0.1, November 11, 2026 (`docs/history/spec-v0.1.md`)
**License recommendation:** CC0 for the protocol (Part I); MIT for BitPortal and the SDK (Part II), matching BitBlocks convention D11

---

## 0. What changed in 0.2

- **Split into two parts.** Part I is **NSWP**, the client-neutral protocol. Part II is **BitPortal** (working name), the reference app built on the BitBlocks stack. The protocol must never require BitBlocks (§1.3).
- **BitBlocks integration.** BitPortal uses BitLogin for identity, BitFeed for discovery, BitGate for trust and safety, and BitUnlock for paid access. Tessera, BitRoad and BitVid are optional, later integrations (§13–§18).
- **World announcements are now tag-first.** Relays index only single-letter tags, so the fields people search on are tags and `content` is just the description (§5).
- **Origin verification.** `/.well-known/nswp.json` binds a web origin to the pubkeys allowed to announce it. This closes the "anyone can announce anyone's URL" hole (§7).
- **The Airlock.** A portal crossing now goes through a defined trusted interstitial that is static, self-hostable and doesn't log, since a web app can't draw trusted UI inside someone else's immersive session (§6).
- **Identity handoff.** An origin-bound, short-lived entry assertion lets a world learn *which* identity the user chose without ever touching the signer (§4.4).
- **Existing NIPs are now mapped** to bookmarks, reviews, invitations, presence, events and moderation, so the project doesn't invent new kinds for them (Appendix B).
- **Added:** comfort and accessibility metadata, asset rules (VRM, Blossom, size budgets), privacy rules for referrers and entry points, the threat of password phishing *inside* worlds, a dependency/blocker register for the BitBlocks stack, and exit criteria for every MVP phase.

---

# Part I — The Protocol (NSWP)

## 1. Executive Summary

The **Nostr Spatial Web Protocol (NSWP)** is an open architecture that connects immersive 3D environments, conventional websites, multiplayer experiences and social interactions through the decentralized Nostr network.

The goal is an interconnected spatial internet that doesn't need one corporate platform, a proprietary engine, a central identity provider or a mandatory app store.

Users move between ordinary 2D websites and immersive 3D worlds in compatible browsers. Nostr supplies identity, discovery, social relationships, content references and portable preferences.

**Core principle: the worlds are independently hosted, the identities are user-controlled, and the connections are decentralized.**

### 1.1 Deliverables

| Deliverable | What it is | License |
|---|---|---|
| **NSWP** (Part I) | Event formats, manifest format, portal and handoff conventions, conformance levels | CC0 |
| **BitPortal** (Part II) | The reference spatial directory and lobby, built on BitBlocks and hosted at `portal.bitblocks.network` (proposed) | MIT |
| **NSWP Portal SDK** | A small world-side library for portals, manifests and entry points | MIT |
| **Reference worlds** | At least three independently hosted demo worlds, at least one built by someone outside the project | Per world |

### 1.2 Foundational technologies

| Technology | Responsibility |
|---|---|
| Nostr (NIP-01 and others, Appendix B) | Identity, social graph, discovery, metadata, invitations, labels |
| Nostr relays | Distributed indexing and event distribution |
| WebXR | Immersive VR and AR interaction |
| Three.js / WebGPU / WebGL | 3D rendering |
| WebRTC / WebSockets | Real-time multiplayer |
| HTTPS, CDN, Blossom (content-addressed blobs) | World and avatar assets |
| Bitcoin / Lightning (NIP-57 zaps, NWC) | Optional payments and commerce |
| **BitBlocks** (BitLogin, BitFeed, BitGate, BitUnlock) | The reference app's identity, discovery, policy and payments (Part II only) |

NSWP connects existing technologies; it doesn't replace them.

### 1.3 The neutrality rule

NSWP is the protocol and BitPortal is one client of it. To keep the protocol vendor-neutral:

1. Nothing in Part I may reference a BitBlocks package, endpoint, domain or event kind as a requirement.
2. Every NSWP event must be readable and publishable with nothing but a generic Nostr library and a NIP-07 or NIP-46 signer.
3. BitPortal must ship a **"no BitBlocks" mode** that passes Conformance Level 2 (§11). In it, discovery is a plain reverse-chronological list, safety is origin display plus the user's own mutes, and only free worlds are offered. This copies BitFeed's own §83 test, which proves that none of its integrations is required.
4. Before a NIP is proposed, a second client that is not BitBlocks must interoperate (§21).

---

## 2. Vision

A user puts on a headset and opens BitPortal.

They sign in with a passkey or by approving on their phone (no typing a password in VR) and land in a lobby:

- Worlds recommended by people they follow, each with a plain reason ("3 people you follow zapped this").
- Live events happening now and scheduled ones they bookmarked.
- Their bookmarked destinations.
- Friends who chose to share that they're available.
- Ordinary websites as floating windows.

They pick a virtual museum. A portal opens onto the **Airlock**, which shows the real destination origin, whether the publisher is verified for that origin, any warnings from the moderators they trust, and the identity they'll enter as. They confirm, and the museum loads.

Inside the museum is a portal to another creator's world. Walking through it goes back through the Airlock; the source world learns nothing about where they went.

No central company runs the destinations. The user's identity, social graph, discovery algorithm and moderation choices travel with them.

### 2.1 Design principles

1. **Open standards.** Independent developers can implement all core functionality.
2. **Decentralized identity.** Users control their Nostr identities.
3. **Independent hosting.** World operators choose their own infrastructure.
4. **Interoperability.** Compatible clients understand common world and portal metadata.
5. **Progressive enhancement.** Ordinary websites keep working as ordinary websites.
6. **Permission-based immersion.** Users decide when immersive sessions start.
7. **Privacy by default.** Identity, presence, location and navigation history are not shared unless the user chooses.
8. **Graceful degradation.** Unsupported worlds stay reachable through ordinary navigation where possible.
9. **Portable state, replaceable services.** Servers are allowed (multiplayer, payment verification), but no server becomes the source of truth for who a user is, what they own or what they can find. This wording comes from the BitBlocks claim-precision review.
10. **Comfort and accessibility.** Motion-comfort, seated play and input requirements are declared before entry, not discovered afterwards.
11. **Honest claims.** Relay retention is best effort, a signature proves authorship but not safety, and an entitlement doesn't make anything DRM. The spec says so wherever it applies.

---

## 3. System Architecture

NSWP defines four layers. Part II shows how BitPortal fills each one.

### Layer 1: The spatial client

The client displays both ordinary websites and immersive environments. It:

- Renders ordinary HTML websites.
- Supports WebXR.
- Manages ordinary navigation and immersive transitions (the Airlock, §6).
- Discovers and validates world metadata.
- Integrates a Nostr signer, which never lives inside world content.
- Resolves Nostr world references.
- Presents directories, bookmarks and recommendations.
- Enforces security and permission boundaries.

The first implementation is a WebXR web app running in existing headset and desktop browsers. A dedicated browser comes later, if ever.

### Layer 2: Nostr identity and discovery

Nostr provides public-key identities, profiles, the social graph, signed world announcements, recommendations, bookmarks, labels and reports, plus optional invitations and presence.

Nostr does not store or render 3D environments.

### Layer 3: Independently hosted worlds

Each world is hosted by its creator: a Three.js or A-Frame app, a custom WebXR experience, a multiplayer browser game, a gallery, or a spatial front end for an ordinary website. A world can work with no Nostr support at all and still advertise NSWP metadata.

### Layer 4: Real-time services

Real-time features (position sync, voice, shared physics, game state, sessions) run on suitable infrastructure such as WebRTC, WebSockets or a dedicated multiplayer server, not on relays.

### 3.1 Layer map for BitPortal

```text
              ┌──────────────────────────────────────────────┐
  Layer 3/4   │  Independently hosted worlds + their servers │  (not BitBlocks)
              └───────────────▲──────────────────────────────┘
                              │ portal crossing via the Airlock (§6)
              ┌───────────────┴──────────────────────────────┐
  Layer 1     │  BitPortal shell: lobby · Airlock · settings  │
              │   ├─ BitLogin  → who are you        (§13)     │
              │   ├─ BitFeed   → what do you see    (§14)     │
              │   ├─ BitGate   → what may you do    (§15)     │
              │   └─ BitUnlock → did you pay for it (§16)     │
              └───────────────▲──────────────────────────────┘
  Layer 2                     │ NSWP events + standard NIPs
              ┌───────────────┴──────────────────────────────┐
              │  Open substrate: Nostr relays · Lightning     │
              └──────────────────────────────────────────────┘
```

In BitBlocks terms, BitPortal is **an app built with the four primitives** (like Tessera), not a fifth primitive. Its question is **"where can you go."**

---

## 4. Identity

### 4.1 User identity

A user is a Nostr public key, held as lowercase 64-character hex and shown as an `npub` (NIP-19). The private key stays under the user's control. Clients use external or remote signing (NIP-07, NIP-46) and never hand a key or a signer to the worlds they visit.

### 4.2 Portable avatar profile

A user may publish avatar preferences. A proposed addressable event carries them (kind `AVATAR_KIND`, a placeholder; `d` = avatar slot such as `default`):

```json
{
  "kind": "AVATAR_KIND",
  "tags": [
    ["d", "default"],
    ["title", "Example Avatar"],
    ["model", "https://blossom.example/<sha256>.vrm", "vrm", "<sha256>"],
    ["thumb", "https://blossom.example/<sha256>.webp"],
    ["size", "8421376"],
    ["height", "1.72"],
    ["alt", "Avatar preference for Example Avatar"]
  ],
  "content": ""
}
```

- **Format.** VRM 1.0 (built on glTF) is the recommended avatar format, with plain GLB as a fallback. This answers the 0.1 question "which avatar format".
- **Integrity.** Model URLs should be content-addressed (Blossom) and carry the SHA-256, so a world can check the bytes it fetched.
- **Sharing.** The avatar event is public if the user publishes it. Whether a particular *world* gets it is decided at the Airlock (§4.4). A user who wants private avatars doesn't publish this event and instead gives the URL in the entry assertion.
- **Worlds decide.** Worlds keep control of rendering and rules. Avatar portability doesn't oblige any world to accept every model.

### 4.3 Privacy-preserving identity

Users must be able to:

- Browse and enter public worlds without signing in.
- Choose, per world, to enter as **anonymous**, **main identity** or **alternate identity**.
- Refuse avatar, profile or mute-list requests.
- Stop sites from using signing capabilities without permission.

A stable public key is never disclosed automatically to a website.

### 4.4 Identity handoff: the entry assertion (proposed)

The problem: a world is on a different origin from the client, so it can't see the client's signer and shouldn't. Some worlds still want to know who you are, for multiplayer names, entitlements or friends lists.

The proposal: when the user chooses to reveal an identity at the Airlock, the client signs a short-lived **entry assertion** and passes it in the URL **fragment** (`#nswp=…`). Fragments are never sent to servers or written to access logs, and the destination page reads it in JavaScript.

```json
{
  "kind": 27235,
  "created_at": 1794430800,
  "tags": [
    ["u", "https://museum.example/world"],
    ["method", "GET"],
    ["nswp:origin", "https://museum.example"],
    ["nswp:nonce", "b64url-random-128-bit"],
    ["nswp:entry", "main-entrance"],
    ["expiration", "1794430860"]
  ],
  "content": ""
}
```

Rules:

- The assertion uses the NIP-98 event shape (kind 27235) so that existing NIP-98 verifiers can check it. It is bound to the destination **origin** and a random nonce, and expires within 60 seconds (NIP-40 `expiration`).
- The world server must reject reuse of a nonce or event ID, and any assertion whose origin doesn't match its own.
- An anonymous entry carries no assertion, just the entry point.
- Optional extras are only included when the user ticks them at the Airlock: `["nswp:avatar", "<naddr>"]` and `["nswp:mutes", "shared"]` (a pointer to the user's NIP-51 mute list, so the world can hide avatars of people the user has muted).
- This gives a world **proof that a key chose to enter**, nothing more. It is not a session token for anything else.

Using kind 27235 for something other than an HTTP request is a deliberate reuse that needs community review before any NIP (§21). Open question Q1 covers per-world derived identities.

---

## 5. Spatial World Discovery

The central primitive is the **Spatial World Announcement**: a signed, addressable Nostr event that describes an independently hosted destination.

### 5.1 Event classification

- Use an experimental addressable kind in the `30000–39999` range, written as `WORLD_KIND` until assigned. Before choosing one, check it against the NIPs repository, known clients and **the kinds the BitBlocks stack already uses**. BitRoad and BitUnlock products use `30078` (NIP-78), so that kind is ruled out.
- A `d` tag holds the stable world identifier.
- The world is referenced elsewhere by its coordinate `WORLD_KIND:<pubkey>:<d>` (an `a` tag, or an `naddr`).
- A dedicated kind is proposed later through the NIP process (§21).

### 5.2 World announcement event (revised, tag-first)

Relays index **single-letter** tags, so the fields people filter on are single-letter tags. Other display fields are named tags. `content` is a plain-text or Markdown description, and clients don't parse JSON out of it.

```json
{
  "kind": "WORLD_KIND",
  "created_at": 1794430800,
  "tags": [
    ["d", "example-museum"],
    ["title", "Example Virtual Museum"],
    ["summary", "An immersive art gallery with three wings."],
    ["r", "https://museum.example/world"],
    ["image", "https://museum.example/preview.webp", "1920x1080"],
    ["mode", "immersive-vr"],
    ["mode", "inline-3d"],
    ["capability", "webxr"],
    ["capability", "multiplayer"],
    ["capability", "spatial-portals"],
    ["capability", "entry-assertion"],
    ["comfort", "locomotion", "teleport"],
    ["comfort", "intensity", "low"],
    ["comfort", "seated", "supported"],
    ["input", "controllers"],
    ["input", "hands"],
    ["t", "museum"],
    ["t", "art"],
    ["l", "en", "ISO-639-1"],
    ["status", "live"],
    ["manifest", "https://museum.example/.well-known/nswp.json"],
    ["p", "<co-creator hex pubkey>", "", "co-creator"],
    ["a", "30078:<seller pubkey>:<product-d>", "", "access"],
    ["alt", "Spatial world listing: Example Virtual Museum"]
  ],
  "content": "Walk through three wings of rotating exhibitions…"
}
```

This shows the unsigned body; signing adds `id`, `pubkey` and `sig`. `WORLD_KIND` must be replaced with a real kind before anything is implemented.

### 5.3 Tags

| Tag | Req. | Indexed | Purpose |
|---|---|---|---|
| `d` | ✓ | ✓ | Stable world ID within this publisher |
| `title` | ✓ | | Display name |
| `r` | ✓ | ✓ | Entry URL (HTTPS). Lets clients find every announcement of one URL |
| `summary` | | | One-line description |
| `image` | | | Preview image, optional dimensions |
| `mode` | | | `2d`, `inline-3d`, `immersive-vr`, `immersive-ar`; repeatable, in order of preference |
| `capability` | | | `webxr`, `multiplayer`, `voice`, `spatial-portals`, `avatars`, `entry-assertion`, `payments` |
| `comfort` | | | `locomotion` (`stationary`, `teleport`, `smooth`, `vehicle`), `intensity` (`low`, `medium`, `high`), `seated` (`supported`, `required`, `unsupported`) |
| `input` | | | `controllers`, `hands`, `gaze`, `keyboard-mouse`, `touch`, `gamepad` |
| `t` | | ✓ | Topics |
| `l` / `L` | | ✓ | Language and other NIP-32 self-labels |
| `content-warning` | | | NIP-36 content warning, with a reason |
| `status` | | | `live`, `beta`, `maintenance`, `retired` |
| `manifest` | | | Manifest URL (defaults to `<origin>/.well-known/nswp.json`) |
| `p` | | ✓ | Co-creators |
| `a` | | ✓ | Linked objects, such as an access product (§16) |
| `alt` | ✓ | | NIP-31 fallback text for clients that don't understand the kind |

Capability and comfort declarations are **informational**. They never override browser permission requirements, and they are claims until verified by experience and reports.

### 5.4 Operator announcements vs. curation

There are two kinds of "listing", and clients must tell them apart:

- **Operator announcement.** A world event whose `pubkey` is listed as a publisher in the origin's manifest (§7.2). Clients show it as **verified for this origin**.
- **Curation.** Anyone can recommend or list a world without claiming to run it, using a NIP-51 set (`kind 30003` bookmark set or similar) of `a` / `r` references, or a recommendation (§8.2). An unverified world event, where the pubkey isn't in the manifest, is treated as curation: shown, but labelled "listed by", never "by".

### 5.5 Discovery behavior

A client should support:

1. Worlds published or recommended by people the user follows.
2. Search over indexed announcements (`t`, `r`, `l` filters, plus NIP-50 search relays where available).
3. Opening worlds shared in ordinary notes (`naddr` or URL).
4. Curated directories (NIP-51 sets).
5. Bookmarks (§8.3).
6. Signed updates from publishers (a newer `created_at` replaces older addressable events).
7. Availability checks: fetch the manifest, record last-seen, and mark unreachable worlds rather than hiding them silently.

Relays provide discoverability. They don't guarantee that a referenced site is up or safe.

---

## 6. Spatial Hyperlinks, Portals and the Airlock

A **spatial portal** is an object or interface in one environment that links to another destination. The client treats it as navigation between independent websites.

### 6.1 Portal destination

A portal can point at an HTTPS URL, a world coordinate (`naddr`), a named entry point, and an optional spawn pose.

```json
{
  "schema": "nswp/portal/0.2",
  "label": "Enter the Art Gallery",
  "destination": {
    "naddr": "naddr1…",
    "url": "https://gallery.example/world",
    "entry_point": "main-entrance"
  },
  "transition": { "preferred_style": "fade" }
}
```

When both are present, the `naddr` wins. The client resolves it, checks that the event's `r` matches `url`, and treats a mismatch as a warning.

### 6.2 The Airlock: a trusted handoff

0.1 asked for "trusted, non-spoofable destination information", but a web app can't draw trusted UI inside someone else's immersive session. Whoever owns the XR session owns every pixel. So the trusted moment has to happen **between** sessions, on a page the client controls. That page is the **Airlock**.

The Airlock:

1. Shows the **real destination origin** in large type, with publisher verification status (§7.2).
2. Shows the policy verdict (BitPortal: BitGate, §15): warnings, required confirmations, or a block.
3. Shows comfort and input requirements, and whether the user's device meets them.
4. Lets the user choose an identity: anonymous, main or alternate (§4.4).
5. Shows the price, if any, and whether the user already holds an entitlement (§16).
6. Needs a **user gesture** to continue, which WebXR needs anyway to start the next immersive session.

Privacy rules for the Airlock:

- The destination is passed in the **fragment** (`/go#to=<naddr-or-url>`), never in a query string, so no server logs where anyone went.
- The Airlock is a **static page** with no analytics and no server-side component. Any client, world or user can self-host one, and users can choose their own Airlock in settings.
- Portal navigation uses `rel="noreferrer"` and `Referrer-Policy: no-referrer`, so the destination doesn't learn the source world, and the source world doesn't learn which portal was taken once the user is past the Airlock.

### 6.3 Navigation sequence

1. The user approaches a portal. The source world may show a preview using announcement metadata.
2. The user activates it. The source world ends its XR session and navigates to the Airlock with the destination in the fragment. The SDK does this (§6.5).
3. The Airlock resolves and validates the destination (§6.2).
4. The user confirms with a gesture.
5. The client navigates to the destination with `#nswp=…`, carrying the entry point and an optional entry assertion.
6. The destination loads and asks for its own WebXR session on the next gesture.
7. The user arrives at the requested or default entry point.

### 6.4 Limitations, stated honestly

- WebXR requires user activation and permission for each immersive session. NSWP doesn't bypass this.
- Crossing a portal today means a brief exit from immersion. The Immersive Web group's navigation proposal (the `sessiongranted` event, experimental in some headset browsers; check current status) could remove the gap later. Clients should feature-detect it and fall back to the Airlock-plus-gesture flow.
- A *dedicated* browser could render a trusted Airlock inside an ongoing session. A web app can't.

### 6.5 Portal API

The world-side SDK exposes a navigation call that works in any browser:

```javascript
import { portal } from "nswp-sdk";

portal.go({
  naddr: "naddr1…",          // or url
  entryPoint: "main-entrance",
  airlock: "auto"             // user's chosen Airlock, else the default
});
```

A future dedicated browser may also expose `window.nswp.navigate()` natively, and the SDK uses it when it exists. Both are **proposed APIs**, not standards. The SDK's job is to keep world code identical either way.

The destination side reads its arrival context:

```javascript
const arrival = nswp.readArrival();
// { entryPoint: "main-entrance", assertion?: SignedEvent, avatar?: naddr }
// Always verify `assertion` server-side before trusting it.
```

---

## 7. World Manifest

### 7.1 Location

The manifest lives at **`https://<origin>/.well-known/nswp.json`**, the same pattern as NIP-05's `nostr.json`. An announcement can point elsewhere with its `manifest` tag, but the well-known path is the one used for verification.

### 7.2 Example

```json
{
  "schema": "nswp/manifest/0.2",
  "publishers": {
    "<hex pubkey>": { "worlds": ["example-museum"] }
  },
  "worlds": {
    "example-museum": {
      "entry": { "url": "https://museum.example/world", "modes": ["immersive-vr", "inline-3d"] },
      "entry_points": ["main-entrance", "north-wing", "rooftop"],
      "capabilities": ["webxr", "spatial-portals", "avatars", "multiplayer", "entry-assertion"],
      "avatar": { "formats": ["vrm", "glb"], "max_file_size_mb": 10, "max_triangles": 70000 },
      "multiplayer": { "endpoint": "wss://museum.example/session", "auth": "entry-assertion" },
      "budgets": { "initial_download_mb": 40 }
    }
  },
  "relays": ["wss://relay.example"]
}
```

### 7.3 Verification and conflict rules

- **Publisher verification.** An announcement is *verified for its origin* only when its `pubkey` appears under `publishers` in the manifest served from the origin of its `r` URL, and (if `worlds` is listed) its `d` is one of them.
- **Who wins on conflict.** The manifest wins on **technical** fields (entry URL, entry points, budgets, multiplayer endpoint), because the origin controls what actually runs. The signed announcement wins on **descriptive** fields (title, summary, topics, images). Where they disagree on a technical field, clients show the manifest's value and flag the mismatch.
- **Validation.** Clients check the schema, require HTTPS, limit the manifest to 64 KB, ignore unknown fields, and never treat manifest claims as permissions.
- A manifest is optional. A world without one can still be announced, but it is never shown as verified.

---

## 8. Shared Social Features (mapped to existing NIPs)

The project reuses existing NIPs wherever possible and defines new kinds only for worlds and avatars.

### 8.1 Friends and social graph

The client uses NIP-02 follows (kind 3), NIP-65 relay lists (kind 10002) and NIP-51 lists to recommend worlds. A follow graph is a recommendation signal, never an access rule.

### 8.2 Recommendations and reviews

- **Reviews and comments:** NIP-22 comments (kind 1111) scoped to the world coordinate.
- **Reactions:** NIP-25 (kind 7) on the world event.
- **Tips:** NIP-57 zaps to the publisher (§16.4). Zap totals from followed accounts are a strong discovery signal.
- **Shares:** ordinary notes containing an `naddr`.

### 8.3 Spatial bookmarks

- Public bookmarks go in a NIP-51 bookmark list (kind 10003) or named bookmark sets (kind 30003) holding `a` tags for world coordinates.
- Private bookmarks use NIP-51's encrypted private items (NIP-44 encrypted to self), not public events.
- Entry points and personal labels ride along as extra tag values.

### 8.4 Invitations

Invitations are private by default: a NIP-17 direct message (NIP-59 gift-wrapped) containing the world `naddr`, an entry point and optionally a time. Public invitations are just notes.

### 8.5 Presence

Presence is optional and particularly privacy-sensitive.

- The default is **off**.
- Coarse public status ("in VR", "available to hang out") uses NIP-38 user status (kind 30315) with a NIP-40 `expiration` no more than 15 minutes ahead, refreshed while active.
- Status that names a world goes **only** to a chosen audience, gift-wrapped (NIP-59) to a close-friends list, and it expires.
- **Exact position, movement history and attendance records are never published.** Ephemeral or encrypted mechanisms are preferred to permanent public records.

### 8.6 Events and gatherings

- Scheduled gatherings use NIP-52 calendar events (kinds 31922/31923) that reference the world coordinate.
- Gatherings happening now use NIP-53 live activities (kind 30311), so existing Nostr clients can show "happening now in world X".

---

## 9. Multiplayer Interoperability

Nostr doesn't replace real-time networking. A multiplayer world uses Nostr for identity and invitations and runs its own networking.

```text
Nostr identity → entry assertion (§4.4) → world auth endpoint → session server → real-time sync
```

### 9.1 Minimum expectations

The protocol doesn't standardize physics, combat, animation or interaction systems. It defines only:

- How worlds advertise multiplayer (`capability`, `multiplayer` in the manifest).
- One optional auth method, `entry-assertion`: the world server verifies the signature, origin, nonce and expiry, then issues its *own* session.
- That world sessions never require a user's signer after entry. Later in-world signing (for example, posting a note from inside a world) goes back through the client with its own consent prompt, or isn't offered.

### 9.2 Cross-world sessions

Continuous sessions that span providers are out of initial scope. They may later need separate standards for session transfer, party handoff ("bring my group through the portal") and cross-world communication. Party handoff is the likeliest first extension: one invitation per member, all pointing at the same destination and entry point.

---

## 10. Portable Digital Assets

### 10.1 Asset rules

- **Formats.** glTF/GLB and VRM, with KTX2/Basis textures and Meshopt or Draco compression. Clients and worlds should refuse other executable or scriptable formats.
- **Integrity.** Assets referenced from Nostr carry a SHA-256 and should be served from Blossom or another content-addressed store, so any mirror can serve them.
- **Budgets.** Worlds publish budgets (§7.2), and clients enforce their own hard limits whatever a world claims. Defaults: avatar ≤ 10 MB and ≤ 70k triangles; initial world download warned above 50 MB.

### 10.2 Possessions and entitlements

Longer term, NSWP could cover avatar clothing, art objects, collectibles, tickets and creator-issued entitlements.

A signed claim proves who issued it, not universally recognized ownership or exclusive possession. **Each world decides which issuers, claims, licenses and formats it accepts.** In BitPortal, paid entitlements come from BitUnlock (§16).

### 10.3 Bitcoin and Lightning

Payments are optional, and browsing public worlds never requires one. Uses include admission, tips, subscriptions, purchases and paid events.

---

## 11. Conformance Levels

These levels are a proposed roadmap, not a certification program. The column on the right shows how BitPortal meets each one; any other client can meet them its own way.

| Level | Requirements | BitPortal |
|---|---|---|
| **1 — Discovery** | Relay connectivity; read world announcements; directory; ordinary navigation; origin verification display | BitFeed lobby, or a plain list in no-BitBlocks mode |
| **2 — Immersion** | WebXR; capability detection; user-approved entry; manifests; Airlock portal navigation | Airlock + SDK |
| **3 — Identity portability** | External signing; per-world identity choice; entry assertions; avatar preferences; bookmarks | BitLogin |
| **4 — Social interoperability** | Recommendations; invitations; optional presence; events; multiplayer auth | BitFeed recipes, NIP-17/38/52/53 |
| **5 — Advanced spatial networking** | Seamless transitions; party handoff; portable entitlements; cross-world conventions | BitUnlock entitlements; `sessiongranted` |
| **Safety (applies to every level)** | Show the destination origin before navigation; user blocks and mutes; report flow; asset limits | BitGate + shell limits |

---

## 12. Security and Trust

### 12.1 Threats

| Threat | Notes |
|---|---|
| Malicious or impersonating world announcements | Countered by origin verification (§7.3) and labels (§15) |
| Spatial phishing: a fake portal or fake destination | Countered by the Airlock (§6.2) |
| **Credential phishing inside a world** | A world draws a pixel-perfect fake "BitLogin" or signer prompt in VR and harvests a password. See §12.3 |
| Tracking through persistent identities | Countered by per-world identity choice, no-referrer, fragments |
| Navigation-history leakage | The Airlock is static and doesn't log; destinations are passed in fragments |
| Replay of entry assertions | Origin binding, nonce, 60-second expiry, single-use event ID |
| Hostile or oversized avatar and world assets | Format allow-list, hash checks, hard budgets |
| Unauthorized signer requests | The signer lives only in the client shell; worlds never get `window.nostr` from the client |
| Spam and Sybil announcements | Social-distance ranking (BitFeed) plus trusted labels (BitGate) |
| Harassment inside worlds | The world's responsibility, helped by optional mute-list sharing (§4.4) |
| Comfort-related harm (motion sickness, photosensitivity) | Comfort metadata, content warnings, reports for mislabelled comfort |
| Excessive resource use | Client-side budgets and a visible exit control |

### 12.2 Client protections

Clients should: show verified destination origins; require consent before releasing any identity information; keep signing out of world content; validate manifests; restrict media and model formats; enforce navigation and permission boundaries; provide clear exit and safety controls; and offer blocking, reporting and relay filtering.

### 12.3 Never enter credentials inside a world

Immersive content can imitate any UI. The client therefore teaches and enforces one rule: **you never type your password or recovery phrase inside a world.**

- Sign-in happens only in the client's own 2D surface, before entering immersion.
- In headsets, the preferred sign-in methods need nothing typed: a **passkey** (WebAuthn PRF) or **approval on a phone** (NIP-46 `nostrconnect`). Both happen outside the world's pixels and resist phishing by design.
- Worlds that need their own login send the user back through the Airlock rather than drawing a login form in VR.
- The SDK doesn't include, and the spec discourages, any in-world credential entry component.

---

# Part II — BitPortal: the BitBlocks reference app

## 13. Identity: BitLogin ("who are you")

**Role.** BitLogin is BitPortal's only session source (BitBlocks D8). It provides the signer behind publishing, bookmarks, reviews, invitations and entry assertions.

**Integration**

- BitPortal embeds `<bitlogin-auth>` in its 2D shell, vendored same-origin from a **tagged BitLogin release with its integrity manifest** (D7), never hotlinked. The widget runs same-origin with the host, so it is part of BitPortal's trusted computing base.
- BitPortal consumes the session through BitLogin's NIP-07-shaped signer, passed **explicitly** to anything that needs it (D8). It listens for `bitlogin:login` / `bitlogin:logout` (D2) and reads `pubkey` (D1). Until those aliases ship, a thin adapter reads the current hyphen events and `publicKey`, the same way BitFeed's adapter does today.
- **Headset-first method order.** On a headset, the widget leads with passkey and phone approval (NIP-46 QR), then extension (NIP-07), with password last. On desktop, BitLogin's default order applies.
- **Session continuity.** Signing in on desktop and continuing in a headset works through NIP-46 or a passkey synced by the platform. BitPortal never moves keys between devices itself.
- **Signing inside immersion.** DOM elements aren't visible in immersive VR, so the BitLogin widget can't appear there. Actions that need a signature mid-session either queue until the user exits to the 2D shell, or are approved on the phone through NIP-46.

**Identities per world**

- **Anonymous:** no assertion.
- **Main:** the BitLogin account.
- **Alternate:** a second BitLogin account the user created on purpose, or any NIP-07/NIP-46 signer.

Deriving a fresh key per world automatically would touch BitLogin's derivation chain, which is a frozen compatibility contract, so it is out of scope here (open question Q1).

**Purchases.** BitUnlock purchases may use a separate device key rather than the BitLogin identity (the Satisfied pattern, D8). BitPortal offers this as "buy privately", so the payment service never learns which identity is behind a ticket.

## 14. Discovery: BitFeed ("what do you see")

**Role.** BitFeed composes the lobby. World announcements, curated sets, recommendations and live events are the candidates, and **recipes** decide what the user sees and why.

**Integration**

- BitPortal vendors the single-file `bitfeed.js` at a **pinned version** with SRI (D7). It doesn't import the unversioned hosted URL. BitFeed core is DOM-free, so it runs in a Web Worker beside the render loop and never blocks a frame.
- `@bitfeed/nostr` providers supply signals such as `nostr.following`, `nostr.zaps`, `nostr.reactions`, `nostr.hashtags` and `nostr.interests`. `@bitfeed/bitlogin` turns the session into the viewer. `@bitfeed/bitgate` and `@bitfeed/bitunlock` plug in policy and entitlement (§15, §16).
- BitPortal builds one **BitViewer v1** object (D10: `pubkey?`, `relays`, `follows`, `mutes`, `interests`, `session`) and passes the same object to BitFeed and BitGate. A field that is missing means "unknown", and `[]` means "known empty". The viewer object stays inside BitPortal and never goes to worlds.

**Default lobby recipes**

| Shelf | Recipe sketch |
|---|---|
| From people you follow | Announcements and recommendations authored within social distance 1, newest first |
| Loved by your network | Zaps and reactions from follows, decayed by age |
| Happening now | NIP-53 live activities that reference worlds, plus upcoming NIP-52 events |
| New worlds | Recent verified operator announcements, with seeded exploration so new creators surface |
| Your bookmarks | The NIP-51 bookmark list in the user's order |
| Matches your interests | NIP-51 interests ∩ world `t` tags |
| Comfortable for you | Filters on the user's comfort settings (seated only, low intensity) |

**User-owned algorithm.** Every shelf carries BitFeed's **explanation** ("ranked because 3 follows zapped it"), shown on the world card and in the Airlock. Users can adjust or replace recipes and share them as events, so a community can publish its own lobby. A signed-out lobby uses a small seed recipe; following nobody doesn't silently fall back to an operator's choices without saying so.

**Ads.** The `@bitfeed/adzap` adapter is **off by default** and not part of the MVP. If it is ever enabled, it stays an explicit opt-in with BitFeed's privacy boundary between preferences and ad matching.

## 15. Trust and safety: BitGate ("what may you do")

**Role.** BitGate answers 0.1's open question about telling safe worlds from malicious ones without a central gatekeeper: **each user picks whose labels they trust**, and BitGate turns those labels into a decision with four dimensions.

**Mapping BitGate's four dimensions to BitPortal**

| Dimension | Where it acts in BitPortal |
|---|---|
| `visibility` (`allow` → `warn` → `restrict` → `hide` → `deny`) | Lobby and search: `warn` shows a content warning on the card; `hide` and `deny` remove the world from shelves (direct links still work, through the Airlock) |
| `interaction` (`allow` → `require-explicit-action` → `deny`) | The Airlock: `require-explicit-action` adds a second, explained confirmation; `deny` disables the portal button and shows the reason |
| `transaction` (`allow` → `require-review` → `deny`) | Paid entry (§16): blocks or warns before any BitUnlock quote is requested |
| `ranking` (`normal` → `downrank`) | Passed into BitFeed as a scorer |

**Signals**

- NIP-32 labels (kind 1985) in a `bitportal:moderation` namespace, targeting a world coordinate (`a`), a publisher (`p`) or an origin (`r`).
- NIP-56 reports (kind 1984) from the user's trust graph, including **comfort mislabelling** (a world that says "low intensity" and isn't).
- The viewer's own NIP-51 mutes and blocks, which always apply.

**Policy and defaults**

- BitPortal starts from BitGate's `social` preset with a spatial-specific policy layered on top. BitGate's engine carries no thresholds of its own, so BitPortal's policy is just data and users can replace it.
- **Fails open for discovery, never for the Airlock's origin display.** As in BitRoad, if the engine can't load or relays are quiet, worlds still appear. The Airlock *always* shows the real origin and verification status whatever BitGate says.
- **Default moderators.** None by default; trust comes from the user's own follows. A user or community can add moderator keys. Any default seed list stays a fallback, per BitGate's rule that seeds stop counting once a viewer has real contacts (open question Q5).
- **Reasons.** Every block or warning shows BitGate's explanation, using BitGate's kebab reason IDs mapped to BitPortal's own wording (D4b).

**Gap to confirm.** Labels that target an **origin or URL** rather than a coordinate or pubkey may not be supported by BitGate today. If not, BitPortal raises it as a BitGate feature request rather than working around it.

## 16. Payments and entitlements: BitUnlock ("did you pay for it")

**Role.** BitUnlock provides paid world access, tickets, season passes and paid downloadable assets, all with payment verified and delivery encrypted to the buyer's key.

**Model**

- A paid world's announcement references a BitUnlock product with `["a", "30078:<seller>:<d>", "", "access"]`. The seller registers the product with BitUnlock as usual.
- The Airlock shows the price. On purchase, BitPortal requests a quote, the user pays (Lightning or NWC), and BitPortal unlocks a **buyer-bound NIP-44 envelope**. That envelope holds whatever the world defined: a private entry URL, an access token, or an asset decryption key.
- **The world server must verify access itself.** It checks BitUnlock's signed entitlement for the entering key (from the entry assertion) and the product coordinate. BitUnlock's renewable term access covers subscriptions and season passes, and seller revocation covers refunds and bans.
- All BitUnlock HTTP calls use **BitUnlock's exported NIP-98 helper** (D9), with `u`, `method`, `payload` and `bitunlock:nonce`, and a fresh event for every attempt. BitPortal doesn't hand-roll NIP-98, which is where Tessera's integration went wrong.
- BitPortal uses the SDK's `normalizeOrder()` (D5) and its retryability table (D4). `idempotency_in_progress` is retryable; treating it as permanent once stranded a real paid order in Satisfied.

**Privacy option.** "Buy privately" pays with a per-device purchase key (D8), so the ticket is bound to a key that is not the user's main identity. Entering with that key is a deliberate choice of alternate identity at the Airlock.

**Honest limits.** BitUnlock is currently a hosted, limited mainnet beta. The protocol is open to self-hosted implementations, and no NSWP field depends on BitUnlock specifically. Without enforcement by the world server, an entitlement is a soft gate, not DRM.

**Tips are not BitUnlock.** Tips and donations are plain NIP-57 zaps to the world publisher's Lightning address and need no BitUnlock involvement.

## 17. Other BitBlocks-family integrations (optional, after the MVP)

| Project | Possible role | Priority |
|---|---|---|
| **Tessera** ("what can you do") | Publish the NSWP Portal SDK and a "world publisher" agent plugin, so agents can validate manifests and announce worlds through Tessera's registry | Low; a good dogfooding opportunity |
| **BitRoad** | In-world shop kiosks that link to BitRoad storefronts for virtual goods; shared soft-gate and BitUnlock tier model | Later |
| **BitVid** | NIP-71 video events rendered as in-world screens and theatres; watch parties through NIP-53 | Later |
| **BitDrive** | An encrypted vault where creators keep private world and avatar sources, publishing selected assets to Blossom | Later, and not a stack primitive |
| **AdZap** | Sponsored lobby placement, opt-in only (§14) | Not planned |

None of these is a dependency of NSWP or of BitPortal's MVP.

## 18. BitBlocks API convention compliance

BitPortal is a new consumer, so it starts compliant with every accepted convention and keeps a "known consumers" entry in each block's D0 table.

| Convention | What BitPortal does |
|---|---|
| D0 back-compat | Adds itself to each block's known-consumer list; relies only on documented surfaces |
| D1 `pubkey` | Uses lowercase hex `pubkey` internally; `npub` for display only |
| D2 events | Listens for `<lib>:<verb>` colon events; any BitPortal custom elements emit `bitportal:<verb>` with `bubbles` and `composed` |
| D3 CSS | Any BitPortal elements use `--bitportal-*` custom properties |
| D4 errors | One `BitPortalError {code, message, retryable, details?}` with snake_case codes |
| D6 versions | Exposes `window.bitportal.version` and `export const VERSION`; NSWP schema versions (`nswp/manifest/0.2`) are kept separate |
| D7 distribution | Vendors every block from a tagged release with its integrity manifest; a CI check compares the vendored hashes with the release manifests |
| D8 signer | One NIP-07-shaped signer, passed explicitly; purchase signer can be separate |
| D9 NIP-98 | Uses BitUnlock's exported helper for every BitUnlock call |
| D10 viewer | Builds one BitViewer v1 and shares it between BitFeed and BitGate; never sends it to worlds |
| D11 license | MIT for BitPortal and the SDK; CC0 for the NSWP spec |

---

## 19. Minimum Viable Product

**Goal:** show decentralized discovery and safe navigation between independently hosted immersive worlds, using the BitBlocks stack, without making the protocol depend on it.

Each phase has an exit criterion that has to be met before the next starts.

### Phase 0: Protocol fixtures
- JSON Schemas for the world event, manifest, portal and entry assertion.
- Test vectors: signed example events, valid and invalid manifests, assertion replay cases.
- An event-kind collision check covering `WORLD_KIND` and `AVATAR_KIND`.
- Two reference worlds with `.well-known/nswp.json`.

**Exit:** a third party can validate an announcement and a manifest using only the schemas and vectors.

### Phase 1: Read-only lobby
- BitPortal static shell on desktop and at least one standalone headset browser.
- Reads announcements from relays and shows verified vs. listed worlds.
- BitFeed with the signed-out seed recipe, and the no-BitBlocks fallback list.
- The Airlock, with a self-hostable static build.

**Exit:** a signed-out user in a headset browses, passes the Airlock and enters three independently hosted worlds, and the no-BitBlocks mode does the same.

### Phase 2: Publishing with BitLogin
- BitLogin sign-in (passkey and NIP-46 first on headsets).
- A publish form: enter a URL, fetch and validate the manifest, check publisher verification, sign, and publish to the user's NIP-65 write relays.
- Generates a `.well-known/nswp.json` snippet for the creator to host.

**Exit:** a developer outside the project announces a verified world without asking anyone.

### Phase 3: Social discovery and safety
- BitFeed shelves (§14) with explanations; NIP-51 bookmarks; NIP-22 reviews; zaps.
- BitGate labels, reports and mutes across all four dimensions; reason display in the Airlock.

**Exit:** a user's lobby differs meaningfully, with explanations, depending on who they follow, and a trusted moderator's label visibly changes the outcome for users who trust that moderator and not for users who don't.

### Phase 4: Portal SDK and identity handoff
- `nswp-sdk`: `portal.go()`, `readArrival()`, manifest helper, and a server-side assertion verifier.
- Per-world identity choice and entry assertions.
- One multiplayer reference world that authenticates with an entry assertion.

**Exit:** two worlds by different authors link to each other through portals, and the multiplayer world shows the chosen identity, or "guest" for anonymous entry.

### Phase 5: Paid access with BitUnlock
- A paid reference world and a ticketed event, using BitUnlock entitlements that the world server verifies.
- The "buy privately" purchase key.

**Exit:** a real Lightning payment grants entry, and a refund or revocation removes it.

### Phase 6: Presence, invitations and events
- NIP-17 invitations, opt-in NIP-38 presence with expiry, NIP-52 and NIP-53 events in the lobby.

**Exit:** a group of friends arranges a meetup and arrives at the same entry point without anyone publishing a permanent location record.

---

## 20. Reference Implementation

| Component | Candidate |
|---|---|
| Spatial interface | Three.js (WebGL now, WebGPU when available) |
| Immersive API | WebXR, feature-detecting `sessiongranted` |
| Shell UI | HTML/CSS/JS, static output, strict CSP, all scripts same-origin |
| Nostr | nostr-tools (or NDK) |
| Identity | BitLogin (vendored release); any NIP-07/NIP-46 signer in no-BitBlocks mode |
| Discovery | BitFeed `bitfeed.js` (pinned, with SRI) in a Web Worker |
| Policy | BitGate standalone bundle (vendored, once MIT-licensed; see §21.1) |
| Payments | `@bitunlock/sdk` (once published under MIT); NIP-57 for tips |
| Assets | Blossom servers; glTF/VRM loaders with KTX2 and Meshopt |
| World hosting | Static HTTPS hosting |
| Multiplayer reference | WebSocket server with entry-assertion auth; WebRTC for voice |
| Build | Vite → static `dist/`; TypeScript |
| Hosting | `portal.bitblocks.network` on the same static-hosting pattern as the other block sites (proposed) |

Prioritize desktop and one standalone headset browser first. Consider a dedicated browser fork only after the discovery, Airlock and handoff model is validated.

### 20.1 Dependencies and blockers in the BitBlocks stack

These items, recorded in the BitBlocks API conventions (October 2026), affect BitPortal directly. BitPortal therefore becomes a **forcing function for the BitBlocks Phase 1 cleanup** rather than a reason to work around it. Each item that changes another repository, release, license or live API still needs the owner's approval in that repository.

| Block | Current state | Impact on BitPortal | Needed before |
|---|---|---|---|
| BitLogin | Three different builds in circulation; no official tagged release with an integrity manifest; colon events, `pubkey` field and `getSigner()` / `capabilities()` not yet shipped | Pin one build; use an adapter until D1/D2/D8 land | Phase 2 |
| BitFeed | Hosted `bitfeed.js` has no version in its URL; engine and package versions disagree (0.3.0 vs 0.1.0); BitViewer widening pending | Vendor a pinned copy and record its hash | Phase 1 |
| BitGate | GPL-3.0-or-later until the accepted MIT relicense actually ships; standalone bundle not hosted; origin/URL label targets unconfirmed | **Don't vendor BitGate into MIT BitPortal until relicensed**; Phase 3 waits on it | Phase 3 |
| BitUnlock | SDK unpublished, with no license file; limited mainnet beta | Phase 5 waits on the SDK being published under MIT | Phase 5 |

---

## 21. Standards Strategy

The project could eventually propose:

**NIP-XX: Spatial World Announcements**: the world kind, tags, the `.well-known/nswp.json` verification rule, and the operator-vs-curation distinction.

Possibly a companion: **NIP-XX: Portable Avatar Preferences**.

Portal navigation, the Airlock and the entry assertion go into a **separate, non-NIP specification**, because they concern browsers and web origins more than the Nostr protocol.

Before proposing a NIP:

- Review related NIPs and existing implementations (Appendix B).
- Prototype under a clearly experimental namespace and kind.
- Get feedback from Nostr client and relay developers, and from the Immersive Web community on the Airlock and handoff.
- **Demonstrate interoperability between BitPortal and at least one client that is not BitBlocks.**
- Don't claim kind numbers without community coordination.

NIP-78 (kind 30078) is app-specific storage. It isn't a long-term substitute for an interoperable world-discovery standard, and BitRoad and BitUnlock already use it.

### 21.1 Licensing and governance

- The NSWP spec is CC0 and lives in its own repository, separate from BitPortal's code.
- BitPortal and the SDK are MIT. BitGate must be relicensed to MIT (accepted as the target, not yet done) before BitPortal bundles it.
- Spec changes are proposed as pull requests against the spec repository. Once a second client exists, a change to Part I needs agreement from at least one implementer who is not BitPortal.

---

## 22. Non-Goals

The first version will **not**:

- Replace existing web browsers.
- Render arbitrary Three.js sites in VR automatically.
- Define a universal physics engine or interaction system.
- Guarantee continuous, loading-free transitions.
- Standardize every avatar and animation system (VRM is recommended, not required).
- Replace multiplayer game servers.
- Require Bitcoin, Lightning or any BitBlocks component.
- Guarantee that possessions work across every world.
- Establish a central authority over destinations, including a mandatory default moderator.
- Add a fifth BitBlocks primitive. BitPortal is an app on the four, and any gap it finds goes back to the block that owns it.
- Provide in-world credential entry.

---

## 23. Open Questions

**Q1 Identity:** should per-world identities be derived keys (which would need BitLogin spec work, since its derivation chain is frozen), separate accounts made on purpose (today's answer), or something else, such as a NIP-26-like delegation successor?

**Q2 Navigation:** which parts of the Airlock and handoff can be standardized now, and which wait for `sessiongranted` or a dedicated browser?

**Q3 Entry assertion kind:** is reusing kind 27235 (NIP-98) acceptable to the community, or does the assertion need its own ephemeral kind?

**Q4 Airlock centrality:** if nearly everyone uses BitPortal's hosted Airlock, it becomes a soft point of centralization even though it is static and doesn't log. Should worlds be able to embed the SDK's own Airlock, and should clients prefer a local one?

**Q5 Trust defaults:** should BitPortal ship any default moderator keys for new users with no follows, and if so, who holds them and how is that disclosed?

**Q6 BitGate targets:** does BitGate need first-class origin/URL targets, or can origin-level labels be expressed through world coordinates alone?

**Q7 Avatars:** VRM 1.0 as the recommendation, but what are the default triangle, texture and bone budgets per device class?

**Q8 Presence:** can "friends nearby in world X" work through gift-wrapped status alone, or does it need a presence relay with stronger privacy guarantees?

**Q9 Portability:** how should worlds recognize BitUnlock entitlements issued for *another* world's product (cross-world passes, creator bundles)?

**Q10 Governance:** how does the standard stay vendor-neutral when the first and best-funded client is BitBlocks-branded?

**Q11 Naming:** "BitPortal" is a working name. It needs a trademark and collision check before public use. Alternatives include BitRealm, BitWorlds and "Portal" under the BitBlocks brand.

---

## 24. Long-Term Vision

The aim isn't one enormous virtual world. It's a network of independently created worlds, connected through open protocols.

Just as the web links documents and applications through URLs, the spatial web can link immersive places through discoverable destinations and portals. Nostr provides identity, discovery and social connection, WebXR provides the immersive interface, and independent developers build the worlds. BitBlocks shows that identity, discovery, policy and payments can be portable objects rather than platform-owned services. Users decide where they go, which identity they use and what they share.

### Foundational statement

**The spatial web should be a network, not a platform.**

**Worlds should be places you visit, not applications you must install.**

**Identity should belong to the individual, not the world operator.**

**A portal should be as open as a hyperlink, and as honest about where it leads.**

---

## Appendix A: Standards and References

- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-02: Follow List](https://github.com/nostr-protocol/nips/blob/master/02.md)
- [NIP-05: DNS-based identifiers](https://github.com/nostr-protocol/nips/blob/master/05.md) (pattern for `.well-known`)
- [NIP-07: Browser Signer Interface](https://github.com/nostr-protocol/nips/blob/master/07.md)
- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-19: Bech32-Encoded Entities](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [NIP-22: Comments](https://github.com/nostr-protocol/nips/blob/master/22.md)
- [NIP-25: Reactions](https://github.com/nostr-protocol/nips/blob/master/25.md)
- [NIP-31: Unknown event `alt` tag](https://github.com/nostr-protocol/nips/blob/master/31.md)
- [NIP-32: Labeling](https://github.com/nostr-protocol/nips/blob/master/32.md)
- [NIP-36: Sensitive Content](https://github.com/nostr-protocol/nips/blob/master/36.md)
- [NIP-38: User Statuses](https://github.com/nostr-protocol/nips/blob/master/38.md)
- [NIP-40: Expiration](https://github.com/nostr-protocol/nips/blob/master/40.md)
- [NIP-44: Encrypted Payloads](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-46: Remote Signing](https://github.com/nostr-protocol/nips/blob/master/46.md)
- [NIP-50: Search](https://github.com/nostr-protocol/nips/blob/master/50.md)
- [NIP-51: Lists](https://github.com/nostr-protocol/nips/blob/master/51.md)
- [NIP-52: Calendar Events](https://github.com/nostr-protocol/nips/blob/master/52.md)
- [NIP-53: Live Activities](https://github.com/nostr-protocol/nips/blob/master/53.md)
- [NIP-56: Reporting](https://github.com/nostr-protocol/nips/blob/master/56.md)
- [NIP-57: Lightning Zaps](https://github.com/nostr-protocol/nips/blob/master/57.md)
- [NIP-59: Gift Wrap](https://github.com/nostr-protocol/nips/blob/master/59.md)
- [NIP-65: Relay List Metadata](https://github.com/nostr-protocol/nips/blob/master/65.md)
- [NIP-78: Arbitrary Custom App Data](https://github.com/nostr-protocol/nips/blob/master/78.md)
- [NIP-89: Recommended Application Handlers](https://github.com/nostr-protocol/nips/blob/master/89.md) (so other clients can hand world events to BitPortal)
- [NIP-94: File Metadata](https://github.com/nostr-protocol/nips/blob/master/94.md)
- [NIP-98: HTTP Auth](https://github.com/nostr-protocol/nips/blob/master/98.md)
- [Blossom (BUDs)](https://github.com/hzrd149/blossom)
- [W3C WebXR Device API](https://www.w3.org/TR/webxr/)
- [Immersive Web CG: WebXR navigation proposal](https://github.com/immersive-web/navigation)
- [VRM specification](https://github.com/vrm-c/vrm-specification)
- [Three.js](https://threejs.org/)
- BitBlocks: [bitblocks.network](https://bitblocks.network/), [BitLogin](https://login.bitblocks.network/), [BitGate](https://gate.bitblocks.network/), [BitFeed](https://feed.bitblocks.network/), [BitUnlock](https://bitunlock.network/), [Tessera](https://tessera.bitblocks.network/)

## Appendix B: Event and NIP map

| Need | Mechanism | New kind? |
|---|---|---|
| World announcement | `WORLD_KIND` (addressable, experimental) | **Yes** |
| Avatar preference | `AVATAR_KIND` (addressable, experimental) | **Yes** |
| Origin verification | `/.well-known/nswp.json` (HTTP, not an event) | No |
| Entry assertion | Kind 27235 (NIP-98 shape) + NIP-40 expiration | No (Q3) |
| Curation and directories | NIP-51 sets (30003) | No |
| Bookmarks (public and private) | NIP-51 (10003 / 30003, NIP-44 private items) | No |
| Reviews and comments | NIP-22 (1111) | No |
| Reactions | NIP-25 (7) | No |
| Tips | NIP-57 zaps | No |
| Invitations | NIP-17 / NIP-59 | No |
| Presence | NIP-38 (30315) + NIP-40; gift-wrapped when it names a world | No |
| Scheduled and live events | NIP-52 (31922/31923), NIP-53 (30311) | No |
| Moderation | NIP-32 labels (1985), NIP-56 reports (1984), NIP-51 mutes | No |
| Paid access | BitUnlock product (30078) referenced by `a` tag; signed entitlements | No (BitBlocks-specific, optional) |
| Handler discovery | NIP-89 (31989/31990) | No |

*This is a conceptual technical proposal. As of this draft, NSWP is not an adopted Nostr Improvement Proposal, a W3C standard or an implemented interoperability protocol, and BitPortal is not yet built.*

---

**End of specification, version 0.2**
