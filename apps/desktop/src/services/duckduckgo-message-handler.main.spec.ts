import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { NativeMessagingVersion } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CsprngArray } from "@bitwarden/common/types/csprng";

import { DesktopAutofillSettingsService } from "../autofill/services/desktop-autofill-settings.service";
import { NativeMessagingMain } from "../main/native-messaging.main";
import { RendererUiRequestService } from "../platform/main/renderer-ui-request.service";

import { DuckDuckGoMessageHandlerMain } from "./duckduckgo-message-handler.main";

jest.mock("@bitwarden/sdk-internal", () => ({
  PureCrypto: {
    make_aes256_cbc_hmac_key: jest.fn(() => Utils.fromBufferToB64(new Uint8Array(64))),
  },
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: { Ready: Promise.resolve() },
}));

const CLIENT_ID = 1;

describe("DuckDuckGoMessageHandlerMain", () => {
  let encryptService: MockProxy<EncryptService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let messagingService: MockProxy<MessagingService>;
  let desktopAutofillSettingsService: MockProxy<DesktopAutofillSettingsService>;
  let nativeMessagingMain: MockProxy<NativeMessagingMain>;
  let rendererUiRequestService: MockProxy<RendererUiRequestService>;
  let handler: DuckDuckGoMessageHandlerMain;

  const handshake = () => ({
    version: NativeMessagingVersion.Latest,
    messageId: 1,
    command: "bw-handshake" as const,
    payload: { publicKey: Utils.fromUtf8ToB64("pk"), applicationName: "DuckDuckGo" },
  });

  beforeEach(() => {
    encryptService = mock<EncryptService>();
    cryptoFunctionService = mock<CryptoFunctionService>();
    messagingService = mock<MessagingService>();
    desktopAutofillSettingsService = mock<DesktopAutofillSettingsService>();
    nativeMessagingMain = mock<NativeMessagingMain>();
    rendererUiRequestService = mock<RendererUiRequestService>();

    (desktopAutofillSettingsService as any).enableDuckDuckGoBrowserIntegration$ = of(true);
    cryptoFunctionService.rsaEncrypt.mockResolvedValue(
      Utils.fromUtf8ToArray("encrypted") as CsprngArray,
    );

    handler = new DuckDuckGoMessageHandlerMain(
      encryptService,
      cryptoFunctionService,
      messagingService,
      desktopAutofillSettingsService,
      nativeMessagingMain,
      rendererUiRequestService,
      mock<LogService>(),
    );
  });

  it("rejects a version mismatch", async () => {
    await handler.handleMessage({ version: 999 as any, messageId: 2 } as any, CLIENT_ID);

    expect(nativeMessagingMain.sendTo).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({ payload: { error: "version-discrepancy" } }),
    );
  });

  it("cancels the handshake when the integration is disabled", async () => {
    (desktopAutofillSettingsService as any).enableDuckDuckGoBrowserIntegration$ = of(false);

    await handler.handleMessage(handshake() as any, CLIENT_ID);

    expect(nativeMessagingMain.sendTo).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({ payload: { error: "canceled" } }),
    );
  });

  it("cancels the handshake when the user rejects the verification dialog", async () => {
    rendererUiRequestService.request.mockResolvedValue(false as never);

    await handler.handleMessage(handshake() as any, CLIENT_ID);

    expect(nativeMessagingMain.sendTo).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({ payload: { error: "canceled" } }),
    );
  });

  it("establishes a shared key when the user verifies the handshake", async () => {
    rendererUiRequestService.request.mockResolvedValue(true as never);

    await handler.handleMessage(handshake() as any, CLIENT_ID);

    expect(cryptoFunctionService.rsaEncrypt).toHaveBeenCalled();
    expect(nativeMessagingMain.sendTo).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({
        payload: expect.objectContaining({ status: "success" }),
      }),
    );
  });

  it("rejects an encrypted command before a handshake has established a shared key", async () => {
    await handler.handleMessage(
      {
        version: NativeMessagingVersion.Latest,
        messageId: 5,
        encryptedCommand: "bw-something",
      } as any,
      CLIENT_ID,
    );

    expect(nativeMessagingMain.sendTo).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({ payload: { error: "cannot-decrypt" } }),
    );
  });
});
