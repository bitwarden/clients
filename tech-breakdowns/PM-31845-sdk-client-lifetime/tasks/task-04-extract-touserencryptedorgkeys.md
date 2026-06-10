# Task 04 — Extract `KeyService.toUserEncryptedOrgKeys`

- **Repo:** `clients`
- **Team:** Key Management

## Goal

Pull the "stored encrypted org keys → user-encrypted org keys the SDK accepts" transform out of the
`encryptedOrgKeys$` observable into a private method, so the upcoming `setOrgKeys` push
([task-09](task-09-orgkeys-push.md)) can reuse the exact same logic (including provider-key
re-encryption) instead of duplicating it.

## Files

- `libs/key-management/src/key.service.ts`

## Implementation (sample code)

Add the shared helper:

```ts
/**
 * Converts stored encrypted organization keys into the user-encrypted form the SDK accepts,
 * re-encrypting any provider-encrypted keys with the user's public key. Shared by
 * {@link encryptedOrgKeys$} and {@link setOrgKeys} so both produce identical input for the SDK.
 */
private async toUserEncryptedOrgKeys(
  encryptedOrgKeys: Record<OrganizationId, EncryptedOrganizationKeyData>,
  userPrivateKey: UserPrivateKey | null,
  providerKeys: Record<ProviderId, ProviderKey> | null,
): Promise<Record<OrganizationId, EncString>> {
  // Nullable on purpose: `encryptedOrgKeys$` guards before calling, but `buildSdkUnlockData` (task-07)
  // derives the key from the in-memory user key and may pass null. No private key → no org keys.
  if (userPrivateKey == null) {
    return {};
  }

  const userPubKey = await this.derivePublicKey(userPrivateKey);

  const result: Record<OrganizationId, EncString> = {};
  for (const orgId of Object.keys(encryptedOrgKeys) as OrganizationId[]) {
    if (result[orgId] != null) {
      continue;
    }
    const encrypted = BaseEncryptedOrganizationKey.fromData(encryptedOrgKeys[orgId]);
    if (encrypted == null) {
      continue;
    }

    let orgKey: EncString;

    // The SDK only supports user-encrypted org keys, so re-encrypt provider-encrypted keys with
    // the user's public key. Remove once the SDK has support for provider keys (PM-31845 task-02).
    if (BaseEncryptedOrganizationKey.isProviderEncrypted(encrypted)) {
      if (providerKeys == null) {
        continue;
      }
      orgKey = await this.encryptService.encapsulateKeyUnsigned(
        await encrypted.decrypt(this.encryptService, providerKeys),
        userPubKey!,
      );
    } else {
      orgKey = encrypted.encryptedOrganizationKey;
    }

    result[orgId] = orgKey;
  }

  return result;
}
```

Then collapse the inline transform in `encryptedOrgKeys$` to call it:

```ts
// inside encryptedOrgKeys$(userId), the inner combineLatest switchMap:
switchMap(([encryptedOrgKeys, providerKeys]) =>
  this.toUserEncryptedOrgKeys(encryptedOrgKeys ?? {}, userPrivateKey, providerKeys),
),
```

(The old body — the `for` loop with the `userPubKey`/provider re-encryption — moves verbatim into the
new method; this is a straight extraction, no logic change.)

## Tests

- Existing `key.service.spec.ts` org-keys tests must stay green unchanged (behavior identical).

## Acceptance criteria

- [ ] `toUserEncryptedOrgKeys` exists as a private method (accepting a **nullable** `userPrivateKey`);
      `encryptedOrgKeys$` delegates to it.
- [ ] No behavior change; `key.service.spec.ts` green.
