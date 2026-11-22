# A look of your own: the plan for your own model, size and animations

From the BitPortal session, 2026-11-22, for the orchestrator. A plan, not code:
nothing here is built. Read against `docs/backlog/avatars-own-models.md`,
NSWP-05 (`protocol/05-looks.md`), spec §4.2, NSWP-17 (items), and the code
named below, as they stand on main ff4d6fc.

The owner, 2026-11-21: "Id like to allow users to create and use their own
skins kinda like we have for bitportal items. So we have our default avatar
customize but users can be or look like whatever they want. This could
include size adjustments (within limits) new meshes with animations if they
want. Etc. All across worlds if the worlds allow custom skins and dont want
to skin the players themselves. Thats two different things there."

## 0. In one paragraph

A signed-in person may wear a 3D file of their own, named by its hash in the
look note they already have (kind 37301, its `model` tag, as spec §4.2
already writes it), kept wherever their files are kept. Every visitor's own
kit fetches it, checks the hash, counts it with the kit's one model reader
against a budget lower than an item's, and only then draws it, at the height
its wearer chose within the kit's limits, with the mark on it. A model with
the standard humanoid skeleton (VRM) is walked, turned, pointed and voiced by
the kit in every world; a model may bring its own clips for those moments
instead. Nothing in a model runs. A world says in its manifest whether it
draws people's own models, draws only the simple look, or dresses everyone
itself; the door says which before anyone crosses. Anyone who can't or won't
load a model sees that person's simple look, with the same mark.

## 1. What exists

- **Looks (NSWP-05):** three tiers. *Generated* from the key and *simple*
  (parts from short lists and three colours) are built (`avatar.ts`,
  `figure.ts`). *Model* is written in spec §4.2 and NSWP-05 "Proposed, not
  built". The look note's tags are already written there:
  `["model", <url>, "vrm"|"glb", <sha256>]`, `["height", "1.72"]`,
  `["thumb", <url>]`, `["size", <bytes>]`.
- **Publishing a look note** is not built either: BitPortal keeps the look on
  the device and in the signed-in sync note, and sends it inline. Nothing
  publishes a kind 37301 today.
- **Items (NSWP-17)** already do the safe path this needs: files named by
  hash, fetched by `item-store.ts` and refused unless the bytes hash right
  and are under the budget; every model read by `readGlb` (`glb.ts`) against
  `MODEL_BUDGET` before any engine sees it; a model that fails becomes a
  marker. Other engines get the checked bytes from the page (`NSWP.model`).
- **The manifest** already has a world's `avatar` field, parsed and unused:
  `formats`, `max_file_size_mb`, `max_triangles` (`manifest.ts`).
- **Announcements** already offer "Looks" (the `avatars` capability), and
  the door shows it as a tile.

## 2. The kit's half

### 2.1 The model tier, written down (NSWP-05)

The look note (kind 37301, `d` = slot, usually `default`) gains nothing new
in shape; the tags spec §4.2 already shows are made normative:

| Tag | Meaning |
|---|---|
| `["model", url, format, sha256]` | The file. `format` is `vrm` or `glb`. The url is a hint: the hash is the file |
| `["height", metres]` | How tall they want to be drawn, held within the kit's limits and the world's (2.4) |
| `["thumb", url, sha256]` | A picture of it, for panels and cards (optional; hash checked like the file) |
| `["simple", part, value]` | As now: the simple look, which is also what is drawn whenever the model isn't |

A note without `model` is a simple look, as today. A note whose model can't
be fetched, fails its hash, or fails the budget is drawn as its simple look.

**Who may wear one:** only a person a world can tie to a key, that is a
signed-in member whose pass has checked out (NSWP-06, NSWP-10). A guest has
no note to publish and no key to name it by: a guest is drawn generated or
simple, as now. That also keeps a model from following a guest across worlds.

### 2.2 How it reaches a world, and a room

- **Arriving:** the arrival context's existing `avatar` field (NSWP-03)
  names the note (`naddr`). The world reads it from relays. It counts only if
  its author is the visitor's proven key.
- **In a room:** each member also hands the others their signed look note
  over the room's data channel, in a new room message (`avatar`, the whole
  signed event, at most `LOOK_NOTE_LIMIT` bytes). A receiver keeps it only if
  the signature checks out and its author is that member's proven identity.
  Nobody has to ask a relay for each person; a member with no proven
  identity sends none and is drawn simple.
- **Fetching the file:** by the url, then the hash; the same store items use
  (`item-store.ts`'s file path), with its own lower budget (2.3). One copy per
  hash, shared by everyone wearing the same file.

### 2.3 Size and safety: a model is untrusted content

- **Nothing runs.** A look carries no script, ever (the backlog's proposal;
  see 6, open for the owner). Nothing in a model can reach the network, the
  page, or another file.
- **Checked before drawn, every time:** the bytes hash to the note's sha256;
  `readGlb` reads them as bytes only (no engine loader sees an unchecked
  file); a file that names anything outside itself (`outside`) or needs an
  extension the kit doesn't know (`needs-more`) is refused.
- **A budget lower than an item's**, since a room holds several people at
  once (`LOOK_BUDGET`, proposed): 1,000,000 bytes, 12,000 triangles, 24
  meshes, 8 materials, pictures at most 1024 px, at most 128 joints, at most
  64 morph targets. `readGlb` learns to count joints and morph targets (two
  new fields in its count; items are unaffected). A world's manifest may
  lower it further (`max_file_size_mb`, `max_triangles`, already parsed),
  never raise it.
- **Extensions:** VRM's own (`VRMC_vrm`, its materials, its expressions) are
  read for the skeleton and expressions only. Spring bones (`VRMC_springBone`)
  are ignored in the first round: they are physics the kit would run for a
  stranger's file. MToon materials are drawn as the kit's standard material
  with their base colour. Anything else in `extensionsRequired` refuses the
  file.
- **The mark stays.** Every model is drawn with the wearer's mark on a small
  plate above the head, the same plate the simple look shows, which no file
  can hide or replace (the kit draws it, not the model).
- **Each viewer decides.** "Show people's own models" in the People section,
  on by default, kept with the visitor's other settings and travelling like
  pictures do. Off, everyone is drawn simple. Per person, "Show as simple
  look" beside mute and block on their card.
- **Many at once:** at most `LOOK_MODELS_AT_ONCE` models drawn (proposed 8,
  the nearest first); beyond that, simple looks. So a crowded room can't
  overload a phone.

### 2.3a What fetching someone's model reveals

The orchestrator's question, 2026-11-22: a wearer chooses the url, so every
viewer whose kit fetches it tells that host their address and when they were
in that room. Unless this says otherwise, a look is a tracking pixel.

**What items do today, and the same hole.** An item's files are fetched from
whatever https address its maker wrote (`item.ts` cleans it to https, with no
user name or password; `item-store.ts` fetches with no cookies, no referrer
and no redirects, and keeps the bytes only if they hash right). Nothing limits
the host. So anyone can make an item whose files live on a server of their
own, hold it in a room, and learn the address of everyone there and when. Items
share the hole; it is its own backlog entry (`item-file-hosts`), and whatever
is decided here should be decided for both, in one place in the kit.

**What a fetch can reveal, and what it can't.** The checks above already stop
a file from carrying anything back, setting a cookie, or reaching another
address. What is left is the request itself: the host sees the viewer's IP
address, the time, and which file. Because a file is named by its hash, the
file says nothing per viewer; but a host that is the wearer's own sees every
fetch of a file only that wearer wears.

**Proposed default:**

1. **Fetch by hash, from hosts the viewer already uses.** A look's (and an
   item's) file is fetched on its own only from a content-addressed file host
   (a Blossom server: the file at `/<sha256>`, the same for everyone) on the
   viewer's own list: the hosts their own sign-in address keeps their files on,
   and the kit's short default list (`FILE_HOSTS`: the hosts BitBlocks runs).
   The kit asks those hosts for the hash itself (`GET /<sha256>`); the url in
   the note is a hint, used only when its host is on that list. So no wearer
   can choose who is asked, and the only hosts that ever see a viewer are ones
   that viewer already talks to.
2. **Anywhere else, only with the viewer's word.** A file found only on a host
   off that list is not fetched: its wearer is drawn as their simple look (an
   item, as its marker), and the person's card says "Their look is kept
   somewhere you don't load files from". A viewer may turn on "Load people's
   files from anywhere" (`files-anywhere`, off by default, kept with their
   other settings), with a plain line on what it lets other people learn.
3. **When a model is published,** BitPortal keeps it on the sign-in
   address's file host (already the case for "Your files"), so a published
   model is always on a host that most viewers' lists hold. Publishing warns if
   the file would be off the default list.
4. **A world's own files** (its scenery, its own items) are not this: they come
   from the world's own site, which the visitor chose to visit.

**What stays visible even then:** the hosts on a viewer's own list learn
their address and when they fetched a given hash, as any file host does. A
wearer can't read those hosts' logs, so a look can no longer be used to follow
people, which is the hole. Fetches are made only when the person is near
enough to be drawn (2.3, "Many at once"), never for everyone in a world.

**Names (add to section 4):** `FILE_HOSTS`, `fileHosts()` (the viewer's
list: their sign-in address's file hosts, then `FILE_HOSTS`),
`fetchByHash(sha256, hint)`, the console row `files-anywhere`.

### 2.4 Height, within limits that change nothing else

- `LOOK_HEIGHT`: least 0.85 m, standard 1.7 m, most 2.55 m (half to one and a
  half times standard, the backlog's proposal, open for the owner in 6).
- A world may narrow it in its manifest: `avatar.height: [least, most]`
  (new field). Outside it, the nearest limit is used.
- Height scales only the drawing. Where the eyes are (and so how a door, a
  panel or an item is reached), how far anyone walks or reaches, personal
  space, and the places to arrive are all the kit's numbers, unchanged. A
  model is fitted so its top is at its height and its feet are on the floor,
  whatever size its file says.

### 2.5 Moving: the kit's drive, or the model's own clips

- **A VRM** (or any GLB with VRM's humanoid bone names) is driven by the kit
  in every world with no work by its maker: idle sway, a walk cycle from the
  pace the presence already sends, turning, the head following where they
  look, an arm when they point, and the mouth (`aa` expression, or the jaw
  bone) from their voice level. One driver (`driveHumanoid`) in the SDK.
- **A model's own clips** named for those moments (`idle`, `walk`, `run`,
  `point`, `talk`, `wave`) play in their place; any moment it doesn't name
  falls back to the kit's drive (or stillness, for a model with no skeleton).
- **A GLB with no skeleton** moves along as a whole, with the same small bob
  the simple figure has. It floats; the door and the editor say so
  ("doesn't walk").
- At most `ITEM_LIMITS.clips` clips are kept, as for items.

### 2.6 The world's word

The manifest's `avatar.formats` (already parsed) says what a world draws:

| `formats` | The world draws |
|---|---|
| includes `vrm` and/or `glb` | People's own models of those formats, within its budget |
| left out, or neither | Everyone's simple look (today's behaviour) |

A world that dresses its players itself says `avatar.dress: "own"` (new
field). The kit then draws none of anyone's look in it: the world draws its
own (NSWP-05's "recast" or "uniform"), keeping the mark recognisable as
NSWP-05 asks. The door's "Looks" tile and line say which of the three
("Your own model is drawn here", "Your simple look is drawn here", "This
world dresses everyone"), from the manifest a door already reads.

### 2.7 Godot and other engines

- The page's kit does all the checking, as for items. An engine never loads
  an unchecked file: it is handed bytes that passed (`NSWP.model(sha)`,
  already there for items).
- A frame's `people` gains, per person: `model` (the sha, or none), `height`,
  `moment` (`idle`, `walk`, `run`, `point`, `talk`) and `pace`, and the
  humanoid pose the kit's driver worked out (`bones`: rotations for the VRM
  humanoid bones that moved), so an engine with no retargeting of its own can
  still pose a VRM exactly as the kit does.
- Godot: `NswpPeople` builds a person's model from the checked bytes with
  `GLTFDocument.append_from_buffer`, scales it to `height`, plays the model's
  own clip for `moment` where it has one, and otherwise applies `bones`. The
  mark plate is drawn by the addon, as now. Godot never fetches a model.
- An engine that draws no models says so in its manifest (no `formats`), and
  its people are drawn simple, as today.

## 3. BitPortal's half

- **"Your look" gains "Use your own model"** (in the room's You section, and
  at `/look/`):
  1. pick a file (`.vrm` or `.glb`);
  2. the kit reads and counts it on the device first (`readGlb` against
     `LOOK_BUDGET`), and says plainly what is over the budget, if anything;
  3. it is shown on the visitor's own figure in the room (the mirror they
     already have), at the height they set with a slider held to the
     limits, walking and pointing, with the mark plate on;
  4. publishing keeps the file and its picture where their files are kept
     (through their sign-in address, as "Your files" already is), then
     publishes the look note (kind 37301) through the sign-in address, the
     first time a look is published anywhere (the screen says so: a model
     makes you recognisable in every world that draws it).
- **"Back to my simple look"** publishes the note without `model`.
- **The room** draws people's own models (its manifest says `vrm`, `glb`),
  with "Show people's own models" in People, and the per-person switch on
  each card.
- **The Airlock and the door** say what the next world draws (2.6).
- **Sync:** the note is the record; the device keeps a copy as it keeps the
  simple look today, and the signed-in sync note carries which slot is worn.

## 4. Names to give (rule 11)

Core:
- `LOOK_BUDGET` (bytes, triangles, meshes, materials, texture, joints, morphs)
- `LOOK_HEIGHT` (`least`, `standard`, `most`)
- `LOOK_MODELS_AT_ONCE`
- `LOOK_NOTE_LIMIT` (bytes of a signed look note in a room)
- `GlbCount.joints`, `GlbCount.morphs` (two new counts from `readGlb`)
- `readLookModel(note)` → `{ url, format, sha256, height, thumb } | null`
- `lookHeight(asked, world?)` → metres held within limits
- Manifest: `avatar.height`, `avatar.dress` (`"own"`)
- NSWP-06 room message: `avatar` (a member's signed look note)

SDK:
- `driveHumanoid(model, moment, pace, look, voice)`
- `PresenceOptions.looks` (what this world draws, from its manifest)
- `FigureStyle` / presence: the model path, with `Presence.lookInfo()` for tests
- Console rows: `people-models` ("Show people's own models"), and the card's
  `person-simple` ("Show as simple look")

Fetching (2.3a; the same rule for items, from `item-file-hosts`):
- `FILE_HOSTS`, `fileHosts()`, `fetchByHash(sha256, hint)`
- Console row `files-anywhere` ("Load people's files from anywhere")

Engines:
- frame `people[].model`, `.height`, `.moment`, `.pace`, `.bones`
- `NSWP.kit()`: `lookHeight`, `lookBudget`
- Godot: `NswpPeople` model building (no new public call)

BitPortal:
- You section rows `look-model` ("Use your own model") and `look-simple`
  ("Back to my simple look")

## 5. Done looks like, and must not

**Done:**
- A signed-in person publishes a VRM from BitPortal, walks into the Grove and
  the template and the Foundry, and everyone else there sees their model,
  at their height, walking, turning, pointing and talking with their voice,
  with their mark above it.
- The same person in a world that says no models is seen as their simple
  look; in a world that dresses everyone, as that world's own.
- A file over the budget, with a bad hash, naming an outside file, or
  needing an unknown extension is never drawn; its wearer is seen simple, and
  their editor told them why before they published.
- A viewer who turns models off sees everyone simple; per person likewise.
- Vectors for the model tier in `vectors/looks.json`; NSWP-05 marks it
  implemented.

**Must not:**
- Run anything from a look.
- Let height change eye height, reach, walking, door reach, personal space or
  the places to arrive.
- Draw a model before its hash and `readGlb` have passed.
- Hide or replace the mark.
- Let a guest wear a model, or let a model follow anyone into a world that
  says no.

## 6. Open, for the owner

1. **Height limits:** half to one and a half times standard (0.85 m to
   2.55 m), a world able to narrow them?
2. **Formats:** VRM and GLB both, with VRM shown as "moves everywhere" and a
   skeleton-less GLB as "floats"? (Proposal: both.)
3. **Scripts in looks:** never? (Proposal: never; looks that do things would
   be a separate decision.)
4. **Publishing a look** for the first time (a model makes a person
   recognisable everywhere it is drawn): is the screen's plain warning
   enough, or should it also be per world, as "go as yourself, or go plain"
   is per trip?
5. **Spring bones** (hair and cloth that swing): leave out in the first round
   as proposed, or wanted from the start?

6. **Where files are fetched from** (2.3a): only content-addressed hosts on
   the viewer's own list by default (their sign-in address's file host and
   `FILE_HOSTS`), anywhere else only with the viewer's switch, for looks and
   items alike? (The orchestrator decides this one from the proposal.)

## 7. Trials

All on the stand-in relay, with throwaway keys and test files made for the
trial (a small VRM, a GLB with its own clips, a skeleton-less GLB, and bad
files: over budget, wrong hash, an outside uri, an unknown required
extension).

1. **The reader:** each bad file refused with its reason; good files counted
   (joints, morphs) the same in the page and in the engine script.
2. **Two visitors in the Grove:** Ada wears the VRM (published through a
   stand-in sign-in), Ben sees it at her height, walking when she walks, the
   mouth moving when she speaks, her mark above it; Ben turns models off and
   sees her simple look.
3. **Each world's word:** the same two in a world with no `formats` (simple),
   and one with `dress: "own"` (the world's own).
4. **Height:** the least, the most and beyond both, in a world that narrows
   them; eye height, reach and walking pace unchanged (by the test hooks).
5. **Many at once:** nine people with models; eight drawn, the ninth simple,
   on a phone-sized view.
6. **Godot:** the Foundry draws Ada's model from the checked bytes and poses
   it from `bones`; never fetches.
7. **BitPortal:** pick, check, preview on the mirror, set height, publish
   (stand-in sign-in and file store), back to simple; the Airlock line for
   each kind of world.
8. **Where files come from:** a model whose url names a host off the list is
   not fetched (the stand-in host sees no request) and its wearer is drawn
   simple, with the card's line; the same file on a listed host is fetched by
   its hash; with `files-anywhere` on, the off-list host is asked.
9. **A headset:** the model drawn and driven at a comfortable frame rate on
   the Quest, at the model limit (by the owner, from the guided test page).
