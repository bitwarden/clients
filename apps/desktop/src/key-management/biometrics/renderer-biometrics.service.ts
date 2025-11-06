import { Injectable } from "@angular/core";

import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsStatus } from "@bitwarden/key-management";

import { DesktopBiometricsService } from "./desktop.biometrics.service";

/**
 * This service implement the base biometrics service to provide desktop specific functions,
 * specifically for the renderer process by passing messages to the main process.
 */
@Injectable()
export class RendererBiometricsService extends DesktopBiometricsService {
  async authenticateWithBiometrics(): Promise<boolean> {
    return await ipc.keyManagement.biometric.authenticateWithBiometrics();
  }

  async getBiometricsStatus(): Promise<BiometricsStatus> {
    return await ipc.keyManagement.biometric.getBiometricsStatus();
  }

  async unlockWithBiometricsForUser(userId: UserId): Promise<UserKey | null> {
    const userKey = await ipc.keyManagement.biometric.unlockWithBiometricsForUser(userId);
    if (userKey == null) {
      return null;
    }
    // Objects received over IPC lose their prototype, so they must be recreated to restore methods and properties.
    return SymmetricCryptoKey.fromJSON(userKey) as UserKey;
  }

  async getBiometricsStatusForUser(id: UserId): Promise<BiometricsStatus> {
    return await ipc.keyManagement.biometric.getBiometricsStatusForUser(id);
  }

  async setBiometricProtectedUnlockKeyForUser(
    userId: UserId,
    value: SymmetricCryptoKey,
  ): Promise<void> {
    return await ipc.keyManagement.biometric.setBiometricProtectedUnlockKeyForUser(
      userId,
      value.toBase64(),
    );
  }

  async deleteBiometricUnlockKeyForUser(userId: UserId): Promise<void> {
    return await ipc.keyManagement.biometric.deleteBiometricUnlockKeyForUser(userId);
  }

  async setupBiometrics(): Promise<void> {
    return await ipc.keyManagement.biometric.setupBiometrics();
  }

  async getShouldAutopromptNow(): Promise<boolean> {
    return await ipc.keyManagement.biometric.getShouldAutoprompt();
  }

  async setShouldAutopromptNow(value: boolean): Promise<void> {
    return await ipc.keyManagement.biometric.setShouldAutoprompt(value);
  }

  async canEnableBiometricUnlock(): Promise<boolean> {
    const biometricStatus = await this.getBiometricsStatus();
    return [
      BiometricsStatus.Available,
      BiometricsStatus.AutoSetupNeeded,
      BiometricsStatus.ManualSetupNeeded,
    ].includes(biometricStatus);
  }

  async enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    return await ipc.keyManagement.biometric.enrollPersistent(userId, key.toBase64());
  }

  async hasPersistentKey(userId: UserId): Promise<boolean> {
    return await ipc.keyManagement.biometric.hasPersistentKey(userId);
  }

  async enableWindowsV2Biometrics(): Promise<void> {
    return await ipc.keyManagement.biometric.enableWindowsV2Biometrics();
  }

  async isWindowsV2BiometricsEnabled(): Promise<boolean> {
    return await ipc.keyManagement.biometric.isWindowsV2BiometricsEnabled();
  }

  async enableLinuxV2Biometrics(): Promise<void> {
    return await ipc.keyManagement.biometric.enableLinuxV2Biometrics();
  }

  async isLinuxV2BiometricsEnabled(): Promise<boolean> {
    return await ipc.keyManagement.biometric.isLinuxV2BiometricsEnabled();
  }
}
