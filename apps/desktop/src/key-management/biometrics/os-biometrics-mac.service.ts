import { systemPreferences } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { passwords } from "@bitwarden/desktop-napi";
import { BiometricsStatus } from "@bitwarden/key-management";

import { OsBiometricService } from "./os-biometrics.service";

const SERVICE = "Bitwarden_biometric";
function getLookupKeyForUser(userId: UserId): string {
  return `${userId}_user_biometric`;
}

export default class OsBiometricsServiceMac implements OsBiometricService {
  constructor(
    private i18nservice: I18nService,
    private logService: LogService,
  ) {}

  async enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    return await passwords.setPassword(SERVICE, getLookupKeyForUser(userId), key.toBase64());
  }

  async hasPersistentKey(userId: UserId): Promise<boolean> {
    return (await passwords.getPassword(SERVICE, getLookupKeyForUser(userId))) != null;
  }

  async supportsBiometrics(): Promise<boolean> {
    return systemPreferences.canPromptTouchID();
  }

  async authenticateBiometric(): Promise<boolean> {
    try {
      await systemPreferences.promptTouchID(this.i18nservice.t("touchIdConsentMessage"));
      return true;
    } catch {
      return false;
    }
  }

  async getBiometricKey(userId: UserId): Promise<SymmetricCryptoKey | null> {
    const success = await this.authenticateBiometric();

    if (!success) {
      throw new Error("Biometric authentication failed");
    }
    const keyB64 = await passwords.getPassword(SERVICE, getLookupKeyForUser(userId));
    if (keyB64 == null) {
      return null;
    }

    return SymmetricCryptoKey.fromString(keyB64);
  }

  async setBiometricKey(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    if (await this.valueUpToDate(userId, key)) {
      return;
    }

    return await passwords.setPassword(SERVICE, getLookupKeyForUser(userId), key.toBase64());
  }

  async deleteBiometricKey(user: UserId): Promise<void> {
    try {
      return await passwords.deletePassword(SERVICE, getLookupKeyForUser(user));
    } catch (e) {
      if (e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND) {
        this.logService.debug(
          "[OsBiometricService] Biometric key %s not found for service %s.",
          getLookupKeyForUser(user),
          SERVICE,
        );
      } else {
        throw e;
      }
    }
  }

  private async valueUpToDate(user: UserId, key: SymmetricCryptoKey): Promise<boolean> {
    try {
      const existing = await passwords.getPassword(SERVICE, getLookupKeyForUser(user));
      return existing === key.toBase64();
    } catch {
      return false;
    }
  }

  async needsSetup() {
    return false;
  }

  async canAutoSetup(): Promise<boolean> {
    return false;
  }

  async runSetup(): Promise<void> {}

  async getBiometricsFirstUnlockStatusForUser(userId: UserId): Promise<BiometricsStatus> {
    return BiometricsStatus.Available;
  }
}
