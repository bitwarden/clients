# Bitwarden Clients - Claude Code Configuration

## Project Context Files

**Read these files before reviewing to ensure that you fully understand the project and contributing guidelines**

1. @README.md
2. @CONTRIBUTING.md
3. @.github/PULL_REQUEST_TEMPLATE.md

## Critical Rules

- **NEVER** use code regions: If complexity suggests regions, refactor for better readability

- **CRITICAL**: new encryption logic should not be added to this repo.

- **NEVER** send unencrypted vault data to API services

- **NEVER** commit secrets, credentials, or sensitive information.

- **NEVER** log decrypted data, encryption keys, or PII
  - No vault data in error messages or console logs

- **ALWAYS** Respect configuration files at the root and within each app/library (e.g., `eslint.config.mjs`, `jest.config.js`, `tsconfig.json`).

## Mono-Repo Architecture

This repository is organized as a **monorepo** containing multiple applications and libraries. The
main directories are:

- `apps/` – Contains all application projects (e.g., browser, cli, desktop, web). Each app is
  self-contained with its own configuration, source code, and tests.
- `libs/` – Contains shared libraries and modules used across multiple apps. Libraries are organized
  by team name, domain, functionality (e.g., common, ui, platform, key-management).

**Strict boundaries** must be maintained between apps and libraries. Do not introduce
cross-dependencies that violate the intended modular structure. Always consult and respect the
dependency rules defined in `eslint.config.mjs`, `nx.json`, and other configuration files.

## Angular Architecture Patterns

**Observable Data Services (ADR-0003):**

- Services expose RxJS Observable streams for state management
- Components subscribe using `async` pipe (NOT explicit subscriptions in most cases)
  Pattern:

```typescript
// Service
private _folders = new BehaviorSubject<Folder[]>([]);
readonly folders$ = this._folders.asObservable();

// Component
folders$ = this.folderService.folders$;
// Template: <div *ngFor="let folder of folders$ | async">
```

For explicit subscriptions, MUST use `takeUntilDestroyed()`:

```typescript
constructor() {
  this.observable$.pipe(takeUntilDestroyed()).subscribe(...);
}
```

**Angular Signals (ADR-0027):**

Encourage the use of Signals **only** in Angular components and presentational services.

Use **RxJS** for:

- Services used across Angular and non-Angular clients
- Complex reactive workflows
- Interop with existing Observable-based code

**NO TypeScript Enums (ADR-0025):**

- Use const objects with type aliases instead
- Legacy enums exist but don't add new ones

Pattern:

```typescript
// ✅ DO
export const CipherType = Object.freeze({
  Login: 1,
  SecureNote: 2,
} as const);
export type CipherType = (typeof CipherType)[keyof typeof CipherType];

// ❌ DON'T
enum CipherType {
  Login = 1,
  SecureNote = 2,
}
```

Example: `/libs/common/src/vault/enums/cipher-type.ts`

## Library Dependencies

**Dependency Rules:**

- `libs/common` - Core library that CANNOT depend on Angular or platform-specific code
- `libs/angular` - Angular-specific utilities that depend on `@angular/*`
- `libs/components` - UI component library built with Angular standalone components
- Apps can depend on libs, but libs SHOULD NOT depend on apps
- Circular dependencies are blocked by ESLint rules in `eslint.config.mjs`

When adding imports:

1. Check if the import violates dependency boundaries (ESLint will error)
2. Consider if code should be moved to a different library
3. Use dependency injection rather than direct imports when possible

## Testing Patterns

**Unit Tests:**

- Place test files next to source files: `foo.service.ts` → `foo.service.spec.ts`
- Use `jest-mock-extended` for type-safe mocks
- Use `BehaviorSubject` for testing Observable streams
- For Angular components, use `ComponentFixture` from `@angular/core/testing`

**Test Utilities:**

- `libs/core-test-utils` - Core testing utilities
- `libs/state-test-utils` - State management testing utilities
- `libs/storage-test-utils` - Storage testing utilities

**Coverage:**

- Coverage is collected automatically in CI
- Aim for meaningful tests, not just coverage metrics
- Don't test framework code (Angular lifecycle, etc.)

## App-Specific and Lib-Specific Notes

Apps and libs may have their own CLAUDE.md with specific rules:

- `apps/browser/CLAUDE.md` - Browser extension (cross-browser compatibility, MV3)
- `apps/web/CLAUDE.md` - Web vault (multi-tenant, no extension APIs)
- `apps/desktop/CLAUDE.md` - Electron app (main vs renderer process)
- `apps/cli/CLAUDE.md` - CLI (JSON output, environment variables)
- `libs/components/CLAUDE.md` - Component Library (UI components and shared utilities)

**Always check the app- or lib-specific CLAUDE.md when working in that directory.**

## Using the Component Library in Feature Code

**When building features that consume the Component Library:**

### Storybook for Custom Components

- Add Storybook stories for custom components owned by feature teams
- Add stories for larger UI compositions that combine multiple CL components
- Custom feature team components should **NOT** use the `bit-` prefix
- Example: `app-user-settings`, `vault-item-card`, `send-form`

### Component Library Usage Guidelines

**DO:**

- Use existing CL components instead of writing bespoke HTML/CSS
- Read the component library documentation in Storybook for usage guidelines and examples
- Compose CL components together to build feature-specific UI
- Follow the component API contracts (inputs, outputs, content projection)

**DO NOT:**

- Add custom CSS classes to override CL component styles
- Copy/paste CL component markup to create variations
- Modify CL component internals from feature code
- Create duplicate components when a CL component already exists

If a CL component doesn't meet your needs:

1. Check if composition can solve the problem
2. Consult with the UIF team about extending the CL component
3. Propose a new component or variant through the proper channels

## References

- [Web Clients Architecture](https://contributing.bitwarden.com/architecture/clients)
- [Architectural Decision Records (ADRs)](https://contributing.bitwarden.com/architecture/adr/)
- [Contributing Guide](https://contributing.bitwarden.com/)
- [Web Clients Setup Guide](https://contributing.bitwarden.com/getting-started/clients/)
- [Code Style](https://contributing.bitwarden.com/contributing/code-style/)
- [Security Whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/)
- [Security Definitions](https://contributing.bitwarden.com/architecture/security/definitions)
