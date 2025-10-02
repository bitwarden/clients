# Web Vault - Critical Rules

- **NEVER** access browser extension APIs
  - Web vault runs in standard browser context (no chrome._/browser._ APIs)
  - DON'T import or use BrowserApi or extension-specific code

- **ALWAYS** assume multi-tenant organization features
  - Web vault supports enterprise organizations with complex permissions
  - Use organization permission guards: `/apps/web/src/app/admin-console/organizations/guards/`

- **CRITICAL**: All sensitive operations must work without local storage
  - Web vault may run in environments that clear storage aggressively
  - DON'T rely on localStorage/sessionStorage for security-critical data

## Angular Patterns

- **ALWAYS** use Observable Data Services (ADR-0003)
  - Components use `async` pipe for subscriptions
  - If explicit subscription needed, use `takeUntilDestroyed()`

- **NEVER** create TypeScript enums (ADR-0025)
  - Use `Object.freeze({ Key: value } as const)` pattern

## Development Commands

- `npm run build:bit:watch` - Bitwarden-branded build with hot reload
- `npm run build:oss:watch` - OSS/community edition with hot reload
- `npm run test` - Run Jest tests
- `npm run lint` / `npm run lint:fix` - Lint code

**IMPORTANT**: Use `build:bit:*` for Bitwarden-branded builds, `build:oss:*` for community
