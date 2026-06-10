# Task 13 — SDK: idempotent + atomic `crypto().initialize_crypto(user, org)`

- **Repo:** `sdk-internal` (`../sdk`)
- **Team:** Key Management

## Goal

Add a WASM-exposed `crypto().initialize_crypto(userReq, orgReq)` that **(re)initializes the user + org
crypto of a live client in one call**, tolerating an already-unlocked client. The long-lived `unlock()`
calls this instead of `initialize_user_crypto` + `initialize_org_crypto`.

## Why

**`initialize_user_crypto` is not re-callable.** `initialize_user_crypto_decrypted_key`
(`crates/bitwarden-core/src/client/internal.rs`) hard-errors `CryptoInitialization` if the keystore already
holds user / private / signing keys:

```rust
if ctx.has_symmetric_key(SymmetricKeySlotId::User)
    || ctx.has_private_key(PrivateKeySlotId::UserPrivateKey)
    || ctx.has_signing_key(SigningKeySlotId::UserSigningKey)
{
    return Err(EncryptionSettingsError::CryptoInitialization);
}
```

That guard is fine for a disposable client (init once), but the long-lived client **re-unlocks on the same
instance**, and a second init then fails. Re-unlock is not hypothetical — it happens in normal use:

- **The two unlock writers are not disjoint.** A desktop lock-screen master-password unlock fires **both**
  `DefaultUnlockService` (PM-31059's SDK-bridge unlock, via the register client) **and**
  `keyService.setUserKey` (the lock component sets the key in state afterward — `lock.component.ts`). Both
  push `sdkService.unlock` into the live client → two `initialize_user_crypto` calls for one unlock. The
  first succeeds, the second hit the guard. (Observed in desktop testing; see [task-07](task-07-unlock-push.md).)
- **`KeyService.refreshAdditionalKeys()`** re-calls `setUserKey` with the _same_ key (vault-timeout settings change).
- **Key rotation** re-unlocks with a _new_ key.

**Also: user + org should be set atomically.** `initialize_user_crypto` clears any loaded org keys, so org
crypto is re-initialized after it. Done as two separate awaited calls, there's a window where the client
has a user key but no org keys — observable to a consumer or to another push (e.g. `setOrgKeys`) landing in
between. One call closes it.

## SDK-side work

A thin wrapper over the existing flow — clear, then init user, then init org:

```rust
// crates/bitwarden-core/src/key_management/crypto.rs
/// Idempotent, atomic (re)initialization of a long-lived client's user + org crypto.
///
/// Unlike `initialize_user_crypto`, this tolerates an already-unlocked client: it clears any existing
/// in-memory crypto first, so a re-unlock, key rotation, or a duplicate unlock push does not trip the
/// SDK's "already initialized" guard. User and org crypto are initialized back-to-back in a single
/// call, so there is no observable window where the client holds a user key but no org keys.
///
/// WASM-only: the long-lived persistent-client model is currently WASM-specific.
#[cfg(feature = "wasm")]
pub(super) async fn initialize_crypto(
    client: &Client,
    user_req: InitUserCryptoRequest,
    org_req: InitOrgCryptoRequest,
) -> Result<(), EncryptionSettingsError> {
    client.internal.get_key_store().clear();
    initialize_user_crypto(client, user_req).await?;
    initialize_org_crypto(client, org_req).await
}
```

```rust
// crates/bitwarden-core/src/key_management/crypto_client.rs  (in the #[cfg_attr(feature = "wasm", wasm_bindgen)] impl)
#[cfg(feature = "wasm")]
pub async fn initialize_crypto(
    &self,
    user_req: InitUserCryptoRequest,
    org_req: InitOrgCryptoRequest,
) -> Result<(), EncryptionSettingsError> {
    initialize_crypto(&self.client, user_req, org_req).await
}
```

- `KeyStore::clear()` (`crates/bitwarden-crypto/src/store/mod.rs`) zeroizes the symmetric / private /
  signing maps (`ZeroizeOnDrop`), so this reuses the existing zeroization — **no new crypto**. The whole
  `InitUserCryptoRequest` flow (`should_copy_user_key`, V2 upgrade, account-crypto-state) is reused as-is.
- **WASM-only.** Gate on `#[cfg(feature = "wasm")]`; distinct from the uniffi-only `reinit_user_crypto`
  (which is V2-upgrade-specific and requires an already-unlocked client).
- Keep the standalone `initialize_org_crypto` — `setOrgKeys` ([task-09](task-09-orgkeys-push.md)) updates
  org keys without a re-unlock.

## Acceptance criteria

- [ ] `client.crypto().initialize_crypto(userReq, orgReq)` is callable from `@bitwarden/sdk-internal`.
- [ ] Calling it on an **already-unlocked** client succeeds (no `CryptoInitialization`) — verified by a
      Rust unit test: unlock, then `initialize_crypto` again, then a crypto op round-trips.
- [ ] Calling it with a **different** user key (rotation) leaves the client unlocked with the new key.
- [ ] WASM-only; `bitwarden_wasm_internal.d.ts` exposes `initialize_crypto`.

## Hand-off note

Once published, bump `@bitwarden/sdk-internal` in clients; the long-lived `DefaultSdkService.unlock()` calls
`initialize_crypto` (one call) instead of `initialize_user_crypto` + `initialize_org_crypto`, and drops the
interim dispose+rebuild-on-re-unlock. See [task-10](task-10-new-pushdriven-impl-and-flag.md).
