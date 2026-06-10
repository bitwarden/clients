# Task 02 — SDK: provider-encrypted org-key support in `initialize_org_crypto`

- **Repo:** `sdk-internal` (`../sdk`)
- **Team:** Key Management

## Goal

Teach the SDK to accept **provider-encrypted** organization keys in `initialize_org_crypto`, so the
clients repo no longer has to decrypt-and-re-encrypt them under the user public key in TypeScript.

## Why this matters for PM-31845

**Simplification, not a blocker.** The push-then-emit reorder ([task-07](task-07-unlock-push.md)) already
makes the SDK the source of truth for `USER_KEY` and closes the ordering race — by deriving the org-key
payload from the **in-memory** user key (`decryptPrivateKey` + `toUserEncryptedOrgKeys`) instead of
reading `USER_KEY` back from state. That removes the original blocker (`buildSdkUnlockData` needing
`USER_KEY` in state) without any SDK change.

What task-02 buys us is **deleting the TS re-encryption entirely**: once the SDK accepts provider-encrypted
org keys directly, `buildSdkUnlockData` no longer needs to derive `userPrivateKey` or call
`toUserEncryptedOrgKeys` at all — it passes the stored provider-encrypted org keys straight to the SDK.
Pure cleanup; it does not gate the feature or the rollout flip.

The TS hack we want to delete (`libs/key-management/src/key.service.ts`):

```ts
// The SDK only supports user-encrypted org keys, so re-encrypt provider-encrypted keys with
// the user's public key. Remove once the SDK has support for provider keys.
if (BaseEncryptedOrganizationKey.isProviderEncrypted(encrypted)) {
  if (providerKeys == null) continue;
  orgKey = await this.encryptService.encapsulateKeyUnsigned(
    await encrypted.decrypt(this.encryptService, providerKeys),
    userPubKey!, // ← needs userPrivateKey → needs USER_KEY in state
  );
} else {
  orgKey = encrypted.encryptedOrganizationKey; // normal keys pass through, no user key needed
}
```

Only the **provider** branch needs the user key. Normal org keys are passed through untouched.

## SDK-side sketch

`initialize_org_crypto` (`crates/bitwarden-core/src/key_management/crypto.rs`) takes
`organization_keys: HashMap<OrganizationId, UnsignedSharedKey>` (user-encrypted). Extend it to also
accept provider-encrypted entries + the provider keys needed to unwrap them, and have the SDK do the
decrypt-then-rewrap internally (it already holds the user key in its key store after
`initialize_user_crypto`).

## Acceptance criteria

- [ ] `initialize_org_crypto` accepts provider-encrypted org keys (+ provider key material) and
      initializes org crypto correctly for provider-managed orgs.
- [ ] Round-trip test: a provider-managed org's ciphers decrypt after init via the new path.
- [ ] `bitwarden_wasm_internal.d.ts` reflects the new request shape.

## Hand-off note (downstream clients work, tracked separately)

Once available: delete `toUserEncryptedOrgKeys` (clients) and the in-memory `userPrivateKey` derivation
in `buildSdkUnlockData` (`decryptPrivateKey` + `providerKeysHelper$`), passing the stored
provider-encrypted org keys straight to the SDK. The source-of-truth flip and the redundant-`USER_KEY`-write
removal are handled separately by the push-then-emit reorder ([task-07](task-07-unlock-push.md)) +
cleanup ([task-12](task-12-cleanup-remove-legacy.md)), not here.
