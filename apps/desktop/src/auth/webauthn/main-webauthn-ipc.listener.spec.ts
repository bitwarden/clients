import { EventEmitter } from "events";
import { setImmediate } from "node:timers";

import { ipcMain, IpcMainInvokeEvent, WebContents } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UrlType } from "@bitwarden/common/platform/misc/safe-urls";
import { webauthn } from "@bitwarden/desktop-napi";

import { isAppImage, isLinux } from "../../main/platform-utils.main";
import { WindowMain } from "../../main/window.main";
import { SafeShell } from "../../platform/main/safe-shell.main";

import { AutomationWebAuthnService } from "./automation-webauthn.service";
import { MainWebAuthnIpcListener } from "./main-webauthn-ipc.listener";
import { WEBAUTHN_IPC_CHANNELS } from "./webauthn-ipc-channels";
import { WebAuthnLoopbackCallback } from "./webauthn-loopback-callback";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
}));

jest.mock("../../main/platform-utils.main", () => ({
  isLinux: jest.fn().mockReturnValue(false),
  isAppImage: jest.fn().mockReturnValue(false),
}));

jest.mock("../../utils", () => ({
  isDev: jest.fn().mockReturnValue(false),
}));

jest.mock("./webauthn-loopback-callback", () => ({
  WebAuthnLoopbackCallback: { listen: jest.fn() },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  webauthn: {
    getAssertion: jest.fn(),
    requiresBrowser: jest.fn(),
    webAuthenticationSession: jest.fn(),
    deliverCallback: jest.fn(),
    AssertionCancellation: jest.fn(),
    WebConnectorRequest: { start: jest.fn() },
  },
}));

type Handler = (event: Partial<IpcMainInvokeEvent>, ...args: unknown[]) => Promise<unknown>;

describe("MainWebAuthnIpcListener", () => {
  const request = {
    origin: "https://vault.example.com",
    rpId: "example.com",
    challenge: new Uint8Array([1]),
    allowCredentials: [],
  } as webauthn.AssertionRequest;
  const webVault = { url: "https://vault.example.com/vault", supportsConnector: true };
  const windowHandle = Buffer.from([1, 2, 3, 4]);

  let handlers: Map<string, Handler>;
  let listener: MainWebAuthnIpcListener;
  let windowMain: WindowMain;
  let logService: LogService;
  let shell: MockProxy<SafeShell>;
  let sender: WebContents;
  let cancel: jest.Mock;
  let resolveAssertion: (result: webauthn.GetAssertionResult) => void;

  function getAssertion(requestId: string) {
    return handlers.get(WEBAUTHN_IPC_CHANNELS.GET_ASSERTION)!(
      { sender },
      requestId,
      request,
      webVault,
    );
  }

  function cancelRequest(requestId: string) {
    return handlers.get(WEBAUTHN_IPC_CHANNELS.CANCEL)!({ sender }, requestId);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = new Map();
    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: Handler) =>
      handlers.set(channel, handler),
    );

    cancel = jest.fn();
    (webauthn.AssertionCancellation as unknown as jest.Mock).mockImplementation(() => ({
      cancel,
    }));
    (webauthn.getAssertion as jest.Mock).mockReturnValue(
      new Promise((resolve) => (resolveAssertion = resolve)),
    );

    sender = Object.assign(new EventEmitter(), {
      isDestroyed: () => false,
      send: jest.fn(),
    }) as unknown as WebContents;
    windowMain = {
      win: { getNativeWindowHandle: () => windowHandle, webContents: sender },
    } as unknown as WindowMain;
    logService = mock<LogService>();
    (webauthn.requiresBrowser as jest.Mock).mockReturnValue(false);

    shell = mock<SafeShell>();
    listener = new MainWebAuthnIpcListener(windowMain, logService, shell);
    listener.init();
  });

  it("requests an assertion for the window and returns the result", async () => {
    const result = getAssertion("1");
    resolveAssertion({ response: { credentialId: new Uint8Array([1]) } as any });

    await expect(result).resolves.toEqual({ response: { credentialId: new Uint8Array([1]) } });
    expect(webauthn.getAssertion).toHaveBeenCalledWith(
      windowHandle,
      request,
      expect.objectContaining({ cancel }),
    );
  });

  it("cancels the request with the matching ID", async () => {
    const result = getAssertion("1");

    await cancelRequest("2");
    expect(cancel).not.toHaveBeenCalled();
    await cancelRequest("1");
    expect(cancel).toHaveBeenCalledTimes(1);

    resolveAssertion({ error: { name: "AbortError", message: "Cancelled" } });
    await result;
  });

  it.each(["did-start-loading", "render-process-gone", "destroyed"])(
    "cancels the request when the renderer emits %s",
    async (eventName) => {
      const result = getAssertion("1");

      (sender as unknown as EventEmitter).emit(eventName);
      expect(cancel).toHaveBeenCalledTimes(1);

      resolveAssertion({ error: { name: "AbortError", message: "Cancelled" } });
      await result;
    },
  );

  it("stops tracking the request once it completes", async () => {
    const result = getAssertion("1");
    resolveAssertion({ response: {} as any });
    await result;

    await cancelRequest("1");
    (sender as unknown as EventEmitter).emit("did-start-loading");

    expect(cancel).not.toHaveBeenCalled();
    expect((sender as unknown as EventEmitter).eventNames()).toEqual([]);
  });

  it("returns an error when no window is open", async () => {
    (windowMain as { win: unknown }).win = null;

    await expect(getAssertion("1")).resolves.toEqual({
      error: { name: "InvalidStateError", message: "No window is open." },
    });
    expect(webauthn.getAssertion).not.toHaveBeenCalled();
  });

  it("rejects requests from other windows", async () => {
    sender = Object.assign(new EventEmitter(), {
      isDestroyed: () => false,
    }) as unknown as WebContents;

    await expect(getAssertion("1")).resolves.toEqual({
      error: { name: "NotAllowedError", message: "The request is not allowed." },
    });
    expect(webauthn.getAssertion).not.toHaveBeenCalled();
  });

  describe("in a browser", () => {
    const connectorUrl =
      "https://vault.example.com/vault/webauthn-desktop-connector.html#state=abc&request=def";
    const callbackUrl = "bitwarden://webauthn-callback#state=abc&response=ghi";
    const credential = {
      rawId: "AQ",
      response: { authenticatorData: "Ag", clientDataJson: "Aw", signature: "BA" },
    };
    let decryptResponse: jest.Mock;

    beforeEach(() => {
      decryptResponse = jest
        .fn()
        .mockReturnValue(new TextEncoder().encode(JSON.stringify({ credential })));
      (webauthn.WebConnectorRequest.start as jest.Mock).mockReturnValue({
        url: connectorUrl,
        decryptResponse,
      });
      (webauthn.webAuthenticationSession as jest.Mock).mockResolvedValue({ callbackUrl });
    });

    it("uses the web vault's connector when the RP ID requires a browser", async () => {
      (webauthn.requiresBrowser as jest.Mock).mockReturnValue(true);

      const result = (await getAssertion("1")) as webauthn.GetAssertionResult;

      expect(webauthn.getAssertion).not.toHaveBeenCalled();
      const [pageUrl, connectorRequest] = (webauthn.WebConnectorRequest.start as jest.Mock).mock
        .calls[0];
      expect(pageUrl).toBe("https://vault.example.com/vault/webauthn-desktop-connector.html");
      expect(JSON.parse(Buffer.from(connectorRequest).toString("utf8"))).toMatchObject({
        challenge: "AQ",
        rpId: "example.com",
      });
      expect(webauthn.webAuthenticationSession).toHaveBeenCalledWith(
        windowHandle,
        connectorUrl,
        "bitwarden",
        expect.objectContaining({ cancel }),
      );
      expect(decryptResponse).toHaveBeenCalledWith(callbackUrl);
      expect(result.response?.credentialId).toEqual(new Uint8Array([1]));
    });

    it("returns an UnknownError when the response can't be decrypted", async () => {
      (webauthn.requiresBrowser as jest.Mock).mockReturnValue(true);
      decryptResponse.mockImplementation(() => {
        throw new Error("Invalid connector response: Handshake failed");
      });

      await expect(getAssertion("1")).resolves.toEqual({
        error: { name: "UnknownError", message: "Failed to get assertion." },
      });
    });

    it("retries in the browser when the platform requires it", async () => {
      const result = getAssertion("1");
      resolveAssertion({ requiresBrowser: true });

      expect(((await result) as webauthn.GetAssertionResult).response?.signature).toEqual(
        new Uint8Array([4]),
      );
      expect(webauthn.webAuthenticationSession).toHaveBeenCalledTimes(1);
    });

    it("returns the session's error", async () => {
      (webauthn.requiresBrowser as jest.Mock).mockReturnValue(true);
      const error = { name: "AbortError", message: "Cancelled" };
      (webauthn.webAuthenticationSession as jest.Mock).mockResolvedValue({ error });

      await expect(getAssertion("1")).resolves.toEqual({ error });
    });

    it("doesn't open the browser itself outside Linux", async () => {
      (webauthn.requiresBrowser as jest.Mock).mockReturnValue(true);

      await getAssertion("1");

      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    describe("on Linux", () => {
      beforeEach(() => {
        (isLinux as jest.Mock).mockReturnValue(true);
        (webauthn.requiresBrowser as jest.Mock).mockReturnValue(true);
      });

      afterEach(() => {
        (isLinux as jest.Mock).mockReturnValue(false);
      });

      it("opens the connector in the browser after the session starts waiting", async () => {
        shell.openExternal.mockImplementation(() => {
          expect(webauthn.webAuthenticationSession).toHaveBeenCalled();
        });

        const result = (await getAssertion("1")) as webauthn.GetAssertionResult;

        expect(shell.openExternal).toHaveBeenCalledWith(connectorUrl, UrlType.WebUrl);
        expect(result.response?.credentialId).toEqual(new Uint8Array([1]));
      });

      it("receives the callback through the app's URL scheme", async () => {
        await getAssertion("1");

        expect(WebAuthnLoopbackCallback.listen).not.toHaveBeenCalled();
        expect((webauthn.WebConnectorRequest.start as jest.Mock).mock.calls[0][2]).toBeUndefined();
        expect((webauthn.webAuthenticationSession as jest.Mock).mock.calls[0][2]).toBe("bitwarden");
      });

      describe("in an AppImage, which doesn't register the app's URL scheme", () => {
        let closeLoopback: jest.Mock;

        beforeEach(() => {
          (isAppImage as jest.Mock).mockReturnValue(true);
          closeLoopback = jest.fn();
          (WebAuthnLoopbackCallback.listen as jest.Mock).mockResolvedValue({
            port: 43210,
            close: closeLoopback,
          });
        });

        afterEach(() => {
          (isAppImage as jest.Mock).mockReturnValue(false);
        });

        it("receives the callback on a localhost port, which it closes afterwards", async () => {
          const result = (await getAssertion("1")) as webauthn.GetAssertionResult;

          expect((webauthn.WebConnectorRequest.start as jest.Mock).mock.calls[0][2]).toBe(43210);
          expect((webauthn.webAuthenticationSession as jest.Mock).mock.calls[0][2]).toBe("http");
          expect(result.response?.credentialId).toEqual(new Uint8Array([1]));
          expect(closeLoopback).toHaveBeenCalled();
        });

        it("delivers callbacks from the port to the browser session", async () => {
          await getAssertion("1");
          const deliver = (WebAuthnLoopbackCallback.listen as jest.Mock).mock.calls[0][0];

          deliver("http://127.0.0.1:43210/webauthn-callback?state=abc");

          expect(webauthn.deliverCallback).toHaveBeenCalledWith(
            "http://127.0.0.1:43210/webauthn-callback?state=abc",
          );
        });

        describe("bringing the window to the front", () => {
          let win: Record<string, jest.Mock>;

          async function deliverCallback(delivered: boolean) {
            await getAssertion("1");
            const deliver = (WebAuthnLoopbackCallback.listen as jest.Mock).mock.calls[0][0];
            (webauthn.deliverCallback as jest.Mock).mockReturnValue(delivered);
            deliver("http://127.0.0.1:43210/webauthn-callback?state=abc");
          }

          beforeEach(() => {
            win = {
              isDestroyed: jest.fn().mockReturnValue(false),
              isMinimized: jest.fn().mockReturnValue(true),
              restore: jest.fn(),
              show: jest.fn(),
              focus: jest.fn(),
              getNativeWindowHandle: jest.fn().mockReturnValue(windowHandle),
            };
            Object.assign(windowMain.win!, win, { webContents: sender });
          });

          it("restores, shows and focuses it when the callback is delivered", async () => {
            await deliverCallback(true);

            expect(win.restore).toHaveBeenCalled();
            expect(win.show).toHaveBeenCalled();
            expect(win.focus).toHaveBeenCalled();
          });

          it("leaves it alone for callbacks that no session is waiting for", async () => {
            await deliverCallback(false);

            expect(win.focus).not.toHaveBeenCalled();
          });
        });

        it("closes the port when the request can't be started", async () => {
          (webauthn.WebConnectorRequest.start as jest.Mock).mockImplementation(() => {
            throw new Error("Invalid connector URL");
          });

          await getAssertion("1");

          expect(closeLoopback).toHaveBeenCalled();
        });
      });

      it("tells the renderer that the request continues in the browser", async () => {
        await getAssertion("1");

        expect(sender.send).toHaveBeenCalledWith(
          WEBAUTHN_IPC_CHANNELS.BROWSER_SESSION_STARTED,
          "1",
        );
      });

      describe("reopening the browser", () => {
        let endSession: () => void;

        beforeEach(() => {
          const ended = new Promise<void>((resolve) => (endSession = resolve));
          (webauthn.webAuthenticationSession as jest.Mock).mockImplementation(async () => {
            await ended;
            return { callbackUrl };
          });
        });

        async function startAndWaitForBrowser() {
          const result = getAssertion("1");
          while ((sender.send as jest.Mock).mock.calls.length === 0) {
            await new Promise((resolve) => setImmediate(resolve));
          }
          return { result };
        }

        function reopen(from: WebContents) {
          return handlers.get(WEBAUTHN_IPC_CHANNELS.REOPEN_BROWSER)!({ sender: from }, "1");
        }

        it("opens it again for the window that made the request", async () => {
          const { result } = await startAndWaitForBrowser();

          await reopen(sender);

          expect(shell.openExternal).toHaveBeenCalledTimes(2);
          expect(shell.openExternal.mock.calls[1]).toEqual(shell.openExternal.mock.calls[0]);
          endSession();
          await result;
        });

        it("doesn't open it for another window", async () => {
          const { result } = await startAndWaitForBrowser();

          await reopen(Object.assign(new EventEmitter(), {}) as unknown as WebContents);

          expect(shell.openExternal).toHaveBeenCalledTimes(1);
          endSession();
          await result;
        });

        it("doesn't open it after the request ends", async () => {
          const { result } = await startAndWaitForBrowser();
          endSession();
          await result;

          await reopen(sender);

          expect(shell.openExternal).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe("when the session doesn't end", () => {
      beforeEach(() => {
        jest.useFakeTimers();
        (webauthn.requiresBrowser as jest.Mock).mockReturnValue(true);
        (webauthn.webAuthenticationSession as jest.Mock).mockReturnValue(new Promise(() => {}));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      /**
       * Lets the listener create the connector session before advancing the timer. The result is
       * wrapped, so that awaiting this doesn't wait for it.
       */
      async function startAndWaitForSession(requestTimeout?: number) {
        const result = handlers.get(WEBAUTHN_IPC_CHANNELS.GET_ASSERTION)!(
          { sender },
          "1",
          { ...request, timeout: requestTimeout },
          webVault,
        );
        while ((webauthn.webAuthenticationSession as jest.Mock).mock.calls.length === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
        return { result };
      }

      it("times out after the request's timeout and a grace period, and cancels the session", async () => {
        const { result } = await startAndWaitForSession(10_000);

        await jest.advanceTimersByTimeAsync(10_000 + 59_999);
        expect(cancel).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);

        await expect(result).resolves.toEqual({
          error: {
            name: "NotAllowedError",
            message: "The operation either timed out or was not allowed.",
          },
        });
        expect(cancel).toHaveBeenCalled();
      });

      it("uses WebAuthn's default timeout when the request has none", async () => {
        const { result } = await startAndWaitForSession();

        await jest.advanceTimersByTimeAsync(300_000 + 59_999);
        expect(cancel).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);

        await expect(result).resolves.toMatchObject({ error: { name: "NotAllowedError" } });
      });
    });

    it("rejects a web vault URL with a different origin", async () => {
      (webauthn.requiresBrowser as jest.Mock).mockReturnValue(true);

      const result = handlers.get(WEBAUTHN_IPC_CHANNELS.GET_ASSERTION)!({ sender }, "1", request, {
        url: "https://evil.example.com",
        supportsConnector: true,
      });

      await expect(result).resolves.toEqual({
        error: { name: "SecurityError", message: "The web vault URL is not valid." },
      });
      expect(webauthn.webAuthenticationSession).not.toHaveBeenCalled();
    });
  });

  it("does not open the browser when the server doesn't support the connector", async () => {
    (webauthn.requiresBrowser as jest.Mock).mockReturnValue(true);

    const result = handlers.get(WEBAUTHN_IPC_CHANNELS.GET_ASSERTION)!({ sender }, "1", request, {
      ...webVault,
      supportsConnector: false,
    });

    await expect(result).resolves.toEqual({
      error: {
        name: "NotSupportedError",
        message: "The server must be updated to use passkeys for this account on this device.",
      },
    });
    expect(webauthn.webAuthenticationSession).not.toHaveBeenCalled();
  });

  it("returns an UnknownError when the native module throws", async () => {
    (webauthn.getAssertion as jest.Mock).mockRejectedValue(new Error("boom"));

    await expect(getAssertion("1")).resolves.toEqual({
      error: { name: "UnknownError", message: "Failed to get assertion." },
    });
    expect(logService.error).toHaveBeenCalled();
  });

  describe("with the automation client", () => {
    let automation: AutomationWebAuthnService;

    beforeEach(() => {
      automation = new AutomationWebAuthnService(logService);
      listener = new MainWebAuthnIpcListener(windowMain, logService, shell, automation);
      listener.init();
    });

    it("waits for automation to answer instead of using the platform or a browser", async () => {
      const result = getAssertion("1");
      const [pending] = automation.listPendingRequests();

      automation.respond(pending.id, {
        credentialId: "AQ",
        clientDataJson: "Ag",
        authenticatorData: "Aw",
        signature: "BA",
      });

      await expect(result).resolves.toEqual({
        response: expect.objectContaining({ credentialId: new Uint8Array([1]) }),
      });
      expect(webauthn.getAssertion).not.toHaveBeenCalled();
      expect(webauthn.requiresBrowser).not.toHaveBeenCalled();
      expect(webauthn.webAuthenticationSession).not.toHaveBeenCalled();
    });

    it("ends the request with an AbortError when the renderer cancels it", async () => {
      const result = getAssertion("1");

      await cancelRequest("1");

      await expect(result).resolves.toEqual({
        error: { name: "AbortError", message: "The request was cancelled." },
      });
      expect(automation.listPendingRequests()).toEqual([]);
    });

    it("ends the request with an AbortError when the renderer reloads", async () => {
      const result = getAssertion("1");

      (sender as unknown as EventEmitter).emit("did-start-loading");

      await expect(result).resolves.toEqual({
        error: { name: "AbortError", message: "The request was cancelled." },
      });
    });

    it("still rejects requests from other windows", async () => {
      const other = Object.assign(new EventEmitter(), {
        isDestroyed: () => false,
      }) as unknown as WebContents;

      const result = handlers.get(WEBAUTHN_IPC_CHANNELS.GET_ASSERTION)!(
        { sender: other },
        "1",
        request,
        webVault,
      );

      await expect(result).resolves.toEqual({
        error: { name: "NotAllowedError", message: "The request is not allowed." },
      });
      expect(automation.listPendingRequests()).toEqual([]);
    });
  });

  describe("handleCallbackUrl", () => {
    it("delivers connector callbacks to the waiting browser session", () => {
      const url = "bitwarden://webauthn-callback#state=abc&response=def";

      expect(listener.handleCallbackUrl(url)).toBe(true);
      expect(webauthn.deliverCallback).toHaveBeenCalledWith(url);
    });

    it("handles connector callbacks that no session is waiting for", () => {
      (webauthn.deliverCallback as jest.Mock).mockReturnValue(false);

      expect(listener.handleCallbackUrl("bitwarden://webauthn-callback#state=abc")).toBe(true);
    });

    it("does not handle other app links", () => {
      expect(listener.handleCallbackUrl("bitwarden://sso-callback?code=abc&state=def")).toBe(false);
      expect(webauthn.deliverCallback).not.toHaveBeenCalled();
    });
  });
});
