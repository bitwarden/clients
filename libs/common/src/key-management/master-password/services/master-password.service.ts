// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, iif, map, Observable, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { FeatureFlag, getFeatureFlagValue } from "../../../enums/feature-flag.enum";
import { LogService } from "../../../platform/abstractions/log.service";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { USER_SERVER_CONFIG } from "../../../platform/services/config/default-config.service";
import {
  MASTER_PASSWORD_DISK,
  MASTER_PASSWORD_MEMORY,
  MASTER_PASSWORD_UNLOCK_DISK,
  StateProvider,
  UserKeyDefinition,
} from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { KeyGenerationService } from "../../crypto";
import { CryptoFunctionService } from "../../crypto/abstractions/crypto-function.service";
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

/** Disk to persist through lock */
export const MASTER_PASSWORD_UNLOCK_KEY = new UserKeyDefinition<MasterPasswordUnlockData>(
  MASTER_PASSWORD_UNLOCK_DISK,
  "masterPasswordUnlockKey",
  {
    deserializer: (obj) => MasterPasswordUnlockData.fromJSON(obj),
    clearOn: ["logout"],
  },
);

export class MasterPasswordService implements InternalMasterPasswordServiceAbstraction {
  constructor(
    private stateProvider: StateProvider,
    private keyGenerationService: KeyGenerationService,
    private cryptoFunctionService: CryptoFunctionService,
    private accountService: AccountService,
  ) { }

  async userHasMasterPassword(userId: UserId): Promise<boolean> {
    assertNonNullish(userId, "userId");
    const masterPasswordUnlockData = await firstValueFrom(
      this.stateProvider.getUser(userId, MASTER_PASSWORD_UNLOCK_KEY).state$,
    );
    return masterPasswordUnlockData != null;
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
            map((unlockData) => {
              if (unlockData == null) {
                throw new Error("Master password unlock data not found for user.");
              }
              return unlockData.salt;
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
    ));

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
      .getUser(userId, MASTER_PASSWORD_UNLOCK_KEY)
      .update(() => masterPasswordUnlockData.toJSON());
  }

  masterPasswordUnlockData$(userId: UserId): Observable<MasterPasswordUnlockData | null> {
    assertNonNullish(userId, "userId");

    return this.stateProvider.getUser(userId, MASTER_PASSWORD_UNLOCK_KEY).state$;
  }
}
