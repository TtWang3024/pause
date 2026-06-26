# Hold to Pause

A Chrome extension that makes you stop and think before opening time-sink websites. Instead of blocking you outright, it adds friction at the moment of impulse: a full-screen countdown that **only ticks while you hold the left mouse button**. Optionally, you **pre-commit to a break** before each session and **take that break** afterward — a small, in-the-moment decision instead of a rigid schedule. You can also open each session with a brief **reflection** — naming your thoughts, where you feel them in your body, and your mood — which collects over time into a private **star map**.

## Install (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked** and select this `pause-extension` folder
4. The settings page opens automatically on first install

## How it works

With **Force a break** on (the full experience):

```
Visit a blocked site
        ↓
[ Reflection ]      ← optional: a calm screen to name your thoughts, body & mood
        ↓               skip with "Continue →"; your notes become a star map
[ Commit screen ]   ← "Once I finish this session, I will take a break for X min"
        ↓               set X by drag / scroll / type — opens at 30 each time
[ Pause page ]      ← hold left-click to count down
        ↓
   Allowance        ← 3–25 min of free access, SHARED across the whole group
        ↓               a small wand icon floats top-left — tap to reflect mid-session
[ Break page ]      ← runs for the committed X minutes; pick up to 3 activities
        ↓
  Next visit → back to the Reflection + Commit screens
```

With **Force a break** off: `blocked site → Pause page → Allowance → (no break) → Pause again`.

The pause only fires when the group's **schedule** is active (day-of-week + optional time window).

## Groups share one session

Sites are organized into **groups**, and a group is treated as a single session:

- Unlock **any** site in a group → the **whole group** opens for the allowance.
- When the allowance (and break) end → **every open tab in the group re-blocks together**.

So if `youtube.com` and `reddit.com` are in one group, completing the pause once frees both, and the limit ends for both at the same time.

## A moment of magic (reflection)

When **Force a break** is on, each session opens with an optional, unhurried reflection screen — a gentle way to name what's happening before you dive in (*affect labeling*, an evidence-based way to take some heat out of an impulse). It's always skippable with **Continue →**.

- **The wand.** Your cursor becomes a magic wand with a soft twinkle and a **trailing-ribbon** glow that flows behind your movement.
- **Open a star.** Give the wand a little **shake** to summon a star in the middle of the screen, then click it to open the reflection panel.
- **Three prompts:**
  - **Thoughts** — type and press Enter to add as many as you like.
  - **Body** — tap the **rabbit** where you feel something. Dots appear only while you hover the figure and light up with their label as the cursor nears — ears = *listen*, eye/nose/mouth = *see / smell / taste*, plus neck, shoulder, chest & heart, arm, hand (*touch*), belly / gut, lower back, spine, leg, feet. Tag up to **3**, and jot a word for each.
  - **Mood** — pick from the **mood map**, a valence × arousal *circumplex*: four colour-coded quadrants (unpleasant ↔ pleasant × high ↔ low energy). Tap a feeling, or tap an empty spot in a quadrant to add your own.
- **Your sky of reflections.** Every thought, body note, and mood becomes a **star** scattered across the screen. **More recent = bigger and brighter**; hover a star to read it. Toggle the window between the last **1 month** and **6 months**. Past ~500 stars (or ~100 on a small screen) they simplify to plain dots, like a real night sky. All stars are equal — no labels, no scores, no judgement.
- **Mid-session.** While a group's allowance is active, a small **wand icon** floats at the top-left of the page; click it (or **shake** the cursor to summon a star) to open a compact reflection panel and jot something without leaving the site.

Reflections are stored only on your device; review or delete them under **Settings → Magic stars**.

## The commitment screen

Shown before the hold-to-countdown **when Force a break is on**:

> *"Once I finish this **[N]** min session, I will take a break for **[X]** minutes."*

- **Session length (N)** — your free-browsing time. **Type-only**, defaults to the Settings allowance, range **3–25**. Editing it sets the allowance for this session.
- **Break length (X)** — the bar snaps to discrete levels **1, 3, 5, 10, 15, 20, 25, 30**. It **always opens at 30** (the max) and never remembers your last value, so doing nothing commits you to the longest break and nudges a deliberate choice. Set it by:
  - **Drag** the bar (snaps to the nearest level).
  - **Scroll** — a slow scroll steps level-by-level proportional to distance; a fast flick sweeps to the end.
  - **Type** a number (any 1–30) or use **↑ / ↓** arrow keys for off-level precision.

**Continue →** advances to the hold-to-countdown. The break afterward runs for exactly the minutes you committed, and the break screen echoes *"You chose an X-minute break."*

## Break activities

Make your break intentional instead of idle:

- **Predefine activities** in Settings — each has a name and an area/tag (e.g. `🧠body`, `👁eye`). Add, inline-edit, delete, and drag to reorder. A sensible starter set is seeded on first run.
- **During a break**, pick **up to 3** (or add a new one on the spot with **+**, which saves to your list).
- **Break stats** — Favourites, Least chosen, and a "By area" pie chart, all derived from your history.
- **All breaks** — a history log; edit (add/remove activities) or delete any entry. Counts and stats recompute automatically.

## Two ways to add blocked sites

### Toolbar popup
Click the extension's icon for a quick popup:

- Shows the current tab's URL and a group dropdown (remembers your last choice).
- **Block this domain** — adds the hostname (e.g. `youtube.com`), covers all paths.
- **Block this section** — pre-fills the first two path segments (e.g. `youtube.com/shorts`); editable before you add.
- Cog (top-right) → full settings page. Buttons show ✓ when the rule already exists.

### Settings page
Add domains directly to a group's text area, one per line.

## Site rule syntax

Two forms — both match subdomains automatically:

| Rule | Matches |
|---|---|
| `youtube.com` | `youtube.com`, `m.youtube.com`, `www.youtube.com`, and **every path** |
| `reddit.com/r/funny` | `reddit.com/r/funny`, `reddit.com/r/funny/comments/...`, `old.reddit.com/r/funny/...` |

Path matching is boundary-safe: `reddit.com/r/fun` will **not** accidentally match `reddit.com/r/funny`.

## Settings

All settings live in the options page (popup cog, or `chrome://extensions` → Hold to Pause → Details → Extension options), organized into three tabs in a left sidebar — **Pause**, **Break**, and **Magic stars** (it remembers the tab you were on).

**Pause**
- **Groups** — name, sites (one per line; domains and `domain/path` rules), **pause seconds**, and a **schedule** (Mon–Sun toggles + optional start/end time window; window can wrap midnight).
- **Countdown behavior** — *Reset timer on release* (pause where it is, or snap back to full).
- **Pause page background** — black, white, or a custom hex color (text color flips by luminance).

**Break**
- **Break stats** — Favourites, Least chosen, and a "By area" chart, derived from your history.
- **All breaks** — the history log (edit or delete entries).
- **Break activities** — predefine, inline-edit, delete, and reorder the things you might do on a break.
- **After completing a pause** — the **allowance** (3–25 min; the *default* session length, editable each time on the commitment screen), and the **Force a break** toggle with a custom **break-screen message**. (Break *length* isn't here — it's chosen on the commitment screen each session.)

**Magic stars** (reflections)
- **Star-map window** — show the last **1 month** or **6 months**.
- **Feelings (mood map)** — the feelings offered on the circumplex, editable per quadrant (add or remove your own).
- **History** — every reflection (thoughts, body, mood), reviewable and deletable.

Break activities and reflections save on their own; the **Save** button covers groups, pause, background, and break settings.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `background.js` | Service worker — intercepts navigation, routes to commit/pause/break, per-group allowance/break/schedule logic |
| `commit.html` / `commit.css` / `commit.js` | Pre-break commitment screen (the break-length setter) |
| `pause.html` / `pause.css` / `pause.js` | Hold-to-countdown page |
| `break.html` / `break.css` / `break.js` | Break page — corner timer, echo, activity picker |
| `reflect.html` / `reflect.css` / `reflect.js` | Reflection screen — wand cursor + trailing-ribbon trail, shake-to-summon star, thoughts / body (rabbit map) / mood (circumplex), and the star-map history |
| `reflect-content.js` | Content script — floating wand icon + compact reflection panel on blocked sites while an allowance is active; shake-to-summon |
| `popup.html` / `popup.css` / `popup.js` | Toolbar popup for quick block-from-current-tab |
| `options.html` / `options.css` / `options.js` | Settings UI (Pause / Break / Magic stars tabs) |
| `breaks-common.js` | Shared helpers for break activities, stats, history, tag colors |
| `reflections-common.js` | Shared helpers for reflections — log storage, the feelings/circumplex data, and deterministic star-layout math |
| `images/wand.png`, `images/body.png`, `images/stars-0NN.png` | Wand cursor, the body-map rabbit, and the star images (21) |
| `fonts/Baloo2.woff2`, `fonts/Figtree.woff2` | Bundled display + body fonts (SIL OFL) |
| `icons/icon-{16,32,48,128}.png` | Toolbar / extensions-page / install-dialog icons |

## Notes & limitations

- Settings, break activities, and the reflection **feelings** palette sync across signed-in Chrome installs (`chrome.storage.sync`).
- Allowance/break state, break history, **reflections**, and last-used group are device-local (`chrome.storage.local`) — reflections never leave your machine.
- The wand cursor, trail, and star map appear only on the extension's own reflection screen. On live sites only a small wand icon + panel are injected (`reflect-content.js`); there's no cursor hijack on real pages.
- Allowance/break state is keyed **per group**, not per domain.
- Closing or reloading the break-page tab does **not** end the break early — state is tracked per group.
- Site matching is hostname + optional path-prefix. No regex or wildcard support yet.
- Fonts are bundled (Baloo 2, Figtree) under SIL OFL — no network access needed at runtime.
