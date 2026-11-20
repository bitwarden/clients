import { BrowserWindow, ipcMain } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { autofill, passkey_authenticator } from "@bitwarden/desktop-napi";

import { RendererVisibility, WindowMain } from "../../main/window.main";
import {
  AutofillIpcChannelControl,
  AutofillIpcChannelIncoming,
} from "../models/autofill-ipc-channels";

import { DesktopAutofillMain } from "./main-desktop-autofill.service";

import AutofillIpcServer = autofill.AutofillIpcServer;

// window.main loads electron at import time; only RendererVisibility is used here.
jest.mock("../../main/window.main", () => ({
  WindowMain: jest.fn(),
  RendererVisibility: { Shown: "shown", Hidden: "hidden" },
}));

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
    NOT_SUPPORTED: "Passkey authenticator plugin is not supported",
    getState: jest.fn(),
    register: jest.fn(),
  },
}));

describe("DesktopAutofillMain", () => {
  let logService: MockProxy<LogService>;
  let windowMain: MockProxy<WindowMain>;
  let ipcServer: MockProxy<AutofillIpcServer>;
  let service: DesktopAutofillMain;

  // The callback under test is a private, arrow-bound field. Invoke it via bracket access.
  const invokeWindowHandleQuery = async (
    error: Error | null,
    clientId: number,
    sequenceNumber: number,
  ) => {
    (service as any).doWindowHandleQuery(error, clientId, sequenceNumber, null);
    // The query completes asynchronously once a window exists.
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    logService = mock<LogService>();
    windowMain = mock<WindowMain>();
    windowMain.ensureRenderer.mockResolvedValue();
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

    it("re-registers but does not start the IPC server twice when enabled repeatedly", async () => {
      service.init();
      const handler = getSetEnabledHandler();

      await handler(null, true);
      const secondResult = await handler(null, true);

      expect(secondResult).toBe(true);
      expect(passkey_authenticator.register).toHaveBeenCalledTimes(2);
      expect(AutofillIpcServer.listen).toHaveBeenCalledTimes(1);
    });

    describe("passkey plugin registration", () => {
      afterEach(() => {
        (passkey_authenticator.register as jest.Mock).mockReset();
      });

      it("starts the IPC server when the plugin is not supported", async () => {
        (passkey_authenticator.register as jest.Mock).mockImplementation(() => {
          throw new Error(passkey_authenticator.NOT_SUPPORTED);
        });
        service.init();

        const started = await getSetEnabledHandler()(null, true);

        expect(started).toBe(true);
        expect(AutofillIpcServer.listen).toHaveBeenCalledTimes(1);
      });

      it("reports failure when re-registration fails after the IPC server started", async () => {
        service.init();
        const handler = getSetEnabledHandler();
        await handler(null, true);
        (passkey_authenticator.register as jest.Mock).mockImplementation(() => {
          throw new Error("Passkey registration failed: boom");
        });

        const result = await handler(null, true);

        expect(result).toBe(false);
        expect(AutofillIpcServer.listen).toHaveBeenCalledTimes(1);
      });

      it("reports not running when plugin registration fails", async () => {
        (passkey_authenticator.register as jest.Mock).mockImplementation(() => {
          throw new Error("Passkey registration failed: boom");
        });
        service.init();

        const started = await getSetEnabledHandler()(null, true);

        expect(started).toBe(false);
        expect(AutofillIpcServer.listen).not.toHaveBeenCalled();
      });
    });

    it("reports the passkey provider state", async () => {
      const state = { registered: true, enabled: false };
      (passkey_authenticator.getState as jest.Mock).mockResolvedValue(state);
      service.init();
      const call = (ipcMain.handle as jest.Mock).mock.calls.find(
        ([channel]) => channel === AutofillIpcChannelControl.GetPasskeyProviderState,
      );

      await expect(call?.[1]()).resolves.toEqual(state);
    });

    it("reports not running when disabled before ever being enabled", async () => {
      service.init();

      const started = await getSetEnabledHandler()(null, false);

      expect(started).toBe(false);
      expect(AutofillIpcServer.listen).not.toHaveBeenCalled();
    });
  });

  describe("handleWindowHandleQuery", () => {
    it("completes with an error when an error is passed", async () => {
      const error = new Error("boom");

      await invokeWindowHandleQuery(error, 1, 2);

      expect(ipcServer.completeError).toHaveBeenCalledWith(1, 2, String(error));
      expect(ipcServer.completeWindowHandleQuery).not.toHaveBeenCalled();
    });

    it("completes with an error when no window can be created", async () => {
      windowMain.win = undefined as unknown as BrowserWindow;

      await invokeWindowHandleQuery(null, 1, 2);

      expect(ipcServer.completeError).toHaveBeenCalledWith(1, 2, "No window available");
      expect(ipcServer.completeWindowHandleQuery).not.toHaveBeenCalled();
    });

    it("recreates a destroyed window hidden before answering", async () => {
      const win = mock<BrowserWindow>();
      win.isVisible.mockReturnValue(false);
      win.isFocused.mockReturnValue(false);
      win.getNativeWindowHandle.mockReturnValue(Buffer.from([4]));
      windowMain.win = undefined as unknown as BrowserWindow;
      windowMain.ensureRenderer.mockImplementation(async () => {
        windowMain.win = win;
      });

      await invokeWindowHandleQuery(null, 1, 2);

      expect(windowMain.ensureRenderer).toHaveBeenCalledWith(RendererVisibility.Hidden);
      expect(ipcServer.completeWindowHandleQuery).toHaveBeenCalledWith(1, 2, {
        isVisible: false,
        isFocused: false,
        handle: [4],
      });
    });

    it("completes with the window handle response when window exists", async () => {
      const win = mock<BrowserWindow>();
      win.isVisible.mockReturnValue(true);
      win.isFocused.mockReturnValue(false);
      win.getNativeWindowHandle.mockReturnValue(Buffer.from([1, 2, 3]));
      windowMain.win = win;

      await invokeWindowHandleQuery(null, 1, 2);

      expect(ipcServer.completeWindowHandleQuery).toHaveBeenCalledWith(1, 2, {
        isVisible: true,
        isFocused: false,
        handle: [1, 2, 3],
      });
      expect(ipcServer.completeError).not.toHaveBeenCalled();
    });
  });

  describe("requests while the renderer is destroyed", () => {
    const channel = AutofillIpcChannelIncoming.PasskeyAssertion;
    const send = (data: unknown) => (service as any).safeSend(channel, data);

    const rendererWith = (id: number) => {
      const win = mock<BrowserWindow>();
      win.isDestroyed.mockReturnValue(false);
      Object.assign(win, { webContents: { id, send: jest.fn() } });
      return win;
    };

    // ListenerReady is registered when native autofill is enabled.
    const announceReady = async (id: number) => {
      (AutofillIpcServer.listen as jest.Mock).mockResolvedValue(ipcServer);
      (service as any).ipcServer = undefined;
      await (service as any).enable();
      const call = (ipcMain.on as jest.Mock).mock.calls.find(
        ([name]) => name === AutofillIpcChannelControl.ListenerReady,
      );
      call[1]({ sender: { id } });
    };

    it("buffers the request and recreates the renderer hidden", () => {
      windowMain.win = undefined as unknown as BrowserWindow;

      send({ clientId: 1 });

      expect(windowMain.ensureRenderer).toHaveBeenCalledWith(RendererVisibility.Hidden);
      expect((service as any).messageBuffer).toHaveLength(1);
    });

    it("does not send to a renderer that has not announced its listeners", async () => {
      await announceReady(1);
      const recreated = rendererWith(2);
      windowMain.win = recreated;

      send({ clientId: 1 });

      expect(recreated.webContents.send).not.toHaveBeenCalled();
      expect(windowMain.ensureRenderer).not.toHaveBeenCalled();
    });

    it("delivers buffered requests once the recreated renderer is ready", async () => {
      windowMain.win = undefined as unknown as BrowserWindow;
      send({ clientId: 1 });
      const recreated = rendererWith(2);
      windowMain.win = recreated;

      await announceReady(2);

      expect(recreated.webContents.send).toHaveBeenCalledWith(channel, { clientId: 1 });
      expect((service as any).messageBuffer).toHaveLength(0);
    });
  });
});
