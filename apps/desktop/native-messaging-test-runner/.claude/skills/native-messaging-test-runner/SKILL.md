---
name: native-messaging-test-runner
description: Use when the user wants to exercise the desktop app's native messaging IPC locally — testing DuckDuckGo browser integration changes, running handshake/status/create/update/retrieve/generate commands against a local desktop instance, or debugging native-messaging behavior. Triggered by "run the native messaging test runner", "test DDG integration", "test native messaging", or invoking commands like `npm run handshake` in `apps/desktop/native-messaging-test-runner`.
---

# Native Messaging Test Runner

Drives the desktop client's native messaging IPC from a local Node process. Used to validate DuckDuckGo browser integration changes without needing the DuckDuckGo browser itself.

Reference: https://contributing.bitwarden.com/getting-started/clients/desktop/native-messaging-test-runner

## Fix scope — edits stay inside the runner folder

Any code change made to fix or modify the runner — bug fixes, dependency bumps, tsconfig tweaks, source edits — must stay inside `apps/desktop/native-messaging-test-runner/`. Specifically, do not edit:

- Files under `apps/desktop/src/`, including `apps/desktop/src/models/native-messaging/*.ts`. The runner imports those for shared message-shape types via relative paths, but the desktop app owns them — modifying them changes the main desktop build's surface area.
- Files under `libs/`. The runner consumes them as prebuilt `dist/libs/...` via the `_moduleAliases` block in its `package.json`; lib code is owned by other teams.
- Root-level `package.json`, `tsconfig.base.json`, or any other repo-wide config.

If a runner fix appears to require touching any of those, stop and surface the constraint to the user before continuing. Do not silently expand scope — runner fixes that bleed into the desktop app's build affect every contributor, not just whoever's testing native messaging today. The runner's `package.json`, `tsconfig.json`, `src/`, and `dist/` are the only places where fixes should land.

## Step 1 — Preflight checks

Before running any command, confirm the environment is ready. Run these checks in order and stop at the first failure.

### 1a. Desktop client must be running locally

The runner talks to the running desktop process over an IPC socket. If the app isn't running, every command will hang or time out.

Check for a running desktop dev build. The dev build runs as `Electron` (not `Bitwarden`) from the repo's `node_modules`, so match on the install path:

```bash
pgrep -fl "node_modules/electron/dist/Electron" | grep -v grep
```

If nothing is returned, tell the user:

> The desktop app doesn't appear to be running locally. Start it from the repo root (see https://contributing.bitwarden.com/getting-started/clients/desktop/) before running test-runner commands. The runner connects to the local desktop instance over native messaging — if the app isn't running, commands will hang.

Do not attempt to start the desktop app on the user's behalf — it's a long-running dev process they manage themselves.

### 1b. DuckDuckGo integration must be enabled in Preferences

There is no programmatic check for this — it's a setting inside the running app. Remind the user:

> In the running desktop app, open **Preferences** and confirm **Allow DuckDuckGo browser integration** is enabled. Without it, the handshake will fail.

### 1c. Runner dependencies installed

From `apps/desktop/native-messaging-test-runner`:

```bash
npm ci
```

Safe to run every time — it's a no-op if already in sync.

## Step 2 — Approval prompt warning

**Critical:** every command triggers a prompt in the desktop app that the user must accept manually. Before invoking any command, tell the user:

> Watch the desktop app window — each command will trigger an approval prompt that you need to accept. The command will hang until you do.

If a command appears to hang, the first thing to ask is whether they accepted the prompt.

## Step 3 — Run the command

All commands run from `apps/desktop/native-messaging-test-runner`. Arguments require `--` before flags so npm passes them through.

| Command     | Purpose                                                                            | Example                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `handshake` | Establish native messaging connection. **Run this first** as a connectivity check. | `npm run handshake`                                                                                      |
| `status`    | List configured accounts                                                           | `npm run status`                                                                                         |
| `create`    | Create a new login                                                                 | `npm run create -- --name NewLoginFromTestRunner`                                                        |
| `update`    | Update an existing credential                                                      | `npm run update -- --name Updated --username user --password pw --uri example.com --credentialId <uuid>` |
| `retrieve`  | Find credentials by URI                                                            | `npm run retrieve -- --uri google.com`                                                                   |
| `generate`  | Generate a password                                                                | `npm run generate -- --userId <uuid>`                                                                    |

Always run `handshake` first when starting a new testing session — it surfaces connection problems with a single, simple command instead of failing inside a more complex flow.

## Step 4 — If something goes wrong

If a command hangs or times out and the user confirms they accepted the prompt (or no prompt appeared):

1. Quit the desktop app.
2. Delete the `dist` folder inside `apps/desktop/native-messaging-test-runner`.
3. Restart the desktop app.
4. Re-run `npm ci` in the runner directory.
5. Retry `npm run handshake` before anything else.

If a custom command added by the user fails with `MODULE_NOT_FOUND`, the entry file is missing `import "module-alias/register";` at the top.
