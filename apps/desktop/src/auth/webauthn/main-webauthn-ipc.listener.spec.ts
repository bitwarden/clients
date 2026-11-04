import { EventEmitter } from "events";

import { ipcMain, IpcMainInvokeEvent, WebContents } from "electron";
import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { webauthn } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";

import { MainWebAuthnIpcListener } from "./main-webauthn-ipc.listener";
import { WEBAUTHN_IPC_CHANNELS } from "./webauthn-ipc-channels";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
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
  let windowMain: WindowMain;
  let logService: LogService;
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
    }) as unknown as WebContents;
    windowMain = {
      win: { getNativeWindowHandle: () => windowHandle, webContents: sender },
    } as unknown as WindowMain;
    logService = mock<LogService>();
    (webauthn.requiresBrowser as jest.Mock).mockReturnValue(false);

    new MainWebAuthnIpcListener(windowMain, logService).init();
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

  describe("handleCallbackUrl", () => {
    let listener: MainWebAuthnIpcListener;

    beforeEach(() => {
      listener = new MainWebAuthnIpcListener(windowMain, logService);
    });

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
