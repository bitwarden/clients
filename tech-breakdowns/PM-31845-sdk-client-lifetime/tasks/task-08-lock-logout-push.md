# Task 08 — Owner push: lock / logout (`LockService.lock`, `LogoutService.logout`)

- **Repo:** `clients`
- **Team:** Auth

## Goal

On lock, clear the live client's in-memory user key; on logout, dispose the client and complete its
`userClient$`. Lock follows **push-then-emit**: lock the SDK **before** the `USER_KEY` state clear that
makes "locked" observable (this reverses the previous ordering — see "Lock ordering" below).

## Files

- `libs/auth/src/common/services/accounts/lock.service.ts` (+ `lock.services.spec.ts`)
- `libs/auth/src/common/services/logout/default-logout.service.ts` (+ spec)
- `apps/browser/.../extension-logout.service.ts` (overrides `logout`) and `extension-lock.service.ts` (constructor dep)

## Implementation (sample code)

### `lock.service.ts`

```ts
constructor(
  // …existing deps…
  private readonly keyService: KeyService,
  private readonly sdkService: SdkService,        // NEW
) {}
```

```ts
// inside lock():
// Push-then-emit: lock the SDK (clear the in-memory user key) BEFORE the USER_KEY state clear that makes
// "locked" observable, so a reactive consumer never sees USER_KEY=null paired with a still-unlocked
// client. (Flag off → sdkService.lock is a no-op, so this is behavior-neutral until the flip.)
await this.sdkService.lock(userId);
await this.wipeDecryptedState(userId); // clears USER_KEY via the "lock" state event → emits "locked"
await this.waitForLockedStatus(userId);
```

### Lock ordering (reverses the prior decision — read this)

The earlier design cleared `USER_KEY` from state **before** `sdkService.lock()`, "so a locked client with
the bridge can't read a stale key." Push-then-emit requires the opposite: the SDK must be locked before
"locked" is observable. The reorder is also **more** correct for auth status — `USER_KEY` is the source of
truth for "unlocked" (`authStatusFor$`), so clearing it only after the SDK is actually locked stops
`authStatusFor$` from reporting "locked" while the client can still do crypto.

The window the reorder opens (SDK locked, `USER_KEY` still briefly in state) is only a problem if a locked
client **re-derives** an unlocked state by reading that stale `USER_KEY` through the bridge. The in-place
lock empties the keystore, and lock-screen PIN reads (`validate_pin`/`get_status`/`get_lock_type`) don't
load `USER_KEY` — so it should be safe. **Confirm with SDK / PM-31059** that a key-cleared client treats
its (empty) keystore, not stale state, as the source of truth for "unlocked." If it doesn't, make the lock
atomic: `sdkService.lock()` (or the in-place `client.unlock().lock()`, task-01) must also clear/ignore the
bridge `USER_KEY`, so locking the SDK is the single op that clears both in-memory key and state.

### `default-logout.service.ts`

```ts
export class DefaultLogoutService implements LogoutService {
  constructor(
    protected messagingService: MessagingService,
    protected sdkService: SdkService, // NEW
  ) {}

  async logout(userId: UserId, logoutReason?: LogoutReason): Promise<NewActiveUser | undefined> {
    // Dispose the user's SDK client (frees the in-memory key) before broadcasting logout.
    this.sdkService.logout(userId);
    this.messagingService.send("logout", { userId, logoutReason });
    return undefined;
  }
}
```

`ExtensionLogoutService extends DefaultLogoutService` — thread `sdkService` through `super(...)` and
call `this.sdkService.logout(userId)` in its overridden `logout` before the account-switch logic.

Update provider deps (jslib) + cli/browser construction for both services. `ExtensionLockService`
gains the `sdkService` constructor param (appended last). `SdkService` is constructed before the
lock/logout services in cli/browser already (it's built early for the owner-push tasks), so no further
reorder is needed here — just confirm it precedes them.

## Tests

- `lock.services.spec.ts`: assert `sdkService.lock(userId)` is called during `lock()`.
- `default-logout.service.spec.ts` + `extension-logout.service.spec.ts`: pass `mock<SdkService>()`;
  assert `sdkService.logout(userId)` is called.

## Acceptance criteria

- [ ] `LockService.lock` calls `sdkService.lock`; `LogoutService.logout` (+ extension) calls `sdkService.logout`.
- [ ] Lock calls `sdkService.lock` **before** clearing `USER_KEY` (push-then-emit), reversing the prior order.
- [ ] Confirmed with SDK / PM-31059 that a key-cleared client ignores stale `USER_KEY` state during the
      clear window (or the in-place lock is made atomic to clear both) — see "Lock ordering".
- [ ] All construction sites updated; specs green; `npm run test:types` green.
