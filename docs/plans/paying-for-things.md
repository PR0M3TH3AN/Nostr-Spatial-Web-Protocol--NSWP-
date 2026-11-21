# Paying for things: BitPortal, BitLogin and BitUnlock together

**Status:** a proposal, written for the owner on 2026-11-21. Nothing in it
is built unless a line says "exists". It is to be argued with, and the
open questions at the end are the owner's to answer before any of it is
started.

**What was asked for** (the owner, 2026-11-21): one-time paid access to a
world; subscription or time-limited access to a world; paid items, in a
game or BitPortal's own; time-limited items; tips to people; tips to
worlds; and payment splits that can be set between BitPortal, a world's
owner, an item's owner and so on, "different from the bitunlock fee it
charges. That more of a flat fee for records keeping." And: "We may want
more features later."

**In one paragraph.** BitUnlock sells a thing and signs a receipt saying
who bought it. BitLogin holds the visitor's key and wallet, runs the
purchase on its own page inside the game, and keeps the receipts. A world
never touches money or keys: it asks for a purchase, is handed a receipt,
and checks it. The Airlock tells a visitor a door costs something before
they walk through it. Everything on the list is that one loop, except
tips, which are simpler and need no receipt.

---

## 1. Who does what

| | Does | Never does |
|---|---|---|
| **BitUnlock** (`api.bitunlock.network`) | Holds a seller's listing, quotes a price, makes sure every share was really paid, releases what was bought, signs the receipt, keeps the records | Hold anyone's money; decide what a world does with a receipt |
| **BitLogin** (`bitlogin.network`) | Holds the visitor's key and wallet; shows the visitor what they are about to buy, on its own page; pays; keeps their receipts with their account and hands the right one to the world that asks | Sell anything; trust a world's word for a price |
| **A world** | Says what it sells; asks for a purchase or a receipt; checks the receipt; decides what it opens | Hold a key, a wallet or a token; sign as the visitor; draw the "pay" question itself |
| **BitPortal** (the visitor's client: Airlock, room, the page that keeps the screen) | Shows a paid door for what it is, before the crossing; draws BitLogin's panel over the world; is named as the client that brought the buyer | See the visitor's wallet, receipts or key |
| **The kit** (NSWP's library) | Gives a world the few calls it needs, and checks receipts the same way everywhere | Anything a world couldn't do itself |

## 2. Rules everything else follows from

1. **A receipt is the only proof of a purchase.** It is signed by
   BitUnlock, names the buyer's key and the thing bought, may carry an end
   date, and can be checked by anyone with no call to BitUnlock. A world
   believes a receipt and nothing else: never a flag in an address, never
   the visitor's say-so.
2. **Nobody in the middle holds the money.** Every share of a payment goes
   straight from the buyer's wallet to the person it is for. This is
   BitUnlock's rule today and it stays.
3. **The visitor is asked on BitLogin's page, every time.** What is being
   bought, from whom, for how much, who gets what share, and for how long,
   are read by BitLogin from the seller's signed listing, not from the
   world. Each payment is one press. No world is ever given a standing
   allowance.
4. **A world never signs as the buyer.** BitUnlock needs requests signed
   by the buyer (NIP-98). A world's signer refuses that kind and always
   will. So the purchase is run by BitLogin's own page, which holds the
   visitor's full session.
5. **Paid things fail closed, and nothing else changes.** If a receipt
   can't be had or checked, the paid thing stays shut and says why. A
   world with nothing for sale behaves exactly as it does today.
6. **Nothing here claims to stop copying.** A receipt says who paid. What
   a determined person does with files once they have them is outside what
   this can promise, and BitUnlock's own rules say the same.
7. **BitUnlock's fee is separate from the shares.** It is a flat charge
   for keeping the records (today, for sellers of small things, 1% with a
   10-sat floor, added up and billed to the seller). The shares in section
   8 are how the price itself is divided, and are the seller's to set.

## 3. What exists today

**BitUnlock** (live as a limited mainnet beta):

- Seller listings as signed Nostr events (kind 30078), checked before
  BitUnlock will hold what is being sold.
- A quote gives a payment plan of one or two Lightning invoices: the
  seller's, and BitUnlock's own where its fee is taken that way. Each pays
  its recipient directly. The code does not assume how many there are (its
  checkout helper handles up to 16), but the service, its database and its
  rules allow only those two roles.
- Receiving by a wallet connection (NWC) or by a plain lightning address,
  which stores nothing that could spend.
- Receipts ("entitlements"): signed, permanent or with an end date,
  renewable, revocable by the seller, and a helper any third party can use
  to check one offline plus a live check for revocation.
- Delivery of something secret to the buyer's key ("Pattern X": the goods
  are encrypted somewhere public, and the receipt's delivery carries the
  key).
- Free vouchers, a sandbox with pretend sats, seller and operator pages.
- A written, unbuilt plan for ecash (`docs/CASHU_MICROPAYMENTS_PLAN.md`).

**BitLogin** (live):

- The panel drawn inside the game, and five things a world can put to its
  visitor there: a careful note, a wallet connection, a payment of one
  Lightning invoice, saving a file, picking a file.
- An ecash wallet kept with the account (NIP-60), marked Experimental,
  never yet used with real sats. It pays a Lightning invoice through the
  mint. It can't yet send a token to a person.
- A design for keeping purchases with the account
  (`docs/portable-entitlements.md`): not built.

**The kit and BitPortal** (live, kit 0.68.0):

- `signer.pay(invoice)` and the rest of "Asking the person" (NSWP-10).
- Items a visitor carries from world to world (NSWP-17), and a bag.
- World announcements with a door plate the Airlock shows before a
  crossing.

So a world could already charge through BitUnlock today in the crudest
way: BitUnlock issues Lightning invoices, and `signer.pay` pays one. What
is missing is everything that makes it a product: BitLogin running the
purchase, receipts being kept and handed over, a world checking them, a
door saying it is paid, and shares.

## 4. What can be sold: the listing

A thing for sale is a BitUnlock product listing, signed by its seller,
with a few more tags that say what it means inside NSWP. The tags below
are proposed; their exact names are BitUnlock's and NSWP's to settle
together.

| Says | Proposed tag | Example |
|---|---|---|
| What buying it gives | `nswp:for` | A world (`37300:<pubkey>:<name>`) or an item (`37303:<pubkey>:<name>`) |
| For how long | (BitUnlock's own access policy) | Forever, or a number of days |
| The price | (BitUnlock's own) | 500 sats |
| Who gets what | `nswp:share`, one per recipient | section 8 |
| How it is gated | `nswp:gate` | `soft` or `sealed` (section 6.1) |

And the thing itself points at its listing, so a client can tell before
anyone pays:

- **A world's announcement** gains `access`: `paid`, with the listing (or
  listings: a day pass and a season pass, say) it is sold by. A world with
  no such tag is free, as now.
- **An item's description** gains `sold-by`: its listing. An item with no
  such tag is free, as now.

One listing sells one thing. Two prices for one thing (a day, a year) are
two listings. A bundle is not in this version (section 11).

**Who may sell what.** A listing for a world must be signed by the key
that signed the world's announcement, and a listing for an item by the key
that signed the item, or it is ignored. Nobody can put a price on
something that isn't theirs.

## 5. The purchase: one loop for everything sold

A new thing a world can put to its visitor, beside `propose`, `pay` and
the others (NSWP-10, "Asking the person"). Proposed names:

| The world sends its signer | The signer answers at once | And later, under the same id |
|---|---|---|
| `buy`, with the listing's coordinate | `asking` | `bought`, with the receipt (and what was delivered, where the listing delivers something); or `refused` |
| `have`, with the listing's coordinate | `receipt`, with the visitor's receipt if they hold a good one; or `none` | |

**`buy`,** step by step. All of it happens on BitLogin's page, in the
panel:

1. BitLogin fetches the listing and checks it: really signed, by the key
   that owns the thing, naming a BitUnlock service BitLogin knows.
2. It asks BitUnlock for a quote, signed as the buyer.
3. It shows the visitor: what this is and whose it is; the price; each
   share and who it goes to; how long it lasts; what it will cost to send
   (routing, the mint's fee); and which world asked.
4. On **Pay**, it pays every part of the plan from the visitor's wallet,
   asks BitUnlock to confirm, and unlocks.
5. It files the receipt with the account, and hands it to the world.

If anything stops half way (the page closes, a payment is slow), nothing
is lost: BitUnlock's orders are made to be picked up again, and the next
`buy` for the same thing resumes the same order and never charges twice.

**`have`** is how a world finds out, with no question put to the visitor,
whether they already own something. It is answered only for a listing that
belongs to the world asking (the listing's `nswp:for` is this world, or an
item this world's own publisher sells). A world can't go through a
visitor's purchases elsewhere. A visitor who would rather not say can turn
this off, and is then asked each time.

**In a headset.** The panel can't be seen from inside the headset view. A
world says so, as it does for signing in: step out for a moment, buy, step
back in.

## 6. Checking a receipt

One function in the kit, used by every world and by the Airlock, so it is
done the same way everywhere. A receipt is good only if all of these hold:

- it is really signed, by a BitUnlock service key the world trusts (a
  short list in the kit, with `api.bitunlock.network`'s on it);
- it is for this listing, and the listing is for this thing;
- its buyer is the key signed in here (for the visitor's own), or the key
  the other person's room pass names (for somebody else's);
- it has not run out;
- it has not been taken back. This is the one check that needs BitUnlock,
  so it is asked at most every few minutes and remembered. If BitUnlock
  can't be reached, a receipt that was good a moment ago stays good for a
  short while and then is treated as unknown: section 12, question 9.

### 6.1 How shut is a paid door

A world is a static website. Its files are public, so a check made by the
page can be got round by someone who means to. Three strengths, chosen per
listing:

- **`soft`.** The world and every honest client enforce it. Right for
  anything whose worth is in being there with others or being seen to own
  it: a members' room, a season pass, a look, an item.
- **`sealed`.** What is behind the door is encrypted where it is stored,
  and the key comes with the purchase (BitUnlock's "Pattern X", which
  exists). Someone who hasn't paid has nothing to look at. Someone who has
  paid could pass the key on, and rule 6 says so plainly.
- **Checked by a server.** Something in front of the world looks at the
  receipt before serving anything. The strongest, and the world is then no
  longer a plain static site. Not in this version.

## 7. The features, one by one

### 7.1 One-time access to a world

- The world's announcement says `access: paid` and names its listing. The
  listing lasts forever.
- **At the door.** The Airlock shows it on the plate before the crossing:
  "Paid: 500 sats, once" or, for someone who holds a receipt, "You have
  this". It asks BitLogin with `have`. It does not sell: the purchase is
  made in the world, or in the panel from the plate (question 4).
- **On arrival.** The world asks `have`. With a good receipt it opens.
  Without one it shows a small front room (the kit's, the same in every
  world) with what it costs and two ways on: buy, or go home.
- **Coming back** on another device: sign in, and BitLogin finds the
  receipt again from BitUnlock or from the account's own copy.

### 7.2 A world for a time, or by subscription

- The same, with a listing that lasts a number of days. The receipt
  carries its end date, and any client can read it offline.
- **Renewing is buying again.** The new receipt is tied to the one it
  renews, as BitUnlock already records. Whether it runs on from the old
  one's end or from the day it was bought is BitUnlock's to confirm. In
  this version nothing renews by itself: every payment is a press (rule
  3). The world may remind someone whose time is nearly up.
- **Running out mid-visit.** Checked on arrival and every few minutes. On
  running out the visitor is told, given a moment, and shown the front
  room again. Nobody is thrown out mid-sentence.

### 7.3 A paid item

- The item's description says `sold-by` and names its listing.
- **Owning it is holding the receipt.** A bag shows a paid item its owner
  hasn't bought as locked, with its price and a way to buy it.
- **Other people see it only if it is really owned.** When someone holds
  an item, their client shows the others their receipt beside it. Every
  client checks it (section 6) before drawing the item in that person's
  hand. No receipt, no item, however their own client is behaving. This is
  what makes a soft gate enough for items.
- **Where it is sold.** Anywhere the item is shown: a stall in a world, a
  shelf in BitPortal's room, the bag itself. The same `buy` in each.
- A world still has the last word on items (NSWP-17): one that has none,
  has none, paid or not, and its door already says so.

### 7.4 An item for a time

The same, with a listing that lasts a number of days. When the receipt
runs out the item is put away and shows as locked again.

### 7.5 A tip to a person

No BitUnlock, no listing, no receipt: a tip is a payment and nothing is
unlocked by it.

1. From a person's card: "Send a tip", and an amount.
2. The world reads the lightning address in their own Nostr profile and
   asks it for an invoice of that amount.
3. `signer.pay(invoice)`. BitLogin shows who it is for and how much, and
   pays at a press. The kit already checks the proof of payment.
4. The tipper is told it went. The other person is told only if this
   version includes a notice (question 11).

Someone with no lightning address in their profile can't be tipped yet,
and the row says so. Ecash straight from one person's wallet to another's
is better for small tips and is not built in BitLogin yet (section 11).

### 7.6 A tip to a world

The same, to an address the world's announcement names (`tip`), or its
publisher's profile where it names none. Offered in the world's menu and
on its door plate.

No share is taken from a tip (question 10).

## 8. Shares: who gets what

**What the seller writes.** One `nswp:share` on the listing for each
recipient: who (a key), what for (a short label shown to the buyer:
"world", "maker", "client"), and how much (parts in ten thousand of the
price). They must add up to the whole price. A listing with no shares
pays its seller everything, as today.

A share for **the client** is the one that pays BitPortal, or any other
client: it names no key, and goes to whichever client brought the buyer.
The client says who it is when the purchase starts. The seller agrees to
it by signing it into the listing, so nothing is ever taken that the
seller didn't offer. Which clients may claim it is question 6.

**What the buyer sees.** Every share, by label and name, before paying.

**How each share is paid.** This is the part that needs deciding, because
BitUnlock today pays two parties and says in its own code that a
marketplace's cut is not its business. Three ways:

- **A. BitUnlock makes one payment leg per recipient.** Each recipient
  gives a lightning address (BitUnlock can already check payment to one
  without holding any credential) or, later, a key for ecash. Every share
  is paid directly and BitUnlock releases nothing until all have settled.
  The cleanest, and it needs BitUnlock to allow more than two roles, which
  its own notes mark as a legal question.
- **B. BitLogin pays the shares itself.** BitUnlock is paid the seller's
  part as now; BitLogin's page pays the others at the same press. Nothing
  changes in BitUnlock, but nothing outside the buyer's own wallet proves
  the others were paid.
- **C. The seller is paid everything and pays the others on.** Nothing new
  is needed, the seller holds other people's money for a while, and the
  others must trust the seller.

The recommendation is A, and until it is decided, sales to a single
seller only.

**Small shares.** Over Lightning each share is its own payment, with its
own cost and its own least amount. A 2% share of a 100-sat item is 2 sats
and may cost more than that to send. So either small shares are added up
and paid later (which is holding money, and so is out), or they need
ecash, where a payment can be cut into pieces of any size, each locked to
its recipient's key. That is the real case for BitUnlock taking ecash
(section 9), and question 7.

## 9. Wallets: what pays and what is paid

**Paying.** In this version, BitLogin's ecash wallet, which pays any
Lightning invoice through its mint. Later, a wallet connection (NWC) kept
in BitLogin's vault could pay the same way. BitUnlock does not care which.

**Being paid, today.** A seller connects a wallet (NWC) or gives a
lightning address.

**Being paid in ecash, proposed.** BitUnlock's own plan has it redeem the
buyer's tokens itself, which would make it hold the seller's money for a
moment and breaks rule 2. The alternative proposed here:

- the buyer's wallet makes each share as a token **locked to that
  recipient's key**, so only they can ever spend it;
- BitUnlock checks each token without being able to spend it: that the
  mint really signed it, that it is locked to the right key with no way
  back to the buyer, that it is for the right amount, and that the mint
  says it is still unspent;
- it records the token so the same one can't pay for two orders, and
  releases;
- the recipient collects it whenever they like.

It needs a short list of mints BitUnlock will accept, since a token is
only worth what its mint is good for. And it needs BitLogin's wallet to be
able to send a locked token, which it can't yet.

## 10. What each project would have to add

| Project | To add |
|---|---|
| **BitUnlock** | The NSWP tags on a listing, and checking the seller owns the thing. A receipt that names what it is for. Later: more than two recipients (A above), and ecash received as locked tokens. |
| **BitLogin** | Keeping receipts with the account, and finding them again (its own unbuilt design). `buy` and `have`. The purchase page in the panel. Later: sending a locked ecash token. |
| **The kit (NSWP)** | `signer.buy`, `signer.have`. One receipt check. The front room of a paid world. A locked item in the bag, and receipts beside held items. Tip rows. The new tags in NSWP-01 (worlds) and NSWP-17 (items), and a new section for all of this. |
| **BitPortal** | The paid plate on a door. Saying which client it is at a purchase. A shelf for its own items. |

## 11. Left out on purpose, and how more is added later

Not in this version:

- anything that pays by itself: a subscription that renews, a spending
  allowance for a world, pay-per-use;
- giving, lending, reselling or transferring something bought;
- bundles, discounts, sales, and vouchers in the game (BitUnlock has
  vouchers already, so this one is near);
- refunds from inside the game (BitUnlock's refund records exist and are
  not finished);
- a gate checked by a server;
- ecash from person to person, and public tip notices;
- a share to someone who resells or recommends;
- buying from inside the headset view;
- sellers of record other than through BitUnlock.

So that more can be added without starting again:

- **Receipts are general.** One names a thing by its coordinate, whatever
  kind of thing it is. A new kind of thing for sale needs no new kind of
  receipt.
- **The list of trusted issuers is a list.** Another service that signs
  receipts the same way is one more line.
- **Listings and requests carry a version,** and a client that meets a
  tag or a share label it doesn't know shows it plainly and never guesses.
- **`buy` and `have` say nothing about how the money moved.** A new way to
  pay is BitLogin's and BitUnlock's to add, and no world changes.
- **Everything closed is written down as closed** (which kinds of thing
  can be sold, which gates there are), so widening one is a decision
  someone makes and not an accident.

## 12. Open questions for the owner

**Gates and access**

1. **How shut should a paid world be** in this version: `soft` only, or
   `sealed` as well? (Recommended: both in the design, `soft` built first.)
2. **When a subscription runs out mid-visit:** a notice and a moment, as
   proposed, or straight to the front room?
3. **May a world be paid and still let people look?** A free front room is
   proposed. Should a world be able to show a taste of itself (a preview
   area) before asking?
4. **Where is a world bought:** only on arrival inside it, or also from
   the door's plate at the Airlock and in BitPortal's room, before going?

**Money**

5. **How are shares paid:** A (BitUnlock, one leg each), B (BitLogin pays
   them) or C (the seller pays the others on)? A is recommended and is the
   one BitUnlock's notes say needs a legal view first.
6. **BitPortal's own share.** Is it a number each seller chooses, a number
   BitPortal asks for and a seller accepts or not, or fixed? May any
   client claim the client's share, or only ones the seller names? What
   happens to it when someone opens a world directly, with no client?
7. **Small shares.** Is there a least price, or a least share, below which
   something can't be sold over Lightning? Or does this wait for ecash?
8. **Mints.** Which ecash mints would BitUnlock accept, and who decides?
   BitLogin's wallet is marked Experimental and has never held real sats:
   is that acceptable for the first real sale?
9. **If BitUnlock can't be reached** when a receipt needs its
   taken-back check: let the visitor in for a while, or keep the door
   shut?
10. **Tips.** No share taken from a tip, as proposed? A least and a most?
11. **Does the person tipped get told,** and does anyone else see it?

**Selling**

12. **Who can sell.** Any world and any item maker, by signing up with
    BitUnlock themselves? Or only BitPortal's own things to begin with?
13. **Refunds.** Who can give one, and does a refunded receipt stop
    working at once?
14. **Privacy.** A receipt shown beside a held item tells everyone in the
    room that this key bought it. Acceptable, or should that be something
    a person can turn off (and then not be seen holding it)?
15. **BitUnlock's fee** stays as it is (1%, 10-sat floor, billed to the
    seller), or changes for things sold in worlds?
16. **Law.** Shares between several parties, and a share for the client
    that brought the buyer, are the parts most likely to need a lawyer's
    view. Who asks, and does anything wait on the answer?

**Order of work**

17. **What comes first?** Proposed: tips (needs nothing new from
    BitUnlock); then receipts in BitLogin with `buy` and `have`, tried
    against BitUnlock's sandbox with pretend sats; then a paid world; then
    paid items; then shares and ecash once questions 5 to 8 are answered.
18. **Which thing is sold first for real?** One real product gives all of
    this something to be tested against: a world, a pass, or one of
    BitPortal's own items.
