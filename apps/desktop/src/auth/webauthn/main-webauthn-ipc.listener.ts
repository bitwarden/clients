import { ipcMain, IpcMainInvokeEvent } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { webauthn } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";

import { WEBAUTHN_IPC_CHANNELS } from "./webauthn-ipc-channels";

/**
 * Handles WebAuthn requests from the renderer by calling the platform's passkey APIs.
 */
export class MainWebAuthnIpcListener {
  constructor(
    private windowMain: WindowMain,
    private logService: LogService,
  ) {}

  init() {
    ipcMain.handle(
      WEBAUTHN_IPC_CHANNELS.GET_ASSERTION,
      (_event: IpcMainInvokeEvent, request: webauthn.AssertionRequest) =>
        this.getAssertion(request),
    );
  }

  private async getAssertion(
    request: webauthn.AssertionRequest,
  ): Promise<webauthn.GetAssertionResult> {
    const win = this.windowMain.win;
    if (win == null) {
      return { error: { name: "InvalidStateError", message: "No window is open." } };
    }

    try {
      return await webauthn.getAssertion(win.getNativeWindowHandle(), request);
    } catch (e) {
      this.logService.error("[WebAuthn] Failed to get assertion", e);
      return { error: { name: "UnknownError", message: "Failed to get assertion." } };
    }
  }
}
