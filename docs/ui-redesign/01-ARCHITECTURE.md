# 01 — Architecture

## Decision record: Angular-native redesign (NOT a React rewrite)

**Context.** The original brief proposed React + Vite + Tailwind + shadcn, *and*
required (as a hard constraint) that the fork stay easy to merge from upstream
bitwarden/clients. Upstream is Angular.

**Decision.** Keep the Angular/Nx renderer and replace the **visual layer** only.

**Rationale.**
- Upstream ships UI changes as Angular. A React renderer would make every future
  upstream UI change un-mergeable by hand — directly violating the hard
  constraint we were told matters most.
- The core (`libs/common`, `libs/key-management`) is framework-agnostic TS and is
  reused unchanged either way; the conflict is purely at the renderer.
- Angular 21 already gives us the modern primitives we need: standalone
  components, **signals** for local state, CDK Overlay/A11y for palette/menus,
  CDK virtual scroll for fast lists. Tailwind + a CSS-custom-property theme are
  already wired.

**Consequence.** We get the 1Password/Proton look *and* keep `git merge upstream`
clean. A future React-island path remains open via the bridge (see below) for
*net-new* screens only — never to replace upstream screens.

## Boundary model

We formalize your `core` / `bridge` / `ui` split as a **dependency rule**, not a
destructive move of files:

| Concept | Location | Rule |
|---|---|---|
| `core` (untouched) | `libs/common`, `libs/key-management`, `libs/auth`, `libs/vault`, `libs/platform`, `apps/desktop/desktop_native` | Read-only. Consumed only via existing public services. |
| `bridge` | **`libs/ui-bridge`** (`@klappstuhl/ui-bridge`) | The only fork lib that imports core. Wraps services → view-models. No crypto/sync/API logic. |
| `ui` | **`libs/ui-kit`** (`@klappstuhl/ui-kit`) + restyled `apps/desktop/src/app/**` | All visual code. Standalone Angular components + theme. |

```
apps/desktop/src/app/      restyled renderer (shell, sidebar, palette, split-pane)
libs/ui-kit/               NEW design system (tokens, theme, primitives)  @klappstuhl/ui-kit
libs/ui-bridge/            NEW adapter (view-models over @bitwarden/* services)  @klappstuhl/ui-bridge
libs/components/           upstream component lib — RETUNED via tokens only
libs/common/ key-management/ auth/ vault/  UNTOUCHED core
```

Data flow:

```
Renderer ──> @klappstuhl/ui-bridge ──> @bitwarden/* services ──> Vaultwarden API
  (signals)        (view-models)            (crypto/sync)
```

## Why a separate `@klappstuhl/*` scope

Everything fork-added is `@klappstuhl/*`. This makes the UI/core boundary
**greppable**, guarantees no name collision with upstream packages ever, and
makes fork code trivially identifiable during merges.

## Dependency changes (deliberately minimal)

- **Add:** `lucide-angular` (icons). `@angular/cdk` (Overlay/A11y/virtual-scroll)
  — verify it is already present transitively before adding.
- **State:** Angular **signals** for UI-local state. Do **not** add Zustand
  (React-only; would fragment state ownership). Core state stays in RxJS.
- **Do not add:** React, Vite, shadcn (ruled out by the decision above).

## Module-boundary enforcement (recommended)

The new libs are tagged (`scope:fork-ui`, `type:ui-kit` / `type:bridge`). To make
Nx/ESLint *enforce* "UI may not import core directly", add a depConstraint to the
`@nx/enforce-module-boundaries` rule in `eslint.config.mjs`:

```js
// allow fork-ui to depend on shared libs + each other, but route core access
// exclusively through type:bridge.
{ sourceTag: "type:ui-kit", onlyDependOnLibsWithTags: ["type:ui-kit"] },
{ sourceTag: "type:bridge", onlyDependOnLibsWithTags: ["type:bridge", "shared", "*"] },
```

This edit touches an upstream-managed file, so it is **optional** and documented
rather than applied by default — apply it if you want hard enforcement and accept
a small recurring merge touch-point. Until then the rule is enforced by
convention + code review + this doc.
