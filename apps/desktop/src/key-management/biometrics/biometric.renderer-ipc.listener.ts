// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ipcMain } from "electron";

import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";

import { BiometricMessage, BiometricAction } from "../../types/biometric-message";

import { DesktopBiometricsService } from "./desktop.biometrics.service";

export class BiometricsRendererIPCListener {
  constructor(
    private serviceName: string,
    private biometricService: DesktopBiometricsService,
    private logService: ConsoleLogService,
  ) {}

  init() {
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
}
