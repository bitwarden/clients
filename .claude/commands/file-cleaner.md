Use this template to improve readability of a single source file without changing behavior.

## INPUTS

- Code - the code to clean up
- (optional) File path

## INSTRUCTIONS

1. Keep behavior identical. Avoid semantic changes.
2. Rename unclear variables and functions to intent-revealing names.
3. Remove redundant or noisy comments. Keep value-adding docs.
4. Add comments where logic is non-obvious (why > what).
5. Reformat for consistency per project standards.
6. Ensure lints and static analysis pass.
7. Surface any low-risk micro-optimizations as suggestions, not changes.
8. Keep lines ≤80 chars.

## OUTPUT FORMAT

### Summary

- **What improved:**
- **Risks:**

### Cleaned file

```
// full revised file
```

### Diff (for review)

```diff
- old
+ new
```

### Naming changes

- `old_name` → `new_name`: reason

### Lint & style

- **Tools used** (e.g., language-specific linters, formatters):
- **Rules touched:**

### Notes for follow-up (optional)

- **Larger refactors that were out of scope:**
- **Test additions recommended:**
