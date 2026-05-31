# Hold to Pause

A Chrome extension that makes you stop and think before opening time-sink websites. Instead of blocking you outright, it shows a full-screen countdown — and the countdown only ticks while you hold the left mouse button. Let go and the timer freezes (or resets, your choice).

## Install (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked** and select this `pause-extension` folder
4. The settings page opens automatically on first install

## How it works

```
Visit blocked site
        ↓
  [ Pause page ]   ← hold left-click to count down
        ↓
   Allowance       ← 5–25 min of free access on that domain
        ↓
   (optional)
  [ Break page ]   ← 1–10 min forced cool-down with your custom message
        ↓
  Back to Pause page on next visit
```

The pause only fires when the group's **schedule** is active (day-of-week + optional time window).

## Two ways to add blocked sites

### Via the toolbar popup
Click the extension's icon in the Chrome toolbar to get a small popup:

- Shows the current tab's URL
- Dropdown to pick which group to add to (remembers your last choice)
- **Block this domain** — adds the hostname (e.g. `youtube.com`), covers all paths
- **Block this section** — pre-fills the first two path segments (e.g. `youtube.com/shorts`); you can edit the text before clicking the button
- Cog icon (top-right) → opens the full settings page
- Buttons show ✓ when the rule already exists in the selected group

### Via the settings page
Open the cog from the popup, or right-click the extension icon → Options. Add domains directly to a group's text area, one per line.

## Site rule syntax

Two forms — both match subdomains automatically:

| Rule | Matches |
|---|---|
| `youtube.com` | `youtube.com`, `m.youtube.com`, `www.youtube.com`, and **every path** |
| `reddit.com/r/funny` | `reddit.com/r/funny`, `reddit.com/r/funny/comments/...`, `old.reddit.com/r/funny/...` |

Path matching is boundary-safe: `reddit.com/r/fun` will **not** accidentally match `reddit.com/r/funny`.

## Settings

All settings live in the options page (popup cog icon, or `chrome://extensions` → Hold to Pause → Details → Extension options).

### Groups
Each group has:
- **Name**
- **Sites** — one per line, supports domains and `domain/path` rules
- **Pause seconds** — how long you need to hold for this group's sites
- **Schedule** — day-of-week (Mon–Sun toggles, default all on) and optional start/end time window (leave empty for all-day; window can wrap midnight)

Add as many groups as you want; each has its own timing and schedule.

### Countdown behavior
- **Reset timer on release** (on/off) — when you let go mid-countdown, choose whether the timer pauses where it is or snaps back to full.

### Pause page background
- **Black**, **white**, or a **custom color** (hex picker). Text color flips automatically based on background luminance.

### Allowance
- **5–25 minutes** of free access on a domain after you complete a pause. Prevents every internal click from re-triggering the pause page.

### Forced break (optional)
- When **on**, the cycle goes pause → allowance → break instead of pause → allowance → pause.
- **Break length:** 1–10 minutes.
- **Break message:** custom text shown in the middle of the break page.
- A small `MM:SS` countdown sits in the top-right corner. When it hits zero, you're sent back through the pause page.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `background.js` | Service worker — intercepts navigation, manages allowance/break/schedule logic |
| `pause.html` / `pause.css` / `pause.js` | Hold-to-countdown page |
| `break.html` / `break.css` / `break.js` | Forced-break page with corner timer |
| `popup.html` / `popup.css` / `popup.js` | Toolbar popup for quick block-from-current-tab |
| `options.html` / `options.css` / `options.js` | Settings UI |
| `fonts/Baloo2.woff2` | Display font for the timer and headings |
| `fonts/Figtree.woff2` | Body font for the settings and popup |
| `icons/icon-{16,32,48,128}.png` | Toolbar / extensions-page / install-dialog icons |

## Notes & limitations

- Settings sync across signed-in Chrome installs via `chrome.storage.sync`.
- Allowance/break state and last-used group are device-local (`chrome.storage.local`).
- Closing or reloading the break-page tab does **not** end the break early — state is tracked per-domain.
- Site matching is hostname + optional path-prefix. No regex or wildcard support yet.
- Fonts are bundled (Baloo 2, Figtree) under SIL OFL — no network access needed at runtime.
