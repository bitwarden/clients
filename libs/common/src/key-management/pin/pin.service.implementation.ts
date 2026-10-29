import { Observable } from "rxjs";

import { PinLockType, PinSettingsClient } from "@bitwarden/sdk-internal";

import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { StateProvider } from "../../platform/state";
import { UserId } from "../../types/guid";
import { PIN_LENGTH } from "../state-definitions";
import { assertParametersNonNull, withPasswordManagerSdk } from "../utils";

import { PinServiceAbstraction } from "./pin.service.abstraction";

/**
 * A thin wrapper around the SDK. Pin is entirely managed in the SDK.
 */
export class PinService implements PinServiceAbstraction {
  constructor(
    private sdkService: SdkService,
    private stateProvider: StateProvider,
  ) {}

  @assertParametersNonNull()
  async getPinLockType(userId: UserId): Promise<PinLockType | undefined> {
    return await this.withPinSettingsClient(userId, async (client) => {
      return await client.get_lock_type();
    });
  }

  @assertParametersNonNull()
  async isPinSet(userId: UserId): Promise<boolean> {
    return await this.withPinSettingsClient(userId, async (client) => {
      const pinStatus = await client.get_status();
      return pinStatus === "Available" || pinStatus === "NeedsUnlock";
    });
  }

  @assertParametersNonNull()
  async logout(userId: UserId): Promise<void> {
    return await this.withPinSettingsClient(userId, async (client) => {
      return await client.unset_pin();
    });
  }

  @assertParametersNonNull()
  async getPin(userId: UserId): Promise<string | undefined> {
    return await this.withPinSettingsClient(userId, async (client) => {
      return await client.get_pin();
    });
  }

  @assertParametersNonNull()
  async setPin(pin: string, pinLockType: PinLockType, userId: UserId): Promise<void> {
    await this.withPinSettingsClient(userId, async (client) => {
      return await client.set_pin(pin, pinLockType);
    });
    await this.rememberPinLength(pin, userId);
  }

  @assertParametersNonNull()
  async unsetPin(userId: UserId): Promise<void> {
    await this.withPinSettingsClient(userId, async (client) => {
      return await client.unset_pin();
    });
    await this.stateProvider.setUserState(PIN_LENGTH, null, userId);
  }

  pinLength$(userId: UserId): Observable<number | null> {
    return this.stateProvider.getUserState$(PIN_LENGTH, userId);
  }

  @assertParametersNonNull()
  async rememberPinLength(pin: string, userId: UserId): Promise<void> {
    await this.stateProvider.setUserState(PIN_LENGTH, pin.length, userId);
  }

  @assertParametersNonNull()
  async isPinDecryptionAvailable(userId: UserId): Promise<boolean> {
    return await this.withPinSettingsClient(userId, async (client) => {
      return (await client.get_status()) === "Available";
    });
  }

  @assertParametersNonNull()
  async validatePin(pin: string, userId: UserId): Promise<boolean> {
    return await this.withPinSettingsClient(userId, async (client) => {
      return await client.validate_pin(pin);
    });
  }

  // A helper function to get the PinSettingsClient for a user and execute a function with it.
  // This makes repeated calls to the SDK more compact
  private async withPinSettingsClient<TResult>(
    userId: UserId,
    passedInFunction: (pinSettingsClient: PinSettingsClient) => Promise<TResult>,
  ): Promise<TResult> {
    return await withPasswordManagerSdk(userId, this.sdkService, async (sdk) => {
      return await passedInFunction(sdk.user_crypto_management().pin_settings());
    });
  }
}
