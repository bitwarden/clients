import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { biometrics, passwords } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";

import { OsBiometricService } from "./os-biometrics.service";

export default class OsBiometricsServiceWindows implements OsBiometricService {
  // Use set helper method instead of direct access
  private _iv: string | null = null;
  // Use getKeyMaterial helper instead of direct access
  private _osKeyHalf: string | null = null;

  constructor(
    private i18nService: I18nService,
    private windowMain: WindowMain,
    private logService: LogService,
  ) {}

  async osSupportsBiometric(): Promise<boolean> {
    return await biometrics.available();
  }

  async getBiometricKey(
    service: string,
    storageKey: string,
    clientKeyHalfB64: string,
  ): Promise<string | null> {
    const success = await this.authenticateBiometric();

    if (!success) {
      throw new Error("Biometric authentication failed");
    }

    const value = await passwords.getPassword(service, storageKey);

    if (value == null || value == "") {
      return null;
    } else if (!EncString.isSerializedEncString(value)) {
      // Update to format encrypted with client key half
      const storageDetails = await this.getStorageDetails({
        clientKeyHalfB64,
      });

      await biometrics.setBiometricSecret(
        service,
        storageKey,
        value,
        storageDetails.key_material,
        storageDetails.ivB64,
      );
      return value;
    } else {
      const encValue = new EncString(value);
      this.setIv(encValue.iv);
      const storageDetails = await this.getStorageDetails({
        clientKeyHalfB64,
      });
      return await biometrics.getBiometricSecret(service, storageKey, storageDetails.key_material);
    }
  }

  async setBiometricKey(
    service: string,
    storageKey: string,
    value: string,
    clientKeyPartB64: string | undefined,
  ): Promise<void> {
    const storageDetails = await this.getStorageDetails({ clientKeyHalfB64: clientKeyPartB64 });
    await biometrics.setBiometricSecret(
      service,
      storageKey,
      value,
      storageDetails.key_material,
      storageDetails.ivB64,
    );
  }

  async deleteBiometricKey(service: string, key: string): Promise<void> {
    await passwords.deletePassword(service, key);
  }

  /**
   * Prompts Windows Hello
   */
  async authenticateBiometric(): Promise<boolean> {
    const hwnd = this.windowMain.win.getNativeWindowHandle();
    return await biometrics.prompt(hwnd, this.i18nService.t("windowsHelloConsentMessage"));
  }

  private async getStorageDetails({
    clientKeyHalfB64,
  }: {
    clientKeyHalfB64: string | undefined;
  }): Promise<{ key_material: biometrics.KeyMaterial; ivB64: string }> {
    if (this._osKeyHalf == null) {
      const keyMaterial = await biometrics.deriveKeyMaterial(this._iv);
      this._osKeyHalf = keyMaterial.keyB64;
      this._iv = keyMaterial.ivB64;
    }

    if (this._iv == null) {
      throw new Error("Initialization Vector is null");
    }

    const result = {
      key_material: {
        osKeyPartB64: this._osKeyHalf,
        clientKeyPartB64: clientKeyHalfB64,
      },
      ivB64: this._iv,
    };

    // napi-rs fails to convert null values
    if (result.key_material.clientKeyPartB64 == null) {
      delete result.key_material.clientKeyPartB64;
    }
    return result;
  }

  // Nulls out key material in order to force a re-derive. This should only be used in getBiometricKey
  // when we want to force a re-derive of the key material.
  private setIv(iv?: string) {
    this._iv = iv ?? null;
    this._osKeyHalf = null;
  }

  async osBiometricsNeedsSetup() {
    return false;
  }

  async osBiometricsCanAutoSetup(): Promise<boolean> {
    return false;
  }

  async osBiometricsSetup(): Promise<void> {}
}
