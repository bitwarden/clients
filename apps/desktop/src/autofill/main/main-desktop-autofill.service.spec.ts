import { BrowserWindow, ipcMain } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { autofill } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";
import { AutofillIpcChannelControl } from "../models/autofill-ipc-channels";

import { DesktopAutofillMain } from "./main-desktop-autofill.service";

import AutofillIpcServer = autofill.AutofillIpcServer;

jest.mock("electron", () => ({
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
    removeAllListeners: jest.fn(),
    listenerCount: jest.fn().mockReturnValue(0),
  },
}));

// The napi native binding can't load in jest; only the shape used by the service is needed.
jest.mock("@bitwarden/desktop-napi", () => ({
  autofill: {
    AutofillIpcServer: {
      listen: jest.fn(),
      prototype: {},
    },
  },
  passkey_authenticator: {
    register: jest.fn(),
  },
}));

describe("DesktopAutofillMain", () => {
  let logService: MockProxy<LogService>;
  let windowMain: MockProxy<WindowMain>;
  let ipcServer: MockProxy<AutofillIpcServer>;
  let service: DesktopAutofillMain;

  // The callback under test is a private, arrow-bound field. Invoke it via bracket access.
  const invokeWindowHandleQuery = (error: Error | null, clientId: number, sequenceNumber: number) =>
    (service as any).doWindowHandleQuery(error, clientId, sequenceNumber, null);

  beforeEach(() => {
    jest.clearAllMocks();
    logService = mock<LogService>();
    windowMain = mock<WindowMain>();
    ipcServer = mock<AutofillIpcServer>();

    service = new DesktopAutofillMain(logService, windowMain);
    // `ipcServer` is only assigned inside `listenIpc()`; plant the mock directly.
    (service as any).ipcServer = ipcServer;
  });

  describe("native autofill gating", () => {
    // Captures the SetEnabled handler registered by init() so tests can drive it directly.
    const getSetEnabledHandler = () => {
      const call = (ipcMain.handle as jest.Mock).mock.calls.find(
        ([channel]) => channel === AutofillIpcChannelControl.SetEnabled,
      );
      return call?.[1] as (event: unknown, enabled: boolean) => Promise<boolean>;
    };

    beforeEach(() => {
      // `enable()` plants a fresh server; start each test un-enabled.
      (service as any).ipcServer = undefined;
      (AutofillIpcServer.listen as jest.Mock).mockResolvedValue(ipcServer);
    });

    it("registers the SetEnabled handler on init without starting the IPC server", () => {
      service.init();

      expect(getSetEnabledHandler()).toBeDefined();
      expect(AutofillIpcServer.listen).not.toHaveBeenCalled();
    });

    it("starts the IPC server and reports running when enabled", async () => {
      service.init();

      const started = await getSetEnabledHandler()(null, true);

      expect(started).toBe(true);
      expect(AutofillIpcServer.listen).toHaveBeenCalledTimes(1);
    });

    it("does not start the IPC server twice when enabled repeatedly", async () => {
      service.init();
      const handler = getSetEnabledHandler();

      await handler(null, true);
      const secondResult = await handler(null, true);

      expect(secondResult).toBe(true);
      expect(AutofillIpcServer.listen).toHaveBeenCalledTimes(1);
    });

    it("reports not running when disabled before ever being enabled", async () => {
      service.init();

      const started = await getSetEnabledHandler()(null, false);

      expect(started).toBe(false);
      expect(AutofillIpcServer.listen).not.toHaveBeenCalled();
    });
  });

  describe("handleWindowHandleQuery", () => {
    it("completes with an error when an error is passed", () => {
      const error = new Error("boom");

      invokeWindowHandleQuery(error, 1, 2);

      expect(ipcServer.completeError).toHaveBeenCalledWith(1, 2, String(error));
      expect(ipcServer.completeWindowHandleQuery).not.toHaveBeenCalled();
    });

    it("completes with an error when no window is available", () => {
      windowMain.win = undefined as unknown as BrowserWindow;

      invokeWindowHandleQuery(null, 1, 2);

      expect(ipcServer.completeError).toHaveBeenCalledWith(1, 2, "No window available");
      expect(ipcServer.completeWindowHandleQuery).not.toHaveBeenCalled();
    });

    it("completes with the window handle response when window exists", () => {
      const win = mock<BrowserWindow>();
      win.isVisible.mockReturnValue(true);
      win.isFocused.mockReturnValue(false);
      win.getNativeWindowHandle.mockReturnValue(Buffer.from([1, 2, 3]));
      windowMain.win = win;

      invokeWindowHandleQuery(null, 1, 2);

      expect(ipcServer.completeWindowHandleQuery).toHaveBeenCalledWith(1, 2, {
        isVisible: true,
        isFocused: false,
        handle: [1, 2, 3],
      });
      expect(ipcServer.completeError).not.toHaveBeenCalled();
    });
  });
});
