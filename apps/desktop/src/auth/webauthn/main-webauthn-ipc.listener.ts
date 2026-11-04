import { ipcMain, IpcMainInvokeEvent, WebContents } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UrlType } from "@bitwarden/common/platform/misc/safe-urls";
import { webauthn } from "@bitwarden/desktop-napi";

import { isLinux } from "../../main/platform-utils.main";
import { WindowMain } from "../../main/window.main";
import { SafeShell } from "../../platform/main/safe-shell.main";

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

/** WebAuthn's recommended default timeout, for requests without one. */
const DEFAULT_TIMEOUT_MS = 300_000;

/** Extra time for the browser to open, and for the user to switch to it. */
const BROWSER_SESSION_GRACE_MS = 60_000;

/**
 * Handles WebAuthn requests from the renderer by calling the platform's passkey APIs.
 *
 * Where those can't be used, e.g. on macOS for relying parties outside the app's associated
 * domains, the request is made in a browser session with the web vault's WebAuthn connector.
 */
export class MainWebAuthnIpcListener {
  /** Cancellations for in-progress requests, by renderer-chosen request ID. */
  private pending = new Map<string, webauthn.AssertionCancellation>();
  /** Requests waiting for the user's browser, by request ID, which the renderer may reopen. */
  private browserSessions = new Map<string, { sender: WebContents; url: string }>();

  constructor(
    private windowMain: WindowMain,
    private logService: LogService,
    private shell: SafeShell,
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
    ipcMain.handle(
      WEBAUTHN_IPC_CHANNELS.REOPEN_BROWSER,
      (event: IpcMainInvokeEvent, requestId: string) => {
        const session = this.browserSessions.get(requestId);
        // Only the window that made the request may reopen it.
        if (session != null && session.sender === event.sender) {
          this.shell.openExternal(session.url, UrlType.WebUrl);
        }
      },
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
      return await this.getAssertionInBrowser(
        sender,
        requestId,
        windowHandle,
        request,
        webVault,
        cancellation,
      );
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

  /**
   * Resolves with `null` and cancels the session if it doesn't end within the request's timeout,
   * with time to open the browser. The connector enforces the timeout itself, but where the app
   * can't tell that the browser was closed, e.g. on Linux, nothing would be returned.
   */
  private async withBrowserSessionTimeout(
    session: Promise<webauthn.WebAuthenticationSessionResult>,
    timeout: number | undefined,
    cancellation: webauthn.AssertionCancellation,
  ): Promise<webauthn.WebAuthenticationSessionResult | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<null>((resolve) => {
      timer = setTimeout(
        () => {
          cancellation.cancel();
          resolve(null);
        },
        (timeout ?? DEFAULT_TIMEOUT_MS) + BROWSER_SESSION_GRACE_MS,
      );
    });
    try {
      return await Promise.race([session, timedOut]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async getAssertionInBrowser(
    sender: WebContents,
    requestId: string,
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
    const url = connectorRequest.url;
    const pendingSession = webauthn.webAuthenticationSession(
      windowHandle,
      url,
      CONNECTOR_CALLBACK_SCHEME,
      cancellation,
    );
    if (isLinux()) {
      // On Linux, the session only waits for the callback. Electron opens the browser with an
      // activation token, so that it is focused. If it can't be opened, the session times out.
      this.shell.openExternal(url, UrlType.WebUrl);
      // The app can't tell whether the browser opened, was focused or was closed, so let the
      // renderer show that the request continues there, and reopen or cancel it.
      this.browserSessions.set(requestId, { sender, url });
      sender.send(WEBAUTHN_IPC_CHANNELS.BROWSER_SESSION_STARTED, requestId);
    }
    let session: webauthn.WebAuthenticationSessionResult | null;
    try {
      session = await this.withBrowserSessionTimeout(pendingSession, request.timeout, cancellation);
    } finally {
      this.browserSessions.delete(requestId);
    }
    if (session == null) {
      return {
        error: {
          name: "NotAllowedError",
          message: "The operation either timed out or was not allowed.",
        },
      };
    }
    if (session.callbackUrl == null) {
      return { error: session.error ?? { name: "UnknownError", message: "No result." } };
    }
    return parseConnectorResponse(connectorRequest.decryptResponse(session.callbackUrl), request);
  }
}
