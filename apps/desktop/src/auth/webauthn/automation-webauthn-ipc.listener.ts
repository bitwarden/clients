import { ipcMain, IpcMainInvokeEvent } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { WindowMain } from "../../main/window.main";

import {
  AUTOMATION_WEBAUTHN_CHANNEL,
  AUTOMATION_WEBAUTHN_REQUEST_CHANNEL,
  AutomationWebAuthnAction,
  AutomationWebAuthnMessage,
} from "./automation-webauthn-message";
import { AutomationWebAuthnService } from "./automation-webauthn.service";

/**
 * Registers the IPC channel that lets the renderer's automation driver control the
 * {@link AutomationWebAuthnService} in the main process. Only wired up when the automation
 * WebAuthn client is active (dev mode and `USE_AUTOMATION_WEBAUTHN`).
 */
export class AutomationWebAuthnIpcListener {
  constructor(
    private webAuthnService: AutomationWebAuthnService,
    private logService: LogService,
    private windowMain: WindowMain,
  ) {}

  init() {
    // Lets the renderer show each request, standing in for the platform's prompt.
    this.webAuthnService.requests$.subscribe((request) => {
      this.windowMain.win?.webContents.send(AUTOMATION_WEBAUTHN_REQUEST_CHANNEL, request);
    });

    ipcMain.handle(
      AUTOMATION_WEBAUTHN_CHANNEL,
      (event: IpcMainInvokeEvent, message: AutomationWebAuthnMessage) => {
        // Only the main window drives automation, as only it may make requests.
        if (event.sender !== this.windowMain.win?.webContents) {
          return undefined;
        }
        try {
          switch (message.action) {
            case AutomationWebAuthnAction.ListPending:
              return this.webAuthnService.listPendingRequests();
            case AutomationWebAuthnAction.Respond:
              return this.webAuthnService.respond(message.id, message.response);
            case AutomationWebAuthnAction.Reject:
              return this.webAuthnService.reject(message.id, message.error);
            default:
              return undefined;
          }
        } catch (e) {
          this.logService.error("[AutomationWebAuthn] %s failed", message.action, e);
          return undefined;
        }
      },
    );
  }
}
