// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ipcMain } from "electron";

import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { passwords } from "@bitwarden/desktop-napi";

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

        // Biometric is internal to the main process and must not be exposed via IPC
        if (serviceName == "Bitwarden_biometric") {
          return;
        }

        let val: string | boolean = null;
        if (message.action && message.key) {
          if (message.action === "getPassword") {
            val = await passwords.getPassword(serviceName, message.key);
          } else if (message.action === "hasPassword") {
            const result = await passwords.getPassword(serviceName, message.key);
            val = result != null;
          } else if (message.action === "setPassword" && message.value) {
            await passwords.setPassword(serviceName, message.key, message.value);
          } else if (message.action === "deletePassword") {
            await passwords.deletePassword(serviceName, message.key);
          }
        }
        return val;
      } catch (e) {
        if (e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND) {
          if (message.action === "hasPassword") {
            return false;
          }
          return null;
        }
        this.logService.error("[Credential Storage Listener] %s failed", message.action, e);
      }
    });
  }
}
