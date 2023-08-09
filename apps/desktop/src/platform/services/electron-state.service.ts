import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";
import {
  DeviceKey,
  SymmetricCryptoKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { StateService as BaseStateService } from "@bitwarden/common/platform/services/state.service";

import { Account } from "../../models/account";

import { ElectronStateService as ElectronStateServiceAbstraction } from "./electron-state.service.abstraction";

export class ElectronStateService
  extends BaseStateService<GlobalState, Account>
  implements ElectronStateServiceAbstraction
{
  private partialKeys = {
    deviceKey: "_deviceKey",
  };

  async addAccount(account: Account) {
    // Apply desktop overides to default account values
    account = new Account(account);
    await super.addAccount(account);
  }

  async getBiometricEncryptionClientKeyHalf(options?: StorageOptions): Promise<EncString> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions())
    );
    const key = account?.keys?.biometricEncryptionClientKeyHalf;
    return key == null ? null : new EncString(key);
  }

  async setBiometricEncryptionClientKeyHalf(
    value: EncString,
    options?: StorageOptions
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions())
    );
    account.keys.biometricEncryptionClientKeyHalf = value?.encryptedString;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions())
    );
  }

  async getBiometricRequirePasswordOnStart(options?: StorageOptions): Promise<boolean> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions())
    );
    return account?.settings?.requirePasswordOnStart;
  }

  async setBiometricRequirePasswordOnStart(
    value: boolean,
    options?: StorageOptions
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions())
    );
    account.settings.requirePasswordOnStart = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions())
    );
  }

  async getDismissedBiometricRequirePasswordOnStart(options?: StorageOptions): Promise<boolean> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions())
    );
    return account?.settings?.dismissedBiometricRequirePasswordOnStartCallout;
  }

  async setDismissedBiometricRequirePasswordOnStart(options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions())
    );
    account.settings.dismissedBiometricRequirePasswordOnStartCallout = true;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions())
    );
  }

  override async getDeviceKey(options?: StorageOptions): Promise<DeviceKey | null> {
    options = this.reconcileOptions(options, await this.defaultSecureStorageOptions());
    if (options?.userId == null) {
      return;
    }

    const b64DeviceKey = await this.secureStorageService.get<string>(
      `${options.userId}${this.partialKeys.deviceKey}`,
      options
    );

    return new SymmetricCryptoKey(Utils.fromB64ToArray(b64DeviceKey)) as DeviceKey;
  }

  override async setDeviceKey(value: DeviceKey, options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(options, await this.defaultSecureStorageOptions());
    if (options?.userId == null) {
      return;
    }

    await this.saveSecureStorageKey(this.partialKeys.deviceKey, value.keyB64, options);
  }
}
