import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DesktopIpcPeerClientType, IpcService } from "@bitwarden/common/platform/ipc";
import { BroadcastGroup, BroadcastResolution, OutgoingMessage } from "@bitwarden/sdk-internal";

import { NativeMessagingMain } from "../../main/native-messaging.main";
import { WindowMain } from "../../main/window.main";

import { IpcMainService } from "./ipc.main.service";

/** The `send` the service hands to the SDK's communication backend. */
let backendSend: (message: OutgoingMessage) => Promise<void>;
/** The `resolve` the service hands to the SDK's communication backend. */
let backendResolve: (group: BroadcastGroup) => Promise<BroadcastResolution>;

jest.mock("electron", () => ({ ipcMain: { on: jest.fn() } }));

jest.mock("@bitwarden/sdk-internal", () => ({
  IpcCommunicationBackend: jest.fn().mockImplementation((sender) => {
    backendSend = sender.send;
    backendResolve = sender.resolve;
    return {};
  }),
  IpcClient: { newWithSdkInMemorySessions: jest.fn() },
  ipcRegisterDiscoverHandler: jest.fn(),
  IncomingMessage: jest.fn(),
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: { Ready: Promise.resolve() },
}));

describe("IpcMainService", () => {
  let nativeMessaging: NativeMessagingMain;
  const webContentsSend = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(IpcService.prototype as any, "initWithClient").mockResolvedValue(undefined);
    nativeMessaging = mock<NativeMessagingMain>({ messages$: new Subject() });

    const windowMain = { win: { webContents: { send: webContentsSend } } } as unknown as WindowMain;
    const app = mock<Electron.App>();

    const sut = new IpcMainService(mock<LogService>(), app, nativeMessaging, windowMain);
    await sut.init();
  });

  function sendTo(destination: unknown): Promise<void> {
    return backendSend({
      destination,
      payload: new Uint8Array([1]),
      topic: "topic",
    } as OutgoingMessage);
  }

  it.each([
    ["a browser", { BrowserBackground: { id: { Id: 1 } } }],
    ["the CLI", { Cli: { id: { Id: 1 } } }],
  ])("sends messages for %s over native messaging", async (_, destination) => {
    await sendTo(destination);

    expect(nativeMessaging.sendTo).toHaveBeenCalledWith(1, {
      type: "bitwarden-ipc-message",
      message: { destination, payload: [1], topic: "topic" },
    });
  });

  it("sends messages for the renderer to the window", async () => {
    await sendTo("DesktopRenderer");

    expect(webContentsSend).toHaveBeenCalledWith("ipc.onMessage", {
      type: "bitwarden-ipc-message",
      message: { destination: "DesktopRenderer", payload: [1], topic: "topic" },
    });
  });

  it("rejects a destination it cannot route instead of dropping it", async () => {
    await expect(sendTo({ Web: { id: 1 } })).rejects.toThrow("Destination not supported");
    expect(nativeMessaging.sendTo).not.toHaveBeenCalled();
    expect(webContentsSend).not.toHaveBeenCalled();
  });

  describe("resolving broadcast groups", () => {
    let clients: Map<number, DesktopIpcPeerClientType>;

    beforeEach(() => {
      clients = new Map();
      jest.mocked(nativeMessaging.connectedClientIds).mockImplementation(() => [...clients.keys()]);
      jest
        .mocked(nativeMessaging.clientTypeFor)
        .mockImplementation((clientId) => clients.get(clientId));
    });

    it("resolves the browser background group to every connected browser", async () => {
      clients.set(1, DesktopIpcPeerClientType.Chrome);
      clients.set(2, DesktopIpcPeerClientType.Firefox);
      clients.set(3, DesktopIpcPeerClientType.Unknown);

      await expect(backendResolve("AllBrowserBackground")).resolves.toEqual({
        Endpoints: [
          { BrowserBackground: { id: { Id: 1 } } },
          { BrowserBackground: { id: { Id: 2 } } },
          { BrowserBackground: { id: { Id: 3 } } },
        ],
      });
    });

    it("leaves the CLI out of the browser background group", async () => {
      clients.set(1, DesktopIpcPeerClientType.Cli);
      clients.set(2, DesktopIpcPeerClientType.Chrome);

      await expect(backendResolve("AllBrowserBackground")).resolves.toEqual({
        Endpoints: [{ BrowserBackground: { id: { Id: 2 } } }],
      });
    });

    it("stops resolving a browser once it disconnects", async () => {
      clients.set(1, DesktopIpcPeerClientType.Chrome);
      clients.set(2, DesktopIpcPeerClientType.Chrome);

      clients.delete(1);

      await expect(backendResolve("AllBrowserBackground")).resolves.toEqual({
        Endpoints: [{ BrowserBackground: { id: { Id: 2 } } }],
      });
    });

    it("does not support the browser foreground group", async () => {
      clients.set(1, DesktopIpcPeerClientType.Chrome);

      await expect(backendResolve("AllBrowserForeground")).resolves.toBe("Unsupported");
    });
  });
});
