# Task 09 — Owner push: org keys (`KeyService.setOrgKeys → sdkService.setOrgKeys`)

- **Repo:** `clients`
- **Team:** Key Management

## Goal

When org keys are (re)written, push them into the user's live SDK client (no-op while locked), honoring
**push-then-emit**: update the SDK **before** writing `USER_ENCRYPTED_ORGANIZATION_KEYS`, so a reactive
consumer never sees the new org keys with a client the SDK hasn't updated.

## The state-provider trap (important)

`KeyService.setOrgKeys(orgs, providerOrgs, userId)` writes `USER_ENCRYPTED_ORGANIZATION_KEYS`. **Do not**
`update()` then re-read `encryptedOrgKeys$` — a `state$` read right after `update()` is not guaranteed
to reflect the write. Instead **build the SDK payload from the `encOrgKeyData` you just computed** and run
it through the shared [`toUserEncryptedOrgKeys`](task-04-extract-touserencryptedorgkeys.md) helper.
`userPrivateKey` / `providerKeys` are unrelated to that write, so reading them here is safe — and because
the payload doesn't depend on the write, push to the SDK **first**, then `update()` the state.

## Files

- `libs/key-management/src/key.service.ts` (+ `key.service.spec.ts`)

## Implementation (sample code)

Refactor `setOrgKeys` to compute `encOrgKeyData` as a local, push it to the SDK, then write the state:

```ts
async setOrgKeys(
  orgs: ProfileOrganizationResponse[],
  providerOrgs: ProfileProviderOrganizationResponse[],
  userId: UserId,
): Promise<void> {
  const encOrgKeyData: { [orgId: string]: EncryptedOrganizationKeyData } = {};
  for (const org of orgs) {
    encOrgKeyData[org.id] = { type: "organization", key: org.key };
  }
  for (const org of providerOrgs) {
    encOrgKeyData[org.id] = { type: "provider", providerId: org.providerId, key: org.key };
  }

  // Push-then-emit: push the org keys we just computed into the user's live SDK client (no-op while
  // locked) BEFORE writing state, so a reactive consumer never sees the new keys with a stale client.
  // Reuse `encOrgKeyData` rather than re-reading `encryptedOrgKeys$` (state$ read after update() is not
  // guaranteed fresh). userPrivateKey/providerKeys are unrelated to that write → safe to read.
  const userPrivateKey = await firstValueFrom(this.userPrivateKey$(userId));
  if (userPrivateKey != null) {
    const providerKeys = await firstValueFrom(this.providerKeysHelper$(userId, userPrivateKey));
    const sdkOrgKeys = await this.toUserEncryptedOrgKeys(encOrgKeyData, userPrivateKey, providerKeys);
    await this.sdkService.setOrgKeys(userId, sdkOrgKeys);
  }

  await this.stateProvider
    .getUser(userId, USER_ENCRYPTED_ORGANIZATION_KEYS)
    .update(() => encOrgKeyData);
}
```

(`sdkService` is already injected via [task-07](task-07-unlock-push.md); if landing 09 before 07, add
the dep here.)

## Tests

`key.service.spec.ts`: assert `sdkService.setOrgKeys` is called with the user-encrypted org keys after a
`setOrgKeys` write (with a non-null `userPrivateKey`), and skipped when `userPrivateKey` is null.

## Acceptance criteria

- [ ] `setOrgKeys` reuses the computed `encOrgKeyData` (no `firstValueFrom(encryptedOrgKeys$)` re-read) and pushes via `toUserEncryptedOrgKeys` **before** the `update()` state write (push-then-emit).
- [ ] Push skipped when `userPrivateKey` is null (locked).
- [ ] Specs green; `npm run test:types` green.
