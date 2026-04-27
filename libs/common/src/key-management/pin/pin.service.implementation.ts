import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { PinLockType, PinSettingsClient } from "@bitwarden/sdk-internal";

import { assertNonNullish } from "../../auth/utils";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { withPasswordManagerSdk } from "../utils";

import { PinServiceAbstraction } from "./pin.service.abstraction";

/**
 * A thin wrapper around the SDK. Pin is entirely managed in the SDK.
 */
export class PinService implements PinServiceAbstraction {
  constructor(
    private sdkService: SdkService,
    private registerSdkService: RegisterSdkService,
  ) {}

  async getPinLockType(userId: UserId): Promise<PinLockType | undefined> {
    assertNonNullish(userId, "userId");
    return this.withPinSettingsClient(userId, (client) => {
      return client.get_lock_type();
    });
  }

  async isPinSet(userId: UserId): Promise<boolean> {
    assertNonNullish(userId, "userId");
    const pinStatus = await this.withPinSettingsClient(userId, (client) => {
      return client.get_status();
    });
    return pinStatus === "Available" || pinStatus === "NeedsUnlock";
  }

  async logout(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    return this.withPinSettingsClient(userId, (client) => {
      return client.unset_pin();
    });
  }

  async getPin(userId: UserId): Promise<string | undefined> {
    assertNonNullish(userId, "userId");
    return this.withPinSettingsClient(userId, (client) => {
      return client.get_pin();
    });
  }

  async setPin(pin: string, pinLockType: PinLockType, userId: UserId): Promise<void> {
    assertNonNullish(pin, "pin");
    assertNonNullish(pinLockType, "pinLockType");
    assertNonNullish(userId, "userId");
    return this.withPinSettingsClient(userId, (client) => {
      return client.set_pin(pin, pinLockType);
    });
  }

  async unsetPin(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    return this.withPinSettingsClient(userId, (client) => {
      return client.unset_pin();
    });
  }

  async isPinDecryptionAvailable(userId: UserId): Promise<boolean> {
    assertNonNullish(userId, "userId");
    return (
      (await this.withPinSettingsClient(userId, (client) => {
        return client.get_status();
      })) === "Available"
    );
  }

  async validatePin(pin: string, userId: UserId): Promise<boolean> {
    assertNonNullish(pin, "pin");
    assertNonNullish(userId, "userId");
    return this.withPinSettingsClient(userId, (client) => {
      return client.validate_pin(pin);
    });
  }


  // A helper function to get the PinSettingsClient for a user and execute a function with it.
  // This makes repeated calls to the SDK more compact
  private async withPinSettingsClient<TResult>(
    userId: UserId,
    fn: (pinSettingsClient: PinSettingsClient) => TResult,
  ): Promise<TResult> {
    return withPasswordManagerSdk(userId, this.sdkService, this.registerSdkService, (sdk) => {
      return fn(sdk.user_crypto_management().pin_settings());
    });
  }
}
