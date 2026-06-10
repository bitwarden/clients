# PM-31845 — Working Notes (full context dump)

> Companion to `breakdown.md`. This file captures **everything** from the design + PoC sessions —
> decisions, dead-ends, rationale, and findings that don't belong in the formal breakdown — so work
> can resume from a clean context. The breakdown is the polished artifact; this is the engineering
> log.

## Goal

Make the per-user SDK client (`PasswordManagerClient`, WASM) **long-lived** — created when a user
logs in / unlocks, mutated in place, disposed only on logout — instead of `DefaultSdkService`
rebuilding it on every observable input change and tearing it down 1s after the last unsubscribe.
Jira: PM-31845 (breakdown task) under epic PM-31844, initiative parent BW-149.

## Final design (as built in the PoC)

`DefaultSdkService` is now **dependency-light** and **push-driven**.

### Constructor deps (6)

`sdkClientFactory`, `environmentService`, `platformUtilsService`, `accountService`, **`() => ApiService`** (lazy), `stateProvider` (+ optional `userAgent`).

Dropped vs. the original: `configService`, `keyService`, `kdfConfigService`, `accountCryptographyStateService`. The `no-restricted-imports` eslint-disable on the `KeyService`/`KdfConfigService` import is gone.

### Client existence is driven by `AccountService.accounts$`

- Constructor subscribes to `accounts$`; each present `userId` gets an idempotent **token-only**
  client (`ensureClient`, deduped via a `creating` promise map).
- `accounts$` is backed by **persisted state** (`ACCOUNT_ACCOUNTS` on `ACCOUNT_DISK`), so it fires on
  fresh login **and** on rehydration after app restart / browser service-worker wake — **one code
  path**. (Hooking the imperative `addAccount` would miss restart/SW-wake; that was rejected.)
- Disposal is the explicit `logout` push. (`accounts$`-leaving also completes `userClient$`.)

### `userClient$` readiness gating

```
account absent from accounts$  -> complete -> UserNotLoggedInError   (truly logged out)
account present, no client yet -> wait (no emit)                     (creation in flight; no false error)
client present                 -> emit; complete when account leaves accounts$
```

This is the fix for the create-window race: a consumer subscribing while the token-only client is
still being built **waits** instead of getting a false `UserNotLoggedInError`. It needs `accounts$`
to tell "logged out" from "pending".

### Push API (called by the owning services, directly, awaited)

| Method                                         | Caller                                    | Hook point                                                                                                                                                                 |
| ---------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unlock(userId, SdkUnlockData)`                | `UnlockService` + `KeyService.setUserKey` | one `initialize_crypto(user, org)` — idempotent + atomic (task-13); was `initialize_user_crypto` + `initialize_org_crypto`                                                 |
| `lock(userId)`                                 | `LockService.lock`                        | in-place `client.unlock().lock()` once the prerequisite (Task 1) lands; interim: dispose unlocked client (frees in-memory key) + build fresh token-only key-cleared client |
| `logout(userId)`                               | `LogoutService.logout`                    | dispose + complete `userClient$`                                                                                                                                           |
| `setFlags(userId, Map<string,boolean>)`        | `ConfigService.renewConfig`               | `load_flags` on the live client                                                                                                                                            |
| `setOrgKeys(userId, Record<OrgId, EncString>)` | `KeyService.setOrgKeys`                   | `initialize_org_crypto` (no-op while locked)                                                                                                                               |

`SdkUnlockData = { userKey, email, kdf, accountCryptographicState, orgKeys }` — `UnlockService`
already computes all of these for the register-client unlock; it additionally reads
`keyService.encryptedOrgKeys$` for `orgKeys`.

`setClient` is dormant (no production callers — confirmed by grep on `main`) and superseded by the
lifecycle methods. The PoC removes it; under the landing strategy its removal is **deferred to cleanup
(task-12)** because `DefaultSdkService`'s legacy branch keeps the existing surface until the flag is gone.

## Landing strategy: flag-gated single class

Chosen 2026-06-10. (First sketched as "flag + dual implementation" with a separate `LegacySdkService` +
a `SdkServiceSelector`; dropped because the flag is **async** and `ConfigService ↔ SdkService` is a
cycle, which made the selector facade — thunks, dual registration, construct-only-the-chosen, the
`logout`-void wart — more complex than just branching inside the one class.) The working tree now holds
the **dual-path flag-gated** implementation (the landing artifact): `DefaultSdkService` carries both the
reactive `internalClient$`/`legacyUserClient$` branch _and_ the long-lived path, branches on
`FeatureFlag.PM31845_LongLivedSdkClient`, and keeps the four lazy legacy-path deps. The flag-on long-lived
path is the design target; the legacy branch + flag are the scaffolding removed at cleanup (task-12).

**Why a seam is needed.** On `main`, `DefaultSdkService` constructs with `ConfigService`, `KeyService`,
`KdfConfigService`, `AccountCryptographicStateService` deps (for the reactive `internalClient$`). The
moment an owner (`KeyService`, `ConfigService`) injects `SdkService` to push into it, you close a
**2-node construction cycle** (`KeyService ↔ SdkService`) — Angular resolves it only fragilely and
manual DI (cli/browser) can't build it at all. The owner pushes + the long-lived rewrite + reactive
removal + DI reorder are **mutually entangled** — not individually shippable without a deliberate seam.

**The seam (single class).** `DefaultSdkService` keeps its reactive `internalClient$`, gains **no-op**
push methods, and **lazy-resolves** its cycle-participating deps (`() => KeyService`, `() => ConfigService`,
`() => KdfConfigService`, `() => AccountCryptographicStateService`; `ApiService` already lazy from the
prep task). Owners can now inject `SdkService` and call the push methods → no-ops while off → the
reactive path still drives everything → app works. Each owner push lands **independently and safely**.
Then the same class gains the long-lived machinery and **branches on the flag**: `userClient$`, the push
methods, and the `accounts$` subscription pick the long-lived path vs `internalClient$` from
`FeatureFlag.PM31845_LongLivedSdkClient`. Flip to roll out; delete the legacy branch + flag at cleanup.

**Flag is captured once at startup, not live.** A memoized `Promise<boolean>` resolves the flag a single
time, read via the lazy `() => ConfigService`. We **don't** block on a fresh config fetch (no
`ensureConfigFetched`) — a stale/persisted flag value is acceptable. No live updates — the singleton
can't swap paths mid-session anyway.

**Construction-time deferral.** The constructor's `accounts$` subscription can fire synchronously (the
shared state observable replays its current value on subscribe), so its body is **deferred to a
microtask** (`void Promise.resolve().then(...)` at the subscription). Without it, resolving the lazy
`ConfigService` while `SdkService` is still constructing is a DI cycle in Angular and an undefined
`this.configService` in cli/browser. The microtask is a deterministic ordering (runs after the
synchronous construction stack unwinds), not a timing gamble — verified cli/browser construct
`ConfigService` synchronously right after `SdkService` with no `await` between. `longLivedEnabled()`
itself is plain (no guard) since `userClient$`/the push methods only call it post-bootstrap.
(Considered, rejected as over-engineering for a single-release flag: a dedicated "flag provider" service
above `SdkService`+`ConfigService` that pushes the flag in, removing the `ConfigService` dep entirely.)

**Task ordering** (see breakdown for full text): prep (SDK lock; lazy `ApiService`; extract
`toUserEncryptedOrgKeys`) → seam (abstraction + no-op pushes + lazy deps) → owner pushes (flags; unlock
×2; lock/logout; org keys — any order) → long-lived machinery + flag branch → flip + QA → cleanup. Every
task compiles and leaves the default (flag-off) path working.

**Cost / throwaway.** The no-op pushes, lazy-dep shims, the flag, and the legacy `internalClient$` branch
are scaffolding deleted at cleanup. The working tree carries both paths (dual-path flag-gated); cleanup
(task-12) strips it down to the dependency-light long-lived service.

## Key findings & decisions (the "why")

1. **The DI cycle, and the lazy-`ApiService` break.** `SdkService` only needed `ApiService` for the
   token provider. But `ApiService → VaultTimeoutSettingsService → KeyService`, so any owner→`SdkService`
   edge closed a cycle (`KeyService → SdkService → ApiService → VaultTimeoutSettings → KeyService`).
   Angular resolves cycles only at runtime (bootstrap), and specs construct manually, so a cycle would
   pass all tests and crash the app. **Fix:** give `SdkService` a lazy `() => ApiService` (resolved
   via `injector.get(ApiService)` in Angular, `() => this.apiService` in cli/browser). Construction no
   longer depends on `ApiService` → cycle gone → every owner can inject `SdkService` directly.
   - `getActiveBearerToken`'s refresh logic lives inside `ApiService` (uses its `fetch`/`send` to hit
     identity), so a _clean_ extraction of the token provider into a lean service isn't worth it —
     lazy resolution is the right call.

2. **Lazy getter vs. reorder.** The codebase already uses `() => injector.get(SdkService)` (e.g.
   `NewPolicyService`, jslib) — but that idiom exists to break **cycles**. Here there is **no cycle**
   (after the lazy ApiService), only cli/browser manual **construction order** (`ConfigService`/
   `KeyService` were built before `SdkService`). So per "reorder if it's just ordering, lazy only if
   it's a cycle", we **reordered**: `SdkService` is now constructed right after `environmentService`,
   before `KeyService`/`ConfigService`, in both cli and browser, and they inject it directly. In cli,
   `customUserAgent` (only depends on `platformUtilsService`) was moved up too.

3. **SDK serializes internally → no TS-level mutation queue.** The SDK client serializes its own
   requests, so an operation can't run mid-key-change. What matters is **ordering** (the key/flag
   update enqueued before dependent ops), which **direct awaited push calls** guarantee and
   **observable subscriptions do not** (non-deterministic "who runs first"). This is why owners push
   via direct method calls, not via a sync service subscribing to `serverConfig$`/`encryptedOrgKeys$`.
   Consequence: we dropped the earlier "`UserClient` wrapper + serialized mutation queue + readiness
   gate during mutation" design.
   - Residual: `unlock` is two SDK calls (`initialize_user_crypto` then `initialize_org_crypto`, org
     cleared between). Awaiting `unlock()` before dependent ops covers the normal flow; a consumer
     operating _concurrently during_ unlock could see user-but-no-org crypto. Low risk; flagged.

4. **`Rc` kept.** It guards two things: the consumer contract (~39 sites do `using ref = sdk.take()`)
   and safe disposal on lock/logout while an operation is in flight (avoids use-after-free / premature
   key-memory free). We removed the `Rc` **churn** (per-subscription teardown, the 1s timer, the
   disposal-race `filter`), not `Rc` itself.

5. **`UserClient` wrapper dropped.** The existing `clients$` subject is the per-user holder; the
   transitions are just operations on the SDK client. No phase enum, no per-user queue.

6. **The state-provider trap (caught during review).** `stateProvider.update(...)` followed by
   `firstValueFrom(state$)` is **not** guaranteed to return the just-written value. In
   `KeyService.setOrgKeys` we **reuse the computed `encOrgKeyData`** for both the state write and the
   SDK push instead of re-reading `encryptedOrgKeys$`. The transformation that turns stored
   `EncryptedOrganizationKeyData` into the user-encrypted `Record<OrgId, EncString>` the SDK accepts
   (including re-encrypting provider-encrypted keys with the user public key) is extracted into a
   shared private `toUserEncryptedOrgKeys(...)` used by **both** `encryptedOrgKeys$` and `setOrgKeys`,
   so the push handles provider keys identically to the unlock path. `setOrgKeys` reads
   `userPrivateKey$`/`providerKeysHelper$` (unrelated to the org-keys write → no trap) to feed it.

7. **Shared unlock needs no changes.** `JsSharedUnlockDriver.unlock_user`/`lock_user` route through
   `UnlockService.unlockWithDecryptedUserKey` / `LockService.lock`, which now push to the SDK. So a
   shared unlock/lock reaches the live SDK client automatically — the payoff of wiring at the service
   level rather than at individual call sites. The leader/follower's `registerOnUnlockAction`/
   `registerOnLockAction` forward _device events_ to peers (no SDK-client mutation) and don't loop;
   my `sdkService.unlock` runs before those actions in `runOnUnlockSideEffects`. No re-entrancy added.

8. **`USER_KEY` has two writers; the unlock push hooks both (this is what fixes #2).** `keyService.userKey$` (reads
   `USER_KEY` state) is the source of truth for "unlocked," driving `authStatusFor$`. It's written
   by **two** mechanisms: (a) `keyService.setUserKey` — login strategies, lock-screen master-password,
   biometrics, key-connector, **and the auto-unlock restore on bootstrap/wake** (`UserAutoUnlockKeyService`);
   and (b) the **SDK client-managed-state bridge** — `DefaultUnlockService` runs `initialize_user_crypto`
   on the register client, and the SDK writes the key into `user_key_state` (which `UserKeyRecordMapper`
   maps to the _same_ `USER_KEY` — confirmed). The old `internalClient$` reacted to `userKey$`, catching
   both. The push model hooks both writers: `keyService.setUserKey` pushes the SDK unlock (covering all
   the direct-write paths, incl. auto-unlock restore → **this is what fixes browser eviction #2**), and
   `UnlockService.unlock` pushes for the SDK-bridge path (which doesn't call `setUserKey`). They're
   disjoint → no double-push. **[2026-06-16] Correction: NOT disjoint on every path** — a desktop
   lock-screen master-password unlock fires _both_ (the lock component calls `setUserKey` after
   `DefaultUnlockService` unlocks); see the 2026-06-16 section. The idempotent `initialize_crypto`
   (task-13) makes the overlapping double-push harmless. The payload builder is shared: `keyService.buildSdkUnlockData(userId, userKey)`
   (returns `null` if email/KDF/crypto-state isn't ready yet), used by both hooks. Pushing from the
   _writer_ (not a reactive `userKey$` read) preserves ordering — `setUserKey` awaits the SDK unlock.

9. **One prerequisite `sdk-internal` change: an in-place lock on the new unlock client (`client.unlock().lock()`).**
   Most of the WASM surface already exists and is re-callable — `crypto().initialize_user_crypto`,
   `crypto().initialize_org_crypto`, `platform().load_flags`, `free()` — so unlock / setFlags / setOrgKeys
   need **no** SDK change (the epic's assumption that mutation needs new bindings was outdated for those).
   The **one** gap is lock: no live client exposes an in-place `lock()`/`clear` today (confirmed in
   `bitwarden_wasm_internal.d.ts` — `CryptoClient` ~line 4117 has only `initialize_*`,
   `get_user_encryption_key`, `free()`). The three lock-ish names that do exist are interfaces the SDK
   calls _into us_, not methods we call on a client: `SharedUnlockDriver.lock_user`/`unlock_user`,
   `BiometricsUnlock.unlock_biometrics`, and the state-bridge `clear_user_key` — none evict the key from
   a live client's in-memory key store.
   - **Decision (2026-06-10):** add an in-place lock as a **committed prerequisite (Task 1, lands
     first)**. The SDK will expose a new **unlock client** off `PasswordManagerClient`, so the call is
     `client.unlock().lock()` — reads a little awkwardly (lock lives on the _unlock_ client), but that's
     the SDK's domain grouping for the unlock/lock lifecycle. It must securely **zeroize** the in-memory
     user + org keys without `free()`-ing the client, so the client stays a single long-lived instance
     across lock → unlock (the whole point of the initiative — one instance per user for the session, not
     per unlocked window). Not usable today — the `unlock()` accessor / unlock client doesn't exist yet.
     Until it lands, the interim `lock()` disposes the unlocked client (`free()` clears the key) and
     rebuilds a token-only one — secure, but churny, and it swaps the client identity on every lock.
   - **Must zeroize, not just drop a reference** — match the guarantee `free()` gives today by releasing
     the client's WASM memory. Otherwise it's a regression.
   - Two further additions were filed as **optional** here: (a) a **re-init idempotency guard** so a
     second unlock push doesn't error; (b) an **atomic combined `initialize_crypto(user, org)`** to close
     the two-call unlock window (residual in finding #3). **[2026-06-16] Both are now required and
     implemented as a single method** — live testing showed `initialize_user_crypto` _hard-errors_ on
     re-unlock (not merely redundant) and re-unlock happens in normal use, so this is a real bug, not an
     optimization. `crypto().initialize_crypto(user, org)` (task-13) does clear + user + org in one
     idempotent, atomic call. See the 2026-06-16 section.

10. **SDK-managed PIN unlock + the state bridge (PM-31059) — interaction with the long-lived model.**
    Investigated 2026-06-10 after rebasing onto main (PM-31059 landed concurrently). Key pieces:
    - **`JsWasmStateBridge`** (`libs/common/src/key-management/state-bridge.ts`) is a bidirectional
      window between the SDK and state-provider state. The SDK calls into it to read/write `USER_KEY`,
      persistent/ephemeral PIN envelopes, encrypted PIN, MP unlock data, V2 upgrade token, and account
      cryptographic state. Writes are "atomic" (write + wait-for-readback ≤1s). Registered via
      `client.km_state_bridge().register_bridge_impl(...)`.
    - **PIN unlock** (`DefaultUnlockService.unlockWithPin` → `unlockWithMethod({pinState:{pin}})`) runs
      `initialize_user_crypto` on the **separate `RegisterSdkService` client** (token-only + bridge). The
      SDK reads the envelope via the bridge, derives the key, and **writes `USER_KEY` via the bridge**.
      Then `runOnUnlockSideEffects` reads `get_user_encryption_key()`, sets biometric/auto-unlock keys,
      and (our addition) pushes `sdkService.unlock(decryptedKey)` into the long-lived client.
    - **PIN enrollment + lock-screen reads** run on the long-lived `userClient$` via
      `sdk.user_crypto_management().pin_settings()` (`PinService`). `validate_pin`/`get_status`/
      `get_lock_type` run on the **locked** token-only client → **this is why we register the bridge on
      token-only clients** (the rebase merge carried this over; it's necessary, not just additive).

    **Broken assumption (the user's "set twice" hunch — confirmed).** The old reactive main client used
    `method: clientManagedState` — it only _read_ `USER_KEY` from the bridge and reloaded it on every
    rebuild; the client was a disposable cache and **state was the source of truth**. Our long-lived
    client holds the key in memory and uses `method: decryptedKey`. `decryptedKey` _writes_ `USER_KEY`
    back via the bridge — **confirmed in SDK source**: `should_copy_user_key` is `true` for `DecryptedKey`
    (`crypto.rs:224-232`) → `copy_user_key_to_client_managed_state` (`crypto.rs:395-396`). So our
    `unlock()` re-writes `USER_KEY` after the writer that preceded it (`setUserKey`'s TS write, or the
    register client's bridge write) — a **redundant write**, once per unlock, harmless (idempotent
    `writeAtomic`, same value; `USER_KEY` shape `{ "": key }` identical on both sides —
    `USER_KEY_STATE_KEY = ""` in `key.service.ts:72`).

    **Decision (settled 2026-06-10): keep `decryptedKey`; accept the redundant write for now.** Two
    candidates were weighed and both rejected as the _current_ answer:
    - `clientManagedState` (the old reactive client's method) reads `USER_KEY` once at init and caches it
      in the in-memory `key_store` — verified against `../sdk` (both methods funnel into
      `initialize_user_crypto_decrypted_key`, `internal.rs:264-273`; `ClientManagedState` reads the key
      once, `crypto.rs:249-252`, and "does not update the state after initializing", `crypto.rs:120-124`).
      So it would avoid the write **and** has no per-op reads. BUT it reads `USER_KEY` from state, and on
      the `keyService.setUserKey`/**rotation** path the read can be **stale** (line-122 `filter(k != null)`
      only waits for non-null, so on old→new it can resolve on the old key; the bridge's `get_user_key`
      is a plain `readAtomic` with no read-back wait). That's the documented state-provider trap, with a
      severe failure mode (wrong/old key) traded for a trivial saving → rejected.
    - The **real fix** is to make the SDK the source of truth: `keyService.setUserKey` lets the SDK
      persist `USER_KEY` (via the `decryptedKey` copy) and writes it itself only as a back-compat
      fallback when the SDK can't init yet — `if (unlockData == null) persist()`. This is **blocked**:
      `buildSdkUnlockData` must run with `USER_KEY` already in state, because its org-key derivation
      (`encryptedOrgKeys$` → `userPrivateKey$`) reads it — and that exists **only** to re-encrypt
      provider-encrypted org keys in TS (`toUserEncryptedOrgKeys`, `key.service.ts:903-917`: _"The SDK
      only supports user-encrypted org keys… Remove once the SDK has support for provider keys"_). Normal
      org keys pass through with no user key needed. So the lone `USER_KEY` dependency in the whole unlock
      payload is the provider-key hack.

    **Root cause + sequencing.** Chain: SDK can't take provider-encrypted org keys → TS re-encrypts them,
    needing `userPrivateKey` → `encryptedOrgKeys$`/`buildSdkUnlockData` need `USER_KEY` in state → caller
    must write `USER_KEY` before the unlock → the SDK's `decryptedKey` copy is a duplicate → SDK can't be
    the writer. **Prerequisite to fix: SDK provider-key support in `initialize_org_crypto`** (KM's
    direction — they are already pulling org-key handling into the SDK). Once it lands: delete
    `toUserEncryptedOrgKeys`, `buildSdkUnlockData` loses its `USER_KEY` dependency, flip `setUserKey` to
    the source-of-truth shape, and the duplicate write disappears. Until then, `decryptedKey` + our write
    stays; the duplicate is once-per-unlock, idempotent, same value (`USER_KEY` shape `{ "": key }`
    identical on both sides — `USER_KEY_STATE_KEY = ""`, `key.service.ts:72`).

    **[2026-06-15] Superseded — not blocked on the SDK.** The "blocked; prerequisite: SDK provider-key
    support" conclusion above is wrong. `buildSdkUnlockData` can build the org-key payload from the
    **in-memory** user key it's already handed — decrypt the stored (`USER_KEY`-independent) encrypted
    private key via `decryptPrivateKey(encPrivateKey, key)`, then `toUserEncryptedOrgKeys` — with **no
    `USER_KEY` read-back**. That lets the unlock push run **before** the `USER_KEY` write (push-then-emit),
    so the SDK's `decryptedKey` copy is the first write (SDK as source of truth) and the explicit write is
    dropped at cleanup (task-12). This is TS-only; SDK provider-key support (task-02) becomes an independent
    _simplification_ (delete `toUserEncryptedOrgKeys`), not a prerequisite. Push-then-emit is now a
    **requirement that gates the flag flip** — see `breakdown.md` (Functional Requirements) and tasks
    06/07/08/09.

    **Other deltas from the long-lived shift:**
    - The long-lived client is now the _live_ source of truth (in-memory key), not state. We keep state
      consistent by pushing on every key change (unlock/rotation) and clearing on lock/logout. No lazy
      auto-unlock risk — `initialize_user_crypto` must be called explicitly, so a locked client with the
      bridge won't self-unlock, **provided lock clears `USER_KEY`** (it does: `wipeDecryptedState` runs
      the `"lock"` state event, which clears `USER_KEY`, before `sdkService.lock` disposes the client).
    - Auto-unlock restore still routes through `UserAutoUnlockKeyService → keyService.setUserKey`
      (confirmed, line 35), so finding #8's hook still fixes browser eviction under PM-31059.
    - **V2 upgrade token** is passed only to the _register_ client's `initialize_user_crypto`; the
      long-lived `unlock()` doesn't pass it. PIN/MP unlock upgrades on the register client and we load
      the result — fine. The `setUserKey` login-strategy paths have no register client → **verify** V2
      upgrade isn't skipped there.
    - **Future simplification:** with a long-lived client that already has the bridge, the unlock could
      run directly on it (`pinState`/`masterPasswordUnlock`) instead of on the register client + re-push,
      eliminating the double `initialize_user_crypto`. `RegisterSdkService` would remain for pre-auth
      registration. Larger refactor; out of scope.

## [2026-06-16] Live testing the flag-on path: `initialize_user_crypto` isn't re-callable → `initialize_crypto`

Turned the flag **on** on desktop; unlock failed with `EncryptionSettingsError: CryptoInitialization`.
Traced end-to-end with console-instrumented `unlock` / `lock` / both writers.

**What happens.** A desktop lock-screen master-password unlock pushes the SDK unlock **twice**:

1. `DefaultUnlockService.unlockWithMasterPassword` unlocks the **register** client, then
   `runOnUnlockSideEffects` pushes `sdkService.unlock` into the long-lived client → first init ✅.
2. The lock component (`lock.component.ts`: `successfulMasterPasswordUnlock` → `setUserKeyAndContinue`)
   then calls `keyService.setUserKey`, which **also** pushes `sdkService.unlock` → second init ❌.

So **finding #8's "the two writers are disjoint → no double-push" is wrong on this path**: the lock-screen
UI invokes _both_ subsystems (PM-31059's `DefaultUnlockService` _and_ the legacy `setUserKey`) for one
unlock. They're still each the _sole_ writer on other paths (e.g. browser auto-unlock restore is
`setUserKey`-only), so you can't just remove one.

**Root cause.** `initialize_user_crypto_decrypted_key` (`internal.rs`) **hard-errors** if the keystore
already holds user / private / signing keys — it is **not** re-callable. The register and long-lived
clients are confirmed _separate_ WASM instances (`createSdkClient` makes a fresh client each call; the
state bridge does not back the keystore — `has_symmetric_key` reads the in-memory store), so it's genuinely
two inits on the **same** long-lived keystore. And re-unlock isn't a corner case: the double-writer above,
`refreshAdditionalKeys` (re-`setUserKey`, same key), and key rotation (new key) all re-unlock in normal use.

**Fix — `crypto().initialize_crypto(userReq, orgReq)` (task-13, implemented in `../sdk`).** A WASM-only
method that clears the keystore, then inits user + org crypto in one call — **idempotent** (safe on
re-unlock / writer-overlap / rotation) and **atomic** (closes finding #3's two-call window: no moment with
a user key but no org keys). Thin wrapper over the existing flow behind `get_key_store().clear()`; reuses
`should_copy_user_key` / V2 upgrade / account-crypto-state — no new crypto. WASM-gated, distinct from the
uniffi-only `reinit_user_crypto`. `DefaultSdkService.unlock()` now makes one `initialize_crypto` call (drops
the separate `initialize_org_crypto`); standalone `initialize_org_crypto` stays for `setOrgKeys`.

This **promotes finding #9's two "optional" SDK additions** (re-init idempotency guard + atomic combined
init) into one **required**, implemented method. The interim before it — a client-side dispose+rebuild of
the token-only client on re-unlock — is gone now that the method exists.

Not pursued (deferred): removing the redundant `setUserKey` push so only one writer fires — that's a
PM-31059-coupled UI change, and idempotent `initialize_crypto` makes the overlap harmless anyway.

## Known limitations / follow-ups

- **Redundant SDK re-init on settings changes (now safe, not just accepted).** `setUserKey` pushes a
  full `sdkService.unlock`. `KeyService.refreshAdditionalKeys()` re-calls `setUserKey` with the _same_
  key (vault-timeout settings change), so a settings toggle triggers a re-init. **[2026-06-16]** With
  `initialize_crypto` (task-13) this re-init is **idempotent** — it clears and re-inits rather than
  erroring (the old `initialize_user_crypto` would have _thrown_ on the second call). Residual cost is a
  wasted clear+reinit, not a bug; a "skip when key unchanged" optimization is still possible but no longer
  necessary for correctness.
- **Initial flag window.** A token-only client created via `accounts$` has no flags until
  `ConfigService.renewConfig` pushes them (on config fetch, e.g. at login). By unlock, flags are
  pushed. A consumer reading a flag on a brand-new locked client before the first push would see none.
- **`unlock` two-call atomicity** window (see finding #3) — **[2026-06-16] closed.** `initialize_crypto`
  (task-13) inits user + org in one call, so there is no longer a moment where the client holds a user key
  but no org keys. (Previously: mitigated only by awaited `unlock()` + SDK internal serialization.)
- **Org-key derivation timing in `buildSdkUnlockData`.** **[2026-06-16] Reworked for push-then-emit:** it
  no longer reads `encryptedOrgKeys$` (which derives `userPrivateKey` by reading `USER_KEY` back from
  state). It now derives `userPrivateKey` from the **in-memory** key it was handed (decrypt the
  `USER_KEY`-independent stored private key) and reads the persisted encrypted org keys directly, so the
  push can run _before_ the `USER_KEY` write. Org keys can still be momentarily empty mid-registration
  (handled by returning `null` → no push); the `setOrgKeys` push is the backstop for live sessions. Worth
  confirming under test, especially for auto-unlock restore. See [task-07](tasks/task-07-unlock-push.md).

### Resolved during review (no longer open)

- **Browser MV3 eviction (#2)** — handled. The auto-unlock restore on bootstrap/wake goes through
  `UserAutoUnlockKeyService → keyService.setUserKey`, which now pushes the SDK unlock (finding #8). So
  the unlocked client is re-established on wake without a bespoke recovery step. **Verify in testing**
  that on browser SW wake the auto-unlock path actually runs and re-unlocks the SDK client.
- **Incomplete unlock coverage** — fixed by finding #8. Pushing only from `UnlockService.unlock` missed
  the many `keyService.setUserKey` paths (login strategies, lock-screen master-password, biometrics,
  key-connector, auto-unlock). Now both writers are hooked.
- **Provider-encrypted org keys** — now handled. `KeyService.setOrgKeys` and `encryptedOrgKeys$` share
  `toUserEncryptedOrgKeys(...)`, which re-encrypts provider keys with the user key (finding #6). No
  FIXME remains.
- **Unauthenticated `client$` flags** — intentionally not loaded. The unauthenticated client has no
  user to scope feature flags to, so there's nothing to tie flags to. Not a gap.
- **Shared unlock** — no changes needed (finding #7).

## Files changed (PoC)

SDK service + abstraction + mock:

- `libs/common/src/platform/services/sdk/default-sdk.service.ts` (+ `.spec.ts`)
- `libs/common/src/platform/abstractions/sdk/sdk.service.ts` (`SdkUnlockData`, push methods, `setClient` removed)
- `libs/common/src/platform/spec/mock-sdk.service.ts`

Owner pushes:

- `libs/common/src/platform/services/config/default-config.service.ts` (+ `config.service.spec.ts`) — `setFlags`.
- `libs/key-management/src/key.service.ts` (+ `key.service.spec.ts`) — `setUserKey` pushes unlock (finding #8); `setOrgKeys` push; shared `toUserEncryptedOrgKeys`; public `buildSdkUnlockData`.
- `libs/key-management/src/abstractions/key.service.ts` — `buildSdkUnlockData` abstract method.
- `libs/unlock/src/default-unlock.service.ts` (+ `default-unlock.service.spec.ts`) — `unlock` push (SDK-bridge path), delegates payload to `keyService.buildSdkUnlockData`.
- `libs/auth/src/common/services/accounts/lock.service.ts` (+ `lock.services.spec.ts`) — `lock`.
- `libs/auth/src/common/services/logout/default-logout.service.ts` (+ `default-logout.service.spec.ts`) — `logout`.

DI / construction:

- `libs/angular/src/services/jslib-services.module.ts` (SdkService `useFactory` + lazy ApiService; ConfigService/KeyService/UnlockService/LockService/LogoutService deps)
- `apps/cli/src/service-container/service-container.ts` (reorder SdkService + `customUserAgent`; direct deps)
- `apps/browser/src/background/main.background.ts` (reorder SdkService; direct deps)
- `apps/browser/src/auth/services/extension-lock.service.ts` + `apps/browser/src/auth/popup/logout/extension-logout.service.ts` (`sdkService` param; ExtensionLogoutService also pushes `sdkService.logout` in its overridden `logout`)
- `apps/browser/src/popup/services/services.module.ts` (KeyService factory `sdkService`) + `apps/desktop/src/key-management/electron-key.service.ts` + `apps/desktop/src/app/services/services.module.ts` (ElectronKeyService `sdkService` param)

## Validation status

- Affected unit specs: **green** (default-sdk, config, logout, lock, unlock, key-management — incl. new
  `setUserKey`→SDK-push tests).
- **Full workspace `npm run test:types`: clean** (every project exits 0) — the guard against a
  reintroduced DI cycle. (Caught two subclass `super()` sites — `ExtensionLogoutService`,
  `ElectronKeyService` — three multi-construction spec sites, and the `KeyService`-abstraction method;
  all fixed.)
- **eslint + prettier: clean** across all changed files.
- **Code review (Bitwarden reviewer agent on the staged diff):** DI rewiring, two-writer unlock, and
  state-trap avoidance verified correct. It caught two real concurrency bugs — both **fixed** with a
  regression test: (1) `ensureClient` republishing/leaking a client whose build finished after a fast
  logout (now re-checks `accounts$` before publishing); (2) `lock()` building the replacement before
  disposing the unlocked client, leaving the key resident if the build threw (now disposes first).
  Also added the previously-missing assertions that lock/logout invoke `sdkService.lock`/`logout`.
  (Review artifact written to `review-summary.md` — untracked; delete before committing.)
- Not yet run: full `npm test` suite, and a real **app boot** (the definitive runtime DI-cycle check —
  the green type-check makes a cycle very unlikely, but boot is conclusive). User will test.

## Rebase onto main — PM-31059 (SDK-managed PIN unlock)

Rebased 2026-06-10. Main landed **PM-31059** (`5ddbf986cd`), which overlaps our area heavily: it added
`JsWasmStateBridge` + the `RegisterSdkService` (separate register/unlock client) + SDK-managed PIN
unlock, and made the (old reactive) SDK service emit a _locked_ client. 8 files conflicted; resolved by
keeping our dependency-light rewrite and **carrying over PM-31059's state-bridge registration** into
`buildTokenOnlyClient` (`client.km_state_bridge().register_bridge_impl(new JsWasmStateBridge(...))`). We
did **not** carry over main's `initializeClient`/`initializeClientCrypto` (clientManagedState) — our push
API replaces them. `DefaultUnlockService` gained main's `v2UpgradeTokenStateService` (+ `pinState`
method) _and_ our `sdkService`/`keyService` deps; browser's `UnlockService` construction was relocated by
main to `main.background.ts:~1000` (we added our deps there). Verified: all 8 affected projects (common,
unlock, angular, key-management, auth, cli, browser, desktop) `tsc --noEmit` clean; SDK + unlock specs
green. See finding #10 for the deeper interaction analysis that came out of this rebase.

## If resuming cold

1. Read `breakdown.md` (the design + the Tasks landing sequence) then this file.
2. `default-sdk.service.ts` + its spec are the heart of the work; start there. **The working tree holds the
   dual-path flag-gated landing artifact** (both `internalClient$`/`legacyUserClient$` and the long-lived
   path, branching on the flag) — see the "Landing strategy" section above for the no-op-push + lazy-dep
   seam, the in-class flag branch (captured once at startup), and the task ordering. The flag-on long-lived
   path is the end-state; cleanup (task-12) removes the legacy branch + flag.
3. The cycle analysis (finding #1) is the load-bearing insight — don't reintroduce a non-lazy
   `ApiService` dep on `SdkService`. The same 2-node cycle with `KeyService`/`ConfigService` is exactly
   why the landing needs the lazy cycle deps (`() => KeyService`, `() => ConfigService`).
4. Finding #8 (two `USER_KEY` writers → hook both `keyService.setUserKey` and `UnlockService.unlock`)
   is the second load-bearing insight; it's also what makes browser eviction (#2) work.
5. Finding #10 (SDK-managed PIN unlock + state bridge) is the third: we register `JsWasmStateBridge` on
   every client (incl. locked token-only). `unlock()` uses `decryptedKey`, which write-backs `USER_KEY`
   redundantly — **accepted for now**. The fix (SDK as source of truth) is blocked on SDK provider-key
   support; do NOT switch to `clientManagedState` (stale-read risk on the rotation path). Read finding
   #10 before touching `unlock()`, `buildSdkUnlockData`, or the bridge.
6. Remaining (verification, not known gaps): browser auto-unlock-restore path; org-key derivation timing
   in `buildSdkUnlockData`; initial-flag window; V2 upgrade on the `setUserKey` login paths (finding #10).
   Blocked-on-SDK: provider-key support in `initialize_org_crypto` → then remove the redundant `USER_KEY`
   write via the source-of-truth flip (finding #10).
7. Open test gap: assert `buildTokenOnlyClient` registers the bridge, and that a PIN settings read works
   on a _locked_ long-lived client. No known open _implementation_ gap.
8. **[2026-06-15]** Items 5–6 are superseded: the source-of-truth fix is **not** blocked on the SDK. The
   push-then-emit reorder unblocks it in TS — `buildSdkUnlockData` builds from the in-memory key (no
   `USER_KEY` read-back), the push runs before the `USER_KEY` write, and the explicit write is dropped at
   cleanup (task-12). Provider-key support (task-02) is a later simplification, not a prerequisite, and
   push-then-emit now **gates the flag flip**. Lock ordering also flips (lock the SDK before clearing
   `USER_KEY`). See finding #10's 2026-06-15 addendum, `breakdown.md`, and tasks 06/07/08/09.
9. **[2026-06-16]** Live-tested the flag **on** and hit a re-unlock failure: `initialize_user_crypto` is
   **not re-callable** and the two unlock writers are **not disjoint** (desktop lock-screen MP unlock fires
   both) — finding #8's "disjoint → no double-push" was wrong on that path. Fix shipped in `../sdk`: a
   WASM-only, idempotent + atomic `crypto().initialize_crypto(user, org)` (task-13); the long-lived
   `unlock()` now makes one such call. This also closed finding #3's two-call window and promoted finding
   #9's two "optional" SDK additions to required/implemented. Read the **2026-06-16 section** before
   touching `unlock()` or the SDK init path.
