import { ipcMain } from "electron";
import { mock, MockProxy } from "jest-mock-extended";
import { of, Subject } from "rxjs";

import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";

import { DDGEphemeralPrivateKey } from "..";
import { DesktopAutofillSettingsService } from "../../autofill/services/desktop-autofill-settings.service";
import { NativeMessagingMain } from "../../main/native-messaging.main";
import { WindowMain } from "../../main/window.main";
import { DDG_IPC_CHANNELS } from "../../models/native-messaging/ddg-ipc-channels";

import { EncryptedMessageHandlerService } from "./encrypted-message-handler.service";
import { MainDuckDuckGoService } from "./main-duckduckgo.service";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  ipc: { IpcMessageType: { Connected: 0, Disconnected: 1, Message: 2 } },
}));

jest.mock("@bitwarden/sdk-internal", () => ({
  SdkRandomNumberClient: jest.fn(() => ({ gen_bytes: (len: number) => new Uint8Array(len) })),
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: { Ready: Promise.resolve() },
}));

type IpcHandler = (...args: unknown[]) => unknown;

/** Flush pending microtasks so async chains settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

describe("MainDuckDuckGoService", () => {
  // A real ephemeral public key: the handshake now rejects one it cannot parse, and 2048-bit
  // keygen is slow enough to be worth doing once.
  let publicKey: string;

  beforeAll(() => {
    publicKey = DDGEphemeralPrivateKey.generatePair().publicKey.toBase64Spki();
  });

  let secureStorageService: MockProxy<AbstractStorageService>;
  let desktopAutofillSettingsService: MockProxy<DesktopAutofillSettingsService>;
  let encryptedMessageHandlerService: MockProxy<EncryptedMessageHandlerService>;
  let nativeMessagingMain: MockProxy<NativeMessagingMain>;
  let windowMain: MockProxy<WindowMain>;
  let messagingService: MockProxy<MessageSender>;
  let messages$: Subject<{ clientId: number; kind: number; message?: string }>;
  let verifyResponseHandler: IpcHandler;

  let sut: MainDuckDuckGoService;

  const sendMessage = async (message: Record<string, unknown>) => {
    messages$.next({ clientId: 1, kind: 2, message: JSON.stringify(message) });
    await flush();
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    secureStorageService = mock<AbstractStorageService>();
    desktopAutofillSettingsService = mock<DesktopAutofillSettingsService>();
    (
      desktopAutofillSettingsService as { enableDuckDuckGoBrowserIntegration$: unknown }
    ).enableDuckDuckGoBrowserIntegration$ = of(true);
    encryptedMessageHandlerService = mock<EncryptedMessageHandlerService>();
    messages$ = new Subject();
    nativeMessagingMain = mock<NativeMessagingMain>();
    (nativeMessagingMain as { messages$: unknown }).messages$ = messages$.asObservable();
    windowMain = mock<WindowMain>();
    messagingService = mock<MessageSender>();

    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: IpcHandler) => {
      if (channel === DDG_IPC_CHANNELS.VERIFY_REQUEST_RESPONSE) {
        verifyResponseHandler = handler;
      }
    });

    sut = new MainDuckDuckGoService(
      true,
      mock(),
      secureStorageService,
      desktopAutofillSettingsService,
      encryptedMessageHandlerService,
      nativeMessagingMain,
      windowMain,
      messagingService,
    );
    await sut.init();
  });

  afterEach(() => {
    sut.dispose();
  });

  it("ignores messages without the DuckDuckGo version marker", async () => {
    await sendMessage({ command: "something-else" });

    expect(windowMain.ensureRenderer).not.toHaveBeenCalled();
    expect(nativeMessagingMain.send).not.toHaveBeenCalled();
  });

  it("rejects a handshake with a mismatched protocol version", async () => {
    await sendMessage({ version: 999, messageId: "1", command: "bw-handshake", payload: {} });

    expect(nativeMessagingMain.send).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { error: "version-discrepancy" } }),
    );
  });

  it("completes the handshake once the renderer's verify dialog is accepted", async () => {
    await sendMessage({
      version: 1,
      messageId: "1",
      command: "bw-handshake",
      payload: { publicKey, applicationName: "DDG" },
    });
    await flush();

    expect(windowMain.ensureRenderer).toHaveBeenCalled();
    expect(messagingService.send).toHaveBeenCalledWith(
      DDG_IPC_CHANNELS.VERIFY_REQUEST,
      expect.objectContaining({ applicationName: "DDG" }),
    );

    const [, { requestId }] = messagingService.send.mock.calls[0];
    await verifyResponseHandler(undefined, { requestId, accepted: true });
    await flush();

    expect(secureStorageService.save).toHaveBeenCalledWith(
      "DuckDuckGoSharedKey",
      expect.any(String),
    );
    expect(nativeMessagingMain.send).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ status: "success" }) }),
    );
  });

  it("cancels the handshake when the verify dialog is declined", async () => {
    await sendMessage({
      version: 1,
      messageId: "1",
      command: "bw-handshake",
      payload: { publicKey, applicationName: "DDG" },
    });
    await flush();

    const [, { requestId }] = messagingService.send.mock.calls[0];
    await verifyResponseHandler(undefined, { requestId, accepted: false });
    await flush();

    expect(secureStorageService.save).not.toHaveBeenCalled();
    expect(nativeMessagingMain.send).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { error: "canceled" } }),
    );
  });

  it("rejects a handshake with no public key", async () => {
    await sendMessage({
      version: 1,
      messageId: "1",
      command: "bw-handshake",
      payload: { applicationName: "DDG" },
    });

    expect(nativeMessagingMain.send).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { error: "cannot-decrypt" } }),
    );
    expect(windowMain.ensureRenderer).not.toHaveBeenCalled();
  });

  it("refuses a handshake while the DuckDuckGo integration is switched off", async () => {
    (
      desktopAutofillSettingsService as { enableDuckDuckGoBrowserIntegration$: unknown }
    ).enableDuckDuckGoBrowserIntegration$ = of(false);

    await sendMessage({
      version: 1,
      command: "bw-handshake",
      messageId: "1",
      payload: { publicKey, applicationName: "DDG" },
    });

    expect(nativeMessagingMain.send).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { error: "canceled" } }),
    );
    // The user is never shown anything for an integration they turned off.
    expect(windowMain.ensureRenderer).not.toHaveBeenCalled();
    expect(messagingService.send).not.toHaveBeenCalled();
  });

  it("waits for the renderer to exist before asking it to verify", async () => {
    // The renderer was destroyed, so main must bring it back before the dialog request is sent.
    // ElectronMainMessagingService.send drops the message when win is null.
    (windowMain as { win: unknown }).win = null;
    let createRenderer: () => void;
    const rendererCreated = new Promise<void>((resolve) => {
      createRenderer = () => {
        (windowMain as { win: unknown }).win = { webContents: { send: jest.fn() } };
        resolve();
      };
    });
    windowMain.ensureRenderer.mockImplementation(() => rendererCreated);

    let winAtSend: unknown = "not called";
    (messagingService.send as jest.Mock).mockImplementation(() => {
      winAtSend = (windowMain as { win: unknown }).win;
    });

    void sendMessage({
      version: 1,
      command: "bw-handshake",
      messageId: "1",
      payload: { publicKey, applicationName: "DDG" },
    });
    await flush();
    createRenderer!();
    await flush();

    expect(winAtSend).not.toBeNull();
  });

  describe("while the renderer owns the protocol", () => {
    beforeEach(async () => {
      // The enabled instance from the outer setup is still subscribed; drop it so only the
      // disabled one sees the message.
      sut.dispose();
      jest.clearAllMocks();
      sut = new MainDuckDuckGoService(
        false,
        mock(),
        secureStorageService,
        desktopAutofillSettingsService,
        encryptedMessageHandlerService,
        nativeMessagingMain,
        windowMain,
        messagingService,
      );
      await sut.init();
    });

    it("answers nothing, leaving the message to the renderer", async () => {
      await sendMessage({
        version: 1,
        command: "bw-handshake",
        payload: { applicationName: "DDG" },
      });

      expect(nativeMessagingMain.send).not.toHaveBeenCalled();
      expect(windowMain.ensureRenderer).not.toHaveBeenCalled();
    });
  });
});
