# Bitwarden Clients - Claude Code Configuration

## Critical Rules

- **NEVER** use code regions: If complexity suggests regions, refactor for better readability

- **CRITICAL**: Use `EncString` type for all encrypted vault data
  - Import from: `@bitwarden/common/key-management/crypto/models/enc-string`
  - Never use raw `string` types for passwords, notes, or vault fields
  - Never decrypt without user's CryptoService context

- **NEVER** send unencrypted vault data to API services
  - Encrypt with CryptoService BEFORE passing to API layer
  - API services should only receive/return EncString types for vault data

- **NEVER** log decrypted data, encryption keys, or PII
  - No vault data in error messages or console logs
  - Log encrypted data identifiers only (cipher IDs, not contents)

- **NEVER** call CryptoService directly in components
  - Use domain services that handle encryption/decryption
  - Components work with decrypted ViewModels only

## Mono-Repo Architecture

**Service Location (CRITICAL for code organization):**

- `libs/common` - Multi-platform services (NO Angular decorators)
- `libs/angular` - Angular-only services (can use `@Injectable`)
- `apps/<name>` - App-specific services

**Dependency Injection:**

- **ALWAYS** use `safeProvider()` when configuring Angular providers (compile-time type safety)
- **NEVER** use Angular decorators (`@Injectable`) in `libs/common` services (breaks non-Angular clients)
- Non-Angular contexts: manually instantiate dependencies **in correct order** (wrong order = null injection errors)

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
