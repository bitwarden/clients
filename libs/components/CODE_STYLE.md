# Code Style for `@bitwarden/components`

How we write components in this library. For what belongs in the library and PR requirements, see [CONTRIBUTING.md](./CONTRIBUTING.md). Org-wide rules, including [Tailwind](https://contributing.bitwarden.com/contributing/code-style/web/tailwind), live in the [code style docs](https://contributing.bitwarden.com/contributing/code-style/).

## Public API Design

- Keep the API small, with one way to do each thing. No overlapping inputs (`loading` + `showLoadingSpinner`), hybrid APIs (projected children _and_ an options array), or two paths to the same value.
- Match sibling components: reuse established names (`startIcon`/`endIcon`, `variant`, `title`) and mechanics (e.g. trigger directives like `bitMenuTriggerFor`). Model new APIs on native HTML and the ARIA APG pattern.
- Don't add inputs that just proxy CSS (widths, alignment, margins, `mode` flags). Let the parent control layout.
- Use `slot`-attribute content projection (`<ng-content select="[slot=end]">`) when consumers pass varied content; use data inputs when the content is fixed.
- Build what the current design needs, but choose an API shape that can grow without a breaking change. Slots usually extend better than text inputs.
- Boolean inputs default to `false` and use `transform: booleanAttribute`.
- Emit outputs for state changes consumers may care about, rather than making them reach into the component. Outputs have no `on` prefix and don't repeat the component name (`dismissed`, not `chipDismissed`).
- Variants and options are lowercase string-literal unions, not enums or enum-like objects. Type names describe what they are (`ProgressBarVariant`, not `BackgroundType`).
- Component selectors are kebab-case (`bit-foo`); camelCase is for directives. Prefer element selectors unless native semantics require an attribute selector (`button`, `tr`).
- Typically, only inputs and outputs are public. Template-only members are `protected`; everything else is `private`.
- Helper components are marked `@internal` and not exported from `index.ts`.
- Build reusable behavior into the CL primitive (or a host directive) instead of having each consumer re-implement it.
- Wrap third-party dependencies behind a facade. Never expose them or their config in the public API, and don't break our API because a dependency changed.

## Angular Style

- Use `input()`/`output()`/`model()`, `inject()`, `host: {}` (not `@HostBinding`/`@HostListener`), `@if`/`@for`, and `OnPush`. Drop `standalone: true` and empty constructors.
- Mark all class properties `readonly`.
- Derive state with `computed()` instead of getters, setters, or method calls in templates. Don't wrap non-reactive values in `computed()`. Keep input transforms pure.
- Prefer declarative reactivity: computed signals or piped observables over manual subscribe-and-assign. No side effects inside `pipe`. Use plain signals when no stream operators are needed; use `firstValueFrom` for single-emission observables.
- Don't communicate through the DOM (`nativeElement`, `querySelector`, `setAttribute`). Use DI, `contentChild`/`viewChild`, inputs, or host bindings.
- Use `@let` to create new values in templates, never to alias signals.
- Prefer Angular/CDK built-ins (`FormRecord`, `LiveAnnouncer`, CDK focus restoration) over hand-rolled equivalents.
- Inline single-use helpers, types, and wrapper components. Remove unnecessary wrapper DOM nodes.
- Bind dynamic values with `[x]="y()"` and static values with attribute syntax. Never use `{{ }}` interpolation in attributes.
- Comments explain a non-obvious _why_, especially bug workarounds. No narration, explanations of how Angular works, or history of what used to exist.

## Styling

- Prefer CSS (`:has()`, `group-*`, media/container queries, transitions) over JS (`ResizeObserver`, `setTimeout`, computed class strings) when possible.
- Never concatenate partial Tailwind class names; map values to full literal class strings. For dynamic values or values shared with TS, use CSS variables or `[style.x]` instead of "keep in sync" comments.
- No unexplained `!important`. Prefer `rem` so sizes respect zoom.
- Bind classes with `[class]` array syntax, not `[ngClass]`. Keep static classes in the template or `host`, not in TS properties.
- Scope Tailwind groups to the component (`tw-group/bit-form-field`).
- Don't write dark-mode-specific styles; the theme colors in `tw-theme.css` already work in dark mode.
- Use logical directions (`start`/`end`, `tw-ms-*`, `tw-ps-*`), not `left`/`right`.
- Use `focus-visible:` for focus styles, not `focus:`.
- Lay out with flex/grid, and make components respond to their container rather than assuming a viewport.

## Accessibility

- Every interactive state must be reachable by keyboard, with defined screen reader behavior (accessible names, roles, state announcements).

## Docs, Stories & Tests

- Every component class and public input gets a JSDoc comment (`/** */`, not `//`). Use `@deprecated` to point to replacements.
- MDX describes usage only: no internals, no restating what the story already shows.
- Use play functions to capture interactive states (hover, focus, open, validation errors) for visual regression.
- Test internal helper components through their public component.
