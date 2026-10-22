# Contributing to `libs/common/src/vault`

- New cipher operations **MUST** go through the SDK. Server operations (CRUD, share, attachments, collections) go through `CipherSdkService`; encryption and decryption go through `CipherEncryptionService`. Don't add `CipherService` methods that call `ApiService` or `EncryptService` directly; add the operation to `bitwarden/sdk-internal` and expose it through the appropriate SDK service.
- Legacy non-SDK code paths in `CipherService` exist only behind SDK feature flags and are slated for removal. Don't extend them.
- Domain (`models/domain`), view (`models/view`), and data (`models/data`) models are mirrored in `bitwarden/sdk-internal` (`crates/bitwarden-vault`). Field changes **MUST** also be made there, along with the `toSdk`/`fromSdk` mappings. See [.claude/rules/vault-sdk-sync.md](../../../../.claude/rules/vault-sdk-sync.md) for the model-to-SDK file map.
