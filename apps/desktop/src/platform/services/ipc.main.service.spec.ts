import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { NativeMessagingMain } from "../../main/native-messaging.main";
import { WindowMain } from "../../main/window.main";

import { IpcMainService } from "./ipc.main.service";

/** The `send` the service hands to the SDK's communication backend. */
let backendSend: (message: OutgoingMessage) => Promise<void>;
/** The `receive` the SDK backend exposes, capturing messages delivered to the main client. */
let backendReceive: (message: unknown) => void;

jest.mock("electron", () => ({ ipcMain: { on: jest.fn() } }));

jest.mock("@bitwarden/sdk-internal", () => ({
  IpcCommunicationBackend: jest.fn().mockImplementation((sender) => {
    backendSend = sender.send;
    return {
      receive: (message: unknown) => backendReceive?.(message),
    };
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
  let messages$: Subject<unknown>;
  const webContentsSend = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    backendReceive = jest.fn();
    jest.spyOn(IpcService.prototype as any, "initWithClient").mockResolvedValue(undefined);
    messages$ = new Subject<unknown>();
    // jest-mock-extended would deep-mock the `messages$` override, so use a plain object with the
    // real Subject so the service's subscription actually registers.
    nativeMessaging = {
      messages$,
      sendTo: jest.fn(),
      clientTypeFor: jest.fn(),
    } as unknown as NativeMessagingMain;

    const windowMain = {
      win: { isDestroyed: () => false, webContents: { send: webContentsSend } },
    } as unknown as WindowMain;
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

    // Native clients key their session by the endpoint they addressed, so main answers as the
    // renderer, whose endpoint they use.
    expect(nativeMessaging.sendTo).toHaveBeenCalledWith(1, {
      type: "forwarded-bitwarden-ipc-message",
      message: { destination, payload: [1], topic: "topic" },
      originalSource: "DesktopRenderer",
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

  function sendNativeMessage(destination: unknown): void {
    messages$.next({
      clientId: 1,
      message: JSON.stringify({
        type: "bitwarden-ipc-message",
        message: { destination, payload: [1], topic: "topic" },
      }),
    });
  }

  it.each(["DesktopRenderer", "DesktopMain"])(
    "delivers %s-bound messages to the main client as DesktopMain",
    (destination) => {
      sendNativeMessage(destination);

      expect(backendReceive).toHaveBeenCalledTimes(1);
      expect(IncomingMessage).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        "DesktopMain",
        { BrowserBackground: { id: { Id: 1 } } },
        "topic",
      );
      expect(webContentsSend).not.toHaveBeenCalled();
    },
  );

  it("answers a client that addressed DesktopMain under that name", async () => {
    sendNativeMessage("DesktopMain");

    await sendTo({ BrowserBackground: { id: { Id: 1 } } });

    expect(nativeMessaging.sendTo).toHaveBeenCalledWith(1, {
      type: "forwarded-bitwarden-ipc-message",
      message: {
        destination: { BrowserBackground: { id: { Id: 1 } } },
        payload: [1],
        topic: "topic",
      },
      originalSource: "DesktopMain",
    });
  });

  it("drops messages for other destinations", () => {
    sendNativeMessage({ Web: { tab_id: 1, document_id: "doc" } });

    expect(backendReceive).not.toHaveBeenCalled();
    expect(webContentsSend).not.toHaveBeenCalled();
  });
});
