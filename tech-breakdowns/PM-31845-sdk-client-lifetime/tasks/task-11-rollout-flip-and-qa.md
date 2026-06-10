# Task 11 — Rollout: flip the flag + QA verification

- **Repo:** `clients` (+ server-side flag config)
- **Team:** Platform + QA

## Goal

Enable `FeatureFlag.PM31845_LongLivedSdkClient` (`"pm-31845-long-lived-sdk-client"`) in a staged
rollout and verify the new push path end-to-end on every client. The flag is the kill switch — roll
back by disabling it if anything regresses.

> **The flag is captured once at startup, not live** (the singleton can't swap paths mid-session). Both
> directions are therefore **restart-gated**: a user only enters the long-lived path on their next app
> start after the flag is enabled for them, and disabling the flag (the kill switch) only reverts a given
> session after that client restarts. Plan the staged rollout and any incident rollback around this — the
> kill switch is **not** instant for already-running sessions. QA must verify by restarting the client,
> not just toggling the flag against a live session.

## QA verification checklist (run on web, browser, desktop, cli)

**Lifecycle**

- [ ] Login (master password, SSO/TDE, key connector) → vault decrypts.
- [ ] Lock → unlock → operations work; **exactly one** client is created across many operations (no churn).
- [ ] Logout → `userClient$` completes; re-login works.
- [ ] Account switch → each account's client is isolated; the active client is correct.

**Unlock methods (PM-31059 interaction — highest risk)**

- [ ] Unlock with **PIN** (the SDK-bridge path) → long-lived client is unlocked.
- [ ] Unlock with **biometrics** → unlocked.
- [ ] **Lock-screen master-password unlock** (desktop especially) → succeeds with **no**
      `CryptoInitialization` error. This path fires **both** unlock writers (`DefaultUnlockService` on the
      register client _and_ `keyService.setUserKey` from the lock component) → two unlock pushes for one
      unlock; it's the exact regression `initialize_crypto` (task-13) fixes. Must round-trip on the
      idempotent path and on the interim rebuild-on-re-unlock path.
- [ ] **PIN enrollment while unlocked** persists (writes the envelope via the bridge on the live client).
- [ ] **Lock-screen PIN reads** work on the locked client (`validate_pin`, `get_status`, `get_lock_type`).
- [ ] **Key rotation** re-initializes crypto in place (no stale key).

**Browser MV3**

- [ ] Service-worker eviction → wake → **auto-unlock restore** re-unlocks the SDK client (the
      `UserAutoUnlockKeyService → keyService.setUserKey` push). Confirm the wake path actually runs.

**Live state pushes**

- [ ] Server-config refresh re-applies feature flags to the existing client (no rebuild).
- [ ] Joining/leaving an org mid-session pushes org keys to the live client.

**Provider-managed orgs**

- [ ] A provider/MSP-managed org's ciphers decrypt (exercises the provider-key re-encryption path).

**Ordering (push-then-emit)**

- [ ] `setUserKey` pushes the SDK unlock **before** writing `USER_KEY` — a reactive consumer of
      `userKey$` paired with `userClient$` never observes the new key with a not-yet-unlocked client.
- [ ] `setOrgKeys` pushes before the org-keys state write; `renewConfig` pushes `setFlags` before persisting config.
- [ ] **Lock** runs `sdkService.lock` **before** clearing `USER_KEY`, and a key-cleared client stays
      locked despite the stale `USER_KEY` in the clear window (the task-08 SDK / PM-31059 question).
- [ ] **Bridge path (PM-31059):** confirm whether unlock via `DefaultUnlockService` exposes the
      reactive-observer window (register client writes `USER_KEY` before the long-lived push) — see task-07's open note.

## Open items to confirm during QA

- [ ] Push-then-emit reorder holds: `buildSdkUnlockData` builds from the in-memory key (no `encryptedOrgKeys$`/`USER_KEY` read-back) and the unlock push precedes the `USER_KEY` write.
- [ ] Initial-flag window (a brand-new token-only client has no flags until the first `setFlags` push).
- [ ] V2 upgrade token on the `keyService.setUserKey` login paths (the long-lived `unlock()` doesn't pass `upgradeToken`).

## Acceptance criteria

- [ ] Flag enabled for a rollout cohort; the checklist passes on all clients.
- [ ] No regression in auth/unlock metrics; kill-switch (disable flag) verified to revert behavior **after client restart** (the flag is captured once at startup — not live).
- [ ] Flag promoted to default-on once the cohort is healthy.
