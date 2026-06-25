---
name: interact-client
description: >
  Drive and interact with the running Bitwarden app — desktop (Electron), browser extension, or
  web — via the Chrome DevTools protocol. Use when asked to navigate, screenshot, click, fill UI,
  toggle feature flags, or automate flows. Requires the target app to already be running.
---

# Interact Client

Drive the **already-running** Bitwarden app for debugging and automation.

Two MCP servers are wired in `.mcp.json` — pick the right one for your target:

| MCP server          | Port | Targets                                                       |
| ------------------- | ---- | ------------------------------------------------------------- |
| `electron-devtools` | 9222 | Desktop (Electron renderer) — use `mcp__electron-devtools__*` |
| `chrome-devtools`   | 9200 | Browser extension, Web app — use `mcp__chrome-devtools__*`    |

This skill may read vault states. **Only use it with test accounts.**

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

# Desktop with mock biometrics (skips the native OS prompt):
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

- **Snapshot the DOM** (preferred for locating elements): `take_snapshot` — returns an
  accessibility tree with element `uid`s used by interaction tools.
- **Screenshot**: `take_screenshot` (add `fullPage: true` for the full window). Use whenever the
  user asks to "see" or "show" the current state.
- **Click / fill**: `click`, `fill`, `fill_form` using `uid`s from the snapshot.
- **Wait**: `wait_for` for text to appear after navigation or transitions.
- **Console / network**: `list_console_messages`, `list_network_requests` for debugging.

The Bitwarden clients are single-page Angular apps — navigate by interacting with UI elements, not
by changing the URL directly.

## Desktop

### Automation driver

A dev-only object, `window.bitwardenAutomationDriver`, is attached to the renderer global. Call its
methods via `mcp__electron-devtools__evaluate_script` to override feature flags, send app messages,
reload the process, and control biometrics.

Defined in `libs/common/src/platform/services/automation-driver.service.ts`; attached in
`apps/desktop/src/app/services/init.service.ts`.

Always guard for its presence:

```js
() => {
  const d = window.bitwardenAutomationDriver;
  if (!d) return "automation driver unavailable — app is not running in dev mode";
  // call driver methods...
};
```

### Feature flags

Flag keys are the string values of the `FeatureFlag` enum in
`libs/common/src/enums/feature-flag.enum.ts` — **not** the enum member name. Read the enum to get
the exact key before toggling.

```js
async () => {
  await window.bitwardenAutomationDriver.setFeatureFlag("windows-desktop-autotype", true);
};
async () => window.bitwardenAutomationDriver.getFeatureFlag("windows-desktop-autotype");
async () => {
  await window.bitwardenAutomationDriver.clearFeatureFlag("windows-desktop-autotype");
};
async () => {
  await window.bitwardenAutomationDriver.clearAllFeatureFlagOverrides();
};
```

Overrides persist in global state. Many flags are only read at startup — after changing a flag,
reload the process:

```js
async () => {
  await window.bitwardenAutomationDriver.reloadProcess();
};
```

After `reloadProcess`, call `mcp__electron-devtools__list_pages` → `select_page` before further
interaction.

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

### Biometrics

Only present when the app was launched with `USE_AUTOMATION_BIOMETRICS=1` (see Step 1). Replaces
the OS biometric prompt with a fake service so prompts can be approved or denied deterministically.
Access via `window.bitwardenAutomationDriver.biometrics` (undefined if the env var was not set).

**Set the reported status** (from `BiometricsStatus` in
`libs/key-management/src/biometrics/biometrics-status.ts`):

| Value | Status                | Meaning                             |
| ----- | --------------------- | ----------------------------------- |
| 0     | `Available`           | Biometric unlock available          |
| 1     | `UnlockNeeded`        | Password must unlock user key first |
| 2     | `HardwareUnavailable` | No biometric hardware               |
| 5     | `PlatformUnsupported` | Not implemented for this platform   |

```js
async () => {
  await window.bitwardenAutomationDriver.biometrics.setStatus(0);
};
```

**Approve / deny prompts:**

```js
// list queued requests — [{ id, type: "authenticate" | "unlock", userId? }, ...]
async () => window.bitwardenAutomationDriver.biometrics.listPending();

// approve / deny by id, or omit id to resolve the oldest pending request
async () => {
  await window.bitwardenAutomationDriver.biometrics.approve("1");
};
async () => {
  await window.bitwardenAutomationDriver.biometrics.deny();
};
```

Typical biometric-unlock flow:

1. `setStatus(0)` — report biometrics as available.
2. Click the biometric unlock button via `mcp__electron-devtools__click`.
3. `listPending()` — confirm a request is queued.
4. `approve(id)` or `deny(id)` — simulate the user's response.
5. Screenshot to verify the result.

> Mock biometrics keys are held in memory only — they do not survive a process reload.

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

## Unlock

For lock/unlock flows, invoke the `interact-client-lock` skill. Credentials (PIN, password) are
read from `.debug/credentials.txt`.

## Notes

- Prefer `take_snapshot` over `take_screenshot` for locating elements; use screenshots to report
  visual state.
- After `reloadProcess` (desktop), re-establish the page with `list_pages` → `select_page`.
- If `bitwardenAutomationDriver` is undefined, the build is not in dev mode.
- If `.biometrics` is undefined on the driver, relaunch the desktop app with
  `USE_AUTOMATION_BIOMETRICS=1`.
