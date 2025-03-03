// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncString, EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import {
  PIN_DISK,
  PIN_MEMORY,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, PinKey, UserKey } from "@bitwarden/common/types/key";
import { KdfConfig, KdfConfigService } from "@bitwarden/key-management";

import { PinServiceAbstraction } from "../../abstractions/pin.service.abstraction";

/**
 * - DISABLED   : No PIN set.
 * - PERSISTENT : PIN is set and persists through client reset.
 * - EPHEMERAL  : PIN is set, but does NOT persist through client reset. This means that
 *                after client reset the master password is required to unlock.
 */
export type PinLockType = "DISABLED" | "PERSISTENT" | "EPHEMERAL";

/**
 * The persistent (stored on disk) version of the UserKey, encrypted by the PinKey.
 *
 * @remarks Persists through a client reset. Used when `requireMasterPasswordOnClientRestart` is disabled.
 * @see SetPinComponent.setPinForm.requireMasterPasswordOnClientRestart
 */
export const PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT = new UserKeyDefinition<EncryptedString>(
  PIN_DISK,
  "pinKeyEncryptedUserKeyPersistent",
  {
    deserializer: (jsonValue) => jsonValue,
    clearOn: ["logout"],
  },
);

/**
 * The ephemeral (stored in memory) version of the UserKey, encrypted by the PinKey.
 *
 * @remarks Does NOT persist through a client reset. Used when `requireMasterPasswordOnClientRestart` is enabled.
 * @see SetPinComponent.setPinForm.requireMasterPasswordOnClientRestart
 */
export const PIN_KEY_ENCRYPTED_USER_KEY_EPHEMERAL = new UserKeyDefinition<EncryptedString>(
  PIN_MEMORY,
  "pinKeyEncryptedUserKeyEphemeral",
  {
    deserializer: (jsonValue) => jsonValue,
    clearOn: ["logout"],
  },
);

/**
 * The PIN, encrypted by the UserKey.
 */
export const USER_KEY_ENCRYPTED_PIN = new UserKeyDefinition<EncryptedString>(
  PIN_DISK,
  "userKeyEncryptedPin",
  {
    deserializer: (jsonValue) => jsonValue,
    clearOn: ["logout"],
  },
);

/**
 * The old MasterKey, encrypted by the PinKey (formerly called `pinProtected`).
 * Deprecated and used for migration purposes only.
 */
export const OLD_PIN_KEY_ENCRYPTED_MASTER_KEY = new UserKeyDefinition<EncryptedString>(
  PIN_DISK,
  "oldPinKeyEncryptedMasterKey",
  {
    deserializer: (jsonValue) => jsonValue,
    clearOn: ["logout"],
  },
);

export class PinService implements PinServiceAbstraction {
  constructor(
    private accountService: AccountService,
    private cryptoFunctionService: CryptoFunctionService,
    private encryptService: EncryptService,
    private kdfConfigService: KdfConfigService,
    private keyGenerationService: KeyGenerationService,
    private logService: LogService,
    private masterPasswordService: MasterPasswordServiceAbstraction,
    private stateProvider: StateProvider,
    private stateService: StateService,
  ) {}

  async getPinKeyEncryptedUserKeyPersistent(userId: UserId): Promise<EncString | null> {
    this.validateUserId(userId, "Cannot get pinKeyEncryptedUserKeyPersistent.");

    return EncString.fromJSON(
      await firstValueFrom(
        this.stateProvider.getUserState$(PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, userId),
      ),
    );
  }

  /**
   * Sets the persistent (stored on disk) version of the UserKey, encrypted by the PinKey.
   */
  private async setPinKeyEncryptedUserKeyPersistent(
    pinKeyEncryptedUserKey: EncString,
    userId: UserId,
  ): Promise<void> {
    this.validateUserId(userId, "Cannot set pinKeyEncryptedUserKeyPersistent.");

    if (pinKeyEncryptedUserKey == null) {
      throw new Error(
        "No pinKeyEncryptedUserKey provided. Cannot set pinKeyEncryptedUserKeyPersistent.",
      );
    }

    await this.stateProvider.setUserState(
      PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
      pinKeyEncryptedUserKey?.encryptedString,
      userId,
    );
  }

  async clearPinKeyEncryptedUserKeyPersistent(userId: UserId): Promise<void> {
    this.validateUserId(userId, "Cannot clear pinKeyEncryptedUserKeyPersistent.");

    await this.stateProvider.setUserState(PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, null, userId);
  }

  async getPinKeyEncryptedUserKeyEphemeral(userId: UserId): Promise<EncString | null> {
    this.validateUserId(userId, "Cannot get pinKeyEncryptedUserKeyEphemeral.");

    return EncString.fromJSON(
      await firstValueFrom(
        this.stateProvider.getUserState$(PIN_KEY_ENCRYPTED_USER_KEY_EPHEMERAL, userId),
      ),
    );
  }

  /**
   * Sets the ephemeral (stored in memory) version of the UserKey, encrypted by the PinKey.
   */
  private async setPinKeyEncryptedUserKeyEphemeral(
    pinKeyEncryptedUserKey: EncString,
    userId: UserId,
  ): Promise<void> {
    this.validateUserId(userId, "Cannot set pinKeyEncryptedUserKeyEphemeral.");

    if (pinKeyEncryptedUserKey == null) {
      throw new Error(
        "No pinKeyEncryptedUserKey provided. Cannot set pinKeyEncryptedUserKeyEphemeral.",
      );
    }

    await this.stateProvider.setUserState(
      PIN_KEY_ENCRYPTED_USER_KEY_EPHEMERAL,
      pinKeyEncryptedUserKey?.encryptedString,
      userId,
    );
  }

  async clearPinKeyEncryptedUserKeyEphemeral(userId: UserId): Promise<void> {
    this.validateUserId(userId, "Cannot clear pinKeyEncryptedUserKeyEphemeral.");

    await this.stateProvider.setUserState(PIN_KEY_ENCRYPTED_USER_KEY_EPHEMERAL, null, userId);
  }

  async createPinKeyEncryptedUserKey(
    pin: string,
    userKey: UserKey,
    userId: UserId,
  ): Promise<EncString> {
    this.validateUserId(userId, "Cannot create pinKeyEncryptedUserKey.");

    if (!userKey) {
      throw new Error("No UserKey provided. Cannot create pinKeyEncryptedUserKey.");
    }

    const email = await firstValueFrom(
      this.accountService.accounts$.pipe(map((accounts) => accounts[userId].email)),
    );
    const kdfConfig = await this.kdfConfigService.getKdfConfig();

    const pinKey = await this.makePinKey(pin, email, kdfConfig);

    return await this.encryptService.encrypt(userKey.key, pinKey);
  }

  async storePinKeyEncryptedUserKey(
    pinKeyEncryptedUserKey: EncString,
    storeAsEphemeral: boolean,
    userId: UserId,
  ): Promise<void> {
    this.validateUserId(userId, "Cannot store pinKeyEncryptedUserKey.");

    if (storeAsEphemeral) {
      await this.setPinKeyEncryptedUserKeyEphemeral(pinKeyEncryptedUserKey, userId);
    } else {
      await this.setPinKeyEncryptedUserKeyPersistent(pinKeyEncryptedUserKey, userId);
    }
  }

  async getUserKeyEncryptedPin(userId: UserId): Promise<EncString | null> {
    this.validateUserId(userId, "Cannot get userKeyEncryptedPin.");

    return EncString.fromJSON(
      await firstValueFrom(this.stateProvider.getUserState$(USER_KEY_ENCRYPTED_PIN, userId)),
    );
  }

  async setUserKeyEncryptedPin(userKeyEncryptedPin: EncString, userId: UserId): Promise<void> {
    this.validateUserId(userId, "Cannot set userKeyEncryptedPin.");

    await this.stateProvider.setUserState(
      USER_KEY_ENCRYPTED_PIN,
      userKeyEncryptedPin?.encryptedString,
      userId,
    );
  }

  async clearUserKeyEncryptedPin(userId: UserId): Promise<void> {
    this.validateUserId(userId, "Cannot clear userKeyEncryptedPin.");

    await this.stateProvider.setUserState(USER_KEY_ENCRYPTED_PIN, null, userId);
  }

  async createUserKeyEncryptedPin(pin: string, userKey: UserKey): Promise<EncString> {
    if (!userKey) {
      throw new Error("No UserKey provided. Cannot create userKeyEncryptedPin.");
    }

    return await this.encryptService.encrypt(pin, userKey);
  }

  async getOldPinKeyEncryptedMasterKey(userId: UserId): Promise<EncryptedString | null> {
    this.validateUserId(userId, "Cannot get oldPinKeyEncryptedMasterKey.");

    return await firstValueFrom(
      this.stateProvider.getUserState$(OLD_PIN_KEY_ENCRYPTED_MASTER_KEY, userId),
    );
  }

  async clearOldPinKeyEncryptedMasterKey(userId: UserId): Promise<void> {
    this.validateUserId(userId, "Cannot clear oldPinKeyEncryptedMasterKey.");

    await this.stateProvider.setUserState(OLD_PIN_KEY_ENCRYPTED_MASTER_KEY, null, userId);
  }

  async makePinKey(pin: string, salt: string, kdfConfig: KdfConfig): Promise<PinKey> {
    const pinKey = await this.keyGenerationService.deriveKeyFromPassword(pin, salt, kdfConfig);
    return (await this.keyGenerationService.stretchKey(pinKey)) as PinKey;
  }

  async getPinLockType(userId: UserId): Promise<PinLockType> {
    this.validateUserId(userId, "Cannot get PinLockType.");

    /**
     * We can't check the `userKeyEncryptedPin` (formerly called `protectedPin`) for both because old
     * accounts only used it for MP on Restart
     */
    const aUserKeyEncryptedPinIsSet = !!(await this.getUserKeyEncryptedPin(userId));
    const aPinKeyEncryptedUserKeyPersistentIsSet =
      !!(await this.getPinKeyEncryptedUserKeyPersistent(userId));
    const anOldPinKeyEncryptedMasterKeyIsSet =
      !!(await this.getOldPinKeyEncryptedMasterKey(userId));

    if (aPinKeyEncryptedUserKeyPersistentIsSet || anOldPinKeyEncryptedMasterKeyIsSet) {
      return "PERSISTENT";
    } else if (
      aUserKeyEncryptedPinIsSet &&
      !aPinKeyEncryptedUserKeyPersistentIsSet &&
      !anOldPinKeyEncryptedMasterKeyIsSet
    ) {
      return "EPHEMERAL";
    } else {
      return "DISABLED";
    }
  }

  async isPinSet(userId: UserId): Promise<boolean> {
    this.validateUserId(userId, "Cannot determine if PIN is set.");

    return (await this.getPinLockType(userId)) !== "DISABLED";
  }

  async isPinDecryptionAvailable(userId: UserId): Promise<boolean> {
    this.validateUserId(userId, "Cannot determine if decryption of user key via PIN is available.");

    const pinLockType = await this.getPinLockType(userId);

    switch (pinLockType) {
      case "DISABLED":
        return false;
      case "PERSISTENT":
        // The above getPinLockType call ensures that we have either a PinKeyEncryptedUserKey or OldPinKeyEncryptedMasterKey set.
        return true;
      case "EPHEMERAL": {
        // The above getPinLockType call ensures that we have a UserKeyEncryptedPin set.
        // However, we must additively check to ensure that we have a set PinKeyEncryptedUserKeyEphemeral b/c otherwise
        // we cannot take a PIN, derive a PIN key, and decrypt the ephemeral UserKey.
        const pinKeyEncryptedUserKeyEphemeral =
          await this.getPinKeyEncryptedUserKeyEphemeral(userId);
        return Boolean(pinKeyEncryptedUserKeyEphemeral);
      }

      default: {
        // Compile-time check for exhaustive switch
        const _exhaustiveCheck: never = pinLockType;
        throw new Error(`Unexpected pinLockType: ${_exhaustiveCheck}`);
      }
    }
  }

  async decryptUserKeyWithPin(pin: string, userId: UserId): Promise<UserKey | null> {
    this.validateUserId(userId, "Cannot decrypt user key with PIN.");

    try {
      const pinLockType = await this.getPinLockType(userId);
      const requireMasterPasswordOnClientRestart = pinLockType === "EPHEMERAL";

      const { pinKeyEncryptedUserKey, oldPinKeyEncryptedMasterKey } =
        await this.getPinKeyEncryptedKeys(pinLockType, userId);

      const email = await firstValueFrom(
        this.accountService.accounts$.pipe(map((accounts) => accounts[userId].email)),
      );
      const kdfConfig = await this.kdfConfigService.getKdfConfig();

      let userKey: UserKey;

      if (oldPinKeyEncryptedMasterKey) {
        userKey = await this.decryptAndMigrateOldPinKeyEncryptedMasterKey(
          userId,
          pin,
          email,
          kdfConfig,
          requireMasterPasswordOnClientRestart,
          oldPinKeyEncryptedMasterKey,
        );
      } else {
        userKey = await this.decryptUserKey(userId, pin, email, kdfConfig, pinKeyEncryptedUserKey);
      }

      if (!userKey) {
        this.logService.warning(`User key null after pin key decryption.`);
        return null;
      }

      if (!(await this.validatePin(userKey, pin, userId))) {
        this.logService.warning(`Pin key decryption successful but pin validation failed.`);
        return null;
      }

      return userKey;
    } catch (error) {
      this.logService.error(`Error decrypting user key with pin: ${error}`);
      return null;
    }
  }

  /**
   * Decrypts the UserKey with the provided PIN.
   */
  private async decryptUserKey(
    userId: UserId,
    pin: string,
    salt: string,
    kdfConfig: KdfConfig,
    pinKeyEncryptedUserKey?: EncString,
  ): Promise<UserKey> {
    this.validateUserId(userId, "Cannot decrypt user key.");

    pinKeyEncryptedUserKey ||= await this.getPinKeyEncryptedUserKeyPersistent(userId);
    pinKeyEncryptedUserKey ||= await this.getPinKeyEncryptedUserKeyEphemeral(userId);

    if (!pinKeyEncryptedUserKey) {
      throw new Error("No pinKeyEncryptedUserKey found.");
    }

    const pinKey = await this.makePinKey(pin, salt, kdfConfig);
    const userKey = await this.encryptService.decryptToBytes(pinKeyEncryptedUserKey, pinKey);

    return new SymmetricCryptoKey(userKey) as UserKey;
  }

  /**
   * Creates a new `pinKeyEncryptedUserKey` and clears the `oldPinKeyEncryptedMasterKey`.
   * @returns UserKey
   */
  private async decryptAndMigrateOldPinKeyEncryptedMasterKey(
    userId: UserId,
    pin: string,
    email: string,
    kdfConfig: KdfConfig,
    requireMasterPasswordOnClientRestart: boolean,
    oldPinKeyEncryptedMasterKey: EncString,
  ): Promise<UserKey> {
    this.validateUserId(userId, "Cannot decrypt and migrate oldPinKeyEncryptedMasterKey.");

    const masterKey = await this.decryptMasterKeyWithPin(
      userId,
      pin,
      email,
      kdfConfig,
      oldPinKeyEncryptedMasterKey,
    );

    const encUserKey = await this.stateService.getEncryptedCryptoSymmetricKey({ userId: userId });

    const userKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
      masterKey,
      userId,
      encUserKey ? new EncString(encUserKey) : undefined,
    );

    const pinKeyEncryptedUserKey = await this.createPinKeyEncryptedUserKey(pin, userKey, userId);
    await this.storePinKeyEncryptedUserKey(
      pinKeyEncryptedUserKey,
      requireMasterPasswordOnClientRestart,
      userId,
    );

    const userKeyEncryptedPin = await this.createUserKeyEncryptedPin(pin, userKey);
    await this.setUserKeyEncryptedPin(userKeyEncryptedPin, userId);

    await this.clearOldPinKeyEncryptedMasterKey(userId);

    return userKey;
  }

  // Only for migration purposes
  private async decryptMasterKeyWithPin(
    userId: UserId,
    pin: string,
    salt: string,
    kdfConfig: KdfConfig,
    oldPinKeyEncryptedMasterKey?: EncString,
  ): Promise<MasterKey> {
    this.validateUserId(userId, "Cannot decrypt master key with PIN.");

    if (!oldPinKeyEncryptedMasterKey) {
      const oldPinKeyEncryptedMasterKeyString = await this.getOldPinKeyEncryptedMasterKey(userId);

      if (oldPinKeyEncryptedMasterKeyString == null) {
        throw new Error("No oldPinKeyEncrytedMasterKey found.");
      }

      oldPinKeyEncryptedMasterKey = new EncString(oldPinKeyEncryptedMasterKeyString);
    }

    const pinKey = await this.makePinKey(pin, salt, kdfConfig);
    const masterKey = await this.encryptService.decryptToBytes(oldPinKeyEncryptedMasterKey, pinKey);

    return new SymmetricCryptoKey(masterKey) as MasterKey;
  }

  /**
   * Gets the user's `pinKeyEncryptedUserKey` (persistent or ephemeral) and `oldPinKeyEncryptedMasterKey`
   * (if one exists) based on the user's PinLockType.
   *
   * @remarks The `oldPinKeyEncryptedMasterKey` (formerly `pinProtected`) is only used for migration and
   *          will be null for all migrated accounts.
   * @throws If PinLockType is 'DISABLED' or if userId is not provided
   */
  private async getPinKeyEncryptedKeys(
    pinLockType: PinLockType,
    userId: UserId,
  ): Promise<{ pinKeyEncryptedUserKey: EncString; oldPinKeyEncryptedMasterKey?: EncString }> {
    this.validateUserId(userId, "Cannot get PinKey encrypted keys.");

    switch (pinLockType) {
      case "PERSISTENT": {
        const pinKeyEncryptedUserKey = await this.getPinKeyEncryptedUserKeyPersistent(userId);
        const oldPinKeyEncryptedMasterKey = await this.getOldPinKeyEncryptedMasterKey(userId);

        return {
          pinKeyEncryptedUserKey,
          oldPinKeyEncryptedMasterKey: oldPinKeyEncryptedMasterKey
            ? new EncString(oldPinKeyEncryptedMasterKey)
            : undefined,
        };
      }
      case "EPHEMERAL": {
        const pinKeyEncryptedUserKey = await this.getPinKeyEncryptedUserKeyEphemeral(userId);

        return {
          pinKeyEncryptedUserKey,
          oldPinKeyEncryptedMasterKey: undefined, // Going forward, we only migrate non-ephemeral version
        };
      }
      case "DISABLED":
        throw new Error("Pin is disabled");
      default: {
        // Compile-time check for exhaustive switch
        const _exhaustiveCheck: never = pinLockType;
        return _exhaustiveCheck;
      }
    }
  }

  private async validatePin(userKey: UserKey, pin: string, userId: UserId): Promise<boolean> {
    this.validateUserId(userId, "Cannot validate PIN.");

    const userKeyEncryptedPin = await this.getUserKeyEncryptedPin(userId);
    const decryptedPin = await this.encryptService.decryptToUtf8(userKeyEncryptedPin, userKey);

    const isPinValid = this.cryptoFunctionService.compareFast(decryptedPin, pin);
    return isPinValid;
  }

  /**
   * Throws a custom error message if user ID is not provided.
   */
  private validateUserId(userId: UserId, errorMessage: string = "") {
    if (!userId) {
      throw new Error(`User ID is required. ${errorMessage}`);
    }
  }
}
