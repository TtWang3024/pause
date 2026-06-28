# Hold to Pause

A Chrome extension that makes you stop and think before opening time-sink websites. Instead of blocking you outright, it adds friction at the moment of impulse. By default each blocked session opens with a brief **reflection** (naming your thoughts, where you feel them in your body, and your mood) while a calm **countdown** runs in the button. Turn that off and it falls back to a full-screen timer that **only ticks while you hold the left mouse button**. Optionally, you **commit to a break** for each session and **take that break** afterward, a small in-the-moment decision instead of a rigid schedule. Reflections gather over time into a private **star map** drawn on a real night sky.

## Install (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked** and select this `pause-extension` folder
4. The settings page opens automatically on first install

## How it works

The flow has two independent switches: **Magic stars** (the reflection screen, on by default) and **Force a break** (the commitment plus break). With both on:

```
Visit a blocked site
        ↓
[ Reflection ]      name your thoughts, body, and mood; a countdown runs in the
        ↓           Continue / Save button (no holding). It pauses when the tab
        ↓           loses focus and resumes where it left off.
[ Commit a break ]  "Once I finish this session, I will take a break for X min"
        ↓
   Allowance        3 to 25 min of free access, SHARED across the whole group
        ↓           (a small wand icon floats top-left; tap it to reflect mid-session)
[ Break ]           runs for X minutes; pick up to 3 activities, then rate the session
        ↓
  Next visit returns to the Reflection, then the rest of the flow
```

- **Magic stars off** replaces the reflection screen with the classic **hold-to-pause** page (a full-screen countdown that only ticks while you hold the left mouse button).
- **Force a break off** skips the commitment screen and the break, going straight to free access.

The gate only fires when the group's **schedule** is active (day-of-week plus an optional time window).

## Groups share one session

Sites are organized into **groups**, and a group is treated as a single session:

- Unlock **any** site in a group, and the **whole group** opens for the allowance.
- When the allowance (and break) end, **every open tab in the group re-blocks together**.

So if `youtube.com` and `reddit.com` are in one group, completing the pause once frees both, and the limit ends for both at the same time.

## A moment of magic (reflection)

When **Magic stars** is on (the default), each blocked session opens with an unhurried reflection screen whose countdown replaces the hold-to-pause. It is a gentle way to name what is happening before you dive in (*affect labeling*, an evidence-based way to take some heat out of an impulse).

- **The countdown.** The **Continue** and **Save** buttons start grey and show the seconds left (monospaced so they do not jitter), counting down the group's pause length with no holding. It pauses when the tab loses focus and resumes where it left off (saved per group). When it reaches zero the buttons unlock.
- **The wand.** Your cursor becomes a magic wand with a soft twinkle and a **trailing-ribbon** glow that flows behind your movement.
- **Open a star.** Give the wand a little **shake** to summon a star in the middle of the screen, then click it to open the reflection panel.
- **Three prompts:**
  - **Thoughts.** Type and press Enter to add as many as you like. Drag a chip's **⠿ grip** to reorder them; the first becomes the star's headline.
  - **Body.** Tap the **rabbit** where you feel something. Dots glow as the cursor nears and show their label only on hover (so logged dots stay lit without crowding the others). The head senses fan out from one dot: see / smell / taste open to the right, a **head area** tag opens to the left. The five senses wear light-pink tags; other parts wear dark ones. Tag up to **3**, and the note box focuses for you so you can type at once; drag to reorder.
  - **Mood.** Pick from the **mood map**, a valence by arousal *circumplex* of four joined, colour-coded quadrants, with large axis icons at the tips of a dark-grey cross (sun = high arousal, moon = low arousal, lily = pleasant, cactus = unpleasant). Each quadrant's pills carry its colour. Choose **up to 3**, or tap an empty spot in a quadrant to add your own. They rank by quadrant (positive-high, negative-high, positive-low, negative-low), then A to Z.
- **One star per reflection.** Everything you note in a single session logs into **one star**. Hovering it shows your first thought; if there are none, your chosen moods joined by a dot; if no moods, your body feelings.
- **Finish with a flourish.** When you Save, the panel shrinks into the star you summoned, the sky carries it to its real catalogue place, and its real name fades in with a line of thanks ("Thank you for pausing. One step closer to your real self.") before you continue.

### Your sky of reflections

The backdrop is a **real planetarium**, built from open Hipparcos-derived star data bundled offline:

- **Drag to pan** across the dome, **scroll to zoom**. Real **constellation lines**, **constellation and bright-star names** (names fade in as you zoom), and a soft **Milky Way** band.
- Reflections light up as a **dense cluster** that grows shell by shell from a centre (near Orion): the oldest takes the nearest star, each newer one the next-nearest free star, so your sky fills outward over time. **More recent reflections glow brighter.** Hover one to read your note plus the **real star's name**.
- Toggle the window between the last **1 month** and **6 months**.
- All reflections are equal: no scores, no streaks, no judgement.

### Reduced motion (e-ink friendly)

A toggle in **Settings → Magic stars → Display** turns off the moving trail, the sparkles, and the twinkle, and plays the save celebration without the scale pop or the eased pan (the wand still follows your cursor, and the sky still pans). It is meant for e-ink and low-power screens that leave faint marks, and it also turns on automatically if your operating system's "reduce motion" setting is enabled.

### Mid-session

While a group's allowance is active, a small **wand icon** floats at the top-left of the page. Click it (or **shake** the cursor to summon a star) to open a compact reflection panel and jot something without leaving the site.

Reflections are stored only on your device; review or delete them under **Settings → Magic stars**.

## The commitment screen

Shown right after the reflection (or the hold-to-countdown) **when Force a break is on**:

> *"Once I finish this **[N]** min session, I will take a break for **[X]** minutes."*

- **Session length (N)** is your free-browsing time. It is typed only, defaults to the Settings allowance, range **3 to 25**. Editing it sets the allowance for this session.
- **Break length (X)** snaps to discrete levels **1, 3, 5, 10, 15, 20, 25, 30**. It **always opens at 30** (the max) and never remembers your last value, so doing nothing commits you to the longest break and nudges a deliberate choice. Set it by **drag** (snaps to the nearest level), **scroll** (slow steps proportionally, a fast flick sweeps to the end), or **type** / **arrow keys** for off-level precision.

**Continue** unlocks the site for the allowance; the break afterward runs for exactly the minutes you committed.

If you have rated this group's recent sessions on the break screen, a faint line here mirrors your own past answers back, for example *"Lately, Socials mostly hasn't given you what you came for."* It only informs your choice; it never changes, shortens, or blocks the length.

## The break screen

After the allowance ends (with Force a break on), a calm break screen:

- Your own **message** leads (set in Settings, line breaks kept), with a highlighted line beneath it, *"MM:SS left in your N-minute break"* (the time monospaced), and a thin **progress bar** that fills as the break elapses.
- **Pick up to 3** activities to do, or add a new one on the spot (which saves to your list).
- The button reads **Break in progress** while you wait, then **I'm done** when the timer ends. The break must finish before you continue.
- **A one-tap rating**, *"Did {group} give you what you came for?"* with ○ Not really / ◐ Some of it / ● Yes, that. One tap, fully skippable, tap again to clear. It is mirrored back on the next commitment screen and never used to score or gate.

## Break activities

Make your break intentional instead of idle:

- **Predefine activities** in Settings, each with a name and an area/tag (for example `🧠body`, `👁eye`). Add, inline-edit, delete, and drag to reorder. A sensible starter set is seeded on first run.
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

All settings live in the options page (popup settings icon, or `chrome://extensions` then Hold to Pause, Details, Extension options). They are organized into three tabs in a left sidebar (**General**, **Break**, **Magic stars**), and it remembers the tab you were on.

**General**
- **Groups.** A **horizontal segmented control**: each group is a tab and one editor shows at a time, so the page stays short however many groups you have. The "+" tab adds a group. Each group has a name, sites (one per line; domains and `domain/path` rules), **pause seconds**, a **schedule** (Mon to Sun toggles plus an optional start/end window that can wrap midnight), and a trash icon to delete.
- **Countdown behavior.** *Reset timer on release* (pause where it is, or snap back to full).
- **Session length.** The default free-browsing window (3 to 25 min); you can change it each time on the commitment screen.
- **Pause page background.** Black, white, or a custom hex colour (text colour flips by luminance). The reflection screen itself stays a night sky regardless.

**Break**
- An **intro** with the **Force a break** toggle and a short note on how forced breaks work.
- **Break screen message.** The words shown on the break screen while you cool down (multi-line; line breaks are kept), shown when Force a break is on.
- **Break stats**, **Break activities**, and a foldable **All breaks** history.

**Magic stars** (reflections)
- An **intro** with the **Enable magic stars** toggle (on shows the reflection screen with its countdown; off uses the plain hold-to-pause).
- **Display**: the star-map window (**1 month** or **6 months**) and the **Reduced motion** toggle.
- **Feelings (mood map)**: the feelings offered on the circumplex, editable per quadrant, with the sun/moon/lily/cactus axis icons.
- A foldable **All reflections** history (thoughts, body, mood), reviewable and deletable.

Row actions (edit, delete, save, cancel, add) are icons. Break activities and reflections save on their own; the **Save** button covers groups, pause, background, and break settings.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `background.js` | Service worker: intercepts navigation, routes reflect/pause/commit/break by the Magic stars and Force a break switches, per-group allowance, break, and schedule logic |
| `reflect.html` / `reflect.css` / `reflect.js` | Reflection screen: wand cursor and trailing-ribbon trail, shake-to-summon star, thoughts / body (rabbit map) / mood (circumplex), the merged countdown, the save celebration, and the planetarium star map |
| `skymap.js` | The planetarium renderer: stereographic projection, pan and zoom, constellations, Milky Way, and reflections lit as a dense cluster on real stars |
| `data/sky-*.json` | Bundled star data (stars, constellation lines, labels, star names, Milky Way), from open Hipparcos / d3-celestial datasets |
| `pause.html` / `pause.css` / `pause.js` | Hold-to-countdown page (used when Magic stars is off) |
| `commit.html` / `commit.css` / `commit.js` | Break-length commitment screen, with the faint past-rating echo |
| `break.html` / `break.css` / `break.js` | Break page: message, highlighted time line, progress bar, activity picker, and the one-tap session rating |
| `reflect-content.js` | Content script: floating wand icon and compact reflection panel on blocked sites while an allowance is active |
| `popup.html` / `popup.css` / `popup.js` | Toolbar popup for quick block-from-current-tab |
| `options.html` / `options.css` / `options.js` | Settings UI (General / Break / Magic stars tabs) |
| `breaks-common.js` | Shared helpers for break activities, stats, history, tag colours |
| `reflections-common.js` | Shared helpers for reflections: log storage, the feelings/circumplex data, and star helpers |
| `images/` | Wand (`wand.png`, `wand-120.png`), the body-map rabbit (`body.png`), star images (`stars-001..021`), the mood-axis icons (`sun`, `moon`, `lily`, `cactus`), and UI icons (`edit`, `delete`, `save`, `cancel`, `settings`, `add`) |
| `fonts/Baloo2.woff2`, `fonts/Figtree.woff2` | Bundled display and body fonts (SIL OFL) |
| `icons/icon-{16,32,48,128}.png` | Toolbar, extensions-page, and install-dialog icons |

## Notes and limitations

- Settings, break activities, and the reflection **feelings** palette sync across signed-in Chrome installs (`chrome.storage.sync`).
- Allowance and break state, break history, **reflections**, the per-group reflection countdown, and the last-used group are device-local (`chrome.storage.local`). Reflections never leave your machine.
- Leaving the reflection screen before its countdown ends saves the remaining time per group, so revisiting any site in that group resumes where you left off; it resets once you unlock. The allowance and break, by contrast, are real-time windows that run from the moment you commit.
- The wand cursor, trail, and star map appear only on the extension's own reflection screen. On live sites only a small wand icon and panel are injected (`reflect-content.js`); there is no cursor hijack on real pages.
- Allowance and break state is keyed **per group**, not per domain.
- Closing or reloading the break-page tab does **not** end the break early; state is tracked per group.
- Site matching is hostname plus an optional path prefix. No regex or wildcard support yet.

## Data and assets

- Star data is derived from the **Hipparcos** catalogue via the open **d3-celestial** datasets (MIT / public domain), filtered and bundled under `data/` so the extension runs fully offline.
- Fonts are **Baloo 2** and **Figtree** under the SIL Open Font License.
- UI and mood icons are from **Icons8**.
