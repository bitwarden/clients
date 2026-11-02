import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { OutgoingMessage } from "@bitwarden/sdk-internal";

import { NativeMessagingMain } from "../../main/native-messaging.main";
import { WindowMain } from "../../main/window.main";

import { IpcMainService } from "./ipc.main.service";

/** The `send` the service hands to the SDK's communication backend. */
let backendSend: (message: OutgoingMessage) => Promise<void>;

jest.mock("electron", () => ({ ipcMain: { on: jest.fn() } }));

jest.mock("@bitwarden/sdk-internal", () => ({
  IpcCommunicationBackend: jest.fn().mockImplementation((sender) => {
    backendSend = sender.send;
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
});
