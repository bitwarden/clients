import { BrowserWindow } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { autofill } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";

import { DesktopAutofillMain } from "./main-desktop-autofill.service";

import AutofillIpcServer = autofill.AutofillIpcServer;

jest.mock("electron", () => ({
  ipcMain: {
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}));

// The napi native binding can't load in jest; only the `autofill` namespace shape is needed.
jest.mock("@bitwarden/desktop-napi", () => ({
  autofill: {},
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
    logService = mock<LogService>();
    windowMain = mock<WindowMain>();
    ipcServer = mock<AutofillIpcServer>();

    service = new DesktopAutofillMain(logService, windowMain);
    // `ipcServer` is only assigned inside `listenIpc()`; plant the mock directly.
    (service as any).ipcServer = ipcServer;
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
