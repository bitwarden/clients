// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { NativeMessagingVersion } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
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
export class DuckDuckGoMessageHandlerService {
  private duckduckgoSharedSecret: SymmetricCryptoKey;

  constructor(
    private stateService: StateService,
    private encryptService: EncryptService,
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
      this.duckduckgoSharedSecret = new SymmetricCryptoKey(secret);
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
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    return await this.encryptService.encryptString(JSON.stringify(payload), key);
  }

  private async decryptPayload(message: EncryptedMessage): Promise<DecryptedCommandData> {
    if (!this.duckduckgoSharedSecret) {
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
      this.duckduckgoSharedSecret = SymmetricCryptoKey.fromJSON({ keyB64: storedKey });
    }

    try {
      const decryptedResult = await this.decryptDuckDuckGoEncString(
        message.encryptedCommand as EncString,
        this.duckduckgoSharedSecret,
      );
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
    if (!this.duckduckgoSharedSecret) {
      this.sendResponse({
        messageId: originalMessage.messageId,
        version: NativeMessagingVersion.Latest,
        payload: {
          error: "cannot-decrypt",
        },
      });

      return;
    }

    const encryptedPayload = await this.encryptPayload(response, this.duckduckgoSharedSecret);

    this.sendResponse({
      messageId: originalMessage.messageId,
      version: NativeMessagingVersion.Latest,
      encryptedPayload,
    });
  }

  private sendResponse(response: EncryptedMessageResponse | UnencryptedMessageResponse) {
    ipc.platform.nativeMessaging.sendReply(response);
  }

  /*
   * Bitwarden type 2 (AES256-CBC-HMAC256) uses PKCS7 padding.
   * DuckDuckGo does not use PKCS7 padding; and instead fills the last CBC block with null bytes.
   * ref: https://github.com/duckduckgo/apple-browsers/blob/04d678b447869c3a640714718a466b36407db8b6/macOS/DuckDuckGo/PasswordManager/Bitwarden/Services/BWEncryption.m#L141
   *
   * This is incompatible which means the default encryptService cannot be used to decrypt the message,
   * a custom EncString decrypt operation is needed.
   *
   * This function also trims null characters that are a result of the null-padding from the end of the message.
   */
  private async decryptDuckDuckGoEncString(
    encString: EncString,
    key: SymmetricCryptoKey,
  ): Promise<string> {
    const fastParams = this.cryptoFunctionService.aesDecryptFastParameters(
      encString.data,
      encString.iv,
      encString.mac,
      key,
    );

    const computedMac = await this.cryptoFunctionService.hmacFast(
      fastParams.macData,
      fastParams.macKey,
      "sha256",
    );
    const macsEqual = await this.cryptoFunctionService.compareFast(fastParams.mac, computedMac);
    if (!macsEqual) {
      return null;
    }
    const decryptedPaddedString = await this.cryptoFunctionService.aesDecryptFast({
      mode: "cbc",
      parameters: fastParams,
    });
    return this.trimNullCharsFromMessage(decryptedPaddedString);
  }

  // DuckDuckGo does not use PKCS7 padding, but instead leaves the values as null,
  // so null characters need to be trimmed from the end of the message for the last
  // CBC-block.
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
