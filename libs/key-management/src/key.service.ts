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

import { EncryptedOrganizationKeyData } from "@bitwarden/common/admin-console/models/data/encrypted-organization-key.data";
import { BaseEncryptedOrganizationKey } from "@bitwarden/common/admin-console/models/domain/encrypted-organization-key";
import { ProfileOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-organization.response";
import { ProfileProviderOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-provider-organization.response";
import { ProfileProviderResponse } from "@bitwarden/common/admin-console/models/response/profile-provider.response";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { USER_KEY } from "@bitwarden/common/key-management/state-definitions";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { convertValues } from "@bitwarden/common/platform/misc/convert-values";
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
  ) {
    this.activeUserOrgKeys$ = this.stateProvider.activeUserId$.pipe(
      switchMap((userId) => (userId != null ? this.orgKeys$(userId) : NEVER)),
      filter((orgKeys) => orgKeys != null),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: false }),
    ) as Observable<Record<OrganizationId, OrgKey>>;
  }

  everHadUserKey$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, USER_EVER_HAD_USER_KEY)
      .state$.pipe(map((x) => x ?? false));
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
    await this.stateProvider.getUser(userId, USER_ENCRYPTED_ORGANIZATION_KEYS).update(() => {
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
      return encOrgKeyData;
    });
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

  async clearAllStoredUserKeys(userId: UserId): Promise<void> {
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
          switchMap(async ([encryptedOrgKeys, providerKeys]) => {
            const userPubKey = await this.derivePublicKey(userPrivateKey);

            const result: Record<OrganizationId, EncString> = {};
            encryptedOrgKeys = encryptedOrgKeys ?? {};
            for (const orgId of Object.keys(encryptedOrgKeys) as OrganizationId[]) {
              if (result[orgId] != null) {
                continue;
              }
              const encrypted = BaseEncryptedOrganizationKey.fromData(encryptedOrgKeys[orgId]);
              if (encrypted == null) {
                continue;
              }

              let orgKey: EncString;

              // Because the SDK only supports user encrypted org keys, we need to re-encrypt
              // any provider encrypted org keys with the user's public key. This should be removed
              // once the SDK has support for provider keys.
              if (BaseEncryptedOrganizationKey.isProviderEncrypted(encrypted)) {
                if (providerKeys == null) {
                  continue;
                }
                orgKey = await this.encryptService.encapsulateKeyUnsigned(
                  await encrypted.decrypt(this.encryptService, providerKeys!),
                  userPubKey!,
                );
              } else {
                orgKey = encrypted.encryptedOrganizationKey;
              }

              result[orgId] = orgKey;
            }

            return result;
          }),
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

  cipherDecryptionKeys$(userId: UserId): Observable<CipherDecryptionKeys | null> {
    return this.userPrivateKeyHelper$(userId)?.pipe(
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
