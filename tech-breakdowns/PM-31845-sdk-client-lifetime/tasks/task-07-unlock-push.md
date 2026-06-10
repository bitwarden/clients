# Task 07 — Owner push: unlock (both `USER_KEY` writers) + `buildSdkUnlockData`

- **Repo:** `clients`
- **Team:** Key Management + Auth

## Goal

Push the SDK unlock into the long-lived client, honoring **push-then-emit**: the SDK is updated
**before** the state the observable reflects is written, so a reactive consumer of `userKey$` never sees
the new key paired with a client the SDK has not yet unlocked. **`USER_KEY` has two writers** — hook both:

1. `KeyService.setUserKey` — the canonical "user key in memory" point (login strategies, lock-screen
   master-password, biometrics, key-connector, **and auto-unlock restore on bootstrap/wake**). This is
   what makes browser MV3 eviction recover.
2. `DefaultUnlockService` (the SDK-bridge path) — runs `initialize_user_crypto` on the **register**
   client and does _not_ call `setUserKey`, so it pushes the unlock itself.

The payload builder `keyService.buildSdkUnlockData(userId, userKey)` is shared so both produce identical
SDK input (returns `null` when email/KDF/crypto-state isn't ready yet, e.g. mid-registration).

> **The two writers are not disjoint on every path.** A desktop lock-screen master-password unlock fires
> **both**: `DefaultUnlockService` unlocks the register client and pushes the unlock, _and_ the lock
> component then calls `keyService.setUserKey` (which pushes again). So the long-lived client gets two
> unlock pushes for one unlock. Don't try to dedupe by suppressing a writer — each is the sole writer on
> some path (e.g. browser auto-unlock restore is `setUserKey`-only). Instead the long-lived `unlock()` must
> be **re-init-safe**, which is what `initialize_crypto` ([task-13](task-13-sdk-initialize-crypto.md))
> provides; until it lands, the interim is a rebuild on re-unlock (see task-10). (Observed in testing.)

### Why the in-memory key matters

The reorder only works because `buildSdkUnlockData` builds the org-key payload from the **in-memory**
user key instead of reading `USER_KEY` back from state. The old path went `encryptedOrgKeys$ →
userPrivateKey$ → USER_KEY (state)`, which forced "write `USER_KEY` first" — the very thing that broke
push-then-emit. Decrypting the stored (`USER_KEY`-independent) encrypted private key with the key we were
handed removes that read-back, so the push can run before any state write. No SDK change is needed for
this (task-02 only lets us _delete_ the TS re-encryption later).

> `unlock()` uses `decryptedKey`; the SDK copies it back to `USER_KEY` (via the bridge) **during** the
> push, so with push-then-emit the SDK is the first writer. The explicit `keyService` write stays during
> rollout (the flag-off path still needs it) and is dropped at cleanup (task-12). Do **not** switch to
> `clientManagedState`.

## Files

- `libs/key-management/src/abstractions/key.service.ts` — add `buildSdkUnlockData`.
- `libs/key-management/src/key.service.ts` (+ `key.service.spec.ts`) — reorder `setUserKey` (push before
  the `USER_KEY` write) + `buildSdkUnlockData` impl (in-memory key, via the shared
  [`toUserEncryptedOrgKeys`](task-04-extract-touserencryptedorgkeys.md)); inject `SdkService`.
- `libs/unlock/src/default-unlock.service.ts` (+ spec) — push in `runOnUnlockSideEffects`; inject `SdkService` + `KeyService`.

## Implementation (sample code)

### `key.service.ts` — `setUserKey` pushes to the SDK **before** writing `USER_KEY`

```ts
async setUserKey(key: UserKey, userId: UserId): Promise<void> {
  // …null checks for key / userId…

  // Push-then-emit: build the payload from the in-memory key and unlock the SDK BEFORE writing the
  // state that userKey$ reflects, so a reactive consumer never sees the new key with a stale client.
  // (Flag off → unlock() is a no-op, so the explicit USER_KEY write below is still the writer.)
  const unlockData = await this.buildSdkUnlockData(userId, key);
  if (unlockData != null) {
    await this.sdkService.unlock(userId, unlockData);
  }

  await this.stateProvider.setUserState(USER_KEY, this.userKeyToStateObject(key), userId);
  await this.stateProvider.setUserState(USER_EVER_HAD_USER_KEY, true, userId);
  await this.storeAdditionalKeys(key, userId);

  // Confirm the write landed (guards against past state-provider observable races).
  const userKey = await firstValueFrom(this.userKey$(userId).pipe(filter((k) => k != null)));
  if (userKey == null) {
    throw new Error("Failed to set user key");
  }
}
```

```ts
async buildSdkUnlockData(userId: UserId, userKey: UserKey): Promise<SdkUnlockData | null> {
  const accounts = await firstValueFrom(this.accountService.accounts$);
  const email = accounts[userId]?.email;
  const kdfConfig = await firstValueFrom(this.kdfConfigService.getKdfConfig$(userId));
  const accountCryptographicState = await firstValueFrom(
    this.accountCryptographyStateService.accountCryptographicState$(userId),
  );
  if (email == null || kdfConfig == null || accountCryptographicState == null) {
    return null;
  }

  // Derive the org-key payload from the in-memory `userKey` — NOT from encryptedOrgKeys$, which reads
  // USER_KEY back from state. The encrypted private key and encrypted org keys are persisted
  // independently of USER_KEY, so this works before USER_KEY is written.
  const encPrivateKey = await firstValueFrom(this.userEncryptedPrivateKey$(userId));
  const userPrivateKey = await this.decryptPrivateKey(encPrivateKey, userKey);
  const providerKeys =
    userPrivateKey != null
      ? await firstValueFrom(this.providerKeysHelper$(userId, userPrivateKey))
      : {};
  const encOrgKeys = await firstValueFrom(
    this.stateProvider.getUser(userId, USER_ENCRYPTED_ORGANIZATION_KEYS).state$,
  );

  return {
    userKey,
    email,
    kdf: kdfConfig.toSdkConfig(),
    accountCryptographicState,
    orgKeys: await this.toUserEncryptedOrgKeys(encOrgKeys ?? {}, userPrivateKey, providerKeys),
  };
}
```

`decryptPrivateKey`, `userEncryptedPrivateKey$`, `providerKeysHelper$`, and `toUserEncryptedOrgKeys`
already exist on `DefaultKeyService` — reuse them, no new crypto. (`toUserEncryptedOrgKeys` takes a
**nullable** `userPrivateKey` — see task-04 — so the possibly-null `decryptPrivateKey` result passes
through without a guard here.) Inject `SdkService` into the
constructor (and update all subclasses: `ElectronKeyService`, the browser popup `KeyService` factory).
Add `buildSdkUnlockData` to the `KeyService` abstraction.

### `default-unlock.service.ts` — push in `runOnUnlockSideEffects`

```ts
// after biometric/auto-unlock key storage and USER_EVER_HAD_USER_KEY:
const unlockData = await this.keyService.buildSdkUnlockData(userId, userKey as UserKey);
if (unlockData != null) {
  await this.sdkService.unlock(userId, unlockData);
}
```

Inject `SdkService` + `KeyService` into `DefaultUnlockService` (add to provider deps + cli/browser
construction; mind constructor-arg order alongside `v2UpgradeTokenStateService`).

`SdkService` is injected **eagerly** into `KeyService`, so in cli/browser manual DI construct `SdkService`
**before** `KeyService` (move the `SdkService` block up; `SdkService`'s `KeyService`/`ConfigService` deps
are lazy, so the reorder is safe). New constructor params append last on `DefaultKeyService`; on
`DefaultUnlockService` add `SdkService` then `KeyService` after `v2UpgradeTokenStateService`.

> **Open — bridge-path ordering (PM-31059).** Unlike `setUserKey`, this path writes `USER_KEY` via the
> **register** client's `initialize_user_crypto` (its bridge) _before_ the long-lived push above, so it
> does **not** yet satisfy push-then-emit. Closing it means the register init shouldn't persist `USER_KEY`
> until the long-lived client is unlocked — a PM-31059 coordination, tracked as an open item. (Imperative
> callers of `unlock` are still ordered; only reactive `userKey$` observers see the window here.)

## Tests

- `key.service.spec.ts`: assert `sdkService.unlock` is called (with the in-memory-derived payload)
  **before** the `USER_KEY` `setUserState` write; mock `kdfConfigService.getKdfConfig$` /
  `accountCryptographicState$` to `of(null)` to assert the push is skipped when not ready.
- **Heads-up:** `setUserKey` now calls `buildSdkUnlockData` on **every** invocation, which reads
  `getKdfConfig$` / `accountCryptographicState$`. The existing `setUserKey` tests don't stub those, and
  `firstValueFrom(undefined)` throws — add `of(null)` defaults for both in the top-level `beforeEach` so
  unrelated tests keep passing (the push simply skips).
- `default-unlock.service.spec.ts`: assert `buildSdkUnlockData` + `sdkService.unlock` invoked.

## Acceptance criteria

- [ ] Both writers push `sdkService.unlock` with a shared `buildSdkUnlockData` payload.
- [ ] `setUserKey` pushes to the SDK **before** writing `USER_KEY` (push-then-emit), and
      `buildSdkUnlockData` derives org keys from the in-memory key with **no** `USER_KEY` read-back.
- [ ] `buildSdkUnlockData` returns `null` (no push) when email/KDF/crypto-state isn't ready.
- [ ] All `KeyService` subclasses + construction sites updated for the new `SdkService` dep.
- [ ] Specs green; `npm run test:types` green (no construction cycle — Legacy's `KeyService` dep is lazy).
