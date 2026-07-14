---
name: writing-client-code
description: Bitwarden client code conventions for Angular and TypeScript. Use when creating components, services, or modifying web/browser/desktop apps.
---

### Why `libs/common` cannot import Angular

CLI is a first-class client. Any code in `libs/common` must work without Angular's dependency injection, decorators, or lifecycle hooks. This is why cross-client services use abstract classes as interfaces — the concrete implementations (`Default*`, `Web*`, `Browser*`, `Desktop*`, `Cli*`) live in their respective apps.

## Architectural Rationale

### Thin components

Components contain only view logic. Business logic belongs in services. This keeps components testable, reusable, and prevents Angular lifecycle coupling from leaking into domain logic.

### Composition over inheritance

Avoid extending components across clients. Compose using shared child components instead. Inheritance creates tight coupling between client-specific UI and shared behavior — when one client's needs diverge, inherited components become hard to change safely.

### Don't modernize existing code unless asked

The codebase contains both legacy and modern Angular patterns. When modifying an existing file, **follow the patterns already in that file**. Don't migrate any of these unless explicitly asked:

- `*ngIf` → `@if`, `*ngFor` → `@for`
- `@Input()` / `@Output()` → `input()` / `output()` signals
- Constructor injection → `inject()`
- Default change detection → `OnPush`
- NgModule declarations → standalone components

If asked to modernize, follow this order (per the Angular migration guide): standalone → control flow → input/output signals → view queries → signals → computed → OnPush (last, only after full signal migration).

### State management: Signals vs RxJS

- **Component local state and Angular-only services:** Use Signals
- **Cross-client services (`libs/common`):** Use RxJS (because CLI has no Angular Signals support)

Avoid manual subscriptions. Prefer `| async` pipe. When subscriptions are necessary, pipe through `takeUntilDestroyed()` — enforced by the `prefer-takeUntil` lint rule.

### No TypeScript enums (ADR-0025)

Use frozen const objects with `Object.freeze()` and `as const`, plus a companion type alias. Enums have runtime behavior that creates subtle bugs with tree-shaking.

## Critical Rules for New Code

These rules apply **strictly to new files and components**. For existing code, follow the patterns already in the file.

- **New components must use `ChangeDetectionStrategy.OnPush`** and be `standalone: true`. `NgModules` are permitted only for grouping related standalone components
- **Prefer `inject()` function** for DI in Angular primitives (components, pipes, directives). Use constructor injection for code shared with non-Angular clients (CLI)
- **New templates must use control flow syntax** (`@if`, `@for`, `@switch`), not structural directives
- **Use `host` property** in component decorators, not `@HostBinding` / `@HostListener`
- **Use Reactive Forms exclusively** — not template-driven forms
- **File naming:** `kebab-case.component.ts`, `.service.ts`, `.pipe.ts`, `.directive.ts`. Also: `.request.ts`, `.response.ts`, `.view.ts`, `.data.ts` for models (ADR-0012)
- **All Tailwind classes require `tw-` prefix** — `tw-flex`, `tw-mt-2`, not `flex`, `mt-2`
- **Testing with Jest** — use `jest-mock-extended` for mocking services. `describe`/`it` blocks, not `test()`
- **Imports from `@bitwarden/common`** must not pull in Angular-specific code (breaks CLI)

## Examples

### Dependency injection (new Angular code)

```typescript
// CORRECT — inject() for Angular primitives
export class VaultComponent {
  private vaultService = inject(VaultService);
}

// ALSO CORRECT — constructor injection for code shared with CLI
export class CryptoService {
  constructor(private stateService: StateService) {}
}
```

### Tailwind prefix

```html
<!-- CORRECT -->
<div class="tw-flex tw-gap-2 tw-mt-4">
  <!-- WRONG — missing tw- prefix, will be stripped -->
  <div class="flex gap-2 mt-4"></div>
</div>
```

### Const objects over enums (ADR-0025)

```typescript
// CORRECT — with companion type alias
export const CipherType = Object.freeze({
  Login: 1,
  SecureNote: 2,
} as const);
export type CipherType = (typeof CipherType)[keyof typeof CipherType];

// WRONG — TypeScript enums have runtime side effects
export enum CipherType {
  Login = 1,
  SecureNote = 2,
}
```

## Further Reading

- [Angular conventions](https://contributing.bitwarden.com/contributing/code-style/web/angular)
- [Angular migration guide](https://contributing.bitwarden.com/contributing/code-style/web/angular-migration-guide)
- [TypeScript style](https://contributing.bitwarden.com/contributing/code-style/typescript/)
- [Component Library](https://contributing.bitwarden.com/contributing/ui/component-library/)
