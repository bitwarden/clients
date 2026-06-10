# Task 12 — Cleanup: remove the legacy reactive branch + the flag

- **Repo:** `clients`
- **Team:** Platform

## Goal

`DefaultSdkService` held both paths behind the flag. Delete the legacy reactive path and the flag, so
the class _is_ the dependency-light long-lived service (matching the PoC).

## Remove (from `DefaultSdkService`)

- The **legacy reactive path**: `internalClient$`, its `combineLatest`/`switchMap` rebuild, the
  `sdkClientOverrides` / `UnsetClient` override map, `loadFeatureFlags`,
  `initializeClient`/`initializeClientCrypto`, the `resetOnRefCountZero: timer(1000)` teardown, and the
  disposal-race `filter`.
- The **flag branching**: `userClient$` collapses to the long-lived stream (drop the
  `longLivedEnabled$`/`switchMap`); the push methods drop their `if (!enabled) return` guards; the
  `accounts$` subscription drops its guard; delete the `longLivedEnabled` helper.
- The **four lazy legacy-path deps** (`() => KdfConfigService`, `() => KeyService`,
  `() => AccountCryptographicStateService`, `() => ConfigService`) — the constructor reduces to the
  dependency-light set:
  `sdkClientFactory, environmentService, platformUtilsService, accountService, () => ApiService, stateProvider`.
- The **dormant `setClient`** (abstraction + any residual impl/mock) — confirmed unused on `main`.
- The **`no-restricted-imports` eslint-disable** on the old `KeyService`/`KdfConfigService` import (gone with `internalClient$`).

> Removing `loadFeatureFlags` (forced — it used the dropped `() => ConfigService`) also stops the
> **user-less `client$`** from preloading server flags. That's intended: per-user clients get flags via
> the `setFlags` push; the unauthenticated client has no user to scope flags to. Keep `client$` /
> `version$` themselves — only their `loadFeatureFlags` call goes.
>
> **Out of scope:** `DefaultRegisterSdkService` (`register-sdk.service.ts`) is a separate class with its
> own `internalClient$` / `UnsetClient` / `sdkClientOverrides` / `loadFeatureFlags`. It doesn't reference
> the flag or `setClient`, so this cleanup leaves it untouched. (Flagged in case a parallel cleanup is
> wanted later — not part of PM-31845.)

## Remove (elsewhere)

- **`FeatureFlag.PM31845_LongLivedSdkClient`** from `feature-flag.enum.ts` + `DefaultFeatureFlagValue`.
- The reordered cli/browser construction stays (constructing `SdkService` first is correct for the
  dependency-light service); just drop the now-removed legacy deps from the construction args + jslib
  provider `deps`.

## Swap the interim lock (if [task-01](task-01-sdk-inplace-unlock-lock.md) has landed)

```ts
// DefaultSdkService.lock() — replace dispose+rebuild with the in-place SDK lock:
async lock(userId: UserId): Promise<void> {
  this.unlocked.delete(userId);
  await this.withClient(userId, (client) => client.unlock().lock());
}
```

If task-01 landed, update the lock spec accordingly ("disposes the unlocked client…" → "clears the user
key in place, same client instance retained"). **If task-01 has _not_ landed, keep the interim
dispose+rebuild `lock()` and its existing spec wording** — the in-place swap and the "same instance
retained" assertion only apply once task-01 ships.

## Make the SDK the source of truth for `USER_KEY`

With the flag gone, the unlock push always runs, so the SDK persists `USER_KEY` (the `decryptedKey`
copy-back) on every unlock. Drop `keyService.setUserKey`'s explicit `USER_KEY` write, keeping it only as a
fallback for when the SDK can't init yet:

```ts
// setUserKey — the SDK now writes USER_KEY during unlock(); only persist ourselves as a fallback.
const unlockData = await this.buildSdkUnlockData(userId, key);
if (unlockData != null) {
  await this.sdkService.unlock(userId, unlockData); // SDK persists USER_KEY via the decryptedKey copy-back
} else {
  await this.stateProvider.setUserState(USER_KEY, this.userKeyToStateObject(key), userId);
}
```

This removes the redundant `USER_KEY` write. It is safe **only** after the flag is
removed — while the flag exists, the flag-off path has no push, so `keyService` must keep writing. It does
**not** require [task-02](task-02-sdk-provider-key-support.md); that's a further, independent simplification
(delete the TS provider re-encryption in `buildSdkUnlockData`).

**Test consequence:** `setUserKey` ends with `firstValueFrom(this.userKey$(userId).pipe(filter(k => k != null)))`
(throws "Failed to set user key" otherwise). In production the SDK's bridge copy-back writes `USER_KEY`, so
it resolves — but a mocked `sdkService` doesn't, so the push-path `setUserKey` tests will hang. Stub the
mock `sdkService.unlock` to write `USER_KEY` (simulating the copy-back); don't remove the read-back guard
(it's a deliberate correctness safeguard).

## Acceptance criteria

- [ ] `DefaultSdkService` is the dependency-light long-lived service (no `internalClient$`, no flag, no lazy cycle deps, no `setClient`).
- [ ] `FeatureFlag.PM31845_LongLivedSdkClient` removed from the enum + default-value map.
- [ ] (If task-01 landed) `lock()` uses `client.unlock().lock()`; spec updated.
- [ ] `setUserKey` drops the explicit `USER_KEY` write (SDK source of truth), keeping the fallback for the not-ready path.
- [ ] Full `npm run test:types` + affected specs green; app boots.
