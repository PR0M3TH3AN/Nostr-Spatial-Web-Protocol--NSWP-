# Paying for things: BitPortal, BitLogin and BitUnlock together

**Status:** a proposal, written for the owner on 2026-11-21. Nothing in it
is built unless a line says "exists". It is to be argued with, and the
open questions at the end are the owner's to answer before any of it is
started. Section 10 (why a world would sell this way and not its own) was
added the same day, at the owner's asking. The questions it ended with
were answered the same day too ("Yes to all of these", to the answers
recommended): section 13 is what was decided, and section 14 what is
still open. **Decided is not built: nothing here is built yet.** Section
10.6 (how this pays for development) is an assessment the owner asked to
have written down, and is not one of the things decided. Section 11 was
rewritten after reading the code of all three projects at each place this
touches them: it found nine things the first draft had wrong, which are
listed there and corrected where they stood. BitLogin's own session then
read section 11.3 and corrected three more points, which are in. Section
11.6 (BitUnlock's own pages inside the game) was added at the owner's
asking and is not decided.

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
two listings. A bundle is not in this version (section 12).

**Who may sell what.** A listing for a world must be signed by the key
that signed the world's announcement, and a listing for an item by the key
that signed the item, or it is ignored. Nobody can put a price on
something that isn't theirs. This is checked by whoever reads the receipt,
and needs nothing from BitUnlock: a receipt names its listing, a listing's
coordinate carries its seller's key, and that key is compared with the
key that signed the world or the item.

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

It is answered from what that world's signer has been handed, and not by
asking BitUnlock then and there: the signer inside a world may reach
relays and nothing else, and can't sign the kind of request BitUnlock
needs (section 11.1). BitLogin's own page hands a world's signer the
receipts for that world's own listings, and no others, when the visitor
signs in there and after every purchase: the same way it hands over the
session, and for the same reason (a browser keeps a framed page's storage
apart, so the two can't simply share a store). A world's signer therefore
never holds what a person bought elsewhere. Something bought on another
device shows up here once BitLogin's page has next been open for this
world; and `buy` for something already owned finds the receipt and
charges nothing.

**Buying is not the same as paying.** `pay` (which exists) pays one
invoice a world made, and that is all: nothing is signed, nothing is kept,
nothing is owned afterwards. It stays, because a tip needs it and because
a world is free to sell its own way. But BitLogin's page says which of the
two is happening, in words (section 10.2): a purchase names what will be
yours and who vouches for it; a bare payment says that nothing will be
recorded as yours.

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
  can't be reached, a receipt that was last found good within a day stays
  good; after that the door is shut until BitUnlock answers (decided:
  someone who paid isn't locked out by a short outage).

### 6.1 How shut is a paid door

A world is a static website. Its files are public, so a check made by the
page can be got round by someone who means to. Three strengths, chosen per
listing. Decided: `soft` and `sealed` are both in the design, and `soft`
is built first.

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
  this". The Airlock asks nobody for this: its own rule is that it never
  waits on another site, so it reads a note BitPortal's room keeps in this
  browser of what the visitor holds (section 11.1). Decided: a world can
  be bought wherever it is shown: from the plate, in BitPortal's room, and
  inside the world. Always the same `buy`, on BitLogin's page.
- **On arrival.** The world asks `have`. With a good receipt it opens.
  Without one it shows a small front room (the kit's, the same in every
  world) with what it costs and two ways on: buy, or go home.
- **A taste first, if the world wants.** Decided: a paid world may have a
  part anyone can walk into before being asked. It is the world's choice,
  and a world with none goes straight to the front room.
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
  running out the visitor is told, given a couple of minutes, and shown
  the front room again (decided). Nobody is thrown out mid-sentence.

### 7.3 A paid item

- The item's description says `sold-by` and names its listing.
- **Owning it is holding the receipt.** A bag shows a paid item its owner
  hasn't bought as locked, with its price and a way to buy it.
- **Other people see it only if it is really owned.** When someone holds
  an item, their client shows the others their receipt beside it. Every
  client checks it (section 6) before drawing the item in that person's
  hand. No receipt, no item, however their own client is behaving. This is
  what makes a soft gate enough for items. Decided: showing the receipt is
  the ordinary way, and a person may turn it off for themselves, in which
  case they are not seen holding the item.
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
2. The world sends its signer `tip`, with the person's key and the amount
   (a new request, proposed: section 11.1 says why a bare `pay` won't do).
3. BitLogin's page reads that person's own Nostr profile, finds their
   lightning address, and asks it for an invoice of that amount. The
   invoice must be for exactly that amount, or nothing is shown. It shows
   the visitor who it is for, by the name in that profile and by the
   lightning address itself beside it, since a name is anyone's to claim;
   and pays at a press.
4. The tipper is told it went. The other person is told privately, and
   nobody else is (decided). How, is still to settle: the plainest way is
   the note that travels with the payment, where their wallet takes one
   (section 14).

A tip is one sat at least. No share of a tip goes to anyone but the
person tipped (decided).

The limit on a bare payment (section 10.2) applies to a tip too, since
nothing is owned afterwards: a tip over the visitor's own limit is turned
down by BitLogin with the reason, and they may raise the limit there.

Someone with no lightning address in their profile can't be tipped yet,
and the row says so. Ecash straight from one person's wallet to another's
is better for small tips and is not built in BitLogin yet (section 12).

### 7.6 A tip to a world

The same, to an address the world's announcement names (`tip`), or its
publisher's profile where it names none. BitLogin reads that address from
the world's signed announcement itself, never from what the world says
when it asks. Offered in the world's menu and on its door plate.

No share is taken from a tip (decided).

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
seller didn't offer. Decided: each seller chooses the number, and
BitPortal publishes the rate it suggests; any client may claim it, so
this stays open to other clients; and where no client brought the buyer
(a world opened by its own address), that share goes to the seller.

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

Decided: A. And decided with it: a lawyer is asked about shares between
several parties, and about the client's share, before either is built.
Until then, sales to a single seller only. Nothing else waits on it.

**Small shares.** Over Lightning each share is its own payment, with its
own cost and its own least amount. A 2% share of a 100-sat item is 2 sats
and may cost more than that to send. So either small shares are added up
and paid later (which is holding money, and so is out), or they need
ecash, where a payment can be cut into pieces of any size, each locked to
its recipient's key. That is the real case for BitUnlock taking ecash
(section 9). Decided: over Lightning no share may be under about 10 sats,
and a listing whose shares would be smaller can't be sold until ecash is
in.

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
only worth what its mint is good for. Decided: the list is short and the
owner approves each mint on it, beginning with one or two well-known
ones. And it needs BitLogin's wallet to be able to send a locked token,
which it can't yet.

Decided for the first real sale: BitLogin's wallet is marked Experimental
and has never held real sats, so the first thing sold for real costs
under about 1,000 sats.

## 10. Why a world would sell this way, and not its own

**The plain fact first.** Nothing here can stop a world selling its own
things its own way, and nothing here tries to. A world is a website: it
can show its own invoice, and with `pay` it can have a visitor pay it from
their BitLogin wallet at one press, with no BitUnlock, no receipt and no
share for anyone. That is left open on purpose. So the reason to sell this
way has to be that it is worth more and costs less than the alternative,
and that it is worth more the more worlds and people there are.

### 10.1 What a world can't make by itself

1. **Ownership nobody can forge.** A static world can take a payment, but
   it can't keep a record of who bought what that a visitor can't fake:
   everything a world keeps for a visitor is the visitor's own to write
   (their saves, their browser). A purchase that lasts needs someone
   independent to sign it. That is the receipt (rule 1).
2. **Things that come with you.** A receipt is in the buyer's library on
   every device and is honoured in every world. Something bought privately
   inside one world stays in that world.
3. **Being seen to own it.** Other people's clients draw a paid item in
   someone's hand only when their receipt checks out (section 7.3). An
   item sold outside can't be shown as owned anywhere else.
4. **A wallet with something in it.** The visitor's balance and the one
   press are BitLogin's. Selling outside means asking people to fund
   something else, or to scan a code, which in a headset is close to
   impossible.
5. **Being found.** BitPortal's doors, shelves and lists are where buyers
   come from, and a paid door there says what it costs before anyone
   crosses. The client's share (section 8) is what a seller offers for
   that, by choice.
6. **Being trusted.** A rating from someone who really bought the thing; a
   record of refunds given; a seller's history. None of these can exist
   without receipts. (A "bought it" mark on a rating, NSWP-13, is wanted
   and decided for later, not for the first version.)
7. **A maker's share that follows the item.** Whoever sells an item, in
   whatever world, the maker's share is in its listing, and no world can
   list an item without its maker's signature (section 4).

Every one of these but the fourth is worth more with each world and each
person added. That is what makes it a position worth holding, and not a
wall.

### 10.2 Making it the easy way

- **A few lines to sell.** A world needs no server, no wallet of its own,
  no records and no checkout page:

  ```js
  const receipt = (await signer.have(listing)) ?? (await signer.buy(listing));
  if (receipt && (await checkReceipt(receipt, listing)).ok) open();
  ```

- **A small take.** What a seller gives up in all (BitUnlock's fee, and
  the client's share where they offer one) has to stay well under what it
  would cost them to build and run their own. Decided: the aim is under a
  tenth of the price all in, far under what an app store takes; and
  BitUnlock's own fee stays as it is, so that two prices aren't changed
  at once. These two pull against each other for cheap things: the fee is
  1% but never under 10 sats, so on a 100-sat item it is a tenth by
  itself, and on a 200-sat item a twentieth. Section 14 has this to
  settle: a least price, or a lower floor.
- **Say what is true, and block nothing.**
  - On BitLogin's page, a bare payment reads: "A payment to this world. No
    receipt: nothing will be recorded as yours." A purchase reads what
    will be yours, for how long, and that BitUnlock vouches for it.
  - On a door, a world that sells through receipts is marked "Sells with
    receipts". A world that doesn't is not marked down: it simply has no
    mark it hasn't earned.
  - In a bag and in a hand, nothing is ever shown as owned without a
    receipt from an issuer the client trusts.
- **A limit on bare payments.** By default, BitLogin pays no more than a
  set amount in one bare payment a world asks for, and the visitor can
  raise it for themselves on BitLogin's page. A purchase has no such
  limit, because the visitor has been shown a signed listing and gets a
  receipt. The reason is safety (a world that asks for a great deal, for
  nothing), and it also sends anything of worth the receipted way.
  Decided: 1,000 sats by default, one limit for tips and everything else.
- **Nothing is "paid" without a receipt.** Decided: the kit gives a world
  no way to treat a bare payment as a purchase. A world that wants to
  sell its own way can still build that itself; the kit doesn't help.
- **What BitPortal puts forward is the owner's.** Its shelves, its starter
  set and its lists show what the owner chooses, as they do now. Decided:
  worlds that sell with receipts are put first, and the others are not
  left out.

### 10.3 Staying open

- The receipt, the listing's tags, and `buy` and `have` are written down
  and anyone may implement them.
- The issuers a client trusts are a list. Another service that signs
  receipts the same way can be added to it, by a client or by a visitor
  for themselves. Decided: a visitor may add an issuer for themselves; a
  world may not name its own; and the list BitPortal ships with is short
  and the owner's. BitUnlock is first on it because it is there, not
  because the list is closed.
- `pay` stays. Nothing in the kit refuses to run in a world that sells its
  own way, and nothing hides such a world.

### 10.4 What is not done, and why

- **Nothing blocks a payment made outside.** It can't work on the open
  web, and world makers would rightly stop trusting a client that tried.
- **BitPortal does not hold people's balances.** Running the mint that
  everyone's wallet uses would be the strongest hold of all, and it means
  holding other people's money, with everything that follows in law. If it
  is ever wanted it is its own decision, not a step toward this.
- **No world is marked down for selling its own way.** It goes without the
  marks, the travel and the trust above, and that is all.

### 10.5 The limit of this

A large world with its own crowd can do without all of it and lose
little. This doesn't have to stop that. It has to make it uncommon, and
not worth the trouble for nearly everyone.

### 10.6 How this pays for development

Written down at the owner's asking (2026-11-21: "Is this the right
business model for bitportal?"). It is an assessment, not a decision.

**The share is the right shape, and it is not income yet.**

- It is the right shape because nothing on the open web can be made to
  pay a toll. A small share that a seller offers by choice, for a wallet,
  receipts and buyers they couldn't have had alone, is the only kind that
  lasts; it is worth more with every world and person added; and a world
  maker who can leave is one the client has to go on being useful to.
- It is not income yet because the sums are small until there are a great
  many of them. A 500-sat item is about half a dollar, and under a tenth
  of that is a few cents. The share is the seller's to offer, any client
  may claim it, and a world opened by its own address pays none. And it
  waits on a lawyer (section 13, 16).
- Of the three projects, the client is the easiest to replace: that is
  what being open means. What people keep is their identity and wallet
  (BitLogin) and the record of what they bought (BitUnlock). BitPortal is
  where the buyers come from more than where the money stays.

**So the business is the three together:** BitPortal brings people,
BitLogin holds who they are and what they can spend, and BitUnlock keeps
the records and takes its fee.

**What can pay sooner,** in the order it could start:

1. **BitPortal's own things, sold at full margin.** Items, looks, passes,
   things for a home. This is how most virtual worlds earn, it needs no
   shares and no outside sellers, and it is already the first real sale
   chosen (section 13, 18).
2. **Charging the people who make worlds, for convenience.** Publishing
   and hosting a world from the template at one press, an address of
   their own, more room for files. People pay for that by the month long
   before a marketplace has any volume. Nothing of this is designed yet.
3. **BitUnlock's fee, across everything that uses it.** It is taken on
   sales in the owner's other applications already, whatever happens in
   worlds.

The client's share is then what grows with the whole, and not what
development depends on.

**What this can't say** is whether enough people will come. That rests on
there being worlds worth visiting, which no way of charging provides. The
cheapest thing that would show it is the one already planned: one item,
at a low price, and whether anyone buys it.

## 11. Where the three projects meet, checked against their code

Read on 2026-11-21 in each project's own code: BitUnlock at `2218ee0`
with uncommitted work in its checkout (read, not touched), BitLogin at
`1dd171d`, the kit at 0.68.0 and BitPortal at `c1e2170`. Each line says
whether something is there already, has to change, or is new.

### 11.1 What the first draft had wrong

1. **`have` can't be answered by asking BitUnlock.** The signer inside a
   world is served with rules that let it reach relays only
   (`connect-src 'self' wss:`), and a session handed to it can never sign
   a request to a server (kind 27235 is on its never list). So it answers
   from what BitLogin's own page has handed it. (A second draft said "a
   store in the same browser". BitLogin's session corrected that: a
   framed page's storage is kept apart by the site it is framed in, so a
   world opened by itself shares none with BitLogin's window. Receipts
   are handed to a world's signer the way the session is.) Corrected in
   section 5.
2. **The Airlock can't ask BitLogin anything.** BitPortal pins that the
   Airlock "loads nothing from the sign-in address" and reads only this
   browser's own note. So "You have this" on a plate comes from a note the
   room keeps. Corrected in section 7.1.
3. **BitUnlock needn't check who owns what is sold.** The receipt names
   the listing, and the listing's coordinate carries the seller's key, so
   whoever checks the receipt compares keys. `nswp:for` is for BitLogin to
   show and to decide which world may ask `have`. BitUnlock's check of a
   listing looks at the tags it needs and ignores others, so the new tags
   need no change there. Corrected in section 4.
4. **A tip through a bare `pay` is a weak tip.** BitLogin sees an invoice
   and the world that asked, and can't say who is being tipped: a world
   could call a payment to itself a tip to someone. And a world that
   draws no items may reach nothing but relays, so it couldn't ask a
   lightning address for an invoice at all. So a tip is its own request,
   `tip`, which BitLogin fulfils itself. "Tips need nothing new from
   BitLogin" was wrong. Corrected in section 7.5.
5. **"Under a tenth" and "the fee stays as it is" pull apart** for cheap
   things: BitUnlock's fee is 1% and never under 10 sats
   (`BITUNLOCK_FEE_MIN_SATS`). Noted in section 10.2; to settle in 14.
6. **There is no sandbox to try against.** BitUnlock's pretend-sats
   service exists as code and "is not publicly hosted". Someone has to
   run one that BitLogin's page can reach, and BitLogin needs a way to be
   pointed at it. Noted in section 13, 17.
7. **A listing must deliver something.** BitUnlock won't register a
   product with nothing to release (`sellerCiphertext` is required). A
   `soft` listing delivers a small fixed note and nobody needs it.
8. **The first sale can be simpler than described.** BitUnlock has a mode
   for its own operator's products: one invoice to the seller and no fee
   part (`single-recipient`, switched on per seller by the operator
   only). Noted in section 13, 18.
9. **A receipt shown to a room shows more than "bought it".** It carries
   the order's number and the payment's hashes, and BitUnlock's own design
   keeps receipts private (wrapped, on relays). Showing one beside a held
   item is a new exposure, small but real; decision 14 lets a person turn
   it off. A receipt can't be cut down, because its signature covers all
   of it.

### 11.2 BitUnlock

**There already, nothing to change:**

- Calls from any website: the API answers any origin, because every call
  is signed and none rides on a cookie (`src/cors.ts`). BitLogin's page
  and a world can both call it.
- Buying as the buyer: quote, order, refresh, unlock, each signed by the
  buyer (`docs/NIP98_AUTHORIZATION.md`), and safe to repeat.
- A time limit on what is sold: `accessTermSeconds` on a product.
- Receipts, a list of a buyer's own (`GET /v1/access-entitlements`), and a
  public "is this one still good" answer for the taken-back check.
- The price, read from the signed listing (`["price", "<sats>", "SAT"]`).
- Being paid at a lightning address with nothing stored that could spend.
- A checkout helper that takes whatever wallet and signer it is given
  (`runBitUnlockCheckout`).

**Has to be done before a first sale:**

- A seller's account for BitPortal, a receiving wallet or address, and a
  listing for the first item. Nothing to build: it is setting up.
- A sandbox that can be reached (11.1, 6).
- A way for BitLogin and the kit to take BitUnlock's code: its `sdk` and
  `protocol` packages are private and unpublished. BitLogin would vendor
  the checkout; the kit would rather have the receipt's exact form and
  some examples to test against than a dependency.
- Its service key written where the kit can pin it.
- An answer on how a renewal's time is counted (section 14).

**Has to change, later:**

- More than two parties to a payment: the roles are fixed at two
  (`PAYMENT_ROLES`), and its database and its published form allow at
  most two parts, though its checkout helper already takes up to sixteen.
- Saying which client brought the buyer, on a quote. No field for it.
- Ecash received as tokens locked to each recipient (section 9), and the
  list of mints.

### 11.3 BitLogin

**There already:** the panel, and the family of things put to the person
(`asking`, then an answer); `pay`; the wallet that pays an invoice through
its mint; the panel's page may reach any `https:` address, so it can call
BitUnlock and a lightning address.

**New, for tips:** `tip`, with a person's key and an amount: read their
profile, find their lightning address, get an invoice, check its amount,
show who it is for, pay. The same for a world's own address.

**New, for anything sold:**

- Receipts kept with the account by its own page, fetched from BitUnlock
  at sign-in and after a purchase; and handed to each world's signer, for
  that world's own listings only, by the sealed message that hands over
  the session.
- The calls to BitUnlock and to a lightning address made by the page
  itself, as its wallet and files code do: its crypto worker is served
  the stricter rule (`'self' wss:`) even when the panel started it, so
  the worker only signs. The buyer's signed request to BitUnlock is one
  worker action of its own, which signs that kind for a named BitUnlock
  address and nothing else. Kind 27235 stays on the never list for worlds
  and applications.
- `buy`: BitUnlock's checkout, with this wallet and this session; the
  page that shows what, whose, how much, each part and how long. Two
  parts to a payment are two payments through the mint, each with its own
  cost.
- `have`, answered by the signer from the store, only for the world's
  own listings.
- The same three for an application (BitPortal's room), on its client, as
  `propose` and `pay` were added.
- A place to see what one owns, in the panel. Its ordinary account page
  can't reach BitUnlock as it is served today (`connect-src 'self' wss:`).

**Has to change:** `pay` gains its words ("no receipt") and the visitor's
limit, 1,000 sats to begin (section 10.2): one setting, for `pay` and
`tip` together.

**Later:** sending a token locked to someone's key; paying from a wallet
connection; the list of issuers a visitor may add to.

### 11.4 The kit (NSWP)

**There already:** the family of requests in `signer.ts` and the page
being shown at `asking`; items, bags, and "I am holding this" told to a
room (`hold:` on the room's own channel).

**New:**

- In the core: the three requests and their answers (`signing.ts`); a
  receipt read and checked (its own file, with the issuers trusted);
  `access` and `tip` on a world's announcement and `sold-by` on an item,
  read without ever failing a world that has none (the Airlock's quick
  path depends on that).
- In the kit: `signer.buy`, `signer.have`, `signer.tip`; the front room;
  a locked item in the bag; a receipt sent beside `hold:` and checked
  before an item is drawn in someone's hand; tip rows on a person's card
  and in a world's menu; the marks on a plate.
- For worlds made with Godot: the same calls through the engine build and
  the add-on.
- In the rules a world is served with: a world that sells must be able to
  reach BitUnlock for the taken-back check. A world that draws no items
  may reach only relays today (`build-sites.mjs`, and the template's
  build). BitUnlock's address is added by name, not "any https".
- Written down: NSWP-01 (the announcement's tags), NSWP-10 (the
  requests), NSWP-17 (a paid item), and a section of its own for the
  rest.

**Has to change:** nothing that exists. `pay` stays as it is; the kit
simply never treats it as a purchase (decided, 24).

### 11.5 BitPortal

**There already:** the plate on a door and its marks (`plate.ts`); the
page that draws BitLogin's panel, which needs nothing new for any of
this; its room as an application of BitLogin's.

**New:**

- A mark on a plate for a paid world, and "Sells with receipts".
- A note in this browser of what the visitor holds, kept by the room,
  for the Airlock to read (11.1, 2).
- The room buying and asking through BitLogin's client, and a shelf for
  BitPortal's own things.

**Not possible as things are, and to decide:**

- **BitPortal can't write a listing.** It may sign application data only
  under its own name (`bitportal/`), and a BitUnlock listing is not that.
  A listing is made in BitUnlock's seller pages (or BitRoad) for now.
- **Marking a world as paid is signing its announcement again,** and
  publishing it, which is the owner's word each time. The reference
  worlds are free and stay so unless the owner says.

**Later:** saying which client it is, at a purchase.

### 11.6 BitUnlock's own pages, inside the game

Asked for by the owner on 2026-11-21: "I'd like for bitunlock to have
some nice in-game framed UI as well so anyone can sign up and use and
sell or see their owned items inside of bitportal like we have for
bitlogin." Proposed here; nothing of it is built, and three decisions it
needs are in section 14.

**Two different things were asked for, and they live in two places.**

- **Seeing what you own** is the buyer's side, and it is already in this
  proposal as BitLogin's: the receipts are kept with the account, and its
  panel shows them (the "library" mode, section 11.3). BitUnlock is where
  they were issued, not where a person looks for them.
- **Signing up to sell, and selling,** is BitUnlock's. It has seller pages
  today at `bitunlock.network/portal` (an overview, orders, connections),
  which no other site may frame (`frame-ancestors 'none'`), and which sign
  a seller in with BitLogin's widget on BitUnlock's own address.

**The same shape as BitLogin's panel.** A second panel, BitUnlock's own
page, drawn by the page that keeps the screen over the world, where the
menu is:

- BitUnlock serves a page made for it (say `/panel/`) that only a client
  it names may frame, as BitLogin does. Never a world: a page that frames
  a seller's pages could cover them or slide them under a press.
- It speaks the same few words to the client that BitLogin's panel does
  (who asked, ready, the size it would like, close), so the client's
  panel code is one thing with a short list of whose panel it is, and not
  two things.
- What it opens at is named by the client: selling in general; or selling
  one named thing, from "Sell this" on an item its maker is holding or
  "Charge for this world" in a world its maker is standing in.
- The kit's menu gains a row for it beside "Your account" and "Your
  files", in every world and in BitPortal's room.

**What it shows,** for a first version: signing up as a seller; where to
be paid; making a listing for a world or an item (the price, how long it
lasts, and later its shares); what has been sold; taking a receipt back.
It is BitUnlock's seller pages, made to fit a panel.

**Signing in is the hard part.** Decided by the owner on 2026-11-21: A,
through BitLogin, as the best experience (already signed in, one identity
for playing and selling, one place to take it back), and "We can show a
warning if needed for extra awareness". So: when BitLogin first asks
whether BitUnlock may act as the person for selling, it says plainly what
that lets BitUnlock do (make and change listings, see what was sold, say
where to be paid), that it is for BitUnlock's own service and nowhere
else, and where it can be taken back. The wording is BitLogin's. The
three ways that were weighed:

Every call a seller makes to BitUnlock is signed as them (NIP-98). Inside
a frame there are three ways to get that signature:

- **A. Through BitLogin, as an application.** BitUnlock's page embeds
  BitLogin's signer and asks it. Today that kind of signature (27235) is
  on BitLogin's never list for worlds and applications. It would need one
  narrow new permission: a named application may have a request signed
  that is addressed to its own service and nowhere else. No second
  sign-in, no password typed in BitUnlock's frame. Recommended.
- **B. BitLogin's widget on BitUnlock's address, as now.** A browser keeps
  a framed page's storage apart, so the seller would sign in again inside
  BitUnlock's panel, typing a password or using a passkey there. It works
  with nothing new, and it is one more place a password is asked for
  with no address bar.
- **C. BitLogin's page does the selling too.** No second panel: BitLogin
  shows BitUnlock's seller pages itself. Nothing new to trust, and the
  two projects are then tied together in a way they aren't now.

**Being paid, from inside the game.** Decided (section 13, 27). A
lightning address only: it is
public, and typing it gives nothing away. A wallet connection is a secret
that can spend, a world can draw a copy of any panel, and so connecting
one stays at BitUnlock's own address, with its address bar. Later, being
paid straight into BitLogin's own wallet (section 9) would need no
address at all.

**"Anyone can sign up" and "by invitation first".** The owner decided
that selling opens in stages (section 13, 12). The panel is built so that
anyone can use it; who may register is a switch BitUnlock already has
the means for, and is opened when the owner says.

**What each project adds for it:**

| Project | Adds |
|---|---|
| **BitUnlock** | A page made for a panel, framed only by named clients; the panel's few words; its seller pages laid out for that space; a way to open at "sell this thing". |
| **BitLogin** | For A: the narrow permission for a named application to have requests to its own service signed. For B and C: see above. |
| **BitPortal** | Its page that keeps the screen may frame BitUnlock's panel as well as BitLogin's (decided: section 13, 26). Today its rule is that it frames the sign-in address and the worlds it names and nothing else, so this is a change to that rule, by name, for one more address, and its pinned tests change with it. |
| **The kit** | A row to open it; "Sell this" on an item its maker holds and "Charge for this world" where its maker stands; a new mode for the client to pass on. |

### 11.7 What this does to the order of work

- **Tips** wait on BitLogin's `tip`. A lesser tip could be built today
  with `pay`, for worlds that may reach a lightning address, and would
  have to say "this world says it is for…". Not recommended.
- **Receipts, `buy` and `have`** wait on a sandbox someone runs, and on
  BitUnlock's checkout being something BitLogin can take.
- **The first real sale** needs no new code in BitUnlock at all.

## 12. Left out on purpose, and how more is added later

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

## 13. What the owner decided

On 2026-11-21 the owner was given a recommended answer to each of the
twenty-four questions this proposal first ended with, and said: "Yes to
all of these." These are those answers. Each is also written into the
section it belongs to.

**Gates and access**

1. **How shut a paid world is:** `soft` and `sealed` both designed, `soft`
   built first.
2. **A subscription that runs out mid-visit:** a notice and a couple of
   minutes, then the front room.
3. **A taste before paying:** allowed, the world's choice.
4. **Where a world is bought:** wherever it is shown: the door's plate,
   BitPortal's room, and inside the world.

**Money**

5. **How shares are paid:** by BitUnlock, one payment to each recipient.
   A single seller only until question 16 is answered.
6. **The client's share:** each seller chooses it, BitPortal publishes a
   suggested rate, any client may claim it, and with no client it goes to
   the seller.
7. **Small shares:** none under about 10 sats over Lightning; smaller
   waits for ecash.
8. **Mints:** a short list the owner approves, one or two well-known ones
   to begin. The first real sale stays under about 1,000 sats while the
   wallet is Experimental.
9. **BitUnlock out of reach:** a receipt found good within the last day
   stays good; after that the door is shut.
10. **Tips:** no share taken. One sat at least; at most, the limit on a
    bare payment.
11. **The person tipped is told,** privately. Nobody else is.

**Selling**

12. **Who can sell:** BitPortal's own things first; then a few world
    makers by invitation; then anyone.
13. **Refunds:** the seller gives them, as BitUnlock records now; a
    refunded receipt stops at the next check. No refund screen in the
    game yet.
14. **A receipt beside a held item:** the ordinary way, and a person may
    turn it off, and is then not seen holding it.
15. **BitUnlock's fee:** unchanged.
16. **Law:** the owner asks a lawyer about shares between several parties
    and about the client's share, before either is built. Everything else
    goes ahead.

**Order of work**

17. Tips. Then receipts, `buy` and `have`, against BitUnlock's sandbox
    with pretend sats. Then a paid world. Then paid items. Then shares and
    ecash. (Found since: BitUnlock has no sandbox anyone can reach, only
    one that can be run; and a proper tip needs one new request from
    BitLogin. Section 11.7.)
18. **The first thing sold for real:** one of BitPortal's own items, at a
    low price. The owner is then seller, maker and client at once, so
    nothing waits on shares or on anyone else. (Found since: because the
    owner also runs BitUnlock, that sale can be one invoice with no fee
    part at all, by a setting BitUnlock already has for its own
    operator's things.)

**Keeping worlds inside**

19. **The limit on a bare payment:** 1,000 sats by default, one limit for
    everything, the visitor's to raise.
20. **A "bought it" mark on ratings:** later.
21. **Other issuers:** a visitor may add one for themselves; a world may
    not name its own; BitPortal's own list is short and the owner's.
22. **What a seller gives up in all:** aimed under a tenth of the price.
23. **What BitPortal puts forward:** worlds that sell with receipts first;
    the others not left out.
24. **A bare payment opens nothing:** the kit treats nothing as paid
    without a receipt.

**Decided after the first twenty-four**

25. **A seller signs in to BitUnlock's panel through BitLogin** (section
    11.6, A), with a plain warning the first time it is allowed. The
    owner, asked which was the best experience and told it was this one:
    "We can show a warning if needed for extra awareness." It needs one
    narrow new permission in BitLogin, which is not built.

26. **BitPortal's page that keeps the screen may frame BitUnlock's panel,**
    by name, as it frames BitLogin's. The owner, on the points left open
    about that panel: "Ok go with your rec for the best user experience."
    It frames that one page of BitUnlock's and nothing else of it.
27. **Being paid from inside the game is by lightning address.** A wallet
    connection, which is a secret that can spend, is connected only at
    BitUnlock's own address. The best experience of all, later: paid
    straight into the wallet BitLogin already holds, with nothing to type
    (section 9).

## 14. Still open

Not decided by the above, and each needed before the part it belongs to:

- **The lawyer's answer** (question 16). Shares and the client's share
  wait for it.
- **The rate BitPortal suggests** for the client's share, and whether the
  aim of "under a tenth" is a rule or a hope.
- **Which mints,** by name.
- **How the person tipped is told.** The note that travels with a
  Lightning payment is the plainest way and depends on their wallet
  showing it. A private Nostr message is the other, and would be sent by
  the tipper's own key.
- **Whether a renewal runs on** from the old receipt's end or from the day
  it was bought: BitUnlock's to confirm.
- **The names** of the new tags and requests, which BitUnlock's, BitLogin's
  and NSWP's sessions settle between them.
- **Whose things are first** when "a few world makers by invitation"
  begins, and what they are told.
- **What a world's taste is allowed to be:** a separate room, a time
  limit, or anything the world likes.
- **Cheap things.** A least price (500 sats would keep BitUnlock's fee
  at 2%), or a lower floor on the fee, or accept that the cheapest things
  give up more than a tenth.
- **Who runs the sandbox,** and where.
- **Where a listing is made:** BitUnlock's seller pages for now, or
  something in BitPortal, which would need BitLogin to let it sign one.
- **How much of a receipt a room is shown.** All of it (it can't be cut
  down), or a smaller thing BitUnlock signs for showing.
- **The exact shape of the new permission** in BitLogin that lets a named
  application have requests to its own service signed (decided in
  principle: section 13, 25). Which applications are named, how the
  service's address is tied to the application's, and the words of the
  warning, are BitLogin's session's to propose.
- **Whether the owner takes section 10.6 as the plan:** it was asked for
  and written down, and not yet said yes to. If so: which of BitPortal's
  own things are sold first, and what world makers would be charged for,
  and how much.
