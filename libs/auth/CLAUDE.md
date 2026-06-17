# libs/auth

**Do not add new code to `libs/auth`.** This library was carved out prematurely and now causes recurring circular-dependency issues across the monorepo. It should not grow further.

## Where new auth code belongs

- **Framework-agnostic logic** (services, models, abstractions, utilities without Angular) → `libs/common/src/auth/`
- **Angular-specific shared code** (components, directives, pipes, guards, Angular services) → `libs/angular/src/auth/`
- **Used by only one client** → that client's own auth area (`apps/web/src/app/auth/`, `apps/browser/src/auth/`, `apps/desktop/src/auth/`, or the relevant `apps/cli/` subtree).

## Modifying existing code here

Bug fixes, refactors, and deletions are fine — the rule is about _growth_ (no new files, exports, or top-level features). When touching a feature, relocate it to one of the destinations above if the PR's scope allows; otherwise note it as follow-up so the debt stays visible.
