# Bitwarden Clients Repository Guide

## Overview

This is the Bitwarden clients monorepo containing 4 main applications (Browser Extension, Web Vault, Desktop, CLI) and 30+ shared libraries. Bitwarden is a password manager and digital vault platform that uses end-to-end encryption to secure user credentials, identity information, payment cards, secure notes, and SSH keys.

### Key Concepts
- **Vault**: Collection of encrypted items (ciphers) belonging to a user or organization
- **Cipher**: A vault item containing encrypted credentials, notes, cards, identity info, or SSH keys
- **Collection**: Organizational grouping of ciphers with permission-based access
- **Organization**: Multi-user entity for sharing and managing vaults across teams
- **Master Password**: Primary credential used to derive the master key for vault decryption
- **Passwordless Auth**: Login with Device authentication method requiring approval from existing session
- **Item-Level Encryption**: Per-cipher encryption keys (server version 2024.2.0+)
- **Trusted Device Encryption**: Ability to decrypt vault without master password on trusted devices

### Primary User Workflows
1. **Individual User**: Create account → Set master password → Add/generate credentials → Auto-fill passwords
2. **Organization Admin**: Create org → Invite members → Create collections → Share ciphers → Enforce policies
3. **Enterprise SSO**: Configure identity provider → Enable SSO → Users authenticate via SAML/OIDC
4. **CLI Automation**: Authenticate with API key → Retrieve secrets → Integrate with CI/CD pipelines

### External Integrations
- **Bitwarden Server API**: REST API for vault operations, authentication, and sync
- **Identity Provider (IdP)**: SAML/OIDC SSO integration via oidc-client-ts
- **Bitwarden SDK**: Rust WASM SDK (@bitwarden/sdk-internal) for cryptographic operations
- **Notification Hub**: SignalR real-time updates for vault sync events
- **Payment Gateway**: Braintree for billing and subscription management
- **Native Messaging**: Browser extension ↔ Desktop app communication for biometric unlock

## Architecture & Patterns

### Monorepo Structure
Built on **Nx 21.6** with npm workspaces:

```
/apps/                      # 4 client applications
  ├── browser/             # Web extension (Manifest V3) - Chrome, Firefox, Safari, Edge, Opera, Brave, Vivaldi
  ├── web/                 # Angular web vault application (multi-tenant organization features)
  ├── desktop/             # Electron desktop application (IPC architecture)
  └── cli/                 # Node.js command-line interface (JSON output mode)

/libs/                      # 30+ shared libraries organized by team ownership
  ├── auth/                # Authentication API (Login strategies, 2FA, SSO)
  ├── vault/               # Vault management API (Ciphers, folders, collections)
  ├── platform/            # Core platform services (crypto, storage, i18n)
  ├── state/               # StateProvider framework (observable state management)
  ├── components/          # UI component library (Tailwind CSS + Angular)
  ├── key-management/      # Cryptography & key rotation
  ├── tools/               # Password generator, Send, Import/Export
  ├── billing/             # Subscription & payment management
  ├── admin-console/       # Organization & policy administration
  ├── common/              # Legacy business logic (being refactored into team libs)
  └── [20+ other specialized libraries]

/bitwarden_license/        # Commercial features (separate licensing)
```

### Team-Based Library Ownership
Each team owns specific libraries with public APIs:
- **Platform Team**: @bitwarden/platform, @bitwarden/state, @bitwarden/logging, @bitwarden/serialization
- **Auth Team**: @bitwarden/auth
- **Vault Team**: @bitwarden/vault
- **Tools Team**: @bitwarden/tools
- **UI Foundation Team**: @bitwarden/components, @bitwarden/ui-common
- **Admin Console Team**: @bitwarden/admin-console

**Rule**: No direct imports across team boundaries - use published @bitwarden/* packages via barrel exports (index.ts).

### Service Architecture
**Abstraction-First Design**:
- Abstract service interfaces defined in `abstractions/` folders
- Concrete implementations in default files or separate implementation files
- Dependency injection via Angular providers or ServiceContainer (CLI)
- Services registered at app initialization with proper lifetime management

**Service Layers**:
1. **API Services**: HTTP communication with Bitwarden server (domain-specific, replacing monolithic ApiService)
2. **Domain Services**: Business logic and orchestration (CipherService, FolderService, CollectionService)
3. **Platform Services**: Infrastructure concerns (CryptoService, StorageService, TokenService)
4. **State Services**: Observable state management via StateProvider framework

### State Management Framework
**StateProvider Pattern** (ADR-documented):

```typescript
// 1. Define StateDefinition (owned by Platform team)
const MY_FEATURE = new StateDefinition("myFeature", "disk");

// 2. Define KeyDefinition with deserializer
const MY_KEY = new KeyDefinition<MyData>(MY_FEATURE, "myKey", {
  deserializer: (obj) => MyData.fromJSON(obj),
});

// 3. Inject StateProvider and access state
constructor(private stateProvider: StateProvider) {}

const state$ = this.stateProvider.getUser(userId, MY_KEY).state$;
await state.update((current) => ({ ...current, newProperty: value }));
```

**Key Features**:
- **Observable Streams**: RxJS observables for reactive state updates
- **Storage Locations**: Disk (persisted) vs Memory (session-only)
- **Automatic Cleanup**: State cleared on logout/lock with configurable delays
- **Type Safety**: Full TypeScript support with deserializers
- **Derived State**: Computed values from multiple state sources

**Critical Rules**:
- **DO NOT** use `ActiveUserState` - race condition risk on account switching
- **ALWAYS** prefer `SingleUserState` with explicit userId
- **AVOID** `firstValueFrom()` - state updates not guaranteed to emit before read
- **USE** `update()` return value if you need the updated value synchronously

### Domain Model Layers
**Three-Layer Architecture**:

1. **Data Layer** (`models/data/`): JSON-safe data models for storage/transport
   - Example: `CipherData`, `FolderData`, `CollectionData`
   - Used for API responses and local storage

2. **Domain Layer** (`models/domain/`): Encrypted domain objects with business logic
   - Example: `Cipher`, `Folder`, `Collection`
   - Properties are `EncString` (encrypted strings)
   - Contains decryption methods and validation logic

3. **View Layer** (`models/view/`): Decrypted view models for UI
   - Example: `CipherView`, `FolderView`, `CollectionView`
   - Plain-text properties for display
   - Read-only representations after decryption

**Data Flow**:
```
API Response (JSON) → Data Model → Domain Model (encrypted) → View Model (decrypted) → UI
```

### Cross-Platform Abstraction
**BrowserApi** (browser extension only):
- Abstraction layer over Web Extensions API
- Handles Chrome, Firefox, Safari, Edge, Opera, Brave, Vivaldi differences
- Critical methods:
  - `BrowserApi.addListener()` - Safari memory leak prevention in popup
  - `BrowserApi.tabsQueryFirstCurrentWindowForSafari()` - Safari tab query bug workaround
  - Manifest V3 service worker support (background pages deprecated)

**PlatformUtilsService**:
- Cross-platform utilities (device type detection, clipboard, biometrics)
- Different implementations for web, desktop, browser, CLI

### Communication Patterns
- **Event Bus**: Deprecated messagingService being replaced by StateProvider observables
- **IPC (Desktop)**: Electron main ↔ renderer process communication via ipcMain/ipcRenderer
- **Native Messaging**: Browser extension ↔ Desktop app for biometric unlock
- **SignalR**: Real-time vault sync events from server
- **Observables**: RxJS for reactive data streams throughout the codebase

## Stack Best Practices

### TypeScript Conventions
- **Strict Mode**: Disabled globally (technical debt, gradual migration)
- **Path Aliases**: Configured for all @bitwarden/* internal modules
- **Decorators**: Angular decorators (@Injectable, @Component, @Directive)
- **Async/Await**: Preferred over promise chains
- **Type Safety**: Use interfaces and types over `any` (eslint rule enforced)

### Angular Patterns
- **Framework Version**: Angular 20.3 (latest)
- **Dependency Injection**: Constructor injection for services
- **Component Architecture**: Smart (container) vs Dumb (presentational) components
- **Change Detection**: OnPush strategy for performance-critical components
- **Reactive Forms**: Typed reactive forms with validation
- **Lazy Loading**: Route-based code splitting for modules
- **Angular Modernization**: `/angular-modernization` skill available for updating components/directives

### RxJS Best Practices
- **Operators**: Use pipeable operators (map, filter, switchMap, tap)
- **Subscriptions**: Unsubscribe in ngOnDestroy or use async pipe
- **BehaviorSubject**: For state management in services
- **combineLatest**: Combine multiple observables
- **shareReplay**: Share observable results across subscribers

### Dependency Injection
- **Service Registration**: Providers defined in @Injectable({ providedIn: 'root' }) or module/component providers
- **Service Lifetime**: Singleton (root), module-scoped, or component-scoped
- **Factory Providers**: Use factories for conditional instantiation
- **Injection Tokens**: InjectionToken for non-class dependencies

### Error Handling
- **ErrorResponse**: Structured API error responses with validation errors
- **ErrorService**: Global error handling and logging
- **Validation Errors**: Map field-specific errors to form controls
- **Toast Notifications**: Display user-friendly error messages via ToastService
- **Sentry Integration**: Error reporting in production builds

### Testing Patterns
- **Framework**: Jest 29.5 with jest-preset-angular
- **Fake Providers**: Use FakeStateProvider instead of mocks for StateProvider
- **Mock Extended**: jest-mock-extended for type-safe mocks
- **Component Testing**: Angular TestBed with fixture.detectChanges()
- **Service Testing**: Unit tests with dependency mocks
- **Storybook**: Visual regression testing with Chromatic
- **Accessibility**: axe-playwright for a11y testing

## Anti-Patterns

### Platform-Specific API Usage
- **NEVER** use `chrome.*` or `browser.*` APIs directly in shared code
- **ALWAYS** use BrowserApi abstraction in browser extension
- **NEVER** assume browser extension APIs exist in web vault
- **NEVER** import Node.js modules in Electron renderer process (use IPC)

### State Management Anti-Patterns
- **AVOID** ActiveUserState.update() - race condition on account switching
- **NEVER** use firstValueFrom() for state reads - updates not guaranteed to emit
- **DO NOT** create multiple StateDefinitions for the same feature (use single definition with multiple keys)
- **AVOID** storing secrets in memory storage - use disk storage with proper encryption

### Security Anti-Patterns
- **NEVER** log sensitive data (passwords, keys, tokens, user data)
- **NEVER** expose EncString decryption errors to UI (information disclosure)
- **DO NOT** hardcode secrets or API keys
- **AVOID** storing unencrypted data in browser localStorage (use EncString)
- **NEVER** trust client-side validation alone (server validates all inputs)

### Performance Anti-Patterns
- **AVOID** synchronous crypto operations in UI thread (use Web Workers or async)
- **DO NOT** load entire vault at once (lazy load ciphers as needed)
- **NEVER** create subscriptions without cleanup (memory leaks)
- **AVOID** deep object cloning in hot paths (use structural sharing)

### Code Organization Anti-Patterns
- **NEVER** import from other team's internal files (use public API barrel exports)
- **AVOID** circular dependencies (detected by Nx and ESLint)
- **DO NOT** use deprecated ApiService directly (extract to domain API services)
- **NEVER** mix business logic into components (use services)

### CLI-Specific Anti-Patterns
- **NEVER** use console.log() directly - use CliUtils.writeLn() or ConsoleLogService
- **ALWAYS** output structured JSON when `process.env.BW_RESPONSE === "true"`
- **RESPECT** BW_CLEANEXIT environment variable (exit code 0 on errors for scripting)

### Testing Anti-Patterns
- **AVOID** testing implementation details (test public API and behavior)
- **DO NOT** use real crypto operations in tests (mock or use test vectors)
- **NEVER** commit focused tests (fit, fdescribe) - CI will fail

## Data Models

### Core Cipher Model
**CipherType Enumeration**:
```typescript
CipherType = {
  Login: 1,        // Username/password credentials (URIs, TOTP, FIDO2 passkeys)
  SecureNote: 2,   // Encrypted notes
  Card: 3,         // Credit/debit cards (number, CVV, expiration)
  Identity: 4,     // Personal identity (name, address, SSN, passport)
  SshKey: 5,       // SSH keys (private key, public key, fingerprint)
}
```

**Cipher Domain Model Properties**:
- **Core**: id (string), name (EncString), type (CipherType), favorite (boolean)
- **Organization**: organizationId, collectionIds, organizationUseTotp
- **Hierarchy**: folderId (personal folder), deletedDate (soft delete)
- **Type-Specific**: login, card, identity, secureNote, sshKey (discriminated union)
- **Extensions**: attachments, fields (custom fields), passwordHistory
- **Security**: reprompt (CipherRepromptType - require re-authentication), key (item-level encryption key)
- **Metadata**: creationDate, revisionDate, localData (client-only data)
- **Permissions**: edit, viewPassword, CipherPermissionsApi (organization permissions)

**Login Model** (most common cipher type):
- **uris**: Array of LoginUri with match detection strategies (domain, host, starts with, regex, exact, never)
- **username**, **password**: EncString
- **totp**: EncString (TOTP secret for 2FA code generation)
- **fido2Credentials**: Array of FIDO2 passkeys
- **autofillOnPageLoad**: boolean (auto-fill preference)
- **passwordRevisionDate**: Date (last password change)

### Encryption Models
**EncString** (encrypted string format):
- **Format**: `<type>.<iv>|<data>|<mac>` (type 0-6)
- **Types**:
  - 0: AesCbc256_B64
  - 1: AesCbc128_HmacSha256_B64
  - 2: AesCbc256_HmacSha256_B64 (most common)
  - 3: Rsa2048_OaepSha256_B64
  - 4: Rsa2048_OaepSha1_B64
  - 5: Rsa2048_OaepSha256_HmacSha256_B64
  - 6: Rsa2048_OaepSha1_HmacSha256_B64

**Key Hierarchy**:
```
Master Password + KDF (PBKDF2/Argon2) → Master Key
  → User Key (random symmetric key)
    → Organization Keys (shared keys)
    → Cipher Item Keys (per-item encryption)
      → EncString (encrypted field data)
```

### Organization & Sharing Models
- **Organization**: id, name, seats, useTotp, useGroups, useDirectory, selfHost, planType
- **Collection**: id, name, organizationId, externalId, readOnly, hidePasswords, manage
- **OrganizationUser**: id, userId, organizationId, type (Owner/Admin/User/Custom), status, permissions
- **Group**: id, name, organizationId, accessAll, externalId, collections

### Policy Models
**PolicyType Enumeration** (admin-enforced rules):
- TwoFactorAuthentication (1): Require 2FA for all users
- MasterPassword (2): Enforce master password complexity
- PasswordGenerator (3): Default password generator settings
- SingleOrg (4): Restrict users to single organization
- RequireSso (5): Mandate SSO authentication
- PersonalOwnership (6): Disable personal vault items
- DisableSend (7): Prohibit Send feature usage
- SendOptions (8): Configure Send restrictions
- ResetPassword (9): Allow admin password reset
- MaximumVaultTimeout (10): Enforce vault timeout limits
- DisablePersonalVaultExport (11): Block personal vault export

### Import/Export Models
- **Export Formats**: JSON (encrypted/unencrypted), CSV, Encrypted JSON
- **Import Formats**: 50+ supported (1Password, LastPass, Dashlane, KeePass, Chrome, Firefox, etc.)
- **ImportCiphersRequest**: Bulk cipher import with folder/collection mapping
- **ExportRequest**: Include/exclude folders, collections, organizations

## Configuration, Security, and Authentication

### Environment Configuration
**Environment Files** (apps/*/src/environments/):
- `environment.ts`: Development configuration
- `environment.prod.ts`: Production configuration
- `environment.qa.ts`, `environment.dev.ts`: QA/Dev server overrides

**Key Configuration**:
- `production`: boolean (enables optimizations, disables debug)
- `urls`: API server endpoints (base, api, identity, icons, notifications, events, webVault)
- `flags`: Feature flags for A/B testing and gradual rollouts
- `region`: Cloud region selection (US, EU, self-hosted)

**Environment Variables**:
- **CLI**: `BW_RESPONSE`, `BW_SESSION`, `BW_CLEANEXIT`, `BW_NOINTERACTION`, `BW_CLIENTID`, `BW_CLIENTSECRET`
- **Desktop**: `ELECTRON_IS_DEV`, `BITWARDENCLI_APPDATA_DIR`
- **Browser**: Set via build configurations (oss-dev, oss, commercial-dev, commercial)

### Secrets Management
- **1Password Integration**: Desktop app can read secrets from 1Password vaults
- **Key Storage**: Platform-specific secure storage
  - macOS: Keychain
  - Windows: Credential Manager (DPAPI)
  - Linux: libsecret (GNOME Keyring, KWallet)
  - Browser: extension.storage with encryption
- **DO NOT**: Store secrets in code, environment files, or logs

### Authentication Flows

**5 Authentication Methods**:

1. **Master Password** (PasswordLoginStrategy)
   - User enters email + master password
   - Derive master key using KDF (PBKDF2 SHA-256 or Argon2id)
   - POST /connect/token with grant_type=password
   - Receive access/refresh tokens + encrypted keys

2. **Login with Device** (AuthRequestLoginStrategy)
   - Passwordless authentication via existing device approval
   - User requests auth on new device
   - Existing device receives push/email notification
   - Approve → new device receives encrypted keys
   - No master password required on trusted devices

3. **Single Sign-On** (SsoLoginStrategy)
   - Organization configures SAML/OIDC identity provider
   - User redirects to IdP for authentication
   - Callback with authorization code
   - POST /connect/token with grant_type=authorization_code
   - Decrypt organization vault with user key

4. **WebAuthn/Passkey** (WebAuthnLoginStrategy)
   - PRF (Pseudo-Random Function) extension for key derivation
   - Biometric or security key authentication
   - Browser WebAuthn API integration
   - Derive encryption keys from passkey

5. **API Key** (UserApiLoginStrategy - CLI only)
   - Generate API key (client_id + client_secret) in web vault
   - POST /connect/token with grant_type=client_credentials
   - Non-interactive authentication for automation

**Common Flow**:
```
LoginComponent
  → Build credentials (email, masterPassword, etc.)
  → LoginStrategyService.logIn(credentials)
    → Initialize appropriate LoginStrategy
    → POST /connect/token (TokenRequest)
    → Process IdentityTokenResponse
      → Success: AuthResult with tokens
      → TwoFactor: Prompt for 2FA code
      → DeviceVerification: Email verification required
  → Handle AuthResult
    → Navigate to vault
    → Store tokens (TokenService)
    → Initialize vault state (SyncService)
```

### Two-Factor Authentication
**Supported Providers**:
- Authenticator (TOTP): Google Authenticator, Authy, etc.
- Email: Verification codes via email
- YubiKey: Hardware security key (OTP mode)
- FIDO2 WebAuthn: Security keys and platform authenticators
- Duo: Duo Security push notifications
- OrganizationDuo: Organization-managed Duo

**2FA Flow**:
1. Initial login returns TwoFactorProviderType in error response
2. Prompt user for 2FA code based on enabled providers
3. Retry login with `twoFactorToken` and `twoFactorProvider` parameters
4. Optional "remember device" to skip 2FA for 30 days

### Session Management
**Token Lifecycle**:
- **Access Token**: Short-lived (1 hour), sent in Authorization header
- **Refresh Token**: Long-lived (30 days), used to obtain new access tokens
- **Auto-Refresh**: TokenService automatically refreshes before expiration
- **Revocation**: Tokens invalidated on logout, password change, or admin action

**Vault Timeout**:
- **Lock**: Vault locked, master password/biometric required to unlock
- **Logout**: Complete logout, removes all data (configurable per timeout)
- **Timeout Options**: Immediate, 1/5/15/30/60 minutes, 4/24 hours, never, on system idle, on system lock

**Biometric Unlock** (Desktop/Mobile):
- Store master key encrypted with biometric-protected key
- Native platform biometric APIs (Touch ID, Face ID, Windows Hello, fingerprint)
- Browser extension can request Desktop app unlock via native messaging

### API Security
**Request Authentication**:
- **Authorization Header**: `Bearer <access_token>`
- **Device Identification**: Device-type, device-name, device-id headers
- **Client Version**: Client-version header for compatibility checks

**Rate Limiting**:
- Server returns 429 Too Many Requests with Retry-After header
- Client respects rate limits with exponential backoff
- Critical endpoints: /connect/token, /accounts/register, /api/accounts/password

**Data Validation**:
- Server validates all inputs (client validation is UX only)
- ErrorResponse with field-specific validation errors
- Client maps errors to form controls for display

### Compliance & Security Controls
- **Encryption at Rest**: All vault data encrypted with user keys
- **Zero-Knowledge Architecture**: Server never has access to unencrypted vault data
- **Audit Logs**: Organization events logged for compliance
- **Data Residency**: EU cloud option for GDPR compliance
- **SOC 2 Type 2**: Annual compliance audit
- **Password Policies**: Configurable complexity requirements
- **Session Recording Prevention**: Sensitive fields flagged for anti-screen-capture

### Security Best Practices for Development
- **Input Validation**: Validate and sanitize all user inputs (XSS prevention)
- **SQL Injection**: Server uses parameterized queries (DO NOT concatenate SQL)
- **CSRF Protection**: Anti-forgery tokens on state-changing operations
- **Content Security Policy**: Strict CSP headers in web vault
- **Dependency Scanning**: Automated vulnerability scanning in CI
- **Secrets in Code**: Use git-secrets pre-commit hook to prevent committing secrets
- **Logging**: NEVER log passwords, keys, tokens, or PII
- **Error Messages**: DO NOT expose sensitive information in error messages to UI

---

## Quick Reference

### Build Commands
```bash
# Build applications
npx nx build browser --configuration=commercial-dev
npx nx build web
npx nx build desktop
npx nx build cli

# Test
npx nx test [project]

# Lint & Format
npm run lint
npm run lint:fix
npm run prettier

# Serve
npx nx serve web

# Storybook
npm run storybook
```

### Critical Development Rules
1. **Browser APIs**: Always use BrowserApi abstraction (never chrome.* or browser.* directly)
2. **State Management**: Prefer SingleUserState over ActiveUserState (avoid race conditions)
3. **CLI Output**: Use CliUtils.writeLn() and respect BW_RESPONSE environment variable
4. **Cross-Team Imports**: Only import from @bitwarden/* barrel exports (no internal paths)
5. **ApiService**: Deprecated - extract methods to domain-specific API services
6. **Logging**: NEVER log sensitive data (passwords, keys, tokens, PII)
7. **Security**: Validate inputs, avoid SQL injection, use parameterized queries, respect CSP

### App-Specific Context Files
- `apps/browser/CLAUDE.md`: Browser extension Manifest V3 patterns
- `apps/web/CLAUDE.md`: Web vault multi-tenant features
- `apps/desktop/CLAUDE.md`: Electron IPC architecture
- `apps/cli/CLAUDE.md`: CLI JSON output rules

### Key Documentation
- `docs/using-nx-to-build-projects.md`: Comprehensive Nx build guide
- `libs/state/README.md`: StateProvider framework documentation
- `libs/auth/src/common/login-strategies/README.md`: Authentication flow diagrams

### License Structure
- **GPL-3.0**: Open-source code (main repository)
- **Bitwarden License Agreement**: Commercial code (bitwarden_license/ directory)

---

**Last Updated**: 2026-01-13 by Bitwarden Init Plugin

For additional context, see app-specific CLAUDE.md files and team-owned library README files throughout the monorepo.
