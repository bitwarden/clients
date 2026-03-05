---
name: cipher-type-planner
description: Plans the creation or modification of a cipher type (vault item type) across the Bitwarden clients monorepo. Use this skill when a user wants to add a new cipher type (e.g., BankAccount, Passport), modify an existing cipher type, or asks about what is needed to implement a cipher type. DO NOT invoke for general vault or cipher questions unrelated to adding or changing a cipher type.
user-invokable: true
argument-hint: "<cipher-type-name> - e.g., BankAccount, Passport"
---

# Cipher Type Planner

Plans the full implementation of a new or modified cipher type across all layers of the Bitwarden
clients monorepo, the server repository, and the SDK repository.

## Workflow

### Step 1: Gather Requirements

Ask the user the following questions (use `AskUserQuestion`). Adapt questions based on what
the user has already provided.

**Required questions:**

1. **Type name and value** - What is the cipher type name (e.g., `BankAccount`) and integer value
   (next available after 5 for SshKey)? If the user hasn't specified a value, suggest the next
   available integer.
2. **Fields** - What fields/properties does this cipher type have? List each field with:
   - Field name (e.g., `routingNumber`)
   - Data type (string, number, boolean)
   - Whether it is encrypted (most vault data fields should be)
   - Whether it is required
3. **Autofill** - Should this type participate in browser autofill? (Currently only Login, Card,
   and Identity support autofill.)
4. **Linked fields** - Should this type support linked custom fields? If yes, which properties
   should be linkable?
5. **Import/Export** - Should this type support import and export? Yes/No.
6. **Feature flag** - What is the feature flag name? (e.g., `vault-bank-account`.)
7. **Cross-repo status** - Has the server and/or SDK work already been completed, or does it need
   to be planned as well?

**Optional questions (ask if relevant):**

- **UI details** - Any specific UI requirements for the form or view sections? (e.g., dropdowns,
  masked fields, copy buttons)
- **Subtitle** - What should the `subTitle` getter on the view model return? (This appears in
  vault list items.)
- **Icon** - What icon should represent this type in the vault? (Bitwarden uses `bwi-` icon
  classes.)
- **Organization policy** - Should this type appear in the restricted item types policy UI?

### Step 2: Enter Plan Mode

After gathering requirements, enter plan mode using `EnterPlanMode`. Explore the codebase to
verify current patterns and file locations. Use the SshKey cipher type (value 5) as the canonical
reference for implementation patterns.

Key files to inspect for patterns:

- `libs/common/src/vault/enums/cipher-type.ts` - Enum definition
- `libs/common/src/vault/models/api/ssh-key.api.ts` - API model pattern
- `libs/common/src/vault/models/data/ssh-key.data.ts` - Data model pattern
- `libs/common/src/vault/models/domain/ssh-key.ts` - Domain model pattern
- `libs/common/src/vault/models/view/ssh-key.view.ts` - View model pattern
- `libs/common/src/models/export/ssh-key.export.ts` - Export model pattern
- `libs/common/src/vault/models/domain/cipher.ts` - Container switch patterns
- `libs/vault/src/cipher-form/components/sshkey-section/` - Form component pattern
- `libs/vault/src/cipher-view/sshkey-sections/` - View component pattern

### Step 3: Build the Plan

Write a comprehensive plan to the plan file. The plan MUST include all sections below.

---

## Plan Output Format

### 1. Overview

- **Cipher type name:** (e.g., `BankAccount`)
- **Integer value:** (e.g., `6`)
- **Feature flag:** (e.g., `pm-32009-new-item-types`)
- **Minimum client version:** (e.g., `2026.3.0`)
- **Fields:** Table of all fields with name, type, encrypted (yes/no), required (yes/no)
- **Supports autofill:** Yes/No
- **Supports linked fields:** Yes/No
- **Supports import/export:** Yes/No

### 2. Cross-Repository Prerequisites

#### SDK (`bitwarden/sdk-internal`)

- [ ] Rust enum variant in `CipherType`
- [ ] Type-specific encrypted struct (e.g., `BankAccount`)
- [ ] Type-specific decrypted struct (e.g., `BankAccountView`)
- [ ] `Encryptable`/`Decryptable` trait implementations
- [ ] Serde (de)serialization
- [ ] WASM bindings for TypeScript type generation
- [ ] Version bump

#### Server (`bitwarden/server`)

- [ ] Enum value in `src/Core/Vault/Enums/CipherType.cs`
- [ ] `Cipher<Type>Data.cs` core data model
- [ ] `Cipher<Type>Model.cs` API model with `[EncryptedString]` validation
- [ ] Request model update (`CipherRequestModel.cs`) with `[Obsolete]` typed property
- [ ] Response model update (`CipherResponseModel.cs`) with `[Obsolete]` typed property
- [ ] `CipherService.cs` serialize/deserialize cases
- [ ] `Constants.cs` - minimum version constant and feature flag key
- [ ] `SyncController.cs` - `FilterUnsupportedCipherTypes()` dual gate
- [ ] Seeder factory and DTOs
- [ ] Unit tests for API model and sync controller
- [ ] Database migration (if schema changes are needed)

### 3. Clients - New Files to Create

List every file that needs to be created, with the full path and a brief description. Organize by
layer:

**Model stack:**

- `libs/common/src/vault/models/api/<type>.api.ts` - API response shape
- `libs/common/src/vault/models/data/<type>.data.ts` - Serializable storage format
- `libs/common/src/vault/models/domain/<type>.ts` - Encrypted business object
- `libs/common/src/vault/models/domain/<type>.spec.ts` - Domain model tests
- `libs/common/src/vault/models/view/<type>.view.ts` - Decrypted view for UI
- `libs/common/src/models/export/<type>.export.ts` - Import/export serialization

**UI components:**

- `libs/vault/src/cipher-form/components/<type>-section/` - Form section component (TS, HTML, spec)
- `libs/vault/src/cipher-view/<type>-sections/` - View section component (TS, HTML)

### 4. Clients - Existing Files to Modify

List every file that needs modification, organized by concern. For each file, describe the specific
change needed.

**Core enum:**

- `libs/common/src/vault/enums/cipher-type.ts` - Add `<Type>: <N>` to `CipherType`
- `libs/common/src/vault/enums/cipher-type.spec.ts` - Update tests

**Container switches (add case for new type):**

- `libs/common/src/vault/models/data/cipher.data.ts` - Constructor
- `libs/common/src/vault/models/domain/cipher.ts` - Constructor, `decrypt()`,
  `toCipherData()`, `fromJSON()`, `toSdkCipher()`, `fromSdkCipher()`
- `libs/common/src/vault/models/view/cipher.view.ts` - `item` getter, `fromJSON()`,
  `fromSdkCipherView()`, `getSdkCipherViewType()`, `toSdkCipherView()`
- `libs/common/src/vault/models/request/cipher.request.ts` - Constructor
- `libs/common/src/vault/models/response/cipher.response.ts` - Constructor
- `libs/common/src/models/export/cipher.export.ts` - `toView()`, `toDomain()`, `build()`
- `libs/common/src/vault/services/cipher.service.ts` - `encryptCipherData()`

**SDK integration:**

- `libs/common/src/vault/models/domain/cipher-sdk-mapper.ts` - Record mapper
- Domain and view model SDK methods (`toSdk*`/`fromSdk*`)

**UI wiring:**

- `libs/vault/src/cipher-form/components/cipher-form.component.ts` - Import and wire section
- `libs/vault/src/cipher-form/components/cipher-form.component.html` - Add section template
- `libs/vault/src/cipher-view/cipher-view.component.ts` - Import and wire section
- `libs/vault/src/cipher-view/cipher-view.component.html` - Add section template
- `libs/common/src/vault/icon/build-cipher-icon.ts` - Add icon case

**Vault filters:**

- `libs/vault/src/models/vault-filter.model.ts`
- `libs/vault/src/models/filter-function.ts`
- `apps/web/src/app/vault/individual-vault/vault-filter/` (type filter)
- `apps/desktop/src/vault/app/vault/vault-filter/filters/type-filter.component.ts`
- `libs/angular/src/vault/vault-filter/components/type-filter.component.ts`

**Localization (add i18n keys):**

- `apps/web/src/locales/en/messages.json`
- `apps/desktop/src/locales/en/messages.json`
- `apps/browser/src/_locales/en/messages.json`

**Linked fields (if applicable):**

- `libs/common/src/vault/enums/linked-id-type.enum.ts`

**Autofill (if applicable):**

- List relevant autofill files from `apps/browser/src/autofill/` only if the type supports
  autofill

**Restricted item types (if applicable):**

- `apps/web/src/app/admin-console/organizations/policies/policy-edit-definitions/restricted-item-types.component.ts`
- `apps/web/src/app/admin-console/organizations/policies/policy-edit-definitions/restricted-item-types.component.html`

### 5. Localization Keys

List all i18n keys that need to be added. At minimum:

- Type label (e.g., `typeBankAccount`)
- Field labels for each type-specific field (e.g., `bankAccountRoutingNumber`)

### 6. Tests

List all test files that need to be created or updated:

- `libs/common/src/vault/enums/cipher-type.spec.ts`
- `libs/common/src/vault/models/domain/cipher.spec.ts`
- `libs/common/src/vault/models/domain/<type>.spec.ts` (new)
- `libs/common/src/vault/models/view/cipher.view.spec.ts`
- `libs/common/src/vault/services/cipher.service.spec.ts`
- `libs/common/src/vault/services/cipher-sdk.service.spec.ts`
- `libs/common/src/vault/icon/build-cipher-icon.spec.ts`
- `libs/common/src/models/export/cipher.export.spec.ts`
- `libs/vault/src/cipher-form/components/cipher-form.component.spec.ts`
- `libs/vault/src/cipher-view/cipher-view.component.spec.ts`
- Form section component spec (new)

### 7. Recommended Implementation Order

Recommended implementation order, customized for this specific type:

1. Server prerequisites (enum, models, DTOs, feature flag, version gate)
2. SDK prerequisites (Rust types, WASM bindings)
3. Core enum addition
4. Model stack (5 layers)
5. Container switch updates (7 files)
6. SDK bindings (`toSdk*`/`fromSdk*`)
7. Localization keys
8. Shared UI (icon, filters)
9. Per-app UI (form section, view section)
10. Context menu / copy actions (see Section 10)
11. Import/Export and importer migration
12. CLI
13. Autofill (if applicable)
14. Tests
15. Feature flag gating

### 8. Importer Migration

Check whether any existing importers map external data into a different cipher type that should now
use the new type. For example, the 1Password 1PUX importer
(`libs/importer/src/importers/onepassword/onepassword-1pux-importer.ts`) maps `Category.BankAccount`
to `CipherType.Card`. If a dedicated BankAccount cipher type is added, this mapping should be updated.

List all importer files that need changes, with the current mapping and the new mapping.

Key importer files to check:

- `libs/importer/src/importers/onepassword/onepassword-1pux-importer.ts`
- `libs/importer/src/importers/base-importer.ts`
- `libs/importer/src/services/import.service.ts`

### 9. Risks and Considerations

- Cross-repo coordination requirements
- Feature flag rollout strategy
- Backward compatibility concerns
- Any fields that need special encryption handling (reminder: no new encryption logic in clients)
- Performance considerations for large vaults
- **i18n key reuse** - Before adding new locale keys, check whether existing keys already have the
  desired display value. If an existing key has the same message text, reuse it instead of creating
  a duplicate. Only create new keys when no existing key matches.

### 10. Context Menu / Copy Actions

Each cipher type can expose copiable fields in the vault list item context menus (right-click / more
menu). This requires changes across **7 files** spanning core infrastructure and all 3 clients.

#### Core Infrastructure (2 files)

| File                                                    | What to add                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/vault/src/services/copy-cipher-field.service.ts`  | Add field names to the `CopyAction` type union. Add entries to the `CopyActions` record with `typeI18nKey` (i18n key for the toast message), `protected` (whether it requires password re-prompt), and optional `event` (for event collection). |
| `libs/common/src/vault/utils/cipher-view-like-utils.ts` | Add cases to `hasCopyableValue()` that check whether the cipher has a non-empty value for each copiable field (e.g., `case "accountNumber": return !!cipher.bankAccount?.accountNumber;`).                                                      |

#### Browser (2 files)

| File                                                                                              | What to add                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/browser/src/vault/popup/components/vault/item-copy-action/item-copy-actions.component.ts`   | Add a `singleCopyable<Type>` getter (for single-field quick copy button), a `has<Type>Values` getter, and a `getNumberOf<Type>Values()` method. Follow the Card pattern. |
| `apps/browser/src/vault/popup/components/vault/item-copy-action/item-copy-actions.component.html` | Add a section using `@if` syntax (NOT `*ngIf`) with the single/multi field pattern.                                                                                      |

#### Web (2 files)

| File                                                                            | What to add                                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/vault/components/vault-items/vault-cipher-row.component.ts`   | Add `is<Type>Cipher` and `hasVisible<Type>Options` getters. Add `hasVisible<Type>Options` to the `showMenuDivider` check. |
| `apps/web/src/app/vault/components/vault-items/vault-cipher-row.component.html` | Add copy buttons using `@if` syntax with `appCopyField` directive.                                                        |

#### Desktop (1 file)

| File                                                                            | What to add                                                                                                                                                                              |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src/vault/app/vault-v3/vault-items/vault-cipher-row.component.ts` | Add a `CipherType.<Type>` case to the `copyFields` computed signal, returning `CopyFieldConfig[]` entries. This is the most modern pattern — uses a computed signal rather than getters. |

#### Critical Warnings

- **CLI has no copy menu UI** — do not add copy-related i18n keys to the CLI locale.
- **Only expose fields that should be copiable** — not every cipher field needs a copy action. Check
  with product requirements for which fields get copy buttons.

---

## Key Rules

- **No new encryption logic** in the clients repo (CLAUDE.md critical rule)
- **No TypeScript enums** - use const objects with type aliases (ADR-0025)
- **No code regions** - refactor for readability instead
- **Tailwind `tw-` prefix** required for all CSS classes
- **Never log or expose decrypted vault data**
- Follow the SshKey implementation as the canonical template
- Use `@linkedFieldOption` decorators if linked fields are supported
- View models must extend `ItemView` and implement the `subTitle` getter
