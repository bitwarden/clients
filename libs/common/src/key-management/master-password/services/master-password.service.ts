// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, KdfConfigService } from "@bitwarden/key-management";

import { AccountService } from "../../../auth/abstractions/account.service";
import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { KeyGenerationService } from "../../../platform/abstractions/key-generation.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { EncryptionType, HashPurpose } from "../../../platform/enums";
import { Utils } from "../../../platform/misc/utils";
import { EncryptedString, EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import {
  MASTER_PASSWORD_DISK,
  MASTER_PASSWORD_MEMORY,
  StateProvider,
  UserKeyDefinition,
} from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { MasterKey, UserKey } from "../../../types/key";
import { CryptoFunctionService } from "../../crypto/abstractions/crypto-function.service";
import { EncryptService } from "../../crypto/abstractions/encrypt.service";
import { InternalMasterPasswordServiceAbstraction } from "../abstractions/master-password.service.abstraction";

/** Memory since master key shouldn't be available on lock */
export const MASTER_KEY = new UserKeyDefinition<MasterKey>(MASTER_PASSWORD_MEMORY, "masterKey", {
  deserializer: (masterKey) => SymmetricCryptoKey.fromJSON(masterKey) as MasterKey,
  clearOn: ["lock", "logout"],
});

/** Disk since master key hash is used for unlock */
export const MASTER_KEY_HASH = new UserKeyDefinition<string>(
  MASTER_PASSWORD_DISK,
  "masterKeyHash",
  {
    deserializer: (masterKeyHash) => masterKeyHash,
    clearOn: ["logout"],
  },
);

/** Disk to persist through lock */
export const MASTER_KEY_ENCRYPTED_USER_KEY = new UserKeyDefinition<EncryptedString>(
  MASTER_PASSWORD_DISK,
  "masterKeyEncryptedUserKey",
  {
    deserializer: (key) => key,
    clearOn: ["logout"],
  },
);

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
    private encryptService: EncryptService,
    private logService: LogService,
    private accountService: AccountService,
    private kdfConfigService: KdfConfigService,
    private cryptoFunctionService: CryptoFunctionService,
  ) {}

  masterKey$(userId: UserId): Observable<MasterKey> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }
    return this.stateProvider.getUser(userId, MASTER_KEY).state$;
  }

  masterKeyHash$(userId: UserId): Observable<string> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }
    return this.stateProvider.getUser(userId, MASTER_KEY_HASH).state$;
  }

  forceSetPasswordReason$(userId: UserId): Observable<ForceSetPasswordReason> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }
    return this.stateProvider
      .getUser(userId, FORCE_SET_PASSWORD_REASON)
      .state$.pipe(map((reason) => reason ?? ForceSetPasswordReason.None));
  }

  // TODO: Remove this method and decrypt directly in the service instead
  async getMasterKeyEncryptedUserKey(userId: UserId): Promise<EncString> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }
    const key = await firstValueFrom(
      this.stateProvider.getUser(userId, MASTER_KEY_ENCRYPTED_USER_KEY).state$,
    );
    return EncString.fromJSON(key);
  }

  async setMasterKey(masterKey: MasterKey, userId: UserId): Promise<void> {
    if (masterKey == null) {
      throw new Error("Master key is required.");
    }
    if (userId == null) {
      throw new Error("User ID is required.");
    }
    await this.stateProvider.getUser(userId, MASTER_KEY).update((_) => masterKey);
  }

  async clearMasterKey(userId: UserId): Promise<void> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }
    await this.stateProvider.getUser(userId, MASTER_KEY).update((_) => null);
  }

  async setMasterKeyHash(masterKeyHash: string, userId: UserId): Promise<void> {
    if (masterKeyHash == null) {
      throw new Error("Master key hash is required.");
    }
    if (userId == null) {
      throw new Error("User ID is required.");
    }
    await this.stateProvider.getUser(userId, MASTER_KEY_HASH).update((_) => masterKeyHash);
  }

  async clearMasterKeyHash(userId: UserId): Promise<void> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }
    await this.stateProvider.getUser(userId, MASTER_KEY_HASH).update((_) => null);
  }

  async setMasterKeyEncryptedUserKey(encryptedKey: EncString, userId: UserId): Promise<void> {
    if (encryptedKey == null || encryptedKey.encryptedString == null) {
      throw new Error("Encrypted Key is required.");
    }
    if (userId == null) {
      throw new Error("User ID is required.");
    }
    await this.stateProvider
      .getUser(userId, MASTER_KEY_ENCRYPTED_USER_KEY)
      .update((_) => encryptedKey.toJSON() as EncryptedString);
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

  async decryptUserKeyWithMasterKey(
    masterKey: MasterKey,
    userId: UserId,
    userKey?: EncString,
  ): Promise<UserKey | null> {
    userKey ??= await this.getMasterKeyEncryptedUserKey(userId);
    masterKey ??= await firstValueFrom(this.masterKey$(userId));

    if (masterKey == null) {
      throw new Error("No master key found.");
    }

    let decUserKey: SymmetricCryptoKey;

    if (userKey.encryptionType === EncryptionType.AesCbc256_B64) {
      try {
        decUserKey = await this.encryptService.unwrapSymmetricKey(userKey, masterKey);
      } catch {
        this.logService.warning("Failed to decrypt user key with master key.");
        return null;
      }
    } else if (userKey.encryptionType === EncryptionType.AesCbc256_HmacSha256_B64) {
      try {
        const newKey = await this.keyGenerationService.stretchKey(masterKey);
        decUserKey = await this.encryptService.unwrapSymmetricKey(userKey, newKey);
      } catch {
        this.logService.warning("Failed to decrypt user key with stretched master key.");
        return null;
      }
    } else {
      throw new Error("Unsupported encryption type.");
    }

    if (decUserKey == null) {
      this.logService.warning("Failed to decrypt user key with master key, user key is null.");
      return null;
    }

    return decUserKey as UserKey;
  }

  async getOrDeriveMasterKey(password: string, userId: UserId): Promise<MasterKey> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }

    const masterKey = await firstValueFrom(this.masterKey$(userId));
    if (masterKey != null) {
      return masterKey;
    }

    const email = await firstValueFrom(
      this.accountService.accounts$.pipe(map((accounts) => accounts[userId]?.email)),
    );
    if (email == null) {
      throw new Error("No email found for user " + userId);
    }
    const kdf = await firstValueFrom(this.kdfConfigService.getKdfConfig$(userId));
    if (kdf == null) {
      throw new Error("No kdf found for user " + userId);
    }
    return await this.makeMasterKey(password, email, kdf);
  }

  /**
   * Derive a master key from a password and email.
   * @remarks
   * Does not validate the kdf config to ensure it satisfies the minimum requirements for the given kdf type.
   */
  async makeMasterKey(password: string, email: string, KdfConfig: KdfConfig): Promise<MasterKey> {
    const start = new Date().getTime();
    email = email.trim().toLowerCase();
    const masterKey = (await this.keyGenerationService.deriveKeyFromPassword(
      password,
      email,
      KdfConfig,
    )) as MasterKey;
    const end = new Date().getTime();
    this.logService.info(`[MasterPasswordService] Deriving master key took ${end - start}ms`);

    return masterKey;
  }

  async hashMasterKey(
    password: string,
    key: MasterKey,
    hashPurpose?: HashPurpose,
  ): Promise<string> {
    if (password == null) {
      throw new Error("password is required.");
    }
    if (key == null) {
      throw new Error("key is required.");
    }

    const iterations = hashPurpose === HashPurpose.LocalAuthorization ? 2 : 1;
    const hash = await this.cryptoFunctionService.pbkdf2(
      key.inner().encryptionKey,
      password,
      "sha256",
      iterations,
    );
    return Utils.fromBufferToB64(hash);
  }

  async compareKeyHash(
    masterPassword: string | null,
    masterKey: MasterKey,
    userId: UserId,
  ): Promise<boolean> {
    if (masterKey == null) {
      throw new Error("'masterKey' is required to be non-null.");
    }

    if (masterPassword == null) {
      // If they don't give us a master password, we can't hash it, and therefore
      // it will never match what we have stored.
      return false;
    }

    // Retrieve the current password hash
    const storedPasswordHash = await firstValueFrom(this.masterKeyHash$(userId));

    if (storedPasswordHash == null) {
      return false;
    }

    // Hash the key for local use
    const localKeyHash = await this.hashMasterKey(
      masterPassword,
      masterKey,
      HashPurpose.LocalAuthorization,
    );

    // Check if the stored hash is already equal to the hash we create locally
    if (localKeyHash == null || storedPasswordHash !== localKeyHash) {
      return false;
    }

    return true;
  }
}
