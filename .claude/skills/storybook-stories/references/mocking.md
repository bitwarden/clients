# Mocking injected services in stories

Work down the component's `inject()` / constructor list. For each dependency, pick the first row
that applies.

## Already handled — provide nothing

| Dependency                        | Why                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature flags via `ConfigService` | The feature-flags addon in `.storybook/preview.tsx` provides a `ConfigService` driven by the panel. Use `enabledFlags(FeatureFlag.X)` in a story's `globals`, or `featureFlagModes(...)` for Chromatic. |
| Theme / Tailwind / `tw-` classes  | `withThemeByClassName` decorator in preview.                                                                                                                                                            |
| Zone change detection             | `provideZoneChangeDetection()` in preview.                                                                                                                                                              |

If a component injects `ConfigService` for something _other_ than `getFeatureFlag$`, you still
need a mock for that method — provide it in `applicationConfig` so it overrides the addon's.

## i18n

Every component that uses `| i18n` or `I18nService` needs translations.

- **`apps/web` and `bitwarden_license/bit-web`**: `importProvidersFrom(PreloadedEnglishI18nModule)`
  from `apps/web/src/app/core/tests` in `applicationConfig`. Real English strings, no lookup table
  to maintain.
- **`libs/components` and other libs**: `I18nMockService` from `libs/components/src/utils`
  (or its relative path), with a lookup table of only the keys the component uses. `__$1__` is
  the placeholder for the first param.

```ts
{
  provide: I18nService,
  useFactory: () => new I18nMockService({ save: "Save", itemsCount: "__$1__ items" }),
}
```

## Services the component calls

Mock with a plain object literal exposing only the members the component touches. Return
`of(...)` for observables and `Promise.resolve(...)` for async methods. No `jest-mock-extended` in
stories — it isn't available in the Storybook bundle.

```ts
const mockOrganizationService = {
  organizations$: () => of([{ id: ORG_ID, name: "Acme Inc" }]),
};
```

Common ones and their minimal shape (copy what you need; extend if the component calls more):

| Service               | Minimal mock                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `AccountService`      | `{ activeAccount$: of({ id: USER_ID, email: "alice@example.com" }) }`                                            |
| `OrganizationService` | `{ organizations$: () => of([...]) }`                                                                            |
| `ToastService`        | `{ showToast: () => {} }`                                                                                        |
| `LogService`          | `{ error: () => {}, warning: () => {}, info: () => {} }`                                                         |
| `KeyService`          | `{ orgKeys$: () => of({}) }`                                                                                     |
| `ApiService`          | only the endpoint methods the component hits                                                                     |
| `DialogService`       | leave real if a story should open the dialog via `play`; otherwise `{ open: () => ({ closed: of(undefined) }) }` |

Where to provide:

- `moduleMetadata({ providers })` — the default. Scoped to the story's component tree.
- `applicationConfig({ providers })` — required when the thing _consuming_ the mock is
  `providedIn: "root"` (it can't see the child injector), and for i18n modules and the router.

## Mock at the edge, not the middle

A thick page (6–14 injected services is normal in `apps/web` and `bit-web`) does not need a
container/presentational split to be storyable. Mock the services that talk to the outside —
SDK/API services, `CollectionAdminService`, `AccountService` — and let the component's own
feature services, row-building functions and derived state run for real. The story then exercises
the code that actually renders the page, and the mock is one fake `list…()` plus a few
`{ showToast: () => {} }` stubs.

Signs you're mocking too deep: the mock re-implements logic the component has, or a story breaks
when the component's internals change but its visible behaviour doesn't.

## Shared `testing/` directory per feature

Once a feature has more than two or three story files, stop inlining fixtures. Put them in
`<feature>/testing/` and have Jest specs import the same builders. Typical contents:

- **Builders** — `accessRequest(overrides)`, `rotationConfig(overrides)`: a complete default object,
  spread with overrides. Keep ids short and deterministic (`"org-1"`, `id("4")`). Dates via
  `fromNow(...)` from `@bitwarden/storybook`, never the real clock.
- **Story decorators** — `atUrl(url)` for routed pages; a `withParams(data)` factory for dialogs
  that wraps `DIALOG_DATA` + `DialogRef` in `moduleMetadata`.
- **Fixtures** — pre-built sets (`PENDING_REQUESTS`, `ORG_COLLECTIONS`) when several stories need
  the same population.
- **Small utilities** — e.g. `deferred()` to hold a stubbed request in flight for a loading state.

Storybook-only helpers can live beside spec helpers; the directory is excluded from the app bundle
either way. Name the files for what they build (`rotation-builders.ts`, `story-helpers.ts`), not
"mocks".

## Per-story variation

Put the shared mocks in `default` and vary one provider per story with a decorator factory:

```ts
function withGroups(groups: GroupView[], loading = false): Decorator {
  return moduleMetadata({
    providers: [
      {
        provide: GroupApiService,
        useValue: loading
          ? { getAll: () => new Promise(() => {}) } // never resolves — stays loading
          : { getAll: () => Promise.resolve(groups) },
      },
    ],
  });
}

export const Default: Story = { decorators: [withGroups(mockGroups)] };
export const Loading: Story = { decorators: [withGroups(mockGroups, true)] };
export const Empty: Story = { decorators: [withGroups([])] };
```

Or, when the variation is a knob worth exposing in Controls, read it from `args` inside `render`
and build providers there.

## Heavy children

A page that renders `app-header`, `app-product-switcher`, or similar drags in app-wide services.
Replace the child with an empty stub that reuses its selector:

```ts
@Component({ selector: "app-header", changeDetection: ChangeDetectionStrategy.OnPush })
class StubHeaderComponent {}
```

and import the stub instead of the real one in `moduleMetadata.imports`. Say in a comment why.

## Routed pages

Covered by `.claude/rules/storybook-routing.md`. Summary: register real routes with
`provideRouter(routes, withHashLocation())`, render `<router-outlet>`, and put each story at a URL
with an `atUrl(...)` decorator. Never `{ provide: ActivatedRoute, useValue: ... }`.

## Dialog components

Rendered directly, not through `DialogService`:

```ts
providers: [
  { provide: DIALOG_DATA, useValue: { organizationId: "org-1", users: mockUsers } },
  { provide: DialogRef, useValue: { close: () => {} } }, // only if the component calls close()
];
```

`bit-simple-dialog` and `bit-dialog` declare Angular animations, so the story also needs
`applicationConfig({ providers: [provideNoopAnimations()] })` or it throws `NG05105: Unexpected
synthetic property @fadeIn`. Storybook's preview doesn't provide animations globally.

Template is just the component's selector. Dialogs read `DIALOG_DATA` once at construction, so
provide it per story via a `withParams(data)` decorator factory rather than in `default`.
Parent-page stories usually stub `DialogService`, so a dialog needs its own story file to be
rendered at all.

## Finding examples

Don't rely on remembered file paths; they move. Search for the pattern you need:

- Routed pages: `grep -rl "withHashLocation" --include='*.stories.ts'`
- Dialogs: `grep -rl "DIALOG_DATA" --include='*.stories.ts'`
- Shared builders: `find . -path '*/testing/*' -name '*builders.ts'`
- Stubbed children: `grep -rl "class Stub" --include='*.stories.ts'`
- `play` functions: `grep -rl "play:" --include='*.stories.ts'`
