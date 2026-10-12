import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DesktopIpcPeerClientType } from "@bitwarden/common/platform/ipc";
import { ipc } from "@bitwarden/desktop-napi";

import { NativeMessagingMain } from "./native-messaging.main";
import { WindowMain } from "./window.main";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
}));

// native-messaging.main.ts loads a native .node module at import time.
jest.mock("@bitwarden/desktop-napi", () => ({
  ipc: {
    NativeIpcServer: { listen: jest.fn() },
    IpcMessageType: { Connected: 0, Disconnected: 1, Message: 2 },
  },
  windows_registry: {},
}));

describe("NativeMessagingMain", () => {
  const clientId = 7;

  let sut: NativeMessagingMain;
  let logService: MockProxy<LogService>;
  let emit: (error: unknown, message: ipc.IpcMessage) => void;

  /** Delivers a native message from `clientId`, as the napi server would. */
  function receive(message: object): void {
    emit(null, {
      kind: ipc.IpcMessageType.Message,
      clientId,
      message: JSON.stringify(message),
    } as ipc.IpcMessage);
  }

  /** Connects `clientId`, carrying `announcement` as the napi server would. */
  function connect(announcement?: object): void {
    emit(null, {
      kind: ipc.IpcMessageType.Connected,
      clientId,
      message: announcement == null ? undefined : JSON.stringify(announcement),
    } as ipc.IpcMessage);
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    jest.mocked(ipc.NativeIpcServer.listen).mockImplementation((_name, callback) => {
      emit = callback as typeof emit;
      return Promise.resolve(mock<ipc.NativeIpcServer>({ getPaths: () => [] }));
    });

    logService = mock<LogService>();
    sut = new NativeMessagingMain(logService, mock<WindowMain>(), "userPath", "exe", "app");
    await sut.listen();
  });

  it("reports no client type for a client that is not connected", () => {
    expect(sut.clientTypeFor(clientId)).toBeUndefined();
  });

  it("reports an unknown client type for a client that never announced one", () => {
    connect();

    expect(sut.clientTypeFor(clientId)).toBe(DesktopIpcPeerClientType.Unknown);
  });

  it("records an announced client type", () => {
    connect({ clientType: DesktopIpcPeerClientType.Cli });

    expect(sut.clientTypeFor(clientId)).toBe(DesktopIpcPeerClientType.Cli);
  });

  it("reports an unknown client type for a malformed announcement", () => {
    emit(null, {
      kind: ipc.IpcMessageType.Connected,
      clientId,
      message: "not json",
    } as ipc.IpcMessage);

    expect(sut.clientTypeFor(clientId)).toBe(DesktopIpcPeerClientType.Unknown);
  });

  it("logs the announced client details", () => {
    connect({
      clientType: DesktopIpcPeerClientType.Firefox,
      extensionId: "{id}",
      unexpected: "not logged",
    });

    expect(logService.info).toHaveBeenCalledWith(
      `Native messaging client ${clientId} has connected as firefox`,
      { extensionId: "{id}" },
    );
  });

  it("relays other messages", () => {
    const relayed = jest.fn();
    sut.messages$.subscribe(relayed);

    receive({ type: "bitwarden-ipc-message" });

    expect(relayed).toHaveBeenCalled();
  });

  it("forgets the client type once the client disconnects, so a reused id is not stale", () => {
    connect({ clientType: DesktopIpcPeerClientType.Cli });

    emit(null, { kind: ipc.IpcMessageType.Disconnected, clientId } as ipc.IpcMessage);

    expect(sut.clientTypeFor(clientId)).toBeUndefined();
  });
});
