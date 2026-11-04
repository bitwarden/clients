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
  webauthn: { getAssertion: jest.fn(), AssertionCancellation: jest.fn() },
}));

type Handler = (event: Partial<IpcMainInvokeEvent>, ...args: unknown[]) => Promise<unknown>;

describe("MainWebAuthnIpcListener", () => {
  const request = { rpId: "example.com" } as webauthn.AssertionRequest;
  const windowHandle = Buffer.from([1, 2, 3, 4]);

  let handlers: Map<string, Handler>;
  let windowMain: WindowMain;
  let logService: LogService;
  let sender: WebContents;
  let cancel: jest.Mock;
  let resolveAssertion: (result: webauthn.GetAssertionResult) => void;

  function getAssertion(requestId: string) {
    return handlers.get(WEBAUTHN_IPC_CHANNELS.GET_ASSERTION)!({ sender }, requestId, request);
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
    windowMain = { win: { getNativeWindowHandle: () => windowHandle } } as unknown as WindowMain;
    logService = mock<LogService>();

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

  it("returns an UnknownError when the native module throws", async () => {
    (webauthn.getAssertion as jest.Mock).mockRejectedValue(new Error("boom"));

    await expect(getAssertion("1")).resolves.toEqual({
      error: { name: "UnknownError", message: "Failed to get assertion." },
    });
    expect(logService.error).toHaveBeenCalled();
  });
});
