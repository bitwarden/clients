import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { biometrics_v2 } from "@bitwarden/desktop-napi";
import { BiometricsStatus } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../../main/window.main";
import { OsBiometricService } from "../os-biometrics.service";

export default class OsBiometricsServiceWindows implements OsBiometricService {
  private biometricsSystem: biometrics_v2.BiometricLockSystem;

  constructor(
    private i18nService: I18nService,
    private windowMain: WindowMain,
    private logService: LogService,
  ) {
    this.biometricsSystem = biometrics_v2.initBiometricSystem();
  }

  async enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    await biometrics_v2.enrollPersistent(
      this.biometricsSystem,
      userId,
      Buffer.from(key.toEncoded().buffer),
    );
  }

  async hasPersistentKey(userId: UserId): Promise<boolean> {
    return await biometrics_v2.hasPersistent(this.biometricsSystem, userId);
  }

  async supportsBiometrics(): Promise<boolean> {
    return await biometrics_v2.authenticateAvailable(this.biometricsSystem);
  }

  async getBiometricKey(userId: UserId): Promise<SymmetricCryptoKey | null> {
    try {
      const key = await biometrics_v2.unlock(
        this.biometricsSystem,
        userId,
        this.windowMain.win.getNativeWindowHandle(),
      );
      return key ? new SymmetricCryptoKey(Uint8Array.from(key)) : null;
    } catch (error) {
      this.logService.warning(
        `[OsBiometricsServiceWindows] Fetching the biometric key failed: ${error} returning null`,
      );
      return null;
    }
  }

  async setBiometricKey(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    await biometrics_v2.provideKey(
      this.biometricsSystem,
      userId,
      Buffer.from(key.toEncoded().buffer),
    );
  }

  async deleteBiometricKey(userId: UserId): Promise<void> {
    await biometrics_v2.unenroll(this.biometricsSystem, userId);
  }

  async authenticateBiometric(): Promise<boolean> {
    const hwnd = this.windowMain.win.getNativeWindowHandle();
    return await biometrics_v2.authenticate(
      this.biometricsSystem,
      hwnd,
      this.i18nService.t("windowsHelloConsentMessage"),
    );
  }

  async needsSetup() {
    return false;
  }

  async canAutoSetup(): Promise<boolean> {
    return false;
  }

  async runSetup(): Promise<void> {}

  async getBiometricsFirstUnlockStatusForUser(userId: UserId): Promise<BiometricsStatus> {
    return (await biometrics_v2.hasPersistent(this.biometricsSystem, userId)) ||
      (await biometrics_v2.unlockAvailable(this.biometricsSystem, userId))
      ? BiometricsStatus.Available
      : BiometricsStatus.UnlockNeeded;
  }
}
