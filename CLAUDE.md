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

## References

- [Web Clients Architecture](https://contributing.bitwarden.com/architecture/clients)
- [Architectural Decision Records (ADRs)](https://contributing.bitwarden.com/architecture/adr/)
- [Contributing Guide](https://contributing.bitwarden.com/)
- [Web Clients Setup Guide](https://contributing.bitwarden.com/getting-started/clients/)
- [Code Style](https://contributing.bitwarden.com/contributing/code-style/)
- [Security Whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/)
- [Security Definitions](https://contributing.bitwarden.com/architecture/security/definitions)
