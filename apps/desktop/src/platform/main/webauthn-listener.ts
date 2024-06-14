import { ipcMain } from "electron";

import { MessageSender } from "@bitwarden/common/platform/messaging";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { passkeyclients } from "@bitwarden/desktop-native";

export class WebauthnListener {
  constructor(
    private logService: ConsoleLogService,
    private messagingService: MessageSender,
  ) {}

  init() {
    ipcMain.handle("webauthn.authenticate", async (event: any, message: any) => {
      try {
        return await passkeyclients.authenticate(
          message.challenge,
          message.origin,
          message.pin,
          (err: Error) => {
            if (err) {
              throw err;
            }
            this.messagingService.send("webauthn.touch-required");
          },
          (err: Error) => {
            if (err) {
              throw err;
            }
            this.messagingService.send("webauthn.device-required");
          },
        );
      } catch (e) {
        if ("Pin required" === e.message) {
          return "pin-required";
        } else {
          this.logService.error("Webauthn authenticate ipc handler error", e);
        }
      }
    });

    ipcMain.handle("webauthn.supports-native", async () => {
      return await passkeyclients.supportsNativeWebauthn();
    });
  }
}
