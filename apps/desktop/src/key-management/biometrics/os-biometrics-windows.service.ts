import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { biometrics, passwords } from "@bitwarden/desktop-napi";
import { BiometricsStatus, BiometricStateService } from "@bitwarden/key-management";

import { WindowMain } from "../../main/window.main";

import { OsBiometricService } from "./os-biometrics.service";

const SERVICE = "Bitwarden_biometric";

function getLookupKeyForUser(userId: UserId): string {
  return `${userId}_user_biometric`;
}

export default class OsBiometricsServiceWindows implements OsBiometricService {
  // Use set helper method instead of direct access
  private _iv: string | null = null;
  // Use getKeyMaterial helper instead of direct access
  private _osKeyHalf: string | null = null;
  private clientKeyHalves = new Map<UserId, Uint8Array>();

  constructor(
    private i18nService: I18nService,
    private windowMain: WindowMain,
    private logService: LogService,
    private biometricStateService: BiometricStateService,
    private encryptService: EncryptService,
    private cryptoFunctionService: CryptoFunctionService,
  ) {}

  async supportsBiometrics(): Promise<boolean> {
    return await biometrics.available();
  }

  async getBiometricKey(userId: UserId): Promise<SymmetricCryptoKey | null> {
    const success = await this.authenticateBiometric();
    if (!success) {
      return null;
    }

    const value = await passwords.getPassword(SERVICE, getLookupKeyForUser(userId));
    if (value == null || value == "") {
      throw new Error("Biometric key not found for user");
    }

    let clientKeyHalfB64: string | null = null;
    if (this.clientKeyHalves.has(userId)) {
      clientKeyHalfB64 = Utils.fromBufferToB64(this.clientKeyHalves.get(userId)!);
    }

    if (!EncString.isSerializedEncString(value)) {
      // Update to format encrypted with client key half
      const storageDetails = await this.getStorageDetails({
        clientKeyHalfB64: clientKeyHalfB64 ?? undefined,
      });

      await biometrics.setBiometricSecret(
        SERVICE,
        getLookupKeyForUser(userId),
        value,
        storageDetails.key_material,
        storageDetails.ivB64,
      );
      return SymmetricCryptoKey.fromString(value);
    } else {
      const encValue = new EncString(value);
      this.setIv(encValue.iv);
      const storageDetails = await this.getStorageDetails({
        clientKeyHalfB64: clientKeyHalfB64 ?? undefined,
      });
      return SymmetricCryptoKey.fromString(
        await biometrics.getBiometricSecret(
          SERVICE,
          getLookupKeyForUser(userId),
          storageDetails.key_material,
        ),
      );
    }
  }

  async setBiometricKey(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    const clientKeyHalf = await this.getOrCreateBiometricEncryptionClientKeyHalf(userId, key);

    const storageDetails = await this.getStorageDetails({
      clientKeyHalfB64: Utils.fromBufferToB64(clientKeyHalf),
    });
    await biometrics.setBiometricSecret(
      SERVICE,
      getLookupKeyForUser(userId),
      key.toBase64(),
      storageDetails.key_material,
      storageDetails.ivB64,
    );
  }

  async deleteBiometricKey(userId: UserId): Promise<void> {
    try {
      await passwords.deletePassword(SERVICE, getLookupKeyForUser(userId));
    } catch (e) {
      if (e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND) {
        this.logService.debug(
          "[OsBiometricService] Biometric key %s not found for service %s.",
          getLookupKeyForUser(userId),
          SERVICE,
        );
      } else {
        throw e;
      }
    }
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

  async needsSetup() {
    return false;
  }

  async canAutoSetup(): Promise<boolean> {
    return false;
  }

  async runSetup(): Promise<void> {}

  async getOrCreateBiometricEncryptionClientKeyHalf(
    userId: UserId,
    key: SymmetricCryptoKey,
  ): Promise<Uint8Array> {
    if (this.clientKeyHalves.has(userId)) {
      return this.clientKeyHalves.get(userId)!;
    }

    // Retrieve existing key half if it exists
    let clientKeyHalf: Uint8Array | null = null;
    const encryptedClientKeyHalf =
      await this.biometricStateService.getEncryptedClientKeyHalf(userId);
    if (encryptedClientKeyHalf != null) {
      clientKeyHalf = await this.encryptService.decryptBytes(encryptedClientKeyHalf, key);
    }
    if (clientKeyHalf == null) {
      // Set a key half if it doesn't exist
      clientKeyHalf = await this.cryptoFunctionService.randomBytes(32);
      const encKey = await this.encryptService.encryptBytes(clientKeyHalf, key);
      await this.biometricStateService.setEncryptedClientKeyHalf(encKey, userId);
    }

    this.clientKeyHalves.set(userId, clientKeyHalf);

    return clientKeyHalf;
  }

  async getBiometricsFirstUnlockStatusForUser(userId: UserId): Promise<BiometricsStatus> {
    if (this.clientKeyHalves.has(userId)) {
      return BiometricsStatus.Available;
    } else {
      return BiometricsStatus.UnlockNeeded;
    }
  }
}
