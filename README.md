# Hold to Pause

A Chrome extension that makes you stop and think before opening time-sink websites. Instead of blocking you outright, it adds friction at the moment of impulse: a full-screen countdown that **only ticks while you hold the left mouse button**. Optionally, you **commit to a break** for each session and **take that break** afterward, a small in-the-moment decision instead of a rigid schedule. You can also open each session with a brief **reflection** (naming your thoughts, where you feel them in your body, and your mood), which collects over time into a private **star map** drawn on a real night sky.

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
[ Reflection ]      optional: name your thoughts, body, and mood; skip with "Continue"
        ↓
[ Hold to pause ]   hold the left mouse button to count down
        ↓
[ Commit a break ]  "Once I finish this session, I will take a break for X min"
        ↓
   Allowance        3 to 25 min of free access, SHARED across the whole group
        ↓           (a small wand icon floats top-left; tap it to reflect mid-session)
[ Break ]           runs for the committed X minutes; pick up to 3 activities
        ↓
  Next visit returns to the Reflection, then the rest of the flow
```

With **Force a break** off: `blocked site → Hold to pause → Allowance → (no break) → repeat`. (No reflection or break commitment when breaks are off.)

The pause only fires when the group's **schedule** is active (day-of-week plus an optional time window).

> Note: the hold-to-pause comes **before** the break commitment. You do the friction first, then decide your break.

## Groups share one session

Sites are organized into **groups**, and a group is treated as a single session:

- Unlock **any** site in a group, and the **whole group** opens for the allowance.
- When the allowance (and break) end, **every open tab in the group re-blocks together**.

So if `youtube.com` and `reddit.com` are in one group, completing the pause once frees both, and the limit ends for both at the same time.

## A moment of magic (reflection)

When **Force a break** is on, each session opens with an optional, unhurried reflection screen. It is a gentle way to name what is happening before you dive in (*affect labeling*, an evidence-based way to take some heat out of an impulse). It is always skippable with **Continue**.

- **The wand.** Your cursor becomes a magic wand with a soft twinkle and a **trailing-ribbon** glow that flows behind your movement.
- **Open a star.** Give the wand a little **shake** to summon a star in the middle of the screen, then click it to open the reflection panel.
- **Three prompts:**
  - **Thoughts.** Type and press Enter to add as many as you like. Drag a chip's **⠿ grip** to reorder them; the first one becomes the star's headline.
  - **Body.** Tap the **rabbit** where you feel something. Dots appear while you hover the figure and light up with their label as the cursor nears (ears = *listen*, eye/nose/mouth = *see / smell / taste*, plus neck, shoulder, chest & heart, arm, hand for *touch*, belly / gut, lower back, spine, leg, feet). Tag up to **3**, jot a word for each, and drag to reorder.
  - **Mood.** Pick from the **mood map**, a valence by arousal *circumplex* with four colour-coded quadrants. The axes are icons: sun (high arousal), moon (low arousal), lily (pleasant), cactus (unpleasant). Choose **up to 3** feelings, or tap an empty spot in a quadrant to add your own. They are ranked automatically: by quadrant (positive-high, negative-high, positive-low, negative-low), then A to Z within a quadrant.
- **One star per reflection.** Everything you note in a single session logs into **one star**. Hovering it shows your **first thought**; if there are no thoughts, it shows your chosen moods joined by a dot; if no moods, your body feelings.

### Your sky of reflections

The backdrop is a **real planetarium**, built from open Hipparcos-derived star data bundled offline:

- **Drag to pan** across the dome, **scroll to zoom**. Real **constellation lines**, **constellation and bright-star names** (names fade in as you zoom), and a soft **Milky Way** band.
- Each reflection is pinned to an actual **catalogue star** (stable, by the entry's id). **More recent reflections glow brighter.** Hover one to read your note plus the **real star's name**.
- Toggle the window between the last **1 month** and **6 months**.
- All reflections are equal: no scores, no streaks, no judgement.

### Reduced motion (e-ink friendly)

A toggle in **Settings → Magic stars → Display** turns off the moving trail, the sparkles, and the twinkle (the wand still follows your cursor, and the sky still pans). It is meant for e-ink and low-power screens that leave faint marks, and it also turns on automatically if your operating system's "reduce motion" setting is enabled.

### Mid-session

While a group's allowance is active, a small **wand icon** floats at the top-left of the page. Click it (or **shake** the cursor to summon a star) to open a compact reflection panel and jot something without leaving the site.

Reflections are stored only on your device; review or delete them under **Settings → Magic stars**.

## The commitment screen

Shown right after the hold-to-countdown **when Force a break is on**:

> *"Once I finish this **[N]** min session, I will take a break for **[X]** minutes."*

- **Session length (N)** is your free-browsing time. It is typed only, defaults to the Settings allowance, range **3 to 25**. Editing it sets the allowance for this session.
- **Break length (X)** snaps to discrete levels **1, 3, 5, 10, 15, 20, 25, 30**. It **always opens at 30** (the max) and never remembers your last value, so doing nothing commits you to the longest break and nudges a deliberate choice. Set it by:
  - **Drag** the bar (snaps to the nearest level).
  - **Scroll**: a slow scroll steps level by level proportional to distance; a fast flick sweeps to the end.
  - **Type** a number (any 1 to 30) or use the **arrow keys** for off-level precision.

**Continue** unlocks the site for the allowance. The break afterward runs for exactly the minutes you committed, and the break screen echoes *"You chose an X-minute break."*

## Break activities

Make your break intentional instead of idle:

- **Predefine activities** in Settings, each with a name and an area/tag (for example `🧠body`, `👁eye`). Add, inline-edit, delete, and drag to reorder. A sensible starter set is seeded on first run.
- **During a break**, pick **up to 3** (or add a new one on the spot, which saves to your list).
- **Break stats**: Favourites, Least chosen, and a "By area" chart, all derived from your history.
- **All breaks**: a foldable history log; edit (add or remove activities) or delete any entry. Counts and stats recompute automatically.

## Two ways to add blocked sites

### Toolbar popup
Click the extension's icon for a quick popup:

- Shows the current tab's URL and a group dropdown (remembers your last choice).
- **Block this domain** adds the hostname (for example `youtube.com`), covering all paths.
- **Block this section** pre-fills the first two path segments (for example `youtube.com/shorts`); editable before you add.
- The settings icon (top-right) opens the full settings page. Buttons show a check when the rule already exists.

### Settings page
Add domains directly to a group's text area, one per line.

## Site rule syntax

Two forms, both matching subdomains automatically:

| Rule | Matches |
|---|---|
| `youtube.com` | `youtube.com`, `m.youtube.com`, `www.youtube.com`, and **every path** |
| `reddit.com/r/funny` | `reddit.com/r/funny`, `reddit.com/r/funny/comments/...`, `old.reddit.com/r/funny/...` |

Path matching is boundary-safe: `reddit.com/r/fun` will **not** accidentally match `reddit.com/r/funny`.

## Settings

All settings live in the options page (popup settings icon, or `chrome://extensions` then Hold to Pause, Details, Extension options). They are organized into three tabs in a left sidebar (**Pause**, **Break**, **Magic stars**), and it remembers the tab you were on.

**Pause**
- **Groups.** A **horizontal segmented control**: each group is a tab and one editor shows at a time, so the page stays short however many groups you have. The "+" tab adds a group. Each group has a name, sites (one per line; domains and `domain/path` rules), **pause seconds**, a **schedule** (Mon to Sun toggles plus an optional start/end window that can wrap midnight), and a trash icon to delete.
- **Countdown behavior.** *Reset timer on release* (pause where it is, or snap back to full).
- **Pause page background.** Black, white, or a custom hex colour (text colour flips by luminance). The reflection screen itself stays a night sky regardless.

**Break**
- **Break stats**, **Break activities**, **After completing a pause** (the **allowance** of 3 to 25 min, which is the default session length, plus the **Force a break** toggle and a custom **break-screen message**), and a foldable **All breaks** history at the bottom.

**Magic stars** (reflections)
- A short intro explaining the why.
- **Display**: the star-map window (**1 month** or **6 months**) and the **Reduced motion** toggle.
- **Feelings (mood map)**: the feelings offered on the circumplex, editable per quadrant, with the sun/moon/lily/cactus axis icons.
- **All reflections**: every reflection (thoughts, body, mood), reviewable and deletable.

Row actions (edit, delete, save, cancel, add) are icons. Break activities and reflections save on their own; the **Save** button covers groups, pause, background, and break settings.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `background.js` | Service worker: intercepts navigation, routes reflect/pause/commit/break, per-group allowance, break, and schedule logic |
| `reflect.html` / `reflect.css` / `reflect.js` | Reflection screen: wand cursor and trailing-ribbon trail, shake-to-summon star, thoughts / body (rabbit map) / mood (circumplex), and the planetarium star map |
| `skymap.js` | The planetarium renderer: stereographic projection, pan and zoom, constellations, Milky Way, and reflections pinned to real stars |
| `data/sky-*.json` | Bundled star data (stars, constellation lines, labels, star names, Milky Way), from open Hipparcos / d3-celestial datasets |
| `pause.html` / `pause.css` / `pause.js` | Hold-to-countdown page |
| `commit.html` / `commit.css` / `commit.js` | Break-length commitment screen |
| `break.html` / `break.css` / `break.js` | Break page: corner timer, echo, activity picker |
| `reflect-content.js` | Content script: floating wand icon and compact reflection panel on blocked sites while an allowance is active |
| `popup.html` / `popup.css` / `popup.js` | Toolbar popup for quick block-from-current-tab |
| `options.html` / `options.css` / `options.js` | Settings UI (Pause / Break / Magic stars tabs) |
| `breaks-common.js` | Shared helpers for break activities, stats, history, tag colours |
| `reflections-common.js` | Shared helpers for reflections: log storage, the feelings/circumplex data, and star helpers |
| `images/` | Wand (`wand.png`, `wand-120.png`), the body-map rabbit (`body.png`), star images (`stars-001..021`), the mood-axis icons (`sun`, `moon`, `lily`, `cactus`), and UI icons (`edit`, `delete`, `save`, `cancel`, `settings`, `add`) |
| `fonts/Baloo2.woff2`, `fonts/Figtree.woff2` | Bundled display and body fonts (SIL OFL) |
| `icons/icon-{16,32,48,128}.png` | Toolbar, extensions-page, and install-dialog icons |

## Notes and limitations

- Settings, break activities, and the reflection **feelings** palette sync across signed-in Chrome installs (`chrome.storage.sync`).
- Allowance and break state, break history, **reflections**, and the last-used group are device-local (`chrome.storage.local`). Reflections never leave your machine.
- The wand cursor, trail, and star map appear only on the extension's own reflection screen. On live sites only a small wand icon and panel are injected (`reflect-content.js`); there is no cursor hijack on real pages.
- Allowance and break state is keyed **per group**, not per domain.
- Closing or reloading the break-page tab does **not** end the break early; state is tracked per group.
- Site matching is hostname plus an optional path prefix. No regex or wildcard support yet.

## Data and assets

- Star data is derived from the **Hipparcos** catalogue via the open **d3-celestial** datasets (MIT / public domain), filtered and bundled under `data/` so the extension runs fully offline.
- Fonts are **Baloo 2** and **Figtree** under the SIL Open Font License.
- UI and mood icons are from **Icons8**.
