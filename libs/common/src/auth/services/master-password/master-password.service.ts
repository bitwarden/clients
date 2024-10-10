import { firstValueFrom, map, Observable } from "rxjs";

import { EncryptService } from "../../../platform/abstractions/encrypt.service";
import { KeyGenerationService } from "../../../platform/abstractions/key-generation.service";
import { EncryptionType } from "../../../platform/enums";
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
import { InternalMasterPasswordServiceAbstraction } from "../../abstractions/master-password.service.abstraction";
import { ForceSetPasswordReason } from "../../models/domain/force-set-password-reason";

/** Memory since master key shouldn't be available on lock */
const MASTER_KEY = new UserKeyDefinition<MasterKey>(MASTER_PASSWORD_MEMORY, "masterKey", {
  deserializer: (masterKey) => SymmetricCryptoKey.fromJSON(masterKey) as MasterKey,
  clearOn: ["lock", "logout"],
});

/** Disk since master key hash is used for unlock */
const MASTER_KEY_HASH = new UserKeyDefinition<string>(MASTER_PASSWORD_DISK, "masterKeyHash", {
  deserializer: (masterKeyHash) => masterKeyHash,
  clearOn: ["logout"],
});

/** Disk to persist through lock */
const MASTER_KEY_ENCRYPTED_USER_KEY = new UserKeyDefinition<EncryptedString>(
  MASTER_PASSWORD_DISK,
  "masterKeyEncryptedUserKey",
  {
    deserializer: (key) => key,
    clearOn: ["logout"],
  },
);

/** Disk to persist through lock and account switches */
const FORCE_SET_PASSWORD_REASON = new UserKeyDefinition<ForceSetPasswordReason>(
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
    if (encryptedKey == null) {
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
    await this.stateProvider.getUser(userId, FORCE_SET_PASSWORD_REASON).update((_) => reason);
  }

  async decryptUserKeyWithMasterKey(masterKey: MasterKey, userId: UserId): Promise<UserKey> {
    if (masterKey == null) {
      throw new Error("No master key found.");
    }
    if (userId == null) {
      throw new Error("No userId found.");
    }

    const key = await firstValueFrom(
      this.stateProvider.getUser(userId, MASTER_KEY_ENCRYPTED_USER_KEY).state$,
    );
    const userKey = EncString.fromJSON(key);

    let decUserKey: Uint8Array;

    if (userKey.encryptionType === EncryptionType.AesCbc256_B64) {
      decUserKey = await this.encryptService.decryptToBytes(userKey, masterKey);
    } else if (userKey.encryptionType === EncryptionType.AesCbc256_HmacSha256_B64) {
      const newKey = await this.keyGenerationService.stretchKey(masterKey);
      decUserKey = await this.encryptService.decryptToBytes(userKey, newKey);
    } else {
      throw new Error("Unsupported encryption type.");
    }

    if (decUserKey == null) {
      return null;
    }

    return new SymmetricCryptoKey(decUserKey) as UserKey;
  }
}
