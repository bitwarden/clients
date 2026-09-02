---
name: interact-client
description: >
  Drive and interact with the running Bitwarden app — desktop (Electron), browser extension, or
  web — via the Chrome DevTools protocol. Use when asked to navigate, click, fill UI, screenshot,
  lock/unlock the vault, toggle feature flags, mock biometrics, or automate flows. Requires the
  target app to already be running.
---

# Interact Client

All of the interaction knowledge lives in the **`client-driver` agent** — connection, popup
handling, paywalls, lock/unlock, feature flags, biometrics, and the desktop automation driver.
Do **not** drive the app yourself: every `take_snapshot` returns a full accessibility tree, and
running a flow inline burns your context on output nobody reads twice.

Spawn the agent instead. It keeps snapshots, console dumps, and HAR data in its own context and
returns a short report.

```
Agent({
  subagent_type: "client-driver",
  description: "Unlock vault with PIN",
  prompt: "Target: desktop (Electron, port 9222).
           Steps:
           1. Lock the vault.
           2. Unlock with the PIN from .debug/credentials.txt.
           3. Confirm the vault list is shown.
           Report whether unlock succeeded and any console errors."
})
```

The prompt only needs the target client, numbered steps, and what to report back. For a flow the
agent should run repeatedly or capture artifacts for, give it a run directory under
`.debug/automated-run/<run-id>/`.

Before spawning, confirm the app is running — the agent cannot start it:

```bash
curl -s http://localhost:9222/json/version   # desktop
curl -s http://localhost:9200/json/version   # browser extension / web
```

If the endpoint is unreachable, ask the user to start the app in dev mode (`npm run electron` from
`apps/desktop`, or `npm run build:watch` from `apps/web` / `apps/browser`) and wait.

This reads vault state. **Only use it with test accounts.**
