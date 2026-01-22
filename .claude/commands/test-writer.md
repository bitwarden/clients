Use this template to generate thorough tests for a function or module.

## INPUTS

- Code - the code to write tests for
- (optional) Behavior spec
- (optional) Test tech - frameworks, runners

## INSTRUCTIONS

1. Identify inputs, outputs, and invariants. Derive test matrix.
2. Cover happy path, edge cases, and failure modes.
3. Include unit and integration tests matching the project's testing stack.
4. Provide fixtures, mocks, and stubs with minimal boilerplate.
5. Add property/fuzz tests for parsers and validators.
6. Include performance and concurrency probes if relevant.
7. Ensure tests are deterministic and parallel-safe.
8. Keep lines ≤80 chars.

## OUTPUT FORMAT

### Scope

- **Subject:**
- **Responsibilities:**

### Test matrix

| Case | Inputs | Setup | Expected |
| ---- | ------ | ----- | -------- |
| 1    | ...    | ...   | ...      |

### Unit tests (sketches)

```[language]
// Framework-specific unit test examples
```

### Integration tests

- **Environment:**
- **Data seeding/migrations:**
- **External dependencies:**
- **Service integrations:**

### Property/fuzz tests

- **Properties to hold:**
- **Generators:**

### Performance checks

- **Baselines:**
- **Thresholds:**

### Observability assertions

- **Logs/metrics/traces expected:**

### Coverage goals

- **Line:**
- **Branch:**
- **Mutation (optional):**

### Run commands

- ...
