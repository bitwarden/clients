import {
  NEVER,
  Observable,
  catchError,
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  forkJoin,
  map,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { EncryptedOrganizationKeyData } from "@bitwarden/common/admin-console/models/data/encrypted-organization-key.data";
import { BaseEncryptedOrganizationKey } from "@bitwarden/common/admin-console/models/domain/encrypted-organization-key";
import { ProfileOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-organization.response";
import { ProfileProviderOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-provider-organization.response";
import { ProfileProviderResponse } from "@bitwarden/common/admin-console/models/response/profile-provider.response";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { USER_KEY } from "@bitwarden/common/key-management/state-definitions";
import { VaultTimeoutStringType } from "@bitwarden/common/key-management/vault-timeout";
import { VAULT_TIMEOUT } from "@bitwarden/common/key-management/vault-timeout/services/vault-timeout-settings.state";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { asUuid, SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { convertValues } from "@bitwarden/common/platform/misc/convert-values";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { USER_ENCRYPTED_ORGANIZATION_KEYS } from "@bitwarden/common/platform/services/key-state/org-keys.state";
import { USER_ENCRYPTED_PROVIDER_KEYS } from "@bitwarden/common/platform/services/key-state/provider-keys.state";
import { USER_EVER_HAD_USER_KEY } from "@bitwarden/common/platform/services/key-state/user-key.state";
import { StateProvider } from "@bitwarden/common/platform/state";
import { OrganizationId, ProviderId, UserId } from "@bitwarden/common/types/guid";
import {
  OrgKey,
  UserKey,
  MasterKey,
  ProviderKey,
  UserPrivateKey,
  UserPublicKey,
} from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import {
  CryptoFunctionService,
  EncryptedString,
  EncryptService,
  EncString,
  SignedPublicKey,
  SymmetricCryptoKey,
  WrappedSigningKey,
} from "@bitwarden/legacy-crypto";
import { WrappedAccountCryptographicState } from "@bitwarden/sdk-internal";

import {
  CipherDecryptionKeys,
  KeyService as KeyServiceAbstraction,
  SdkUnlockData,
} from "./abstractions/key.service";
import { BiometricsService } from "./biometrics/biometric.service";

export class DefaultKeyService implements KeyServiceAbstraction {
  /**
   * Retrieves a stream of the active users organization keys,
   * will NOT emit any value if there is no active user.
   *
   * @deprecated Use {@link orgKeys$} with a required {@link UserId} instead.
   * TODO to be removed with https://bitwarden.atlassian.net/browse/PM-23623
   */
  private readonly activeUserOrgKeys$: Observable<Record<OrganizationId, OrgKey>>;

  constructor(
    protected cryptoFunctionService: CryptoFunctionService,
    protected encryptService: EncryptService,
    protected platformUtilService: PlatformUtilsService,
    protected logService: LogService,
    protected stateService: StateService,
    protected stateProvider: StateProvider,
    protected accountCryptographyStateService: AccountCryptographicStateService,
    protected biometricsService: BiometricsService,
    protected sdkService: SdkService,
  ) {
    this.activeUserOrgKeys$ = this.stateProvider.activeUserId$.pipe(
      switchMap((userId) => (userId != null ? this.orgKeys$(userId) : NEVER)),
      filter((orgKeys) => orgKeys != null),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: false }),
    ) as Observable<Record<OrganizationId, OrgKey>>;
  }

  async setUserKey(key: UserKey, userId: UserId): Promise<void> {
    if (key == null) {
      throw new Error("No key provided. Lock the user to clear the key");
    }
    if (userId == null) {
      throw new Error("No userId provided.");
    }

    // No SDK push here. Every unlock goes through UnlockService (PM-41489), which pushes for itself;
    // the only caller left is refreshAdditionalKeys(), which re-commits a key the live client already
    // holds, so a push would clear and re-initialize the keystore for nothing.

    // Set userId to ensure we have one for the account status update
    await this.stateProvider.setUserState(USER_KEY, key, userId);
    await this.stateProvider.setUserState(USER_EVER_HAD_USER_KEY, true, userId);

    await this.storeAdditionalKeys(key, userId);

    // Await the key actually being set. This ensures that any subsequent callers know the key is already in state.
    // There were bugs related to the stateprovider observables in the past that caused issues around this.
    const userKey = await firstValueFrom(this.userKey$(userId).pipe(filter((k) => k != null)));
    if (userKey == null) {
      throw new Error("Failed to set user key");
    }
  }

  /**
   * Builds the payload to (re)initialize the SDK client's user + org crypto for a user. Returns null
   * when the account's cryptographic state isn't available yet (e.g. mid-registration), in which case the
   * SDK is initialized later once it is set. Shared by `setUserKey` and the unlock flow so both produce
   * identical input for the SDK.
   *
   * The account's email and KDF config are deliberately absent: `SdkService.unlock` resolves those itself
   * (as it already does `upgradeToken`), which is what lets this service hold neither `AccountService` nor
   * `KdfConfigService` — both moved to `LegacyCompatKeyService` in #22319.
   */
  async buildSdkUnlockData(userId: UserId, userKey: UserKey): Promise<SdkUnlockData | null> {
    const accountCryptographicState = await firstValueFrom(
      this.accountCryptographyStateService.accountCryptographicState$(userId),
    );
    if (accountCryptographicState == null) {
      return null;
    }

    // Derive the org-key payload from the in-memory `userKey` — NOT from encryptedOrgKeys$, which reads
    // USER_KEY back from state. The encrypted private key and encrypted org keys are persisted
    // independently of USER_KEY, so this works before USER_KEY is written (push-then-emit).
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
      request: {
        userId: asUuid(userId),
        // The key is already derived here, so the SDK is told to install it rather than re-derive it.
        method: { decryptedKey: { decrypted_user_key: userKey.toSdk() } },
        accountCryptographicState,
      },
      orgKeys: await this.toUserEncryptedOrgKeys(encOrgKeys ?? {}, userPrivateKey, providerKeys),
    };
  }

  async refreshAdditionalKeys(userId: UserId): Promise<void> {
    if (userId == null) {
      throw new Error("UserId is required.");
    }

    const key = await firstValueFrom(this.userKey$(userId));
    if (key == null) {
      throw new Error("No user key found for: " + userId);
    }

    await this.setUserKey(key, userId);
  }

  everHadUserKey$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, USER_EVER_HAD_USER_KEY)
      .state$.pipe(map((x) => x ?? false));
  }

  /**
   * @deprecated Use {@link userKey$} with a required {@link UserId} instead.
   */
  async getUserKey(userId?: UserId): Promise<UserKey | null> {
    return await firstValueFrom(this.stateProvider.getUserState$(USER_KEY, userId));
  }

  async getUserKeyFromStorage(
    keySuffix: KeySuffixOptions,
    userId: UserId,
  ): Promise<UserKey | null> {
    if (userId == null) {
      throw new Error("UserId is required");
    }

    const userKey = await this.getKeyFromStorage(keySuffix, userId);
    if (userKey == null) {
      return null;
    }

    if (!(await this.validateUserKey(userKey, userId))) {
      this.logService.warning("Invalid key, throwing away stored keys");
      await this.clearAllStoredUserKeys(userId);
    }
    return userKey;
  }

  async hasUserKey(userId: UserId): Promise<boolean> {
    if (userId == null) {
      return false;
    }

    return (await firstValueFrom(this.stateProvider.getUserState$(USER_KEY, userId))) != null;
  }

  /**
   * Clears the user key. Clears all stored versions of the user keys as well, such as the biometrics key
   * @param userId The desired user
   */
  private async clearUserKey(userId: UserId): Promise<void> {
    if (userId == null) {
      // nothing to do
      return;
    }
    // Set userId to ensure we have one for the account status update
    await this.stateProvider.setUserState(USER_KEY, null, userId);
    await this.clearAllStoredUserKeys(userId);
  }

  async clearStoredUserKey(userId: UserId): Promise<void> {
    if (userId == null) {
      throw new Error("UserId is required");
    }

    await this.stateService.setUserKeyAutoUnlock(null, { userId: userId });
  }

  async setOrgKeys(
    orgs: ProfileOrganizationResponse[],
    providerOrgs: ProfileProviderOrganizationResponse[],
    userId: UserId,
  ): Promise<void> {
    const encOrgKeyData: { [orgId: string]: EncryptedOrganizationKeyData } = {};

    for (const org of orgs) {
      encOrgKeyData[org.id] = {
        type: "organization",
        key: org.key,
      };
    }

    for (const org of providerOrgs) {
      encOrgKeyData[org.id] = {
        type: "provider",
        providerId: org.providerId,
        key: org.key,
      };
    }

    // Push-then-emit: push the org keys we just computed into the user's live SDK client (no-op while
    // locked) BEFORE writing state, so a reactive consumer never sees the new keys with a stale client.
    // We reuse `encOrgKeyData` rather than re-reading `encryptedOrgKeys$` — a state$ read right after
    // `update()` is not guaranteed to reflect the write. `userPrivateKey`/`providerKeys` are unrelated
    // to that write, so reading them here is safe; both are needed to re-encrypt provider org keys.
    const userPrivateKey = await firstValueFrom(this.userPrivateKey$(userId));
    if (userPrivateKey != null) {
      const providerKeys = await firstValueFrom(this.providerKeysHelper$(userId, userPrivateKey));
      const sdkOrgKeys = await this.toUserEncryptedOrgKeys(
        encOrgKeyData,
        userPrivateKey,
        providerKeys,
      );
      await this.sdkService.setOrgKeys(userId, sdkOrgKeys);
    }

    await this.stateProvider
      .getUser(userId, USER_ENCRYPTED_ORGANIZATION_KEYS)
      .update(() => encOrgKeyData);
  }

  async getOrgKey(orgId: OrganizationId): Promise<OrgKey | null> {
    return await firstValueFrom(
      this.activeUserOrgKeys$.pipe(map((orgKeys) => orgKeys[orgId] ?? null)),
    );
  }

  private async clearOrgKeys(userId: UserId): Promise<void> {
    if (userId == null) {
      // nothing to do
      return;
    }
    await this.stateProvider.setUserState(USER_ENCRYPTED_ORGANIZATION_KEYS, null, userId);
  }

  async setProviderKeys(providers: ProfileProviderResponse[], userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, USER_ENCRYPTED_PROVIDER_KEYS).update(() => {
      const encProviderKeys: { [providerId: ProviderId]: EncryptedString } = {};

      providers.forEach((provider) => {
        encProviderKeys[provider.id as ProviderId] = provider.key as EncryptedString;
      });

      return encProviderKeys;
    });
  }

  providerKeys$(userId: UserId): Observable<Record<ProviderId, ProviderKey> | null> {
    return this.userPrivateKey$(userId).pipe(
      switchMap((userPrivateKey) => {
        if (userPrivateKey == null) {
          return of(null);
        }

        return this.providerKeysHelper$(userId, userPrivateKey);
      }),
    );
  }

  private async clearProviderKeys(userId: UserId): Promise<void> {
    if (userId == null) {
      // nothing to do
      return;
    }
    await this.stateProvider.setUserState(USER_ENCRYPTED_PROVIDER_KEYS, null, userId);
  }

  async clearKeys(userId: UserId): Promise<void> {
    if (userId == null) {
      throw new Error("UserId is required");
    }

    await this.clearUserKey(userId);
    await this.clearOrgKeys(userId);
    await this.clearProviderKeys(userId);
    await this.stateProvider.setUserState(USER_EVER_HAD_USER_KEY, null, userId);
    await this.accountCryptographyStateService.clearAccountCryptographicState(userId);
  }

  // ---HELPERS---
  async validateUserKey(key: UserKey | MasterKey | null, userId: UserId): Promise<boolean> {
    if (key == null) {
      return false;
    }

    try {
      const encPrivateKey = await firstValueFrom(this.userEncryptedPrivateKey$(userId));

      if (encPrivateKey == null) {
        return false;
      }

      // Can decrypt private key
      const privateKey = await this.decryptPrivateKey(encPrivateKey, key);

      if (privateKey == null) {
        // failed to decrypt
        return false;
      }

      // Can successfully derive public key
      const publicKey = await this.derivePublicKey(privateKey);

      if (publicKey == null) {
        // failed to decrypt
        return false;
      }
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return false;
    }

    return true;
  }

  /**
   * Generates any additional keys if needed. Additional keys are
   * keys such as biometrics, auto, and pin keys.
   * Useful to make sure other keys stay in sync when the user key
   * has been rotated.
   * @param key The user key
   * @param userId The desired user
   */
  protected async storeAdditionalKeys(key: UserKey, userId: UserId) {
    const storeAuto = await this.shouldStoreKey(KeySuffixOptions.Auto, userId);
    if (storeAuto) {
      await this.stateService.setUserKeyAutoUnlock(key.keyB64, { userId: userId });
    } else {
      await this.stateService.setUserKeyAutoUnlock(null, { userId: userId });
    }
  }

  protected async shouldStoreKey(keySuffix: KeySuffixOptions, userId: UserId) {
    switch (keySuffix) {
      case KeySuffixOptions.Auto: {
        // Cli has fixed Never vault timeout, and it should not be affected by a policy.
        if (this.platformUtilService.getClientType() == ClientType.Cli) {
          return true;
        }

        // TODO: Sharing the UserKeyDefinition is temporary to get around a circ dep issue between
        // the VaultTimeoutSettingsSvc and this service.
        // This should be fixed as part of the PM-7082 - Auto Key Service work.
        const vaultTimeout = await firstValueFrom(
          this.stateProvider
            .getUserState$(VAULT_TIMEOUT, userId)
            .pipe(filter((timeout) => timeout != null)),
        );

        this.logService.debug(
          `[KeyService] Should store auto key for vault timeout ${vaultTimeout}`,
        );

        return vaultTimeout == VaultTimeoutStringType.Never;
      }
    }
    return false;
  }

  protected async getKeyFromStorage(
    keySuffix: KeySuffixOptions,
    userId: UserId,
  ): Promise<UserKey | null> {
    if (keySuffix === KeySuffixOptions.Auto) {
      const userKey = await this.stateService.getUserKeyAutoUnlock({ userId: userId });
      if (userKey) {
        return new SymmetricCryptoKey(Utils.fromB64ToArray(userKey)) as UserKey;
      }
    }
    return null;
  }

  protected async clearAllStoredUserKeys(userId: UserId): Promise<void> {
    // No-op on platforms that do not store a biometrics-protected copy of the user key.
    await this.biometricsService.deleteBiometricUnlockKeyForUser(userId);
    await this.stateService.setUserKeyAutoUnlock(null, { userId: userId });
  }

  userKey$(userId: UserId): Observable<UserKey | null> {
    return this.stateProvider.getUser(userId, USER_KEY).state$.pipe(map((key) => key ?? null));
  }

  userPublicKey$(userId: UserId) {
    return this.userPrivateKey$(userId).pipe(
      switchMap(async (pk) => await this.derivePublicKey(pk)),
    );
  }

  private async derivePublicKey(privateKey: UserPrivateKey | null) {
    if (privateKey == null) {
      return null;
    }

    return await this.cryptoFunctionService.rsaExtractPublicKey(privateKey);
  }

  userPrivateKey$(userId: UserId): Observable<UserPrivateKey | null> {
    return this.userPrivateKeyHelper$(userId).pipe(map((keys) => keys?.userPrivateKey ?? null));
  }

  userEncryptionKeyPair$(
    userId: UserId,
  ): Observable<{ privateKey: UserPrivateKey; publicKey: UserPublicKey } | null> {
    return this.userPrivateKey$(userId).pipe(
      switchMap(async (privateKey) => {
        if (privateKey == null) {
          return null;
        }

        const publicKey = (await this.derivePublicKey(privateKey))! as UserPublicKey;
        return { privateKey, publicKey };
      }),
    );
  }

  userEncryptedPrivateKey$(userId: UserId): Observable<EncryptedString | null> {
    return this.accountCryptographyStateService.accountCryptographicState$(userId).pipe(
      map((state: WrappedAccountCryptographicState | null) => {
        if (state == null) {
          return null;
        }
        if ("V2" in state) {
          return state.V2.private_key;
        } else if ("V1" in state) {
          return state.V1.private_key;
        } else {
          return null;
        }
      }),
    );
  }

  private userPrivateKeyHelper$(userId: UserId): Observable<{
    userKey: UserKey;
    userPrivateKey: UserPrivateKey | null;
  } | null> {
    const userKey$ = this.userKey$(userId);
    return userKey$.pipe(
      switchMap((userKey) => {
        if (userKey == null) {
          return of(null);
        }

        return this.userEncryptedPrivateKey$(userId).pipe(
          switchMap(async (encryptedPrivateKey) => {
            return await this.decryptPrivateKey(encryptedPrivateKey, userKey);
          }),
          // Combine outerscope info with user private key
          map((userPrivateKey) => ({
            userKey,
            userPrivateKey,
          })),
          catchError((err: unknown) => {
            this.logService.error(`Failed to decrypt private key for user ${userId}`);
            return of({
              userKey,
              userPrivateKey: null,
            });
          }),
        );
      }),
    );
  }

  private async decryptPrivateKey(
    encryptedPrivateKey: EncryptedString | null,
    key: SymmetricCryptoKey,
  ) {
    if (encryptedPrivateKey == null) {
      return null;
    }

    return (await this.encryptService.unwrapDecapsulationKey(
      new EncString(encryptedPrivateKey),
      key,
    )) as UserPrivateKey;
  }

  /**
   * A helper for decrypting provider keys that requires a user id and that users decrypted private key
   * this is helpful for when you may have already grabbed the user private key and don't want to redo
   * that work to get the provider keys.
   */
  private providerKeysHelper$(
    userId: UserId,
    userPrivateKey: UserPrivateKey,
  ): Observable<Record<ProviderId, ProviderKey> | null> {
    return this.stateProvider.getUser(userId, USER_ENCRYPTED_PROVIDER_KEYS).state$.pipe(
      // Convert each value in the record to it's own decryption observable
      convertValues(async (_, value) => {
        const decapsulatedKey = await this.encryptService.decapsulateKeyUnsigned(
          new EncString(value),
          userPrivateKey,
        );
        return decapsulatedKey as ProviderKey;
      }),
      // switchMap since there are no side effects
      switchMap((encryptedProviderKeys) => {
        if (encryptedProviderKeys == null) {
          return of(null);
        }

        // Can't give an empty record to forkJoin
        if (Object.keys(encryptedProviderKeys).length === 0) {
          return of({});
        }

        return forkJoin(encryptedProviderKeys);
      }),
    );
  }

  userSigningKey$(userId: UserId): Observable<WrappedSigningKey | null> {
    return this.accountCryptographyStateService.accountCryptographicState$(userId).pipe(
      map((state: WrappedAccountCryptographicState | null) => {
        if (state == null) {
          return null;
        }
        if ("V2" in state) {
          return state.V2.signing_key as WrappedSigningKey;
        } else {
          return null;
        }
      }),
    );
  }

  orgKeys$(userId: UserId): Observable<Record<OrganizationId, OrgKey> | null> {
    return this.cipherDecryptionKeys$(userId).pipe(map((keys) => keys?.orgKeys ?? null));
  }

  encryptedOrgKeys$(userId: UserId): Observable<Record<OrganizationId, EncString>> {
    return this.userPrivateKey$(userId)?.pipe(
      switchMap((userPrivateKey) => {
        if (userPrivateKey == null) {
          // We can't do any org based decryption
          return of({});
        }

        return combineLatest([
          this.stateProvider.getUser(userId, USER_ENCRYPTED_ORGANIZATION_KEYS).state$,
          this.providerKeysHelper$(userId, userPrivateKey),
        ]).pipe(
          switchMap(([encryptedOrgKeys, providerKeys]) =>
            this.toUserEncryptedOrgKeys(encryptedOrgKeys ?? {}, userPrivateKey, providerKeys),
          ),
          catchError((err: unknown) => {
            this.logService.error(
              `Failed to get encrypted organization keys for user ${userId}`,
              err,
            );
            return of({});
          }),
        );
      }),
    );
  }

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
    // Nullable on purpose: `encryptedOrgKeys$` guards before calling, but `buildSdkUnlockData` derives
    // the key from the in-memory user key and may pass null. No private key → no org keys derivable.
    if (userPrivateKey == null) {
      return {};
    }

    const userPubKey = (await this.derivePublicKey(userPrivateKey))!;

    const result: Record<OrganizationId, EncString> = {};
    for (const orgId of Object.keys(encryptedOrgKeys) as OrganizationId[]) {
      const encrypted = BaseEncryptedOrganizationKey.fromData(encryptedOrgKeys[orgId]);
      if (encrypted == null) {
        continue;
      }

      let orgKey: EncString;

      // The SDK only supports user-encrypted org keys, so re-encrypt provider-encrypted keys with
      // the user's public key. Remove once the SDK has support for provider keys.
      if (BaseEncryptedOrganizationKey.isProviderEncrypted(encrypted)) {
        if (providerKeys == null) {
          continue;
        }
        orgKey = await this.encryptService.encapsulateKeyUnsigned(
          await encrypted.decrypt(this.encryptService, providerKeys),
          userPubKey,
        );
      } else {
        orgKey = encrypted.encryptedOrganizationKey;
      }

      result[orgId] = orgKey;
    }

    return result;
  }

  cipherDecryptionKeys$(userId: UserId): Observable<CipherDecryptionKeys | null> {
    // Gated on the SDK client being able to decrypt, not on USER_KEY appearing in state. The SDK writes
    // USER_KEY back to state from inside its own unlock, before the credential paths have pushed org keys,
    // so keying on state alone starts the vault decrypt batch against a client that fails every org cipher
    // with "Missing Key for Id: Organization". Holding (rather than emitting null) keeps consumers on the
    // previous value through the gap instead of flashing "no keys", which reads as locked.
    //
    // Gated here rather than in `userPrivateKeyHelper$`: `KeyService.setOrgKeys` awaits `userPrivateKey$`
    // before calling `sdkService.setOrgKeys`, and `setOrgKeys` is what marks the client ready, so gating
    // the private key would deadlock it.
    //
    // Flag off, `cryptoReady$` is always true and this is a passthrough.
    return this.sdkService.cryptoReady$(userId).pipe(
      distinctUntilChanged(),
      filter((ready) => ready),
      switchMap(() => this.userPrivateKeyHelper$(userId)),
      switchMap((userKeys) => {
        if (userKeys == null) {
          return of(null);
        }

        const userPrivateKey = userKeys.userPrivateKey;

        if (userPrivateKey == null) {
          // We can't do any org based decryption
          return of({ userKey: userKeys.userKey, orgKeys: null });
        }

        return combineLatest([
          this.stateProvider.getUser(userId, USER_ENCRYPTED_ORGANIZATION_KEYS).state$,
          this.providerKeysHelper$(userId, userPrivateKey),
        ]).pipe(
          switchMap(async ([encryptedOrgKeys, providerKeys]) => {
            const result: Record<OrganizationId, OrgKey> = {};
            encryptedOrgKeys = encryptedOrgKeys ?? {};
            for (const orgId of Object.keys(encryptedOrgKeys) as OrganizationId[]) {
              if (result[orgId] != null) {
                continue;
              }
              const encrypted = BaseEncryptedOrganizationKey.fromData(encryptedOrgKeys[orgId]);
              if (encrypted == null) {
                continue;
              }

              let decrypted: OrgKey;

              if (BaseEncryptedOrganizationKey.isProviderEncrypted(encrypted)) {
                if (providerKeys == null) {
                  continue;
                }
                decrypted = await encrypted.decrypt(this.encryptService, providerKeys!);
              } else {
                decrypted = await encrypted.decrypt(this.encryptService, userPrivateKey);
              }

              result[orgId] = decrypted;
            }

            return result;
          }),
          // Combine them back together
          map((orgKeys) => ({ userKey: userKeys.userKey, orgKeys: orgKeys })),
        );
      }),
    );
  }

  userSignedPublicKey$(userId: UserId): Observable<SignedPublicKey | null> {
    return this.accountCryptographyStateService.accountCryptographicState$(userId).pipe(
      map((state: WrappedAccountCryptographicState | null) => {
        if (state == null) {
          return null;
        }
        if ("V2" in state) {
          return state.V2.signed_public_key as SignedPublicKey;
        } else {
          return null;
        }
      }),
    );
  }
}
