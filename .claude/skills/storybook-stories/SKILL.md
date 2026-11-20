---
name: storybook-stories
description: Writes a Storybook story for an Angular component in the Bitwarden clients monorepo. Use when the user asks to "add a story", "write stories", "storybook this", "add storybook coverage", or when another skill hands off a component that needs one. Not for Storybook config or addon work.
---

# Writing a Storybook story

Input: a component file path. For a directory, list its components and confirm the set with the
user first.

## 1. Check coverage

A component gets its own story file if a consumer would use it on its own. A sub-part of a
compound component (`bit-item-content` inside `bit-item`) belongs in its parent's stories instead.
`grep` the selector across `*.stories.ts`; if a story already covers it, add missing states there.

## 2. Read the component and two siblings

Note its inputs, outputs, content slots, and everything it and its children inject. Then open two
sibling `*.stories.ts` in the same area and match their structure, title prefix, and i18n setup.
`.claude/rules/storybook.md` covers dates and routing.

## 3. Decide the stories

- The main populated state, then one per visibly distinct state (variants, loading, empty,
  error, disabled, flag on). Don't enumerate input combinations.
- `play` only for states reachable solely through interaction.

## 4. Write it

`<name>.stories.ts` beside the component.

```ts
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { action } from "storybook/actions";

import { formatArgsForCodeSnippet } from "@bitwarden/storybook";

import { ExampleComponent } from "./example.component";

export default {
  title: "<Area>/<Feature>/<Component>", // match siblings
  component: ExampleComponent,
  decorators: [moduleMetadata({ imports: [ExampleComponent], providers: [] })],
  args: { saved: action("saved") },
  render: (args) => ({
    props: args,
    template: /*html*/ `<app-example ${formatArgsForCodeSnippet<ExampleComponent>(args)}></app-example>`,
  }),
} as Meta<ExampleComponent>;

type Story = StoryObj<ExampleComponent>;

/** Shown on the docs page. */
export const Default: Story = { args: {} };
```

Mock data is invented (`alice@example.com`, `org-1`), never resembling real vault data. Add
`parameters.design.url` when a Figma link is known.

### Mocking

- Services: plain object literals with only the members the component touches. `of(...)` for
  observables, `Promise.resolve(...)` for async, `new Promise(() => {})` for a loading state,
  `action("Service.method")` for calls worth seeing.
- Mock at the API/SDK edge and let the component's own services run. A mock that re-implements
  component logic is too deep.
- `moduleMetadata` providers by default. `applicationConfig` when the consumer is
  `providedIn: "root"`, and for i18n modules, the router, and animations.
- i18n: `importProvidersFrom(PreloadedEnglishI18nModule)` (`apps/web/src/app/core/tests`) in
  web and bit-web. `I18nMockService` from `@bitwarden/components` with only the keys used
  elsewhere; `__$1__` is the first parameter.
- Feature flags: `enabledFlags(FeatureFlag.X)` in `globals`, `featureFlagModes(...)` for
  Chromatic variants. Both from `@bitwarden/storybook`. Don't mock `ConfigService`.
- Dialogs: render directly, provide `DIALOG_DATA` per story, `DialogRef` only if it calls
  `close()`, and `provideNoopAnimations()` in `applicationConfig` or `bit-dialog` throws.
- Heavy children like `app-header`: import an empty stub component with the same selector.

## 5. Verify

Use Storybook at `http://localhost:6006` if it responds, otherwise start `npm run storybook` in
the background. Without browser tooling, `npm run build-storybook` proves the bundle compiles.

Open `http://localhost:6006/iframe.html?id=<kebab-title>--<kebab-story>&viewMode=story` for each
story. Confirm the component rendered rather than the webpack error overlay (a type error
anywhere fails every story, so the file it names may not be yours), the console has no
`NullInjectorError`, and a screenshot matches the description.

Then `npm run lint:fix` and `npm run prettier`. `npm run test:types` covers lib stories; app
stories only compile in the Storybook bundle. Chromatic snapshots every story on every PR.
`npm run test-stories` runs axe locally; CI does not.

## Discovery

`.storybook/main.ts` lists story globs per lib and app. Add the glob pair if the lib isn't
listed and already builds in the browser. `apps/desktop` is not storied; say so and stop.

If rendering means mocking many services, say so. Propose a container/presentation split only if
the mocks would outweigh the component, and don't refactor unasked.
