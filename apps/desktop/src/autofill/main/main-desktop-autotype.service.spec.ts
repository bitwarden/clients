import { mock } from "jest-mock-extended";

import { IpcService } from "@bitwarden/common/platform/ipc";
import { LogService } from "@bitwarden/logging";
import { autotypeRegisterEchoHandler, autotypeRequestEcho } from "@bitwarden/sdk-internal";

import { WindowMain } from "../../main/window.main";

import { MainDesktopAutotypeService } from "./main-desktop-autotype.service";

jest.mock("electron", () => ({
  globalShortcut: {
    register: jest.fn(),
    unregister: jest.fn(),
    isRegistered: jest.fn().mockReturnValue(false),
  },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  autotype_mvp: {
    getForegroundWindowTitle: jest.fn(),
    typeInput: jest.fn(),
  },
}));

jest.mock("@bitwarden/sdk-internal", () => ({
  autotypeRegisterEchoHandler: jest.fn(),
  autotypeRequestEcho: jest.fn(),
  // Pulled in transitively by the IpcService barrel via SdkLoadService.
  LogLevel: { Trace: 0, Debug: 1, Info: 2, Warn: 3, Error: 4 },
  init_sdk: jest.fn(),
}));

const registerEchoHandlerMock = autotypeRegisterEchoHandler as jest.Mock;
const requestEchoMock = autotypeRequestEcho as jest.Mock;

describe("MainDesktopAutotypeService", () => {
  let service: MainDesktopAutotypeService;

  // Sentinel standing in for the SDK IpcClient, so assertions can prove the
  // service passes `ipcService.client` through rather than something else.
  const ipcClient = { sentinel: "ipc-client" };
  let ipcService: IpcService;
  let logService: LogService;

  // jsdom@20 predates the `AbortSignal.timeout` static the service relies on;
  // Electron's main process provides it. See desktop-fido2-user-interface.service.spec.ts.
  const originalTimeout = (AbortSignal as any).timeout;
  let deadlineController: AbortController;

  beforeEach(() => {
    deadlineController = new AbortController();
    (AbortSignal as any).timeout = jest.fn(() => deadlineController.signal);

    registerEchoHandlerMock.mockResolvedValue(undefined);
    requestEchoMock.mockResolvedValue({ message: "pong" });

    ipcService = { client: ipcClient, send: jest.fn() } as unknown as IpcService;
    logService = mock<LogService>();

    service = new MainDesktopAutotypeService(logService, mock<WindowMain>(), ipcService);
  });

  afterEach(() => {
    (AbortSignal as any).timeout = originalTimeout;
    jest.clearAllMocks();
  });

  describe("init", () => {
    it("registers the echo handler with the SDK ipc client", async () => {
      await service.init();

      expect(registerEchoHandlerMock).toHaveBeenCalledWith(ipcClient);
    });

    it("does not request an echo during startup", async () => {
      // The renderer registers its handler much later, so a request issued here
      // would race it and time out.
      await service.init();

      expect(requestEchoMock).not.toHaveBeenCalled();
    });
  });

  describe("requestEcho", () => {
    it("sends the request to the renderer with a timeout signal", async () => {
      await service.requestEcho("hello");

      expect(requestEchoMock).toHaveBeenCalledWith(
        ipcClient,
        "DesktopRenderer",
        "hello",
        expect.any(AbortSignal),
      );
    });

    it("returns the response from the renderer", async () => {
      requestEchoMock.mockResolvedValue({ message: "hello" });

      await expect(service.requestEcho("hello")).resolves.toEqual({ message: "hello" });
    });

    it("propagates a failed request rather than swallowing it", async () => {
      const failure = new Error("timed out");
      requestEchoMock.mockRejectedValue(failure);

      await expect(service.requestEcho("hello")).rejects.toThrow(failure);
    });
  });

  it("never logs an IPC payload", async () => {
    await service.init();
    await service.requestEcho("secret-looking-value");

    const logged = [
      ...(logService.info as jest.Mock).mock.calls,
      ...(logService.debug as jest.Mock).mock.calls,
      ...(logService.error as jest.Mock).mock.calls,
    ].flat();

    expect(logged.join(" ")).not.toContain("secret-looking-value");
  });
});
