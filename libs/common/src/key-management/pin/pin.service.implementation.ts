// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KdfConfig, KdfConfigService } from "@bitwarden/key-management";

import { AccountService } from "../../auth/abstractions/account.service";
import { CryptoFunctionService } from "../../key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString, EncryptedString } from "../../key-management/crypto/models/enc-string";
import { LogService } from "../../platform/abstractions/log.service";
import { PIN_DISK, PIN_MEMORY, StateProvider, UserKeyDefinition } from "../../platform/state";
import { UserId } from "../../types/guid";
import { PinKey, UserKey } from "../../types/key";
import { KeyGenerationService } from "../crypto";

import { PinServiceAbstraction } from "./pin.service.abstraction";

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

export class PinService implements PinServiceAbstraction {
  constructor(
    private accountService: AccountService,
    private cryptoFunctionService: CryptoFunctionService,
    private encryptService: EncryptService,
    private kdfConfigService: KdfConfigService,
    private keyGenerationService: KeyGenerationService,
    private logService: LogService,
    private stateProvider: StateProvider,
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
    const kdfConfig = await this.kdfConfigService.getKdfConfig(userId);
    const pinKey = await this.makePinKey(pin, email, kdfConfig);

    return await this.encryptService.wrapSymmetricKey(userKey, pinKey);
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

    return await this.encryptService.encryptString(pin, userKey);
  }

  async makePinKey(pin: string, salt: string, kdfConfig: KdfConfig): Promise<PinKey> {
    const start = Date.now();
    const pinKey = await this.keyGenerationService.deriveKeyFromPassword(pin, salt, kdfConfig);
    this.logService.info(`[Pin Service] deriving pin key took ${Date.now() - start}ms`);

    return (await this.keyGenerationService.stretchKey(pinKey)) as PinKey;
  }

  async getPinLockType(userId: UserId): Promise<PinLockType> {
    this.validateUserId(userId, "Cannot get PinLockType.");

    const aUserKeyEncryptedPinIsSet = !!(await this.getUserKeyEncryptedPin(userId));
    const aPinKeyEncryptedUserKeyPersistentIsSet =
      !!(await this.getPinKeyEncryptedUserKeyPersistent(userId));

    if (aPinKeyEncryptedUserKeyPersistentIsSet) {
      return "PERSISTENT";
    } else if (aUserKeyEncryptedPinIsSet && !aPinKeyEncryptedUserKeyPersistentIsSet) {
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
        // The above getPinLockType call ensures that we have either a PinKeyEncryptedUserKey  set.
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

      const pinKeyEncryptedUserKey = await this.getPinKeyEncryptedKeys(pinLockType, userId);

      const email = await firstValueFrom(
        this.accountService.accounts$.pipe(map((accounts) => accounts[userId].email)),
      );
      const kdfConfig = await this.kdfConfigService.getKdfConfig(userId);

      const userKey: UserKey = await this.decryptUserKey(
        userId,
        pin,
        email,
        kdfConfig,
        pinKeyEncryptedUserKey,
      );
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
    const userKey = await this.encryptService.unwrapSymmetricKey(pinKeyEncryptedUserKey, pinKey);

    return userKey as UserKey;
  }

  /**
   * Gets the user's `pinKeyEncryptedUserKey` (persistent or ephemeral)
   * (if one exists) based on the user's PinLockType.
   *
   * @throws If PinLockType is 'DISABLED' or if userId is not provided
   */
  private async getPinKeyEncryptedKeys(
    pinLockType: PinLockType,
    userId: UserId,
  ): Promise<EncString> {
    this.validateUserId(userId, "Cannot get PinKey encrypted keys.");

    switch (pinLockType) {
      case "PERSISTENT": {
        return await this.getPinKeyEncryptedUserKeyPersistent(userId);
      }
      case "EPHEMERAL": {
        return await this.getPinKeyEncryptedUserKeyEphemeral(userId);
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
    const decryptedPin = await this.encryptService.decryptString(userKeyEncryptedPin, userKey);

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
