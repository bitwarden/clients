# CLAUDE.md

## Overview

### What This Project Does

Bitwarden Clients is a monorepo containing all Bitwarden client applications:

- **Web Vault** - Angular SPA for browser-based password management
- **Browser Extension** - Extensions for Chrome, Firefox, Safari, Edge, Opera
- **Desktop App** - Electron-based desktop application (Windows, macOS, Linux)
- **CLI** - Command-line interface for automation and scripting

All clients share core libraries in `/libs` for business logic, cryptography, and UI components.

### Key Concepts

| Term             | Definition                                                            |
| ---------------- | --------------------------------------------------------------------- |
| **Cipher**       | An encrypted vault item (login, card, identity, secure note, SSH key) |
| **CipherView**   | Decrypted representation of a Cipher for display                      |
| **EncString**    | Encrypted string wrapper with encryption type metadata                |
| **Vault**        | User's encrypted collection of Ciphers                                |
| **Organization** | Shared vault for team/enterprise password sharing                     |
| **Collection**   | Grouping mechanism for organizing Ciphers within Organizations        |

Some important dependencies being used are:

- Angular
- RxJS
- Tailwind
- The Bitwarden SDK (wasm rust crate)

### Typed IDs

All IDs in the codebase use branded types for type safety. Most are located in `libs/common/src/types/guid.ts`.

```typescript
export type CipherId = Opaque<string, "CipherId">;
export type SendId = Opaque<string, "SendId">;
```

### Data Model

Domains generally consists of multiple DTO layers:

- `<Domain>`: Encrypted representation of the object
- `<Domain>View`: Decrypted representations
- `<Domain>Data`: Serializeable representation for storage
- `<Domain>Response`: Response from API
- `<Domain>Export`: Export representation for exporting/importing
- `<Domain><Modifier>Request`: Requests to create/update the object

Some examples of these are `Cipher`, `Folder`, `Send`.

## Build and Development Commands

**Install dependencies** (from repo root):

```bash
npm ci
```

**Run apps in development** (from each app directory):

```bash
# Web vault (apps/web) -- also used for proxying the API calls if you're running a local server
npm run build:bit:dev:watch     # Bitwarden licensed version at http://localhost:8080
npm run build:oss:watch         # OSS version

# Browser extension (apps/browser)
npm run build:watch:chrome      # Chrome/Chromium
npm run build:watch:firefox     # Firefox
npm run build:watch:safari      # Safari

# Desktop (apps/desktop)
npm run build:main:watch        # Build main process
npm run build:renderer:watch    # Build renderer (Angular)
npm run electron                # Start Electron after building

# CLI (apps/cli)
npm run build:oss:watch
node ./build/bw.js              # Run CLI after building
```

**Linting and formatting**:

```bash
npm run lint                    # Run ESLint + Prettier check
npm run lint:fix                # Auto-fix ESLint issues
npm run prettier                # Auto-format with Prettier
```

**Testing**:

```bash
npm test                        # Run all tests across projects
npm test -- --testPathPattern="path/to/test"   # Run specific test file
npm test -- --selectProjects=@bitwarden/common # Run tests for specific project

x # In app directories (apps/web, apps/browser, etc.):
x npm test                        # Run tests for that app
x npm run test:watch              # Watch mode
```

**NX commands** (monorepo task runner):
Faster but only works XXX

```bash
npx nx test @bitwarden/common   # Test specific library
npx nx lint @bitwarden/vault    # Lint specific library
npx nx run-many -t test --all   # Run all tests
npx nx affected -t test         # Test only affected projects
```

## Critical Rules

- **NEVER** add new encryption logic to this repo—cryptographic operations belong in the SDK
- **NEVER** send unencrypted vault data to API services
- **NEVER** log decrypted data, encryption keys, or PII
- **CRITICAL**: Tailwind CSS classes MUST use the `tw-` prefix (e.g., `tw-flex`, `tw-p-4`)
- **NEVER** use TypeScript enums—use const objects with type aliases (see pattern below)
- **NEVER** use code regions—refactor for readability instead

## Monorepo Architecture

```
apps/
├── browser/     # Browser extension (Chrome, Firefox, Safari, Edge, Opera)
├── cli/         # Command-line interface
├── desktop/     # Electron desktop app
└── web/         # Web vault (Angular SPA)

libs/
├── common/      # Core business logic, models, services (shared by all clients)
├── angular/     # Angular-specific abstractions and services
├── components/  # Reusable Angular UI components (CL - Component Library)
├── platform/    # Platform abstractions (crypto, storage, messaging)
├── state/       # State management infrastructure
├── auth/        # Authentication logic
├── vault/       # Vault-specific UI and services
├── key-management/    # Key derivation, rotation, biometrics
├── billing/     # Subscription and payment logic
├── admin-console/     # Organization admin features
├── tools/       # Generator, export, send functionality
└── [team-libs]/ # Team-owned domain libraries

bitwarden_license/     # Licensed features (enterprise, premium)
├── bit-web/
├── bit-browser/
├── bit-cli/
└── bit-common/
```

**Import paths**: Use `@bitwarden/common/*`, `@bitwarden/components`, etc. (defined in `tsconfig.base.json`).

**Dependency boundaries**: Libraries cannot import from apps. Apps import from libs. Licensed code extends OSS code.

## Data Models

The codebase uses a layered model pattern:

```
Response (API) → Data (Storage) → Domain (Encrypted) → View (Decrypted)
```

| Layer        | Purpose                       | Example                                |
| ------------ | ----------------------------- | -------------------------------------- |
| **Response** | API response DTOs             | `CipherResponse`                       |
| **Data**     | JSON-serializable for storage | `CipherData`                           |
| **Domain**   | Encrypted business objects    | `Cipher` (contains `EncString` fields) |
| **View**     | Decrypted for UI display      | `CipherView` (contains plain strings)  |

**Core Types** (from `libs/common/src/types/guid.ts`):

```typescript
// Branded types for type-safe IDs
type UserId = Opaque<string, "UserId">;
type CipherId = Opaque<string, "CipherId">;
type OrganizationId = Opaque<string, "OrganizationId">;
type CollectionId = Opaque<string, "CollectionId">;
```

## Angular Patterns

When working with Angular related files (files that import anything from `@angular/*`), you MUST READ AND FOLLOW THIS FILE: `./angular.md`.

## State Management

State is managed through `StateProvider` in [`libs/state`](libs/state/README.md) with typed `KeyDefinition`s:

```typescript
// Use in service
this.state$ = this.stateProvider.getGlobal(MY_STATE).state$;
```

User-scoped state uses `UserKeyDefinition` and requires a `UserId`.

## Feature Flags

Feature flags are defined in `libs/common/src/enums/feature-flag.enum.ts`. Use `ConfigService` to check flags:

```typescript
const enabled = await this.configService.getFeatureFlag(FeatureFlag.MyFlag);
```

## Testing

### Test Structure

Tests are colocated with source files using `.spec.ts` suffix:

```
libs/common/src/vault/models/domain/cipher.ts
libs/common/src/vault/models/domain/cipher.spec.ts
```

### Test Utilities

| Utility                 | Location                                   | Purpose                          |
| ----------------------- | ------------------------------------------ | -------------------------------- |
| `mockEnc()`             | `libs/common/spec/utils.ts`                | Create mock EncString            |
| `makeStaticByteArray()` | `libs/common/spec/utils.ts`                | Create deterministic byte arrays |
| `FakeStateProvider`     | `libs/common/spec/fake-state-provider.ts`  | Mock state management            |
| `FakeAccountService`    | `libs/common/spec/fake-account-service.ts` | Mock account service             |
| `trackEmissions()`      | `@bitwarden/core-test-utils`               | Track Observable emissions       |

### Unit Test Template

```typescript
import { mock, MockProxy } from "jest-mock-extended";

describe("MyService", () => {
  let sut: MyService;
  let dependency: MockProxy<DependencyService>;

  beforeEach(() => {
    dependency = mock<DependencyService>();
    sut = new MyService(dependency);
  });

  it("should do something", () => {
    dependency.method.mockReturnValue(expected);
    const result = sut.doSomething();
    expect(result).toEqual(expected);
  });
});
```

### Component Test Template

```typescript
import { ComponentFixture, TestBed } from "@angular/core/testing";

describe("MyComponent", () => {
  let fixture: ComponentFixture<MyComponent>;
  let component: MyComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent],
      providers: [{ provide: MyService, useValue: mock<MyService>() }],
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
```

## Code Style & Standards

### Formatting

- **Prettier** for code formatting (run `npm run prettier`)
- **ESLint** for linting (run `npm run lint:fix`)
- Pre-commit hooks enforce formatting

### Naming Conventions

| Type                | Convention                 | Example             |
| ------------------- | -------------------------- | ------------------- |
| Files               | kebab-case                 | `cipher.service.ts` |
| Classes             | PascalCase                 | `CipherService`     |
| Interfaces          | PascalCase (no `I` prefix) | `CipherService`     |
| Variables/Functions | camelCase                  | `getCipher()`       |
| Constants           | SCREAMING_SNAKE_CASE       | `MAX_RETRY_COUNT`   |
| Observables         | camelCase with `$` suffix  | `ciphers$`          |

### No TypeScript Enums (ADR-0025):

```typescript
// ✅ Correct
export const CipherType = Object.freeze({
  Login: 1,
  SecureNote: 2,
} as const);
export type CipherType = (typeof CipherType)[keyof typeof CipherType];

// ❌ Wrong - don't add new enums
enum CipherType {
  Login = 1,
}
```

## Anti-Patterns

### DO

- Use `takeUntilDestroyed()` for subscription cleanup
- Use `OnPush` change detection
- Use const objects instead of enums
- Use branded types (`UserId`, `CipherId`) for IDs
- Use `async` pipe in templates
- Keep components focused and small
- Write unit tests for services
- Use dependency injection

### DON'T

- Add new TypeScript enums, instead use const objects
- Add encryption logic (use SDK)
- Log sensitive data (PII, keys, vault data)
- Use Tailwind classes without `tw-` prefix
- Create manual subscriptions without cleanup
- Import from apps in libraries
- Use `any` type without justification
- Skip the View layer for displaying data
- Use code regions

## Troubleshooting

### Common Issues

| Issue                          | Solution                                    |
| ------------------------------ | ------------------------------------------- |
| Build fails with module errors | Run `npm ci` to reinstall dependencies      |
| Tailwind styles not applying   | Ensure `tw-` prefix on all Tailwind classes |

## References

### Official Documentation

- [Clients Architecture](https://contributing.bitwarden.com/architecture/clients)
- [ADRs](https://contributing.bitwarden.com/architecture/adr/)
- [Contributing Guide](https://contributing.bitwarden.com/)
- [Code Style](https://contributing.bitwarden.com/contributing/code-style/)

### Internal Documentation

- [Security Definitions](https://contributing.bitwarden.com/architecture/security/definitions)
- [Getting Started](https://contributing.bitwarden.com/getting-started/clients/)
