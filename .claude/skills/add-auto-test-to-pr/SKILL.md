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

## Step 1 — Build the section

Add an `## Auto-Test` section with a brief list of the steps performed (from `plan.md` /
`report.md`) and the screenshot(s). Keep it terse: no em dashes, no prose, just short bullet steps.

## Step 2 — Upload screenshots

Upload each screenshot so it renders in GitHub. The reliable path is to attach the image to a
throwaway issue comment via the API and reuse the returned asset URL, or commit the PNG into the
branch and reference its raw URL. Embed with `![](url)`.

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

Steps performed:

- Open Settings dialog
- Navigate to Account section
- Toggle the changed setting

![](https://.../screenshot.png)
```
