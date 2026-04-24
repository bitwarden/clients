import { assertNonNullish } from "../../auth/utils";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";

import { PinServiceAbstraction } from "./pin.service.abstraction";
import { PinLockType, PinSettingsClient } from "@bitwarden/sdk-internal";
import { withPasswordManagerSdk } from "../utils";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";

async function withPinSettingsClient<TResult>(userId: UserId, sdkService: SdkService, registerSdkService: RegisterSdkService, fn: (pinSettingsClient: PinSettingsClient) => TResult): Promise<TResult> {
  return withPasswordManagerSdk(userId, sdkService, registerSdkService, (sdk) => {
    return fn(sdk.user_crypto_management().pin_settings());
  });
}

/**
 * A thin wrapper around the SDK. Pin is entirely managed in the SDK.
 */
export class PinService implements PinServiceAbstraction {
  constructor(
    private sdkService: SdkService,
    private registerSdkService: RegisterSdkService,
  ) {}

  async getPinLockType(userId: UserId): Promise<PinLockType> {
    assertNonNullish(userId, "userId");
    return withPinSettingsClient(userId, this.sdkService, this.registerSdkService, (client) => {
      return client.getPinLockType();
    });
  }

  async isPinSet(userId: UserId): Promise<boolean> {
    assertNonNullish(userId, "userId");
    return withPinSettingsClient(userId, this.sdkService, this.registerSdkService, (client) => {
      return client.isPinSet();
    });
  }

  async logout(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    return withPinSettingsClient(userId, this.sdkService, this.registerSdkService, (client) => {
      return client.unsetPin();
    });
  }
  
  async getPin(userId: UserId): Promise<string> {
    assertNonNullish(userId, "userId");
    return withPinSettingsClient(userId, this.sdkService, this.registerSdkService, (client) => {
      return client.getPin();
    });
  }

  async setPin(pin: string, pinLockType: PinLockType, userId: UserId): Promise<void> {
    assertNonNullish(pin, "pin");
    assertNonNullish(pinLockType, "pinLockType");
    assertNonNullish(userId, "userId");
    return withPinSettingsClient(userId, this.sdkService, this.registerSdkService, (client) => {
      return client.setPin(pin, pinLockType);
    });
  }

  async unsetPin(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    return withPinSettingsClient(userId, this.sdkService, this.registerSdkService, (client) => {
      return client.unsetPin();
    });
  }

  async isPinDecryptionAvailable(userId: UserId): Promise<boolean> {
    assertNonNullish(userId, "userId");
    return withPinSettingsClient(userId, this.sdkService, this.registerSdkService, (client) => {
      return client.isPinDecryptionAvailable();
    });
  }

  async validatePin(pin: string, userId: UserId): Promise<boolean> {
    assertNonNullish(pin, "pin");
    assertNonNullish(userId, "userId");
    return withPinSettingsClient(userId, this.sdkService, this.registerSdkService, (client) => {
      return client.validatePin(pin);
    });
  }
}
