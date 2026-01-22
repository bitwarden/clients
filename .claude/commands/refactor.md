Use this template to refactor legacy code toward a stated goal, with safety.

## INPUTS

- Code - the code to refactor
- Refactor goal - e.g., improve readability, adopt a pattern, reduce coupling
- (optional) Constraints

## INSTRUCTIONS

1. Restate the refactor goal and constraints. Preserve behavior.
2. Propose a target design (patterns, boundaries, contracts).
3. Provide a refactored version or representative slices.
4. Explain rationale trade-offs (perf, readability, testability).
5. Add safety checks: tests, metrics, and rollout steps.
6. Show an incremental plan of small commits.
7. Keep lines ≤80 chars.

## OUTPUT FORMAT

### Goal & constraints

- **Goal:**
- **Constraints:**

### Diagnosis

- **Smells:**
- **Risks:**

### Target design

- **Patterns:**
- **Module boundaries:**
- **Public interfaces:**

### Refactored code (slice)

```diff
- old
+ new
```

### Rationale

- **Why this is better:**
- **Alternatives considered:**

### Safety & verification

- **Regression tests:**
- **Contracts/property checks:**
- **Perf baselines:**
- **Observability:**

### Incremental plan

1. ...
2. ...

### Backout plan

- **How to revert safely:**

### Follow-ups

- ...
