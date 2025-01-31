import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { biometrics, passwords } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";

import { OsBiometricService } from "./os-biometrics.service";

const KEY_WITNESS_SUFFIX = "_witness";
const WITNESS_VALUE = "known key";

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
    const parsedValue = SymmetricCryptoKey.fromString(value);
    if (await this.valueUpToDate({ value: parsedValue, clientKeyPartB64, service, storageKey })) {
      return;
    }

    const storageDetails = await this.getStorageDetails({ clientKeyHalfB64: clientKeyPartB64 });
    const storedValue = await biometrics.setBiometricSecret(
      service,
      storageKey,
      value,
      storageDetails.key_material,
      storageDetails.ivB64,
    );
    const parsedStoredValue = new EncString(storedValue);
    await this.storeValueWitness(
      parsedValue,
      parsedStoredValue,
      service,
      storageKey,
      clientKeyPartB64,
    );
  }

  async deleteBiometricKey(service: string, key: string): Promise<void> {
    await passwords.deletePassword(service, key);
    await passwords.deletePassword(service, key + KEY_WITNESS_SUFFIX);
  }

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
      // Prompts Windows Hello
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

  /**
   * Stores a witness key alongside the encrypted value. This is used to determine if the value is up to date.
   *
   * @param unencryptedValue The key to store
   * @param encryptedValue The encrypted value of the key to store. Used to sync IV of the witness key with the stored key.
   * @param service The service to store the witness key under
   * @param storageKey The key to store the witness key under. The witness key will be stored under storageKey + {@link KEY_WITNESS_SUFFIX}
   * @returns
   */
  private async storeValueWitness(
    unencryptedValue: SymmetricCryptoKey,
    encryptedValue: EncString,
    service: string,
    storageKey: string,
    clientKeyPartB64: string | undefined,
  ) {
    if (encryptedValue.iv == null) {
      return;
    }

    const storageDetails = {
      keyMaterial: this.witnessKeyMaterial(unencryptedValue, clientKeyPartB64),
      ivB64: encryptedValue.iv,
    };
    await biometrics.setBiometricSecret(
      service,
      storageKey + KEY_WITNESS_SUFFIX,
      WITNESS_VALUE,
      storageDetails.keyMaterial,
      storageDetails.ivB64,
    );
  }

  /**
   * Uses a witness key stored alongside the encrypted value to determine if the value is up to date.
   * @param value The value being validated
   * @param service The service the value is stored under
   * @param storageKey The key the value is stored under. The witness key will be stored under storageKey + {@link KEY_WITNESS_SUFFIX}
   * @returns Boolean indicating if the value is up to date.
   */
  // Uses a witness key stored alongside the encrypted value to determine if the value is up to date.
  private async valueUpToDate({
    value,
    clientKeyPartB64,
    service,
    storageKey,
  }: {
    value: SymmetricCryptoKey;
    clientKeyPartB64: string | undefined;
    service: string;
    storageKey: string;
  }): Promise<boolean> {
    const witnessKeyMaterial = this.witnessKeyMaterial(value, clientKeyPartB64);
    if (witnessKeyMaterial == null) {
      return false;
    }

    let witness = null;
    try {
      witness = await biometrics.getBiometricSecret(
        service,
        storageKey + KEY_WITNESS_SUFFIX,
        witnessKeyMaterial,
      );
    } catch {
      this.logService.debug("Error retrieving witness key, assuming value is not up to date.");
      return false;
    }

    if (witness === WITNESS_VALUE) {
      return true;
    }

    return false;
  }

  /** Derives a witness key from a symmetric key being stored for biometric protection */
  private witnessKeyMaterial(
    symmetricKey: SymmetricCryptoKey,
    clientKeyPartB64: string | undefined,
  ): biometrics.KeyMaterial {
    const key = symmetricKey?.macKeyB64 ?? symmetricKey?.keyB64;

    const result = {
      osKeyPartB64: key,
      clientKeyPartB64,
    };

    // napi-rs fails to convert null values
    if (result.clientKeyPartB64 == null) {
      delete result.clientKeyPartB64;
    }
    return result;
  }

  async osBiometricsNeedsSetup() {
    return false;
  }

  async osBiometricsCanAutoSetup(): Promise<boolean> {
    return false;
  }

  async osBiometricsSetup(): Promise<void> {}
}
