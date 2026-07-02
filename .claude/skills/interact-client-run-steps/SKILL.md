---
name: interact-client-run-steps
description: >
  Run a flow against the running Bitwarden app (desktop, browser extension, or web) against a set
  of changes. Reads relevant files and the git diff, builds a short run plan, saves it to
  .debug/automated-run/, then drives the app via the interact-client skill, taking and saving a
  screenshot after each step.
---

# interact-client-run-steps skill

Invoke this skill when you want to run a flow against changes to a Bitwarden client. The skill
reads the relevant code and git diff, generates a concise run plan focused on user-visible
behavior, then executes each step against the running app while capturing screenshots.

## Workflow

### Step 1: Determine target, generate run ID, and gather context

Identify the target client from the user's description or the diff:

- `apps/desktop/` changes → **Desktop** (Electron, `electron-devtools`, port 9222)
- `apps/browser/` changes → **Browser extension** (`chrome-devtools`, port 9200)
- `apps/web/` changes → **Web** (`chrome-devtools`, port 9200)
- `libs/` changes → use whichever client the user specifies, or ask

Generate a unique run ID in `YYYYMMDD-HHMMSS` format (e.g. `20260622-143022`).

Run `git diff --stat HEAD` to see what changed. Read the files that appear in the diff. Identify
the 3-5 most important user-visible behaviors or flows that the changes should affect.

### Step 2: Write the run plan

Create `.debug/automated-run/<run-id>/` and write `.debug/automated-run/<run-id>/run-plan.md`:

- One-line title describing what is being run
- Numbered steps, one sentence per step
- No em dashes, no bullet sub-lists
- Direct, plain language focused on observable UI behavior

Example:

```markdown
# Run: unlock with biometrics after flag change

1. Open the app and verify the login screen is shown.
2. Enable the biometrics feature flag.
3. Reload the app and confirm the biometric prompt appears.
4. Approve the biometric request and verify the vault unlocks.
```

### Step 3: Load the interact-client skill, connect, and start screencast

Invoke the `interact-client` skill now by calling the Skill tool with `skill: "interact-client"`.
This loads MCP tool conventions, automation driver patterns, and platform-specific workflows into
context.

Follow the loaded skill's Step 1 for the target client:

- **Desktop**: `mcp__electron-devtools__list_pages` — confirm app is running on port 9222.
- **Browser / Web**: `mcp__chrome-devtools__list_pages` — confirm Chrome is reachable on port 9200.

If not reachable, tell the user which command to run (see the `interact-client` skill's Step 1) and
wait for it to be ready before continuing.

Once connected, start recording:

- **Desktop**: `mcp__electron-devtools__screencast_start` with
  `filePath: ".debug/automated-run/<run-id>/screencast.mp4"`
- **Browser / Web**: `mcp__chrome-devtools__screencast_start` with the same path

### Step 4: Execute the plan with screenshots

For each numbered step in the run plan:

1. Perform the action using the `interact-client` skill's MCP tool conventions — refer to the
   loaded skill for driver method signatures, feature flag patterns, and biometrics flows.
2. Call `take_screenshot` (with the appropriate MCP prefix) after each action.
3. Save to `.debug/automated-run/<run-id>/step-N-<slug>.png` where N is the step number and slug is a
   2-3 word kebab-case description (e.g. `step-1-login-screen`, `step-2-flag-enabled`).
4. If a step fails, note it in the plan file and continue with remaining steps.

### Step 5: Dump log buffer, then stop screencast

**Log buffer** — read the automation driver's in-memory log buffer using the pattern from
`interact-client` references/log-buffer.md. Serialize the returned array to JSON and write it to
`.debug/automated-run/<run-id>/log-buffer.json` using the Write tool.

Then call `screencast_stop` to end the recording.

### Step 6: Report

Summarize pass/fail status for each step. List all artifact paths under
`.debug/automated-run/<run-id>/` (screenshots, screencast, log buffer). If any steps failed,
explain why and suggest next steps. Include the run ID so the user can reference the artifacts.

## References

- `interact-client` skill: MCP tool conventions, automation driver, feature flags, biometrics, platform routing
- `interact-client` references/log-buffer.md: reading and serializing the automation driver log buffer
- `interact-client-lock` skill: lock and unlock flows
- `libs/common/src/platform/services/automation-driver.service.ts`: automation driver definition
- `apps/desktop/src/app/services/init.service.ts`: desktop driver attachment point
