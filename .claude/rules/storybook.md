---
paths:
  - "apps/web/**/*.component.ts"
  - "apps/browser/**/*.component.ts"
  - "bitwarden_license/**/*.component.ts"
  - "libs/**/*.component.ts"
  - "**/*.stories.ts"
---

# Storybook

A new component that a consumer would use on its own gets a `*.stories.ts` beside it. A sub-part
of a compound component is shown in its parent's stories instead. If there's a reason to skip
(routing shell, no visible UI), say so in the PR description. When substantially editing a
component that has no story, offer to add one; don't add it unasked.

Whenever you write or edit a story, load the `storybook-stories` skill.
