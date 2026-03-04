# Migration: `@bitwarden/components` to vanilla-extract

## Background

`@bitwarden/components` is currently styled with Tailwind CSS utility classes applied directly
in Angular templates and `@HostBinding` class getters. This works well for application
development but has real limitations for a **shipped design system**:

- Component styling is a leaky abstraction — internal class names are visible in the DOM and
  consumers can accidentally depend on them.
- Component-specific semantic tokens (`button-background-color-hover`) are cumbersome to
  express. Tailwind requires a config entry per token, which generates a utility class, adding
  three layers of indirection. In practice this means components are hardcoded to primitive
  tokens (`tw-bg-primary-700`) and cannot be independently themed.
- Consuming apps must configure Tailwind with the correct `content` paths and the `tw-` prefix
  just to use the library. The library's styling is not self-contained.

## Goals

- **Component-scoped semantic tokens.** Each component exposes a typed token contract
  (`createThemeContract`) that documents its themeable surface area and enforces it at compile
  time. A `button-background-hover` token is a first-class concept, not a convention in a
  comment.
- **Consumer theming without forking.** A consuming team can re-theme a component by
  implementing its token contract, without touching component source code.
- **Self-contained CSS artifact.** `@bitwarden/components` ships a pre-generated stylesheet.
  Consumers include it and move on — no Tailwind configuration required.
- **Encapsulated class names.** Styling is an implementation detail. Consumers interact with
  component inputs and outputs, not class names.
- **Polyglot server rendering support.** With predictable (non-hashed) class names, a
  non-JavaScript server can render components correctly by referencing the generated class name
  manifest.

## Non-Goals

- Migrating consuming apps (`apps/browser`, `apps/web`, `apps/desktop`, `apps/cli`). They
  continue using Tailwind for their own styles. The token bridge ensures shared values stay in
  sync.
- Changing the public Angular API of any component (inputs, outputs, selectors).
- Eliminating Tailwind from the monorepo. The two systems coexist, consuming from a shared
  token source.

## Architecture

### Token bridge

A shared TypeScript object is the single source of truth for design token values. Both
vanilla-extract and Tailwind consume it — no duplication, no drift.

```
libs/
  tokens/
    src/
      tokens.ts          ← plain TS object, the source of truth
      tokens.css.ts      ← vanilla-extract createTheme, emits CSS custom properties
libs/
  components/
    tailwind.config.js   ← imports tokens.ts for theme values (existing apps)
```

### Component token contracts

Each component defines its own token contract alongside its styles:

```ts
// button.css.ts
export const buttonVars = createThemeContract({
  background: { default: null, hover: null },
  text:       { default: null, disabled: null },
  border:     { default: null },
});

export const buttonTheme = createTheme(buttonVars, {
  background: { default: vars.color.primary[600], hover: vars.color.primary[700] },
  text:       { default: vars.color.contrast, disabled: vars.color.muted },
  border:     { default: vars.color.primary[600] },
});
```

Component variants are expressed as `recipe()` calls that reference these vars:

```ts
export const buttonRecipe = recipe({
  variants: {
    buttonType: {
      primary: {
        background: buttonVars.background.default,
        selectors: { '&:hover': { background: buttonVars.background.hover } },
      },
    },
  },
});
```

### Class name strategy

The bundler is configured to emit predictable, namespaced class names rather than hashes,
enabling server-side rendering without a JavaScript runtime.

Angular uses webpack, so `@vanilla-extract/webpack-plugin` is the integration point.
The plugin is added via `@angular-builders/custom-webpack` or Nx's `webpackConfig` option
in `project.json`:

```ts
// webpack.config.js
const { VanillaExtractPlugin } = require("@vanilla-extract/webpack-plugin");

module.exports = {
  plugins: [
    new VanillaExtractPlugin({
      identifiers: ({ filePath, debugId }) => `bit-${debugId}`,
    }),
  ],
};
```

The webpack plugin is well-established and the Angular webpack pipeline is well-understood.
This is a low-risk integration.

The build also emits a JSON manifest mapping variant combinations to class name sets, which
non-JavaScript servers can consume directly.

## Migration Approach

### Phase 0 — Spike (prerequisite, do not proceed without passing this)

Migrate one complete component (recommended: `ButtonComponent`) end-to-end through the full
build pipeline:

- [ ] `@vanilla-extract/webpack-plugin` integrated with the Angular/Nx build
- [ ] Storybook configured with vanilla-extract webpack loader
- [ ] CSS custom properties resolved correctly at runtime
- [ ] `jest` tests pass
- [ ] Visual regression tests pass in Chromatic

The webpack integration is low-risk, but the spike validates the full pipeline before
the team invests in Phase 1 infrastructure. If anything fails, stop here.

### Phase 1 — Infrastructure

- [ ] Token bridge: `libs/tokens` shared source, Tailwind config updated to consume it
- [ ] `tokens.css.ts`: global CSS custom properties emitted by vanilla-extract
- [ ] `cx` pipe
- [ ] `recipe` pipe
- [ ] Bundler configured for predictable class name output
- [ ] Class name manifest generation in the build

### Phase 2 — Simple components (no compound variants, single variant dimension)

Good candidates: `BadgeComponent`, `AvatarComponent`, `SpinnerComponent`,
`TypographyDirective`, `LinkComponent`, `ProgressComponent`

Each follows the same pattern: one `.css.ts` file, minor component changes, template
`[class]` bindings.

### Phase 3 — Multi-variant components

`ButtonComponent`, `BitIconButtonComponent`, `IconTileComponent`

These have multiple variant dimensions and are the best demonstration of the recipe + compound
variant pattern. `IconTileComponent` is the most interesting — it has a nested
`shape × size` lookup that maps cleanly to CVA compound variants and will map equally well
to vanilla-extract.

### Phase 4 — Complex components

`DialogComponent`, `FormFieldComponent`, `TabListItemDirective`

These have conditional logic in templates, pseudo-element workarounds, and interactions
with Angular's form APIs. Template rewrites here are the most involved.

### Phase 5 — Remaining components

Everything else. Mechanical but high-volume.

## Known Risks and Investigations Needed

| Risk | Severity | Notes |
|---|---|---|
| Angular/Nx build integration | **Low** | Using `@vanilla-extract/webpack-plugin` via `@angular-builders/custom-webpack`. Angular's webpack pipeline is well-understood; this is a routine plugin addition |
| `bit-compact:` custom Tailwind variant | Medium | Used in several components for compact layout mode. Needs an equivalent mechanism (data attribute selector?) |
| `group-hover/bit-form-field:` named group variant | Medium | No direct vanilla-extract equivalent. Needs explicit ancestor selector strategy |
| Storybook integration | Medium | Needs vanilla-extract loader configured |
| Template readability | Low | Permanent DX change — utility classes are self-documenting; `[class]="styles.wrapper"` is not. Team should agree on this tradeoff consciously |

## Tradeoffs

**What we gain**
- Component-specific semantic tokens as a first-class feature
- Consumer theming via token contract override
- Self-contained CSS — consumers need no Tailwind configuration
- Encapsulated class names (implementation details stay internal)
- Polyglot server rendering via the class name manifest
- Types derived from recipe definitions — token contracts and variant types never drift

**What we give up**
- Template readability. Tailwind utilities are immediately understandable in-place.
  `tw-flex tw-items-center tw-gap-2` communicates layout at a glance; `[class]="styles.row"`
  requires a lookup. This is the most significant day-to-day DX cost.
- Tailwind's responsive and state modifier ergonomics (`md:`, `hover:`, `aria-disabled:`).
  These become verbose `@media` blocks and attribute selectors in vanilla-extract style objects.
- Familiarity. The team knows Tailwind. vanilla-extract has a learning curve.

## Open Questions

1. Should component token contracts be part of the public package API — i.e., exported from
   `@bitwarden/components` and consumed by white-label partners? If yes, stability guarantees
   apply and renaming a token is a breaking change.

2. What is the right granularity for token contracts? Per component (`buttonVars`) or per
   component state (`buttonPrimaryVars`, `buttonDangerVars`)? The former is simpler; the
   latter allows finer-grained theming.

3. Should the class name manifest be committed to the repo (predictable, reviewable) or
   generated at build time only?
