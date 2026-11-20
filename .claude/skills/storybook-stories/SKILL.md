---
name: storybook-stories
description: Writes a Storybook story for an Angular component in the Bitwarden clients monorepo. Use when the user asks to "add a story", "write stories", "storybook this", "add storybook coverage", or when another skill hands off a component that needs one.
---

# Writing a Storybook story

`<name>.stories.ts` beside the component, with a title that mirrors where it lives. One story for
the main state and one for each visibly distinct state.

```ts
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { ExampleComponent } from "./example.component";

export default {
  title: "<Area>/<Feature>/<Component>",
  component: ExampleComponent,
  decorators: [moduleMetadata({ imports: [ExampleComponent], providers: [] })],
} as Meta<ExampleComponent>;

type Story = StoryObj<ExampleComponent>;

/** Shown on the docs page. */
export const Default: Story = { args: {} };
```

Mock injected services as plain objects with only the members the component uses. Anything a
`providedIn: "root"` service consumes, plus i18n modules, the router, and animations, goes in
`applicationConfig` rather than `moduleMetadata`.

Repo specifics:

- i18n: `importProvidersFrom(PreloadedEnglishI18nModule)` from `apps/web/src/app/core/tests` in
  web and bit-web. `I18nMockService` from `@bitwarden/components` elsewhere.
- Feature flags: `enabledFlags(FeatureFlag.X)` in the story's `globals`, from
  `@bitwarden/storybook`. Don't mock `ConfigService`.
- Dialogs: provide `DIALOG_DATA` and `DialogRef`, and `provideNoopAnimations()` or `bit-dialog`
  throws.
- `formatArgsForCodeSnippet(args)` from `@bitwarden/storybook` inside a `render` template keeps
  the docs snippet in sync with `args`.
- `.storybook/main.ts` lists story globs per lib and app; add the pair if the location is
  missing. `apps/desktop` has no Storybook.

Rules:

- Story data is invented. Nothing that resembles real vault data.
- Never read the real clock. Build dates from `STORY_NOW` in `@bitwarden/storybook`; if the
  component reads the clock itself, add `beforeEach: startClockAtStoryNow` to the `Meta`.
- A stubbed `ActivatedRoute` or `provideRouter([])` breaks relative `routerLink`s and
  `bit-breadcrumbs`. Route for real: `provideRouter(routes, withHashLocation())`, a
  `<router-outlet>` template, and a decorator that sets `window.location.hash` per story (see
  `grep -rl withHashLocation --include=*.stories.ts`).

Verify in Storybook at `http://localhost:6006/iframe.html?id=<kebab-title>--<kebab-story>`,
starting `npm run storybook` if it isn't running. A type error anywhere in the bundle fails every
story, so the file the overlay names may not be yours. Then `npm run lint:fix` and
`npm run prettier`.
