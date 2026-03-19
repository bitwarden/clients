import { firstValueFrom, map } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { assertNonNullish } from "../../auth/utils";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { LogService } from "../../platform/abstractions/log.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../types/guid";
import { UserKey } from "../../types/key";
import { firstValueFromOrThrow } from "../utils";

import { PinLockType } from "./pin-lock-type";
import { PinStateServiceAbstraction } from "./pin-state.service.abstraction";
import { PinServiceAbstraction } from "./pin.service.abstraction";

export class PinService implements PinServiceAbstraction {
  constructor(
    private encryptService: EncryptService,
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

    this.logService.info("[Pin Service] Pin-unlock via PinProtectedUserKeyEnvelope");

    const pinLockType = await this.pinStateService.getPinLockType(userId);
    const envelope = await this.pinStateService.getPinProtectedUserKeyEnvelope(userId, pinLockType);

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
  }
}
