# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
    
## Overview

Bitwarden client applications monorepo containing browser extension, web vault, desktop (Electron), and CLI clients. Uses Angular 20+, TypeScript, Nx build system, and npm workspaces.

- **Business Domain**: Password management, secure credential storage, enterprise identity management
- **Key Concepts**:
  - **Cipher**: The core vault item (Login, SecureNote, Card, Identity, SshKey)
  - **Collection**: Organization-level grouping of ciphers with permission-based access
  - **Folder**: User-level grouping (personal organization only)
  - **Organization**: Enterprise/team container with policies, collections, and user management
  - **Vault**: User's encrypted credential store
- **Primary Users**:
  - Individual users managing personal passwords
  - Enterprise administrators managing organization policies and users
  - Developers integrating via CLI or API
- **External Integrations**: Identity providers (SSO), directory services, SCIM provisioning, Duo/WebAuthn 2FA

## Architecture & Patterns

### Monorepo Structure

- **`apps/`** - Client applications (browser, web, desktop, cli)
- **`libs/`** - Shared libraries used across apps
- **`bitwarden_license/`** - Bitwarden-licensed code (commercial features)
  - `bit-browser/`, `bit-web/`, `bit-cli/`, `bit-common/` mirror the OSS structure

### Key Libraries

- **`libs/common`** - Core business logic, models, services (platform-agnostic)
- **`libs/angular`** - Angular-specific implementations and guards
- **`libs/components`** - Shared UI component library (Storybook: `npm run storybook`)
- **`libs/auth`** - Authentication logic and login strategies
- **`libs/vault`** - Vault management, ciphers, folders
- **`libs/key-management`** - Cryptographic operations
- **`libs/state`** - State management utilities
- **`libs/admin-console`** - Organization and collection management

### Nx Build System

Two library patterns exist:
- **Modern libraries** (e.g., `libs/state`): Native Nx executors with `@nx/js:tsc`
- **Legacy libraries** (e.g., `libs/common`): Facade pattern using `nx:run-script` to npm scripts

```bash
# View all projects
npx nx show projects

# Visualize dependency graph
npx nx dep-graph

# Build only affected projects
npx nx affected:build --base=origin/main
npx nx affected:test

# Clear build cache
npx nx reset
```

### Build Configurations

- `oss-dev` / `oss` - Open source builds
- `commercial-dev` / `commercial` - Bitwarden-licensed builds

Example: `npx nx build cli --configuration=commercial-dev`

### State Management (ADR-0003, ADR-0027)

- **Observables (RxJS)**: Service-level state and cross-component communication
- **Signals**: Component-local state only
- Use `toSignal()` to bridge service observables into signal-based components
- Services must NOT use signals for state shared with non-Angular code
- State stored via `StateProvider` with typed `StateDefinition` keys
- Per-user state separation via `UserId` for multi-account support

### Data Flow Pattern

```
API Response → CipherResponse (plain JSON)
            → CipherData (intermediate, encrypted strings)
            → Cipher (domain object, EncString fields)
            → decrypt() → CipherView (decrypted, ready for display)
            → UI/Components
```

### Platform-Specific Architecture

**Browser Extension:**
- Use `BrowserApi` abstraction, never raw `chrome.*`/`browser.*` APIs
- Use `BrowserApi.addListener()` for event listeners (Safari cleanup)
- MV3 service workers can terminate anytime - no persistent state assumptions
- See `apps/browser/CLAUDE.md` for details

**Web Vault:**
- No browser extension APIs
- Support multi-tenant organization permissions
- Don't rely on localStorage for security-critical data
- See `apps/web/CLAUDE.md` for details

**Desktop (Electron):**
- Main process: Node.js + Electron (`/apps/desktop/src/main/`)
- Renderer process: Angular app (browser-like)
- Use IPC for cross-process communication
- Never import Node.js in renderer or Angular in main
- See `apps/desktop/CLAUDE.md` for details

**CLI:**
- Output JSON when `BW_RESPONSE=true` using Response objects
- Use `CliUtils.writeLn()`, never `console.log()`
- Respect `BW_CLEANEXIT` for scripting environments
- See `apps/cli/CLAUDE.md` for details

## Stack Best Practices

### Build Commands

This repo uses Nx. Reference `project.json` files for available targets.

```bash
# Build apps (outputs to /dist/)
npx nx build cli
npx nx build @bitwarden/common  # Legacy libs include @bitwarden prefix

# Test and lint
npx nx test cli
npx nx lint cli

# Single test file
npm test -- --testPathPattern="path/to/file.spec.ts"

# Run locally built CLI
node dist/apps/cli/oss-dev/bw.js
```

### App-Specific Build Commands

**Browser Extension** (from `apps/browser/`):
```bash
npm run build:watch:chrome     # Dev build with watch
npm run build:bit:watch:chrome # Bitwarden-licensed build
```

**Web Vault** (from `apps/web/`):
```bash
npm run build:bit:dev:watch    # Dev server
npm run build:oss:watch        # OSS dev server
```

**Desktop** (from `apps/desktop/`):
```bash
npm run build:dev              # Build all (main, renderer, preload)
npm run electron               # Run Electron app
```

**CLI** (from `apps/cli/`):
```bash
npm run build:oss:watch        # Dev build with watch
```

### Linting and Formatting

```bash
npm run lint                   # ESLint + Prettier check
npm run lint:fix               # ESLint auto-fix
npm run prettier               # Prettier auto-fix
```

### Angular Conventions (ADRs)

- **Standalone components** - Default pattern, no NgModules
- **OnPush change detection** - Required for all components
- **`inject()` function** - Use instead of constructor injection
- **Signals for component state** - Local state only (ADR-0027)
- **Observables for service state** - Cross-component communication (ADR-0003)
- **No TypeScript enums** - Use const objects with type aliases (ADR-0025)
- **Visibility modifiers** - `protected` for template access, `private` for internal
- Use new control flow syntax (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`
- Use `takeUntilDestroyed()` for subscription cleanup instead of manual `destroy$` subjects

### Class Member Organization

1. Inputs → 2. Outputs → 3. ViewChild/ContentChild → 4. Injected dependencies → 5. Public properties → 6. Protected properties → 7. Private properties → 8. Lifecycle hooks → 9. Public methods → 10. Protected methods → 11. Private methods

### Type Safety Patterns

No TypeScript enums - use const objects with type aliases (ADR-0025):
```typescript
export const CipherType = Object.freeze({
  Login: 1,
  SecureNote: 2,
} as const);
export type CipherType = (typeof CipherType)[keyof typeof CipherType];
```

Use opaque ID types for compile-time safety (`libs/common/src/types/guid.ts`):
```typescript
export type OrganizationId = Opaque<string, "OrganizationId">;
export type CollectionId = Opaque<string, "CollectionId">;
export type CipherId = Opaque<string, "CipherId">;
export type UserId = Opaque<string, "UserId">;
```

### Angular Migrations

Use Angular CLI schematics (never manually migrate):
```bash
npx ng generate @angular/core:standalone --path=<directory> --mode=convert-to-standalone
npx ng generate @angular/core:control-flow
npx ng generate @angular/core:signal-input-migration
npx ng generate @angular/core:inject-migration
```

Use the `/angular-modernization` skill for migrating legacy Angular code.

### External Resources

- [Contributing Documentation](https://contributing.bitwarden.com/)
- [Clients Getting Started](https://contributing.bitwarden.com/getting-started/clients/)
- [Angular Style Guide](https://contributing.bitwarden.com/contributing/code-style/web/angular)
- [ADR Index](https://contributing.bitwarden.com/architecture/adr/)

## Anti-Patterns

### Browser Extension

| Anti-Pattern | Issue | Alternative |
|--------------|-------|-------------|
| Direct `chrome.*` or `browser.*` API usage | Cross-browser incompatibility | Use `BrowserApi` abstraction at `apps/browser/src/platform/browser/browser-api.ts` |
| `addListener()` in popup context | Safari memory leak | Use `BrowserApi.addListener()` which handles Safari cleanup |
| Using `window` object in service workers | Reference error in MV3 | Use `self` or `globalThis` |
| Injecting script elements with extension URLs | Fingerprinting vulnerability (ESLint enforced) | Use content scripts properly |
| Persistent state assumptions in MV3 | Service workers can terminate anytime | Design for stateless operation |

### Desktop (Electron)

| Anti-Pattern | Issue | Alternative |
|--------------|-------|-------------|
| Node.js imports in renderer process | IPC violations, security risk | Use preload scripts with `ipcRenderer.invoke()` |
| Angular imports in main process | Process boundary violation | Use IPC communication |

### CLI

| Anti-Pattern | Issue | Alternative |
|--------------|-------|-------------|
| `console.log()` for output | Breaks JSON output when `BW_RESPONSE=true` | Use `CliUtils.writeLn()` |
| Free-form text output | Breaks scripting | Use Response objects from `apps/cli/src/models/response/` |

### Angular

| Anti-Pattern | Issue | Alternative |
|--------------|-------|-------------|
| Signals in services | Incompatible with non-Angular code | Keep services as observables, use `toSignal()` in components |
| `effect()` for derived state | Unnecessary complexity | Use `computed()` |
| Manual subscriptions without cleanup | Memory leaks | Use `takeUntilDestroyed()` |
| `ngClass`/`ngStyle` | Performance overhead | Use `[class.*]`/`[style.*]` bindings |
| Constructor injection | Legacy pattern | Use `inject()` function |
| Default change detection | Performance issues | Use `ChangeDetectionStrategy.OnPush` |
| TypeScript enums | Bundle bloat, type issues | Use const objects (ADR-0025) |
| Mixing constructor and `inject()` | Inconsistent pattern | Use `inject()` consistently |
| Old template syntax (`*ngIf`, `*ngFor`) | Legacy pattern | Use `@if`, `@for`, `@switch` |

### Security Anti-Patterns

| Anti-Pattern | Issue | Alternative |
|--------------|-------|-------------|
| `localStorage` for security-critical data | Clearable storage in web vault | Use secure state management |
| Hardcoded colors in SVG | Theme/CSS violations (ESLint enforced) | Use CSS variables |
| Missing labels on icon buttons | Accessibility violations (ESLint enforced) | Add `label` attribute |
| Public component properties | Encapsulation violation | Use `private`/`protected` modifiers |

### Files with `// @ts-strict-ignore`

These files have TypeScript strict mode disabled and represent migration debt. Avoid adding more.

### ESLint Custom Rules

Custom rules enforced in `eslint.config.mjs`:
- `no-page-script-url-leakage` - Prevents extension URL fingerprinting
- `no-enums` - Enforces const objects over TypeScript enums
- `required-using` - Requires `using` keyword for disposable resources
- `require-theme-colors-in-svg` - Prevents hardcoded colors in SVG templates
- `require-label-on-biticonbutton` - Enforces accessibility labels

## Data Models

### Core Domain Entities

**Cipher** (`libs/common/src/vault/models/`):
- Domain model: `domain/cipher.ts` (encrypted)
- View model: `view/cipher.view.ts` (decrypted)
- Data model: `data/cipher.data.ts` (intermediate)
- Types: Login (1), SecureNote (2), Card (3), Identity (4), SshKey (5)
- Properties: `name`, `notes`, `login`, `card`, `identity`, `secureNote`, `sshKey`, `fields`, `attachments`, `passwordHistory`
- Supports individual cipher encryption via `key` field

**Login** (`libs/common/src/vault/models/domain/login.ts`):
- Properties: `uris`, `username`, `password`, `passwordRevisionDate`, `totp`, `autofillOnPageLoad`, `fido2Credentials`
- URI checksum validation for tamper detection

**Collection** (`libs/admin-console/src/common/collections/models/`):
- Organization-level grouping with permission-based access
- Properties: `id`, `organizationId`, `name`, `readOnly`, `hidePasswords`, `manage`
- Permission getters: `canEditItems(org)`, `canEdit(org)`, `canDelete(org)`

**Folder** (`libs/common/src/vault/models/`):
- User-level grouping (personal only)
- Properties: `id`, `name`, `revisionDate`

**Organization** (`libs/common/src/admin-console/models/domain/organization.ts`):
- Enterprise container with complex permission model
- User types: Owner, Admin, Member, Custom
- Feature flags: `usePolicies`, `useGroups`, `useSso`, `useSecretsManager`, etc.
- Permission getters: `canAccess`, `isAdmin`, `isOwner`, `canEditAllCiphers`, etc.

### Key Value Objects

**EncString** (`libs/key-management/crypto/models/enc-string.ts`):
- Encrypted string container with IV, MAC, and encrypted data
- Used for all sensitive fields in domain models

**Type-Safe IDs** (`libs/common/src/types/guid.ts`):
- `OrganizationId`, `CollectionId`, `CipherId`, `UserId`, `SendId`
- Opaque types for compile-time safety

### Entity Relationships

```
Organization
  ├── Collections (N:1)
  │   └── Ciphers (N:M via collectionIds)
  ├── Policies (N:1)
  └── Users/Groups

User
  ├── Folders (N:1, personal only)
  │   └── Ciphers (N:1 via folderId)
  └── Ciphers (personal, no organizationId)
```

### Validation Patterns

- URI checksum validation in `Login.decrypt()` to detect tampering
- Decryption failure handling marks ciphers with `decryptionFailure = true`
- Permission checks via `CipherAuthorizationService` using observable composition
- State definition naming rules: camelCase, >3 chars, no spaces/underscores, human-readable

## Configuration, Security, and Authentication

### Authentication Flows

**Location:** `libs/auth/src/common/login-strategies/`

Multiple login strategies using Strategy Pattern:
- **PasswordLoginStrategy**: Master password with KDF derivation
- **SsoLoginStrategy**: Single Sign-On with 2FA session tokens
- **WebAuthnLoginStrategy**: FIDO2/WebAuthn with PRF key support
- **UserApiLoginStrategy**: API key authentication (Client ID/Secret)
- **AuthRequestLoginStrategy**: Passwordless authentication

### Two-Factor Authentication

**Location:** `libs/common/src/auth/two-factor/`

Supported providers (by priority):
1. OrganizationDuo (highest)
2. WebAuthn
3. YubiKey (Premium)
4. Duo (Premium)
5. Authenticator (TOTP)
6. Email (lowest)

### Key Management

**Location:** `libs/key-management/src/`

Key hierarchy:
1. **Master Key**: Derived from master password via KDF (PBKDF2 or Argon2)
2. **User Key**: 512-bit random, encrypted with Master Key
3. **Key Pair**: RSA 2048-bit for asymmetric operations
4. **Organization Keys**: Per-org symmetric keys encrypted with user's public key
5. **Device Key**: For Trusted Device Encryption (passwordless unlock)

**Password Hashing**:
- `HashPurpose.ServerAuthorization`: Single PBKDF2 iteration (sent to server)
- `HashPurpose.LocalAuthorization`: Two PBKDF2 iterations (local validation)

### Authorization Guards

**Location:** `libs/angular/src/auth/guards/`

- **authGuard**: Primary authentication gate with TDE and password reset handling
- **lockGuard**: Vault lock screen access control
- **TwoFactorAuthGuard**: 2FA flow protection

### Token Management

**Location:** `libs/common/src/auth/services/token.service.ts`

- Access tokens (JWT) with claims: `sub`, `email`, `premium`, `sstamp` (security stamp), `orgowner`
- Refresh tokens for session extension
- Two-factor "Remember Me" tokens stored per email
- Storage locations: Memory, Disk, or Secure Storage based on vault timeout settings

### Environment Variables

**CLI-specific** (`apps/cli/src/program.ts`):
- `BW_SESSION`: Encryption session key (Base64)
- `BW_RESPONSE`: Output JSON instead of human-readable text
- `BW_QUIET`: Suppress stdout output
- `BW_RAW`: Return raw output without messages
- `BW_CLEANEXIT`: Force exit code 0 even on errors
- `BW_PRETTY`: Format JSON with indentation
- `BW_NOINTERACTION`: Prevent interactive prompts
- `BW_CLIENTID` / `BW_CLIENTSECRET`: API key authentication

**Desktop**:
- `ELECTRON_NO_UPDATER`: Disable auto-updater when set to "1"

### Build Configuration

**Config files** (`apps/*/config/`):
- `base.json`: Common settings
- `development.json`: Local development (localhost URLs, proxy settings)
- `cloud.json`: Production cloud URLs
- `selfhosted.json`: Self-hosted deployment settings

**Feature flags** (`libs/common/src/enums/feature-flag.enum.ts`):
- Server-driven flags via `/api/config` endpoint
- 1-hour cache TTL with 800ms timeout guard
- Dev flags only enabled when `ENV=development`

### Security Controls

- **Security Stamp**: JWT claim that invalidates tokens on critical account changes
- **Vault Timeout**: Configurable auto-lock with action (lock vs logout)
- **Biometric Unlock**: Optional password requirement on first unlock
- **Trusted Device Encryption**: Device-specific keys for passwordless unlock
- **Master Password Re-prompt**: Per-cipher setting for sensitive items

### API URL Configuration

**Location:** `libs/common/src/platform/services/default-environment.service.ts`

Production regions:
- US: `*.bitwarden.com`
- EU: `*.bitwarden.eu`
- Self-hosted: Custom URLs with validation

URLs configured: `api`, `identity`, `icons`, `webVault`, `notifications`, `events`, `scim`
    
