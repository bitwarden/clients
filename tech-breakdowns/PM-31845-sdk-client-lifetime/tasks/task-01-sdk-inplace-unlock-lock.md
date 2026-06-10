# Task 01 — SDK: expose `UnlockClient` through WASM + add an in-place `lock()`

- **Repo:** `sdk-internal` (`../sdk`)
- **Team:** Key Management

## Goal

Give the WASM clients a way to **clear the in-memory user + org keys of a live client without freeing
it** — so a long-lived client can transition unlocked → locked → unlocked while keeping the same
instance. Today the only way to clear the key from memory is `free()` (which destroys the whole
client), forcing the clients repo to dispose and rebuild a token-only client on every lock.

The accessor shape is already settled: `client.unlock().lock()`.

## What already exists (and what doesn't)

An `UnlockClient` and the `unlock()` accessor already exist — but only natively, and only for the CLI:

- `bitwarden_unlock::UnlockClient` (`crates/bitwarden-unlock/src/unlock_client.rs`), reached via
  `UnlockClientExt::unlock()` on `Client` and re-exposed as `PasswordManagerClient::unlock()`
  (`crates/bitwarden-pm/src/lib.rs:165`).
- Every method is `#[cfg(feature = "cli")]` and **session-key** based: `generate_session_key`,
  `unlock(UnlockMethod::SessionKey)`, `invalidate_session_key`. These serve the CLI's process-exit
  model — the CLI "locks" by deleting the persisted `SESSION_PROTECTED_USER_KEY`, not by clearing
  memory.
- It is **not** WASM-exposed: nothing in the crate is `#[wasm_bindgen]`, and the WASM
  `PasswordManagerClient` (`crates/bitwarden-wasm-internal/src/client.rs`) has no `unlock()` accessor,
  so `client.unlock()` is not callable from TS today.
- There is **no in-memory `lock()`** anywhere. The doc on `invalidate_session_key`
  (`unlock_client.rs:178-183`) already anticipates it: _"Distinct from `lock()` on long-lived clients
  (mobile, desktop), which clears keys from memory."_

So this task is **not** "build a new client" — it's **expose the existing `UnlockClient` through WASM
and add the in-memory `lock()`**.

## SDK-side work

1. **Add `UnlockClient::lock()`** — **ungated** (not `cli`), so browser/desktop/mobile get it. It
   clears the in-memory user + org keys in place via the existing key store:

   ```rust
   // crates/bitwarden-unlock/src/unlock_client.rs
   impl UnlockClient {
       /// Clear the in-memory user and organization keys, returning the client to the same state
       /// as a freshly-rehydrated token-only client. The client instance is retained; a later
       /// `crypto().initialize_user_crypto(...)` re-unlocks the same instance.
       pub fn lock(&self) {
           self.client.internal.get_key_store().clear();
       }
   }
   ```

   `KeyStore::clear()` (`crates/bitwarden-crypto/src/store/mod.rs:144`) clears the symmetric / private
   / signing maps; the backend is `ZeroizeOnDrop` and its `Drop` calls `clear()`
   (`store/backend/implementation/basic.rs:42-49`), so dropping the values on `clear()` **zeroizes**
   them — the "zeroize, not merely drop a reference" guarantee `free()` gives today is already met by
   the key store, so **no new zeroization code is needed**. The user key is added at
   `initialize_user_crypto_decrypted_key → ctx.add_local_symmetric_key(...)`
   (`crates/bitwarden-core/src/client/internal.rs:264-273`).

   With an ungated `lock()` that uses `self.client`, drop the
   `#[cfg_attr(not(feature = "cli"), allow(dead_code))]` on the `client` field — it's now used in all
   builds.

2. **Expose it through WASM:**
   - Add an `unlock()` accessor to the WASM `PasswordManagerClient`
     (`crates/bitwarden-wasm-internal/src/client.rs`), mirroring the existing `crypto()` / `vault()`
     accessors.
   - Make `lock()` reachable from `#[wasm_bindgen]`, exposing **only** `lock()` — the cli-gated
     session-key methods stay off the WASM surface (either `#[cfg_attr(feature = "wasm",
wasm_bindgen)]` on `UnlockClient` + the `lock` method, or a thin wasm wrapper in
     `bitwarden-wasm-internal` following the pattern used for the other subclients).

3. **Regenerate bindings** so `bitwarden_wasm_internal.d.ts` exposes the `unlock()` accessor and
   `unlock().lock()`.

After `lock()`: crypto ops fail "not initialized"; non-crypto ops still work; a later
`crypto().initialize_user_crypto(...)` re-unlocks the same instance.

## Note on the home for `lock()`

`UnlockClient` is documented today as CLI session-key unlock, so adding a cross-platform in-memory
`lock()` broadens it and splits its feature gating (cli-only session-key methods vs. ungated `lock`).
That matches the `client.unlock().lock()` shape the breakdown settled on and the `invalidate_session_key`
doc that already names `lock()`. The alternative — `crypto().lock()`, where `crypto()` is **already**
WASM-exposed (no new accessor needed) — is worth a quick confirm with KM/SDK before landing.

## Acceptance criteria

- [ ] `client.unlock().lock()` is callable from `@bitwarden/sdk-internal` TS bindings (WASM
      `PasswordManagerClient.unlock()` + `UnlockClient.lock()`).
- [ ] `lock()` is available **without** the `cli` feature; the cli-only session-key methods remain
      unexposed to WASM.
- [ ] After `lock()`, the in-memory user + org keys are zeroized (verified by a Rust unit test; a
      subsequent crypto op errors "not initialized").
- [ ] A locked-then-re-unlocked client (`initialize_user_crypto`) decrypts correctly (round-trip test).
- [ ] `bitwarden_wasm_internal.d.ts` exposes the `unlock()` accessor + `lock()` method.

## Hand-off note

Once published, bump `@bitwarden/sdk-internal` in clients. The clients-side `DefaultSdkService.lock()`
is implemented in [task-10](task-10-new-pushdriven-impl-and-flag.md) (interim dispose + rebuild) and
swapped to the in-place `client.unlock().lock()` at cleanup
([task-12](task-12-cleanup-remove-legacy.md)).
