import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { NativeMessagingVersion } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncryptedString, EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { DialogService } from "@bitwarden/components";

import { VerifyNativeMessagingDialogComponent } from "../app/components/verify-native-messaging-dialog.component";
import { DesktopAutofillSettingsService } from "../autofill/services/desktop-autofill-settings.service";
import { DecryptedCommandData } from "../models/native-messaging/decrypted-command-data";
import { EncryptedMessage } from "../models/native-messaging/encrypted-message";
import { EncryptedMessageResponse } from "../models/native-messaging/encrypted-message-response";
import { Message } from "../models/native-messaging/message";
import { UnencryptedMessage } from "../models/native-messaging/unencrypted-message";
import { UnencryptedMessageResponse } from "../models/native-messaging/unencrypted-message-response";

import { EncryptedMessageHandlerService } from "./encrypted-message-handler.service";

const HashAlgorithmForAsymmetricEncryption = "sha1";

// This service handles messages using the protocol created for the DuckDuckGo integration.
@Injectable()
export class NativeMessageHandlerService {
  private ddgSharedSecret: SymmetricCryptoKey;

  constructor(
    private stateService: StateService,
    private cryptoService: CryptoService,
    private cryptoFunctionService: CryptoFunctionService,
    private messagingService: MessagingService,
    private encryptedMessageHandlerService: EncryptedMessageHandlerService,
    private dialogService: DialogService,
    private desktopAutofillSettingsService: DesktopAutofillSettingsService,
  ) {}

  async handleMessage(message: Message) {
    const decryptedCommand = message as UnencryptedMessage;
    if (message.version != NativeMessagingVersion.Latest) {
      this.sendResponse({
        messageId: message.messageId,
        version: NativeMessagingVersion.Latest,
        payload: {
          error: "version-discrepancy",
        },
      });
    } else {
      if (decryptedCommand.command === "bw-handshake") {
        await this.handleDecryptedMessage(decryptedCommand);
      } else {
        await this.handleEncryptedMessage(message as EncryptedMessage);
      }
    }
  }

  private async handleDecryptedMessage(message: UnencryptedMessage) {
    const { messageId, payload } = message;
    const { publicKey, applicationName } = payload;
    if (!publicKey) {
      this.sendResponse({
        messageId: messageId,
        version: NativeMessagingVersion.Latest,
        payload: {
          error: "cannot-decrypt",
        },
      });
      return;
    }

    try {
      const remotePublicKey = Utils.fromB64ToArray(publicKey);
      const ddgEnabled = await firstValueFrom(
        this.desktopAutofillSettingsService.enableDuckDuckGoBrowserIntegration$,
      );

      if (!ddgEnabled) {
        this.sendResponse({
          messageId: messageId,
          version: NativeMessagingVersion.Latest,
          payload: {
            error: "canceled",
          },
        });

        return;
      }

      // Ask for confirmation from user
      this.messagingService.send("setFocus");

      const nativeMessagingVerified = await firstValueFrom(
        VerifyNativeMessagingDialogComponent.open(this.dialogService, { applicationName }).closed,
      );

      if (nativeMessagingVerified !== true) {
        this.sendResponse({
          messageId: messageId,
          version: NativeMessagingVersion.Latest,
          payload: {
            error: "canceled",
          },
        });
        return;
      }

      const secret = await this.cryptoFunctionService.randomBytes(64);
      this.ddgSharedSecret = new SymmetricCryptoKey(secret);
      const sharedKeyB64 = new SymmetricCryptoKey(secret).keyB64;

      await this.stateService.setDuckDuckGoSharedKey(sharedKeyB64);

      const encryptedSecret = await this.cryptoFunctionService.rsaEncrypt(
        secret,
        remotePublicKey,
        HashAlgorithmForAsymmetricEncryption,
      );

      this.sendResponse({
        messageId: messageId,
        version: NativeMessagingVersion.Latest,
        payload: {
          status: "success",
          sharedKey: Utils.fromBufferToB64(encryptedSecret),
        },
      });
    } catch (error) {
      this.sendResponse({
        messageId: messageId,
        version: NativeMessagingVersion.Latest,
        payload: {
          error: "cannot-decrypt",
        },
      });
    }
  }

  private async handleEncryptedMessage(message: EncryptedMessage) {
    message.encryptedCommand = EncString.fromJSON(
      message.encryptedCommand.toString() as EncryptedString,
    );
    const decryptedCommandData = await this.decryptPayload(message);
    const { command } = decryptedCommandData;

    try {
      const responseData =
        await this.encryptedMessageHandlerService.responseDataForCommand(decryptedCommandData);

      await this.sendEncryptedResponse(message, { command, payload: responseData });
    } catch (error) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.sendEncryptedResponse(message, { command, payload: {} });
    }
  }

  private async encryptPayload(
    payload: DecryptedCommandData,
    key: SymmetricCryptoKey,
  ): Promise<EncString> {
    return await this.cryptoService.encrypt(JSON.stringify(payload), key);
  }

  private async decryptPayload(message: EncryptedMessage): Promise<DecryptedCommandData> {
    if (!this.ddgSharedSecret) {
      const storedKey = await this.stateService.getDuckDuckGoSharedKey();
      if (storedKey == null) {
        this.sendResponse({
          messageId: message.messageId,
          version: NativeMessagingVersion.Latest,
          payload: {
            error: "cannot-decrypt",
          },
        });
        return;
      }
      this.ddgSharedSecret = SymmetricCryptoKey.fromJSON({ keyB64: storedKey });
    }

    try {
      let decryptedResult = await this.cryptoService.decryptToUtf8(
        message.encryptedCommand as EncString,
        this.ddgSharedSecret,
      );

      decryptedResult = this.trimNullCharsFromMessage(decryptedResult);

      return JSON.parse(decryptedResult);
    } catch {
      this.sendResponse({
        messageId: message.messageId,
        version: NativeMessagingVersion.Latest,
        payload: {
          error: "cannot-decrypt",
        },
      });
      return;
    }
  }

  private async sendEncryptedResponse(
    originalMessage: EncryptedMessage,
    response: DecryptedCommandData,
  ) {
    if (!this.ddgSharedSecret) {
      this.sendResponse({
        messageId: originalMessage.messageId,
        version: NativeMessagingVersion.Latest,
        payload: {
          error: "cannot-decrypt",
        },
      });

      return;
    }

    const encryptedPayload = await this.encryptPayload(response, this.ddgSharedSecret);

    this.sendResponse({
      messageId: originalMessage.messageId,
      version: NativeMessagingVersion.Latest,
      encryptedPayload,
    });
  }

  private sendResponse(response: EncryptedMessageResponse | UnencryptedMessageResponse) {
    ipc.platform.nativeMessaging.sendReply(response);
  }

  // Trim all null bytes padded at the end of messages. This happens with C encryption libraries.
  private trimNullCharsFromMessage(message: string): string {
    const charNull = 0;
    const charRightCurlyBrace = 125;
    const charRightBracket = 93;

    for (let i = message.length - 1; i >= 0; i--) {
      if (message.charCodeAt(i) === charNull) {
        message = message.substring(0, message.length - 1);
      } else if (
        message.charCodeAt(i) === charRightCurlyBrace ||
        message.charCodeAt(i) === charRightBracket
      ) {
        break;
      }
    }
    return message;
  }
}
