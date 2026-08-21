---
name: add-run-result-to-jira
description: >
  Attach a packaged automated run (produced by package-automated-run) to a Jira ticket as a
  comment via the `acli` Atlassian CLI. Use when asked to post a run to Jira, link a test result
  to a ticket, or "attach that run/video to PM-XXXXX".
---

# add-run-result-to-jira skill

Input: a run directory that has already been packaged, i.e. `.debug/automated-run/<run-id>/package/`
exists (containing `README.txt`, `captions.txt`, `<run-id>.mp4`), and a Jira ticket key.

Output: a comment on the ticket summarizing the result, plus the run's zip attached to the ticket
if `acli` can attach it — it currently cannot upload files, so the fallback is to say so plainly
and tell the user where the zip is.

## Step 0 — Preconditions

- If the run has no `package/` folder, or the package has no `README.txt`, run the
  `package-automated-run` skill first (or ask the user to). Do not synthesize a report from raw
  screenshots — this skill only ships what packaging already produced.
- If there is no `<run-id>.zip` next to `package/`, tell the user it is missing and stop; the zip
  is what a reader downloads to see the full artifact set.
- Confirm the Jira ticket key with the user if it was not given explicitly. Never guess a ticket
  from branch name or commit message without confirming.

## Step 1 — Check `acli` auth and attachment support

```bash
acli jira workitem attachment --help
```

As of `acli` 1.3.x there is no `attachment upload`/`create` subcommand — only `list` and `delete`.
Check this each run rather than trusting this note, since the CLI may add upload support later:

```bash
acli jira workitem attachment --help 2>&1 | grep -iE 'upload|create|add'
```

- **If an upload/create subcommand exists**, use it to attach `<run-id>.zip` to the ticket, then
  skip the "attach manually" note in Step 3.
- **If not** (the current, expected case), the comment must say the zip could not be uploaded by
  the CLI and give its path so a human can drag it into the ticket, or upload it via
  `acli jira workitem attachment` once support lands, or via the Jira web UI.

## Step 2 — Build the comment body

Read `<run-dir>/package/README.txt`. Turn its `WHAT WAS TESTED`, `RESULT`, and `ENVIRONMENT`
sections into the comment — do not invent content beyond what README.txt and the run artifacts
already established (see `package-automated-run`'s grounding rule, which this skill inherits).

Write the comment to a temp file (comments with more than a couple of lines are unreliable via
`--body` shell-escaping):

```
Automated run: <run-id>

RESULT: PASS | FAIL | PARTIAL (n of m checks passed)
<one-line reason if not a clean pass>

WHAT WAS TESTED
<2-4 sentences from README.txt>

ENVIRONMENT
Client:        ...
Server URL:    ...
Account:       ...
Feature flags: ...
Build:         ...

ARTIFACTS
Full package (video, screenshots, run plan): <run-dir>/package/<run-id>.zip
<< only if acli cannot upload >> Not attached automatically — acli has no attachment-upload
command as of this run. Attach the zip above manually, or ask a maintainer to re-check
`acli jira workitem attachment --help` for upload support.
```

Keep it plain text (Jira renders `acli` comment bodies as plain text/ADF, not markdown — no `#`
headers or `**bold**`).

## Step 3 — Post the comment

```bash
acli jira workitem comment create --key "<TICKET-KEY>" --body-file "<tmpfile>"
```

Confirm success from the command's output (it returns the created comment's id/link). If `acli`
reports an auth error, tell the user to run `acli jira auth login` themselves — do not attempt to
handle credentials or tokens on their behalf.

If Step 1 found real upload support, attach the zip in the same step (per that subcommand's
flags) before or after the comment, and confirm the attachment shows up via
`acli jira workitem attachment list --key "<TICKET-KEY>"`.

## Step 4 — Report

Tell the user: the ticket key, a link (`https://<site>.atlassian.net/browse/<TICKET-KEY>`) if the
site is known, whether the zip was attached automatically or needs manual upload, and the
one-line RESULT. Do not re-paste the whole comment body if it was already shown while packaging.

## References

- `package-automated-run` skill: produces the `package/` folder and zip this skill posts
- `acli jira workitem comment --help`, `acli jira workitem attachment --help`
