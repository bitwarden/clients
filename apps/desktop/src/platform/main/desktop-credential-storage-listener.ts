// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ipcMain } from "electron";

import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { passwords } from "@bitwarden/desktop-napi";

const WindowsNotFoundError = "Password not found.";
const MacOSNotFoundError = "The specified item could not be found in the keychain.";
const UnixNotFoundError = "no result";

export class DesktopCredentialStorageListener {
  constructor(
    private serviceName: string,
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
          e.message === WindowsNotFoundError ||
          e.message === MacOSNotFoundError ||
          e.message === UnixNotFoundError
        ) {
          return null;
        }
        this.logService.warning(
          `Error while event in the keytar action: ${message?.action ?? "Unknown action"}`,
          e,
        );
      }
    });
  }

  // Gracefully handle old keytar values, and if detected updated the entry to the proper format
  private async getPassword(serviceName: string, key: string, keySuffix: string) {
    const val = await passwords.getPassword(serviceName, key);

    try {
      JSON.parse(val);
    } catch (e) {
      throw new Error("Password in bad format" + e + val);
    }

    return val;
  }

  private async setPassword(serviceName: string, key: string, value: string, keySuffix: string) {
    await passwords.setPassword(serviceName, key, value);
  }

  private async deletePassword(serviceName: string, key: string, keySuffix: string) {
    await passwords.deletePassword(serviceName, key);
  }
}
