import { ipcMain, IpcMainInvokeEvent, WebContents } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { webauthn } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";

import type { WebVault } from "./native-webauthn";
import {
  buildConnectorRequest,
  CONNECTOR_CALLBACK_SCHEME,
  connectorPageUrl,
  isConnectorCallbackUrl,
  isValidWebVaultUrl,
  parseConnectorResponse,
} from "./webauthn-connector";
import { WEBAUTHN_IPC_CHANNELS } from "./webauthn-ipc-channels";

/**
 * Handles WebAuthn requests from the renderer by calling the platform's passkey APIs.
 *
 * Where those can't be used, e.g. on macOS for relying parties outside the app's associated
 * domains, the request is made in a browser session with the web vault's WebAuthn connector.
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
      (
        event: IpcMainInvokeEvent,
        requestId: string,
        request: webauthn.AssertionRequest,
        webVault: WebVault,
      ) => this.getAssertion(event.sender, requestId, request, webVault),
    );
    ipcMain.handle(WEBAUTHN_IPC_CHANNELS.CANCEL, (_event: IpcMainInvokeEvent, requestId: string) =>
      this.pending.get(requestId)?.cancel(),
    );
  }

  /**
   * Handles a URL from the app's URL scheme handler if it is a WebAuthn connector callback, by
   * delivering it to the browser session waiting for it. Returns whether it was handled.
   *
   * Callbacks are handled even if no session is waiting, since they are only for this listener.
   */
  handleCallbackUrl(url: string): boolean {
    if (!isConnectorCallbackUrl(url)) {
      return false;
    }
    webauthn.deliverCallback(url);
    return true;
  }

  private async getAssertion(
    sender: WebContents,
    requestId: string,
    request: webauthn.AssertionRequest,
    webVault: WebVault,
  ): Promise<webauthn.GetAssertionResult> {
    const win = this.windowMain.win;
    if (win == null) {
      return { error: { name: "InvalidStateError", message: "No window is open." } };
    }
    // Only the main window may show the platform's passkey prompt.
    if (sender !== win.webContents) {
      return { error: { name: "NotAllowedError", message: "The request is not allowed." } };
    }

    // Close the platform's prompt if the renderer reloads or goes away while it is open.
    const cancelOnRendererGone = () => this.pending.get(requestId)?.cancel();
    try {
      const cancellation = new webauthn.AssertionCancellation();
      this.pending.set(requestId, cancellation);
      sender.once("did-start-loading", cancelOnRendererGone);
      sender.once("render-process-gone", cancelOnRendererGone);
      sender.once("destroyed", cancelOnRendererGone);
      const windowHandle = win.getNativeWindowHandle();
      const result = webauthn.requiresBrowser(request.rpId)
        ? { requiresBrowser: true }
        : await webauthn.getAssertion(windowHandle, request, cancellation);
      if (!result.requiresBrowser) {
        return result;
      }
      return await this.getAssertionInBrowser(windowHandle, request, webVault, cancellation);
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

  private async getAssertionInBrowser(
    windowHandle: Buffer,
    request: webauthn.AssertionRequest,
    webVault: WebVault,
    cancellation: webauthn.AssertionCancellation,
  ): Promise<webauthn.GetAssertionResult> {
    if (!webVault.supportsConnector) {
      return {
        error: {
          name: "NotSupportedError",
          message: "The server must be updated to use passkeys for this account on this device.",
        },
      };
    }
    if (!isValidWebVaultUrl(webVault.url, request.origin)) {
      return { error: { name: "SecurityError", message: "The web vault URL is not valid." } };
    }
    // The connector encrypts its response to a key that doesn't leave the native module.
    const connectorRequest = webauthn.WebConnectorRequest.start(
      connectorPageUrl(webVault.url),
      buildConnectorRequest(request),
    );
    const session = await webauthn.webAuthenticationSession(
      windowHandle,
      connectorRequest.url,
      CONNECTOR_CALLBACK_SCHEME,
      cancellation,
    );
    if (session.callbackUrl == null) {
      return { error: session.error ?? { name: "UnknownError", message: "No result." } };
    }
    return parseConnectorResponse(connectorRequest.decryptResponse(session.callbackUrl), request);
  }
}
