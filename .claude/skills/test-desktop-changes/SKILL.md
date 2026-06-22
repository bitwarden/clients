---
name: test-desktop-changes
description: Manually test pending desktop (Electron) changes by driving the running app with the Chrome DevTools MCP. Use when asked to test, verify, or exercise desktop changes in the real app, take a screencast of desktop behavior, or confirm a desktop fix works end-to-end. Does not apply to web/browser/CLI clients or to unit tests.
user-invocable: true
---

# Test Desktop Changes

Drive the running Bitwarden desktop app with the Chrome DevTools MCP to confirm that the pending
changes actually behave as intended. The MCP attaches to the Electron renderer over the remote
debugging port, records a screencast of the run, and scripts navigation (including opening Settings).

## Prerequisites

- The Chrome DevTools MCP is configured to attach to the renderer at `http://localhost:9222`
  (the desktop dev launch already exposes `--remote-debugging-port=9222`).
- Work from `apps/desktop`. The dev launch builds the renderer in development mode, so the Angular
  debug global `window.ng` is available — the navigation script below relies on it.

## Step 1 — Understand the changes

Read the diff and grasp the **main intent** before touching the app. Do not test blindly.

```bash
git status
git diff            # or: git diff main...HEAD for a branch
```

For each changed area, identify:

- **What** changed (component, service, IPC handler, main vs. renderer process).
- **The user-visible effect** — what should now look or behave differently in the app.
- **Where it surfaces** — which screen, dialog, or flow (e.g. Settings, vault list, unlock).

Keep this list; it becomes the test plan.

## Step 2 — Write the test plan

Produce a short plan that contains:

1. **The main changes** — one line per change describing the intent and the observable behavior to
   confirm.
2. **A screencast note** — start a screencast with the Chrome DevTools MCP before exercising the
   changes and stop it after, so the run is captured for review.
3. **Navigation steps** — the sequence of screens/actions needed to reach each change, using the
   Settings-injection helper (Step 4) where the change lives in Settings.

## Step 3 — Launch the app and attach

From `apps/desktop`, start the dev build (builds main/renderer/preload and launches Electron):

```bash
npm run electron
```

Wait until the window is up and the renderer is serving on port `9222`. Then attach with the Chrome
DevTools MCP and confirm the target:

- `list_pages` — locate the Bitwarden renderer page and select it (`select_page`).
- If attach fails, see the `chrome-devtools-mcp:troubleshooting` skill (the port must match `9222`).

**Start the screencast now**, before exercising any change, so the whole run is recorded.

## Step 4 — Navigate the app and open Settings

Drive the renderer with the Chrome DevTools MCP. Use `take_snapshot` to read the current UI,
`click` / `fill` / `press_key` to interact, and `take_screenshot` to capture state.

To open **Settings**, inject a script that sends the `openSettings` message through the renderer's
messaging bus. The handler lives in `app.component.ts` and fires when the message reaches the
renderer `MessageListener`. Send it through the app's `MessageSender` (reachable via the root
`AppComponent` instance) — that publishes to the intraprocess messaging subject the handler listens
on:

```js
// chrome-devtools MCP: evaluate_script (runs in the renderer main world)
const appRoot = document.querySelector("app-root");
const appComponent = window.ng.getComponent(appRoot);
appComponent.messagingService.send("openSettings");
```

> Note: the raw preload bridge `window.ipc.platform.sendMessage({ command: "openSettings" })` only
> routes renderer→main, and the main process does not echo `openSettings` back — so it will **not**
> open the dialog. Use the `messagingService.send` path above.

After injecting, `take_snapshot` / `take_screenshot` to confirm the Settings dialog (or modal,
depending on the `DesktopSettingsDialog` feature flag) is open, then navigate to the section the
change affects.

## Step 5 — Verify each change

Walk the test plan. For each change:

- Reach the relevant screen (Step 4 for Settings-hosted changes).
- Exercise the new behavior and capture a screenshot.
- Check `list_console_messages` for errors and `list_network_requests` if the change touches
  network calls.
- Confirm the observed behavior matches the intent from Step 1.

**Stop the screencast** once all changes are verified.

## Step 6 — Report

- Report, per change: intent, what was observed, pass/fail, and attach the screencast/screenshots.
- If anything failed, include the console output and the exact navigation step that reproduced it.
