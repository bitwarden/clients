---
name: interact-client
description: >
  Drive and interact with the running Bitwarden app — desktop (Electron), browser extension, or
  web — via the Chrome DevTools protocol. Use when asked to navigate, click, fill UI, screenshot,
  lock/unlock the vault, toggle feature flags, mock biometrics, or automate flows. Requires the
  target app to already be running.
---

# Interact Client

Drive the **already-running** Bitwarden app for debugging and automation.

Two MCP servers are wired in `.mcp.json` — pick the right one for your target:

| MCP server          | Port | Targets                                                       |
| ------------------- | ---- | ------------------------------------------------------------- |
| `electron-devtools` | 9222 | Desktop (Electron renderer) — use `mcp__electron-devtools__*` |
| `chrome-devtools`   | 9200 | Browser extension, Web app — use `mcp__chrome-devtools__*`    |

This skill may read vault states. **Only use it with test accounts.**

## Detailed references

Load these on demand for the specific sub-task:

- **[references/screenshot.md](references/screenshot.md)** — DOM snapshots vs. screenshots and when
  to use each.
- **[references/lock.md](references/lock.md)** — lock the vault and unlock via biometrics, PIN, or
  master password (credentials from `.debug/credentials.txt`).
- **[references/biometrics.md](references/biometrics.md)** — desktop mock biometrics: set status,
  approve/deny prompts.
- **[references/feature-flags.md](references/feature-flags.md)** — override feature flags via the
  desktop automation driver and reload the process.
- **[references/flight-recorder.md](references/flight-recorder.md)** — read SDK flight recorder
  events from the running app.
- **[references/log-buffer.md](references/log-buffer.md)** — read buffered log entries captured
  from the app's `LogService` since startup.
- **[references/create-user.md](references/create-user.md)** — register a fresh test account.
- **[references/create-organization.md](references/create-organization.md)** — create an
  organization and put it on a paid plan.
- **[references/test-payment.md](references/test-payment.md)** — test card numbers for any billing
  form.

## Always dismiss irrelevant popups

If a dialog, toast, banner, or overlay appears that is **not part of the flow you are driving**,
close it immediately and continue — do not stop, do not ask, and do not work around it. Typical
offenders: "What's new" / release-notes dialogs, update-available banners, rating or feedback
prompts, onboarding tours, cookie or notification bars, leftover toasts from a previous step.

Dismiss in this order, re-snapshotting after each attempt:

1. Click the dialog's own dismiss control — `Close`, `Got it`, `Cancel`, `Skip`, `Dismiss`, or the
   `×` button — using the `uid` from `take_snapshot`.
2. If there is no visible dismiss control, `press_key` with `Escape`.
3. For native dialogs (`alert`, `confirm`, `beforeunload`), use `handle_dialog`.

Then re-run `take_snapshot` to confirm the overlay is gone before resuming the flow. Bitwarden
dialogs are `<bit-dialog>` inside a CDK overlay, so while one is open the underlying page is
inert — clicks on elements behind it silently do nothing. If an interaction seems to have no
effect, check for an overlay first.

A popup that **is** part of the flow (a confirmation you must accept, a master-password reprompt,
an unlock dialog, a paywall) is not irrelevant — handle it, don't dismiss it. When in doubt about
whether closing a dialog loses state, screenshot it first, then close it and note it in the run
summary.

## Paywalls are not a blocker

If a flow hits a premium upsell or a plan gate, **do not stop and report the run blocked.** Clear
the paywall and carry on:

- A personal feature behind Premium (attachments, TOTP, emergency access, file Sends) → buy Premium
  from `#/settings/subscription/premium`.
- An organization feature (collections, org-owned items, policies, SSO) → create an organization on
  an Enterprise plan, per [references/create-organization.md](references/create-organization.md).

Pay with the test card in [references/test-payment.md](references/test-payment.md). On a dev or QA
server the card only has to pass front-end validation and is never charged.

Record in the run summary that the account was upgraded mid-run, and which plan it landed on — the
account state is part of the environment a later reader needs. Only report a genuine block if the
upgrade itself fails, and then say what failed.

## Step 1 — Determine target and connect

Identify which client you are working with, then confirm the DevTools endpoint is reachable.

**Desktop:**

```bash
curl -s http://localhost:9222/json/version
```

Call `mcp__electron-devtools__list_pages`. Select the renderer page (URL contains `index.html`) with
`mcp__electron-devtools__select_page` if there are multiple pages.

**Browser extension or Web:**

```bash
curl -s http://localhost:9200/json/version
```

Call `mcp__chrome-devtools__list_pages`. For the browser extension the popup appears as an
**Extension Page** entry; for the web app find the tab at the dev-server URL.

**If the endpoint is not reachable, do NOT try to launch the app yourself.** Ask the user to start
it in dev mode:

```bash
# Desktop — exposes remote debugging on port 9222 (from apps/desktop)
npm run electron

# Desktop with mock biometrics (skips the native OS prompt) — see references/biometrics.md:
USE_AUTOMATION_BIOMETRICS=1 npm run electron

# Web — start the dev server, then open it in Chrome (from apps/web)
npm run build:watch

# Browser extension — build then load the unpacked extension in Chrome (from apps/browser)
npm run build:watch
```

> The automation driver and mock biometrics are **dev-mode only** (`PlatformUtilsService.isDev()`).
> Packaged builds do not expose them.

## Step 2 — Navigate and interact

Standard MCP operations — use the correct tool prefix for the active target:

- **Snapshot / screenshot**: see [references/screenshot.md](references/screenshot.md). Snapshot to
  locate elements (`uid`s), screenshot to show state.
- **Click / fill**: `click`, `fill`, `fill_form` using `uid`s from the snapshot.
- **Wait**: `wait_for` for text to appear after navigation or transitions.
- **Console / network**: `list_console_messages`, `list_network_requests` for debugging.

The Bitwarden clients are single-page Angular apps — navigate by interacting with UI elements, not
by changing the URL directly.

If a snapshot shows an unexpected overlay blocking the page, close it first — see
[Always dismiss irrelevant popups](#always-dismiss-irrelevant-popups).

For lock/unlock flows, see [references/lock.md](references/lock.md).

## Desktop

### Automation driver

A dev-only object, `window.bitwardenAutomationDriver`, is attached to the renderer global. Call its
methods via `mcp__electron-devtools__evaluate_script` to override feature flags, send app messages,
reload the process, control biometrics, and read flight recorder events.

Defined in `libs/automation-driver/src/automation-driver.service.ts`; attached in
`apps/desktop/src/app/services/init.service.ts`.

Always guard for its presence:

```js
() => {
  const d = window.bitwardenAutomationDriver;
  if (!d) return "automation driver unavailable — app is not running in dev mode";
  // call driver methods...
};
```

Driver capabilities are documented in the references:

- **Feature flags** → [references/feature-flags.md](references/feature-flags.md)
- **Biometrics** → [references/biometrics.md](references/biometrics.md)
- **Flight recorder** → [references/flight-recorder.md](references/flight-recorder.md)
- **Log buffer** → [references/log-buffer.md](references/log-buffer.md)

### Messaging / menubar

`sendMessage(command, data?)` dispatches an app message — the same commands the native menubar
sends. `openSettings()` is a convenience wrapper:

```js
() => {
  window.bitwardenAutomationDriver.openSettings();
};
() => {
  window.bitwardenAutomationDriver.sendMessage("openSettings");
};
```

## Browser extension

The browser extension exposes pages under `chrome-extension://` in
`mcp__chrome-devtools__list_pages`. The popup appears as an **Extension Page** entry; the
background service worker appears as an **Extension Service Workers** entry.

To open the popup when it is not yet visible:

1. If no tabs are open, call `mcp__chrome-devtools__new_page` with `url: "about:blank"`.
2. Use `mcp__chrome-devtools__trigger_extension_action` with the extension ID (read from the
   `chrome-extension://` URL in the service worker entry).
3. Call `list_pages` again to find the new extension page, then `select_page` to focus it.

## Web

Navigate Chrome to the web app dev-server URL (check `apps/web` package scripts for the port —
typically `localhost:8080`). The page will appear in `mcp__chrome-devtools__list_pages` as a
regular page. Select it and interact via `mcp__chrome-devtools__*` tools.

## Notes

- Prefer `take_snapshot` over `take_screenshot` for locating elements; use screenshots to report
  visual state.
- After `reloadProcess` (desktop), re-establish the page with `list_pages` → `select_page`.
- If `bitwardenAutomationDriver` is undefined, the build is not in dev mode.
- If `.biometrics` is undefined on the driver, relaunch the desktop app with
  `USE_AUTOMATION_BIOMETRICS=1`.
