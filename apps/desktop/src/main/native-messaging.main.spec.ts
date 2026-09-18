import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcPeerClientType } from "@bitwarden/common/platform/ipc";
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
  let emit: (error: unknown, message: ipc.IpcMessage) => void;

  /** Delivers a native message from `clientId`, as the napi server would. */
  function receive(message: object): void {
    emit(null, {
      kind: ipc.IpcMessageType.Message,
      clientId,
      message: JSON.stringify(message),
    } as ipc.IpcMessage);
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    jest.mocked(ipc.NativeIpcServer.listen).mockImplementation((_name, callback) => {
      emit = callback as typeof emit;
      return Promise.resolve(mock<ipc.NativeIpcServer>({ getPaths: () => [] }));
    });

    sut = new NativeMessagingMain(mock<LogService>(), mock<WindowMain>(), "userPath", "exe", "app");
    await sut.listen();
  });

  it("reports no client type for a client that never announced one", () => {
    expect(sut.clientTypeFor(clientId)).toBeUndefined();
  });

  it("records an announced client type", () => {
    receive({ type: "bitwarden-ipc-client-type", clientType: IpcPeerClientType.Cli });

    expect(sut.clientTypeFor(clientId)).toBe(IpcPeerClientType.Cli);
  });

  it("does not relay the announcement as application traffic", () => {
    const relayed = jest.fn();
    sut.messages$.subscribe(relayed);

    receive({ type: "bitwarden-ipc-client-type", clientType: IpcPeerClientType.Cli });

    expect(relayed).not.toHaveBeenCalled();
  });

  it("relays other messages", () => {
    const relayed = jest.fn();
    sut.messages$.subscribe(relayed);

    receive({ type: "bitwarden-ipc-message" });

    expect(relayed).toHaveBeenCalled();
  });

  it("forgets the client type once the client disconnects, so a reused id is not stale", () => {
    receive({ type: "bitwarden-ipc-client-type", clientType: IpcPeerClientType.Cli });

    emit(null, { kind: ipc.IpcMessageType.Disconnected, clientId } as ipc.IpcMessage);

    expect(sut.clientTypeFor(clientId)).toBeUndefined();
  });
});
