---
paths:
  - "**/*.spec.ts"
  - "**/*.e2e.ts"
  - "e2e/src/**/*.ts"
---

# Querying Elements

Query elements by role, accessible name, label or text. Only add a `data-testid` when those aren't sufficient, and don't add them proactively. Accessible queries find elements the way users and assistive technology do, so a test that passes also confirms the element is accessible; a test ID passes even when it isn't.

When a test ID is needed, name it `<component>-<element>`, e.g. `login-email-input`.

For new queries, don't use CSS classes, DOM structure, `#id` or `formcontrolname`. Leave existing queries alone unless you are already changing them.
