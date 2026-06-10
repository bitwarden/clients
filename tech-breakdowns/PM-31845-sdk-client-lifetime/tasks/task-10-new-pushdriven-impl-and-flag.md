# Task 10 — Long-lived push machinery on `DefaultSdkService` + flag branch

- **Repo:** `clients`
- **Team:** Platform

## Goal

Add the long-lived push machinery into the **same** `DefaultSdkService` and branch on
`FeatureFlag.PM31845_LongLivedSdkClient` (default off). When off, `userClient$` and the push methods use
the existing reactive `internalClient$`; when on, they use the long-lived `clients$` map. One class, one
provider — no selector, no second class.

## Long-lived path — implementation

Add these private members alongside the legacy `internalClient$`:

- **State:** `clients$ = new BehaviorSubject<Record<UserId, Rc<PasswordManagerClient> | undefined>>({})`
  (the live per-user clients), `creating: Map<UserId, Promise<...>>` (dedupes concurrent builds), and
  `unlocked: Set<UserId>` (tracks which clients hold a user key, so the interim lock knows whether to
  rebuild and `setOrgKeys` knows whether the client can take org keys).
- **`ensureClient(userId)`** — idempotent: if a client already exists (or is mid-build via `creating`),
  reuse it; otherwise `buildTokenOnlyClient` and publish into `clients$`. Concurrent calls dedupe via
  `creating`. **Fast-logout-during-build:** if the user is no longer in `accounts$` by the time the build
  finishes, dispose the freshly-built client and don't publish it.
- **`buildTokenOnlyClient(userId)`** — builds a token-only client and registers
  `km_state_bridge().register_bridge_impl(new JsWasmStateBridge(...))` on it. The bridge is registered on
  **every** client (token-only _and_ unlocked) — required for lock-screen PIN reads on the locked client.
- **`longLivedUnlock(userId, data)`** — `ensureClient`, then a single `crypto().initialize_crypto(userReq,
orgReq)` ([task-13](task-13-sdk-initialize-crypto.md)) — idempotent + atomic, so re-unlocks don't
  double-init (`initialize_user_crypto` errors on an already-unlocked client; unlock re-runs in normal use
  — two writers per unlock, `refreshAdditionalKeys`, rotation). Add `userId` to `unlocked`. _Interim until
  task-13 lands:_ on re-unlock (already in `unlocked`), dispose + rebuild the token-only client first, then
  `initialize_user_crypto` + `initialize_org_crypto`.
- **`longLivedLock(userId)`** — interim: dispose the unlocked client + rebuild token-only (→
  `client.unlock().lock()` once task-01 lands); remove from `unlocked`. No-op if the user has no client.
- **`longLivedLogout(userId)`** — dispose the client; remove it from `clients$` and `unlocked`.
- **`longLivedSetFlags(userId, flags)`** — `load_flags` on the existing client; no-op if absent.
- **`longLivedSetOrgKeys(userId, orgKeys)`** — `initialize_org_crypto` on the existing client; no-op while
  locked (not in `unlocked`) or absent.
- **`longLivedUserClient$(userId)`** — readiness-gated `combineLatest([loggedIn$(userId), clients$])`,
  where `loggedIn$(userId)` derives from `accountService.accounts$` (`accounts[userId] != null`):
  - logged out → error `UserNotLoggedInError`; logged in but client not yet built → **wait** (neither
    emit nor error); client present → emit it.
  - **completion is driven by `accounts$`** (the user being dropped on logout), _not_ by removing the
    client from `clients$` — removing the client alone would not complete the stream.

**Which methods create a client:** only `longLivedUnlock` (via `ensureClient`) and the `accounts$`
subscription. `setFlags` / `setOrgKeys` / `lock` operate on an existing client and no-op if absent —
existence follows `accounts$`, not the pushes.

> Load-bearing: `accounts$`-driven existence (covers restart / SW-wake) and the `JsWasmStateBridge` on
> **every** client (lock-screen PIN reads).

## Flag branch (the rollout mechanism)

**Add the flag** `FeatureFlag.PM31845_LongLivedSdkClient` (`"pm-31845-long-lived-sdk-client"`) to
`libs/common/src/enums/feature-flag.enum.ts` — both the `FeatureFlag` enum member and a
`DefaultFeatureFlagValue` entry of `FALSE` (the `Record<FeatureFlag, …>` exhaustiveness check requires
both). No earlier task adds it. It's **captured once at startup and reused** — no live updates needed
(the singleton can't swap paths mid-session anyway). Resolve it lazily into a memoized `Promise<boolean>`,
read via the lazy `() => ConfigService` from task-05.

```ts
private enabled: Promise<boolean> | undefined;

/**
 * Resolve the flag once, then reuse. Stale/persisted value is fine — we don't block on a fresh fetch.
 * Only ever called post-construction (the accounts$ subscription defers to a microtask; userClient$ /
 * the push methods are called by consumers after bootstrap), so resolving the lazy ConfigService is safe.
 */
private longLivedEnabled(): Promise<boolean> {
  return (this.enabled ??= this.configServiceProvider().getFeatureFlag(
    FeatureFlag.PM31845_LongLivedSdkClient,
  ));
}

// userClient$ resolves the (one-shot) flag, then stays on the chosen path:
userClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
  return defer(() => this.longLivedEnabled()).pipe(
    switchMap((on) => (on ? this.longLivedUserClient$(userId) : this.internalClient$(userId))),
  );
}

// push methods early-return when off (the reactive internalClient$ is driving things):
async unlock(userId: UserId, data: SdkUnlockData): Promise<void> {
  if (!(await this.longLivedEnabled())) {
    return;
  }
  await this.longLivedUnlock(userId, data);
}
// …lock / setFlags / setOrgKeys follow the same `if (!enabled) return;` pattern…
```

`logout` returns `void` (its owner `LogoutService.logout` calls it fire-and-forget), so it can't `await`
the flag — resolve it in a `.then(...)`: `void this.longLivedEnabled().then((on) => { if (on) this.longLivedLogout(userId); })`.
Disposal therefore completes one microtask after `logout()` returns; that's fine (logout broadcasts and
tears down regardless).

The only eager long-lived work — creating token-only clients from `accounts$` — is **deferred to a
microtask** so the long-lived path stays inert when off and so we never resolve the lazy `ConfigService`
while `SdkService` is still constructing:

```ts
constructor(/* … */) {
  // accounts$ (a shared state observable) can replay its current value synchronously on subscribe;
  // defer so we don't resolve the lazy ConfigService/KeyService during construction — a DI cycle in
  // Angular, an undefined this.configService in cli/browser (constructed right after, synchronously).
  // A microtask runs only after the synchronous construction sequence unwinds, by which point both ready.
  this.accountService.accounts$.subscribe((accounts) =>
    void Promise.resolve().then(async () => {
      if (!(await this.longLivedEnabled())) {
        return;
      }
      for (const userId of Object.keys(accounts) as UserId[]) {
        void this.ensureClient(userId);
      }
    }),
  );
}
```

> Captured-once means the flag is read a single time per process (memoized); `userClient$`'s `defer`
> resolves the same `Promise` on every subscription, so the path never switches mid-session. The
> microtask is a _deterministic_ ordering (it runs after the synchronous construction stack unwinds),
> not a "wait long enough" hack — verified that cli/browser construct `ConfigService` synchronously right
> after `SdkService` with no `await` between them.

## DI reorder + remaining wiring

- **cli / browser:** construct `SdkService` **before** `KeyService` / `ConfigService`. The class now has
  the long-lived (dependency-light) needs _and_ the legacy reactive deps (lazy from task-05), so order
  works for both paths.
- Wire `SdkService` into the construction sites added by tasks 06–09: `ExtensionLockService`,
  `ExtensionLogoutService`, `ElectronKeyService`, the browser popup `KeyService` factory.

## Tests

- Long-lived spec (flag mocked **on**): create-once/reuse, in-place flag + key-rotation, no teardown on
  unsubscribe, lock disposal + key-cleared client (interim), logout completion, not-logged-in error,
  fast-logout-during-build (a client built after logout is disposed, not published).
- With the flag **off**, the existing reactive `internalClient$` tests still pass (mock `configService.getFeatureFlag` → `false`). For flag-on tests, mock it → `true`.
- Open-gap tests (flag on): assert `buildTokenOnlyClient` registers the bridge; a PIN settings read works on a **locked** client.

## Acceptance criteria

- [ ] `DefaultSdkService` holds both paths; `userClient$` / push methods / the `accounts$` subscription branch on `FeatureFlag.PM31845_LongLivedSdkClient`.
- [ ] Flag **off** (default): behaves exactly as today (reactive path; long-lived `accounts$` work never runs). Flag **on**: long-lived push path active, all owner pushes wired.
- [ ] Flag read via lazy `() => ConfigService` → no `ConfigService ↔ SdkService` construction cycle.
- [ ] cli/browser construct `SdkService` first; all subclass/factory sites wired.
- [ ] `npm run test:types` green; app boots on **both** flag states (the conclusive DI-cycle check).
