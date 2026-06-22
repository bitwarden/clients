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
- Work from `apps/desktop`. The dev launch builds the renderer in development mode.

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

Write this plan to `.auto-test/<run-id>/plan.md` (the same `<run-id>` dir as the screenshots, Step 4)
so the proposed steps live alongside the captured run.

## Step 3 — Launch the app and attach

From `apps/desktop`, start the dev build **in the background** so it keeps running for the whole
test. This builds main/renderer/preload and launches Electron with the remote debugging port:

```bash
# run with run_in_background: true so the process survives across the test
npm run electron
```

The process must stay up for the rest of the run — do not block on it. Note its background task id;
you stop it in Step 7.

Wait until the renderer is actually serving on port `9222` before attaching (do not sleep blindly —
poll the CDP endpoint):

```bash
npx wait-on http://localhost:9222/json/version
```

Then attach with the Chrome DevTools MCP and confirm the target:

- `list_pages` — locate the Bitwarden renderer page and select it (`select_page`).
- If attach fails, see the `chrome-devtools-mcp:troubleshooting` skill (the port must match `9222`).

**Start the screencast now**, before exercising any change, so the whole run is recorded.

If the app launches locked, unlock it before navigating — `take_snapshot` to find the unlock
input, then `fill` the PIN and submit. The dev build's default PIN unlock is `1234`.

## Step 4 — Navigate the app and open Settings

Drive the renderer with the Chrome DevTools MCP. Use `take_snapshot` to read the current UI,
`click` / `fill` / `press_key` to interact, and `take_screenshot` to capture state.

Take a `take_screenshot` after every step and save it to `.auto-test/<run-id>/`, where `<run-id>` is
a unique id generated for this run (e.g. a timestamp). Create the directory at the start of the run
so each stage's screenshot is captured under it.

To open **Settings**, inject a script that sends the `openSettings` message through the renderer's
messaging bus:

```js
// chrome-devtools MCP: evaluate_script (runs in the renderer main world)
bitwardenMessagingService.sendMessage({ command: "openSettings" });
```

This only works after the vault is unlocked — unlock first (Step 3, default PIN `1234`), otherwise
the message has no effect.

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
- Write the report to `.auto-test/<run-id>/report.md`, alongside the screenshots and `plan.md` for
  this run.

To publish the run to the PR, invoke the `add-auto-test-to-pr` skill with the `.auto-test/<run-id>/`
directory.

## Step 7 — Shut down the app

Stop the background Electron process started in Step 3 (stop its background task). The dev launch
runs several watchers under one `concurrently` parent, so also clear any stragglers:

```bash
pkill -f "scripts/start.js" || true   # the concurrently parent + main/preload/renderer watchers
pkill -f "remote-debugging-port=9222" || true   # the electron instance
```

Run this even if the test failed, so no Electron process or watcher leaks between runs.
