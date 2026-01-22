Use this template to review a PR diff with focused, actionable feedback.

## INPUTS

- PR diff - the pull request diff to review
- (optional) PR description
- (optional) Ticket links

## INSTRUCTIONS

1. Scan the PR diff for correctness, style, security, and performance.
2. Ground comments in the project context (frameworks, languages, databases, messaging systems).
3. Prefer specific inline suggestions with minimal working patches.
4. Flag test gaps and missing docs. Propose concrete test cases.
5. Label severity: Blocker, Major, Minor, Nit.
6. Keep lines ≤80 chars.

## OUTPUT FORMAT

### Summary

- **Scope:**
- **Impact:**
- **Risk level:**

### Positives

- **Code quality wins:**
- **Good patterns:**
- **Tests/documentation:**

### Issues by Severity

#### Blockers

- [file:line] Problem → Why it matters → Fix suggestion
  ```
  // patchlet
  ```

#### Major

- ...

#### Minor

- ...

#### Nits

- ...

### Security & Compliance

- **Authentication/authorization:**
- **Input validation/injection prevention:**
- **Secrets/logging/sensitive data:**
- **Third-party integrations:**
- **Data privacy/compliance:**

### Performance

- **Hot paths:**
- **Database query optimization:**
- **Caching/TTL:**
- **Async/concurrency handling:**

### Testing Gaps

- **Unit:**
- **Integration/e2e:**
- **Property/fuzz:**
- **Load/reliability:**

### Documentation

- **Changelog:**
- **Architecture notes:**
- **README/code comments:**

### Inline Review

- [file path]
  - line X: comment
  - line Y: comment

### Review Checklist

- [ ] Builds/CI green
- [ ] Lint/format pass
- [ ] Tests updated/added
- [ ] Backward compatible
- [ ] Feature flagged
- [ ] Observability added
