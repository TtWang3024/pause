# Hold to Pause

A Chrome extension that makes you stop and think before opening time-sink websites. Instead of blocking you outright, it adds friction at the moment of impulse. By default each blocked session opens on your **sky of reflections**: shake the wand, tap the star it summons, and an **"An urge is here"** window lets you name what is happening (the urge wave, where you feel it in your body, your mood, your thoughts). **Open it anyway** waits out the group's pause length (hold the button to count it down) unless you have logged something, in which case the wait is gone. Turn Magic stars off and it falls back to a full-screen timer that **only ticks while you hold the left mouse button**. Optionally, you **commit to a break** for each session and **take that break** afterward, a small in-the-moment decision instead of a rigid schedule; the session's star is lit when that break finishes. Reflections gather over time into a private **star map** drawn on a real night sky.

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
[ Sky ]             shake the wand, tap the star it summons: the "An urge is here"
        ↓           window opens. Log nothing and "Open it anyway" waits out the
        ↓           group's pause length (hold the button to count it down). Log a
        ↓           thought, a body spot, a mood or a wave point and it is one tap
        ↓           away; the star waits, unlit, for the break.
[ Commit a break ]  "Once I finish this session, I will take a break for X min"
        ↓
   Allowance        3 to 25 min of free access, SHARED across the whole group
        ↓           (a small wand icon floats top-left; tap it to reflect mid-session)
[ Break ]           runs for X minutes; pick up to 3 activities, then rate the session.
        ↓           At 00:00 it logs itself, lights the session's star and shows it
        ↓           for a few seconds (only while the tab is in front)
  The sky returns by itself, ready for the next urge
```

- **Magic stars off** replaces the reflection screen with the classic **hold-to-pause** page (a full-screen countdown that only ticks while you hold the left mouse button).
- **Force a break off** skips the commitment screen and the break, going straight to free access. A reflection saved on **Open it anyway** is then lit at once, since no break will follow.

The gate only fires when the group's **schedule** is active (day-of-week plus an optional time window).

## Groups share one session

Sites are organized into **groups**, and a group is treated as a single session:

- Unlock **any** site in a group, and the **whole group** opens for the allowance.
- When the allowance (and break) end, **every open tab in the group re-blocks together**.

So if `youtube.com` and `reddit.com` are in one group, completing the pause once frees both, and the limit ends for both at the same time.

## A moment of magic (reflection)

When **Magic stars** is on (the default), each blocked session opens on an unhurried sky where the wand replaces the hold-to-pause. There is no Continue button; the way onward is through a star. It is a gentle way to name what is happening before you dive in (*affect labeling*, an evidence-based way to take some heat out of an impulse).

- **The gate.** Tap the star you summoned and the **"An urge is here"** window opens with three exits. **Open it anyway** is gated by the group's pause length: hold the button while a gentle light pulses; releasing pauses it and the progress is kept per group. With *Hold to count down* off in Settings it counts down on its own instead, but only while the window is open and the tab is in front. Recording a reflection never shortens the wait; reflection stays optional. **Relax my body first** starts a short standalone break, and **Back to what matters** (or ✕) closes the tab.
- **The wand.** Your cursor becomes a magic wand with a soft twinkle and a **trailing-ribbon** glow that flows behind your movement.
- **Open a star.** Give the wand a little **shake** to summon a star in the middle of the screen, then tap it to open the urge window.
- **Four prompts:**
  - **Wave.** Tap a number to add a point. Each tap is one even step to the right (the steps shrink once the points would overflow the width), and a smooth curve joins them without overshooting 0 or 10, so you can watch the urge rise, crest and pass, while a small ball paces your breath (box, 4-7-8 or coherent). The window shows the last 10 points on this site, with earlier sessions' points drawn faded so there is always some history to read. The break screen keeps the same wave going on a chart as wide as the activity board, showing at least the last 20 points, or every point from the last 4 hours when there are more.
  - **Thoughts.** Type and press Enter to add as many as you like. Drag a chip's **⠿ grip** to reorder them; the first becomes the reflection headline.
  - **Body.** Tap the **rabbit** where you feel something. Dots glow as the cursor nears and show their label only on hover (so logged dots stay lit without crowding the others). The head senses fan out from one dot: see / smell / taste open to the right, a **head area** tag opens to the left. The five senses wear light-pink tags; other parts wear dark ones. Tag up to **3**, and the note box focuses for you so you can type at once; drag to reorder.
  - **Mood.** Pick from the **mood map**, a valence by arousal *circumplex* of four joined, colour-coded quadrants, with large axis icons at the tips of a dark-grey cross (sun = high arousal, moon = low arousal, lily = pleasant, cactus = unpleasant). Each quadrant's pills carry its colour. Choose **up to 3**, or tap an empty spot in a quadrant to add your own. They rank by quadrant (positive-high, negative-high, positive-low, negative-low), then A to Z.
- **One star per completed experiment.** Finish the chosen experiment interval, then review or skip the optional questions. One star appears regardless of your ratings or whether you return to watching. Reloading cannot award another star. Early endings remain saved observations without an award.
- **Save a reflection.** The exit buttons save your notes without a star celebration. On a quiet visit with no site behind it, **Save reflection** returns to the sky. Existing reflections and breaks stay in history; their old awards no longer appear in the sky.

### Your sky of reflections

Top left, a tally shows how many stars you lit **today** and **this week** (Monday to now). A star counts once it is lit, so a reflection still waiting for its break is not in the tally yet.

The backdrop is a **real planetarium**, built from open Hipparcos-derived star data bundled offline:

- **Drag to pan** across the dome, **scroll to zoom**. Real **constellation lines**, **constellation and bright-star names** (names fade in as you zoom), and a soft **Milky Way** band.
- Completed experiments light up as a **dense cluster** that grows shell by shell from a centre (near Orion): the oldest takes the nearest star, each newer one the next-nearest free star, so your sky fills outward over time. **More recent experiments glow brighter.** Hover one to read your chosen action plus the **real star's name**.
- Toggle the window between the last **1 month** and **6 months**.
- Experiment outcomes are treated equally: no scores, no streaks, no judgement.

### Reduced motion (e-ink friendly)

A toggle in **Settings → Magic stars → Display** turns off motion on the sky and the gentle pause glow. The box still opens on hover or keyboard focus, without an animated transition. System reduced-motion preferences are also respected.

### Mid-session

While a group's allowance is active, a small **wand icon** floats at the top-left of the page. Click it (or **shake** the cursor to summon a star) to open a compact reflection panel and jot something without leaving the site.

Reflections are stored only on your device; review or delete them under **Settings → Magic stars**.

## The commitment screen

Shown right after **Open it anyway** (or the hold-to-countdown) **when Force a break is on**:

> *"Once I finish this **[N]** min session, I will take a break for **[X]** minutes."*

- **Session length (N)** is your free-browsing time. It is typed only, defaults to the Settings allowance, range **3 to 25**. Editing it sets the allowance for this session.
- **Break length (X)** snaps to three levels: **3, 10, 30**. It **opens at 3** (the shortest) and never remembers your last value, so a longer break is a deliberate choice you make each time. Set it by **drag** (snaps to the nearest level), **scroll** (slow steps one level at a time, a fast flick sweeps to the end), the **arrow keys** (one level per press), or **type** a number (it settles on the nearest level).

**Continue** unlocks the site for the allowance; the break afterward runs for exactly the minutes you committed.

If you have rated this group's recent sessions on the break screen, a faint line here mirrors your own past answers back, for example *"Lately, Socials mostly hasn't given you what you came for."* It only informs your choice; it never changes, shortens, or blocks the length.

## The break screen

After the allowance ends (with Force a break on), a calm break screen:

- Your own **message** leads (set in Settings, line breaks kept), with a highlighted line beneath it, *"MM:SS left in your N-minute break"* (the time monospaced), and a thin **progress bar** that fills as the break elapses.
- **Pick up to 3** activities to do, or add a new one on the spot (which saves to your list).
- The break **ends by itself** at 00:00: it logs the minutes and the activities you picked, lights the session's **star**, and holds it on screen for a few seconds (*"Thank you for resting. Your sky gained a star <Name>."* with the minutes and activities beneath) before the sky returns on its own (with Magic stars on; with it off, the hold-to-pause page returns at once). There is no button to press. That pause only counts while the tab is in front; its length is the **Star moment** setting (3 seconds by default). A break with no reflection behind it gets a star of its own, holding just the rest.
- **I choose to return** is the way back by choice (on by default; the timing lives in Settings): locked for the first minutes of the break, then hold it for the set seconds. It ends the break the same way, star moment included, and the log keeps the minutes you actually rested.
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
- **Pause blocking for 1 hour** (the back door, at the bottom). The first tap turns nothing off. It leads with which pause this would be today as a large ordinal (red from the 3rd), a dot and time for each earlier pause, and the cost in time ("2 h unblocked today. This makes 3 h."). Then two short steps through the body: two breaths with the ball (4 s in, 4 s out), then press both feet into the floor and hold the button for 5 seconds while you feel them (letting go starts it again). The steps are the same every time, however often you have paused. Only then does **Yes, pause** unlock and turn blocking off for an hour. Tabs waiting on a pause, reflection or "Before I open it" screen go on to their site, the icon wears an **off** badge, and the popup shows when blocking returns with a **Turn back on now** button. Only the blocking pauses: time per site keeps counting, open break tabs stay, and nothing is caught for binge-watching until the hour is over. When it ends, every open tab on a blocked site goes back to where it belongs (its gate, or its break).

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
- **Countdown behavior.** *Reset timer on release* for the hold-to-pause page (pause where it is, or snap back to full), and *Hold to count down* for the reflection screen: **Open it anyway** only counts while you press and hold it, releasing pauses, progress kept; anything logged in the window removes the wait. Off, it counts down on its own while the window is open and the tab is in front.
- **Session length.** The default free-browsing window (3 to 25 min); you can change it each time on the commitment screen.
- **Pause page background.** Black, white, or a custom hex colour (text colour flips by luminance). The reflection screen itself stays a night sky regardless.

**Break**
- An **intro** with the **Force a break** toggle and a short note on how forced breaks work (the dial opens at 3 minutes, so a longer break is a deliberate choice; levels 3, 10, 30).
- **Ending a break early.** The *I choose to return* toggle, how many minutes of the break pass before it unlocks, and how many seconds to hold it.
- **Break screen message.** The words shown on the break screen while you cool down (multi-line; line breaks are kept), shown when Force a break is on.
- **Break stats**, **Break activities**, and a foldable **All breaks** history.

**Magic stars** (reflections)
- An **intro** with the **Enable magic stars** toggle (on opens each blocked session on the sky, where the wand and the urge window replace the hold-to-pause; off uses the plain hold-to-pause page).
- **Display**: the star-map window (**1 month** or **6 months**) and the **Reduced motion** toggle.
- **Feelings (mood map)**: the feelings offered on the circumplex, editable per quadrant, with the sun/moon/lily/cactus axis icons.
- A foldable **All reflections** history (thoughts, body, mood), reviewable and deletable. Observations are marked as reflections. Completed experiments appear with their chosen action.

Row actions (edit, delete, save, cancel, add) are icons. Break activities and reflections save on their own; the **Save** button covers groups, pause, background, break settings.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `background.js` | Service worker: intercepts navigation, routes reflect/pause/commit/break by the Magic stars and Force a break switches, per-group allowance, break, and schedule logic |
| `reflect.html` / `reflect.css` / `reflect.js` | Reflection screen: wand cursor and trailing-ribbon trail, shake-to-summon star, the "An urge is here" window (wave / body (rabbit map) / mood (circumplex) / thoughts) with its hold gate, the save celebration, and the planetarium star map |
| `skymap.js` | The planetarium renderer: stereographic projection, pan and zoom, constellations, Milky Way, and reflections lit as a dense cluster on real stars |
| `data/sky-*.json` | Bundled star data (stars, constellation lines, labels, star names, Milky Way), from open Hipparcos / d3-celestial datasets |
| `pause.html` / `pause.css` / `pause.js` | Hold-to-countdown page (used when Magic stars is off) |
| `commit.html` / `commit.css` / `commit.js` | Break-length commitment screen, with the faint past-rating echo |
| `break.html` / `break.css` / `break.js` | Break page: message, highlighted time line, progress bar, activity picker, the one-tap session rating, the self-ending timer, and the star moment |
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
- Allowance and break state, break history, **reflections**, the per-group pause countdown, and the last-used group are device-local (`chrome.storage.local`). Reflections never leave your machine.
- Leaving the sky before the **Open it anyway** wait ends saves the remaining time per group, so revisiting any site in that group resumes where you left off; it resets once you unlock. The allowance and break, by contrast, are real-time windows that run from the moment you commit.
- The wand cursor, trail, and star map appear only on the extension's own reflection screen. On live sites only a small wand icon and panel are injected (`reflect-content.js`); there is no cursor hijack on real pages.
- Allowance and break state is keyed **per group**, not per domain.
- Closing or reloading the break-page tab does **not** end the break early; state is tracked per group.
- Site matching is hostname plus an optional path prefix. No regex or wildcard support yet.

## Data and assets

- Star data is derived from the **Hipparcos** catalogue via the open **d3-celestial** datasets (MIT / public domain), filtered and bundled under `data/` so the extension runs fully offline.
- Fonts are **Baloo 2** and **Figtree** under the SIL Open Font License.
- Icon credits:
  - The **save** icon, the **wand**, the **rabbit** body map, and the **star** images are original, made by the author with AI (ChatGPT).
  - The **edit**, **delete**, **cancel**, and **settings** icons are from [Icons8](https://icons8.com/license).
  - The mood-axis icons and the **add** (plus) button are from Flaticon, created by Freepik:
    - [Moon icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/moon)
    - [Succulent icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/succulent) (cactus)
    - [Flower icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/flower) (lily)
    - [Sun icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/sun)
    - [Plus icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/plus)

## Small experiments

Open the **Pandora’s box icon** at the bottom of the opening sky to try a small experiment. The closed box opens and glows on hover or keyboard focus, with reduced-motion support. You can also choose **Try a small experiment** inside the reflection panel, on the classic pause or break screen, or inside the floating wand panel while viewing. Predict what stepping away might feel like, choose a small action (or write your own), and try it for 1–5 minutes. Discomfort ratings are optional.

The number-free progress bar advances while you are away and survives reloading or reopening the experiment URL. Hide it or end early at any time. Review what actually happened, including “Nothing” pleasant or worthwhile, or skip the review. Then stay away two more minutes, finish for now (close this tab), or return through the existing viewing limits. Experiments never grant a new allowance or end a required break. Viewing time continues to elapse during experiments.

Experiments navigate away from the current page, which stops its playback. Returning attempts to restore the position of a standard top-frame HTML5 video, paused; embedded, live, and custom players may not support restoration. The extension does not yet detect episode endings automatically. The break-page entry is available when the normal session timer ends.

History is local to this device, accessible from Settings or the experiment's final screen. Each experiment has its own record, including prediction, optional ratings, action, elapsed interval, optional review and next choice. Missing answers remain unknown; elapsed time does not prove an activity was performed. Delete individual entries in history. Completing the chosen interval and reviewing or skipping the optional questions lights exactly one star. Early endings stay in history without an award. Old reflection and break entries remain in history but no longer light stars. Deleting an experiment also removes its star.

Implementation: `experiment.html`, `experiment.css`, `experiment.js`, `experiment-launch.js`, and `experiment-background.js`. The background uses existing group state and navigation rules. Independent experiments in separate tabs share the group's original limits.

Experiment checks: run `node --test tests/experiment-background.test.cjs tests/experiment-stars.test.cjs`. For the browser flow check, make Playwright available to Node, set `CHROME_EXECUTABLE` if using an installed browser, and run `node tests/experiment-ui.cjs`. The browser check uses isolated mock extension storage; live-site playback restoration still needs site-specific testing.
