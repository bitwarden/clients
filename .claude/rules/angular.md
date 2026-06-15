---
paths:
  - "**/*.ts"
---

# Angular Patterns

> **Scope:** these rules apply **only to Angular code** — files in `apps/browser`, `apps/desktop`, `apps/web`, `libs/angular`, and any other library consumed by Angular clients. **Skip them in non-Angular TypeScript**: `libs/common`, `apps/cli`, SDK code, and anywhere `@Injectable` and Angular APIs are forbidden by the monorepo rules in the root [CLAUDE.md](../CLAUDE.md).

Distilled from [Web Code Style — Angular](https://contributing.bitwarden.com/contributing/code-style/web/angular). Component-only patterns (templates, OnPush, signals, observable subscriptions, etc.) live in [angular-components.md](./angular-components.md); TypeScript-wide patterns live in [typescript.md](./typescript.md).

## Dependency Injection

Use `inject()` — not constructor injection. Constructor injection stays only in code shared with non-Angular clients (CLI).

```typescript
private folderService = inject(FolderService);
```

When declaring providers (component decorator, route config, module), wrap them in `safeProvider()` from `@bitwarden/ui-common`. It adds compile-time checks that the implementation matches the abstraction and that the `deps` array matches the constructor — raw Angular provider objects don't.

```typescript
import { safeProvider } from "@bitwarden/ui-common";

providers: [
  safeProvider({
    provide: FolderService,
    useClass: DefaultFolderService,
    deps: [CipherService, I18nService],
  }),
],
```
