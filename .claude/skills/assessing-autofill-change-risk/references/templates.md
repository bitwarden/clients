# Templates

## Evidence (`evidence.md`)

One row per factor, gate and mitigation. The rows below are examples. Leave out the level and requirement, which come from the rubric in Step 3.

```markdown
# Evidence - PR <pr> at <headRefOid>

Fork: <yes/no>. Changed: <n> files, +<a>/-<d>. Widened scope: <files and why>.
Caller evidence: <"caller reports ..." or "none">.

## Baseline factors

| id              | answer | evidence                                                                                                                   |
| --------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| core-paths      | no     | `apps/browser/src/autofill/content/autofill-init.ts:40-61` changes field collection only, no credential or secret handling |
| escalation-list | no     | changed paths are not on the escalation list                                                                               |

## Gates

| id                 | passed | evidence              |
| ------------------ | ------ | --------------------- |
| dependencies-clean | true   | no dependency changes |

## Mitigations

| id               | present | evidence                                                                 |
| ---------------- | ------- | ------------------------------------------------------------------------ |
| exposure-control | false   | no feature flag. Reviewer should confirm it is safe to ship to all users |

## Autofill factors

| id                          | answer  | evidence                                                                                                                         | source                                              |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| content-script-dependencies | unknown | `content/autofill-init.ts:3` adds an import of `@bitwarden/common/...`, and that module imports an index file I could not follow | principles.md, "Every dependency is attack surface" |
```

## Assessment (`assessment.md`)

The JSON keeps the marketplace skill's shape and adds `autofill_factors` and `needs_team_decision`, so the two skills can merge later.

```json
{
  "point": "change",
  "scope": "<pr> at <headRefOid>",
  "level": "medium",
  "factors": [{ "id": "core-paths", "answer": "no", "evidence": "..." }],
  "gates": [{ "id": "no-secrets", "passed": true, "evidence": "..." }],
  "mitigations": [{ "id": "rollback", "present": true, "evidence": "..." }],
  "autofill_factors": [
    { "id": "content-script-dependencies", "answer": "unknown", "evidence": "...", "source": "..." }
  ],
  "needs_team_decision": ["content-script-dependencies"],
  "recommended_criteria": [],
  "recommended_tag": "<label or null>",
  "review_areas": [{ "path": "apps/browser/src/autofill/content/autofill-init.ts", "why": "..." }],
  "summary": "One or two sentences a reviewer reads first. Says 'provisional' when needs_team_decision is not empty.",
  "review": {
    "requirement": "partial",
    "why": ["risk medium", "external contribution"],
    "areas": [{ "path": "...", "why": "..." }]
  }
}
```

After the JSON, three to five plain sentences: the level and requirement, which rules raised it, where to look, and which factors need a team decision.
