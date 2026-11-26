import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsCommands } from "@bitwarden/key-management";

import { BrowserApi } from "../platform/browser/browser-api";

// The Safari app extension answers native messages addressed to any application id.
const SafariNativeApplication = "com.bitwarden.desktop";

/** Reply of the Swift biometrics handler, unwrapped from its `{ message: … }` envelope. */
export type SafariBiometricsReply = {
  command: string;
  response: unknown;
  /** Base64 user key, only on `unlockWithBiometricsForUser`. */
  userKeyB64?: string;
};

export class SafariApp {
  static sendMessageToApp(command: string, data: any = null, resolveNow = false): Promise<any> {
    if (!BrowserApi.isSafariApi) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const now = new Date();
      const messageId =
        now.getTime().toString() + "_" + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
      (browser as any).runtime.sendNativeMessage(
        SafariNativeApplication,
        {
          id: messageId,
          command: command,
          data: data,
          responseData: null,
        },
        (response: any) => {
          resolve(response);
        },
      );
    });
  }

  /**
   * Sends a biometrics command to the Swift handler (`SafariWebExtensionHandler.swift`), which
   * answers it itself with LocalAuthentication and the keychain. Safari has no SDK IPC transport
   * to the desktop app, so this is its only biometrics path.
   *
   * @returns the reply, or `null` when not on Safari or the handler did not answer.
   */
  static async sendBiometricsCommand(
    command: BiometricsCommands,
    userId?: UserId,
  ): Promise<SafariBiometricsReply | null> {
    if (!BrowserApi.isSafariApi) {
      return null;
    }

    const reply = await new Promise<{ message?: SafariBiometricsReply } | undefined>((resolve) => {
      (browser as any).runtime.sendNativeMessage(
        SafariNativeApplication,
        // The handler echoes messageId and timestamp; a one-shot message needs neither.
        { command, userId, messageId: 0, timestamp: Date.now() },
        resolve,
      );
    });

    return reply?.message ?? null;
  }
}
