---
name: storybook-stories
description: Writes a Storybook story for an Angular component in the Bitwarden clients monorepo — new or existing, presentational or feature/page. Use when the user asks to "add a story", "write stories", "storybook this", "add storybook coverage", or when a rule or another skill hands off a component that needs a story. Handles mocking injected services and routing. Not for Storybook config or addon work.
---

# Writing a Storybook story

Input: a component file path (or a directory, in which case work through its components one at a
time, confirming the list with the user first).

## 1. Read the component

First, find out whether a story already renders it. `grep` for the component's selector and class
name across `*.stories.ts` and the templates of components that have stories. A composed story
that shows the leaf in its real context counts as coverage for the leaf. If one exists, add the
missing states _there_ and stop — don't start a parallel file for the leaf.

Then answer these from the component and its template:

- **Inputs / outputs / content slots** → become `args`, and the variants worth a story.
- **What it injects** → each is either already provided by Storybook, needs a mock, or means the
  story should route the page for real. See [references/mocking.md](references/mocking.md).
- **What child components it renders** → each of _those_ may inject something too. A page that
  renders `app-header` pulls in half the app; stub it.
- **Does it read route params, render `bit-breadcrumbs`, or use `routerLink`?** → follow
  `.claude/rules/storybook-routing.md`. Never stub `ActivatedRoute`.
- **Does it show dates or times?** → follow `.claude/rules/storybook-dates.md`.
- **Does it branch on a feature flag?** → use `enabledFlags` / `featureFlagModes` from
  `@bitwarden/storybook`; don't mock `ConfigService` for flags.

Then open one or two sibling `*.stories.ts` files in the same area and match their structure.

## 2. Decide the stories

Start small. The first story is the component in its main, populated state. Add one story per
_visually distinct_ state the component owns — typically some of:

- `Default`
- `Loading` (a service mock that returns a never-resolving promise or a silent observable)
- `Empty` (the empty-state copy, not the table's generic fallback)
- `Error` / validation shown
- `Disabled` / read-only
- A flag-on variant when the flag changes what renders

Don't enumerate input combinations, and don't add stories for states the component doesn't visibly
distinguish. Three good stories beat ten thin ones; teams can add more later.

## 3. Write the file

File: `<name>.stories.ts` next to the component. Follow the sibling you opened. Skeleton:

```ts
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { ExampleComponent } from "./example.component";

export default {
  title: "<Area>/<Feature>/<Component>",
  component: ExampleComponent,
  decorators: [
    moduleMetadata({
      imports: [ExampleComponent],
      providers: [/* mocks for what the component injects */],
    }),
  ],
} as Meta<ExampleComponent>;

type Story = StoryObj<ExampleComponent>;

/** One line on what state this shows. */
export const Default: Story = {
  args: {/* inputs */},
};
```

Conventions:

- **Title** = where it lives in the sidebar. Existing top levels: `Component Library/…` for
  `libs/components`, `Admin Console/…`, `Web/…`, `Browser/…`, `Tools/…`, `DIRT/…`. Check what
  siblings use before inventing a new one.
- **A JSDoc line on each story** — it becomes the docs-page description.
- **Mock data is fake** — `alice@example.com`, `org-1`, invented names. Nothing resembling real
  vault data.
- **Prefer `args` + the component's own template** for presentational components. Use a
  `render` with a `template` string when the component needs projected content or a wrapper
  (`/*html*/` before the template literal for highlighting). `formatArgsForCodeSnippet` from
  `@bitwarden/storybook` keeps the docs code snippet in sync with args.
- **Providers that must sit at root** (anything injected by a `providedIn: "root"` service, i18n
  modules, the router) go in `applicationConfig`, not `moduleMetadata`.
- **Dialogs** rendered directly: provide `DIALOG_DATA` (and `DialogRef` if the component closes
  itself) in the story's `moduleMetadata`.
- **`play`** only when a state is reachable solely through interaction (open a menu, submit a form).
- Add a `parameters.design.url` when a Figma link is known.

## 4. Verify

Storybook is usually already running on `http://localhost:6006`. Use it; do not start or stop one.
If it isn't running, say so and ask.

For each story, load
`http://localhost:6006/iframe.html?id=<kebab-title>--<kebab-story>&viewMode=story`, then:

1. Snapshot the DOM — confirm the component rendered, not an error overlay or a blank root. A
   webpack type error shows up as `ERROR in <file>:<line>` text nodes in the snapshot, and it can
   point at a _different_ story file than the one you're loading — the whole bundle has to compile.
   Treat this as the authoritative type-check for stories; a passing `tsc -p <lib>/tsconfig.json`
   is not proof.
2. Check the console for `NullInjectorError`, `ExpressionChanged…`, or 404s for missing providers.
3. Screenshot and sanity-check the state matches the story's description.
4. The a11y addon runs axe on every story in CI (`.storybook/test-runner.ts`). Fix violations the
   story introduces (missing labels on mock content, etc.); flag ones that belong to the component.

Then `npm run lint:fix` and `npm run prettier` on the new file, and `npm run test:types` if you
touched anything outside the stories file.

## 5. Confirm discovery

`.storybook/main.ts` lists story globs explicitly. If the component's lib or app isn't covered,
the story won't appear — add the glob (both `*.mdx` and `*.stories.*` lines, matching the existing
entries) and mention it in the PR.

## When the component resists

If getting it to render means mocking six services and the data it fetches, say so rather than
grinding through it. Usually the right move is one of:

- **Mock at the edge** — the SDK/API services — and let the component's own services and
  derivation run. Pages with 10+ injections have been storied this way without touching them.
- **Stub the heavy child**, not the whole tree (the `app-header` pattern).
- **Route the page for real** with a couple of mocked API services — often less code than
  mocking everything it derives.
- **Move fixtures into `<feature>/testing/`** and share them with the specs, once there's more
  than a couple of story files in the feature.
- **Split container from presentation** only when the mocks would be more code than the
  component. Propose it to the user with the inputs the view would take; don't refactor unasked.

Details and copyable mock shapes: [references/mocking.md](references/mocking.md).
