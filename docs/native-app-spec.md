# Hold to Pause — Native App Spec

> A focus app that adds a moment of friction at the point of impulse, instead of asking you to schedule a future self.

## The one idea

Everything distracting is **blocked by default**. To get in, you open Hold to Pause and **hold to count down**. Finishing the pause **unlocks everything for a set window**; when the window ends, it **blocks again**. No schedules, no allow-lists, no planning ahead. One gesture.

## The core loop

```
[ Everything blocked ]
        │  you tap a blocked app → a lock screen says "Open Hold to Pause"
        ▼
[ Hold to Pause app ]  ← press and hold; a big timer counts down
        │  countdown completes
        ▼
[ Unlocked for XX minutes ]  ← use anything freely
        │  window ends (auto)
        ▼
[ Everything blocked ]  ← back to the top
```

This is the same allowance model as the browser extension, applied globally at the OS level.

## Screens (the whole app)

1. **Home** — one big button: *Hold to unlock*. Shows current state (Locked / Unlocked, time left). Maybe a small "what's blocked" entry and the unlock-window length.
2. **Pause** — full-screen timer; hold to count down; releases pause/continue the timer. On completion → unlock + return home.
3. **Setup (first run only)** — pick what to block (apps/categories), set unlock-window length (e.g. 5–25 min), grant the OS permission. That's it.

## The pause interaction

- Press and **hold** anywhere; the timer ticks only while held.
- Release → timer **pauses** (configurable: reset on release).
- Reaches zero → unlock and dismiss.
- Big, calm, single-color screen. (Carry over Baloo 2 numerals from the extension.)

## Permissions & frameworks

### iOS / iPadOS / macOS (macOS 13+)
| Need | Apple framework |
|---|---|
| Authorize device management (self, no parent) | **FamilyControls** |
| Block / unblock apps (the shield) | **ManagedSettings** (`shield.applications`) |
| Let the user choose what "everything" means | **FamilyActivityPicker** (opaque tokens; app never sees the list) |
| Re-block when the unlock window ends | **DeviceActivity** (background monitor re-applies the shield) |

The shield screen itself stays minimal ("Blocked — open Hold to Pause"). The real ritual lives **inside the app**, where UI is unrestricted — this is the key to keeping the hold-to-pause experience intact on iOS.

### Android
| Need | Mechanism |
|---|---|
| Detect the foreground app | **Usage Access** (`PACKAGE_USAGE_STATS`) |
| Show the lock / route to pause | **Draw over other apps** (`SYSTEM_ALERT_WINDOW`) |
| Re-block after the window | Foreground service + timer |

Android can also do per-app pause-on-open directly, but the block-all model keeps both platforms behaving identically.

## Deliberate non-features

These are **left out on purpose** to protect the core idea:

- ❌ No schedules / "block weekdays 9–5" / time-of-day rules.
- ❌ No per-app or per-group different settings (one block set, one window).
- ❌ No notification management — notifications stay on (see below).
- ❌ No streaks, points, gamification, social.
- ❌ No accounts or cloud (settings live on-device).
- Stats/history are optional at most, never required.

## Notifications (by design)

Blocked apps **still deliver notifications** — banners, badges, lock-screen alerts. This is intentional:

- Time-sensitive, important messages still reach you.
- Tapping a notification for a blocked app still lands on the **pause**, so impulse still pays the toll.
- The app does **not** try to silence notifications. If a user wants quiet, that's what a system **Focus mode** (iOS/macOS) or **Do Not Disturb** (Android) is for — a separate, optional choice.

## Known limitations (be honest)

- **Bypass:** a determined user can disable the app in system Settings unless it's behind a Screen Time passcode. This adds friction; it is not hard enforcement.
- **Notification pull:** a buzz can still tempt you to unlock. Accepted trade-off for staying informed.
- **Re-block timing granularity:** the background monitor is reliable but not second-precise. "Unlock for 15 min" is safe; very short windows need testing.

## Build prerequisites

- **iOS/macOS:** native Swift/SwiftUI, Xcode, Apple Developer Program ($99/yr), and a request to Apple for the **Family Controls entitlement** (granted for legitimate focus apps).
- **Android:** Kotlin (or Flutter for one codebase), Google Play Developer account ($25 one-time).
- The extension code does **not** port; the *design and logic* do.

## Smallest viable first build (MVP)

Pick **one** platform. Suggested order: **iOS first** (the model fits Screen Time best) or **Android first** (fewer entitlement hurdles, easier to ship).

MVP scope:
1. First-run setup: pick blocked apps + unlock-window length + grant permission.
2. Block everything by default.
3. Hold-to-pause screen → on completion, unlock for the window.
4. Auto re-block when the window ends.

No stats, no themes, no schedules. Ship that, live with it for a week, then decide what (if anything) it actually needs.

---

## Android v1 decisions (2026-07-12)

Locked in with the author; these override the sections above where they differ:

- **Platform:** Android first, developed against the author's daily phone. Sideloaded APK (no Play release for v1; design stays Play-safe: Usage Access polling + overlay, no accessibility service).
- **Model:** **groups, like the extension** (per-group apps, pause length, allowance) — overrides the "one block set, one window" non-feature above. "Block all by default" ships with a mandatory system allowlist: launcher, dialer/emergency, keyboard (IME), system Settings, alarm/clock, and Hold to Pause itself.
- **Stack:** native Kotlin + Jetpack Compose. No cross-platform framework. The extension's HTML/JS does not port; its logic, copy, and feel do.
- **Project:** lives in a sibling folder `pause-android` (own repo), package id `com.ttwang.holdtopause`.
- **Build route:** command-line SDK + Gradle driven by Claude (no Android Studio required); the author installs the APK on the phone over USB (adb).
- **Phases:** 1) hello-world APK on the phone → 2) watcher + overlay + hold-to-pause + allowance + auto re-block with one hardcoded group → 3) groups & settings UI → 4) commit/break, then the reflection ritual.

*Origin: grew out of the "Hold to Pause" Chrome extension in this repo. Same philosophy — friction at the moment of impulse, not control over a future self.*
