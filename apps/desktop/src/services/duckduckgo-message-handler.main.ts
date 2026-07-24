import { firstValueFrom, Subject, takeUntil } from "rxjs";

import { NativeMessagingVersion } from "@bitwarden/common/enums";
import { DANGEROUS_aesDecryptDuckDuckGoNoPaddingAes256CbcHmac } from "@bitwarden/common/key-management/crypto";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { DuckDuckGoEncstring } from "@bitwarden/common/key-management/crypto/dangerous/dangerous_duckduckgo_crypto";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { isForwardedIpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { ipc } from "@bitwarden/desktop-napi";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { DesktopAutofillSettingsService } from "../autofill/services/desktop-autofill-settings.service";
import { NativeMessagingMain } from "../main/native-messaging.main";
import { DecryptedCommandData } from "../models/native-messaging/decrypted-command-data";
import { DDG_IPC_CHANNELS } from "../models/native-messaging/duckduckgo-ipc-channels";
import { EncryptedMessage } from "../models/native-messaging/encrypted-message";
import { EncryptedMessageResponse } from "../models/native-messaging/encrypted-message-response";
import { MessageResponseData } from "../models/native-messaging/encrypted-message-responses/message-response-data";
import { Message } from "../models/native-messaging/message";
import { UnencryptedMessage } from "../models/native-messaging/unencrypted-message";
import { UnencryptedMessageResponse } from "../models/native-messaging/unencrypted-message-response";
import { RendererUiRequestService } from "../platform/main/renderer-ui-request.service";

const HashAlgorithmForAsymmetricEncryption = "sha1";

/**
 * Main-process handler for the DuckDuckGo browser-integration protocol (macOS only).
 *
 * Counterpart to the renderer `DuckDuckGoMessageHandlerService`. It consumes
 * {@link NativeMessagingMain.messages$} and replies via {@link NativeMessagingMain.sendTo}, keeping
 * the protocol + crypto (RSA handshake, AES session, the DuckDuckGo no-padding decrypt) in main.
 *
 * Two renderer-only concerns are delegated over {@link RendererUiRequestService}: the
 * `VerifyNativeMessagingDialogComponent` confirmation, and command execution (which needs vault
 * services), which is run by the renderer's `EncryptedMessageHandlerService`.
 *
 * ⚠️ Gated on `FeatureFlag.MainProcessSshAgent`'s sibling `MainProcessDuckDuckGo` flag and NOT wired
 * until reviewed. Relocating the DuckDuckGo custom decrypt requires key-management review. The
 * shared session key is held in memory (a fresh handshake occurs after restart) — persisting it is
 * a follow-up.
 */
export class DuckDuckGoMessageHandlerMain {
  private duckduckgoSharedSecret?: SymmetricCryptoKey;
  private destroy$ = new Subject<void>();

  constructor(
    private encryptService: EncryptService,
    private cryptoFunctionService: CryptoFunctionService,
    private messagingService: MessagingService,
    private desktopAutofillSettingsService: DesktopAutofillSettingsService,
    private nativeMessagingMain: NativeMessagingMain,
    private rendererUiRequestService: RendererUiRequestService,
    private logService: LogService,
  ) {}

  init() {
    this.nativeMessagingMain.messages$.pipe(takeUntil(this.destroy$)).subscribe((rawMessage) => {
      void this.dispatch(rawMessage).catch((e) =>
        this.logService.error("[DuckDuckGo IPC] Error handling message", e),
      );
    });
  }

  private async dispatch(rawMessage: ipc.IpcMessage) {
    if (rawMessage.message == null) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawMessage.message);
    } catch {
      return;
    }
    // Only the versioned DuckDuckGo protocol is handled here (SDK + legacy biometric elsewhere).
    if (isIpcMessage(parsed) || isForwardedIpcMessage(parsed)) {
      return;
    }
    if (!(parsed as Message).version) {
      return;
    }
    await this.handleMessage(parsed as Message, rawMessage.clientId);
  }

  async handleMessage(message: Message, clientId: number) {
    const decryptedCommand = message as UnencryptedMessage;
    if (message.version != NativeMessagingVersion.Latest) {
      this.sendResponse(
        {
          messageId: message.messageId,
          version: NativeMessagingVersion.Latest,
          payload: { error: "version-discrepancy" },
        },
        clientId,
      );
      return;
    }

    if (decryptedCommand.command === "bw-handshake") {
      await this.handleDecryptedMessage(decryptedCommand, clientId);
    } else {
      await this.handleEncryptedMessage(message as EncryptedMessage, clientId);
    }
  }

  private async handleDecryptedMessage(message: UnencryptedMessage, clientId: number) {
    const { messageId, payload } = message;
    const { publicKey, applicationName } = payload;
    if (!publicKey) {
      this.sendResponse(
        { messageId, version: NativeMessagingVersion.Latest, payload: { error: "cannot-decrypt" } },
        clientId,
      );
      return;
    }

    try {
      const remotePublicKey = Utils.fromB64ToArray(publicKey);
      const ddgEnabled = await firstValueFrom(
        this.desktopAutofillSettingsService.enableDuckDuckGoBrowserIntegration$,
      );
      if (!ddgEnabled) {
        this.sendResponse(
          { messageId, version: NativeMessagingVersion.Latest, payload: { error: "canceled" } },
          clientId,
        );
        return;
      }

      this.messagingService.send("setFocus");

      const verified = await this.rendererUiRequestService.request<boolean>(
        DDG_IPC_CHANNELS.VERIFY_REQUEST,
        DDG_IPC_CHANNELS.VERIFY_RESPONSE,
        { applicationName },
        { defaultResponse: false },
      );
      if (verified !== true) {
        this.sendResponse(
          { messageId, version: NativeMessagingVersion.Latest, payload: { error: "canceled" } },
          clientId,
        );
        return;
      }

      await SdkLoadService.Ready;
      const secret = SymmetricCryptoKey.fromSdk(PureCrypto.make_aes256_cbc_hmac_key());
      this.duckduckgoSharedSecret = secret;

      const encryptedSecret = await this.cryptoFunctionService.rsaEncrypt(
        secret.toEncoded(),
        remotePublicKey,
        HashAlgorithmForAsymmetricEncryption,
      );

      this.sendResponse(
        {
          messageId,
          version: NativeMessagingVersion.Latest,
          payload: { status: "success", sharedKey: Utils.fromBufferToB64(encryptedSecret) },
        },
        clientId,
      );
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      this.sendResponse(
        { messageId, version: NativeMessagingVersion.Latest, payload: { error: "cannot-decrypt" } },
        clientId,
      );
    }
  }

  private async handleEncryptedMessage(message: EncryptedMessage, clientId: number) {
    message.encryptedCommand = EncString.fromJSON(
      message.encryptedCommand.toString() as EncryptedString,
    );
    const decryptedCommandData = await this.decryptPayload(message, clientId);
    if (decryptedCommandData == null) {
      return;
    }
    const { command } = decryptedCommandData;

    try {
      // Command execution needs vault services; delegate to the renderer's EncryptedMessageHandler.
      const responseData = await this.rendererUiRequestService.request<MessageResponseData>(
        DDG_IPC_CHANNELS.COMMAND_REQUEST,
        DDG_IPC_CHANNELS.COMMAND_RESPONSE,
        { commandData: decryptedCommandData },
        { defaultResponse: {} as MessageResponseData },
      );
      await this.sendEncryptedResponse(message, { command, payload: responseData }, clientId);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      await this.sendEncryptedResponse(message, { command, payload: {} }, clientId);
    }
  }

  private async decryptPayload(
    message: EncryptedMessage,
    clientId: number,
  ): Promise<DecryptedCommandData | undefined> {
    if (!this.duckduckgoSharedSecret) {
      this.sendResponse(
        {
          messageId: message.messageId,
          version: NativeMessagingVersion.Latest,
          payload: { error: "cannot-decrypt" },
        },
        clientId,
      );
      return undefined;
    }

    try {
      const decryptedResult = await this.decryptDuckDuckGoEncString(
        message.encryptedCommand.encryptedString as DuckDuckGoEncstring,
        this.duckduckgoSharedSecret,
      );
      return JSON.parse(decryptedResult);
    } catch {
      this.sendResponse(
        {
          messageId: message.messageId,
          version: NativeMessagingVersion.Latest,
          payload: { error: "cannot-decrypt" },
        },
        clientId,
      );
      return undefined;
    }
  }

  private async sendEncryptedResponse(
    originalMessage: EncryptedMessage,
    response: DecryptedCommandData,
    clientId: number,
  ) {
    if (!this.duckduckgoSharedSecret) {
      this.sendResponse(
        {
          messageId: originalMessage.messageId,
          version: NativeMessagingVersion.Latest,
          payload: { error: "cannot-decrypt" },
        },
        clientId,
      );
      return;
    }

    const encryptedPayload = await this.encryptService.encryptString(
      JSON.stringify(response),
      this.duckduckgoSharedSecret,
    );

    this.sendResponse(
      {
        messageId: originalMessage.messageId,
        version: NativeMessagingVersion.Latest,
        encryptedPayload,
      },
      clientId,
    );
  }

  private sendResponse(
    response: EncryptedMessageResponse | UnencryptedMessageResponse,
    clientId: number,
  ) {
    this.nativeMessagingMain.sendTo(clientId, response);
  }

  private async decryptDuckDuckGoEncString(
    encString: DuckDuckGoEncstring,
    key: SymmetricCryptoKey,
  ): Promise<string> {
    const keyInner = key.inner();
    switch (keyInner.type) {
      case EncryptionType.AesCbc256_HmacSha256_B64: {
        const decryptedBytes = DANGEROUS_aesDecryptDuckDuckGoNoPaddingAes256CbcHmac(
          encString,
          keyInner,
        );
        return Utils.fromArrayToUtf8(decryptedBytes);
      }
    }
  }
}
