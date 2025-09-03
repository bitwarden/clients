import { concatMap, firstValueFrom, map } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KdfConfig, KdfConfigService, KeyService } from "@bitwarden/key-management";
import { PasswordProtectedKeyEnvelope } from "@bitwarden/sdk-internal";

import { AccountService } from "../../auth/abstractions/account.service";
import { assertNonNullish } from "../../auth/utils";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString, EncryptedString } from "../../key-management/crypto/models/enc-string";
import { LogService } from "../../platform/abstractions/log.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { StateProvider } from "../../platform/state";
import { UserId } from "../../types/guid";
import { PinKey, UserKey } from "../../types/key";
import { KeyGenerationService } from "../crypto";
import { firstValueFromOrThrow } from "../utils";

import { PinLockType } from "./pin-lock-type";
import { PinServiceAbstraction } from "./pin.service.abstraction";
import {
  PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
  PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
  PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
  USER_KEY_ENCRYPTED_PIN,
} from "./pin.state";

export class PinService implements PinServiceAbstraction {
  constructor(
    private accountService: AccountService,
    private encryptService: EncryptService,
    private kdfConfigService: KdfConfigService,
    private keyGenerationService: KeyGenerationService,
    private logService: LogService,
    private stateProvider: StateProvider,
    private keyService: KeyService,
    private sdkService: SdkService,
  ) {
    keyService.unlockedUserKeys$
      .pipe(
        concatMap(async ({ userId }) => {
          if (
            (await this.getPinLockType(userId)) === "EPHEMERAL" &&
            !(await this.isPinDecryptionAvailable(userId))
          ) {
            // On first unlock, set the ephemeral pin envelope, if it is not set yet
            this.logService.info("[Pin Service] On first unlock: Setting up ephemeral PIN");
            const pin = await this.getPin(userId);
            await this.setPin(pin, "EPHEMERAL", userId);
          } else if ((await this.getPinLockType(userId)) === "PERSISTENT") {
            // Encrypted migration for persistent pin unlock to pin envelopes.
            // This will be removed at the earliest in 2026.1.0
            //
            // ----- ENCRYPTION MIGRATION -----
            // Pin-key encrypted user-keys are eagerly migrated to the new pin-protected user key envelope format.
            if ((await this.getLegacyPinKeyEncryptedUserKeyPersistent(userId)) != null) {
              this.logService.info(
                "[Pin Service] Migrating legacy PIN key to PinProtectedUserKeyEnvelope",
              );
              const pin = await this.getPin(userId);
              await this.setPin(pin, "PERSISTENT", userId);
            }
          }
        }),
      )
      .subscribe();
  }

  async getPin(userId: UserId): Promise<string> {
    assertNonNullish(userId, "userId");

    const userKey: UserKey = await firstValueFromOrThrow(
      this.keyService.userKey$(userId),
      "userKey",
    );
    const userKeyEncryptedPin: EncryptedString = await firstValueFromOrThrow(
      this.stateProvider.getUserState$(USER_KEY_ENCRYPTED_PIN, userId),
      "userKeyEncryptedPin",
    );
    return this.encryptService.decryptString(new EncString(userKeyEncryptedPin), userKey);
  }

  async setPin(pin: string, pinLockType: PinLockType, userId: UserId): Promise<void> {
    assertNonNullish(pin, "pin");
    assertNonNullish(pinLockType, "pinLockType");
    assertNonNullish(userId, "userId");

    // Use the sdk to create an enrollment, not yet persisting it to state
    const { pinProtectedUserKeyEnvelope, userKeyEncryptedPin } = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map((sdk) => {
          using ref = sdk.take();
          return ref.value.crypto().enroll_pin(pin);
        }),
      ),
    );

    await this.setPinState(pinProtectedUserKeyEnvelope, userKeyEncryptedPin, pinLockType, userId);
  }

  async unsetPin(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");

    await this.stateProvider.setUserState(USER_KEY_ENCRYPTED_PIN, null, userId);
    await this.stateProvider.setUserState(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, null, userId);
    await this.stateProvider.setUserState(PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT, null, userId);

    // Note: This can be deleted after sufficiently many PINs are migrated and the state is removed.
    await this.stateProvider.setUserState(PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, null, userId);
  }

  async getPinLockType(userId: UserId): Promise<PinLockType> {
    assertNonNullish(userId, "userId");

    const isPersistentPinSet =
      (await this.getPinProtectedUserKeyPersistent(userId)) != null ||
      // Deprecated
      (await this.getLegacyPinKeyEncryptedUserKeyPersistent(userId)) != null;
    const isPinSet =
      (await firstValueFrom(this.stateProvider.getUserState$(USER_KEY_ENCRYPTED_PIN, userId))) !=
      null;

    if (isPersistentPinSet) {
      return "PERSISTENT";
    } else if (isPinSet) {
      return "EPHEMERAL";
    } else {
      return "DISABLED";
    }
  }

  async isPinSet(userId: UserId): Promise<boolean> {
    assertNonNullish(userId, "userId");

    return (await this.getPinLockType(userId)) !== "DISABLED";
  }

  async isPinDecryptionAvailable(userId: UserId): Promise<boolean> {
    assertNonNullish(userId, "userId");

    const pinLockType = await this.getPinLockType(userId);
    switch (pinLockType) {
      case "DISABLED":
        return false;
      case "PERSISTENT":
        // The above getPinLockType call ensures that we have either a PinKeyEncryptedUserKey  set.
        return true;
      case "EPHEMERAL": {
        // The above getPinLockType call ensures that we have a UserKeyEncryptedPin set.
        // However, we must additively check to ensure that we have a set PinKeyEncryptedUserKeyEphemeral, since
        // this is only available after first unlock
        const pinKeyEncryptedUserKeyEphemeral = await this.getPinProtectedUserKeyEphemeral(userId);
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
    assertNonNullish(pin, "pin");
    assertNonNullish(userId, "userId");

    const hasPinProtectedKeyEnvelopeSet =
      (await this.getPinProtectedUserKeyEphemeral(userId)) != null ||
      (await this.getPinProtectedUserKeyPersistent(userId)) != null;

    if (hasPinProtectedKeyEnvelopeSet) {
      this.logService.info("[Pin Service] Pin-unlock via PinProtectedUserKeyEnvelope");

      const pinLockType = await this.getPinLockType(userId);
      const envelope =
        pinLockType === "EPHEMERAL"
          ? await this.getPinProtectedUserKeyEphemeral(userId)
          : await this.getPinProtectedUserKeyPersistent(userId);

      try {
        // Use the sdk to create an enrollment, not yet persisting it to state
        const userKeyBytes = await firstValueFrom(
          this.sdkService.client$.pipe(
            map((sdk) => {
              if (!sdk) {
                throw new Error("SDK not available");
              }
              return sdk.crypto().unseal_password_protected_key_envelope(pin, envelope!);
            }),
          ),
        );

        return new SymmetricCryptoKey(userKeyBytes) as UserKey;
      } catch (error) {
        this.logService.error(`Failed to unseal pin: ${error}`);
        return null;
      }
    } else {
      this.logService.info("[Pin Service] Pin-unlock via legacy PinKeyEncryptedUserKey");
      // This branch is deprecated and will be removed in the future, but is kept for migration.
      try {
        const pinKeyEncryptedUserKey = await this.getLegacyPinKeyEncryptedUserKeyPersistent(userId);
        const email = await firstValueFrom(
          this.accountService.accounts$.pipe(map((accounts) => accounts[userId].email)),
        );
        const kdfConfig = await this.kdfConfigService.getKdfConfig(userId);
        return await this.decryptUserKey(
          pin,
          email,
          kdfConfig,
          new EncString(pinKeyEncryptedUserKey!),
        );
      } catch (error) {
        this.logService.error(`Error decrypting user key with pin: ${error}`);
        return null;
      }
    }
  }

  async logout(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    await this.stateProvider.setUserState(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, null, userId);
  }

  private async getPinProtectedUserKeyEphemeral(
    userId: UserId,
  ): Promise<PasswordProtectedKeyEnvelope | null> {
    assertNonNullish(userId, "userId");

    return await firstValueFrom(
      this.stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, userId),
    );
  }

  private async getPinProtectedUserKeyPersistent(
    userId: UserId,
  ): Promise<PasswordProtectedKeyEnvelope | null> {
    assertNonNullish(userId, "userId");

    return await firstValueFrom(
      this.stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT, userId),
    );
  }

  // Clears the set pin for the user, and then sets the PIN-protected user key and the user key encrypted pin to state.
  // The user key protected PIN is persisted, while the PIN-protected user key is set to ephemeral / persistent state depending on the lock type.
  private async setPinState(
    pinProtectedUserKeyEnvelope: PasswordProtectedKeyEnvelope,
    userKeyEncryptedPin: EncryptedString,
    pinLockType: PinLockType,
    userId: UserId,
  ): Promise<void> {
    // First un-enroll the user from pin-unlock
    await this.unsetPin(userId);

    // Then, persist the enrollment to state
    if (pinLockType === "EPHEMERAL") {
      await this.stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
        pinProtectedUserKeyEnvelope,
        userId,
      );
    } else if (pinLockType === "PERSISTENT") {
      await this.stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
        pinProtectedUserKeyEnvelope,
        userId,
      );
    } else {
      throw new Error(`Cannot set up PIN with pin lock type ${pinLockType}`);
    }
    await this.stateProvider.setUserState(USER_KEY_ENCRYPTED_PIN, userKeyEncryptedPin, userId);
  }

  /// Anything below here is deprecated and will be removed subsequently

  async makePinKey(pin: string, salt: string, kdfConfig: KdfConfig): Promise<PinKey> {
    const startTime = performance.now();
    const pinKey = await this.keyGenerationService.deriveKeyFromPassword(pin, salt, kdfConfig);
    this.logService.measure(startTime, "Crypto", "PinService", "makePinKey");

    return (await this.keyGenerationService.stretchKey(pinKey)) as PinKey;
  }

  /** @deprecated */
  private async getLegacyPinKeyEncryptedUserKeyPersistent(
    userId: UserId,
  ): Promise<EncryptedString | null> {
    assertNonNullish(userId, "userId");

    return await firstValueFrom(
      this.stateProvider.getUserState$(PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, userId),
    );
  }

  /**
   * Decrypts the UserKey with the provided PIN.
   * @deprecated
   * @throws If the PIN does not match the PIN that was used to encrypt the user key
   * @throws If the salt, or KDF don't match the salt / KDF used to encrypt the user key
   */
  private async decryptUserKey(
    pin: string,
    salt: string,
    kdfConfig: KdfConfig,
    pinKeyEncryptedUserKey: EncString,
  ): Promise<UserKey> {
    assertNonNullish(pin, "pin");
    assertNonNullish(salt, "salt");
    assertNonNullish(kdfConfig, "kdfConfig");
    assertNonNullish(pinKeyEncryptedUserKey, "pinKeyEncryptedUserKey");
    const pinKey = await this.makePinKey(pin, salt, kdfConfig);
    const userKey = await this.encryptService.unwrapSymmetricKey(pinKeyEncryptedUserKey, pinKey);
    return userKey as UserKey;
  }
}
