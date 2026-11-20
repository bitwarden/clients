---
paths:
  - "**/*.stories.ts"
---

# Storybook stories

Chromatic snapshots every story on every PR. Anything nondeterministic is a diff on every run.
To write a new story, use the `storybook-stories` skill.

## Dates

- Build dates from `STORY_NOW` and `DAY`/`HOUR`/`MINUTE` (`@bitwarden/storybook`), never
  `Date.now()` or `new Date()`.
- If the component reads `Date.now()` itself (countdowns, "x minutes ago"), set
  `beforeEach: startClockAtStoryNow` on the `Meta`. It moves the clock without freezing it.
  `args` and decorators still evaluate at module load, so use the constants there too.
- Offsets for a component that ticks its own clock come from `liveFromNow` inside a provider
  factory, so they're read after the clock moved.

## Routing

- A stubbed `ActivatedRoute` is fine for a component that only reads params.
- It breaks any relative `routerLink` or `bit-breadcrumbs`: the router silently falls back to the
  current URL and the crumb renders as the active page. Route for real instead:
  `provideRouter(routes, withHashLocation())`, a `<router-outlet>` template, and `atUrl(url)` from
  `@bitwarden/storybook` per story.
- `provideRouter([])` with no URL has the same problem. Every story needs routes that match its URL.
- Check the markup: at most one crumb carries `aria-current="page"`, and none when the trail ends
  at the page title.

Examples: `grep -rl withHashLocation --include=*.stories.ts`.
