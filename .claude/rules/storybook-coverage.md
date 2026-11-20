---
paths:
  - "apps/web/**/*.component.ts"
  - "apps/browser/**/*.component.ts"
  - "bitwarden_license/**/*.component.ts"
  - "libs/**/*.component.ts"
---

# Storybook: new UI gets a story

A new component that a consumer would use on its own gets a `*.stories.ts` beside it, written
with the `storybook-stories` skill. A sub-part of a compound component is shown in its parent's
stories instead. Chromatic snapshots it on every PR, and it is how design reviews the
work. If there's a reason to skip (routing shell, no visible UI), say so in the PR description.

When substantially editing a component that has no story, offer to add one. Don't add it unasked.
