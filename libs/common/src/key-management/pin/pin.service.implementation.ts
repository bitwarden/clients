import { firstValueFrom, map } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KdfConfig, KdfConfigService, KeyService } from "@bitwarden/key-management";

import { AccountService } from "../../auth/abstractions/account.service";
import { assertNonNullish } from "../../auth/utils";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../key-management/crypto/models/enc-string";
import { LogService } from "../../platform/abstractions/log.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../types/guid";
import { PinKey, UserKey } from "../../types/key";
import { KeyGenerationService } from "../crypto";
import { firstValueFromOrThrow } from "../utils";

import { PinLockType } from "./pin-lock-type";
import { PinStateServiceAbstraction } from "./pin-state.service.abstraction";
import { PinServiceAbstraction } from "./pin.service.abstraction";

export class PinService implements PinServiceAbstraction {
  constructor(
    private accountService: AccountService,
    private encryptService: EncryptService,
    private kdfConfigService: KdfConfigService,
    private keyGenerationService: KeyGenerationService,
    private logService: LogService,
    private keyService: KeyService,
    private sdkService: SdkService,
    private pinStateService: PinStateServiceAbstraction,
  ) {}

  getPinLockType(userId: UserId): Promise<PinLockType> {
    assertNonNullish(userId, "userId");
    return this.pinStateService.getPinLockType(userId);
  }

  async isPinSet(userId: UserId): Promise<boolean> {
    assertNonNullish(userId, "userId");
    return (await this.pinStateService.getPinLockType(userId)) !== "DISABLED";
  }

  async logout(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    await this.pinStateService.clearPinState(userId);
  }

  async userUnlocked(userId: UserId): Promise<void> {
    if (
      (await this.pinStateService.getPinLockType(userId)) === "EPHEMERAL" &&
      !(await this.isPinDecryptionAvailable(userId))
    ) {
      this.logService.info("[Pin Service] On first unlock: Setting up ephemeral PIN");

      // On first unlock, set the ephemeral pin envelope, if it is not set yet
      const pin = await this.getPin(userId);
      await this.setPin(pin, "EPHEMERAL", userId);
    } else if ((await this.pinStateService.getPinLockType(userId)) === "PERSISTENT") {
      // Encrypted migration for persistent pin unlock to pin envelopes.
      // This will be removed at the earliest in 2026.1.0
      //
      // ----- ENCRYPTION MIGRATION -----
      // Pin-key encrypted user-keys are eagerly migrated to the new pin-protected user key envelope format.
      if ((await this.pinStateService.getLegacyPinKeyEncryptedUserKeyPersistent(userId)) != null) {
        this.logService.info(
          "[Pin Service] Migrating legacy PIN key to PinProtectedUserKeyEnvelope",
        );
        const pin = await this.getPin(userId);
        await this.setPin(pin, "PERSISTENT", userId);
      }
    }
  }

  async getPin(userId: UserId): Promise<string> {
    assertNonNullish(userId, "userId");

    const userKey: UserKey = await firstValueFromOrThrow(
      this.keyService.userKey$(userId),
      "userKey",
    );
    const userKeyEncryptedPin = await firstValueFromOrThrow(
      this.pinStateService.userKeyEncryptedPin$(userId),
      "userKeyEncryptedPin",
    );
    return this.encryptService.decryptString(userKeyEncryptedPin, userKey);
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

    await this.pinStateService.setPinState(
      userId,
      pinProtectedUserKeyEnvelope,
      userKeyEncryptedPin,
      pinLockType,
    );
  }

  async unsetPin(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    await this.pinStateService.clearPinState(userId);
  }

  async isPinDecryptionAvailable(userId: UserId): Promise<boolean> {
    assertNonNullish(userId, "userId");

    const pinLockType = await this.pinStateService.getPinLockType(userId);
    switch (pinLockType) {
      case "DISABLED":
        return false;
      case "PERSISTENT":
        // The above getPinLockType call ensures that we have either a PinKeyEncryptedUserKey or PinProtectedKeyEnvelope set.
        return true;
      case "EPHEMERAL": {
        // The above getPinLockType call ensures that we have a UserKeyEncryptedPin set.
        // However, we must additively check to ensure that we have a set PinKeyEncryptedUserKeyEphemeral, since
        // this is only available after first unlock
        const ephemeralPinProtectedKeyEnvelope =
          await this.pinStateService.getPinProtectedUserKeyEnvelope(userId, "EPHEMERAL");
        return ephemeralPinProtectedKeyEnvelope != null;
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
      (await this.pinStateService.getPinProtectedUserKeyEnvelope(userId, "EPHEMERAL")) != null ||
      (await this.pinStateService.getPinProtectedUserKeyEnvelope(userId, "PERSISTENT")) != null;

    if (hasPinProtectedKeyEnvelopeSet) {
      this.logService.info("[Pin Service] Pin-unlock via PinProtectedUserKeyEnvelope");

      const pinLockType = await this.pinStateService.getPinLockType(userId);
      const envelope = await this.pinStateService.getPinProtectedUserKeyEnvelope(
        userId,
        pinLockType,
      );

      try {
        // Use the sdk to create an enrollment, not yet persisting it to state
        const startTime = performance.now();
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
        this.logService.measure(startTime, "Crypto", "PinService", "UnsealPinEnvelope");

        return new SymmetricCryptoKey(userKeyBytes) as UserKey;
      } catch (error) {
        this.logService.error(`Failed to unseal pin: ${error}`);
        return null;
      }
    } else {
      this.logService.info("[Pin Service] Pin-unlock via legacy PinKeyEncryptedUserKey");

      // This branch is deprecated and will be removed in the future, but is kept for migration.
      try {
        const pinKeyEncryptedUserKey =
          await this.pinStateService.getLegacyPinKeyEncryptedUserKeyPersistent(userId);
        const email = await firstValueFrom(
          this.accountService.accounts$.pipe(map((accounts) => accounts[userId].email)),
        );
        const kdfConfig = await this.kdfConfigService.getKdfConfig(userId);
        return await this.decryptUserKey(pin, email, kdfConfig, pinKeyEncryptedUserKey!);
      } catch (error) {
        this.logService.error(`Error decrypting user key with pin: ${error}`);
        return null;
      }
    }
  }

  /// Anything below here is deprecated and will be removed subsequently

  async makePinKey(pin: string, salt: string, kdfConfig: KdfConfig): Promise<PinKey> {
    const startTime = performance.now();
    const pinKey = await this.keyGenerationService.deriveKeyFromPassword(pin, salt, kdfConfig);
    this.logService.measure(startTime, "Crypto", "PinService", "makePinKey");

    return (await this.keyGenerationService.stretchKey(pinKey)) as PinKey;
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
