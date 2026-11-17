# Nostr Spatial Web Protocol (NSWP)
## An Open, Decentralized Metaverse Built on Nostr and WebXR

**Version:** 0.1 — Concept Specification  
**Status:** Exploratory Draft / Proposed Protocol  
**Date:** November 11, 2026  
**License recommendation:** MIT for reference software; CC0 for protocol specifications

---

## 1. Executive Summary

The **Nostr Spatial Web Protocol (NSWP)** proposes an open architecture for connecting immersive 3D environments, conventional websites, multiplayer experiences, and social interactions through the decentralized Nostr network.

The objective is to enable a *Ready Player One*-style interconnected virtual universe without requiring a single corporate platform, proprietary game engine, centralized identity provider, or mandatory application marketplace.

Users would navigate this spatial internet through compatible browsers, transitioning between conventional 2D websites and immersive 3D worlds.

Nostr would provide the underlying infrastructure for identity, discovery, social relationships, content references, and portable preferences.

**Core principle: The worlds are independently hosted. The identities are user-controlled. The connections are decentralized.**

### 1.1 Foundational technologies

| Technology | Responsibility |
|---|---|
| Nostr | Identity, social graph, discovery, metadata, invitations |
| Nostr relays | Distributed indexing and event distribution |
| WebXR | Immersive VR/AR interaction |
| Three.js / WebGPU / WebGL | 3D rendering |
| WebRTC / WebSockets | Real-time multiplayer communication |
| HTTPS / CDN / content-addressed storage | World assets and content delivery |
| Bitcoin / Lightning | Optional payments and commerce |

NSWP is intended to connect existing technologies rather than replace them.

---

## 2. Vision

Imagine a user putting on a VR headset and opening a spatial web browser.

The browser authenticates through their existing Nostr identity.

Their personalized environment displays:

- Websites presented as floating windows.
- Immersive worlds recommended by people they follow.
- A directory of independently hosted virtual destinations.
- Portals to multiplayer environments.
- Bookmarked virtual locations.
- Friends and communities, subject to their chosen privacy settings.

The user selects a virtual museum.

The browser navigates to the museum's WebXR website, presenting its environment in immersive 3D.

Inside the museum, they discover a portal to another creator's virtual world.

Passing through the portal initiates navigation to that destination.

The user's identity, social connections, and supported avatar preferences remain available across compatible worlds.

No central company is required to operate every destination.

### 2.1 Design principles

1. **Open standards:** Core functionality must be implementable by independent developers.
2. **Decentralized identity:** Users retain control of their Nostr identities.
3. **Independent hosting:** World operators choose their own hosting infrastructure.
4. **Interoperability:** Compatible browsers understand common world and portal metadata.
5. **Progressive enhancement:** Ordinary websites continue functioning as ordinary websites.
6. **Permission-based immersion:** Users control when immersive sessions begin.
7. **Privacy:** Sharing identity, presence, or location is optional.
8. **Graceful degradation:** Unsupported worlds remain accessible through conventional browser navigation whenever possible.

---

## 3. System Architecture

NSWP defines four primary architectural layers.

### Layer 1: The Spatial Browser

A browser capable of displaying both conventional websites and immersive environments.

Responsibilities include:

- Rendering ordinary HTML websites.
- Supporting WebXR.
- Managing conventional navigation and immersive transitions.
- Discovering spatial-world metadata.
- Integrating with a Nostr signer.
- Resolving Nostr world references.
- Presenting world directories and bookmarks.
- Enforcing security and permission boundaries.

An initial implementation could be a WebXR-enabled web application running inside an existing compatible headset browser.

A dedicated browser could follow later.

### Layer 2: Nostr Identity and Discovery

Nostr provides:

- Public-key identities.
- User profile metadata.
- Social relationships.
- Signed world announcements.
- World recommendations and bookmarks.
- References between worlds.
- Optional invitations and presence information.

Nostr does not need to store or render the actual 3D environments.

### Layer 3: Independently Hosted Worlds

Each immersive world is hosted by its creator.

A world could be:

- A Three.js application.
- An A-Frame application.
- A custom WebXR experience.
- A multiplayer browser game.
- A virtual gallery.
- A spatial interface to a conventional website.

A world may operate independently of Nostr while advertising Nostr-compatible metadata.

### Layer 4: Real-Time Services

Real-time interactions use suitable networking infrastructure outside ordinary relay-based event distribution.

This includes:

- Multiplayer position synchronization.
- Voice communication.
- Shared physics and interactions.
- World-specific game state.
- Session management.

WebRTC, WebSockets, or dedicated multiplayer infrastructure may provide these capabilities.

---

## 4. Nostr Identity

### 4.1 User identity

Each user is identified by a Nostr public key, commonly represented in human-readable form as an `npub`.

The corresponding private key must remain under the user's control.

The browser should support external or remote signing rather than requiring users to expose private keys to visited websites.

Relevant existing mechanisms include:

- NIP-01: Basic Nostr event and identity protocol.
- NIP-07: Browser-based signer interface.
- NIP-46: Remote signing.
- NIP-98: HTTP authentication for services.

### 4.2 Portable avatar identity

A user may associate avatar configuration with their Nostr identity.

A proposed portable avatar profile could contain:

```json
{
  "schema": "nswp/avatar/0.1",
  "name": "Example Avatar",
  "model": "https://example.org/avatar.glb",
  "thumbnail": "https://example.org/avatar.webp",
  "scale": 1.0,
  "supported_formats": ["glb"],
  "permissions": {
    "share_with_worlds": "ask"
  }
}
```

The avatar metadata would be signed or referenced through Nostr.

A compatible world could request permission to load the avatar.

However, worlds retain control over their rendering and game rules. Avatar portability does not imply that every world must accept every model.

### 4.3 Privacy-preserving identity

Users must be able to:

- Browse without signing in.
- Choose whether to reveal their public identity.
- Use alternative or pseudonymous identities.
- Refuse avatar or profile requests.
- Prevent websites from accessing signing capabilities without permission.

A stable public key should never be disclosed automatically to every visited website.

---

## 5. Spatial World Discovery

The protocol's central innovation is a standardized **Spatial World Announcement**.

This is a signed Nostr event describing an independently hosted virtual destination.

### 5.1 Event classification

A future Nostr Improvement Proposal could define a dedicated addressable event kind for spatial worlds.

For initial experimentation:

- Reserve a configurable experimental event kind in the `30000–39999` addressable range, subject to collision checks.
- Do not treat that kind as officially allocated.
- Use a `d` tag as a stable world identifier.
- Later propose a dedicated kind through the NIP review process.

The examples below use `WORLD_KIND` as a symbolic placeholder rather than claiming a registered event number.

### 5.2 World announcement event

Proposed event structure:

```json
{
  "kind": "WORLD_KIND",
  "created_at": 1794430800,
  "tags": [
    ["d", "example-museum"],
    ["title", "Example Virtual Museum"],
    ["url", "https://museum.example/world"],
    ["image", "https://museum.example/preview.webp"],
    ["t", "museum"],
    ["t", "art"],
    ["alt", "Spatial world listing for Example Virtual Museum"]
  ],
  "content": "{\"schema\":\"nswp/world/0.1\",\"description\":\"An immersive virtual museum.\",\"entry\":{\"url\":\"https://museum.example/world\",\"mode\":\"immersive-vr\"},\"capabilities\":[\"webxr\",\"multiplayer\"],\"manifest\":\"https://museum.example/nswp.json\"}"
}
```

The example shows the unsigned event body. A real Nostr client would add `id`, `pubkey`, and `sig` through the standard signing process.

The `WORLD_KIND` value is conceptual and must be replaced with a valid numeric kind before implementation.

### 5.3 World metadata fields

| Field | Purpose |
|---|---|
| `schema` | Metadata specification version |
| `description` | Human-readable world description |
| `entry.url` | Destination URL |
| `entry.mode` | Preferred rendering mode |
| `capabilities` | Advertised world features |
| `manifest` | Optional detailed world manifest |

Supported rendering mode values could include:

- `2d`
- `inline-3d`
- `immersive-vr`
- `immersive-ar`

Capability declarations are informational and must not override browser permission requirements.

### 5.4 Discovery behavior

A spatial browser should support:

1. Browsing worlds published by followed Nostr identities.
2. Searching indexed world announcements.
3. Opening worlds shared in ordinary Nostr notes.
4. Browsing manually curated world directories.
5. Bookmarking destinations.
6. Resolving signed updates from world publishers.

Relays provide discoverability, not a guarantee that referenced websites are available or safe.

---

## 6. Spatial Hyperlinks and Portals

A defining feature of NSWP is the **Spatial Portal**.

A spatial portal is an interactive object or interface that links one virtual environment to another destination.

The browser treats it as navigation between independent websites.

### 6.1 Portal destination

A portal may reference:

- A conventional HTTPS URL.
- A Nostr world announcement.
- A named entry point within a world.
- An optional spawn position or orientation.

Example:

```json
{
  "schema": "nswp/portal/0.1",
  "label": "Enter the Art Gallery",
  "destination": {
    "type": "url",
    "url": "https://gallery.example/world",
    "entry_point": "main-entrance"
  },
  "transition": {
    "preferred_style": "fade"
  }
}
```

### 6.2 Portal navigation sequence

1. A user approaches a portal.
2. The source world communicates the intended destination to the browser.
3. The browser validates and presents the destination.
4. The user activates the portal.
5. The browser navigates to the destination.
6. The destination loads and requests any required WebXR session.
7. The browser preserves supported user-level preferences.
8. The user appears at the destination's default or requested entry point.

### 6.3 Important limitation

Today's WebXR security model requires appropriate user intent and permissions for immersive sessions.

NSWP must not bypass those protections.

Seamless world transitions may initially require a loading screen, confirmation, or browser-mediated handoff.

A future dedicated browser could improve the experience while retaining appropriate security controls.

### 6.4 Proposed portal interface

An early implementation could expose a JavaScript interface:

```javascript
window.nswp.navigate({
  type: "url",
  url: "https://gallery.example/world",
  entryPoint: "main-entrance"
});
```

This is a **proposed API**, not an existing browser standard.

A production design should define origin checks, permission requirements, navigation failure handling, and how the destination receives permitted entry-point information.

---

## 7. World Manifest

In addition to Nostr announcements, worlds may publish an optional manifest.

Suggested path:

```text
https://example.org/nswp.json
```

Example:

```json
{
  "schema": "nswp/world/0.1",
  "id": "example-museum",
  "name": "Example Virtual Museum",
  "description": "An immersive art gallery",
  "entry": {
    "url": "https://example.org/world",
    "mode": "immersive-vr"
  },
  "capabilities": [
    "webxr",
    "spatial-portals",
    "avatars",
    "multiplayer"
  ],
  "avatar": {
    "formats": ["glb"],
    "max_file_size_mb": 10
  },
  "multiplayer": {
    "endpoint": "wss://example.org/session"
  }
}
```

The manifest is a proposal for interoperability, not an existing WebXR requirement.

Clients should validate its schema, content, URL origins, and resource limits.

Signed Nostr events and web-hosted manifests can complement one another, but conflicting metadata must be handled explicitly.

---

## 8. Shared Social Features

### 8.1 Friends and social graph

The browser may use a user's existing Nostr follow relationships to recommend worlds.

A spatial interface could show worlds shared or recommended by followed accounts.

### 8.2 World recommendations

Users may publish signed recommendations referencing a world announcement.

Potential metadata includes:

- World reference.
- Optional review.
- Tags.
- Timestamp.

Existing Nostr note and reference mechanisms should be reused wherever practical.

### 8.3 Spatial bookmarks

Bookmarks could include:

- World reference or URL.
- Optional entry point.
- Personal label.
- Collection or category.

Private bookmarks should use an appropriate private storage and encryption scheme rather than public events.

### 8.4 Presence

Presence is optional and particularly privacy-sensitive.

A user may choose to share:

- Online status.
- A specific world.
- Availability for invitations.

**Exact position, movement history, and world attendance must not be published by default.**

Ephemeral or encrypted mechanisms are preferable to permanent public location records.

---

## 9. Multiplayer Interoperability

Nostr is not intended to replace dedicated real-time networking.

A multiplayer world may use Nostr for identity and invitations while operating its own networking infrastructure.

For example:

```text
Nostr identity
    |
    v
World authentication
    |
    v
Multiplayer session server
    |
    v
Real-time state synchronization
```

### 9.1 Minimum multiplayer expectations

The initial protocol should not attempt to standardize physics, combat, animation, or all interaction systems.

Instead, it should define how worlds advertise multiplayer capabilities and optional authentication methods.

### 9.2 Cross-world sessions

Continuous multiplayer sessions spanning different providers are beyond the initial scope.

They may later require separate standards for session transfer, handoff, and cross-world communication.

---

## 10. Portable Digital Assets

Long-term NSWP development could explore portable virtual possessions.

Potential examples:

- Avatar clothing.
- Art objects.
- Collectibles.
- Access credentials.
- Tickets.
- Creator-issued entitlements.

Nostr could carry signed claims and references.

However, a signed event alone does not establish universally recognized ownership or enforce exclusive possession.

Each world must decide which claims, issuers, licenses, and asset formats it accepts.

### 10.1 Bitcoin and Lightning

Bitcoin and Lightning could support:

- World admission payments.
- Tips and donations.
- Creator subscriptions.
- Purchases.
- Paid events.

Payment support should remain optional.

The protocol should not require a cryptocurrency payment to browse public worlds.

---

## 11. Browser Requirements

A conforming NSWP-capable browser should progressively support the following features.

### Level 1 — Discovery

- Nostr public-key identification.
- Relay connectivity.
- Signed world discovery.
- World directories.
- Conventional URL navigation.

### Level 2 — Immersion

- WebXR compatibility.
- Immersive-capability detection.
- User-approved entry into VR.
- World metadata and manifests.
- Spatial portal navigation.

### Level 3 — Identity Portability

- External signing.
- User-controlled avatar preferences.
- Permission-based identity sharing.
- Spatial bookmarks.

### Level 4 — Social Interoperability

- World recommendations.
- Invitations.
- Optional presence.
- Multiplayer authentication integration.

### Level 5 — Advanced Spatial Networking

- Enhanced cross-world transitions.
- Optional transferable session data.
- Portable entitlement verification.
- Cross-world communication conventions.

These levels describe a proposed development roadmap, not current certification standards.

---

## 12. Security and Trust

Security must be foundational.

### 12.1 Threats

Potential threats include:

- Malicious world announcements.
- Impersonation.
- Phishing through immersive interfaces.
- Fake portals.
- Tracking through persistent identities.
- Hostile avatar files and oversized assets.
- Unauthorized signer requests.
- Malicious 3D content.
- Excessive resource consumption.

### 12.2 Browser protections

Browsers should:

- Display verified destination origins.
- Require consent before releasing identity information.
- Keep signing requests separated from world content.
- Validate world manifests.
- Restrict untrusted media and model formats.
- Enforce navigation and permission boundaries.
- Provide clear exit and safety controls.
- Offer blocking, reporting, and relay filtering.

### 12.3 Spatial phishing

A particularly important concern is that immersive interfaces can obscure familiar browser security indicators.

A virtual doorway could claim to lead to a trusted destination while actually opening a malicious site.

The browser should provide trusted, non-spoofable destination information before navigation.

---

## 13. Minimum Viable Product

**Project goal:** Demonstrate decentralized discovery and navigation between independently hosted immersive worlds.

### Phase 1: Prototype

Build a web-based spatial directory that:

- Runs in an existing WebXR-compatible browser.
- Connects to Nostr relays.
- Queries experimental world announcements.
- Presents discovered worlds as interactive 3D portals.
- Opens selected destinations through conventional navigation.

Deliverable: A spatial directory with links to at least three independently hosted worlds.

### Phase 2: Publishing

Develop a simple publishing tool that:

- Accepts a world URL.
- Creates world metadata.
- Signs the event through a Nostr signer.
- Publishes to selected relays.
- Updates the author's world listing.

Deliverable: Any developer can announce a WebXR world without depending on a central directory operator.

### Phase 3: Social Discovery

Add:

- Recommended worlds from followed accounts.
- Public bookmarks.
- Search and filtering.
- Creator profiles.

Deliverable: A user can discover spatial worlds through their existing Nostr social graph.

### Phase 4: Portal SDK

Create a small JavaScript library for world developers.

Example developer usage:

```javascript
import { createPortal } from "nswp-sdk";

createPortal({
  destination: "https://world.example/",
  label: "Visit Another World",
  entryPoint: "main"
});
```

The SDK would provide a consistent navigation interface while relying on browser-supported WebXR transitions.

The package and API shown above are illustrative and do not yet exist as part of this proposal.

---

## 14. Reference Implementation

A practical experimental stack:

| Component | Candidate technology |
|---|---|
| Spatial interface | Three.js |
| Immersive API | WebXR |
| Browser UI | HTML/CSS/JavaScript |
| Nostr integration | nostr-tools |
| Identity signing | NIP-07 or NIP-46 |
| World hosting | Static HTTPS hosting |
| Metadata distribution | Nostr relays |
| Multiplayer | WebRTC or WebSocket server |
| Build tooling | Vite |
| Development language | TypeScript |

The first prototype should prioritize desktop-browser functionality and at least one VR headset.

A specialized browser fork should only be considered after validating that the discovery and navigation model works.

---

## 15. Proposed Nostr Improvement Proposal

The project could eventually propose a NIP tentatively titled:

**NIP-XX: Spatial World Announcements and References**

Initial scope:

1. Define a dedicated addressable event kind for world announcements.
2. Define required and optional metadata tags.
3. Standardize references to spatial destinations.
4. Define versioning and update behavior.
5. Specify world manifest relationships.
6. Clarify security and compatibility expectations.

A separate specification could address spatial portal navigation and browser APIs because those concerns extend beyond the Nostr protocol itself.

### 15.1 Standards strategy

Before proposing a new NIP:

- Review related NIPs and existing implementations.
- Prototype the format using a clearly identified experimental namespace.
- Seek feedback from Nostr client and relay developers.
- Demonstrate interoperability between at least two independent clients.
- Avoid allocating event-kind numbers without community coordination.

NIP-78 provides app-specific storage, but is not an appropriate long-term substitute for an interoperable public world-discovery standard.

---

## 16. Non-Goals

The first version will **not** attempt to:

- Replace existing web browsers.
- Render arbitrary Three.js websites automatically in VR.
- Define a universal physics engine.
- Guarantee continuous, loading-free transitions.
- Standardize every avatar and animation system.
- Replace multiplayer game servers.
- Require Bitcoin or Lightning.
- Guarantee that all virtual possessions work across every world.
- Establish a centralized authority over virtual destinations.

Keeping the initial scope narrow will increase the likelihood of building a working prototype.

---

## 17. Open Questions

Several significant decisions remain unresolved.

**Identity:** Should the browser disclose a user's main Nostr identity, use delegated credentials, or support disposable identities per world?

**Navigation:** How much of a portal transition can be standardized without changing existing browsers?

**Discovery:** What metadata belongs in Nostr tags versus JSON content versus hosted manifests?

**Trust:** How should browsers distinguish safe worlds from malicious destinations without relying on a central gatekeeper?

**Avatars:** Which existing avatar formats and interoperability efforts should be adopted?

**Presence:** Can optional social presence be implemented without exposing sensitive location histories?

**Portability:** How can worlds voluntarily recognize externally issued assets and credentials?

**Governance:** How can the standard remain vendor-neutral and avoid becoming dependent on one browser, relay operator, or commercial platform?

---

## 18. Long-Term Vision

The ultimate objective is not a single enormous virtual world.

It is a network of independently created worlds, interconnected through open protocols.

Just as the conventional web connects documents, services, and applications through URLs and hyperlinks, the spatial web could connect immersive environments through discoverable destinations and interactive portals.

Nostr would supply decentralized identity, discovery, and social connectivity.

WebXR would supply the immersive interface.

Independent developers would create the worlds.

Users would decide where to go, which identities to use, and what information to share.

### Foundational statement

**The Spatial Web should be a network, not a platform.**

**Worlds should be places you visit, not applications you must install.**

**Identity should belong to the individual, not the world operator.**

**A portal should be as open and interoperable as a hyperlink.**

---

## Appendix A: Existing Standards and References

- [NIP-01 — Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-07 — Browser Signer Interface](https://github.com/nostr-protocol/nips/blob/master/07.md)
- [NIP-19 — Bech32-Encoded Entities](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [NIP-46 — Remote Signing](https://github.com/nostr-protocol/nips/blob/master/46.md)
- [NIP-78 — Arbitrary Custom App Data](https://github.com/nostr-protocol/nips/blob/master/78.md)
- [NIP-94 — File Metadata](https://github.com/nostr-protocol/nips/blob/master/94.md)
- [NIP-98 — HTTP Authentication](https://github.com/nostr-protocol/nips/blob/master/98.md)
- [W3C WebXR Device API](https://www.w3.org/TR/webxr/)
- [Three.js](https://threejs.org/)

*This document is a conceptual technical proposal. NSWP is not an adopted Nostr Improvement Proposal, W3C standard, or implemented interoperability protocol as of this draft.*

---

**End of specification — Version 0.1**
