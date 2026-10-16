import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";

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

// Dev mode would scan browser profiles for extension ids.
jest.mock("../utils", () => ({ ...jest.requireActual("../utils"), isDev: () => false }));

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

  describe("generateManifests on linux", () => {
    const manifestName = "com.8bit.bitwarden.json";
    const platform = process.platform;

    let home: string;

    beforeEach(() => {
      home = mkdtempSync(path.join(tmpdir(), "nmh-"));
      Object.defineProperty(process, "platform", { value: "linux" });
      jest.spyOn(sut as any, "homedir").mockReturnValue(home);

      // Stand-in for the desktop_proxy binary the manifests point to.
      const binary = path.join(home, "desktop_proxy");
      writeFileSync(binary, "");
      jest.spyOn(sut as any, "binaryPath").mockReturnValue(binary);
    });

    afterEach(() => {
      Object.defineProperty(process, "platform", { value: platform });
      rmSync(home, { recursive: true, force: true });
    });

    it("writes the firefox manifest when only the XDG profile dir exists", async () => {
      mkdirSync(path.join(home, ".config", "mozilla"), { recursive: true });

      await sut.generateManifests();

      const nmhs = path.join(home, ".mozilla", "native-messaging-hosts");
      expect(existsSync(path.join(nmhs, manifestName))).toBe(true);
    });

    it("writes the flatpak firefox manifest when only the app dir exists", async () => {
      const app = path.join(home, ".var", "app", "org.mozilla.firefox");
      mkdirSync(app, { recursive: true });

      await sut.generateManifests();

      const nmhs = path.join(app, ".mozilla", "native-messaging-hosts");
      expect(existsSync(path.join(nmhs, manifestName))).toBe(true);
    });

    // Chromium-based browsers don't always ship a NativeMessagingHosts dir.
    it("writes the chromium manifest when the NativeMessagingHosts dir is missing", async () => {
      mkdirSync(path.join(home, ".config", "chromium"), { recursive: true });

      await sut.generateManifests();

      const nmhs = path.join(home, ".config", "chromium", "NativeMessagingHosts");
      expect(existsSync(path.join(nmhs, manifestName))).toBe(true);
    });

    it("skips firefox when no profile dir exists", async () => {
      await sut.generateManifests();

      expect(existsSync(path.join(home, ".mozilla"))).toBe(false);
      expect(existsSync(path.join(home, ".var"))).toBe(false);
    });
  });
});
