import { ipcMain } from "electron";

import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { BiometricMessage, BiometricAction } from "../../types/biometric-message";

import { DesktopBiometricsService } from "./desktop.biometrics.service";

export class MainBiometricsIPCListener {
  constructor(
    private biometricService: DesktopBiometricsService,
    private logService: ConsoleLogService,
  ) {}

  init() {
    ipcMain.handle("biometric", async (event: any, message: BiometricMessage) => {
      try {
        if (!message.action) {
          return;
        }

        switch (message.action) {
          case BiometricAction.Authenticate:
            return await this.biometricService.authenticateWithBiometrics();
          case BiometricAction.GetStatus:
            return await this.biometricService.getBiometricsStatus();
          case BiometricAction.UnlockForUser:
            return await this.biometricService.unlockWithBiometricsForUser(
              message.userId as UserId,
            );
          case BiometricAction.GetStatusForUser:
            return await this.biometricService.getBiometricsStatusForUser(message.userId as UserId);
          case BiometricAction.SetKeyForUser:
            if (message.key == null) {
              return;
            }
            return await this.biometricService.setBiometricProtectedUnlockKeyForUser(
              message.userId as UserId,
              SymmetricCryptoKey.fromString(message.key),
            );
          case BiometricAction.RemoveKeyForUser:
            return await this.biometricService.deleteBiometricUnlockKeyForUser(
              message.userId as UserId,
            );
          case BiometricAction.Setup:
            return await this.biometricService.setupBiometrics();

          case BiometricAction.SetShouldAutoprompt:
            return await this.biometricService.setShouldAutopromptNow(message.data as boolean);
          case BiometricAction.GetShouldAutoprompt:
            return await this.biometricService.getShouldAutopromptNow();
          case BiometricAction.HasPersistentKey:
            return await this.biometricService.hasPersistentKey(message.userId as UserId);
          case BiometricAction.EnrollPersistent:
            return await this.biometricService.enrollPersistent(
              message.userId as UserId,
              SymmetricCryptoKey.fromString(message.key as string),
            );
          case BiometricAction.EnableWindowsV2:
            return await this.biometricService.enableWindowsV2Biometrics();
          case BiometricAction.IsWindowsV2Enabled:
            return await this.biometricService.isWindowsV2BiometricsEnabled();
          case BiometricAction.EnableLinuxV2:
            return await this.biometricService.enableLinuxV2Biometrics();
          case BiometricAction.IsLinuxV2Enabled:
            return await this.biometricService.isLinuxV2BiometricsEnabled();
          default:
            return;
        }
      } catch (e) {
        this.logService.error("[Main Biometrics IPC Listener] %s failed", message.action, e);
      }
    });
  }
}
