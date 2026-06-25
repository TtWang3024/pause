# Hold to Pause

A Chrome extension that makes you stop and think before opening time-sink websites. Instead of blocking you outright, it adds friction at the moment of impulse: a full-screen countdown that **only ticks while you hold the left mouse button**. Optionally, you **pre-commit to a break** before each session and **take that break** afterward — a small, in-the-moment decision instead of a rigid schedule.

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
[ Commit screen ]   ← "Once I finish this session, I will take a break for X min"
        ↓               set X by drag / scroll / type — opens at 30 each time
[ Pause page ]      ← hold left-click to count down
        ↓
   Allowance        ← 5–25 min of free access, SHARED across the whole group
        ↓
[ Break page ]      ← runs for the committed X minutes; pick up to 3 activities
        ↓
  Next visit → back to the Commit screen (re-commit)
```

With **Force a break** off: `blocked site → Pause page → Allowance → (no break) → Pause again`.

The pause only fires when the group's **schedule** is active (day-of-week + optional time window).

## Groups share one session

Sites are organized into **groups**, and a group is treated as a single session:

- Unlock **any** site in a group → the **whole group** opens for the allowance.
- When the allowance (and break) end → **every open tab in the group re-blocks together**.

So if `youtube.com` and `reddit.com` are in one group, completing the pause once frees both, and the limit ends for both at the same time.

## The commitment screen

Shown before the hold-to-countdown **when Force a break is on**:

> *"Once I finish this session, I will take a break for **[X]** minutes."*

Set the length (1–30 min) however you like — it **always opens at 30** (the max) and never remembers your last value, so doing nothing commits you to the longest break and nudges a deliberate choice:

- **Drag** the horizontal bar (precise).
- **Scroll** — a slow scroll moves proportionally (short = one 5-min interval, longer = two); a fast flick sweeps to the end.
- **Type** a number, or use **↑ / ↓** arrow keys.

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

All settings live in the options page (popup cog, or `chrome://extensions` → Hold to Pause → Details → Extension options).

- **Groups** — name, sites (one per line; domains and `domain/path` rules), **pause seconds**, and a **schedule** (Mon–Sun toggles + optional start/end time window; window can wrap midnight).
- **Countdown behavior** — *Reset timer on release* (pause where it is, or snap back to full).
- **Pause page background** — black, white, or a custom hex color (text color flips by luminance).
- **After completing a pause** — the **allowance** (5–25 min), and the **Force a break** toggle with a custom **break-screen message**. (Break *length* isn't here — it's chosen on the commitment screen each session.)
- **Break activities**, **Break stats**, **All breaks** — described above (these save on their own; the **Save** button covers the rest).

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `background.js` | Service worker — intercepts navigation, routes to commit/pause/break, per-group allowance/break/schedule logic |
| `commit.html` / `commit.css` / `commit.js` | Pre-break commitment screen (the break-length setter) |
| `pause.html` / `pause.css` / `pause.js` | Hold-to-countdown page |
| `break.html` / `break.css` / `break.js` | Break page — corner timer, echo, activity picker |
| `popup.html` / `popup.css` / `popup.js` | Toolbar popup for quick block-from-current-tab |
| `options.html` / `options.css` / `options.js` | Settings UI |
| `breaks-common.js` | Shared helpers for break activities, stats, history, tag colors |
| `fonts/Baloo2.woff2`, `fonts/Figtree.woff2` | Bundled display + body fonts (SIL OFL) |
| `icons/icon-{16,32,48,128}.png` | Toolbar / extensions-page / install-dialog icons |

## Notes & limitations

- Settings and break activities sync across signed-in Chrome installs (`chrome.storage.sync`).
- Allowance/break state, break history, and last-used group are device-local (`chrome.storage.local`).
- Allowance/break state is keyed **per group**, not per domain.
- Closing or reloading the break-page tab does **not** end the break early — state is tracked per group.
- Site matching is hostname + optional path-prefix. No regex or wildcard support yet.
- Fonts are bundled (Baloo 2, Figtree) under SIL OFL — no network access needed at runtime.
