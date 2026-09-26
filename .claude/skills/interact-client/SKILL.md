---
name: interact-client
description: >
  Drive and interact with the running Bitwarden app — desktop (Electron), browser extension, or
  web — via the Chrome DevTools protocol. Use when asked to navigate, click, fill UI, screenshot,
  lock/unlock the vault, toggle feature flags, mock biometrics, or automate flows. Requires the
  target app to already be running. This should only be used with test accounts and may leak
  sensitive data to the agent.
---

# Interact Client

Interaction happens via the **`client-driver` agent**. Do **not** drive the app yourself
to prevent context bloat. Instead, spawn a `client-driver` agent, which acts, and returns
a report of what happened.

Example:

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

Always pass the target client to the agent. If you are unsure which client to use,
ask the user.

Before spawning, confirm the app is running — the agent cannot start it:

```bash
curl -s http://localhost:9222/json/version   # desktop
curl -s http://localhost:9200/json/version   # browser extension / web
```

If the endpoint is unreachable, ask the user to start the target and wait:

- **Desktop** — `npm run electron` from `apps/desktop`; its start script already passes
  `--remote-debugging-port=9222`.
- **Web / browser extension** — two steps. `npm run build:watch` from `apps/web` / `apps/browser`
  only produces a build; nothing in the repo opens a debuggable Chrome, so port 9200 stays dead
  until they also launch one:
  `google-chrome --remote-debugging-port=9200 --user-data-dir=/tmp/bw-debug-profile`. For the
  extension, load the unpacked extension from `apps/browser/build` in that Chrome instance.
