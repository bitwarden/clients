---
paths:
  - "libs/common/src/vault/models/domain/**"
  - "libs/common/src/vault/models/view/**"
  - "libs/common/src/vault/models/data/**"
  - "libs/common/src/vault/services/cipher.service.ts"
  - "libs/common/src/vault/abstractions/cipher.service.ts"
---

# Vault SDK Sync

Cipher models and operations are mirrored in `bitwarden/sdk-internal` (`crates/bitwarden-vault/src/`). The SDK is the source of truth; drift between the two causes silent data loss when ciphers round-trip through `toSdk`/`fromSdk`.

## Model Changes

When a field is added, removed, renamed, or retyped on a model below, flag it and remind the author to:

- Make the matching change in the SDK struct listed below. For sensitive fields (name, notes, type data, custom fields, password history), also update the blob schema in `cipher/blob/v1.rs` and `cipher/blob/conversions/<type>.rs`.
- Update the model's `toSdk*`/`fromSdk*` mappings (and `fromSdkLocalData`/`toSdkLocalData` for `LocalData`).
- Bump `@bitwarden/sdk-internal` once the SDK change ships, if the field must round-trip.

| Model (`libs/common/src/vault/`)                                                                            | SDK file (`crates/bitwarden-vault/src/`) |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `models/domain/cipher.ts`, `models/view/cipher.view.ts`, `models/data/cipher.data.ts`                       | `cipher/cipher.rs`                       |
| `attachment`                                                                                                | `cipher/attachment.rs`                   |
| `bank-account`                                                                                              | `cipher/bank_account.rs`                 |
| `card`                                                                                                      | `cipher/card.rs`                         |
| `drivers-license`                                                                                           | `cipher/drivers_license.rs`              |
| `field`                                                                                                     | `cipher/field.rs`                        |
| `identity`                                                                                                  | `cipher/identity.rs`                     |
| `login`, `login-uri`, `fido2-credential`                                                                    | `cipher/login.rs`                        |
| `passport`                                                                                                  | `cipher/passport.rs`                     |
| `secure-note`                                                                                               | `cipher/secure_note.rs`                  |
| `ssh-key`                                                                                                   | `cipher/ssh_key.rs`                      |
| `models/domain/password.ts`, `models/view/password-history.view.ts`, `models/data/password-history.data.ts` | `password_history.rs`                    |
| `models/data/local.data.ts`                                                                                 | `cipher/local_data.rs`                   |

Rows without a path cover `models/domain/<name>.ts`, `models/view/<name>.view.ts`, and `models/data/<name>.data.ts`. Data models round-trip to the SDK through `CipherRecordMapper` (`models/domain/cipher-sdk-mapper.ts`).

## CipherService

- New cipher operations **MUST** go through the SDK: server operations (CRUD, share, attachments, collections) via `CipherSdkService`, and encryption/decryption via `CipherEncryptionService`. Flag any new `CipherService` method that calls `ApiService` or `EncryptService` directly.
- Legacy non-SDK paths exist only behind SDK feature flags and are slated for removal. Flag changes that extend them rather than the SDK path.
