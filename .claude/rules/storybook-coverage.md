---
paths:
  - "**/*.component.ts"
  - "**/*.component.html"
---

# Storybook: new UI gets a story

Stories are the expected companion to any component that renders UI. They are how design and
other teams see the component, how Chromatic catches visual regressions, and how the a11y
checks run in CI.

- **Creating a component with a template?** Write a `*.stories.ts` next to it, using the
  `storybook-stories` skill. If there's a reason not to (routing shell, no visible UI, throwaway),
  say so in the PR description instead of silently skipping.
- **Substantially editing an existing component that has no story?** Offer to add one. Don't
  add it unasked, and keep it to the states the edit touches.
- **A story only counts if Storybook finds it.** `.storybook/main.ts` lists globs per lib/app;
  check the component's location is covered.

Companion rules that load with story files: `storybook-dates.md`, `storybook-routing.md`.
