# Kingsmen Academy — Reaction Labs

A browser-based reaction and processing-speed trainer, built for competitive FPS players
(designed around Rainbow Six Siege). 24 instrumented drills across four training categories,
with a rank system, per-day streak tracking, and a weekly rotating challenge.

No build step, no dependencies, no backend. Open `index.html` and it runs.

## Running it

Open `index.html` in any modern browser — double-clicking works, since everything loads as
classic scripts and a plain stylesheet (no ES modules, so no `file://` CORS problems).

If you'd rather serve it:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Layout

```
index.html                   markup for every view and all 24 drills
css/styles.css               all styling, including the shared game-shell classes
js/
  core/shared.js             storage, rank ladders, staircase, the game registry
  core/supabase-config.js    Supabase project URL + anon key (safe to commit — see below)
  core/cloud.js               auth + sync layer; the only file that talks to Supabase
  games/*.js                  one self-contained module per drill
  app.js                       navigation, the rank dashboard, backup/restore
assets/                       crest and banner artwork
supabase/schema.sql           tables + RLS policies — run once in the Supabase SQL editor
```

Scripts load in order at the end of `<body>`: the Supabase client, then `core/shared.js`
(defines the `window.KA_*` helpers everything else uses), then `supabase-config.js` and
`cloud.js` (patch two of those helpers to also sync — see below), then the drills, then
`app.js` last — it wires navigation and needs the drills' enter-hooks to already exist.

## Architecture

**Every drill is a self-contained IIFE.** It owns its own DOM, timers and state, and exposes
exactly one thing to the outside world: `window.<id>EnterHook()`, which resets it to its
start panel and clears any in-flight timers. Navigation calls that hook both on entry *and*
on exit — without the exit call, leaving mid-run would hide the view while its timers kept
firing in the background.

**`js/core/shared.js`** holds everything cross-cutting:

| Helper | Purpose |
| --- | --- |
| `KA_records` | localStorage wrapper for all-time bests |
| `KA_history` | recent-activity feed, capped at 60 entries |
| `KA_streak` / `KA_dailyRuns` | consecutive-day training streak, per-day run counts |
| `KA_GAMES` | single source of truth: every drill's id, category, record keys, speed baseline |
| `KA_RANKS` / `KA_ACC_RANKS` / `KA_ROUNDS_RANKS` / `KA_FLASH_RANKS` | the four rank ladders |
| `KA_makeStaircase` | adaptive-difficulty staircase (see below) |
| `KA_applyGrace` | the shared input-latency compensation |

Adding a drill means: markup in `index.html`, a module in `js/games/`, a `KA_GAMES` entry, a
menu tile, and an entry in the `MODULES` array in `app.js`.

## Measurement

Reaction timing is the part most worth understanding, because getting it wrong silently
inflates every score:

- **Responses are captured on `pointerdown`, not `click`.** The browser only dispatches
  `click` on mouse *release*, which folds the player's entire button-hold (30–100ms) into
  their reaction time.
- **Stimulus onset is timestamped after a double `requestAnimationFrame`.** The first
  callback runs just before the browser paints the change; the second only fires once that
  paint has actually been presented. Timestamping on the second is the closest a web page
  can get to "when did the photons leave".
- **A 16ms grace is subtracted** from every measured response (`KA_INPUT_GRACE_MS`) to cover
  monitor input lag and mouse polling — latency outside the player's control.

Stimuli deliberately have no CSS transitions, so they pop in on a single frame rather than
fading.

## Ranking

Nine tiers, Copper through Legend, calibrated so **Silver sits on the realistic population
average** for each measure.

Drills that record both a completion percentage and a response time are ranked on **both**,
with the overall tier being the midpoint — so neither fast-and-sloppy nor slow-and-perfect
alone reaches the top. Because a single ms ladder would be unfair across drills of differing
difficulty, each carries its own `speedMid` baseline (the realistic average for that task,
which lands on Silver) and the speed tiers are multipliers of it.

> **These thresholds are estimates and want real calibration data.** They were set from
> reasoning about task difficulty, not measured player distributions.

## Adaptive mode

Choice Reaction, Size Compare and Callout Recall each have an **Adaptive** mode built on a
1-up/2-down staircase: two correct answers make the drill harder, one miss makes it easier.
That ratio converges on the difficulty where you're right about 71% of the time — your actual
edge. The reported threshold is the mean of the last six *reversals*, discarding the noisy
early hunting.

Adaptive runs report a threshold and are deliberately kept **out** of the rank system: since
difficulty varied per player, accuracy is no longer comparable between people. Ranked runs
stay fixed-difficulty so they remain a fair benchmark.

## Data

Everything is written to `localStorage` under `ka_`-prefixed keys first — the app always
works fully offline, with or without an account. Stats → Backup & Restore exports and
re-imports that data as JSON.

Signing in additionally syncs it to Supabase and unlocks the Global leaderboard tab (see
below). Signed out, Leaderboards only ever ranks you against your own bests.

## Cloud sync (Supabase)

Sign-in is magic-link (email only, no passwords). Signing in:

- pulls your cloud bests down and merges them with what's in this browser — whichever value
  is actually better wins, so playing offline between syncs never loses progress
- pushes every new personal best up automatically from then on, through the exact same
  `KA_records.set(...)` / `KA_history.add(...)` calls every game already makes — no game file
  knows the network exists; `js/core/cloud.js` is the only thing that does
- unlocks Leaderboards → **Global**, ranking you against everyone else who's signed in, per
  drill

**Nothing about ranking changes.** The cloud `records` table mirrors the local
`ka_record_<key>` keyspace exactly — same flat key, same raw number (an accuracy %, a
reaction time in ms). Rank tiers are still computed client-side from that raw number every
time a badge renders, so recalibrating the ladders later needs no data migration, cloud or
local — see [Ranking](#ranking) above.

### First-time setup (once per Supabase project)

1. **Run the schema.** Supabase dashboard → SQL Editor → New query → paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql) → Run. Creates `profiles`, `records`, `runs`,
   their Row Level Security policies, and a trigger that creates a profile automatically on
   sign-up. Safe to re-run.
2. **Allow-list redirect URLs.** Supabase dashboard → Authentication → URL Configuration →
   add every URL you'll actually open the app from (e.g. `http://localhost:8000` for local
   testing, plus your GitHub Pages URL if you set one up). The magic link is rejected if the
   page it's opened from isn't on this list.
3. **Serve over http(s), not `file://`.** Magic-link sign-in redirects back to the exact URL
   the app was opened from; mail clients won't follow a `file://` link, and it isn't on the
   allow-list anyway. Use `python -m http.server` locally, or GitHub Pages, when testing
   sign-in — double-clicking `index.html` is fine for everything else.

`js/core/supabase-config.js` holds the project URL and anon key. The anon key is meant to be
public and is safe to commit — it can only do what the RLS policies in `schema.sql` allow.
The `service_role` key (which bypasses RLS) must never go in this file or anywhere
client-side; this app never needs it.

### Scope of the sync

- Global leaderboard covers the 21 drills with a single flat record key (open Leaderboards →
  Global to see the list) plus Base Reflex's baseline. Drills with multiple metrics (Flanker,
  Flash Reflex, Colour Flick) aren't on it yet — would need a pick-a-metric step.
- The activity feed (`runs` table) is written on every run but only ever read back for your
  own Stats page — it isn't pulled/merged across devices yet, unlike `records`.
- Any signed-in user's records and profile are readable by any other signed-in user (RLS
  requires `auth.role() = 'authenticated'`, nothing more granular) — right for a small trusted
  group, worth tightening before this goes properly public.

## Known gaps

- Rank thresholds and `speedMid` baselines need calibrating against real players.
- Adaptive mode covers 3 of 24 drills; the rest are fixed-difficulty.
- No aim/tracking training — every drill is click-to-respond.
- Audio Reflex can't use the paint-confirmation timing (Web Audio has its own scheduling
  latency), so its numbers aren't directly comparable to the visual drills.
- Colour Flick is shelved: its module and styles are still in the tree, commented out of the
  menu and `KA_GAMES`.
- Global leaderboard doesn't cover multi-metric drills yet, and activity history doesn't sync
  across devices — see "Scope of the sync" above.
