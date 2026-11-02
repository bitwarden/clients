---
paths:
  - "**/*.spec.ts"
  - "**/*.e2e.ts"
---

# Querying Elements

Query elements by role, accessible name, label or text. Only add a `data-testid` when those aren't sufficient, and don't add them proactively. Accessible queries find elements the way users and assistive technology do, so a test that passes also confirms the element is accessible; a test ID passes even when it isn't.

When a test ID is needed, name it `<component>-<element>`, e.g. `login-email-input`.
