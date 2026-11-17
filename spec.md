# Nostr Spatial Web Protocol (NSWP) and BitPortal
## An open, decentralized spatial web built on Nostr and WebXR, with a reference app on the BitBlocks stack

**Version:** 0.5.2 (concept specification)
**Status:** Exploratory draft / proposed protocol
**Date:** November 17, 2026
**Previous versions:** 0.3.1 and 0.2 (git history); 0.1 (`docs/history/spec-v0.1.md`)
**License recommendation:** CC0 for the protocol (Part I); MIT for BitPortal and the SDK (Part II), matching BitBlocks convention D11

---

## 0. What changed in 0.5.2

- **Phase 2 is started** (§20): BitPortal has a sign-in page using a pinned BitLogin build, and a page for announcing a world. Neither has been tried with a real account yet.
- **BitLogin's build is now pinned by hash** (§21.1). Rebuilding it from source is byte-identical and matches the live site, which settles which of the builds in circulation is the real one.

## 0. What changed in 0.5.1

- **The walk-in lobby is built** (§20, Phase 1): BitPortal's doors as a hall, usable in a headset, with a shared room. The avatar and voice code moved into the SDK as `nswp-sdk/three` so worlds and BitPortal share it.

## 0. What changed in 0.5

- **Phase 1 is built** (§20): BitPortal's read-only lobby and its own Airlock, in a separate `bitportal` repository, deployed for testing at `bitportal.vercel.app`.
- **Rooms that outlive their host** (§9.10): a heartbeat so a dead room stops reading as live, succession so a room survives its host leaving, and a salted fingerprint of the guest list for private rooms. All three are taken from COMBATRIG, where they were worked out in play.
- **Found while building the lobby:** a shelf can't require "verified" without contacting every listed world (§14); a site that hasn't adopted NSWP gets a plain visit with no arrival context (§4.4); the Airlock knows the starter set's worlds without asking a relay (§6.2).

## 0. What changed in 0.4.1

- **The rooms spike is built** (§20, Phase 4b): a guests-only, peer-to-peer room with avatars and voice in both reference worlds. Its findings are recorded in §9.4 and §9.8.

## 0. What changed in 0.4

**Shared rooms** (§9): how two or more people share a world, without requiring anyone's server.

- A room's traffic travels **peer-to-peer** between participants, or through a **hosted** room server that anyone can run. Identity, access rules, moderation, invitations and the developer's code are the same either way, and a room can be promoted from one to the other while it is running.
- Rooms are described with the existing NIP-53 room event (kind 30312).
- **The room pass** (§9.2) lets a world prove who is in a room without ever holding the user's signer.
- Access can be open, by invitation, by a Nostr list of people, by the host's follows, or by ticket (§9.3).
- New phases: **4b** (peer-to-peer rooms) and **7** (hosted rooms). Existing phase numbers are unchanged.
- Rooms are not built yet. The Phase 0 library, schemas and vectors cover the 0.3.1 formats; room formats get their own fixtures in Phase 4b.

## 0. What changed in 0.3.1

- **Phase 0 is built** (§20): `@nswp/core`, the `nswp` CLI, the portal SDK, JSON Schemas, test vectors, and two reference worlds plus an Airlock, deployed for testing.
- **Real kind numbers**: 37300 for worlds and 37301 for avatars (§5.1), replacing the placeholders.
- **Curation uses NIP-51 curation sets (kind 30004)**, which already exist (§5.4).
- **Registrable domains must use the private section of the Public Suffix List** (§6.2). Building the Airlock showed that without it, every `*.vercel.app` site displays as the same domain.
- **Target devices** (§21.2), including Valve's Steam Frame.

## 0. What changed in 0.3

0.3 is a review pass over 0.2. It corrects claims that were wrong or couldn't work, checks the BitBlocks sections against the block repositories (as of 2026-11-17), and fills gaps.

**Corrections**

| 0.2 said | Problem | 0.3 |
|---|---|---|
| Headsets sign in by passkey or by scanning a NIP-46 QR with a phone | A phone can't scan a QR shown inside a standalone headset. Passkey PRF support is uneven. BitLogin is password-first today and its NIP-46 sessions don't survive a reload | §13.1: set up on another device, then pair; pairing without a QR is an open design (Q12) |
| The source world "learns nothing about where they went" | The source world triggers the navigation, so it knows which portal was activated | §6.2 states exactly what each party learns |
| Users can choose their own Airlock | A world has no way to know which Airlock a user chose | §6.3: the arrival context carries a return Airlock address |
| Ordinary websites appear as floating windows | A web app can't render other sites inside an immersive session | §2: websites are cards that open in the 2D browser |
| The signed-out lobby uses a seed recipe, and there are no default moderators | Together these leave new users with an unfiltered feed of anyone who owns a domain | §15: a disclosed, replaceable starter set |
| BitFeed recipes can be shared as events | Publishing recipes over Nostr is planned in BitFeed's spec, not shipped | §14: JSON export and import until it ships |
| BitGate may not support origin targets | Confirmed: BitGate targets are user, event and address only | §15 and Q6 |
| World servers "check BitUnlock's signed entitlement" (no detail) | The real format is known | §16 describes the service-signed receipt and how to verify it |
| `["l", "en", "ISO-639-1"]` | NIP-32 requires the matching `L` namespace tag | §5.2 |
| One click crosses a portal | A crossing needs two gestures: one at the Airlock and one to start the next immersive session | §6.5, with a fast path for destinations the user already approved |

**Additions**

- Manifest serving rules (CORS, no redirects), tighter verification, publisher-change warnings and a listing opt-out (§7).
- Lobby network privacy: no contact with world origins until the user shows interest (§5.7).
- Relay strategy (§5.6).
- Airlock hardening: HTTPS-only destinations, registrable-domain display, the fake-Airlock threat (§6.2, §12).
- Entry assertion: fragment scrubbing, the non-repudiation caveat, behaviour for static worlds (§4.4).
- Device performance tier tag and world retirement (§5.3, §5.5).
- An adoption ladder for world creators, starting with zero integration (§19).
- Phase 3 is split so social discovery doesn't wait on BitGate's relicense (§20).
- Operator policy for a hosted instance (§15).
- Prior art to review (Appendix C).

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
| **NSWP Portal SDK** | A small world-side library for portals, manifests and arrival handling, shipped as a tagged release artifact with an integrity manifest | MIT |
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
4. Before a NIP is proposed, a second client that is not BitBlocks must interoperate (§22).

---

## 2. Vision

A user puts on a headset and opens BitPortal. They set up their account earlier on their phone and paired the headset once, so they're already signed in.

They land in a lobby:

- Worlds recommended by people they follow, each with a plain reason ("3 people you follow zapped this").
- Live events happening now and scheduled ones they bookmarked.
- Their bookmarked destinations.
- Friends who chose to share that they're available.
- Ordinary websites as cards that open in the headset's 2D browser.

They pick a virtual museum. A portal opens onto the **Airlock**, which shows the real destination origin, whether the publisher is verified for that origin, any warnings from the moderators they trust, and the identity they'll enter as. They confirm, the museum loads, and they press "Enter VR".

Two friends are already there, in a private room they were invited to. Their headsets talk directly to each other, and no server sits in between.

Inside the museum is a portal to another creator's world. Walking through it goes back through the Airlock. The museum knows they stepped into that portal, but not whether they went through, or who they chose to be on the other side.

No central company runs the destinations. The user's identity, social graph, discovery algorithm and moderation choices travel with them.

### 2.1 Design principles

1. **Open standards.** Independent developers can implement all core functionality.
2. **Decentralized identity.** Users control their Nostr identities.
3. **Independent hosting.** World operators choose their own infrastructure.
4. **Interoperability.** Compatible clients understand common world and portal metadata.
5. **Progressive enhancement.** Ordinary websites keep working as ordinary websites, and a world needs no integration at all to be listed (§19).
6. **Permission-based immersion.** Users decide when immersive sessions start.
7. **Privacy by default.** Identity, presence, location and navigation history are not shared unless the user chooses.
8. **Graceful degradation.** Unsupported worlds stay reachable through ordinary navigation where possible.
9. **Portable state, replaceable services.** Servers are allowed (multiplayer, payment verification), but no server becomes the source of truth for who a user is, what they own or what they can find.
10. **Comfort and accessibility.** Motion-comfort, seated play, input and device requirements are declared before entry, not discovered afterwards.
11. **Honest claims.** Relay retention and event expiry are best effort, a signature proves authorship but not safety, "verified" means domain control and nothing more, and an entitlement doesn't make anything DRM. The spec says so wherever it applies.

---

## 3. System Architecture

NSWP defines four layers. Part II shows how BitPortal fills each one.

### Layer 1: The spatial client

The client displays immersive environments and links out to ordinary websites. It:

- Supports WebXR.
- Manages ordinary navigation and immersive transitions (the Airlock, §6).
- Discovers and validates world metadata.
- Integrates a Nostr signer, which never lives inside world content.
- Resolves Nostr world references.
- Presents directories, bookmarks and recommendations.
- Enforces security and permission boundaries.

The first implementation is a WebXR web app running in existing headset and desktop browsers. A web app has hard limits: it can't draw trusted UI inside another site's immersive session, can't render other websites in 3D, and can't carry an immersive session across a navigation. A dedicated browser could lift all three, and comes later, if ever.

### Layer 2: Nostr identity and discovery

Nostr provides public-key identities, profiles, the social graph, signed world announcements, recommendations, bookmarks, labels and reports, plus optional invitations and presence.

Nostr does not store or render 3D environments.

### Layer 3: Independently hosted worlds

Each world is hosted by its creator: a Three.js or A-Frame app, a custom WebXR experience, a multiplayer browser game, a gallery, or a spatial front end for an ordinary website. A world can work with no Nostr support at all and still be listed.

### Layer 4: Real-time services

Real-time features (position sync, voice, shared objects, game state) don't run on relays. They run directly between participants' browsers, or through a room server that anyone can operate (§9). Relays carry only the short handshake that lets participants find each other.

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

A user may publish avatar preferences. A proposed addressable event carries them (experimental kind **37301**, not allocated by the NIPs process; `d` = avatar slot such as `default`):

```json
{
  "kind": 37301,
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

- **Format.** VRM 1.0 (built on glTF) is the recommended avatar format, with plain GLB as a fallback.
- **Integrity.** Model URLs should be content-addressed (Blossom) and carry the SHA-256, so a world can check the bytes it fetched.
- **Sharing.** The avatar event is public if the user publishes it. Whether a particular *world* is pointed at it is decided at the Airlock (§4.4). A user who wants a private avatar doesn't publish this event and gives the URL in the arrival context instead.
- **Worlds decide.** Worlds keep control of rendering and rules. Avatar portability doesn't oblige any world to accept every model.

### 4.3 Privacy-preserving identity

Users must be able to:

- Browse and enter public worlds without signing in.
- Choose, per world, to enter as **anonymous**, **main identity** or **alternate identity**.
- Refuse avatar, profile or mute-list requests.
- Stop sites from using signing capabilities without permission.

A stable public key is never disclosed automatically to a website.

### 4.4 Identity handoff: the arrival context and entry assertion (proposed)

The problem: a world is on a different origin from the client, so it can't see the client's signer and shouldn't. Some worlds still want to know who you are, for multiplayer names, entitlements or friends lists.

**Arrival context.** When the client sends the user to a world, it appends a fragment: `#nswp=<base64url JSON>`. Fragments are never sent to servers or written to access logs; the destination page reads the value in JavaScript.

```json
{
  "v": "nswp/arrival/0.3",
  "entry": "main-entrance",
  "airlock": "https://portal.bitblocks.network/go",
  "assertion": "<signed event object, optional>",
  "avatar": "naddr1…",
  "receipts": ["<entitlement receipt event, optional (§16)>"],
  "room": {
    "event": "<room event, or its naddr>",
    "pass": "<room pass event; absent for guests>",
    "sessionKey": "<session secret key>",
    "secret": "<room secret, for invite-only rooms>"
  }
}
```

- `entry` is the requested entry point.
- `airlock` is the return address for outbound portals (§6.3).
- `room` is present when the user is joining a room (§9). It is a 0.4 addition and not yet in the Phase 0 schemas or library.
- **Only a site that publishes a manifest gets an arrival context.** A site that hasn't adopted NSWP, such as one a curator listed, gets a plain visit with nothing added to its address.
- Everything else is present only if the user ticked it at the Airlock.

**The destination must scrub the fragment at once**: read it, then call `history.replaceState` to remove it, before loading any third-party script. Otherwise it stays in the browser history and is readable by every script on the page. The SDK does this.

**Entry assertion.** If the user chose to reveal an identity, the client signs a short-lived event:

```json
{
  "kind": 27235,
  "created_at": 1794430800,
  "tags": [
    ["u", "https://museum.example/world"],
    ["method", "GET"],
    ["nswp:origin", "https://museum.example"],
    ["nswp:nonce", "b64url-random-128-bit"],
    ["expiration", "1794430860"]
  ],
  "content": ""
}
```

Rules:

- The assertion uses the NIP-98 event shape (kind 27235) so existing NIP-98 verifiers can check it. It is bound to the destination **origin** and a random nonce, and expires within 60 seconds (NIP-40).
- A world **server** must reject a reused event ID and any assertion whose origin doesn't match its own, then issue its own session. After that, the world never needs the user's signer.
- A **static world** with no server can check the signature in the page and show the name, but it can't stop a replay within the 60 seconds. It should treat the identity as cosmetic and not gate anything on it.
- An anonymous entry carries no assertion.
- `["nswp:mutes", "shared"]` may be added to ask the world to apply the user's public NIP-51 mute list, so muted people's avatars are hidden. Public mute lists are readable by anyone anyway, so this is a request, not a disclosure. Private mutes can't be shared this way.

**What an assertion reveals, permanently.** A signature can't be taken back. An entry assertion is a transferable proof that this key chose to enter this world at this time, and a world can keep or publish it. Users who mind should enter anonymously or under an alternate identity, and the Airlock says so in plain words the first time a main identity is used. A deniable alternative is open question Q3.

Using kind 27235 for something other than an HTTP request is a deliberate reuse that needs community review before any NIP (§22).

---

## 5. Spatial World Discovery

The central primitive is the **Spatial World Announcement**: a signed, addressable Nostr event that describes an independently hosted destination.

### 5.1 Event classification

- World announcements use the experimental addressable kind **37300** (avatars use **37301**). Neither is allocated by the NIPs process; both were checked on 2026-11-17 against the NIPs registry, open NIPs pull requests (no earlier spatial or metaverse proposal exists) and every kind the BitBlocks repositories use. BitRoad and BitUnlock use `30078` and Tessera uses `33600`–`33604`. Code refers to these as `WORLD_KIND` and `AVATAR_KIND` so they can change if the NIP process assigns others.
- A `d` tag holds the stable world identifier.
- The world is referenced elsewhere by its coordinate `37300:<pubkey>:<d>` (an `a` tag, or an `naddr`).
- A dedicated kind is proposed later through the NIP process (§22).

### 5.2 World announcement event (tag-first)

Relays index **single-letter** tags, so the fields people filter on are single-letter tags. Other display fields are named tags. `content` is a plain-text or Markdown description, and clients don't parse JSON out of it.

```json
{
  "kind": 37300,
  "created_at": 1794430800,
  "tags": [
    ["d", "example-museum"],
    ["title", "Example Virtual Museum"],
    ["summary", "An immersive art gallery with three wings."],
    ["r", "https://museum.example/world"],
    ["image", "https://blossom.example/<sha256>.webp", "1920x1080"],
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
    ["perf", "standalone"],
    ["t", "museum"],
    ["t", "art"],
    ["L", "ISO-639-1"],
    ["l", "en", "ISO-639-1"],
    ["status", "live"],
    ["p", "<co-creator hex pubkey>", "", "co-creator"],
    ["a", "30078:<seller pubkey>:<product-d>", "", "access"],
    ["alt", "Spatial world listing: Example Virtual Museum"]
  ],
  "content": "Walk through three wings of rotating exhibitions…"
}
```

This shows the unsigned body; signing adds `id`, `pubkey` and `sig`.

### 5.3 Tags

| Tag | Req. | Indexed | Purpose |
|---|---|---|---|
| `d` | ✓ | ✓ | Stable world ID within this publisher |
| `title` | ✓ | | Display name |
| `r` | ✓ | ✓ | Entry URL (HTTPS only). Lets clients find every announcement of one URL |
| `summary` | | | One-line description |
| `image` | | | Preview image, optional dimensions; a content-addressed host is preferred (§5.7) |
| `mode` | | | `2d`, `inline-3d`, `immersive-vr`, `immersive-ar`; repeatable, in order of preference |
| `capability` | | | `webxr`, `rooms`, `multiplayer`, `voice`, `spatial-portals`, `avatars`, `entry-assertion`, `payments` |
| `comfort` | | | `locomotion` (`stationary`, `teleport`, `smooth`, `vehicle`), `intensity` (`low`, `medium`, `high`), `seated` (`supported`, `required`, `unsupported`) |
| `input` | | | `controllers`, `hands`, `gaze`, `keyboard-mouse`, `touch`, `gamepad` |
| `perf` | | | Lowest device class the world targets: `mobile`, `standalone` (self-contained headset), `desktop` (PC-driven) |
| `t` | | ✓ | Topics |
| `L` / `l` | | ✓ | Language and other NIP-32 self-labels (`l` always with its `L` namespace) |
| `content-warning` | | | NIP-36 content warning, with a reason |
| `status` | | | `live`, `beta`, `maintenance`, `retired` |
| `manifest` | | | Only if the manifest isn't at the well-known path (§7.1); such a manifest can't verify the publisher |
| `p` | | ✓ | Co-creators |
| `a` | | ✓ | Linked objects, such as an access product (§16) |
| `alt` | ✓ | | NIP-31 fallback text for clients that don't understand the kind |

Capability, comfort and performance declarations are **informational**. They never override browser permission requirements, and they are claims until borne out by visits and reports.

### 5.4 Operator announcements vs. curation

There are two kinds of "listing", and clients must tell them apart:

- **Operator announcement.** A world event that passes origin verification (§7.3). Clients show it as **verified for this origin**.
- **Curation.** Anyone can recommend or list a world without claiming to run it. Curators use a NIP-51 set of `a` / `r` references, or a recommendation (§8.2). An unverified world event is treated as curation: shown, but labelled "listed by", never "by".

NIP-51 already defines **curation sets (kind 30004)**, groups of items picked as belonging together, and they hold `a` tags. Curators list worlds with them.

Curation is what lets the directory start with worlds that have never heard of NSWP (§19). An origin that doesn't want to be listed can say so (§7.2), and compliant clients honour it.

### 5.5 Discovery behavior

A client should support:

1. Worlds published or recommended by people the user follows.
2. Search over indexed announcements (`t`, `r`, `l` filters, plus NIP-50 search relays where available).
3. Opening worlds shared in ordinary notes (`naddr` or URL).
4. Curated directories (NIP-51 sets).
5. Bookmarks (§8.3).
6. Signed updates from publishers (a newer `created_at` replaces older addressable events).
7. Retirement: a publisher sets `status` to `retired`, and may follow with a NIP-09 deletion request. Deletion is best effort; clients treat a retired world as closed and keep bookmarks pointing at it readable.
8. Availability: when the user shows interest in a world (§5.7), record whether it responded, and mark unreachable worlds rather than hiding them silently.

Relays provide discoverability. They don't guarantee that a referenced site is up or safe.

### 5.6 Relay strategy

- **Publishing.** A world event goes to the publisher's NIP-65 write relays. `naddr` references carry relay hints.
- **Follow-graph discovery** uses the outbox model: read each followed author's events from that author's write relays.
- **Global discovery** needs relays that hold many world events. Clients keep a visible, editable list of discovery relays. Anyone can run an index relay that accepts only kind 37300; a client's default list is a convenience, not an authority.
- **Verification is local.** Clients check every signature themselves and never trust a relay's word for an event.
- The manifest's `relays` field (§7.2) hints where a world's events live.

### 5.7 Network privacy in the lobby

A lobby that eagerly fetches from every listed world tells all of those worlds the user's IP address before the user has chosen anything. So:

- A client must not contact a world's origin (manifest, entry page, availability probe) merely because the world is listed. It does so when the user focuses the world (opens its card) or reaches the Airlock, and caches the result.
- Preview images are the exception that can't be fully avoided, since loading one tells its host that someone is looking. Publishers should host previews on content-addressed storage rather than the world's own origin. Clients should offer "load previews on focus" and may offer a proxy.
- Verification done by a third party and published as labels could remove the remaining fetches. That is open question Q13; a client would still re-verify at the Airlock.

---

## 6. Spatial Hyperlinks, Portals and the Airlock

A **spatial portal** is an object or interface in one environment that links to another destination. The client treats it as navigation between independent websites.

### 6.1 Portal destination

A portal can point at a world coordinate (`naddr`), an HTTPS URL, a named entry point, and an optional spawn pose.

```json
{
  "schema": "nswp/portal/0.3",
  "label": "Enter the Art Gallery",
  "destination": {
    "naddr": "naddr1…",
    "url": "https://gallery.example/world",
    "entry_point": "main-entrance"
  },
  "transition": { "preferred_style": "fade" }
}
```

When both are present, the `naddr` wins. The client resolves it, checks that the event's `r` matches `url`, and treats a mismatch as a warning. A bare URL with no `naddr` is always shown as an unlisted destination.

### 6.2 The Airlock: a trusted handoff

A web app can't draw trusted UI inside someone else's immersive session: whoever owns the XR session owns every pixel. So the trusted moment has to happen **between** sessions, on a page the client controls. That page is the **Airlock**.

The Airlock:

1. Shows the **real destination origin** in large type, with the registrable domain emphasised and mixed-script or punycode names shown in their raw form, so lookalike domains stand out. The registrable domain comes from the Public Suffix List **including its private section**: every site under `vercel.app` or `github.io` belongs to someone different, and must not all display as the same domain.
2. Shows publisher verification status, and warns if the publisher for this origin has changed since the user last visited (§7.3).
3. Shows the policy verdict (BitPortal: BitGate, §15): warnings, required confirmations, or a block.
4. Shows comfort, input and performance requirements, and whether the user's device meets them.
5. Lets the user choose an identity: anonymous, main or alternate (§4.4).
6. Shows the price, if any, and whether the user already holds an entitlement (§16).
7. Shows who is describing the world. When the listing was written by a curator and not by the site, it says "Listed by" and names the curator. A client that ships a signed starter set knows those worlds without asking a relay.
8. When the user is joining a room (§9): shows who hosts it, how they qualify to enter, and whether it is direct between participants or hosted, by whom, and what that exposes.
9. Needs a **user gesture** to continue.

**Hard rules**

- Destinations must be `https:`. The Airlock rejects every other scheme (`javascript:`, `data:`, `file:` and the rest) before doing anything with the value.
- The destination arrives in the **fragment** (`/go#to=<naddr-or-url>`), never in a query string, so no server logs where anyone went.
- The Airlock is a **static page** with no analytics and no server-side component, and anyone can host one.
- The Airlock never forwards automatically to a destination the user hasn't approved before (see the fast path, §6.5). Otherwise it would be an open redirect carrying the client's good name.

**What each party learns**

| Party | Learns | Doesn't learn |
|---|---|---|
| Source world | Which of its portals the user activated | Whether the user went through, or which identity they used there |
| Destination world | That a visitor arrived, their IP address, and whatever the user chose to reveal | Which world they came from (the Airlock sits in between, and navigates with `no-referrer`) |
| Airlock host | Nothing server-side (static page, fragment) | — |
| Relays | That the client asked for this world's events, if not cached | The rest |

**What the Airlock can't do.** A hostile world is a website, and a website can navigate anywhere it likes without asking. The Airlock doesn't stop that. It guarantees that crossings made through compliant portals are checked against the user's own policy, and that the user has one known place to judge a destination.

### 6.3 Which Airlock

A world can't know which client a user prefers, so the client tells it:

1. **Return address.** The arrival context (§4.4) carries `airlock`. The SDK remembers it for the browser tab's session and sends outbound portals back there. The user returns to their own client, where they're already signed in.
2. **World default.** With no return address (the user typed the URL or followed an ordinary link), the SDK uses the Airlock the world's developer configured (an SDK option, also declared as `airlock` in the manifest, §7.2).
3. **Built-in fallback.** With neither, the SDK shows its own minimal interstitial: destination origin, a confirm button, nothing else. It never asks for credentials or identity.

The return address tells the world which client the user came from. That is a small disclosure, and the SDK doesn't keep it past the tab session.

**Fake Airlocks.** A hostile world can ignore the return address and send the user to a lookalike page that asks them to "sign in again". Defences: the user is already signed in at their real Airlock, so a sign-in prompt in the middle of a crossing is itself the warning sign; passkeys are bound to the real origin and can't be used on a fake; and the address bar is visible, because the Airlock is always a 2D page. Clients teach this rule alongside §12.3.

### 6.4 Navigation sequence

1. The user approaches a portal. The source world may show a preview using announcement metadata.
2. The user activates it. The source world ends its XR session and navigates to the Airlock with the destination in the fragment.
3. The Airlock resolves and validates the destination (§6.2).
4. The user confirms with a gesture.
5. The client navigates to the destination with the arrival context (§4.4).
6. The destination reads and scrubs the fragment, loads, and shows its own "Enter VR" control.
7. The user presses it, and arrives at the requested or default entry point.

### 6.5 Limitations, stated honestly

- **Two gestures per crossing.** One confirms at the Airlock. The second starts the destination's immersive session, because WebXR requires user activation on the page that asks for the session, and activation doesn't carry across a navigation.
- **Fast path.** The Airlock may skip its confirmation, showing the destination for a moment with a cancel control, only when all of these hold: the destination is a verified world the user has approved before; the publisher hasn't changed; the policy verdict is a clean allow; the remembered identity choice applies; and nothing is being paid. That brings a familiar crossing down to one gesture.
- **Brief exit from immersion.** The Immersive Web group's navigation proposal (the `sessiongranted` event, experimental in some headset browsers; check current status) could remove the gap later. Clients feature-detect it and fall back to the flow above.
- A *dedicated* browser could render a trusted Airlock inside an ongoing session. A web app can't.

### 6.6 Portal API

The world-side SDK exposes a navigation call that works in any browser:

```javascript
import { portal, arrival } from "nswp-sdk";

portal.go({
  naddr: "naddr1…",          // or url
  entryPoint: "main-entrance"
});                           // picks the Airlock per §6.3

const ctx = arrival.read();   // reads, validates and scrubs the fragment
// { entry, airlock, assertion?, avatar?, receipts? }
// Verify `assertion` and `receipts` server-side before trusting them.
```

A future dedicated browser may expose `window.nswp.navigate()` natively, and the SDK uses it when it exists. Both are **proposed APIs**, not standards. The SDK's job is to keep world code identical either way.

Where a world's scene is glTF-based, portals and entry points should line up with existing glTF link and spawn-point extensions rather than a new scene format (Appendix C).

---

## 7. World Manifest

### 7.1 Location and serving

The manifest lives at **`https://<origin>/.well-known/nswp.json`**, the same pattern as NIP-05's `nostr.json`, with the same serving rules:

- It must be served with `Access-Control-Allow-Origin: *`, or browser-based clients can't read it.
- Clients must not follow redirects when fetching it.
- HTTPS only, at most 64 KB, `application/json`.

Only the well-known path counts for verification.

### 7.2 Example

```json
{
  "schema": "nswp/manifest/0.3",
  "listing": "allow",
  "publishers": {
    "<hex pubkey>": { "worlds": ["example-museum"] }
  },
  "worlds": {
    "example-museum": {
      "entry": { "url": "https://museum.example/world", "modes": ["immersive-vr", "inline-3d"] },
      "entry_points": ["main-entrance", "north-wing", "rooftop"],
      "capabilities": ["webxr", "spatial-portals", "avatars", "rooms", "multiplayer", "entry-assertion"],
      "avatar": { "formats": ["vrm", "glb"], "max_file_size_mb": 10, "max_triangles": 70000 },
      "rooms": {
        "transports": ["mesh", "hosted"],
        "hosted": "wss://rooms.museum.example",
        "max_mesh": 8,
        "ice": ["stun:stun.museum.example:3478"]
      },
      "multiplayer": { "endpoint": "wss://museum.example/session", "auth": "entry-assertion" },
      "budgets": { "initial_download_mb": 40 },
      "airlock": "https://portal.bitblocks.network/go"
    }
  },
  "relays": ["wss://relay.example"]
}
```

`listing` is `allow` (default) or `deny`. With `deny`, compliant clients don't show third-party curation of this origin on their shelves; a direct link still works.

`rooms` says which room transports the world supports (§9), the room server it offers for hosted rooms, its limit for peer-to-peer rooms, and any STUN or TURN servers it provides. `multiplayer` is for a world with its own custom multiplayer server (§9.9). Both are optional.

### 7.3 Verification and conflict rules

An announcement is **verified for its origin** only when all of these hold:

1. The manifest was fetched from the origin of the event's `r` URL, under the rules in §7.1.
2. The event's `pubkey` appears under `publishers`.
3. The event's `d` is listed for that publisher.
4. The event's `r` equals that world's `entry.url`.

Further rules:

- **Who wins on conflict.** The manifest wins on **technical** fields (entry URL, entry points, budgets, multiplayer endpoint), because the origin controls what actually runs. The signed announcement wins on **descriptive** fields (title, summary, topics, images).
- **Publisher pinning.** A client remembers the verified publisher key for each origin the user has visited or bookmarked. If it later changes, the Airlock says so before entry. A lapsed domain bought by someone else looks exactly like this.
- **Shared hosts.** Verification covers a whole origin. A site hosted on a path of a shared domain can't serve its own well-known file and so can't be verified; it needs its own subdomain or domain (Q14).
- **Validation.** Clients check the schema, ignore unknown fields, and never treat manifest claims as permissions.
- A manifest is optional. A world without one can still be listed, but never shown as verified.

### 7.4 What "verified" means

Verified means: *whoever controls this origin today vouches for this key.* It doesn't mean the world is safe, honest or well made, and domains are cheap. Safety judgments come from the user's trust graph (§15), not from verification.

---

## 8. Shared Social Features (mapped to existing NIPs)

The project reuses existing NIPs wherever possible and defines new kinds only for worlds and avatars.

### 8.1 Friends and social graph

The client uses NIP-02 follows (kind 3), NIP-65 relay lists (kind 10002) and NIP-51 lists to recommend worlds. A follow graph is a recommendation signal, never an access rule.

### 8.2 Recommendations and reviews

- **Reviews and comments:** NIP-22 comments (kind 1111) scoped to the world coordinate.
- **Reactions:** NIP-25 (kind 7) on the world event.
- **Tips:** NIP-57 zaps to the publisher (§16). Zap totals from followed accounts are a strong discovery signal.
- **Shares:** ordinary notes containing an `naddr`.

### 8.3 Spatial bookmarks

- Public bookmarks go in a NIP-51 bookmark list (kind 10003) or named bookmark sets (kind 30003) holding `a` tags for world coordinates.
- Private bookmarks use NIP-51's encrypted private items (NIP-44 encrypted to self), not public events.
- Entry points and personal labels ride along as extra tag values.

### 8.4 Invitations

Invitations are private by default: a NIP-17 direct message (NIP-59 gift-wrapped) containing the world `naddr`, an entry point and optionally a time. Public invitations are just notes.

An invitation to a room (§9) also carries the room event and, for an invite-only room, the room secret. The same content can be shared as a link whose fragment holds it, for people who aren't reachable by direct message.

### 8.5 Presence

Presence is optional and particularly privacy-sensitive.

- The default is **off**.
- Coarse public status ("in VR", "available to hang out") uses NIP-38 user status (kind 30315) with a NIP-40 `expiration` no more than 15 minutes ahead, refreshed while active.
- Status that names a world goes **only** to a chosen audience, gift-wrapped (NIP-59) to each member of a close-friends list.
- **Exact position, movement history and attendance records are never published.**
- Being in a room is visible to that room's members, and to its server if it is hosted. Announcing it more widely (NIP-53 room presence, kind 10312) is opt-in and offered only for open rooms.
- Expiry is a request to relays, not a guarantee, and any recipient can keep what they were sent. The client says this where presence is switched on.

### 8.6 Events and gatherings

- Scheduled gatherings use NIP-52 calendar events (kinds 31922/31923) that reference the world coordinate.
- Gatherings happening now use NIP-53 live activities (kind 30311), so existing Nostr clients can show "happening now in world X".

---

## 9. Shared Rooms

A **room** is a gathering inside a world: a set of people who can see each other's avatars, hear each other and share the same objects. The world is the place, and a room is one group of people in it. Many rooms can be held in one world at once.

A room's real-time traffic can travel two ways, and everything else about the room is the same in both:

| | Peer-to-peer ("mesh") | Hosted |
|---|---|---|
| Who carries voice and movement | The participants' own devices, directly | A room server run by the world's owner, a community or anyone else |
| Comfortable size | 2–8, more with limits (§9.4) | Dozens per room, more by splitting into several rooms (§9.5) |
| Cost | None | Someone pays for the server |
| Who sees your IP address | The other members | The server's operator, not the other members |
| Who could listen in | Nobody outside the room | The operator, unless voice is end-to-end encrypted |
| Referee for shared state | None | The server, which makes games and persistent state possible |

What never changes between the two: who you are (your Nostr key), who may enter, who moderates, how you're invited, your avatar, and the code a world developer writes.

### 9.1 The room event

A room is described by a NIP-53 interactive room event (kind 30312), with a few NSWP tags:

```json
{
  "kind": 30312,
  "tags": [
    ["d", "friday-gallery-walk"],
    ["room", "Friday gallery walk"],
    ["summary", "A slow lap of the new exhibition."],
    ["status", "private"],
    ["service", "https://museum.example/world"],
    ["a", "37300:<publisher pubkey>:example-museum"],
    ["p", "<host pubkey>", "", "Host"],
    ["p", "<moderator pubkey>", "", "Moderator"],
    ["nswp:transport", "mesh"],
    ["nswp:access", "list", "30000:<host pubkey>:gallery-friends"],
    ["nswp:max", "8"],
    ["nswp:entry", "main-entrance"],
    ["relays", "wss://relay.example"]
  ],
  "content": ""
}
```

- `service` is the world's entry URL. Clients open it through the Airlock, never directly.
- The `a` tag names the world, so a client can ask relays for the rooms being held in it.
- `status` follows NIP-53: `open`, `private` or `closed`. Anything other than open access is `private`.
- `nswp:transport` is `mesh`, or `hosted` followed by the room server's `wss://` address. A hosted room adds `e2ee` when voice is end-to-end encrypted.
- `nswp:access` is one of the rules in §9.3.
- The room's first record is signed by its host. Roles come from its `p` tags: `Host`, `Moderator`, `Speaker`. A room can outlive that host (§9.10).
- **A room doesn't have to be published.** An invite-only room's event can travel only inside its invitations (§8.4), so nobody else learns that it exists. A published room can be found by anyone.

Reusing kind 30312 means existing clients that understand NIP-53 rooms can list NSWP rooms and link to them. Whether the fit holds is open question Q15.

### 9.2 Who you are in a room: the room pass

Other members, or a room server, need to know who each participant is. But a world never holds the user's signer (§4.1), and a room runs inside the world's page. The **room pass** solves this.

At the Airlock, the client creates a fresh **session key** for this one room, and signs a pass with the user's identity key:

```json
{
  "kind": 27300,
  "created_at": 1794430800,
  "tags": [
    ["a", "30312:<host pubkey>:friday-gallery-walk"],
    ["nswp:session", "<session public key>"],
    ["nswp:origin", "https://museum.example"],
    ["expiration", "1794445200"]
  ],
  "content": ""
}
```

The pass says: "for this room, at this site, until this time, the session key speaks for me." The arrival context (§4.4) hands the world the pass and the session key. The world uses the session key for everything in the room; anyone who checks the pass knows which identity is behind it.

- **Scope.** The session key is useless outside this room, this origin and this time window. The identity key never leaves the client.
- **Lifetime.** A pass expires after 4 hours by default and 12 hours at most. It can't be revoked early (Q18).
- **Guests.** A participant with a session key and no pass is a guest. Guests are admitted only to `open` rooms, and are always shown as guests.
- **What it reveals.** Every member of the room, and the server if there is one, sees the pass. Like an entry assertion, it is a lasting, transferable proof that this identity joined this room (§4.4).
- **Kind.** 27300 is experimental and not allocated by the NIPs process. It sits in the ephemeral range on purpose: a relay that receives one isn't expected to store it.

### 9.3 Who may enter

| `nswp:access` | Who gets in |
|---|---|
| `open` | Anyone, including guests |
| `invite` | Anyone holding the room secret, a random value delivered in the invitation |
| `list` + a NIP-51 follow set (kind 30000) | The people on that list |
| `follows` | People the host follows (the host's kind 3 list) |
| `ticket` + a product coordinate | Holders of a valid entitlement for that product (BitPortal: a BitUnlock receipt, §16) |

- A room secret can be added to any rule. It hides the room's handshake from everyone without it (§9.4).
- **Who enforces the rule.** In a mesh room, every member's client checks each newcomer independently before connecting to them. In a hosted room the server checks, and clients still apply their own blocks.
- **Lists that others must check have to be readable by them.** A list with hidden members can't be verified by the other participants. For a private guest list, use an invite secret (Q20).

### 9.4 Peer-to-peer rooms

Browsers connect directly using WebRTC. Nostr relays carry only the short handshake that lets them find each other.

**Joining**

1. The newcomer announces themselves on the room's topic with their session public key and pass.
2. Each member already present checks, on their own: the pass is valid for this room and origin; the access rule admits this person; the member hasn't blocked them; the client's policy allows it (BitPortal: BitGate, §15); and the room isn't full.
3. Each member who accepts exchanges connection details with the newcomer.
4. The two browsers connect directly.

**Handshake messages** are ephemeral events (experimental kind 27301), signed by session keys, encrypted with NIP-44 to the recipient's session key, and tagged with the room's topic. The topic is a hash of the room's coordinate, mixed with the room secret when there is one, so outsiders to an invite-only room can't even find the handshake. Each connection's WebRTC fingerprint travels inside a signed message, which binds the connection to the session key: a relay can carry the handshake but can't put itself in the middle.

**What travels between peers**

- Head and hand positions, 10–20 times a second, on a channel that may drop packets.
- Control messages and shared-object changes, on a reliable channel.
- Voice as Opus audio, placed in space by the listener's device. The audio line is set up in the first handshake even if nobody is talking, so switching a microphone on or off later is a track swap and needs no second handshake.

Positions are sent from a timer, not from the drawing loop. Browsers pause drawing in a hidden tab, and a member who stopped sending would look like they had left.

**Shared objects** (a whiteboard, a moved chair) are kept in step with a conflict-free replicated data type, so no device is in charge. That suits social spaces. It can't prevent cheating, so it doesn't suit competitive games.

**There is no hub.** The host is a role, not a relay. If the host leaves, the people in the room stay connected, and the room's record passes to the next member (§9.10).

**Members can differ on who they accept.** If one member has blocked a newcomer and another hasn't, the blocked pair simply aren't connected. Clients show when there are people in the room you aren't connected to.

**Getting through home networks**

- A STUN server tells each browser its public address. Public ones are free.
- An estimated one in five to ten pairs can't connect directly and need a TURN server, which relays their encrypted traffic without being able to read it. Someone has to run it (Q17).
- TURN and STUN servers can come from the user's client settings, the world's manifest (§7.2) or the room event. Without TURN, some pairs won't connect.

**IP addresses.** A direct connection shows each member's IP address to the others. That is acceptable among invited friends and a real exposure in an open room. Clients offer a relay-only setting that hides it by sending everything through TURN, and the Airlock says so before entry to an open mesh room.

**Size.** Every member connects to every other, so the work grows quickly with headcount, and a standalone headset is a phone-class computer. These are estimates until Phase 4b measures them:

| Members | What works |
|---|---|
| 2–8 | Everyone sees and hears everyone. This is the default limit |
| 9–20 | Positions for everyone; voice only from the nearest six or so. Experimental |
| More than 20 | Use a hosted room, or several rooms |

### 9.5 Hosted rooms

A room whose transport is `hosted` sends voice and movement through a **room server**, which forwards each member's streams to the others. Anyone can run one: the world's owner, a community or a hosting provider. An open-source reference server is part of Phase 7, so "hosted" never has to mean one company's product.

**Joining** is the same as for a mesh room, except that the newcomer presents the pass to the server instead of to each member. There are no accounts, passwords or server-issued identities.

A conforming room server must:

1. Identify participants only by their room pass.
2. Apply the room event's access rule, and honour moderation from the room's roles (§9.8). It may add an operator policy of its own, which it must disclose.
3. Pass along each member's **presence beacons**: short statements signed by the member's session key, naming the room and the time. Clients verify them, so a server can't invent participants or speak as one.
4. Say whether voice is end-to-end encrypted. When it is, members exchange keys pairwise between session keys and encrypt each audio frame, so the server forwards what it can't hear.
5. Ask nothing more of the user's signer.

**What the operator can see:** each member's IP address, who is present and when, and the voice itself unless it is end-to-end encrypted. Other members don't see your IP address. Compared with a mesh room, a hosted room protects you better from strangers in the room and less from the operator.

**A referee, when wanted.** A server can hold the authoritative copy of shared state, which makes games and persistent rooms possible. That logic is the world's own; the protocol doesn't standardize it.

**Very popular rooms** split into several instances. People who arrive together stay together (§9.7).

**Interface.** The room server interface is small: join with a pass, the roster and its beacons, media negotiation, and moderation messages. It is defined alongside the reference server in Phase 7 (Q19). A world with a custom server either implements it or supplies an adapter to the SDK.

### 9.6 One room, either transport

A world developer writes one call, and the SDK does the rest from the room event:

```javascript
import { room } from "nswp-sdk";

const session = await room.join();   // reads the room from the arrival context
session.on("member", (member) => { /* member.pubkey, or member.guest */ });
session.on("pose", (member, pose) => { /* move their avatar */ });
```

This is a **proposed API**; it doesn't exist yet.

- **Disclosure.** Before entry, the Airlock states the transport in plain words: "Direct between participants" or "Hosted by rooms.museum.example", with what each exposes.
- **Promotion.** A room that outgrows the mesh can move to a server without ending. The host or a moderator publishes an updated room event naming the hosted transport. Clients watching the event reconnect there, with a brief interruption. Passes stay valid, because a pass is bound to the room, not to how its traffic travels. A room can move back the same way.
- **Small private rooms stay possible.** A world that offers hosted rooms should still allow mesh rooms, so meeting a few friends never depends on someone's server.
- **Chat.** Text messages in a room are signed with the sender's session key, so neither a server nor another member can forge them. Mirroring a public room's chat to relays under members' own identities is Q16.

### 9.7 Moving together

A group can go through a portal as a group. One member proposes a destination: a world, an entry point and a room to meet in. Each other member's client asks them, and each who agrees crosses through **their own Airlock**, gets a new pass, and arrives in the same room. Nobody is moved without their own gesture, and the fast path (§6.5) makes a familiar destination a single one.

### 9.8 Moderation in rooms

- **Roles** come from the room event: `Host`, `Moderator`, `Speaker`.
- **Remove.** A host or moderator signs a removal. In a mesh room every client drops that member; in a hosted room the server does.
- **Ban.** The host adds the person to the room's deny list (a NIP-51 set the room event names). It is checked at every join.
- **Block.** A member's own blocks and mutes always apply and always win. In a mesh room a block means no connection at all, so the blocked person receives nothing from you. In a hosted room the client tells the server not to forward in either direction.
- **Stage rooms.** When a room uses the `Speaker` role, only speakers transmit voice.
- **Reports** are NIP-56 events naming the person and the room.
- **Safety basics** in every client: a personal-space boundary other avatars can't enter, and one gesture that mutes everyone and offers the exit.
- **Personal space, as built in the spike.** An avatar fades out as it comes within 0.9 m of your head and is invisible inside 0.45 m. When someone first appears within 1 m of you, one of the pair is moved to 1.4 m away; a person wearing a headset is never moved.

**The venue sees everything.** A room runs inside the world's page, so the world's code handles every position, voice stream and message in it, whichever transport is used. An invite-only room keeps strangers out; it doesn't keep the venue out. Hold private gatherings in worlds you trust.

### 9.9 What the protocol leaves to worlds

The protocol doesn't standardize physics, combat, animation or game logic. A world with its own multiplayer system can keep it: it advertises `multiplayer` in its manifest and authenticates visitors with the entry assertion (§4.4), then issues its own session. A world's session never needs the user's signer after entry.

### 9.10 Rooms that outlive their host

A room's record is a Nostr event, and nothing in an event proves its author is still there. A host who closes the tab never says goodbye. COMBATRIG, a multiplayer game by this project's author, met each of these problems in play and solved them; NSWP adopts its answers. The numbers below are COMBATRIG's.

**Heartbeat.** While a room is up, its host republishes the room record once a minute.

- A record with no beat for **150 seconds** has no live host, whatever its status says. Clients say so, and leave such rooms off "happening now" shelves.
- The 150 seconds is deliberate. A browser runs a hidden tab's timers as rarely as once a minute, so anything shorter would declare a host dead for switching tabs. The same floor applies to any "has this person gone?" timeout that depends on a timer.
- The record's own expiry is separate and much longer (a week). A room with no live host is **dormant**, not deleted: still findable, and able to be revived.

**A room is a place.** Its identity is its `d` tag, not its first host.

- Each host signs **their own** record for the room: the same kind and the same `d`, under their own key. Records from successive hosts sit side by side, and none overwrites another.
- Each record carries an **epoch** (0 for the first host, one more for each handover), the **address of the record it succeeds** (that host's key and epoch), and the time it claimed the room.
- The predecessor is named by address, not by event ID, because every heartbeat is a new event with a new ID.
- **A claim is valid only if the predecessor was dormant when it was made**: no beat for 150 seconds. Nobody can take a room from a host who is still there.
- **Old invitations keep working.** A link names the first host's record. A reader starts there and follows valid claims forward. It never jumps to an unrelated record that merely uses the same `d`, so a stranger can't capture the link.

**Who takes over.** Admission order: the host lists members as it admits them, so every member holds the same list. There is no vote.

- The first member in line claims the room 150 seconds after the host's last beat. Each later member waits 10 seconds longer than the one before, so two claims rarely collide. If they do, a fixed tie-break gives every reader the same winner.
- Any member may take the room at once, when the host is gone, without waiting their turn.
- An open room can be revived by anyone who arrives. An invite-only room can be taken only by someone who belonged to it.
- NSWP adds one rule COMBATRIG doesn't need: where a room names moderators, they come first, in the order listed. This is untested.

**Private guest lists.** The public record of an invite-only room carries a **fingerprint of its member list**: a hash over a random salt and the sorted member keys.

- The salt, and the outstanding invitations, travel only in the private data each admitted member receives.
- A member can therefore check that a would-be successor really belongs, and a successor already holds every invitation, so a link sent before the handover still admits its recipient.
- The salt matters. Without it, a hash of a few public keys could be guessed against known keys and would reveal who is in the room.
- Outsiders can't check the fingerprint. To them a private room's listing is only a claim.

**What still needs designing for NSWP.** In COMBATRIG the app holds the player's signer. In NSWP a world never does (§9.2), so a member inside a world has only a session key when the moment comes to claim a room. Whether a claim signed by a session key with its room pass is enough is Q21.

---

## 10. Portable Digital Assets

### 10.1 Asset rules

- **Formats.** glTF/GLB and VRM, with KTX2/Basis textures and Meshopt or Draco compression. Clients and worlds should refuse other executable or scriptable formats.
- **Integrity.** Assets referenced from Nostr carry a SHA-256 and should be served from Blossom or another content-addressed store, so any mirror can serve them.
- **Budgets.** Worlds publish budgets (§7.2), and clients enforce their own hard limits whatever a world claims. Defaults: avatar ≤ 10 MB and ≤ 70k triangles; initial world download warned above 50 MB. Per-device budgets are Q7.

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
| **4 — Social interoperability** | Recommendations; invitations; optional presence; events; peer-to-peer rooms with room passes | BitFeed recipes, NIP-17/38/52/53, SDK rooms |
| **5 — Advanced spatial networking** | Seamless transitions; hosted rooms and promotion; moving together; portable entitlements | Reference room server; BitUnlock receipts; `sessiongranted` |
| **Safety (applies to every level)** | Show the destination origin before navigation; HTTPS-only destinations; user blocks and mutes; report flow; asset limits; lobby network privacy | BitGate + shell limits |

---

## 12. Security and Trust

### 12.1 Threats

| Threat | Notes |
|---|---|
| Malicious or impersonating world announcements | Origin verification (§7.3), publisher pinning, labels (§15) |
| Spatial phishing: a fake portal or fake destination | The Airlock (§6.2) |
| **Credential phishing inside a world** | A world draws a fake sign-in prompt in VR. See §12.3 |
| **Fake Airlock** | A hostile world sends the user to a lookalike Airlock that asks them to sign in. See §6.3 |
| Script injection through the Airlock | Destinations are HTTPS-only and never auto-forwarded on first visit (§6.2) |
| Lapsed or hijacked domain | Publisher pinning warns when an origin's publisher changes (§7.3) |
| Lookalike domains | Registrable-domain emphasis and raw punycode display (§6.2) |
| Tracking through persistent identities | Per-world identity choice; the non-repudiation warning (§4.4) |
| Navigation-history leakage | Static Airlock, fragments, fragment scrubbing, `no-referrer` |
| IP exposure to worlds merely listed | Lobby network privacy (§5.7) |
| Replay of entry assertions | Origin binding, nonce, 60-second expiry, single-use event ID; static worlds treat identity as cosmetic |
| Hostile or oversized avatar and world assets | Format allow-list, hash checks, hard budgets |
| Unauthorized signer requests | The signer lives only in the client shell; worlds never get it |
| Spam and Sybil announcements | Starter set for new users; social-distance ranking; trusted labels (§14, §15) |
| Harassment inside worlds and rooms | Room roles, removal, bans and personal blocks (§9.8); optional mute-list sharing (§4.4) |
| IP address exposure to room members (peer-to-peer) | Relay-only setting; hosted rooms; disclosure at the Airlock (§9.4) |
| Eavesdropping or logging by a room server | End-to-end encrypted voice where declared; operator disclosure (§9.5) |
| A server or member forging participants or messages | Session-key signatures and presence beacons (§9.5, §9.6) |
| Uninvited people joining a room | Every client checks the access rule; a room secret hides the handshake (§9.3, §9.4) |
| A relay interfering with the handshake | Connection fingerprints travel in signed, encrypted messages (§9.4) |
| A stolen session key | Scoped to one room, origin and time window; never the identity key (§9.2) |
| The venue observing a private room | Stated plainly (§9.8); verification and labels help users choose venues |
| Comfort-related harm (motion sickness, photosensitivity) | Comfort metadata, content warnings, reports for mislabelled comfort |
| Excessive resource use | Client-side budgets, the `perf` tier, a visible exit control |
| Supply chain: a compromised SDK or vendored block | Tagged releases with integrity manifests; vendored hashes checked in CI |

### 12.2 Client protections

Clients should: show verified destination origins; require consent before releasing any identity information; keep signing out of world content; validate manifests; restrict media and model formats; enforce navigation and permission boundaries; provide clear exit and safety controls; and offer blocking, reporting and relay filtering.

### 12.3 Never enter credentials inside a world, or in the middle of a crossing

Immersive content can imitate any UI. The client therefore teaches and enforces one rule: **you never type your password or recovery phrase inside a world, and you are never asked to sign in halfway through a portal.**

- Sign-in happens only in the client's own 2D surface, reached by opening the client directly.
- Worlds that need their own login send the user out to a 2D page rather than drawing a login form in VR.
- The SDK doesn't include, and the spec discourages, any in-world credential entry component.

---

# Part II — BitPortal: the BitBlocks reference app

Statements in this part about what each block does today were checked against the block repositories on 2026-11-17. "Not shipped" means the feature is designed or planned in that block's own documents and not yet implemented.

## 13. Identity: BitLogin ("who are you")

**Role.** BitLogin is BitPortal's only session source (BitBlocks D8). It provides the signer behind publishing, bookmarks, reviews, invitations and entry assertions.

**Integration**

- BitPortal embeds `<bitlogin-auth>` in its 2D shell, vendored same-origin from a **tagged BitLogin release with its integrity manifest** (D7), never hotlinked. The widget runs same-origin with the host, so it is part of BitPortal's trusted computing base.
- BitPortal consumes the session through BitLogin's NIP-07-shaped signer, passed **explicitly** to anything that needs it (D8). It listens for `bitlogin:login` / `bitlogin:logout` (D2) and reads `pubkey` (D1). Until those aliases ship, a thin adapter reads the current hyphen events and `publicKey`, as BitFeed's adapter does today.
- The Airlock is served from BitPortal's own origin, so it shares the BitLogin session. This is why a user must come back to their *own* client's Airlock (§6.3): no other origin can sign for them.
- **Room passes** (§9.2) are signed by the BitLogin signer at the Airlock, like entry assertions. The world receives only the room's session key.
- **Signing inside immersion.** DOM elements aren't visible in immersive VR, so the widget can't appear there. Actions that need a signature mid-session queue until the user is back in the 2D shell.

**Identities per world**

- **Anonymous:** no assertion.
- **Main:** the BitLogin account.
- **Alternate:** a second account the user signs into on purpose, or any NIP-07/NIP-46 signer. BitLogin's multi-account switching is not shipped, so today this means signing out and in again.

Deriving a fresh key per world automatically would touch BitLogin's derivation chain, which is a frozen compatibility contract, so it is out of scope here (Q1).

### 13.1 Signing in on a headset

This is the hardest onboarding problem in the project, and 0.2 got it wrong. The facts:

- **QR codes don't work.** BitLogin's NIP-46 flow shows a `nostrconnect` QR for a phone to scan. A phone can't see a screen inside a standalone headset.
- **Pasting doesn't work well.** The alternative is pasting a `bunker://` URI, which is impractical with VR controllers.
- **NIP-46 sessions don't persist.** BitLogin currently holds them in memory only, so a reload ends the session.
- **Passkeys are uncertain.** BitLogin's passkey login needs the WebAuthn PRF extension, whose support BitLogin's own documentation calls uneven. Headset browsers are untested.
- **BitLogin is password-first**, and its method order isn't configurable. Typing a password on a virtual keyboard works but is slow.

So the plan is:

1. **Set up elsewhere, pair once.** Account creation and recovery-phrase handling happen on a phone or desktop, never in a headset.
2. **Signed-out works fully.** Browsing, the Airlock and entering free worlds need no account. The MVP's headset experience doesn't depend on headset sign-in.
3. **Test matrix in Phase 2:** password on the virtual keyboard, and passkey PRF, on each target headset browser. Whatever works is the documented path.
4. **Pairing without a QR** is the real fix: the headset shows a short code, and the user approves it on a device where they're already signed in. A short code alone is guessable, so this needs a proper key-exchange design. It belongs in BitLogin, not in BitPortal (Q12).

**Requests for BitLogin** (each needs the owner's approval in that repository): a headset profile that reorders methods; persistent NIP-46 sessions; code-based pairing; multi-account switching.

## 14. Discovery: BitFeed ("what do you see")

**Role.** BitFeed composes the lobby. World announcements, curated sets, recommendations and live events are the candidates, and **recipes** decide what the user sees and why.

**Integration**

- BitPortal vendors the single-file `bitfeed.js` at a **pinned version** with SRI (D7). It doesn't import the unversioned hosted URL. BitFeed core is DOM-free, so it runs in a Web Worker beside the render loop.
- `@bitfeed/nostr` providers supply signals such as `nostr.following`, `nostr.zaps`, `nostr.reactions`, `nostr.hashtags`, `nostr.interests` and `nostr.socialDistance`. `@bitfeed/bitlogin` turns the session into the viewer. `@bitfeed/bitgate` and `@bitfeed/bitunlock` plug in policy and entitlement (§15, §16).
- World-specific signals (comfort match, device tier match, verified status, live events) are **BitPortal's own providers**, registered with BitFeed like any other. BitFeed has no opinion about worlds.
- BitPortal builds one **BitViewer v1** object (D10: `pubkey?`, `relays`, `follows`, `mutes`, `interests`, `session`) and passes the same object to BitFeed and BitGate. A missing field means "unknown", and `[]` means "known empty". The viewer object stays inside BitPortal and never goes to worlds.

**Default lobby recipes**

| Shelf | Recipe sketch |
|---|---|
| From people you follow | Announcements and recommendations authored within social distance 1, newest first |
| Loved by your network | Zaps and reactions from follows, decayed by age |
| Happening now | Open rooms with a live host (a heartbeat in the last 150 seconds, §9.10), NIP-53 live activities that reference worlds, and upcoming NIP-52 events |
| New worlds | Recent announcements within the user's wider social distance, with seeded exploration so new creators surface. See the note on "verified" below |
| Your bookmarks | The NIP-51 bookmark list in the user's order |
| Matches your interests | NIP-51 interests ∩ world `t` tags |
| Works on this device | Filters on the `perf` tier, inputs and the user's comfort settings |

**A shelf can't require "verified" for free.** Verifying a world means fetching a file from its site, and the lobby must not contact a world just because it is listed (§5.7). So a client knows a world is verified only after the visitor has opened it, and remembers that for a day. A shelf can prefer worlds it already knows are verified; it can't filter on verification for worlds nobody has opened. Third-party verification (Q13) is the only way round this.

**Signed-out and brand-new users.** With no follows there's no social signal, and "recent verified worlds" would be a feed of anyone who bought a domain. So the lobby for these users is built from a **starter set**: a NIP-51 curated set signed by a named curator key, shown with the curator's name and a "change" control. It stops being used once the user's own graph produces results (§15).

**User-owned algorithm.** Every shelf carries BitFeed's **explanation** ("ranked because 3 follows zapped it"), shown on the world card and in the Airlock. Users can adjust or replace recipes. Sharing recipes as Nostr events is planned in BitFeed's spec and not shipped; until then BitPortal exports and imports recipes as JSON.

**Ads.** The `@bitfeed/adzap` adapter is **off by default** and not part of the MVP.

## 15. Trust and safety: BitGate ("what may you do")

**Role.** BitGate answers the question of how to tell safe worlds from malicious ones without a central gatekeeper: **each user picks whose labels they trust**, and BitGate turns those labels into a decision with four dimensions.

**Mapping BitGate's four dimensions to BitPortal**

| Dimension | Where it acts in BitPortal |
|---|---|
| `visibility` (`allow` → `warn` → `restrict` → `hide` → `deny`) | Lobby and search: `warn` shows a content warning on the card; `hide` and `deny` remove the world from shelves (direct links still reach the Airlock, which shows the verdict) |
| `interaction` (`allow` → `require-explicit-action` → `deny`) | The Airlock: `require-explicit-action` adds a second, explained confirmation and disables the fast path; `deny` disables the continue button and shows the reason |
| `transaction` (`allow` → `require-review` → `deny`) | Paid entry (§16): blocks or warns before any BitUnlock quote is requested |
| `ranking` (`normal` → `downrank`) | Passed into BitFeed as a scorer |

**In rooms (§9)**

BitGate's targets today include users and addressable events, which is what rooms need, so this part has no gap.

| Decision | Effect in a room |
|---|---|
| `interaction: deny` on a person | BitPortal's client won't connect to them in a peer-to-peer room, and asks a hosted room's server not to forward in either direction |
| `visibility: hide` or `warn` on a person | Their avatar and voice are hidden, or shown behind a notice |
| Any decision on a room's coordinate | Acts on the room at the Airlock and in the lobby, exactly as for a world |

- **List-gated rooms** use a NIP-51 list of people (kind 30000). This is the same mechanism bitvid's whitelist mode uses, and the lists BitGate already reads for moderator roles.
- **Each member runs their own BitGate.** In a peer-to-peer room nobody's policy is imposed on anyone else: two members can reach different decisions about a third (§9.4).

**Signals**

- NIP-32 labels (kind 1985) in a `bitportal:moderation` namespace, targeting a world coordinate (`a`) or a publisher (`p`).
- NIP-56 reports (kind 1984) from the user's trust graph, including **comfort mislabelling** (a world that says "low intensity" and isn't).
- The viewer's own NIP-51 mutes and blocks, which always apply.

**Confirmed gap: origin targets.** BitGate's targets today are user, event and address. A label can't target a web origin, so a bad actor who rotates keys and world IDs on one domain escapes coordinate and pubkey labels. BitPortal raises this as a BitGate feature request rather than working around it (Q6).

**Three separate layers, each disclosed**

| Layer | Who decides | Default |
|---|---|---|
| **Starter set** (what a new user sees) | A named curator key, using BitGate's `allowlist` preset | On until the user's own graph produces results, then dropped. This follows BitGate's rule that seeds are a fallback and stop counting once a viewer has real contacts |
| **User trust** (labels and reports from people the user follows or names as moderators) | The user | BitGate's `social` preset plus BitPortal's spatial policy; no moderators are named for the user |
| **Instance policy** (what one hosted copy of BitPortal refuses to show) | Whoever operates that instance | An operator may apply a deny list to meet legal obligations, as BitRoad does with its moderation root key. It is disclosed, and affected worlds read "hidden by this instance's operator" with the reason |

The protocol has no authority over destinations. An instance operator does have responsibilities for what their site shows, and anyone who disagrees can self-host or use another client.

**Behaviour**

- **Fails open for discovery, never for the Airlock's origin display.** If the engine can't load or relays are quiet, worlds still appear. The Airlock *always* shows the real origin and verification status whatever BitGate says.
- **Reasons.** Every block or warning shows BitGate's explanation, using BitGate's kebab reason IDs mapped to BitPortal's own wording (D4b).

## 16. Payments and entitlements: BitUnlock ("did you pay for it")

**Role.** BitUnlock provides paid world access, tickets, season passes and paid downloadable assets, all with payment verified and delivery encrypted to the buyer's key.

**Model**

- A paid world's announcement references a BitUnlock product with `["a", "30078:<seller>:<d>", "", "access"]`. The seller registers the product with BitUnlock as usual.
- The Airlock shows the price. On purchase, BitPortal requests a quote, the user pays, and BitPortal unlocks a **buyer-bound NIP-44 envelope** holding whatever the world defined: a private entry URL, an access token, or an asset decryption key.
- At first fulfillment BitUnlock signs an **entitlement receipt**: a kind 30078 event signed by the BitUnlock service key, with `d` = `bitunlock:entitlement:v1:<fulfillmentId>` and payment-hash evidence. The buyer can recover all their receipts on any device with `GET /v1/access-entitlements` (NIP-98), so a ticket bought on a phone is available in the headset.

**How a world verifies entry**

1. The client includes the receipt in the arrival context (§4.4), next to the entry assertion.
2. The world server pins the BitUnlock service pubkey and checks the receipt's signature.
3. It checks that the buyer in the receipt is the key that signed the entry assertion, and that the product coordinate is its own.
4. It checks term expiry, which the receipt carries.
5. It checks revocation online, since a receipt alone can't show a later refund or ban. BitUnlock documents a public entitlement-status check; the exact route is to be confirmed when Phase 5 starts.

This is the same binding BitRoad applies on the store side (pinned service key; order, buyer, coordinate and payment hash all matching; fail closed). **Without steps 2–5 on the world's server, an entitlement is a soft gate, not DRM.**

**Client rules**

- All BitUnlock HTTP calls use **BitUnlock's exported NIP-98 helper** (D9), with `u`, `method`, `payload` and `bitunlock:nonce`, and a fresh event for every attempt. BitPortal doesn't hand-roll NIP-98, which is where Tessera's integration went wrong.
- BitPortal uses the SDK's `normalizeOrder()` (D5) and its retryability table (D4). `idempotency_in_progress` is retryable; treating it as permanent once stranded a real paid order in Satisfied.

**Paying in a headset.** A Lightning invoice QR has the same problem as a sign-in QR: nothing can scan it. Two paths work: a wallet connection (NWC) set up beforehand on another device, which makes payment a single confirmation; or buying on a phone or desktop first, then entering in the headset with the recovered receipt.

**Privacy option.** "Buy privately" pays with a separate purchase key (the Satisfied pattern, D8), so BitUnlock never learns the user's main identity. At the world, the user then chooses:

- enter as the purchase key, so the world sees only that; or
- present the main identity *and* a second assertion from the purchase key, so the world can link the two but BitUnlock still can't.

The cost: a purchase key lives on one device unless the user backs it up, so the ticket doesn't follow them to another device the way a main-identity purchase does.

**Honest limits.** BitUnlock is currently a hosted, limited mainnet beta. The protocol is open to self-hosted implementations, and no NSWP field depends on BitUnlock specifically.

**Rooms.** A room whose access rule is `ticket` (§9.3) admits holders of a BitUnlock receipt for the product it names. Each member's client, or the room server, checks the receipt with the steps above. An operator can fund a room server this way, but no room requires payment by design.

**Tips are not BitUnlock.** Tips and donations are plain NIP-57 zaps to the world publisher's Lightning address.

## 17. Other BitBlocks-family integrations (optional, after the MVP)

| Project | Possible role | Priority |
|---|---|---|
| **Tessera** ("what can you do") | Publish the NSWP Portal SDK and a "world publisher" agent plugin, so agents can validate manifests and announce worlds through Tessera's registry | Low; a good dogfooding opportunity |
| **BitRoad** | In-world shop kiosks that link to BitRoad storefronts for virtual goods | Later |
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
| D6 versions | Exposes `window.bitportal.version` and `export const VERSION`; NSWP schema versions (`nswp/manifest/0.3`) are kept separate |
| D7 distribution | Vendors every block from a tagged release with its integrity manifest; a CI check compares the vendored hashes with the release manifests. The Portal SDK ships the same way |
| D8 signer | One NIP-07-shaped signer, passed explicitly; purchase signer can be separate |
| D9 NIP-98 | Uses BitUnlock's exported helper for every BitUnlock call; NSWP's own tags are namespaced `nswp:<name>` |
| D10 viewer | Builds one BitViewer v1 and shares it between BitFeed and BitGate; never sends it to worlds |
| D11 license | MIT for BitPortal and the SDK; CC0 for the NSWP spec |

---

# Part III — Building it

## 19. Adoption ladder for world creators

A directory with no worlds attracts no users, and creators won't integrate with a directory that has no users. The way out is that **step 0 asks nothing of the creator.** Each later step is small and optional.

| Step | What the creator does | What they get |
|---|---|---|
| **0** | Nothing. A curator lists the URL | The world appears as "listed by <curator>" |
| **1** | Publishes a world announcement with their own key | A listing they control; reviews, zaps and bookmarks attach to it |
| **2** | Hosts one static JSON file (§7) | "Verified for this origin"; eligible for the New worlds shelf |
| **3** | Adds the SDK and a portal (a few lines) | Outbound portals through the visitor's own Airlock; visitors return to their lobby |
| **4** | Reads the arrival context | Named entry points; guests with a chosen identity and avatar |
| **5** | Calls `room.join()` from the SDK | Shared rooms with voice for small groups, with no server to run |
| **6** | Runs or rents a room server | Larger rooms, stage events, a referee for shared state |
| **7** | Registers a BitUnlock product | Paid entry, tickets, passes |
| — | Keeps its own multiplayer server, verifying entry assertions | Its existing system, with visitors' chosen identities (§9.9) |

**Bootstrapping.** The first directory is curated from WebXR experiences that already exist, by hand, into the starter set. Curators link, they don't embed or copy, and they honour `listing: deny` (§7.2).

## 20. Minimum Viable Product

**Goal:** show decentralized discovery and safe navigation between independently hosted immersive worlds, using the BitBlocks stack, without making the protocol depend on it.

Each phase has an exit criterion that has to be met before the next starts.

### Phase 0: Protocol fixtures
- JSON Schemas for the world event, manifest, portal, arrival context and entry assertion.
- Test vectors: signed example events, valid and invalid manifests, assertion replay cases, hostile Airlock destinations (non-HTTPS schemes, lookalike domains).
- An event-kind collision check (done: 37300 and 37301, §5.1).
- Two reference worlds with `.well-known/nswp.json`, served with the right CORS header.

**Exit:** a third party can validate an announcement and a manifest using only the schemas and vectors.

**Status (2026-11-17): built.** Everything above exists in this repository. The reference worlds and the Airlock are deployed at `nswp-world-a.vercel.app`, `nswp-world-b.vercel.app` and `nswp-airlock.vercel.app`. A crossing from World A through the Airlock to World B, and back, was tested in an emulated Meta Quest 3 (IWER), including a controller trigger on the portal. The reference announcements are published to six public relays, and `nswp check` reports both worlds as verified for their origins. The Airlock's verified view and its fast path (§6.5) were tested live: an approved world gets a three-second countdown with a cancel control, and unticking the approval makes the Airlock ask again.

### Phase 1: Read-only lobby
- BitPortal static shell on desktop and at least one standalone headset browser.
- A hand-curated starter set of existing WebXR worlds (adoption step 0), plus the reference worlds.
- BitFeed over the starter set, and the no-BitBlocks fallback list.
- The Airlock, with a self-hostable static build.
- Lobby network privacy (§5.7) from day one.

**Exit:** a signed-out user in a headset browses, passes the Airlock and enters three independently hosted worlds, and the no-BitBlocks mode does the same.

**Status (2026-11-17): built, and tested on a desktop only.** BitPortal lives in its own `bitportal` repository and is deployed for testing at `bitportal.vercel.app`.

- *Built:* the lobby, with three BitFeed shelves that each say why a world is there; doors whose art is generated from the world's address; verification when a door is opened; BitPortal's own Airlock at `/go/`; the plain no-BitBlocks mode; and a signed starter set of six worlds (the two reference worlds and four existing WebXR sites).
- *Tested:* from the lobby, through the Airlock, into three separately hosted sites; a world's portal returning to BitPortal's Airlock; plain mode loading no ranking code; a `javascript:` destination being blocked.
- *Walk-in lobby:* the same catalogue as a hall of doors at `/walk/`. A door is chosen by mouse, controller ray or pinch, or by walking through it, and always leads to the flat Airlock page. A Join button adds the Phase 4b room: avatars and spatial voice. Tested with an emulated Quest 3 (a controller trigger on a door reached the Airlock) and with two tabs sharing a room.
- *Not tested:* a real headset, which the exit criterion asks for.
- *Published:* the starter set and the curator's four listings are on six public relays as well as bundled with the app. A client with no bundled copy, the reference Airlock, resolves a listing from relays alone and shows it as listed, not verified.

### Phase 2: Publishing with BitLogin
- BitLogin sign-in on desktop and phone.
- A publish form: enter a URL, fetch and validate the manifest, check verification, sign, and publish to the user's NIP-65 write relays.
- Generates a `.well-known/nswp.json` snippet, with serving instructions, for the creator to host.
- The headset sign-in test matrix (§13.1).

**Exit:** a developer outside the project announces a verified world without asking anyone; the working headset sign-in paths are documented.

**Status (2026-11-17): started; no real sign-in has been tried.**

- *Built:* an identity page (`/account/`) embedding BitLogin's widget; session handling that takes BitLogin's signer explicitly and checks every signature it returns; and an announce page (`/publish/`) that checks a site, builds the announcement, writes the manifest file the site must host, and publishes to the person's own NIP-65 write relays.
- *Tested:* BitLogin's widget loads and shows its sign-in screen under BitPortal's content security policy. With a throwaway test key that never publishes, the announce page read a real site's manifest and produced a valid signed announcement, correctly reported as listed, not verified.
- *Not tested:* signing in with a real account, publishing under a signed-in identity, and the headset sign-in matrix. An automated test would have to create an identity on public relays, so this is left to a person.
- *Embedding notes for other clients:* BitLogin needs `'wasm-unsafe-eval'` in `script-src` for its password hashing, and its element must stay in one fixed place in the page for its whole life.

### Phase 3a: Social discovery
- BitFeed shelves (§14) with explanations; NIP-51 bookmarks; NIP-22 reviews; zaps.
- The user's own mutes and blocks, applied directly.
- No dependency on BitGate, so this phase isn't blocked by its relicense.

**Exit:** a user's lobby differs meaningfully, with explanations, depending on who they follow.

### Phase 3b: Trust labels with BitGate
- Labels and reports across all four dimensions; reason display in the Airlock; the three policy layers (§15).
- Starts when BitGate is MIT-licensed (§21.1).

**Exit:** a trusted moderator's label visibly changes the outcome for users who trust that moderator and not for users who don't.

### Phase 4: Portal SDK and identity handoff
- `nswp-sdk`: `portal.go()`, `arrival.read()`, the built-in fallback interstitial, a manifest helper, and a server-side assertion verifier.
- Per-world identity choice, entry assertions, return-Airlock handling, the fast path.

**Exit:** two worlds by different authors link to each other through portals, a user returns to their own Airlock from each, and a world shows the visitor's chosen identity, or "guest" for anonymous entry.

### Phase 4b: Shared rooms, peer-to-peer
- Room events, room passes, the handshake over relays, and direct connections carrying positions and voice (§9.1–§9.4).
- `room.join()` in the SDK; rooms in both reference worlds; the room disclosure in the Airlock.
- Access by open entry, invite link and list. Personal blocks and removal by a host.
- Schemas and test vectors for the room event, the room pass and handshake messages.
- Measurements on a desktop and a standalone headset, replacing the size estimates in §9.4.
- **An early spike is allowed.** A two-person, guest-only room in the reference worlds depends on nothing in Phases 1–4. It can be built first, to learn how shared presence feels before the rest is designed around it.

**Status (2026-11-17): the spike is built; the phase is not.** Both reference worlds have a "Join the room" button.

- *Built:* throwaway guest keys, the encrypted handshake over relays (kind 27301), direct connections, head and hand positions, spatial voice, an open room per world, and private rooms by unguessable link.
- *Tested:* two browser tabs on one computer saw each other move, including an emulated headset's hands, and a test tone sent as voice arrived at the expected level. Leaving was noticed at once. Six public relays carried the handshake; two refused it, so clients need several.
- *Not tested:* two different networks, real microphones, a real headset, or more than two people.
- *Differs from §9:* a room is named by a string, not a room event. There are no room passes, access rules, moderation or TURN servers, and voice must be switched on before entering VR.

**Exit:** four people on different networks, at least one in a headset, share a reference world, hear each other and see each other move. A person without the invitation can't join an invite-only room, and a blocked person can't connect to the member who blocked them.

### Phase 5: Paid access with BitUnlock
- A paid reference world and a ticketed event, with the world server verifying receipts (§16).
- Buy on phone, enter in headset. The "buy privately" purchase key.

**Exit:** a real Lightning payment grants entry on a second device, and a refund or revocation removes it.

### Phase 6: Presence, invitations and events
- NIP-17 invitations, opt-in NIP-38 presence with expiry, NIP-52 and NIP-53 events in the lobby.

**Exit:** a group of friends arranges a meetup and arrives at the same entry point without anyone publishing a permanent location record.

### Phase 7: Hosted rooms
- The room server interface and an open-source reference room server (§9.5).
- Promotion of a running room from peer-to-peer to hosted, and back (§9.6).
- End-to-end encrypted voice. Stage rooms. Splitting a popular room into instances.
- Moving together through a portal (§9.7).

**Exit:** a room of eight is promoted to a hosted server mid-session and keeps everyone's identity and roles. Twenty-five people share one hosted room. A test shows the server can't add a participant or speak as one.

---

## 21. Reference Implementation

| Component | Candidate |
|---|---|
| Spatial interface | Three.js (WebGL now, WebGPU when available) |
| Immersive API | WebXR, feature-detecting `sessiongranted` |
| Shell UI | HTML/CSS/JS, static output, strict CSP, all scripts same-origin |
| Nostr | nostr-tools (or NDK) |
| Identity | BitLogin (vendored release); any NIP-07/NIP-46 signer in no-BitBlocks mode |
| Discovery | BitFeed `bitfeed.js` (pinned, with SRI) in a Web Worker |
| Policy | BitGate standalone bundle (vendored, once MIT-licensed; §21.1) |
| Payments | `@bitunlock/sdk` (once published under MIT); NIP-57 for tips |
| Assets | Blossom servers; glTF/VRM loaders with KTX2 and Meshopt |
| World hosting | Static HTTPS hosting |
| Rooms, peer-to-peer | WebRTC data channels and audio; handshake over Nostr relays; a conflict-free replicated data type library for shared objects |
| Rooms, hosted | An open-source media forwarding server behind the room server interface (candidates in Appendix C) |
| Getting through home networks | Public STUN; an optional community-run TURN server |
| Build | esbuild → static `dist/`; TypeScript. Dependencies are vendored from sibling checkouts, with source commits and file hashes recorded (`vendor/integrity.json`) |
| Hosting | `portal.bitblocks.network` on the same static-hosting pattern as the other block sites (proposed) |

Prioritize desktop and one standalone headset browser first. Consider a dedicated browser fork only after the discovery, Airlock and handoff model is validated.

### 21.1 Dependencies and blockers in the BitBlocks stack

These items affect BitPortal directly. BitPortal therefore becomes a **forcing function for the BitBlocks Phase 1 cleanup** rather than a reason to work around it. Each item that changes another repository, release, license or live API still needs the owner's approval in that repository.

| Block | Current state | Impact on BitPortal | Needed before |
|---|---|---|---|
| BitFeed | Hosted `bitfeed.js` has no version in its URL; engine and package versions disagree (0.3.0 vs 0.1.0); BitViewer widening pending; recipe publishing over Nostr not shipped | Vendor a pinned copy and record its hash; JSON recipe export | Phase 1 |
| BitLogin | The build is reproducible, and the copy built from `main` (`bitlogin.js`, 144,005 bytes) matches the live site; other copies in circulation were built from other source. A script that emits a release folder with an integrity manifest is in an open pull request, held because the repository's dependency audit is failing on development tools. No tagged release yet; colon events, `pubkey` field and `getSigner()` / `capabilities()` not shipped; password-first with no configurable method order; NIP-46 sessions memory-only; multi-account switching and code pairing not shipped | BitPortal vendors the pinned build and checks it against the manifest; an adapter covers the naming; headset sign-in limited to what the test matrix finds (§13.1) | Phase 2 |
| BitGate | GPL-3.0-or-later until the accepted MIT relicense actually ships; standalone bundle not hosted; no origin targets | **Don't vendor BitGate into MIT BitPortal until relicensed**; only Phase 3b waits on it | Phase 3b |
| BitUnlock | SDK unpublished, with no license file; limited mainnet beta; public entitlement-status route to be confirmed | Phase 5 waits on the SDK being published under MIT | Phase 5 |

---

Shared rooms need no change to any block. Guests work with none of them, identified members need BitLogin as in Phase 2, and per-person BitGate decisions arrive with Phase 3b.

### 21.2 Target devices

BitPortal and the reference worlds aim to run on every headset with a standards-compliant WebXR browser. Status as of 2026-11-17; rows marked *verify* come from general knowledge, not testing.

| Device | Browser | WebXR |
|---|---|---|
| Meta Quest 2 / 3 / 3S / Pro | Meta Quest Browser | Supported |
| Valve Steam Frame | Built-in Chromium | Beta only: added in the SteamOS 0.5.7 beta (Chromium 157 and later), not yet in the stable release |
| PC VR headsets (SteamVR or OpenXR) | Chrome or Edge on Windows | Supported |
| Android XR headsets | Chrome | Supported (*verify*) |
| Pico 4 / 4 Ultra | Pico Browser | Supported (*verify*) |
| Apple Vision Pro | Safari | Immersive VR with gaze-and-pinch input (`transient-pointer`) (*verify*) |
| Phones and desktops | Any modern browser | Inline 3D only; tap or click the portal |

Rules that keep this list working:

- **Input goes through the WebXR `select` event only.** It fires for a controller trigger, a hand pinch and gaze-and-pinch alike. Nothing depends on a vendor's button layout.
- **No vendor-only features on the critical path.** `hand-tracking` and similar are requested as optional features. `sessiongranted` is feature-detected, never required.
- **Every world also works without VR**, as inline 3D with tap or click.
- **Test without hardware** using the IWER emulator: the reference worlds load it with `?xr=emulate`.
- **Before calling a device supported**, test it on the real device and record the date here.

## 22. Standards Strategy

The project could eventually propose:

**NIP-XX: Spatial World Announcements**: the world kind, tags, the `.well-known/nswp.json` verification rule, the operator-vs-curation distinction, and possibly a curation-set kind for worlds.

Possibly a companion: **NIP-XX: Portable Avatar Preferences**.

Portal navigation, the Airlock, the arrival context and the entry assertion go into a **separate, non-NIP specification**, because they concern browsers and web origins more than the Nostr protocol.

Before proposing a NIP:

- Review related NIPs (Appendix B) and prior art in portal-linked 3D webs (Appendix C).
- Prototype under a clearly experimental namespace and kind.
- Get feedback from Nostr client and relay developers, and from the Immersive Web community on the Airlock and handoff.
- **Demonstrate interoperability between BitPortal and at least one client that is not BitBlocks.**
- Don't claim kind numbers without community coordination.

NIP-78 (kind 30078) is app-specific storage. It isn't a long-term substitute for an interoperable world-discovery standard, and BitRoad and BitUnlock already use it.

### 22.1 Licensing and governance

- The NSWP spec is CC0 and lives in its own repository, separate from BitPortal's code.
- BitPortal and the SDK are MIT. BitGate must be relicensed to MIT (accepted as the target, not yet done) before BitPortal bundles it.
- Spec changes are proposed as pull requests against the spec repository. Once a second client exists, a change to Part I needs agreement from at least one implementer who is not BitPortal.

---

## 23. Non-Goals

The first version will **not**:

- Replace existing web browsers, or render other websites inside an immersive session.
- Render arbitrary Three.js sites in VR automatically.
- Define a universal physics engine, interaction system or scene format.
- Guarantee continuous, loading-free transitions.
- Standardize every avatar and animation system (VRM is recommended, not required).
- Replace multiplayer game servers, or provide anti-cheat or authoritative game logic in peer-to-peer rooms.
- Hide a room from the world it is held in (§9.8).
- Require Bitcoin, Lightning or any BitBlocks component.
- Guarantee that possessions work across every world.
- Establish a central authority over destinations. (An instance operator's policy for their own site, §15, is not that.)
- Add a fifth BitBlocks primitive. BitPortal is an app on the four, and any gap it finds goes back to the block that owns it.
- Provide in-world credential entry, or account creation inside a headset.
- Protect users from a hostile world's own navigation (§6.2).

---

## 24. Open Questions

**Q1 Identity:** should per-world identities be derived keys (which would need BitLogin spec work, since its derivation chain is frozen), separate accounts made on purpose (today's answer), or something else?

**Q2 Navigation:** which parts of the Airlock and handoff can be standardized now, and which wait for `sessiongranted` or a dedicated browser?

**Q3 Entry assertion design:** is reusing kind 27235 acceptable, or does the assertion need its own kind? And should there be a **deniable** variant, for example a token authenticated under a NIP-44 conversation key between the user and the world's publisher key, which proves identity to the world without giving it a transferable proof of the visit?

**Q4 Airlock centrality:** the return-address model (§6.3) sends users back to their own client, which helps. But if nearly every world's *default* Airlock is BitPortal's, it is still a soft point of centralization. Should the SDK's built-in fallback be the default instead?

**Q5 Starter set governance:** who holds the curator key for BitPortal's starter set, what are the inclusion criteria, and how are both published?

**Q6 BitGate origin targets:** add first-class origin targets to BitGate (the confirmed gap in §15), or accept that origin-level action needs labelling every coordinate and key?

**Q7 Avatars and budgets:** what are the default triangle, texture and bone budgets per `perf` tier?

**Q8 Presence:** can "friends nearby in world X" work through gift-wrapped status alone, or does it need a presence relay with stronger privacy guarantees?

**Q9 Portability:** how should worlds recognize BitUnlock receipts issued for *another* world's product (cross-world passes, creator bundles)?

**Q10 Governance:** how does the standard stay vendor-neutral when the first and best-resourced client is BitBlocks-branded?

**Q11 Naming:** "BitPortal" is a working name. It needs a trademark and collision check before public use. Alternatives include BitRealm, BitWorlds and "Portal" under the BitBlocks brand.

**Q12 Headset pairing:** what is the pairing protocol that needs no QR and no long paste (§13.1)? A short code needs a password-authenticated key exchange or an equivalent so it can't be guessed or intercepted. Does this become a BitLogin feature, a NIP-46 extension, or both?

**Q13 Verification attestations:** should third parties be able to publish "verified origin" labels so lobbies needn't contact world origins at all (§5.7)? Who would be trusted to, and does that reintroduce a gatekeeper?

**Q14 Shared-host verification:** is there a safe way to verify worlds hosted on a path of a shared domain, or is "get your own subdomain" the permanent answer?

**Q15 Room event:** is reusing NIP-53's room event (kind 30312) right, or will NSWP's extra tags and unpublished rooms strain it enough to need a separate kind? COMBATRIG faced the same choice and took its own kind (30317), shaped like NIP-53 but not claiming to be it, on the grounds that a game lobby isn't a stream. NSWP's rooms are meeting spaces, which is what 30312 describes, so the reuse stands for now. The succession fields in §9.10 add to the strain.

**Q16 Public chat:** posting a room's chat to relays under a member's own identity needs their signer, which a world never holds. Should the client mirror it, or should readers accept session-key authorship backed by room passes?

**Q17 Fallback relays:** who runs TURN servers for the pairs that can't connect directly, and how are they paid for without becoming a dependency?

**Q18 Room pass lifetime:** a pass can't be revoked. Is four hours the right default, and should members accept a renewed pass without a new Airlock visit?

**Q19 Room server interface:** adopt an existing open-source media server's protocol, or define a thin neutral interface with adapters?

**Q20 Private guest lists:** other members can't check a list whose entries are hidden. §9.10's salted fingerprint lets *members* check each other. Is that, plus an invite secret, enough, given that outsiders still can't check anything?

**Q21 Succession without a signer:** a member inside a world holds only a session key (§9.2). Can a room be claimed with a record signed by that session key and backed by its room pass, or must the successor return to their client to sign with their identity?

---

## 25. Long-Term Vision

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
- [NIP-05: DNS-based identifiers](https://github.com/nostr-protocol/nips/blob/master/05.md) (pattern for `.well-known`, CORS and no-redirect rules)
- [NIP-07: Browser Signer Interface](https://github.com/nostr-protocol/nips/blob/master/07.md)
- [NIP-09: Event Deletion Request](https://github.com/nostr-protocol/nips/blob/master/09.md)
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
- [NIP-53: Live Activities](https://github.com/nostr-protocol/nips/blob/master/53.md) (also defines the room event, kind 30312, and room presence, kind 10312)
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
- [W3C WebRTC](https://www.w3.org/TR/webrtc/)
- [RFC 9605: Secure Frame (SFrame)](https://www.rfc-editor.org/rfc/rfc9605) (end-to-end encryption through a forwarding server)
- [Immersive Web CG: WebXR navigation proposal](https://github.com/immersive-web/navigation)
- [VRM specification](https://github.com/vrm-c/vrm-specification)
- [Three.js](https://threejs.org/)
- BitBlocks: [bitblocks.network](https://bitblocks.network/), [BitLogin](https://login.bitblocks.network/), [BitGate](https://gate.bitblocks.network/), [BitFeed](https://feed.bitblocks.network/), [BitUnlock](https://bitunlock.network/), [Tessera](https://tessera.bitblocks.network/)

## Appendix B: Event and NIP map

| Need | Mechanism | New kind? |
|---|---|---|
| World announcement | 37300 (addressable, experimental) | **Yes** |
| Avatar preference | 37301 (addressable, experimental) | **Yes** |
| Origin verification | `/.well-known/nswp.json` (HTTP, not an event) | No |
| Arrival context | URL fragment (not an event) | No |
| Entry assertion | Kind 27235 (NIP-98 shape) + NIP-40 expiration | No (Q3) |
| Curation and directories | NIP-51 curation sets (30004) | No |
| Bookmarks (public and private) | NIP-51 (10003 / 30003, NIP-44 private items) | No |
| Reviews and comments | NIP-22 (1111) | No |
| Reactions | NIP-25 (7) | No |
| Tips | NIP-57 zaps | No |
| Invitations | NIP-17 / NIP-59 | No |
| Presence | NIP-38 (30315) + NIP-40; gift-wrapped when it names a world | No |
| Scheduled and live events | NIP-52 (31922/31923), NIP-53 (30311) | No |
| Moderation | NIP-32 labels (1985), NIP-56 reports (1984), NIP-51 mutes | No |
| Retirement | `status` tag, then NIP-09 (5) | No |
| Room | NIP-53 interactive room (30312) with `nswp:` tags | No (Q15) |
| Room pass | 27300 (experimental, ephemeral range; not published) | **Yes** |
| Room handshake | 27301 (experimental, ephemeral) | **Yes** |
| Room access and deny lists | NIP-51 sets (30000) | No |
| Room presence (public, opt-in) | NIP-53 (10312) | No |
| Paid access | BitUnlock product and receipt (30078), product referenced by `a` tag | No (BitBlocks-specific, optional) |
| Handler discovery | NIP-89 (31989/31990) | No |

## Appendix C: Prior art to review

Linking 3D places like web pages has been tried before, and so has serverless multiplayer. Before more formats are frozen, the project should study what these efforts learned, and reuse their formats where they fit. The descriptions below are from general knowledge and each needs checking against the project's current state.

| Project or group | Why it matters here |
|---|---|
| JanusVR / JanusWeb | An earlier "the web as rooms joined by portals" browser; the closest precedent for spatial hyperlinks, and a source of lessons on why it stayed niche |
| Open Metaverse Interoperability (OMI) group | glTF extensions for links between worlds and for spawn points, which could express portals and entry points inside a scene file instead of a new format (§6.6) |
| Mozilla Hubs (now community-maintained) | Browser-based multiplayer rooms reached by plain URLs; practical lessons on WebXR performance budgets, avatars and moderation |
| Hyperfy, Webaverse and similar web-native world platforms | Self-hostable browser worlds; potential first worlds to list, and potential second-client partners |
| Metaverse Standards Forum | The venue where interoperability work across vendors is coordinated |
| VRM Consortium | Owner of the avatar format recommended in §4.2 |
| Trystero and similar serverless WebRTC libraries | Browsers finding each other through public networks, Nostr relays among them, with no server of their own; the closest precedent for §9.4 |
| COMBATRIG | The author's own multiplayer game. Its lobby is a replaceable Nostr event with a heartbeat, host succession and private invitations, all proven in play; §9.10 comes from it. Its handshake, voice and NIP-17 invitation code are candidates for reuse in Phase 4b |
| Nostr Nests and other NIP-53 room clients | Audio rooms described by Nostr events and carried by a media server; the precedent for §9.1 and §9.5 |
| LiveKit, mediasoup and other open-source media forwarding servers | Candidates for the reference room server and its interface (Q19) |
| Yjs, Automerge and other conflict-free replicated data type libraries | Shared objects with no device in charge (§9.4) |

*This is a conceptual technical proposal. As of this draft, NSWP is not an adopted Nostr Improvement Proposal, a W3C standard or an implemented interoperability protocol, and BitPortal is not yet built.*

---

**End of specification, version 0.3**
