---
name: package-automated-run
description: >
  Turn a finished automated run (.debug/automated-run/<run-id>/) into a presentable package for
  sharing with QA, PM, or a reviewer: a short plain-text report of what was tested, the pass/fail
  result, the environment it ran against (feature flags, server URL, account), and an MP4 of the
  step screenshots with burned-in subtitles describing each check. Use when asked to package,
  publish, or share a run, or to "make a video of that run".
---

# package-automated-run skill

Input: a run directory produced by the `interact-client-run-steps` skill, containing
`run-plan.md`, `step-N-<slug>.png` screenshots, and usually `summary.md`.

Output: a `package/` subfolder inside that run directory holding a `README.txt`, a `captions.txt`,
and an MP4 whose subtitles say, in plain language, what each frame verifies.

Everything in the package must be grounded in the run artifacts or in the still-running app. Do
not infer a result, a flag value, or an account from the code or from the plan's intent — if a
fact was not recorded and cannot be checked, write `not recorded` and say so to the user.

## Step 1 — Pick the run and read it

Use the run directory the user names. With no argument, take the newest:

```bash
ls -1dt .debug/automated-run/*/ | head -1
```

Read `run-plan.md` and `summary.md`, then list the screenshots in the order the video will use
them:

```bash
find <run-dir> -maxdepth 1 -name 'step-*.png' | sort -t- -k2 -n
```

Screenshot numbers are often **not contiguous** (a step can fail or produce no frame), so captions
map one-to-one onto this file list, not onto the plan's step numbers. Count the files now.

If the run has no `summary.md`, or the summary has no per-step results, view the screenshots
yourself with the Read tool and base the result on what they show.

## Step 2 — Collect the environment facts

Gather, in this order of preference: the run's `summary.md`, other run artifacts (saved logs,
network captures, the screenshots themselves), then the running app.

- **Feature flags** — the flags the run set, plus their values. The run plan and summary record
  what was toggled. To confirm a value against the still-running app, use the
  `interact-client` skill's driver call `getFeatureFlag("<flag-key>")`. Report overrides
  explicitly, e.g. `pm-12345-example = true (override)`; a flag left alone is not worth listing.
- **Server URL** — the environment the client pointed at (e.g. `https://localhost:8080`,
  `https://vault.qa.bitwarden.pw`). For web this is visible in the page URL; for desktop and the
  extension it is on the login screen or in the account menu.
- **Account** — the email or user id used, and anything about its state that mattered to the test
  (org membership, seeded items, unlock method). `.debug/credentials.txt` names the test accounts;
  never copy a password into the package.
- **Build** — branch and short commit the run exercised: `git rev-parse --short HEAD` and
  `git branch --show-current`. Note if the tree was dirty at run time.

## Step 3 — Write the captions

Write `<run-dir>/package/captions.txt`: one line per screenshot, in the file order from Step 1.

A caption says **what is being verified**, in the reader's language. It is not the step name, not
the filename, not a test case ID:

- Good: `Unlocking with biometrics opens the vault without a master password prompt`
- Bad: `step-4-vault-unlocked`, `Test case 2, step 4`, `Click the unlock button`

Rules:

- Present tense, one clause, roughly 40-80 characters. It is burned across the bottom of the frame.
- Describe the observable outcome, not the mechanics of the automation.
- For a frame that shows a failure, say what is wrong: `Diagnostics report no old attachments (expected one)`.
- Blank lines and `#` comments are ignored; leading `1.` numbering is stripped; a literal `\n`
  splits a caption over two lines. Use two lines only when one genuinely will not fit.

## Step 4 — Build the video

```bash
.claude/skills/interact-client-run-steps/scripts/steps-to-video.sh <run-dir> \
  -c <run-dir>/package/captions.txt \
  -o <run-dir>/package/<run-id>.mp4
```

The script errors out and lists the screenshots if the caption count does not match — fix
`captions.txt` rather than the frame list. Useful options: `-d SECONDS` per frame (default 5; use
6-8 when captions are long), `-H` for height, `-s` for a soft subtitle track if the local ffmpeg
has no libass.

Verify the burn-in before reporting done — extract a frame and look at it:

```bash
ffmpeg -y -loglevel error -ss 2 -i <run-dir>/package/<run-id>.mp4 -frames:v 1 /tmp/frame.png
```

Read `/tmp/frame.png` and confirm the caption is legible and matches the frame.

## Step 5 — Write README.txt

Write `<run-dir>/package/README.txt` as plain text — no markdown, no tables:

```
QA Run — <short title of what was tested>
=========================================

WHAT WAS TESTED
---------------
Two to four sentences: the change under test, the flow that was driven, and what
counted as success. Written for someone who has not read the ticket.

RESULT
------
PASS | FAIL | PARTIAL (n of m checks passed)
One or two lines on why, only when it is not a clean pass. Name the check that
failed and what was observed instead. If the failure is a known gap or an unmet
pre-condition rather than a defect, say which.

ENVIRONMENT
-----------
Client:        Web (Chrome), Desktop (Electron), or Browser extension
Server URL:    https://localhost:8080
Account:       qa-user-1@example.com (user id 30b6ee42…), unlocked with master password
Feature flags: pm-12345-example = true (override)
Build:         driver-skills @ bb291e5
Run:           <run-id>, 2026-08-21

FILES
-----
<run-id>.mp4   recorded run, subtitles describe what each frame verifies
captions.txt   subtitle text used for the video
```

Keep it short — the whole file should fit on one screen. Add a `NOTES` section only if there is
something the reader must know to interpret the video (a manual pre-condition, a step performed
off-camera, a flaky retry).

Copy in a supporting artifact only when the result references it (a saved diagnostics log, a
network capture) and list it under `FILES`. Do not copy the screenshots or the raw screencast —
the MP4 replaces them.

## Step 6 — Zip the package

Bundle the full set of run artifacts — screenshots, screencast (if any), `run-plan.md`,
`summary.md`, and the `package/` folder itself (README, captions, MP4) — into a single zip placed
in the run directory, alongside `package/`, not inside it:

```bash
(cd <run-dir> && zip -r "<run-id>.zip" . -x '*.DS_Store')
```

This zip is the one artifact meant for sharing outside the repo (Slack, a ticket attachment), so it
should be self-contained: someone who only has the zip must be able to see every screenshot, the
run plan, and the finished video without access to the repo.

Report the zip's path and size (`du -h <run-dir>/<run-id>.zip`) alongside the rest of Step 7.

## Step 7 — Report

Tell the user the package path, the zip path, the one-line result, and the video duration
(`frames x seconds`). Paste the `RESULT` section into chat so they do not have to open the file.

## References

- `interact-client-run-steps` skill: produces the run directory this skill packages
- `.claude/skills/interact-client-run-steps/scripts/steps-to-video.sh`: video builder, `-h` for options
- `interact-client` skill: driver calls for confirming feature flags against the running app
