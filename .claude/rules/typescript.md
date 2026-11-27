---
paths:
  - "**/*.ts"
---

# TypeScript Patterns

Distilled from [Web Code Style — TypeScript](https://contributing.bitwarden.com/contributing/code-style/web/typescript).

## Boolean Naming

Use the base word. Add `is` / `has` / `can` prefixes only when meaning cannot be conveyed without them — for example, when the unprefixed name would collide with another property.

```typescript
// Prefer
disabled = true;
loading = signal(false);

// Only when needed to disambiguate
isEnabled = signal(true); // because `enabled` is already an input
```

## Nullable Values

If a value can be absent, say so in its type (`T | undefined` or `T | null`) and handle the absent case where the value is used. Don't replace it with a placeholder like `""`, `0`, `[]` or `{}` to get rid of the `undefined`. That includes `?? ""` when assigning, default parameters, and initial values (`signal("")`, `toSignal(..., { initialValue: [] })`, `new FormControl("")`).

A placeholder is usually not a valid value: an empty string isn't a name or a GUID. It also hides the "not set yet" state from the type checker, so code that should handle that state compiles anyway.

```typescript
// ❌ Wrong
providerName = signal("");
this.providerName.set(qParams.providerName ?? "");

// ✅ Right
providerName = signal<string | undefined>(undefined);
this.providerName.set(qParams.providerName);
```

Use a default only when it has real meaning, e.g. `[]` for "no items" rather than "not loaded".

## No TypeScript Enums (ADR-0025)

Use const objects with derived type aliases. Don't add new enums; legacy ones remain.

`Object.freeze` is recommended to prevent member injection at runtime.

```typescript
// Numeric
export const CipherType = Object.freeze({
  Login: 1,
  SecureNote: 2,
  Card: 3,
} as const);
export type CipherType = (typeof CipherType)[keyof typeof CipherType];

// String
export const CredentialType = Object.freeze({
  Password: "password",
  Username: "username",
} as const);
export type CredentialType = (typeof CredentialType)[keyof typeof CredentialType];
```

Example: `/libs/common/src/vault/enums/cipher-type.ts`

### Type Safety

- Strongly type variables: `let value: CipherType = CipherType.Login;`
- Do not rely on type inference for enum-like values
- Do not use type assertions (`value as CipherType`)

### Runtime Helpers

Provide helpers alongside the type:

- `isCipherType(value)` — type guard
- `toCipherType(value)` — safe conversion (returns the value or `undefined`)
- `toCipherTypeName(value)` — retrieves the member name

## Observable Data Services (ADR-0003)

Services expose RxJS Observable streams for state management.

```typescript
private _folders = new BehaviorSubject<Folder[]>([]);
readonly folders$ = this._folders.asObservable();
```

Use **RxJS** (not Signals) in services for:

- Code shared with non-Angular clients (CLI)
- Complex reactive workflows
- Interop with existing Observable-based code

## File and Class Naming

File names use suffixes to indicate role:

- Conventional: `.service`, `.component`, `.pipe`, `.module`, `.directive`
- Less conventional: `.api`, `.data`, `.view`, `.export`, `.request`, `.response`, `.type`, `.enum`

Class names include the same suffix: `folder.service.ts` → `FolderService`, `folder.request.ts` → `FolderRequest`.

### Implementation Prefixes

When an abstract class has multiple implementations, prefix the class name:

- `Default` — the default implementation
- `Web`, `Browser`, `Desktop`, `Cli` — platform-specific implementations

Example: `DefaultFolderService`, `BrowserPlatformUtilsService`.
