# 🏪 Player-owned shops — the plan (ci/playershops, 2026-11-27 · NOT BUILT YET, waiting for the owner's go)

## Part 1 — how homes work today (ten lines)
1. **Finding one:** FOR SALE signs on real lawns in Lakewood + Midwood (about 7 a town on any day, new ones every few days), the realtor's office in each town, or 📱 Contacts › The realtor.
2. **Viewing:** walk up to the sign or ask the realtor; she shows you round inside. Free.
3. **The price:** 7,000 (rowhouse) to 16,000 (detached house), a bit more or less by street; it drifts ±3.5 % over a few weeks. Selling costs a 10 % fee, so flipping always loses.
4. **Cash or mortgage:** cash = two presses, done. Mortgage at the bank's desk: 20 / 35 / 50 % down, paid off over 10 / 20 / 30 *played* days (the bank's flat fee 5–15 %), a small payment taken each day she plays.
5. **Missing payments:** 1 missed day → a stern letter, 2 → "we should talk", 3 → a friendly foreclosure: she gets back the larger of (sale price − the bank's loan) or half of everything she paid in. Paying early skips half the remaining fee.
6. **The limit is 10 homes.** **Starter homes:** the 3 cheapest in each town are always for sale, and her FIRST home needs only 10 % down over 30–45 days, so a home is reachable on day 1–2 (a day of play earns ~500–650).
7. **Tenants:** the realtor finds one; rent is 1 % of the value per played day, all homes together at most 150 a day, collected from the mailbox. She can't move in while it's rented.
8. **Property tax** (City Hall): 0.2 % of the price per played day, at most 50 a day for all homes. Unpaid for 3 days → a letter; 6 → a lien (+10) she can fight in Courtroom 2B. Tax never takes a home.
9. **One world-wide market:** each home has one owner for everyone online; others see her username on it (or "a neighbour" if they've turned names off). Not seen for 14 real days → the Abandoned Kugel Ordinance seizes her homes for 7 days (one appeal, 50/50), then they go back on the market.
10. **Living there:** inside, "Start my days here" makes mornings start at her own front door; 🏠 Go there (realtor's contact or 📱 Map) takes her to any of her homes in a moment, free. Friends can visit and see how she decorated.

## Part 2 — player-owned shops (one property game with homes)
**a. Getting a shop.** A player shop is one more *state* of a storefront in the new storefronts framework: "🪧 FOR LEASE" on an empty shopfront. ~10 shopfronts in the two towns today.
- **Lease** from Mr. Gelbfish the landlord: 300 deposit + 60 per *played* day. 3 missed days → he changes the locks (her stock goes into boxes at home, the deposit comes back).
- **Buy the building:** 14,000 in Lakewood, 18,000 in Midwood, cash or the same mortgage desk. Owning comes with the flat upstairs, which counts as a home: live there, or let it to a tenant (inside the same 150 rent cap).
- A **shop permit** at City Hall: the existing three-window errand. Property tax at the same 0.2 % and the same 50 cap (homes + shops together). Inspector Pinchas drops in for a joke, never a fine.
- **The cap:**
  - **Midwood:** Mayor Marxdani's *People's Retail Fairness Edict* allows ONE shop per player. Posters on the street, plus a hearing in Courtroom 2B she can win once (50/50) for a second.
  - **Lakewood:** Mayor Kugelman: "Buy! Shops mean parking fees!" Up to 3.
  - Never more than 4 in all, and shops sit outside the 10-home limit.
- **Licences:** a few per kind per town, picked when she opens, so the street stays varied. Midwood: 🥘 kugel ×2, 🍣 sushi ×1, 🔧 car care ×1, 🎁 gift boxes ×1, 🧰 handy things ×1. Lakewood: about double. Sold out means "the licence office says no".

**b. The new mechanic: stock it, shelve it, sell it.**
- **Stocking it:** the 📦 Wholesale Depot at a rest area, plus JFK cargo for sushi. Goods cost 10–40 a box. What she can carry depends on her car: Ima's minivan 12 boxes, most cars 6, the Mazelati 2. She drives the boxes back to the shop and carries them inside.
- **Making it:** a 30-second baking game for kugel, cholent and cake. 1–3 ⭐ decide how strong the effect is and how high she can price it.
- **Shelving it:** 24 slots, placed by hand, priced inside a band. Food goes stale after 3 real days (spoiled stock is thrown out, no refund).
- **What sells:** things that DO something.
  - Food: a heart back, or a short boost.
  - Usable items from `houseitems`: a pan to BONK, seltzer to SPRITZ.
  - Car care: a free repair, a wash that hides the car from a cop for 10 s.
  - Gift boxes a buyer gives to a friend.
  - One "house special" she names (through the name filter).
  - Never coins, cars or the limited luxury pieces.
- **Reputation:** 👍 from buyers (one per buyer per shop per day) decides the shop's ⭐ on the 📱 Map.
- **Working the counter:** when she's in her shop and a player walks in, a tiny live moment happens: she wraps, the buyer may tip 5–10.
- **The clerk:** while she's away, Mrs. Zissel the clerk sells to *real players only*. Her pay is 10 % of that day's sales, so a day with no buyers costs nothing.

**c. Only real players buy, and coins must not leak.** A visitor walks in, sees the owner's username on the sign and the shelves as she stocked them, and pays from her own wallet.
- **Prices:** the band is 1.2–1.8× the stock's cost.
- **What the owner gets:** 85 % of the price; the town keeps 15 % as sales tax. So every sale is a net sink: the world loses the stock cost plus 15 % of the price. Her profit is at most ~50 % of the stock cost per item.
- **Caps:** an owner earns at most 300 profit a real day across all her shops. A buyer spends at most 150 a day at one owner's shops, buys at most 3 times a day per shop, and can never buy from her own shop.
- **Who can buy:** only accounts with a username that have played 3 or more days. Nothing multiplies with group size.
- **Honestly, about cheaters:** wallets live on the phone, so a hacked client can already give itself coins, and the shop adds nothing to that. The server's job is to keep the SHARED parts honest: who owns which shop, the stock, the till, the reputation and the caps. Worst case, a ring of fake buyer accounts gets one owner 300 a day, the same as a busy honest shop. New-account rules, per-IP limits and server-side reports cap that.

**d. The server (needs the owner's OK, golden rule 3; additive like /homes and /wear).** New `/shops/*` calls on the same Board, three small tables:
- **`shops`:** storefront id, owner's player id, kind, the shop name filtered like usernames (3 reports → reset), since, seized, 👍 count.
- **`shop_stock`:** up to 24 rows per shop: good, quantity, price, ⭐, stale date.
- **`shop_day`:** per-day counters for the till and the caps (owner profit, buyer × owner spend), dropped after 2 days.
- **Purchase:** `POST /shops/buy` is one atomic step (check stock, check the caps, take one, add to the till), rate-limited.
- **Calls:** list (merged into the existing /homes list for the town, so no extra request), view, claim / release, stock, collect, thumb.
- **Ghost shops:** the homes rule. Not seen for 14 days → "🚧 Under renovation" for 7 days (one appeal), then back on the market, stock thrown away, an uncollected till paid out when she returns (capped).
- **Budget** (free plan ≈ 100,000 requests a day, an hour of online driving ≈ 900):
  - A visit is 1 request, a purchase 1, a restock 1, collecting the till 1.
  - 500 purchases a day ≈ 1,500 requests ≈ 1.5 %, less than two player-hours of driving.

**e. How it all fits: one property ladder.** Ima's house → a starter home → a leased shop → owning the building, with the flat upstairs to live in or let.
- One place to see it all: 📱 Contacts › The realtor (homes + shops, 🏠 Go there for both) and the Map's 🔑 list.
- One set of rules for everything she owns: the same bank, the same tax and liens, the same idle rule, the same Go there.

**f. Stages, what I won't build, what could go wrong.**
- **Stages:**
  1. *Client only:* leasing / buying a shopfront, the permit, stocking, the depot, the bake game, the shelves, friends can walk in and look. No sales yet, honestly marked "Opening soon".
  2. *Server (after the owner's OK):* the world-wide registry, buying from another player, the till, the caps, shop names.
  3. The clerk, the live counter, reputation on the Map, ghost shops.
  4. The Midwood hearing for a second licence.
- **Won't build:** NPC customers who pay coins, free-form prices, player-to-player trading or gifting coins, auctions, buying out someone's shop, shops in Dina's mode.
- **Abuse:** caps per owner, buyer and IP, an account-age rule, no self-buying, every sale a sink, names filtered and reportable.
- **Ghost shops:** the 14 + 7 day renovation rule frees the street. A shop with an empty shelf for 3 days shows "back soon" and doesn't count for Map stars.
- **A dead market:** on a quiet week a shop earns NOTHING (only real players buy, and the clerk is paid from sales). That stays true to the owner's rule. Its worth on a quiet day:
  - the flat upstairs (rent, inside the existing cap);
  - her own goods at cost for herself, at most 3 a day (food, the car wash), which is a real use but not income;
  - a place her friends visit.
  - The price of a lease is low enough that this is fine.
