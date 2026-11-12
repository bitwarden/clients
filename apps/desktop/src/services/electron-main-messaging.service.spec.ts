import { ipcMain, Notification } from "electron";
import { mock } from "jest-mock-extended";

import { WindowMain } from "../main/window.main";
import { SafeShell } from "../platform/main/safe-shell.main";

import { ElectronMainMessagingService } from "./electron-main-messaging.service";

type Listener = () => void;

const notifications: FakeNotification[] = [];
let supported = true;

class FakeNotification {
  static isSupported = jest.fn(() => supported);
  listeners: Record<string, Listener> = {};
  show = jest.fn();
  constructor(public options: { title: string; body: string }) {
    notifications.push(this);
  }
  addListener(event: string, listener: Listener) {
    this.listeners[event] = listener;
  }
}

jest.mock("electron", () => ({
  app: { getVersion: jest.fn() },
  dialog: {},
  ipcMain: { handle: jest.fn() },
  nativeTheme: { on: jest.fn() },
  Notification: jest.fn(),
}));

const ROUTE = "/pam/requests/0b9f1c7e-2d3a-4c5b-8e6f-1a2b3c4d5e6f";

describe("ElectronMainMessagingService showNotification", () => {
  let windowMain: ReturnType<typeof mock<WindowMain>>;
  let win: { isMinimized: jest.Mock; restore: jest.Mock; show: jest.Mock; focus: jest.Mock };
  let send: jest.Mock;
  let show: (options: unknown) => unknown;

  beforeEach(() => {
    notifications.length = 0;
    supported = true;
    (Notification as unknown as jest.Mock).mockImplementation(
      (options: { title: string; body: string }) => new FakeNotification(options),
    );
    (Notification as unknown as { isSupported: jest.Mock }).isSupported =
      FakeNotification.isSupported;

    send = jest.fn();
    win = {
      isMinimized: jest.fn().mockReturnValue(false),
      restore: jest.fn(),
      show: jest.fn(),
      focus: jest.fn(),
    };
    windowMain = mock<WindowMain>();
    windowMain.withWindow.mockImplementation(((fn: (w: unknown) => unknown) => fn(win)) as any);
    Object.defineProperty(windowMain, "win", { value: { webContents: { send } } });

    (ipcMain.handle as jest.Mock).mockClear();
    new ElectronMainMessagingService(windowMain, mock<SafeShell>());
    const call = (ipcMain.handle as jest.Mock).mock.calls.find((c) => c[0] === "showNotification");
    show = (options) => call[1]({}, options);
  });

  it("shows nothing when notifications are unsupported", () => {
    supported = false;

    expect(show({ title: "t", body: "b", route: ROUTE })).toBe(false);
    expect(notifications).toHaveLength(0);
  });

  it.each(["/vault", "/pam/approvals?x=1", "https://evil.example", 5])(
    "rejects the route %p without showing",
    (route) => {
      expect(show({ title: "t", body: "b", route })).toBe(false);
      expect(notifications).toHaveLength(0);
    },
  );

  it("rejects a malformed payload", () => {
    expect(show({ title: 1, body: "b" })).toBe(false);
    expect(show(undefined)).toBe(false);
    expect(notifications).toHaveLength(0);
  });

  it("shows a notification with no route that only focuses the window", () => {
    expect(show({ title: "t", body: "b" })).toBe(true);
    expect(notifications[0].show).toHaveBeenCalled();

    notifications[0].listeners["click"]();

    expect(win.show).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("focuses the window and sends the route to the renderer on click", () => {
    expect(show({ title: "t", body: "b", route: ROUTE })).toBe(true);
    expect(notifications[0].options).toEqual(expect.objectContaining({ title: "t", body: "b" }));
    expect(send).not.toHaveBeenCalled();

    notifications[0].listeners["click"]();

    expect(win.show).toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith("messagingService", {
      command: "navigateToRoute",
      route: ROUTE,
    });
  });

  it("restores a minimized window on click", () => {
    win.isMinimized.mockReturnValue(true);
    show({ title: "t", body: "b", route: ROUTE });

    notifications[0].listeners["click"]();

    expect(win.restore).toHaveBeenCalled();
  });
});
