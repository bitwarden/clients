---
name: make-qa-run-plan
description: >
  Generate a QA run plan for a given feature or bug fix. Use this skill to create a structured
  testing plan that outlines the steps, expected results, and any prerequisites needed to verify
  the functionality. Test case generation is interactive: the developer is asked which proposed
  test cases to include and whether any coverage is missing before the plan is written. The output
  should be clear and actionable for QA engineers.
---

As an input take Jira ticket or description of the change. First figure out the
change type. The change types are: Bug Fix, Feature, Tech-Debt (Refactor, etc.).
Based on this generate a test plan with test cases that are to be used with the interact-client-run-steps skill.
Each test case shoud be one run that is recorded. The test cases are not chosen unilaterally — propose
them and have the developer confirm the set, see "Interactive test case selection" below.

For a bug fix, the test plan should include steps to reproduce the bug, verify the fix.

For a feature, the test plan should include steps to verify the new functionality, the edge cases that
are actually at risk, and any integration points.

For all change types, look at the touched surface and test for regressions — the ones the change can
realistically cause, not the whole surface.

To verify success, there is a few options you have:

1. UI. Based on the ui some functionality can be asserted
2. API. Some changes expect specific HTTP requsests to be made. These are recorded as part of the run, and the requests / responses can be evaluated.
3. Logs. The logs can contain specific messages that indicate success.
   The test cases should include assertion steps, that are to be run.

# Important: Information Sources!

To access confluence, use `acli`.

To figure out how the product should behave, and what to assert, use:

- The QA notes
- The Bitwarden Help Center: https://bitwarden.com/help/
- For the Data Diagnostics Tool:
- https://bitwarden.atlassian.net/wiki/spaces/CSKB/pages/2865266742/Data+Diagnostics+Recovery+Tool
  IMPORTANT: DO NOT USE THE CODE!

For figuring out how to navigate the app, you are allowed to use the code.

# Environment

For each test case, there can be environmental pre-conditions. These should be clearly stated before each test case.
Enviromental pre-conditions can include:

- Feature Flags
  - can be auto-configured via automation driver, with the interact-client skill
- Server Url
- Specific account data
  Where possible these should be auto-configured, for example via the `interact-client` skill. If this is not possible,
  record in the test plan that manual user interaction is needed.

# Keep the plan small

Fewer, higher-value test cases beat exhaustive coverage. Every test case is a recorded run that
someone has to set up, watch, and maintain, so the cost of a marginal case is real.

Target **3-6 test cases** for a typical change. Going beyond that needs a reason you can state in
one sentence (e.g. the change touches three clients, or there are genuinely distinct account
states). A bug fix is often just 2: repro-then-fixed, plus the nearest regression.

Before proposing anything, prune:

- **Merge cases that share a run.** If two assertions can be checked in the same flow without
  contorting it, they are one test case with two assertion steps — not two runs.
- **Cut cases the change cannot break.** Only test surfaces the change actually touches. Do not
  re-test the framework, the login flow, or unrelated features just because the flow passes
  through them.
- **Cut speculative edge cases.** Include an edge case only when the change plausibly mishandles
  it, not because it is enumerable. Empty/null/max-length variants are one case at most unless the
  change is specifically about input handling.
- **Cut what unit tests already cover.** These runs are for behaviour that only shows up in the
  running app.
- **Collapse per-client duplicates.** Pick the one client where the change is riskiest unless the
  change is genuinely client-specific.

If you find yourself with more than 6 candidates, rank them by how likely they are to catch a real
defect and drop the tail before showing the list.

# Interactive test case selection

Test case generation is **interactive**. Never write the plan file straight from your first draft.

1. **Draft candidates.** Produce a numbered list of candidate test cases — the pruned set from
   above, not everything you thought of. For each one show, in one or two lines: the title, what it
   covers (repro / fix verification / happy path / edge case / integration / regression), the
   environmental pre-conditions, and how success is asserted (UI / API / logs). Keep it skimmable —
   the dev is choosing, not reading a spec.
2. **Ask the dev which to include.** Use the `AskUserQuestion` tool, `multiSelect: true`, with the
   candidates as options (label = the test case title, description = coverage + assertion method).
   A question takes at most 4 options and a call at most 4 questions, so batch the candidates into
   groups of 4 and issue as many calls as needed. Group related candidates into the same question
   and give each question a short header (e.g. `Regression`, `Edge cases`).
   Do not silently drop candidates because they didn't fit into a batch.
3. **Ask what's missing.** After the selection, always ask an explicit follow-up question about
   coverage the dev wants added that you did not propose — for example offer options such as
   "Nothing missing", plus the most plausible gaps you can identify from the change. The dev can
   always answer with "Other" to describe a test case in their own words.
4. **Incorporate and re-check.** Fold in any test cases the dev described. If their answer implies
   new candidates (e.g. a whole area you had not considered), draft those, show them, and repeat
   steps 2–3 for the new ones only. Stop once the dev signals nothing is missing.
5. **Confirm before writing.** Summarize the final selected set (in order, numbered) and only then
   write the file.

Rules:

- Only the selected test cases go into the plan. Deselected candidates are dropped, not demoted to
  an "optional" section.
- If the dev's answer conflicts with something you know from the QA notes / Help Center, say so in
  one sentence and follow their decision.
- Do not add test cases of your own after the final confirmation.
- The dev cutting cases is the expected outcome. Do not argue for a dropped case or reintroduce it.

Output the final test plan in a structured format to `./debug/qa-run-plan.md`.
