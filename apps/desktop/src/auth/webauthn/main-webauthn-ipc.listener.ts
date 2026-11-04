import { ipcMain, IpcMainInvokeEvent, WebContents } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { webauthn } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";

import { WEBAUTHN_IPC_CHANNELS } from "./webauthn-ipc-channels";

/**
 * Handles WebAuthn requests from the renderer by calling the platform's passkey APIs.
 */
export class MainWebAuthnIpcListener {
  /** Cancellations for in-progress requests, by renderer-chosen request ID. */
  private pending = new Map<string, webauthn.AssertionCancellation>();

  constructor(
    private windowMain: WindowMain,
    private logService: LogService,
  ) {}

  init() {
    ipcMain.handle(
      WEBAUTHN_IPC_CHANNELS.GET_ASSERTION,
      (event: IpcMainInvokeEvent, requestId: string, request: webauthn.AssertionRequest) =>
        this.getAssertion(event.sender, requestId, request),
    );
    ipcMain.handle(WEBAUTHN_IPC_CHANNELS.CANCEL, (_event: IpcMainInvokeEvent, requestId: string) =>
      this.pending.get(requestId)?.cancel(),
    );
  }

  private async getAssertion(
    sender: WebContents,
    requestId: string,
    request: webauthn.AssertionRequest,
  ): Promise<webauthn.GetAssertionResult> {
    const win = this.windowMain.win;
    if (win == null) {
      return { error: { name: "InvalidStateError", message: "No window is open." } };
    }

    // Close the platform's prompt if the renderer reloads or goes away while it is open.
    const cancelOnRendererGone = () => this.pending.get(requestId)?.cancel();
    try {
      const cancellation = new webauthn.AssertionCancellation();
      this.pending.set(requestId, cancellation);
      sender.once("did-start-loading", cancelOnRendererGone);
      sender.once("render-process-gone", cancelOnRendererGone);
      sender.once("destroyed", cancelOnRendererGone);
      return await webauthn.getAssertion(win.getNativeWindowHandle(), request, cancellation);
    } catch (e) {
      this.logService.error("[WebAuthn] Failed to get assertion", e);
      return { error: { name: "UnknownError", message: "Failed to get assertion." } };
    } finally {
      this.pending.delete(requestId);
      if (!sender.isDestroyed()) {
        sender.removeListener("did-start-loading", cancelOnRendererGone);
        sender.removeListener("render-process-gone", cancelOnRendererGone);
        sender.removeListener("destroyed", cancelOnRendererGone);
      }
    }
  }
}
