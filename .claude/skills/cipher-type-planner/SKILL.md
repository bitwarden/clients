---
name: cipher-type-planner
description: Plans the creation or modification of a cipher type (vault item type) across the Bitwarden clients monorepo. Use this skill when a user wants to add a new cipher type, modify an existing cipher type, or asks about what is needed to implement a cipher type. DO NOT invoke for general vault or cipher questions unrelated to adding or changing a cipher type.
user-invocable: true
argument-hint: "target-client"
---

# Cipher Type Planner

## Workflow

### Step 1: Gather Requirements

Ask the user the following questions (use `AskUserQuestion`). Adapt questions based on what
the user has already provided.

**Required questions:**

1.  **Type name and value** - What is the cipher type name and integer value? If the user hasn't specified a value, determine the next available integer by reading the `CipherType` enum definition.
2.  **Fields** - What are the cipher's properties? Each property must contain:
    - Field name
    - Data type (string, number, boolean)
    - Encryption required?
    - Required
3.  **Target client** (`$0`) - Which client should this plan focus on? (`web`, `desktop`, `browser`, `cli`, or `all`). Shared library changes (`libs/common`, `libs/vault`) are always included; `$0` controls which `apps/*` files appear. **Skip if already provided as an argument.** Default: `all`.
4.  **Autofill** - Should this type participate in browser autofill? (Currently only Login, Card,
    and Identity support autofill.) Only ask if `$0` is `browser` or `all`.
5.  **Linked fields** - Should this type support linked custom fields? If yes, which properties
    should be linkable?
6.  **Feature flag** - What is the feature flag name?
7.  **Prerequisites** - Have all server and SDK prerequisites been completed? **Do not proceed
    with the plan until the user confirms these are done.**

**Additional questions:**

Ask each of the following. If the engineer does not have an answer, accept "N/A" or "not yet decided" and note it as a gap in the plan.

- **Import/export** - Should import/export support be included in this plan?
- **UI details** - Are there specific UI requirements for the form or view sections (e.g., dropdowns, masked fields, copy buttons)?
- **Subtitle** - What value should the `subTitle` getter on the view model return? This appears in vault list items.
- **Icon** - What icon represents this type in the vault? Bitwarden uses `bwi-` icon classes.
- **Organization policy** - Does this type appear in the restricted item types policy UI?

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

- **Cipher type name:**
- **Integer value:**
- **Feature flag:**
- **Minimum client version:**
- **Fields:** Table of all fields with name, type, encrypted (yes/no), required (yes/no)
- **Supports autofill:** Yes/No
- **Supports linked fields:** Yes/No

### 2. Clients - New Files to Create

List every file that needs to be created, with the full path and a brief description. Organize by
layer:

**Model stack:**

- `libs/common/src/vault/models/api/<type>.api.ts` - API response shape
- `libs/common/src/vault/models/data/<type>.data.ts` - Serializable storage format
- `libs/common/src/vault/models/domain/<type>.ts` - Encrypted business object
- `libs/common/src/vault/models/domain/<type>.spec.ts` - Domain model tests
- `libs/common/src/vault/models/view/<type>.view.ts` - Decrypted view for UI

**Export (if import/export is included):**

- `libs/common/src/models/export/<type>.export.ts` - Export model

**UI components:**

- `libs/vault/src/cipher-form/components/<type>-section/` - Form section component (TS, HTML, spec)
- `libs/vault/src/cipher-view/<type>-sections/` - View section component (TS, HTML)

### 3. Clients - Existing Files to Modify

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
- `libs/common/src/vault/services/cipher.service.ts` - `encryptCipherData()`

**Export (if import/export is included):**

- `libs/common/src/models/export/cipher.export.ts` - `toView()`, `toDomain()`, `build()`

**SDK integration:**

- `libs/common/src/vault/models/domain/cipher-sdk-mapper.ts` - Record mapper
- Domain and view model SDK methods (`toSdk*`/`fromSdk*`)

**UI wiring:**

- `libs/vault/src/cipher-form/components/cipher-form.component.ts` - Import and wire section
- `libs/vault/src/cipher-form/components/cipher-form.component.html` - Add section template
- `libs/vault/src/cipher-view/cipher-view.component.ts` - Import and wire section
- `libs/vault/src/cipher-view/cipher-view.component.html` - Add section template
- `libs/common/src/vault/icon/build-cipher-icon.ts` - Add icon case

**Vault filters (CRITICAL — without these, ciphers won't appear in the vault list):**

All vault filter files must be feature-flag-gated so the new type only appears when the flag is
enabled. Use `ConfigService.getFeatureFlag$()` with `combineLatest` to filter the type out of
arrays when the flag is off.

_Always included (shared):_

- `libs/vault/src/services/vault-filter.service.ts` - **CRITICAL**: Add type to `buildCipherTypeTree()` `allTypeFilters` array. Without this, ciphers of the new type will not appear in the vault sidebar or list.
- `libs/vault/src/models/filter-function.ts` - Add filter case for the new type
- `libs/angular/src/vault/components/vault-items.component.ts` - Feature-flag-gate empty state type buttons

_Include if `$0` is `web` or `all`:_

- `apps/web/src/app/vault/individual-vault/vault-filter/components/vault-filter.component.ts` - Add to `allTypeFilters`, `searchPlaceholder`, and feature-flag-gate in `buildAllFilters()`
- `apps/web/src/app/admin-console/organizations/collections/vault-filter/vault-filter.component.ts` - Feature-flag-gate in `buildAllFilters()`

_Include if `$0` is `desktop` or `all`:_

- `apps/desktop/src/vault/app/vault-v3/vault-filter/filters/type-filter.component.ts` - Add `ConfigService`, `combineLatest` with feature flag

_Include if `$0` is `browser` or `all`:_

- `apps/browser/src/vault/popup/services/vault-popup-list-filters.service.ts` - Add `ConfigService`, feature-flag-gate `cipherTypes`

**New item menus (feature-flag-gated):**

_Always included (shared):_

- `libs/common/src/vault/types/cipher-menu-items.ts` - Add menu item entry for new type
- `libs/vault/src/components/new-cipher-menu/new-cipher-menu.component.ts` - Add `canCreate<Type> = input(false)` signal, gate in `cipherMenuItems` observable

_Include if `$0` is `web` or `all`:_

- `apps/web/src/app/vault/individual-vault/vault-header/vault-header.component.ts` - Add `canCreate<Type>$` observable from feature flag
- `apps/web/src/app/vault/individual-vault/vault-header/vault-header.component.html` - Bind `[canCreate<Type>]` to `<vault-new-cipher-menu>`

_Include if `$0` is `browser` or `all`:_

- `apps/browser/src/vault/popup/components/vault/new-item-dropdown/new-item-dropdown.component.ts` - Add `ConfigService`, `combineLatest` with feature flag

**Localization (add i18n keys):**

_Include only locale files for `$0`. If `$0` is `all`, include all three:_

- `apps/web/src/locales/en/messages.json` _(web)_
- `apps/desktop/src/locales/en/messages.json` _(desktop)_
- `apps/browser/src/_locales/en/messages.json` _(browser)_

**Linked fields (if applicable):**

- `libs/common/src/vault/enums/linked-id-type.enum.ts`

**Autofill (if applicable — only if `$0` is `browser` or `all`):**

- List relevant autofill files from `apps/browser/src/autofill/` only if the type supports
  autofill

**Restricted item types (if applicable):**

Restricted item type enforcement is used across all clients. Include files for `$0`:

_Always included (shared):_

- `libs/common/src/vault/services/vault-settings/vault-settings.service.ts` - Restricted types service

_Include if `$0` is `web` or `all`:_

- `apps/web/src/app/admin-console/organizations/policies/policy-edit-definitions/restricted-item-types.component.ts` - Policy configuration UI
- `apps/web/src/app/admin-console/organizations/policies/policy-edit-definitions/restricted-item-types.component.html`

_Include if `$0` is `browser` or `all`:_

- `apps/browser/src/vault/popup/components/vault/item-more-options/item-more-options.component.ts` - Restricted type checks

_Include if `$0` is `cli` or `all`:_

- `apps/cli/src/vault/create.command.ts` - Restricted type checks
- `apps/cli/src/commands/list.command.ts` - Restricted type checks
- `apps/cli/src/commands/get.command.ts` - Restricted type checks

### 4. Localization Keys

List all i18n keys that need to be added. At minimum:

- Type label
- Field labels for each type-specific field

### 5. Tests

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

### 6. Recommended Implementation Order

Recommended implementation order, customized for this specific type. Only include steps relevant
to `$0` (shared steps are always included):

1. Core enum addition _(shared)_
2. Feature flag registration _(shared)_
3. Model stack (API, Data, Domain, View, Export if applicable) _(shared)_
4. Container switch updates _(shared)_
5. SDK bindings (`toSdk*`/`fromSdk*`) _(shared)_
6. Localization keys _(`$0`)_
7. Shared UI (icon, menu items) _(shared)_
8. Vault filters with feature flag gating — CRITICAL for ciphers to appear _(shared + `$0`)_
9. New item menus with feature flag gating _(shared + `$0`)_
10. Per-app UI (form section, view section) _(shared)_
11. Context menu / copy actions — see Section 8 _(shared + `$0`)_
12. CLI _(only if `$0` is `cli` or `all`)_
13. Autofill _(only if `$0` is `browser` or `all`)_
14. Tests _(shared + `$0`)_

### 7. Risks and Considerations

- Cross-repo coordination requirements
- Feature flag rollout strategy
- Backward compatibility concerns
- Any fields that need special encryption handling (reminder: no new encryption logic in clients)
- Performance considerations for large vaults
- **i18n key reuse** - Before adding new locale keys, check whether existing keys already have the
  desired display value. If an existing key has the same message text, reuse it instead of creating
  a duplicate. Only create new keys when no existing key matches.

### 8. Context Menu / Copy Actions

Each cipher type can expose copiable fields in the vault list item context menus (right-click / more
menu). Include only the sections relevant to `$0`.

#### Core Infrastructure (always included)

| File                                                    | What to add                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/vault/src/services/copy-cipher-field.service.ts`  | Add field names to the `CopyAction` type union. Add entries to the `CopyActions` record with `typeI18nKey` (i18n key for the toast message), `protected` (whether it requires password re-prompt), and optional `event` (for event collection). |
| `libs/common/src/vault/utils/cipher-view-like-utils.ts` | Add cases to `hasCopyableValue()` that check whether the cipher has a non-empty value for each copiable field.                                                                                                                                  |

#### Browser (include if `$0` is `browser` or `all`)

| File                                                                                              | What to add                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/browser/src/vault/popup/components/vault/item-copy-action/item-copy-actions.component.ts`   | Add a `singleCopyable<Type>` getter (for single-field quick copy button), a `has<Type>Values` getter, and a `getNumberOf<Type>Values()` method. Follow the Card pattern. |
| `apps/browser/src/vault/popup/components/vault/item-copy-action/item-copy-actions.component.html` | Add a section using `@if` syntax (NOT `*ngIf`) with the single/multi field pattern.                                                                                      |

#### Web (include if `$0` is `web` or `all`)

| File                                                                            | What to add                                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/vault/components/vault-items/vault-cipher-row.component.ts`   | Add `is<Type>Cipher` and `hasVisible<Type>Options` getters. Add `hasVisible<Type>Options` to the `showMenuDivider` check. |
| `apps/web/src/app/vault/components/vault-items/vault-cipher-row.component.html` | Add copy buttons using `@if` syntax with `appCopyField` directive.                                                        |

#### Desktop (include if `$0` is `desktop` or `all`)

| File                                                                            | What to add                                                                                                                                                                              |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src/vault/app/vault-v3/vault-items/vault-cipher-row.component.ts` | Add a `CipherType.<Type>` case to the `copyFields` computed signal, returning `CopyFieldConfig[]` entries. This is the most modern pattern — uses a computed signal rather than getters. |

#### Critical Warnings

- **CLI has no copy menu UI** — do not add copy-related i18n keys to the CLI locale.
- **Only expose fields that should be copiable** — not every cipher field needs a copy action. Check
  with product requirements for which fields get copy buttons.
