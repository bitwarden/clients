# Bitwarden Client Applications - Claude Code Configuration

Bitwarden client applications monorepo containing all non-mobile clients: web vault, browser extension, desktop app (Electron), and CLI. An open-source password manager focused on security, privacy, and cross-platform accessibility.

## Overview

### What This Project Does
- **Password Management**: Secure storage and synchronization of passwords, notes, cards, identities, and SSH keys across all platforms
- **Key Entry Points**:
  - Web Vault: `apps/web/src/main.ts` (Angular SPA)
  - Browser Extension: `apps/browser/src/popup/main.ts` (popup), `apps/browser/src/platform/background.ts` (service worker)
  - Desktop: `apps/desktop/src/main.ts` (Electron main process)
  - CLI: `apps/cli/src/bw.ts` (Node.js command-line tool)
- **Target Users**: Individual users, teams, and enterprise organizations requiring secure credential management

### Key Concepts
- **Cipher**: The core encrypted vault item (login, card, identity, secure note, SSH key)
- **Collection**: Organizational grouping for sharing ciphers with team members
- **Folder**: Personal organizational structure for ciphers (user-only, not shared)
- **Organization**: Enterprise/team account that manages users, collections, and policies
- **Master Password**: Primary authentication credential used to derive encryption keys
- **User Key**: Symmetric key that encrypts all user vault data, itself encrypted by the master key
- **Trusted Device Encryption (TDE)**: Allows device-based vault decryption without master password
- **EncString**: Encrypted string type used throughout for all sensitive data storage

---

## Architecture & Patterns

### System Architecture

```
    User Request
         |
    ┌────┴────┐
    │  Client │  (Browser/Desktop/CLI/Web)
    └────┬────┘
         │
    ┌────┴─────────────────────────────────────────┐
    │                 @bitwarden/angular           │
    │            (Shared Angular Components)       │
    └────┬─────────────────────────────────────────┘
         │
    ┌────┴─────────────────────────────────────────┐
    │                @bitwarden/auth               │
    │    (Login Strategies, Guards, 2FA, SSO)      │
    └────┬─────────────────────────────────────────┘
         │
    ┌────┴─────────────────────────────────────────┐
    │              @bitwarden/common               │
    │  (Platform-agnostic: Models, Services, Crypto)│
    └────┬─────────────────────────────────────────┘
         │
    ┌────┴─────────────────────────────────────────┐
    │           @bitwarden/key-management          │
    │      (Cryptographic Key Operations)          │
    └────┬─────────────────────────────────────────┘
         │
    ┌────┴─────────────────────────────────────────┐
    │              @bitwarden/state                │
    │        (Reactive State Management)           │
    └────┴─────────────────────────────────────────┘
         │
    Bitwarden API Server
```

### Code Organization

```
bitwarden-clients/
├── apps/
│   ├── browser/          # Chrome/Firefox/Safari/Edge extension
│   │   ├── src/popup/    # Extension popup UI
│   │   ├── src/background/  # Service worker
│   │   └── src/platform/    # BrowserApi abstraction
│   ├── cli/              # Command-line interface
│   │   ├── src/commands/ # CLI command implementations
│   │   └── src/service-container/  # DI setup
│   ├── desktop/          # Electron desktop app
│   │   ├── src/main/     # Electron main process
│   │   └── src/          # Renderer process (Angular)
│   └── web/              # Web vault (Angular SPA)
│       ├── src/app/      # Angular application
│       └── config/       # Environment configurations
├── libs/
│   ├── common/           # Platform-agnostic core (NEVER import Angular/Node here)
│   │   ├── src/vault/    # Cipher models and services
│   │   ├── src/auth/     # Auth types and utilities
│   │   └── src/platform/ # Platform abstractions
│   ├── angular/          # Shared Angular components/services
│   ├── auth/             # Authentication (login strategies, guards)
│   ├── key-management/   # Cryptographic operations
│   ├── state/            # State provider framework
│   ├── vault/            # Vault UI components
│   └── components/       # UI component library (Tailwind)
└── bitwarden_license/    # Commercial/Enterprise features
    ├── bit-browser/      # Licensed browser features
    ├── bit-cli/          # Licensed CLI features
    ├── bit-common/       # Licensed common services
    └── bit-web/          # Licensed web features
```

### Key Principles

1. **Dependency Boundaries**: `libs/` cannot import from `apps/`; `libs/common` cannot import Angular or Node
2. **OSS vs Commercial Separation**: Open-source builds exclude `bitwarden_license/`; commercial builds include it
3. **Platform Abstraction**: Use service abstractions (e.g., `BrowserApi`) instead of direct platform APIs
4. **Zero-Knowledge Architecture**: All encryption/decryption happens client-side; server never sees plaintext

### Core Patterns

#### Login Strategy Pattern

**Purpose**: Handle diverse authentication methods (password, SSO, passkey, device auth) through Strategy Design Pattern

**Implementation** (`libs/auth/src/common/login-strategies/`):
```typescript
// Each auth method has its own strategy extending the base
export abstract class LoginStrategy {
  abstract logIn(credentials: Credentials): Promise<AuthResult>;

  protected async startLogIn(): Promise<AuthResult> {
    // POST to /connect/token endpoint
    // Process IdentityTokenResponse, IdentityTwoFactorResponse, or IdentityDeviceVerificationResponse
    // Returns AuthResult for routing decisions
  }
}

// Available strategies:
// - PasswordLoginStrategy
// - SsoLoginStrategy
// - AuthRequestLoginStrategy (Login with Device)
// - WebAuthnLoginStrategy (Passkey)
// - UserApiLoginStrategy (API Key - CLI only)
```

**Usage**:
```typescript
// LoginStrategyService orchestrates strategy selection
const credentials = new PasswordLoginCredentials(email, masterPassword);
const authResult = await loginStrategyService.logIn(credentials);

if (authResult.requiresTwoFactor) {
  // Route to 2FA component
} else if (authResult.requiresDeviceVerification) {
  // Route to device verification
}
```

#### State Provider Pattern

**Purpose**: Enforce consistent state management with account switching support and clear ownership

**Implementation** (`libs/state/`):
```typescript
// Define state location and namespace
export const VAULT_DISK = new StateDefinition("vault", "disk");

// Define specific state key with cleanup behavior
const CIPHERS_STATE = new UserKeyDefinition<CipherData[]>(
  VAULT_DISK,
  "ciphers",
  {
    deserializer: (data) => data?.map(c => new CipherData(c)) ?? [],
    clearOn: ["logout"],  // Clear on logout, not lock
  }
);

// Access via StateProvider
class CipherService {
  constructor(private stateProvider: StateProvider) {}

  getCiphers$(userId: UserId): Observable<CipherData[]> {
    return this.stateProvider.getUser(userId, CIPHERS_STATE).state$;
  }

  async updateCipher(userId: UserId, cipher: CipherData): Promise<void> {
    await this.stateProvider.getUser(userId, CIPHERS_STATE).update(
      (state) => [...state.filter(c => c.id !== cipher.id), cipher],
      { shouldUpdate: (current) => !this.isEqual(current, cipher) }
    );
  }
}
```

#### Angular Guard Pattern

**Purpose**: Protect routes based on authentication state, lock status, and permissions

**Implementation** (`libs/angular/src/auth/guards/`):
```typescript
// Auth guard - redirects unauthenticated users
export const authGuard = (): CanActivateFn => {
  return async () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const authStatus = await firstValueFrom(authService.authStatus$);
    if (authStatus === AuthenticationStatus.Unlocked) {
      return true;
    }
    return router.createUrlTree(["/login"]);
  };
};

// Organization permission guard
export const orgPermissionsGuard = (permissions: OrganizationPermission[]): CanActivateFn => {
  return async (route) => {
    const organizationService = inject(OrganizationService);
    const org = await organizationService.get(route.params.organizationId);
    return permissions.every(p => org.hasPermission(p));
  };
};
```

---

## Development Guide

### Adding a New Vault Item Type

Step-by-step checklist for adding a new cipher type (e.g., the SSH Key type added recently).

**1. Define the Enum** (`libs/common/src/vault/enums/cipher-type.ts`)
```typescript
// Use const object pattern (NOT TypeScript enum per ADR-0025)
export const CipherType = {
  Login: 1,
  SecureNote: 2,
  Card: 3,
  Identity: 4,
  SshKey: 5,  // New type
} as const;
export type CipherType = (typeof CipherType)[keyof typeof CipherType];
```

**2. Create Domain Model** (`libs/common/src/vault/models/domain/ssh-key.ts`)
```typescript
export class SshKey extends Domain {
  privateKey: EncString;
  publicKey: EncString;
  fingerprint: EncString;

  constructor(obj?: SshKeyData) {
    super();
    if (obj == null) return;
    this.privateKey = new EncString(obj.privateKey);
    this.publicKey = new EncString(obj.publicKey);
    this.fingerprint = new EncString(obj.fingerprint);
  }

  async decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<SshKeyView> {
    // Implement decryption
  }
}
```

**3. Create View Model** (`libs/common/src/vault/models/view/ssh-key.view.ts`)
```typescript
export class SshKeyView implements View {
  privateKey: string;
  publicKey: string;
  fingerprint: string;

  static fromJSON(obj: Partial<Jsonify<SshKeyView>>): SshKeyView {
    return Object.assign(new SshKeyView(), obj);
  }
}
```

**4. Create Data Model** (`libs/common/src/vault/models/data/ssh-key.data.ts`)
```typescript
export class SshKeyData {
  privateKey: string;
  publicKey: string;
  fingerprint: string;

  constructor(response?: SshKeyApi) {
    if (response == null) return;
    this.privateKey = response.privateKey;
    this.publicKey = response.publicKey;
    this.fingerprint = response.fingerprint;
  }
}
```

**5. Update Cipher Model** (`libs/common/src/vault/models/domain/cipher.ts`)
```typescript
// Add property and constructor case
export class Cipher extends Domain {
  sshKey?: SshKey;

  constructor(obj?: CipherData) {
    // ...existing code...
    switch (this.type) {
      case CipherType.SshKey:
        this.sshKey = new SshKey(obj.sshKey);
        break;
    }
  }
}
```

**6. Create UI Components** (platform-specific in `apps/` or shared in `libs/vault/`)
```typescript
@Component({
  selector: 'app-ssh-key-view',
  template: `...`,
  changeDetection: ChangeDetectionStrategy.OnPush,  // Required
})
export class SshKeyViewComponent {
  protected cipher = input.required<CipherView>();  // Signal input
  protected copyText = inject(CopyService);
}
```

**7. Write Tests** (`libs/common/src/vault/models/domain/ssh-key.spec.ts`)
```typescript
describe("SshKey", () => {
  it("should decrypt ssh key fields", async () => {
    const data = new SshKeyData(mockResponse);
    const sshKey = new SshKey(data);
    const view = await sshKey.decrypt("orgId", mockKey);
    expect(view.privateKey).toBe("decrypted-private-key");
  });
});
```

### Common Patterns

#### Creating an Angular Component (Modern Pattern)

```typescript
import { Component, ChangeDetectionStrategy, inject, input, output } from "@angular/core";

@Component({
  selector: "app-example",
  templateUrl: "./example.component.html",
  // standalone: true is default, omit it
  changeDetection: ChangeDetectionStrategy.OnPush,  // REQUIRED
  imports: [CommonModule, BitButtonModule],
})
export class ExampleComponent {
  // Use inject() instead of constructor injection
  protected router = inject(Router);
  protected cipherService = inject(CipherService);

  // Signal inputs/outputs preferred
  cipherId = input.required<string>();
  onSave = output<CipherView>();

  // Use protected for template-accessible, private for internal
  protected loading = signal(false);

  protected async save(): Promise<void> {
    this.loading.set(true);
    try {
      const cipher = await this.cipherService.save(this.cipherId());
      this.onSave.emit(cipher);
    } finally {
      this.loading.set(false);
    }
  }
}
```

#### Service with State Management

```typescript
@Injectable({ providedIn: "root" })
export class FolderService {
  constructor(
    private stateProvider: StateProvider,
    private apiService: ApiService,
  ) {}

  // Expose as observable, take userId explicitly
  folders$(userId: UserId): Observable<FolderView[]> {
    return this.stateProvider.getUser(userId, FOLDERS_STATE).state$.pipe(
      map(folders => folders?.map(f => new FolderView(f)) ?? [])
    );
  }

  async createFolder(userId: UserId, name: string): Promise<void> {
    // API call first
    const response = await this.apiService.postFolder({ name });

    // Then update local state
    await this.stateProvider.getUser(userId, FOLDERS_STATE).update(
      state => [...state, new FolderData(response)]
    );
  }
}
```

#### Error Handling

```typescript
// Use typed errors for catchable conditions
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly twoFactorRequired: boolean = false,
  ) {
    super(message);
  }
}

// In services, throw specific errors
async login(credentials: PasswordLoginCredentials): Promise<AuthResult> {
  try {
    return await this.loginStrategyService.logIn(credentials);
  } catch (e) {
    if (e instanceof ErrorResponse && e.statusCode === 400) {
      throw new AuthenticationError("Invalid credentials");
    }
    throw e;
  }
}
```

---

## Data Models

### Core Types

```typescript
// Cipher - The encrypted vault item
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
  favorite: boolean;
  reprompt: CipherRepromptType;
  revisionDate: Date;
  deletedDate?: Date;
}

// CipherView - Decrypted cipher for display
interface CipherView {
  id: string;
  name: string;  // Decrypted
  notes?: string;  // Decrypted
  login?: LoginView;
  // ...other decrypted fields
}

// UserId - Branded type for type safety
type UserId = Opaque<string, "UserId">;

// EncString - Encrypted string container
class EncString {
  encryptionType: EncryptionType;
  data: string;
  iv?: string;
  mac?: string;

  static async encrypt(plaintext: string, key: SymmetricCryptoKey): Promise<EncString>;
  async decrypt(key: SymmetricCryptoKey): Promise<string>;
}
```

### State Definitions

```typescript
// State definitions follow pattern: DOMAIN_STORAGE_LOCATION
export const VAULT_DISK = new StateDefinition("vault", "disk");
export const AUTH_MEMORY = new StateDefinition("auth", "memory");

// Key definitions for specific data
const CIPHERS_KEY = new UserKeyDefinition<Record<string, CipherData>>(
  VAULT_DISK,
  "ciphers",
  {
    deserializer: (data) => data ?? {},
    clearOn: ["logout"],  // "logout", "lock", or both
  }
);

// Global state (not user-scoped)
const ENVIRONMENT_KEY = new KeyDefinition<EnvironmentData>(
  ENVIRONMENT_DISK,
  "environment",
  { deserializer: (data) => data }
);
```

---

## Security & Configuration

### Security Rules

**MANDATORY - These rules have no exceptions:**

1. **Never log sensitive data**: No passwords, keys, tokens, or plaintext vault data in console or logs
2. **Always use EncString for sensitive storage**: Never store plaintext credentials or vault content
3. **Validate all user input**: Use TypeScript types and runtime validation at system boundaries
4. **Never bypass user verification**: Master password reprompt and biometric checks are security features
5. **Clear keys on lock/logout**: Use `clearOn` in `UserKeyDefinition` to ensure proper cleanup
6. **No direct browser APIs in extension**: Always use `BrowserApi` abstraction for cross-browser safety
7. **Respect rate limiting**: Handle 429 responses gracefully; never retry aggressively

### Security Functions

| Function | Purpose | Usage |
|----------|---------|-------|
| `encryptService.encrypt()` | Encrypt plaintext with user key | All vault data before storage |
| `cryptoService.getKey()` | Get current user's encryption key | Decrypt operations only |
| `userVerificationService.verify()` | Confirm user identity | Before sensitive operations |
| `lockService.lock()` | Clear decrypted data from memory | Timeout or manual lock |
| `logoutService.logout()` | Full account cleanup | User logout or session end |

### Environment Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | No | Build environment | `development`, `production` |
| `BW_RESPONSE` | No (CLI) | Output JSON format | `true` |
| `BW_QUIET` | No (CLI) | Suppress non-essential output | `true` |
| `BW_CLEANEXIT` | No (CLI) | Exit 0 even on errors | `true` |
| `BW_SESSION` | No (CLI) | Session key for unlocked vault | `<session-token>` |

### Web Configuration Files

Located in `apps/web/config/`:
- `base.json` - Default configuration
- `development.json` - Local development (`npm run build:bit:dev:watch`)
- `cloud.json` - Production cloud deployment
- `selfhosted.json` - Self-hosted instances

```json
// Example: apps/web/config/development.json
{
  "dev": true,
  "urls": {
    "base": "https://vault.bitwarden.com",
    "api": "http://localhost:4000",
    "identity": "http://localhost:33656"
  }
}
```

### Authentication & Authorization

- **Master Password**: Derives master key via PBKDF2/Argon2; master key encrypts user key
- **Two-Factor Authentication**: TOTP, email, hardware keys (YubiKey), Duo
- **SSO**: SAML 2.0 and OpenID Connect with optional Key Connector
- **Trusted Device Encryption**: Device-stored keys for passwordless unlock
- **Organization Roles**: Owner, Admin, Manager, User with granular permissions

---

## Testing

### Test Structure

```
<project>/
├── src/
│   ├── feature/
│   │   ├── feature.component.ts
│   │   └── feature.component.spec.ts  # Co-located unit tests
│   └── services/
│       ├── feature.service.ts
│       └── feature.service.spec.ts
└── jest.config.js
```

### Writing Tests

**Unit Test Template**:
```typescript
import { mock, MockProxy } from "jest-mock-extended";

describe("CipherService", () => {
  let service: CipherService;
  let stateProvider: MockProxy<StateProvider>;
  let apiService: MockProxy<ApiService>;

  beforeEach(() => {
    stateProvider = mock<StateProvider>();
    apiService = mock<ApiService>();
    service = new CipherService(stateProvider, apiService);
  });

  describe("getCipher", () => {
    it("should return decrypted cipher", async () => {
      // Arrange
      const mockCipherData = createMockCipherData();
      stateProvider.getUser.mockReturnValue({
        state$: of({ [mockCipherData.id]: mockCipherData })
      });

      // Act
      const result = await firstValueFrom(service.getCipher$(userId, mockCipherData.id));

      // Assert
      expect(result.name).toBe("Test Cipher");
    });
  });
});
```

**State Testing with FakeStateProvider**:
```typescript
import { FakeStateProvider } from "@bitwarden/common/spec";

describe("FolderService with state", () => {
  let stateProvider: FakeStateProvider;
  let service: FolderService;

  beforeEach(() => {
    stateProvider = new FakeStateProvider();
    service = new FolderService(stateProvider);
  });

  it("should update folder state", async () => {
    // Arrange
    const userId = "user-id" as UserId;
    const fakeState = stateProvider.getUser(userId, FOLDERS_KEY);
    fakeState.nextState([]);

    // Act
    await service.createFolder(userId, "New Folder");

    // Assert
    expect(fakeState.state).toHaveLength(1);
    expect(fakeState.state[0].name).toBe("New Folder");
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific project
npx nx test web
npx nx test cli
npx nx test @bitwarden/common

# Run specific test file
npx nx test web -- --testPathPattern="cipher.service.spec.ts"

# Run with coverage
npm test -- --coverage

# Watch mode for development
npx nx test web -- --watch
```

### Test Utilities

- `libs/core-test-utils/` - Async test tools for state and clients
- `libs/state-test-utils/` - `FakeStateProvider`, `FakeGlobalState`, `FakeUserState`
- `libs/storage-test-utils/` - Mock storage implementations
- `jest-mock-extended` - Type-safe mocking library (preferred)

---

## Code Style & Standards

### Formatting

- **Prettier**: Auto-formatting with `npm run prettier`
- **Line width**: 100 characters
- **Quotes**: Double quotes for strings
- **Semicolons**: Required
- **Trailing commas**: ES5 style

### Naming Conventions

- `camelCase` for: variables, functions, methods, properties
- `PascalCase` for: classes, interfaces, types, enums (const objects), components
- `SCREAMING_SNAKE_CASE` for: `StateDefinition` exports (e.g., `VAULT_DISK`)
- `kebab-case` for: file names, CSS classes, Angular selectors

### Imports

```typescript
// 1. External packages (alphabetized)
import { Component, inject } from "@angular/core";
import { Observable } from "rxjs";

// 2. @bitwarden/* packages
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";
import { ButtonModule } from "@bitwarden/components";

// 3. Relative imports
import { FeatureComponent } from "./feature.component";
```

### Key ESLint Rules

- `no-console: error` - Use logging services, never `console.log()`
- `@typescript-eslint/no-floating-promises: error` - Always handle promises
- `@typescript-eslint/no-explicit-any: error` - Avoid `any` types
- `curly: ["error", "all"]` - Always use braces for blocks
- `@typescript-eslint/explicit-member-accessibility` - Explicit `protected`/`private` (no `public`)
- `@angular-eslint/prefer-on-push-component-change-detection` - OnPush required

### Tailwind CSS

- Use `tw-` prefix for all Tailwind classes (e.g., `tw-flex tw-gap-2`)
- Component library in `libs/components` with shared Tailwind config
- Custom utilities defined in `tailwind.config.js`

### Pre-commit Hooks

Husky runs automatically:
- `npm run lint` - ESLint checks
- `npm run prettier` - Format verification
- Commit message format validation

---

## Anti-Patterns

### DO

- ✅ Use `inject()` function for dependency injection in components
- ✅ Use signal inputs/outputs (`input()`, `output()`) over decorators
- ✅ Use `OnPush` change detection on all components
- ✅ Use `takeUntilDestroyed()` for observable subscriptions
- ✅ Use `SingleUserState` with explicit `userId` (not `ActiveUserState`)
- ✅ Use `BrowserApi` for all browser extension API calls
- ✅ Use `CliUtils.writeLn()` for CLI output
- ✅ Use const objects with type aliases instead of TypeScript enums
- ✅ Extract business logic to services, keep components thin
- ✅ Use `shouldUpdate` option in state updates to avoid redundant writes

### DON'T

- ❌ Use TypeScript `enum` keyword (use const objects per ADR-0025)
- ❌ Use `ngClass` or `ngStyle` (use `[class.*]`/`[style.*]` bindings)
- ❌ Use code regions (`#region`/`#endregion`)
- ❌ Use `ActiveUserState.update()` (deprecated, causes race conditions)
- ❌ Use `firstValueFrom()` immediately after state update (use returned value)
- ❌ Import `apps/` from `libs/`
- ❌ Import Angular/Node modules in `libs/common`
- ❌ Use direct `chrome.*`/`browser.*` APIs in extension code
- ❌ Use `console.log()` anywhere (use logging services)
- ❌ Store plaintext sensitive data in localStorage/sessionStorage
- ❌ Skip master password reprompt or user verification checks
- ❌ Hardcode API URLs or credentials

---

## Deployment

### Building

```bash
# Development builds (with hot reload)
npm run build:bit:dev:watch --prefix apps/web
npm run build:watch:chrome --prefix apps/browser
npm run build:dev --prefix apps/desktop

# Production builds
npx nx build web --configuration=commercial
npx nx build cli --configuration=oss
npx nx build browser --configuration=commercial

# Output locations
# - dist/apps/<app>/<configuration>/
# - Example: dist/apps/cli/oss-dev/bw.js
```

### Versioning

Follow semantic versioning: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking API changes, major feature overhauls
- **MINOR**: New features, backwards-compatible enhancements
- **PATCH**: Bug fixes, security patches

### CI/CD

- GitHub Actions workflows in `.github/workflows/`
- `build-*.yml` - Build and test each application
- Artifacts published to respective stores (Chrome Web Store, npm, etc.)

---

## Troubleshooting

### Common Issues

#### Browser Extension Not Loading

**Problem**: Extension fails to load in Chrome/Firefox

**Solution**:
1. Check `npm ci` completed successfully
2. Run `npm run build:watch:chrome --prefix apps/browser`
3. Load unpacked from `apps/browser/dist/`
4. Check browser console for errors
5. Verify manifest.json is valid for target browser

#### State Not Persisting

**Problem**: User data disappears after refresh

**Solution**:
1. Verify `StateDefinition` uses `"disk"` not `"memory"`
2. Check `clearOn` setting in `UserKeyDefinition`
3. Ensure proper `deserializer` implementation
4. Check browser storage limits (extension context)

#### Desktop IPC Errors

**Problem**: Communication failure between main and renderer

**Solution**:
1. Check preload script exports the IPC method
2. Verify contextIsolation settings in webPreferences
3. Ensure renderer isn't importing Node modules directly
4. Check main process logs for errors

#### CLI Session Issues

**Problem**: CLI reports "vault is locked" after unlock

**Solution**:
1. Export session: `export BW_SESSION=$(bw unlock --raw)`
2. Use `--session` flag: `bw list items --session <token>`
3. Check `BW_SESSION` environment variable is set

### Debug Tips

- **Enable verbose logging**: Set `logging.level` in configuration
- **Browser extension**: Use `chrome://extensions` -> Inspect service worker
- **Desktop**: Use `--inspect` flag for Node debugging
- **Web**: Browser DevTools with Angular DevTools extension
- **CLI**: Use `BW_DEBUG=true` environment variable

---

## References

### Official Documentation
- [Contributing Documentation](https://contributing.bitwarden.com/)
- [Clients Getting Started](https://contributing.bitwarden.com/getting-started/clients/)
- [Bitwarden Help Center](https://bitwarden.com/help/)
- [Security Whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/)

### Internal Documentation
- [Login Strategies README](libs/auth/src/common/login-strategies/README.md)
- [State Provider README](libs/state/README.md)
- [Using Nx Guide](docs/using-nx-to-build-projects.md)
- [Angular Modernization Skill](.claude/skills/angular-modernization/)

### Security & Reporting
- [Security Policy](SECURITY.md) - Responsible disclosure via HackerOne
- [HackerOne Program](https://hackerone.com/bitwarden/)

### Related Repositories
- [bitwarden/server](https://github.com/bitwarden/server) - Backend API
- [bitwarden/ios](https://github.com/bitwarden/ios) - iOS app
- [bitwarden/android](https://github.com/bitwarden/android) - Android app
