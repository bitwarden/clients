# Cipher Types Reference

> A guide for engineers adding or modifying a cipher type in the Bitwarden clients monorepo.

---

## 1. Overview

A **CipherType** is a frozen const object (following [ADR-0025](https://contributing.bitwarden.com/architecture/adr/0025-const-objects-vs-enums/)) with integer values 1-5:

| Value | Name          |
| ----- | ------------- |
| 1     | `Login`       |
| 2     | `SecureNote`  |
| 3     | `Card`        |
| 4     | `Identity`    |
| 5     | `SshKey`      |
| 6     | `BankAccount` |

**Key file:** `libs/common/src/vault/enums/cipher-type.ts`

**Helper functions** (same file):

| Function           | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `toCipherTypeName` | Returns the string key name for a `CipherType` value           |
| `isCipherType`     | Type guard - returns `true` if a value is a valid `CipherType` |
| `toCipherType`     | Converts an unknown value (including string) to `CipherType`   |

---

## 2. The Five-Layer Model Stack

Every cipher type requires classes at five layers. The table below uses **SshKey** as the canonical example.

| Layer  | Purpose                     | SshKey Example Path                                 |
| ------ | --------------------------- | --------------------------------------------------- |
| API    | Raw API response shape      | `libs/common/src/vault/models/api/ssh-key.api.ts`   |
| Data   | Serializable storage format | `libs/common/src/vault/models/data/ssh-key.data.ts` |
| Domain | Encrypted business object   | `libs/common/src/vault/models/domain/ssh-key.ts`    |
| View   | Decrypted object for UI     | `libs/common/src/vault/models/view/ssh-key.view.ts` |
| Export | Import/export serialization | `libs/common/src/models/export/ssh-key.export.ts`   |

**Data flow:** API &rarr; Data &rarr; Domain (encrypted) &rarr; View (decrypted) &rarr; Export

**Base class:** All view models extend `ItemView` (`libs/common/src/vault/models/view/item.view.ts`) which requires a `subTitle` getter. Domain models extend `Domain`.

---

## 3. Container Classes (Switch Statement Catalog)

These container classes have switch statements on `CipherType` that **must** receive a new case for each new type.

| Class / File                                                                  | Methods with switches                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `CipherData` - `libs/common/src/vault/models/data/cipher.data.ts`             | Constructor                                                                                       |
| `Cipher` - `libs/common/src/vault/models/domain/cipher.ts`                    | Constructor, `decrypt()`, `toCipherData()`, `fromJSON()`, `toSdkCipher()`, `fromSdkCipher()`      |
| `CipherView` - `libs/common/src/vault/models/view/cipher.view.ts`             | `item` getter, `fromJSON()`, `fromSdkCipherView()`, `getSdkCipherViewType()`, `toSdkCipherView()` |
| `CipherRequest` - `libs/common/src/vault/models/request/cipher.request.ts`    | Constructor                                                                                       |
| `CipherResponse` - `libs/common/src/vault/models/response/cipher.response.ts` | Constructor (conditional property instantiation, not a switch)                                    |
| `CipherExport` - `libs/common/src/models/export/cipher.export.ts`             | `toView()`, `toDomain()`, `build()` (constructor)                                                 |
| `CipherService` - `libs/common/src/vault/services/cipher.service.ts`          | `encryptCipherData()` (private)                                                                   |

---

## 4. UI Components

### 4a. Form Sections

Each cipher type has a dedicated form section component in:

`libs/vault/src/cipher-form/components/`

| Type        | Directory                |
| ----------- | ------------------------ |
| Login       | `login-details-section/` |
| Card        | `card-details-section/`  |
| Identity    | `identity/`              |
| SshKey      | `sshkey-section/`        |
| BankAccount | `bank-account-section/`  |

**Container:** The cipher form parent that wires these together:

- `libs/vault/src/cipher-form/components/cipher-form.component.ts`
- `libs/vault/src/cipher-form/components/cipher-form.component.html`
- `libs/vault/src/cipher-form/cipher-form-container.ts`

Shared sections (not type-specific but may need updates):

- `autofill-options/` - Login URIs
- `additional-options/` - Notes
- `custom-fields/` - Custom fields
- `attachments/` - File attachments
- `item-details/` - Name, folder, organization
- `cipher-generator/` - Password/username generation
- `new-item-nudge/` - New item creation nudge

### 4b. View Sections

Each cipher type has a dedicated view section component in:

`libs/vault/src/cipher-view/`

| Type        | Directory                 |
| ----------- | ------------------------- |
| Login       | `login-credentials/`      |
| Card        | `card-details/`           |
| Identity    | `view-identity-sections/` |
| SshKey      | `sshkey-sections/`        |
| BankAccount | `bank-account-sections/`  |

**Container:**

- `libs/vault/src/cipher-view/cipher-view.component.ts`
- `libs/vault/src/cipher-view/cipher-view.component.html`

### 4c. Shared Touchpoints

| Concern             | File(s)                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| Icon builder        | `libs/common/src/vault/icon/build-cipher-icon.ts` (switch on `CipherType`)          |
| Vault filter model  | `libs/vault/src/models/vault-filter.model.ts`                                       |
| Filter function     | `libs/vault/src/models/filter-function.ts`                                          |
| Web type filter     | `apps/web/src/app/vault/individual-vault/vault-filter/`                             |
| Desktop type filter | `apps/desktop/src/vault/app/vault/vault-filter/filters/type-filter.component.ts`    |
| Desktop v3 filter   | `apps/desktop/src/vault/app/vault-v3/vault-filter/filters/type-filter.component.ts` |
| Angular lib filter  | `libs/angular/src/vault/vault-filter/components/type-filter.component.ts`           |
| New item nudge      | `libs/vault/src/cipher-form/components/new-item-nudge/new-item-nudge.component.ts`  |

---

## 5. Localization

Three apps maintain independent locale files. Each new cipher type needs i18n keys for the type label and any type-specific field labels.

| App     | English locale file                          |
| ------- | -------------------------------------------- |
| Web     | `apps/web/src/locales/en/messages.json`      |
| Desktop | `apps/desktop/src/locales/en/messages.json`  |
| Browser | `apps/browser/src/_locales/en/messages.json` |
| CLI     | `apps/cli/src/locales/en/messages.json`      |

> Translations for non-English locales are handled separately via Crowdin. Only add keys to the `en` files.

---

## 6. CLI

| Concern               | File                                                                    |
| --------------------- | ----------------------------------------------------------------------- |
| Cipher response model | `apps/cli/src/vault/models/cipher.response.ts`                          |
| Get command           | `apps/cli/src/commands/get.command.ts`                                  |
| Create command        | `apps/cli/src/vault/create.command.ts`                                  |
| Delete command        | `apps/cli/src/vault/delete.command.ts`                                  |
| Restricted types svc  | `apps/cli/src/vault/services/cli-restricted-item-types.service.ts`      |
| Restricted types spec | `apps/cli/src/vault/services/cli-restricted-item-types.service.spec.ts` |

---

## 7. Import/Export

| Concern                    | File                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| Type-specific export class | `libs/common/src/models/export/ssh-key.export.ts` (example)                                        |
| Main export container      | `libs/common/src/models/export/cipher.export.ts`                                                   |
| CSV export service         | `libs/tools/export/vault-export/vault-export-core/src/services/base-vault-export.service.ts`       |
| Individual vault export    | `libs/tools/export/vault-export/vault-export-core/src/services/individual-vault-export.service.ts` |
| Org vault export           | `libs/tools/export/vault-export/vault-export-core/src/services/org-vault-export.service.ts`        |
| Import service             | `libs/importer/src/services/import.service.ts`                                                     |
| Base importer              | `libs/importer/src/importers/base-importer.ts`                                                     |

> The CSV export service (`base-vault-export.service.ts`) currently only exports Login and SecureNote types. New types may need explicit CSV column mappings or may only support JSON export.

---

## 8. SDK Integration

The clients repo bridges to `@bitwarden/sdk-internal` via mapper classes and `toSdk*`/`fromSdk*` methods on domain and view models.

| Concern                  | File                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Record mapper            | `libs/common/src/vault/models/domain/cipher-sdk-mapper.ts`                                                          |
| Domain SDK methods       | `libs/common/src/vault/models/domain/cipher.ts` (`toSdkCipher`, `fromSdkCipher`)                                    |
| View SDK methods         | `libs/common/src/vault/models/view/cipher.view.ts` (`toSdkCipherView`, `fromSdkCipherView`, `getSdkCipherViewType`) |
| Type-specific domain SDK | `libs/common/src/vault/models/domain/ssh-key.ts` (`toSdkSshKey`, `fromSdkSshKey`)                                   |
| Type-specific view SDK   | `libs/common/src/vault/models/view/ssh-key.view.ts` (`toSdkSshKeyView`, `fromSdkSshKeyView`)                        |
| SDK cipher service       | `libs/common/src/vault/services/cipher-sdk.service.ts`                                                              |
| SDK abstraction          | `libs/common/src/vault/abstractions/cipher-sdk.service.ts`                                                          |

**Pattern:** Each type-specific domain model needs `toSdk<Type>()` and `static fromSdk<Type>()` methods. Each view model needs `toSdk<Type>View()` and `static fromSdk<Type>View()` methods. The SDK types are imported from `@bitwarden/sdk-internal`.

---

## 9. Browser Extension (Autofill)

Only **Login**, **Card**, and **Identity** currently support autofill. SecureNote and SshKey do not participate in autofill.

Key autofill files that reference `CipherType`:

| Concern                      | File                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Autofill service             | `apps/browser/src/autofill/services/autofill.service.ts`                                |
| Autofill service abstraction | `apps/browser/src/autofill/services/abstractions/autofill.service.ts`                   |
| Overlay background           | `apps/browser/src/autofill/background/overlay.background.ts`                            |
| Notification background      | `apps/browser/src/autofill/background/notification.background.ts`                       |
| Context menu handler         | `apps/browser/src/autofill/browser/context-menu-clicked-handler.ts`                     |
| Cipher context menu          | `apps/browser/src/autofill/browser/cipher-context-menu-handler.ts`                      |
| Main context menu            | `apps/browser/src/autofill/browser/main-context-menu-handler.ts`                        |
| Overlay content service      | `apps/browser/src/autofill/services/autofill-overlay-content.service.ts`                |
| Inline menu list             | `apps/browser/src/autofill/overlay/inline-menu/pages/list/autofill-inline-menu-list.ts` |
| Autofill enum types          | `apps/browser/src/autofill/enums/autofill-overlay.enum.ts`                              |
| Content cipher types         | `apps/browser/src/autofill/content/components/cipher/types.ts`                          |

> If a new cipher type should support autofill, these files will need updates. Otherwise, no changes are needed.

---

## 10. Cross-Repository Dependencies

Adding a new cipher type is a **cross-repo effort** spanning three repositories.

### SDK (`bitwarden/sdk`)

High-level changes needed:

- Add a Rust enum variant to the `CipherType` enum
- Create type-specific Rust structs (encrypted + decrypted)
- Implement serde (de)serialization
- Implement `Encryptable`/`Decryptable` traits
- Add WASM bindings so the TypeScript types are generated
- Bump the SDK version

### Server (`bitwarden/server`)

High-level changes needed:

- Add a C# enum value to `src/Core/Vault/Enums/CipherType.cs`
- Database migration (if schema changes are needed)
- Domain model and DTOs (see file list below)
- Validation rules for the new type
- Event logging for audit trail
- Feature flag and sync controller version gating (see below)

#### Server files to create

| File                                                   | Purpose                                       |
| ------------------------------------------------------ | --------------------------------------------- |
| `src/Core/Vault/Models/Data/Cipher<Type>Data.cs`       | Core data model (extends `CipherData`)        |
| `src/Api/Vault/Models/Cipher<Type>Model.cs`            | API model with `[EncryptedString]` validation |
| `test/Api.Test/Vault/Models/Cipher<Type>ModelTests.cs` | Unit tests for the API model                  |
| `util/Seeder/Factories/<Type>CipherSeeder.cs`          | Dev/test seeder factory for the new type      |

#### Server files to modify

| File                                                       | Change                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| `src/Core/Vault/Enums/CipherType.cs`                       | Add enum value                                                 |
| `src/Core/Constants.cs`                                    | Add `<Type>CipherMinimumVersion` constant and feature flag key |
| `src/Api/Vault/Models/Request/CipherRequestModel.cs`       | Add property + `ToCipher<Type>Data()` method + switch case     |
| `src/Api/Vault/Models/Response/CipherResponseModel.cs`     | Add property + deserialization case                            |
| `src/Core/Vault/Services/Implementations/CipherService.cs` | Add serialize/deserialize cases                                |
| `src/Api/Vault/Controllers/SyncController.cs`              | Add version gate to `FilterUnsupportedCipherTypes()`           |
| `util/Seeder/Models/CipherViewDto.cs`                      | Add view DTO + type constant                                   |
| `util/Seeder/Models/EncryptedCipherDto.cs`                 | Add encrypted DTO                                              |
| `util/Seeder/Models/EncryptedCipherDtoExtensions.cs`       | Add `To<Type>Data()` mapping                                   |
| `test/Api.Test/Vault/Controllers/SyncControllerTests.cs`   | Add tests for version/flag gating                              |

#### Sync controller version gating

The `SyncController` filters out cipher types that the requesting client doesn't support. This prevents older clients from receiving types they can't handle. The filter lives in the private method `FilterUnsupportedCipherTypes()`.

Each new cipher type needs **two gates** in `Constants.cs`:

1. **Minimum version constant** (e.g., `BankAccountCipherMinimumVersion = "2026.2.0"`) — clients older than this version won't receive the cipher type.
2. **Feature flag key** (e.g., `FeatureFlagKeys.VaultBankAccount`) — allows disabling the type entirely during rollout.

The gating logic is: a cipher type is **filtered out** if `clientVersion < minimumVersion` OR `featureFlag is disabled`. Both conditions must pass for the type to be returned.

> **Note:** SshKey uses a single gate (version only), while BankAccount uses a dual gate (version + feature flag). Prefer the dual-gate pattern for new types so rollout can be controlled server-side.

#### `[Obsolete("Use Data instead.")]` pattern

The server is migrating toward a single `Data` JSON string property on request/response models. Per-type properties (e.g., `SSHKey`, `BankAccount`) are still present for backwards compatibility but are marked `[Obsolete("Use Data instead.")]`. New types should follow this pattern: add the typed property for older clients, mark it obsolete, and ensure the `Data` JSON path also works.

> The clients repo consumes server API contracts via `CipherResponse` and SDK types via `@bitwarden/sdk-internal`. Coordinate version bumps across all three repos.

---

## 11. Restricted Item Types

The `RestrictedItemTypesService` (`libs/common/src/vault/services/restricted-item-types.service.ts`) dynamically determines which cipher types an organization restricts via policy. **No client code change is typically needed** when adding a new type - the service reads the policy configuration from the server.

However, if the new type should appear in the policy configuration UI:

- `apps/web/src/app/admin-console/organizations/policies/policy-edit-definitions/restricted-item-types.component.ts`
- `apps/web/src/app/admin-console/organizations/policies/policy-edit-definitions/restricted-item-types.component.html`

CLI restricted types service:

- `apps/cli/src/vault/services/cli-restricted-item-types.service.ts`

---

## 12. Linked Fields (Optional)

Linked fields allow custom fields to reference a specific property of a cipher type. Not all types support linked fields (SshKey and SecureNote do not).

**Key file:** `libs/common/src/vault/enums/linked-id-type.enum.ts`

Current linked ID const objects:

| Type     | Const Object       | ID Range |
| -------- | ------------------ | -------: |
| Login    | `LoginLinkedId`    |  100-101 |
| Card     | `CardLinkedId`     |  300-305 |
| Identity | `IdentityLinkedId` |  400-418 |

The union type `LinkedIdType = LoginLinkedId | CardLinkedId | IdentityLinkedId` must be expanded if the new type supports linked fields.

In the view model, properties that can be linked are decorated with `@linkedFieldOption`. The view model's `linkedFieldOptions` map (from `ItemView`) is populated from these decorators.

---

## 13. Tests

| Test Area                     | File(s)                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| Cipher type enum              | `libs/common/src/vault/enums/cipher-type.spec.ts`                                                       |
| Domain model                  | `libs/common/src/vault/models/domain/cipher.spec.ts`                                                    |
| Domain type-specific (SshKey) | `libs/common/src/vault/models/domain/ssh-key.spec.ts`                                                   |
| View model                    | `libs/common/src/vault/models/view/cipher.view.spec.ts`                                                 |
| Cipher service                | `libs/common/src/vault/services/cipher.service.spec.ts`                                                 |
| Cipher SDK service            | `libs/common/src/vault/services/cipher-sdk.service.spec.ts`                                             |
| Cipher encryption service     | `libs/common/src/vault/services/default-cipher-encryption.service.spec.ts`                              |
| Icon builder                  | `libs/common/src/vault/icon/build-cipher-icon.spec.ts`                                                  |
| Export model                  | `libs/common/src/models/export/cipher.export.spec.ts`                                                   |
| Cipher form component         | `libs/vault/src/cipher-form/components/cipher-form.component.spec.ts`                                   |
| Cipher view component         | `libs/vault/src/cipher-view/cipher-view.component.spec.ts`                                              |
| Restricted types              | `libs/common/src/vault/services/restricted-item-types.service.spec.ts`                                  |
| CLI restricted types          | `apps/cli/src/vault/services/cli-restricted-item-types.service.spec.ts`                                 |
| Import service                | `libs/importer/src/services/import.service.spec.ts`                                                     |
| Export services               | `libs/tools/export/vault-export/vault-export-core/src/services/individual-vault-export.service.spec.ts` |

---

## 14. Recommended Order of Operations

1. **Server** - Add enum value, domain model, DTOs, validation, feature flag, minimum version constant, and sync controller version gating
2. **SDK** - Add Rust enum variant, type structs, serde, crypto traits, and WASM bindings
3. **Clients: Core enum** - Add value to `CipherType` in `libs/common/src/vault/enums/cipher-type.ts`
4. **Clients: Model stack** - Create the 5 model layer files (API, Data, Domain, View, Export)
5. **Clients: Container switches** - Add cases in `CipherData`, `Cipher`, `CipherView`, `CipherRequest`, `CipherResponse`, `CipherExport`, and `CipherService.encryptCipherData()`
6. **Clients: SDK bindings** - Add `toSdk*`/`fromSdk*` methods on domain and view models; update `CipherRecordMapper` if needed
7. **Clients: Localization** - Add i18n keys to `en/messages.json` in web, desktop, browser, and CLI
8. **Clients: Shared UI** - Update icon builder, vault filters, and any shared components
9. **Clients: Per-app UI** - Add form section and view section components; wire into container templates
10. **Clients: Import/Export** - Update `CipherExport` switch cases; update CSV export if applicable; update importers
11. **Clients: CLI** - Update cipher response model, get/create commands
12. **Clients: Autofill** - Only if the new type participates in autofill (Login/Card/Identity only today)
13. **Clients: Tests** - Add/update specs for all touched files; add type-specific domain and view specs
14. **Feature flag** - Gate the new type behind a feature flag for incremental rollout

---

## 15. Complete File Checklist

### New files to create

- [ ] `libs/common/src/vault/models/api/<type>.api.ts`
- [ ] `libs/common/src/vault/models/data/<type>.data.ts`
- [ ] `libs/common/src/vault/models/domain/<type>.ts`
- [ ] `libs/common/src/vault/models/domain/<type>.spec.ts`
- [ ] `libs/common/src/vault/models/view/<type>.view.ts`
- [ ] `libs/common/src/models/export/<type>.export.ts`
- [ ] `libs/vault/src/cipher-form/components/<type>-section/` (component TS, HTML, spec)
- [ ] `libs/vault/src/cipher-view/<type>-sections/` (component TS, HTML)

### Existing files to modify

**Core:**

- [ ] `libs/common/src/vault/enums/cipher-type.ts` - Add new value
- [ ] `libs/common/src/vault/enums/cipher-type.spec.ts` - Update tests

**Container switches:**

- [ ] `libs/common/src/vault/models/data/cipher.data.ts` - Constructor
- [ ] `libs/common/src/vault/models/domain/cipher.ts` - 6 methods
- [ ] `libs/common/src/vault/models/view/cipher.view.ts` - 5 methods
- [ ] `libs/common/src/vault/models/request/cipher.request.ts` - Constructor
- [ ] `libs/common/src/vault/models/response/cipher.response.ts` - Constructor
- [ ] `libs/common/src/models/export/cipher.export.ts` - 3 methods
- [ ] `libs/common/src/vault/services/cipher.service.ts` - `encryptCipherData()`

**UI:**

- [ ] `libs/vault/src/cipher-form/components/cipher-form.component.html` - Add section
- [ ] `libs/vault/src/cipher-form/components/cipher-form.component.ts` - Wire section
- [ ] `libs/vault/src/cipher-view/cipher-view.component.html` - Add section
- [ ] `libs/vault/src/cipher-view/cipher-view.component.ts` - Wire section
- [ ] `libs/common/src/vault/icon/build-cipher-icon.ts` - Add icon case

**Localization:**

- [ ] `apps/web/src/locales/en/messages.json`
- [ ] `apps/desktop/src/locales/en/messages.json`
- [ ] `apps/browser/src/_locales/en/messages.json`
- [ ] `apps/cli/src/locales/en/messages.json`

**CLI:**

- [ ] `apps/cli/src/vault/models/cipher.response.ts`
- [ ] `apps/cli/src/commands/get.command.ts`

**Import/Export:**

- [ ] `libs/tools/export/vault-export/vault-export-core/src/services/base-vault-export.service.ts`

**Linked fields (if applicable):**

- [ ] `libs/common/src/vault/enums/linked-id-type.enum.ts`

---

## Historical Reference

The **BankAccount** cipher type (value `6`) was the most recently added type and serves as the best template.

Use `git log --all --oneline --grep="BankAccount"` to find related commits.

**SshKey** (value `5`) is the previous reference implementation:

- `b18fa68acc` - Initial SshKey model stack and container switch additions
- `081fe83d83` - SshKey UI components (form and view sections)

Use `git log --all --oneline --grep="SshKey"` to find additional related commits.
