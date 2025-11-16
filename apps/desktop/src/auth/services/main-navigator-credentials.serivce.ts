import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { navigator_credentials, UserVerification } from "@bitwarden/desktop-napi";

export class MainNavigatorCredentialsService {
  constructor(private logService: LogService) {
    ipcMain.handle("navigatorCredentialsGet", async (event: any, message: any) => {
      this.logService.info("Handling navigatorCredentials.get request from renderer", message);
      const challenge = Utils.fromB64ToArray(message.publicKey.response.challenge);
      this.logService.info("navigatorCredentials.get challenge", challenge);
      this.logService.info(
        "navigatorCredentials.get prfEvalFirst",
        message.publicKey.extensions.prf.eval.first,
      );
      const result = navigator_credentials.get({
        challenge: Uint8Array.from(challenge),
        timeout: message.publicKey.timeout,
        rpid: message.publicKey.rpId,
        userVerification: UserVerification.Required,
        allowCredentials: [],
        prfEvalFirst: Uint8Array.from(message.publicKey.extensions.prf.eval.first),
      });
      this.logService.info("navigatorCredentials.get result", result);
      return result;
    });
  }
}
