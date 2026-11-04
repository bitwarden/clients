---
paths:
  - "**/*.stories.ts"
---

# Storybook: stories that show dates

Chromatic flags anything built from the real clock as a diff on every run.

- Build story dates from a fixed constant, never bare `Date.now()` or `new Date()`:

  ```ts
  import { DAY, STORY_NOW } from "@bitwarden/storybook";

  const daysAgo = (days: number) => new Date(STORY_NOW.getTime() - days * DAY);
  ```

  The exception is a component that ticks its own clock. Build its offsets with `liveFromNow`
  inside a provider factory, so they're read at render time, after `startClockAtStoryNow` has moved
  the clock.

- If the component reads `Date.now()` itself (history windows, countdowns, "x minutes ago"), set
  `beforeEach: startClockAtStoryNow` on the default `Meta` export. It moves the clock without
  freezing it, because countdowns and rxjs debounces stall on a frozen clock.
- You still need the constant after moving the clock. `args` and decorators are evaluated when the
  module loads, before `beforeEach` runs, so `Date.now()` there still reads the real time.
- Moving the clock doesn't change `new Date()` with no arguments, so output built from it still
  drifts.
- Relative output ("2h left") from `Date.now() + offset` is stable and needs neither.

Import these helpers (`STORY_NOW`, `fromNow`, `liveFromNow`, `startClockAtStoryNow`, `MINUTE`,
`HOUR`, `DAY`) from `@bitwarden/storybook`.
