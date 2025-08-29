import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { biometrics } from "@bitwarden/desktop-napi";
import { BiometricsStatus } from "@bitwarden/key-management";

import { WindowMain } from "../../main/window.main";

import { OsBiometricService } from "./os-biometrics.service";

export default class OsBiometricsServiceWindows implements OsBiometricService {
  private biometricsSystem = biometrics.initBiometricSystem();

  constructor(
    private i18nService: I18nService,
    private windowMain: WindowMain,
  ) {}

  async enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    await biometrics.enrollPersistent(
      this.biometricsSystem,
      userId,
      Buffer.from(key.toEncoded().buffer),
    );
  }

  async hasPersistentKey(userId: UserId): Promise<boolean> {
    return await biometrics.hasPersistent(this.biometricsSystem, userId);
  }

  async supportsBiometrics(): Promise<boolean> {
    return await biometrics.authenticateAvailable(this.biometricsSystem);
  }

  async getBiometricKey(userId: UserId): Promise<SymmetricCryptoKey | null> {
    try {
      const key = await biometrics.unlock(
        this.biometricsSystem,
        userId,
        this.windowMain.win.getNativeWindowHandle(),
      );
      return new SymmetricCryptoKey(Uint8Array.from(key));
    } catch {
      return null;
    }
  }

  async setBiometricKey(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    await biometrics.provideKey(this.biometricsSystem, userId, Buffer.from(key.toEncoded().buffer));
  }

  async deleteBiometricKey(userId: UserId): Promise<void> {
    await biometrics.unenroll(this.biometricsSystem, userId);
  }

  async authenticateBiometric(): Promise<boolean> {
    const hwnd = this.windowMain.win.getNativeWindowHandle();
    return await biometrics.authenticate(
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
    return (await biometrics.hasPersistent(this.biometricsSystem, userId)) ||
      (await biometrics.unlockAvailable(this.biometricsSystem, userId))
      ? BiometricsStatus.Available
      : BiometricsStatus.UnlockNeeded;
  }
}
