# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

### What This Project Does
- Open-source password manager client applications (browser extension, CLI, desktop, web vault)
- Securely stores, generates, and autofills passwords, cards, identities, and secure notes
- Entry points: `apps/browser/`, `apps/cli/`, `apps/desktop/`, `apps/web/`

### Key Concepts
- **Cipher**: Core vault item type (Login, SecureNote, Card, Identity, SshKey)
- **Collection**: Permission-based grouping of ciphers within organizations
- **Organization**: Business entity grouping users with role-based access control
- **Three-Layer Model**: Domain (encrypted) → Data (serialized) → View (decrypted)
- **EncString**: Encrypted string wrapper supporting multiple encryption algorithms
- **User Key**: 512-bit symmetric key derived from master password, encrypts all vault data

---

## Architecture & Patterns

### System Architecture
```
                     User Request
                          ↓
    ┌─────────────────────────────────────────────────────┐
    │                   Client Apps                        │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐ │
    │  │ Browser  │  │   CLI    │  │ Desktop  │  │ Web  │ │
    │  │Extension │  │          │  │(Electron)│  │Vault │ │
    │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──┬───┘ │
    └───────┼─────────────┼────────────┼───────────┼──────┘
            │             │            │           │
            └─────────────┴─────┬──────┴───────────┘
                                ↓
    ┌─────────────────────────────────────────────────────┐
    │                  Shared Libraries                    │
    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
    │  │ common  │  │  vault  │  │  auth   │  │key-mgmt │ │
    │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘ │
    │       └────────────┴────────────┴────────────┘      │
    │                         ↓                            │
    │  ┌─────────────────────────────────────────────────┐│
    │  │     platform / state / angular / components     ││
    │  └─────────────────────────────────────────────────┘│
    └─────────────────────────────────────────────────────┘
                                ↓
    ┌─────────────────────────────────────────────────────┐
    │              Bitwarden Server API                    │
    │        (identity, vault, notifications)              │
    └─────────────────────────────────────────────────────┘
```

### Code Organization
```
bitwarden-clients/
├── apps/
│   ├── browser/              # Chrome/Firefox/Safari/Edge extension
│   ├── cli/                  # Command-line interface
│   ├── desktop/              # Electron desktop app
│   └── web/                  # Angular web vault
├── libs/
│   ├── common/               # Core platform-agnostic business logic
│   ├── vault/                # Vault item (cipher) management
│   ├── auth/                 # Authentication strategies & guards
│   ├── key-management/       # Cryptographic operations
│   ├── angular/              # Angular-specific implementations
│   ├── components/           # Shared UI component library (Storybook)
│   ├── state/                # Reactive state management
│   ├── platform/             # Platform abstractions
│   └── admin-console/        # Organization/admin features
├── bitwarden_license/        # Commercial/enterprise features
│   ├── bit-browser/          # Licensed browser features
│   ├── bit-cli/              # Licensed CLI features
│   ├── bit-common/           # Licensed common features
│   └── bit-web/              # Licensed web features (Secrets Manager)
└── package.json              # Root workspace configuration
```

### Key Principles
1. **Library Dependency Hierarchy**: Lower layers cannot import from higher:
   - Core: `guid`, `logging`, `serialization`, `storage-core`
   - Platform: `platform`, `messaging`, `state`, `key-management`
   - Domain: `common`, `auth`, `vault`, `tools`, `billing`
   - Angular: `angular`, `components`, domain-specific UI libs
   - Apps: code in `apps/` and `bitwarden_license/`

2. **No TypeScript Enums (ADR-0025)**: Use const objects with type aliases
3. **Signals for Local State, Observables for Services (ADR-0003, ADR-0027)**
4. **OnPush Change Detection**: All Angular components use OnPush
5. **Three-Layer Model Pattern**: Separate Domain, Data, and View models

### Core Patterns

#### No TypeScript Enums Pattern
**Purpose**: Avoid TypeScript enum pitfalls, improve tree-shaking and type safety

**Implementation**:
```typescript
// libs/common/src/vault/enums/cipher-type.ts
const _CipherType = Object.freeze({
  Login: 1,
  SecureNote: 2,
  Card: 3,
  Identity: 4,
  SshKey: 5,
} as const);

export type CipherType = _CipherType[keyof _CipherType];
export const CipherType: typeof _CipherType = _CipherType;

// Type guard
export const isCipherType = (value: unknown): value is CipherType => {
  return Object.values(CipherType).includes(value as CipherType);
};
```

**Usage**:
```typescript
import { CipherType, isCipherType } from "@bitwarden/common/vault/enums";

const type: CipherType = CipherType.Login;
if (isCipherType(unknownValue)) {
  // Type-safe usage
}
```

#### Three-Layer Model Pattern
**Purpose**: Separate encrypted storage from decrypted UI representation

**Implementation**:
```typescript
// Domain Model (encrypted) - libs/common/src/vault/models/domain/cipher.ts
export class Cipher extends Domain {
  name: EncString;           // Encrypted
  notes?: EncString;
  login?: Login;

  async decrypt(key: SymmetricCryptoKey): Promise<CipherView>;
}

// Data Model (serialized) - libs/common/src/vault/models/data/cipher.data.ts
export class CipherData {
  name: string;              // Base64 encrypted string
  notes?: string;
  login?: LoginData;
}

// View Model (decrypted) - libs/common/src/vault/models/view/cipher.view.ts
export class CipherView {
  name: string;              // Plaintext
  notes?: string;
  login: LoginView;
}
```

#### State Management Pattern
**Purpose**: Reactive, user-scoped state with automatic persistence

**Implementation**:
```typescript
// libs/state/src/core/user-state.ts
const MY_STATE = new UserKeyDefinition<MyData>(
  MY_STATE_DISK,
  "myData",
  { clearOn: ["logout"] }
);

@Injectable()
export class MyService {
  private stateProvider = inject(StateProvider);

  myData$ = this.stateProvider.activeUserId$.pipe(
    switchMap(userId => this.stateProvider.getUser(userId, MY_STATE).state$)
  );

  async updateData(data: MyData): Promise<void> {
    await this.stateProvider.getActive(MY_STATE).update(() => data);
  }
}
```

---

## Development Guide

### Build & Development Commands

This is an Nx monorepo. Use Nx commands for all operations:

```bash
# Build
npx nx build <project>              # Build a project (cli, web, browser, desktop)
npx nx build <project> --configuration=commercial-dev  # Bitwarden-licensed build

# Test
npx nx test <project>               # Run tests for a project
npm run test -- --testPathPattern="path/to/file"  # Run single test file

# Lint
npx nx lint <project>               # Lint a project
npm run lint                        # Lint entire repo
npm run lint:fix                    # Auto-fix lint issues

# Serve (development)
npx nx serve web                    # Serve web vault locally
npx nx build:watch browser          # Watch mode for browser extension

# Storybook (component library)
npm run storybook                   # Run Storybook for components lib

# Cache management
npx nx reset                        # Clear Nx cache
```

Legacy libraries use `@bitwarden/` prefix: `npx nx build @bitwarden/common`

### Adding New Vault Item Type

1. **Define the enum value**:
```typescript
// libs/common/src/vault/enums/cipher-type.ts
const _CipherType = Object.freeze({
  // ... existing types
  MyNewType: 6,
} as const);
```

2. **Create domain model**:
```typescript
// libs/common/src/vault/models/domain/my-new-type.ts
export class MyNewType extends Domain {
  field1?: EncString;
  field2?: EncString;

  async decrypt(key: SymmetricCryptoKey): Promise<MyNewTypeView> {
    return this.decryptObj(/* ... */);
  }
}
```

3. **Create data model**:
```typescript
// libs/common/src/vault/models/data/my-new-type.data.ts
export class MyNewTypeData {
  field1?: string;
  field2?: string;
}
```

4. **Create view model**:
```typescript
// libs/common/src/vault/models/view/my-new-type.view.ts
export class MyNewTypeView implements View {
  field1?: string;
  field2?: string;
}
```

5. **Update Cipher class to include the new type**

6. **Write tests**:
```typescript
// libs/common/src/vault/models/domain/my-new-type.spec.ts
describe("MyNewType", () => {
  // See existing cipher type tests for patterns
});
```

### Common Patterns

#### Angular Component Pattern
```typescript
@Component({
  selector: "app-my-component",
  templateUrl: "./my-component.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,  // Required
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class MyComponent {
  // Use inject() instead of constructor injection
  private myService = inject(MyService);
  private destroyRef = inject(DestroyRef);

  // protected for template access, private for internal
  protected data$ = this.myService.data$;

  // Use toSignal() to bridge observables
  protected dataSignal = toSignal(this.data$);

  ngOnInit() {
    this.myService.someObservable$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(/* ... */);
  }
}
```

#### Error Handling Pattern
```typescript
try {
  const result = await this.apiService.post(request);
  // Success handling
} catch (e) {
  if (e instanceof ErrorResponse) {
    // Handle API error with user-friendly message
    this.toastService.showToast({
      variant: "error",
      title: this.i18nService.t("errorOccurred"),
      message: e.getSingleMessage(),
    });
  }
  throw e;  // Re-throw for upstream handling
}
```

---

## Data Models

### Core Types
```typescript
// Cipher - Core vault item
interface Cipher {
  id: string;
  organizationId?: string;
  folderId?: string;
  type: CipherType;
  name: EncString;
  notes?: EncString;
  login?: Login;
  card?: Card;
  identity?: Identity;
  secureNote?: SecureNote;
  sshKey?: SshKey;
  fields?: Field[];
  attachments?: Attachment[];
  collectionIds: string[];
  reprompt: CipherRepromptType;
  key?: EncString;  // Cipher-specific encryption key
}

// Collection - Permission-based cipher grouping
interface Collection {
  id: CollectionId;
  organizationId: OrganizationId;
  name: EncString;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;
}

// Organization - Business entity
interface Organization {
  id: OrganizationId;
  name: string;
  type: OrganizationUserType;
  permissions: PermissionsApi;
  enabled: boolean;
}

// Branded ID types for type safety
type UserId = string & { __type: "UserId" };
type OrganizationId = string & { __type: "OrganizationId" };
type CollectionId = string & { __type: "CollectionId" };
```

### EncString - Encrypted Data Wrapper
```typescript
// libs/common/src/key-management/crypto/models/enc-string.ts
class EncString {
  encryptionType?: EncryptionType;
  data?: string;      // Base64 encrypted data
  iv?: string;        // Base64 initialization vector
  mac?: string;       // Base64 MAC for authentication

  // Supported encryption types:
  // - AesCbc256_HmacSha256_B64 (current standard)
  // - Rsa2048_OaepSha256_B64 (asymmetric)
  // - CoseEncrypt0 (V2 encryption for new accounts)
}
```

### Validation Patterns
Validation is inline rather than using Zod/JSON schemas:
```typescript
// KDF validation
validateKdfConfigForSetting(): void {
  if (!PBKDF2KdfConfig.ITERATIONS.inRange(this.iterations)) {
    throw new Error(`PBKDF2 iterations must be between ${min} and ${max}`);
  }
}

// Type guards
const isCipherType = (value: unknown): value is CipherType => {
  return Object.values(CipherType).includes(value as CipherType);
};
```

---

## Security & Configuration

### Security Rules
**MANDATORY - These rules have no exceptions:**

1. **Never use `chrome.*` or `browser.*` APIs directly** - Use `BrowserApi` abstraction for cross-browser compatibility
2. **Never store master password** - Only derived keys are persisted
3. **Never skip input validation at system boundaries** - Validate all external input
4. **Never import from commercial code into OSS** - `apps/` cannot import from `bitwarden_license/`
5. **Never import app code into libs** - Libraries cannot import from `apps/`
6. **Clear sensitive data on lock/logout** - Use state definitions with proper `clearOn` settings

### Security Functions
| Function | Purpose | Usage |
|----------|---------|-------|
| `encryptService.encryptString()` | Encrypt plaintext | Creating cipher data |
| `encryptService.decryptString()` | Decrypt EncString | Displaying vault items |
| `keyService.getUserKey()` | Get user's encryption key | Before any encryption/decryption |
| `tokenService.getAccessToken()` | Get API access token | API calls requiring auth |
| `masterPasswordService.getMasterKey()` | Get master key (memory only) | Password verification |

### Environment Configuration
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `BW_SESSION` | CLI only | Session key for CLI | Base64 string |
| `BW_RESPONSE` | CLI only | Output structured JSON | `"true"` |
| `BW_QUIET` | CLI only | Suppress stdout | `"true"` |
| `BW_CLEANEXIT` | CLI only | Exit code 0 on errors | `"true"` |
| `BITWARDENCLI_DEBUG` | CLI only | Enable debug logging | `"true"` |
| `BITWARDENCLI_APPDATA_DIR` | CLI only | Override data directory | `/path/to/dir` |
| `NODE_ENV` | Build | Build mode | `development`/`production` |
| `ENV` | Build | Config profile to load | `development`/`qa`/`production` |

### Authentication & Authorization
- **Login Strategies**: Password, SSO, WebAuthn, UserApiKey, AuthRequest
- **Token Storage**: Prefer secure OS storage → disk (encrypted) → memory
- **Token Encryption**: Access tokens encrypted on disk with secure-storage-only key
- **Two-Factor**: Supports TOTP, WebAuthn, Duo, email codes
- **Session Management**: Configurable timeout with Lock or Logout actions
- **Route Guards**: `TwoFactorAuthGuard`, `organizationPermissionsGuard`, auth status guards

---

## Testing

### Test Structure
```
libs/
├── core-test-utils/          # Observable tracking utilities
├── state-test-utils/         # FakeStateProvider, FakeSingleUserState
├── storage-test-utils/       # FakeStorageService
└── common/spec/              # Custom matchers, account mocks
```

### Writing Tests

#### Unit Test Template
```typescript
import { mock, MockProxy } from "jest-mock-extended";
import { FakeSingleUserStateProvider } from "@bitwarden/state-test-utils";

describe("MyService", () => {
  let myService: MyService;
  let dependencyMock: MockProxy<DependencyService>;
  let stateProvider: FakeSingleUserStateProvider;

  beforeEach(() => {
    // Arrange
    dependencyMock = mock<DependencyService>();
    stateProvider = new FakeSingleUserStateProvider();

    myService = new MyService(dependencyMock, stateProvider);
  });

  it("should do something", async () => {
    // Arrange
    dependencyMock.method.mockResolvedValue(expectedValue);

    // Act
    const result = await myService.doSomething();

    // Assert
    expect(result).toEqual(expectedValue);
    expect(dependencyMock.method).toHaveBeenCalledWith(expectedArg);
  });
});
```

#### Observable Test Template
```typescript
import { subscribeTo } from "@bitwarden/common/spec";
import { trackEmissions } from "@bitwarden/core-test-utils";

it("should emit values", async () => {
  // Arrange
  const tracker = subscribeTo(myService.data$);

  // Act
  await myService.updateData(newValue);

  // Assert
  const emission = await tracker.expectEmission();
  expect(emission).toEqual(newValue);
});
```

### Running Tests
```bash
npm test                              # Run all tests
npm run test:watch                    # Watch mode
npm run test -- --testPathPattern="path/to/file"  # Run specific file
npx nx test <project>                 # Test specific project
```

### Test Environment
- **Jest Configuration**: `jest.config.js` in root and per-project
- **Setup Files**: `test.setup.ts` configures webcrypto, custom matchers
- **Mocking**: Use `jest-mock-extended` for type-safe mocks
- **State Mocking**: Use `FakeStateProvider` from `@bitwarden/state-test-utils`

---

## Code Style & Standards

### Formatting
- **Prettier**: Auto-formats all files
- **ESLint**: TypeScript and Angular linting
- **Config**: `eslint.config.mjs`, `.prettierrc`

### Naming Conventions
- `camelCase`: variables, functions, methods
- `PascalCase`: types, interfaces, classes, components
- `SCREAMING_SNAKE_CASE`: constants (via const objects)
- `*Service`: Injectable services
- `*Component`: Angular components
- `*Guard`: Route guards
- `*.spec.ts`: Test files

### Imports
```typescript
// Order (enforced by eslint-plugin-import):
// 1. External packages (alphabetized)
import { Component } from "@angular/core";
import { Observable } from "rxjs";

// 2. @bitwarden packages (alphabetized)
import { CipherService } from "@bitwarden/common/vault/services";
import { CipherView } from "@bitwarden/common/vault/models/view";

// 3. Relative imports (alphabetized)
import { MyLocalService } from "./my-local.service";
```

### Comments
- Use JSDoc for public APIs and complex functions
- Inline comments for non-obvious logic
- ADR references for architectural decisions (e.g., `// ADR-0025`)

### Pre-commit Hooks
- **Husky**: Runs lint-staged on commit
- **lint-staged**: Prettier + ESLint on staged files
- Manual: Run `npm run lint` before pushing

---

## Anti-Patterns

### DO
- ✅ Use `BrowserApi` abstraction for extension APIs
- ✅ Use `inject()` function for Angular dependency injection
- ✅ Use `OnPush` change detection for all components
- ✅ Use `takeUntilDestroyed()` for observable subscriptions
- ✅ Use const objects instead of TypeScript enums
- ✅ Use `protected` for template-accessible members
- ✅ Clear sensitive data with proper `clearOn` state definitions
- ✅ Validate input at system boundaries
- ✅ Use `CliUtils.writeLn()` in CLI (respects env vars)
- ✅ Use IPC for Electron main/renderer communication

### DON'T
- ❌ Use `chrome.*` or `browser.*` APIs directly (Safari memory leaks)
- ❌ Use `console.log()` in CLI (breaks JSON output)
- ❌ Use TypeScript enums (use const objects per ADR-0025)
- ❌ Use constructor injection (use `inject()`)
- ❌ Use `ngClass`/`ngStyle` (use `[class.*]`/`[style.*]`)
- ❌ Use structural directives (use `@if`, `@for`, `@switch`)
- ❌ Import from `apps/` into `libs/`
- ❌ Import from `bitwarden_license/` into `apps/`
- ❌ Import Node.js modules in browser/renderer process
- ❌ Import Angular modules in Electron main process
- ❌ Store master password (only derived keys)
- ❌ Hardcode credentials or API keys
- ❌ Skip input validation at boundaries
- ❌ Use `window` object in browser extension background scripts

---

## Deployment

### Building
```bash
# Build specific app
npx nx build web
npx nx build browser
npx nx build desktop
npx nx build cli

# Commercial builds
npx nx build web --configuration=commercial-dev
npx nx build browser --configuration=commercial-dev
```

### Versioning
- Monorepo uses unified versioning
- Version defined in root `package.json`
- Semantic versioning for releases

### Publishing/Deploying
```bash
# Web vault
npx nx build web --configuration=production
# Deploy dist/apps/web to web server

# Browser extension
npx nx build browser --configuration=production
# Upload dist/apps/browser to extension stores

# CLI
npx nx build cli --configuration=production
npm publish --workspace=apps/cli
```

---

## Troubleshooting

### Common Issues

#### Build Failures
**Problem**: `npx nx build` fails with dependency errors
**Solution**: Clear Nx cache with `npx nx reset`, then `npm install`

#### Safari Extension Memory Leaks
**Problem**: Extension consumes excessive memory in Safari
**Solution**: Use `BrowserApi.addListener()` instead of native `chrome.*.addListener()`

#### CLI JSON Output Broken
**Problem**: CLI output isn't valid JSON when `BW_RESPONSE=true`
**Solution**: Use `CliUtils.writeLn()` instead of `console.log()`

#### State Not Persisting
**Problem**: User data not persisting across app restarts
**Solution**: Check state definition `clearOn` settings, ensure proper `StorageLocation`

#### Tests Failing with Crypto Errors
**Problem**: Tests fail with "crypto is not defined"
**Solution**: Ensure `test.setup.ts` configures `webcrypto` polyfill

### Debug Tips
- Enable verbose logging: `BITWARDENCLI_DEBUG=true` (CLI)
- Check Nx cache: `npx nx graph` to visualize dependencies
- Clear all caches: `npx nx reset && rm -rf node_modules && npm install`
- Browser DevTools: Check extension background page console
- Desktop: Use Electron DevTools (View → Toggle Developer Tools)

---

## References

### Official Documentation
- [Contributing Guide](https://contributing.bitwarden.com/)
- [Architecture Decision Records](https://contributing.bitwarden.com/architecture/adr/)
- [Angular Documentation](https://angular.dev/)
- [Nx Documentation](https://nx.dev/)
- [RxJS Documentation](https://rxjs.dev/)

### Internal Documentation
- `apps/browser/CLAUDE.md` - Browser extension (BrowserApi, MV3, Safari quirks)
- `apps/cli/CLAUDE.md` - CLI (JSON output, environment variables)
- `apps/desktop/CLAUDE.md` - Electron (main/renderer process separation, IPC)
- `apps/web/CLAUDE.md` - Web vault (no extension APIs, organization permissions)

### Tools & Libraries
- [Jest](https://jestjs.io/) - Testing framework
- [jest-mock-extended](https://github.com/marchaos/jest-mock-extended) - Type-safe mocking
- [Storybook](https://storybook.js.org/) - Component documentation
- [TailwindCSS](https://tailwindcss.com/) - CSS framework
- [Lit](https://lit.dev/) - Web components (used in autofill overlay)

### Angular Modernization
Use `/angular-modernization` skill to modernize components using CLI migrations and Bitwarden patterns.
