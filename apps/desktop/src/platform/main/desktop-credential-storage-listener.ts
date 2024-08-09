import { ipcMain } from "electron";

import { BiometricKey } from "@bitwarden/common/auth/types/biometric-key";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { passwords } from "@bitwarden/desktop-napi";

import { BiometricMessage, BiometricAction } from "../../types/biometric-message";

import { DesktopBiometricsService } from "./biometric/index";

const AuthRequiredSuffix = "_biometric";

export class DesktopCredentialStorageListener {
  constructor(
    private serviceName: string,
    private biometricService: DesktopBiometricsService,
    private logService: ConsoleLogService,
  ) {}

  init() {
    ipcMain.handle("keytar", async (event: any, message: any) => {
      try {
        let serviceName = this.serviceName;
        message.keySuffix = "_" + (message.keySuffix ?? "");
        if (message.keySuffix !== "_") {
          serviceName += message.keySuffix;
        }

        let val: string | boolean = null;
        if (message.action && message.key) {
          if (message.action === "getPassword") {
            val = await this.getPassword(serviceName, message.key, message.keySuffix);
          } else if (message.action === "hasPassword") {
            const result = await passwords.getPassword(serviceName, message.key);
            val = result != null;
          } else if (message.action === "setPassword" && message.value) {
            await this.setPassword(serviceName, message.key, message.value, message.keySuffix);
          } else if (message.action === "deletePassword") {
            await this.deletePassword(serviceName, message.key, message.keySuffix);
          }
        }
        return val;
      } catch (e) {
        if (
          e.message === "Password not found." ||
          e.message === "The specified item could not be found in the keychain."
        ) {
          return null;
        }
        this.logService.info(e);
      }
    });

    ipcMain.handle("biometric", async (event: any, message: BiometricMessage) => {
      try {
        let serviceName = this.serviceName;
        message.keySuffix = "_" + (message.keySuffix ?? "");
        if (message.keySuffix !== "_") {
          serviceName += message.keySuffix;
        }

        let val: string | boolean = null;

        if (!message.action) {
          return val;
        }

        switch (message.action) {
          case BiometricAction.EnabledForUser:
            if (!message.key || !message.userId) {
              break;
            }
            val = await this.biometricService.canAuthBiometric({
              service: serviceName,
              key: message.key,
              userId: message.userId,
            });
            break;
          case BiometricAction.OsSupported:
            val = await this.biometricService.supportsBiometric();
            break;
          case BiometricAction.NeedsSetup:
            val = await this.biometricService.biometricsNeedsSetup();
            break;
          case BiometricAction.Setup:
            await this.biometricService.biometricsSetup();
            break;
          case BiometricAction.CanAutoSetup:
            val = await this.biometricService.biometricsSupportsAutoSetup();
            break;
          default:
        }

        return val;
      } catch (e) {
        this.logService.info(e);
      }
    });
  }

  // Gracefully handle old keytar values, and if detected updated the entry to the proper format
  private async getPassword(serviceName: string, key: string, keySuffix: string) {
    let val: string;
    if (keySuffix === AuthRequiredSuffix) {
      val = (await this.biometricService.getBiometricKey(serviceName, key)) ?? null;
    } else {
      val = await passwords.getPassword(serviceName, key);
    }

    try {
      JSON.parse(val);
    } catch (e) {
      throw new Error("Password in bad format" + e + val);
    }

    return val;
  }

  private async setPassword(serviceName: string, key: string, value: string, keySuffix: string) {
    if (keySuffix === AuthRequiredSuffix) {
      const valueObj = JSON.parse(value) as BiometricKey;
      await this.biometricService.setEncryptionKeyHalf({
        service: serviceName,
        key,
        value: valueObj?.clientEncKeyHalf,
      });
      // Value is usually a JSON string, but we need to pass the key half as well, so we re-stringify key here.
      await this.biometricService.setBiometricKey(serviceName, key, JSON.stringify(valueObj?.key));
    } else {
      await passwords.setPassword(serviceName, key, value);
    }
  }

  private async deletePassword(serviceName: string, key: string, keySuffix: string) {
    if (keySuffix === AuthRequiredSuffix) {
      await this.biometricService.deleteBiometricKey(serviceName, key);
    } else {
      await passwords.deletePassword(serviceName, key);
    }
  }
}
