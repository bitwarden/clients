---
name: debug-feature
description: >
  Debug a feature or bug in the running Bitwarden app (desktop, browser extension, or web). Reads
  the current PR diff or input text to understand what to investigate, builds a debug plan, spawns
  a subagent to run a data-gathering flow via run-flow, evaluates the evidence, applies a fix, then
  re-runs to verify. Loops until the issue is resolved or cannot be reproduced.
---

# debug-feature skill

Invoke this skill when asked to debug a feature or investigate a bug in a Bitwarden client. It
orchestrates a gather → evaluate → fix → verify loop using subagents so the main context stays
clean between iterations.

## Workflow

### Step 1: Identify the target client and what to debug

Determine which client is involved from the user's description or the diff:

- `apps/desktop/` → **Desktop** (Electron, port 9222)
- `apps/browser/` → **Browser extension** (Chrome, port 9200)
- `apps/web/` → **Web** (Chrome, port 9200)
- `libs/` only → ask the user which client to run against

Verify the DevTools endpoint is reachable before proceeding:

```bash
# Desktop
curl -s http://localhost:9222/json/version

# Browser / Web
curl -s http://localhost:9200/json/version
```

If not reachable, ask the user to start the app (see the `run` skill's Step 1) and wait. Do not
proceed until the endpoint responds.

If no description was provided, gather context from the branch:

```bash
git diff HEAD~1..HEAD --stat
git diff HEAD~1..HEAD
gh pr view --json title,body    # if a PR exists
```

Read the changed files. Identify:

- **Expected behavior** — what should happen?
- **Suspected failure** — what observation or error points to a problem?
- **Affected surface** — which UI flow, feature flag, or code path is involved?

### Step 2: Build a debug plan

Write a concise debug plan (keep it in memory, not on disk) with:

- One-line hypothesis: what you think is broken and why
- 3-5 gathering steps focused on observable evidence: UI state, console errors, network calls,
  feature flag values, automation driver state
- What a passing outcome looks like vs. a failing one

### Step 3: Run the gathering flow (subagent)

Spawn a subagent using the Agent tool to execute the gathering flow. Use `model: "sonnet"` and
include the full debug plan, the target client, and the run directory path in the prompt so the
subagent is self-contained.

The subagent must:

1. Invoke the `run-flow` skill (via the Skill tool) with the debug plan as its run plan
2. Execute each step, capture screenshots and console output
3. Return a structured evidence report: steps passed/failed, console errors, unexpected UI states

Example Agent call:

```
Agent({
  description: "Gather debug evidence for <feature>",
  model: "sonnet",
  prompt: "You are a debugging subagent for the Bitwarden <desktop|browser|web> client.
           Target: <desktop (port 9222) | browser extension (port 9200) | web (port 9200)>
           Invoke the run-flow skill with the following run plan:
           <run plan from Step 2>
           After the flow completes, return a concise evidence report:
           - Steps that passed / failed
           - Console errors observed
           - Unexpected UI states
           - Feature flag values read
           - Reproduction steps that reliably trigger the issue"
})
```

### Step 4: Evaluate the evidence

Read the evidence report. Determine:

- **Reproduced**: the failure was observed — proceed to Step 5
- **Not reproduced**: the flow passed — report back to the user with the artifact paths and note
  that no issue was observed under the tested conditions
- **Inconclusive**: missing data or a setup problem — revise the debug plan and loop back to Step 3
  with a more targeted flow

### Step 5: Propose and apply a fix

Identify the root cause in the source code.

**First, write a proposed fix to `.debug/automated-run/<run-id>/proposed-fix.md`** before touching any
source files:

```markdown
## Fix

<minimal diff or pseudocode showing exactly what changes>

## Why this fixes it

<one or two sentences: root cause and how the change addresses it>
```

Then apply the change to the relevant TypeScript/Angular source files. Do not introduce unrelated
changes. If the fix requires a feature flag change, note it explicitly.

After editing, run `npm run test:types` to catch type errors before re-running.

### Step 6: Verify the fix (subagent)

Spawn a second subagent to re-run the same flow against the patched code:

```
Agent({
  description: "Verify fix for <feature>",
  model: "sonnet",
  prompt: "You are a verification subagent for the Bitwarden <desktop|browser|web> client.
           Target: <desktop (port 9222) | browser extension (port 9200) | web (port 9200)>
           The following fix was applied: <summary of the change>
           Re-run the run-flow skill with this plan:
           <same run plan>
           Confirm whether the previously-failing steps now pass.
           Return: pass/fail per step, any new failures introduced."
})
```

### Step 7: Assess, loop, and unapply

- **All steps pass** → unapply the fix (`git restore` the edited source files), then report to the
  user: what was wrong, the path to `proposed-fix.md`, and the run artifact paths. The
  proposed-fix markdown is the deliverable; the user applies it when ready.
- **Original issue persists** → re-examine the evidence, refine the hypothesis, overwrite
  `proposed-fix.md`, update the source files, and loop back to Step 6. Cap at 3 fix attempts
  before escalating to the user with findings.
- **New failures introduced** → revert the fix (`git restore`), report the regression, and ask for
  guidance before continuing.

## Notes

- Keep each subagent prompt self-contained: include the run plan, target client, and port in the
  prompt since subagents start with no prior conversation history.
- The `run-flow` skill writes artifacts to `.debug/automated-run/<run-id>/`. Include the run ID in your
  reports so the user can inspect screenshots and logs.
- Verify the DevTools endpoint before spawning any subagent — if not reachable, ask the user to
  start the app first.

## References

- `run-flow` skill: orchestrates a full run — plan, connect, execute, capture, report
- `run` skill: MCP tool conventions, automation driver, feature flags, biometrics, platform routing
- `libs/common/src/platform/services/automation-driver.service.ts`: automation driver definition
- `apps/desktop/src/app/services/init.service.ts`: desktop driver attachment point
