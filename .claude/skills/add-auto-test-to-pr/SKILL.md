---
name: add-auto-test-to-pr
description: Publish an auto-test run (report and screenshots from a `.auto-test/<run-id>/` directory) to the current PR description as an `## Auto-Test` section. Use after running the `test-desktop-changes` skill, or when asked to add test results, screenshots, or an auto-test report to a PR.
user-invocable: true
---

# Add Auto-Test Results to the PR

Take the captured run from a `.auto-test/<run-id>/` directory (produced by the
`test-desktop-changes` skill) and append it to the current PR description as an `## Auto-Test`
section.

## Input

A `.auto-test/<run-id>/` directory containing:

- `plan.md` — the proposed/performed steps.
- `report.md` — per-change intent, observation, pass/fail.
- screenshots (`.png`) captured after each step.

If no run-id is given, use the most recent directory under `.auto-test/`.

## Step 1 — Upload every screenshot

Upload **all** screenshots in the run directory (not just one) so they render in GitHub, preserving
their capture order. The reliable path is to attach each image to a throwaway issue comment via the
API and reuse the returned asset URL, or commit the PNGs into the branch and reference their raw
URLs. Keep a map of `screenshot file -> uploaded URL` for the next step.

## Step 2 — Build the section

Assemble an `## Auto-Test` section from `plan.md` / `report.md` and the uploaded URLs. Keep it terse
(short bullet steps, no em dashes, no filler prose) but well structured:

- A short status line up top (pass/fail summary).
- A `Steps performed` bullet list.
- Each screenshot under a `<details>` block in capture order, captioned with its step, so the
  section stays collapsed by default and does not flood the PR body.

## Step 3 — Update the PR body

Fetch the current PR body, append the section, and update it:

```bash
gh pr view --json body -q .body > /tmp/pr-body.md
# append the section to /tmp/pr-body.md, then:
gh pr edit --body-file /tmp/pr-body.md
```

The appended section should look like:

```markdown
## Auto-Test

**Result:** ✅ 3/3 changes verified

**Steps performed**

1. Open Settings dialog
2. Navigate to Account section
3. Toggle the changed setting

<details>
<summary>Screenshots</summary>

**1. Settings dialog**

![Settings dialog](https://.../01-settings.png)

**2. Account section**

![Account section](https://.../02-account.png)

**3. Setting toggled**

![Setting toggled](https://.../03-toggle.png)

</details>
```
