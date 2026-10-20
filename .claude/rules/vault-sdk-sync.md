---
paths:
  - "libs/common/src/vault/models/domain/**"
  - "libs/common/src/vault/models/view/**"
  - "libs/common/src/vault/models/data/local.data.ts"
  - "libs/common/src/vault/services/cipher.service.ts"
  - "libs/common/src/vault/abstractions/cipher.service.ts"
---

# Vault SDK Sync

Cipher models and operations are mirrored in `bitwarden/sdk-internal` (`crates/bitwarden-vault/src/`). The SDK is the source of truth; drift between the two causes silent data loss when ciphers round-trip through `toSdk`/`fromSdk`.

## Model Changes

When a field is added, removed, renamed, or retyped on a model below, flag it and remind the author to:

- Make the matching change in the SDK struct listed below.
- Update the model's `toSdk*`/`fromSdk*` mappings (and `fromSdkLocalData`/`toSdkLocalData` for `LocalData`).
- Bump `@bitwarden/sdk-internal` once the SDK change ships, if the field must round-trip.

| Model (`libs/common/src/vault/`)                        | SDK file (`crates/bitwarden-vault/src/`) |
| ------------------------------------------------------- | ---------------------------------------- |
| `models/domain/cipher.ts`, `models/view/cipher.view.ts` | `cipher/cipher.rs`                       |
| `attachment`                                            | `cipher/attachment.rs`                   |
| `bank-account`                                          | `cipher/bank_account.rs`                 |
| `card`                                                  | `cipher/card.rs`                         |
| `drivers-license`                                       | `cipher/drivers_license.rs`              |
| `field`                                                 | `cipher/field.rs`                        |
| `identity`                                              | `cipher/identity.rs`                     |
| `login`, `login-uri`, `fido2-credential`                | `cipher/login.rs`                        |
| `passport`                                              | `cipher/passport.rs`                     |
| `secure-note`                                           | `cipher/secure_note.rs`                  |
| `ssh-key`                                               | `cipher/ssh_key.rs`                      |
| `password`, `password-history.view`                     | `password_history.rs`                    |
| `models/data/local.data.ts`                             | `cipher/local_data.rs`                   |

Rows without a path cover both `models/domain/<name>.ts` and `models/view/<name>.view.ts`.

## CipherService

- New cipher operations (encryption, decryption, server CRUD) **MUST** go through `CipherSdkService`. Flag any new `CipherService` method that calls `ApiService` or `EncryptService` directly.
- Legacy non-SDK paths exist only behind SDK feature flags and are slated for removal. Flag changes that extend them rather than the SDK path.
