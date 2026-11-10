// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, from, iif, map, Observable, of, switchMap } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { USER_DECRYPTION_OPTIONS } from "@bitwarden/auth/common";
// eslint-disable-next-line no-restricted-imports
import {
  CryptoFunctionService,
  KdfConfig,
  KeyGenerationService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { AccountService } from "../../../auth/abstractions/account.service";
import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { assertNonNullish } from "../../../auth/utils";
import { FeatureFlag, getFeatureFlagValue } from "../../../enums/feature-flag.enum";
import { SdkLoadService } from "../../../platform/abstractions/sdk/sdk-load.service";
import { Utils } from "../../../platform/misc/utils";
import { USER_SERVER_CONFIG } from "../../../platform/services/config/default-config.service";
import { MASTER_PASSWORD_DISK, StateProvider, UserKeyDefinition } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { MasterKey, UserKey } from "../../../types/key";
import { USES_KEY_CONNECTOR } from "../../key-connector/services/key-connector.service";
import { MASTER_PASSWORD_UNLOCK_DATA } from "../../state-definitions";
import { InternalMasterPasswordServiceAbstraction } from "../abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../types/master-password.types";

/** Disk to persist through lock and account switches */
export const FORCE_SET_PASSWORD_REASON = new UserKeyDefinition<ForceSetPasswordReason>(
  MASTER_PASSWORD_DISK,
  "forceSetPasswordReason",
  {
    deserializer: (reason) => reason,
    clearOn: ["logout"],
  },
);

export class MasterPasswordService implements InternalMasterPasswordServiceAbstraction {
  constructor(
    private stateProvider: StateProvider,
    private keyGenerationService: KeyGenerationService,
    private cryptoFunctionService: CryptoFunctionService,
    private accountService: AccountService,
  ) {}

  async userHasMasterPassword(userId: UserId): Promise<boolean> {
    assertNonNullish(userId, "userId");
    // A user has a master-password if they have master-password unlock data *but* are not a key
    // connector user.
    const usesKeyConnector = await firstValueFrom(
      this.stateProvider.getUser(userId, USES_KEY_CONNECTOR).state$,
    );
    const unlockData = await firstValueFrom(this.masterPasswordUnlockData$(userId));
    return unlockData != null && !usesKeyConnector;
  }

  private async serverSaysUserHasMasterPassword(userId: UserId): Promise<boolean> {
    const decryptionOptions = await firstValueFrom(
      this.stateProvider.getUser(userId, USER_DECRYPTION_OPTIONS).state$,
    );
    return decryptionOptions?.hasMasterPassword ?? false;
  }

  saltForUser$(userId: UserId): Observable<MasterPasswordSalt> {
    assertNonNullish(userId, "userId");

    // Note: We can't use the config service as an abstraction here because it creates a circular dependency: ConfigService -> ConfigApiService -> ApiService -> VaultTimeoutSettingsService -> KeyService -> MP service.
    return this.stateProvider.getUser(userId, USER_SERVER_CONFIG).state$.pipe(
      map((serverConfig) =>
        getFeatureFlagValue(serverConfig, FeatureFlag.PM31088_MasterPasswordServiceEmitSalt),
      ),
      switchMap((enabled) =>
        iif(
          () => enabled,
          this.masterPasswordUnlockData$(userId).pipe(
            switchMap((unlockData) => {
              if (unlockData != null) {
                return of(unlockData.salt);
              }
              // No unlock data. Determine whether this is a hydration failure
              // or a user who legitimately has no master password yet
              // (e.g., TDE offboarding). This cannot use userHasMasterPassword, which answers
              // from the very unlock data that is missing here.
              return from(this.serverSaysUserHasMasterPassword(userId)).pipe(
                switchMap((hasMp) => {
                  if (hasMp) {
                    throw new Error("Master password unlock data not found for user.");
                  }
                  // TODO: PM-32059 — Edge case: user does not have a master password (e.g., TDE offboarding).
                  // When salt is disconnected from email (Stage 3), part of that should involve a "generateSalt"
                  // function that TDE offboarding deliberately calls; it should not be a side-effect of retrieving
                  // the user's salt.
                  return this.accountService.accounts$.pipe(
                    map((accounts) => accounts[userId].email),
                    map((email) => this.emailToSalt(email)),
                  );
                }),
              );
            }),
          ),
          this.accountService.accounts$.pipe(
            map((accounts) => accounts[userId].email),
            map((email) => this.emailToSalt(email)),
          ),
        ),
      ),
    );
  }

  forceSetPasswordReason$(userId: UserId): Observable<ForceSetPasswordReason> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }
    return this.stateProvider
      .getUser(userId, FORCE_SET_PASSWORD_REASON)
      .state$.pipe(map((reason) => reason ?? ForceSetPasswordReason.None));
  }

  emailToSalt(email: string): MasterPasswordSalt {
    return email.toLowerCase().trim() as MasterPasswordSalt;
  }

  async setForceSetPasswordReason(reason: ForceSetPasswordReason, userId: UserId): Promise<void> {
    if (reason == null) {
      throw new Error("Reason is required.");
    }
    if (userId == null) {
      throw new Error("User ID is required.");
    }

    // Don't overwrite AdminForcePasswordReset with any other reasons other than None
    // as we must allow a reset when the user has completed admin account recovery
    const currentReason = await firstValueFrom(this.forceSetPasswordReason$(userId));
    if (
      currentReason === ForceSetPasswordReason.AdminForcePasswordReset &&
      reason !== ForceSetPasswordReason.None
    ) {
      return;
    }

    await this.stateProvider.getUser(userId, FORCE_SET_PASSWORD_REASON).update((_) => reason);
  }

  async makeMasterPasswordAuthenticationData(
    password: string,
    kdf: KdfConfig,
    salt: MasterPasswordSalt,
  ): Promise<MasterPasswordAuthenticationData> {
    assertNonNullish(password, "password");
    assertNonNullish(kdf, "kdf");
    assertNonNullish(salt, "salt");
    if (password === "") {
      throw new Error("Master password cannot be empty.");
    }

    // We don't trust callers to use masterpasswordsalt correctly. They may type assert incorrectly.
    salt = salt.toLowerCase().trim() as MasterPasswordSalt;

    const SERVER_AUTHENTICATION_HASH_ITERATIONS = 1;

    const masterKey = (await this.keyGenerationService.deriveKeyFromPassword(
      password,
      salt,
      kdf,
    )) as MasterKey;

    const masterPasswordAuthenticationHash = Utils.fromBufferToB64(
      await this.cryptoFunctionService.pbkdf2(
        masterKey.toEncoded(),
        password,
        "sha256",
        SERVER_AUTHENTICATION_HASH_ITERATIONS,
      ),
    ) as MasterPasswordAuthenticationHash;

    return {
      salt,
      kdf,
      masterPasswordAuthenticationHash,
    } as MasterPasswordAuthenticationData;
  }

  async makeMasterPasswordUnlockData(
    password: string,
    kdf: KdfConfig,
    salt: MasterPasswordSalt,
    userKey: UserKey,
  ): Promise<MasterPasswordUnlockData> {
    assertNonNullish(password, "password");
    assertNonNullish(kdf, "kdf");
    assertNonNullish(salt, "salt");
    assertNonNullish(userKey, "userKey");
    if (password === "") {
      throw new Error("Master password cannot be empty.");
    }

    // We don't trust callers to use masterpasswordsalt correctly. They may type assert incorrectly.
    salt = salt.toLowerCase().trim() as MasterPasswordSalt;

    await SdkLoadService.Ready;
    const masterKeyWrappedUserKey = PureCrypto.encrypt_user_key_with_master_password(
      userKey.toEncoded(),
      password,
      salt,
      kdf.toSdkConfig(),
    ) as MasterKeyWrappedUserKey;
    return new MasterPasswordUnlockData(salt, kdf, masterKeyWrappedUserKey);
  }

  async unwrapUserKeyFromMasterPasswordUnlockData(
    password: string,
    masterPasswordUnlockData: MasterPasswordUnlockData,
  ): Promise<UserKey> {
    assertNonNullish(password, "password");
    assertNonNullish(masterPasswordUnlockData, "masterPasswordUnlockData");

    await SdkLoadService.Ready;
    const userKey = new SymmetricCryptoKey(
      PureCrypto.decrypt_user_key_with_master_password(
        masterPasswordUnlockData.masterKeyWrappedUserKey,
        password,
        masterPasswordUnlockData.salt,
        masterPasswordUnlockData.kdf.toSdkConfig(),
      ),
    );

    return userKey as UserKey;
  }

  async setMasterPasswordUnlockData(
    masterPasswordUnlockData: MasterPasswordUnlockData,
    userId: UserId,
  ): Promise<void> {
    assertNonNullish(masterPasswordUnlockData, "masterPasswordUnlockData");
    assertNonNullish(userId, "userId");

    await this.stateProvider
      .getUser(userId, MASTER_PASSWORD_UNLOCK_DATA)
      .update(() => masterPasswordUnlockData.toJSON());
  }

  async clearMasterPasswordUnlockData(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");

    await this.stateProvider.getUser(userId, MASTER_PASSWORD_UNLOCK_DATA).update(() => null);
  }

  masterPasswordUnlockData$(userId: UserId): Observable<MasterPasswordUnlockData | null> {
    assertNonNullish(userId, "userId");

    return this.stateProvider.getUser(userId, MASTER_PASSWORD_UNLOCK_DATA).state$;
  }
}
