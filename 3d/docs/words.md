# Words — how the game's interface talks

The owner (2026-11-22): a lot of the menu text "sounds like AI slop — too short and to the point, or a lot of word
salad… too much going on." This page is the fix. **Write every new menu, button, hint, card and toast this way.**
Write it for a ten-year-old and their parent, as if one friendly person wrote the whole game.

## What this covers, and what it doesn't

- **Interface** (follow this page): menus, buttons and their sub-lines, settings, the 📱 phone's apps (headings, empty
  states, buttons), ✋ prompts, hints and coach lines, cards you buy or decide on, results boards, system toasts.
- **Voice** (leave it alone): anything a character *says* (Lulu, Ima, Bubbe, Dina, shopkeepers, cops, the judge, DJs,
  townspeople, households), signs, storefronts and billboards, radio ads and call-ins, group-chat gossip, charge names,
  badge names, song titles, jokes. The owner likes these. Fix only real typos there.
- Not sure which one a line is? Leave it.

## The rules

1. **One idea per line.** A short whole sentence beats fragments glued with " · " or " — ".
   ✗ `you head out · send the link · they pop up right next to you` → ✓ `Send a link. They'll show up next to you.`
2. **No icon chains.** ✗ `📍 Nearby › a driver › ➕` → ✓ `Tap a driver in Nearby to add them.`
3. **Everyday words.** Don't use words the player never picked: *ghost, rider name, EVERYONE, Free Roam party, hub,
   lobby, opt in, session, cosmetic, toggle*. Say what they see: "other players", "your name", "friends".
4. **One name per thing, everywhere** (see the list below).
5. **Buttons start with a verb and say what happens:** "Play with a friend", "Join with a code", "Buy for 150 coins".
   Add a sub-line only if it answers a question the button leaves open. Most buttons don't need one.
6. **Not too clipped either.** "Seat's taken." is fine. "Asp." is not. If a label only makes sense once you know the
   game, add the two words that make it clear.
7. **Emoji: at most one per line, at the start,** and only where it helps you find the thing. Never use one in place of
   a word or as punctuation.
8. **Sentence case and normal punctuation.** ALL CAPS only where the game shouts on purpose: BUSTED, WRECKED!, MAZEL TOV,
   ▶ PLAY.
9. **Numbers one way:** "150 coins" in a sentence; "150 💰" only on a price tag. "On" / "Off" for settings.
10. **Fewer words on screen.** If three lines explain one button, cut to one line or none. Never add a pop-up to explain.
11. **Plain, not flat.** The game is warm and silly, and its menus can smile too. Keep a joke that already reads well.
12. **Read it aloud like a ten-year-old would.** If it sounds like a manual or a telegram, rewrite it.

## One name per thing

| Say | Not |
|---|---|
| **Friends** (the 👯 screen and the phone app) | party, crew, group, lobby, hub |
| **Play with a friend** (inviting) | host, Free Roam party, invite session |
| **other players** / **other drivers** (strangers online) | ghosts, riders, EVERYONE |
| **Play online** (the setting) | online mode, shared road |
| **your name** | rider name, handle |
| **Phone** (📱) · **Map** · **Messages** · **Nearby** · **Jobs** · **Radio** · **Camera** | the 📱, apps menu |
| **PLAY** (the big title button) | Cruise, Free Roam (to the player) |
| **coins** · **hearts** · **stars** | 💰 alone in a sentence |
| **Garage** · **Scrapbook** · **More** (the title's drawers) | |
| **Settings** | options, config |
| **I'm stuck** (the rescue) | unstuck |

## Checklist before you push text

- Grep the tests for the old words; many tests match visible text with regexes. Update them in the same commit.
- Never change an id, a class, a data-attribute, a save field or an event while you're rewording.
- If the new line is longer, check it on a phone in portrait (`hudfit`, `ux`).
