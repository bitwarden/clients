import { Injectable } from "@angular/core";
import { ipcRenderer } from "electron";
import { firstValueFrom } from "rxjs";
import Swal from "sweetalert2";

import { KeySuffixOptions } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { LegacyMessage } from "../models/native-messaging/legacy-message";
import { LegacyMessageWrapper } from "../models/native-messaging/legacy-message-wrapper";
import { Message } from "../models/native-messaging/message";

import { NativeMessageHandlerService } from "./native-message-handler.service";

const MessageValidTimeout = 10 * 1000;
const EncryptionAlgorithm = "sha1";

@Injectable()
export class NativeMessagingService {
  private sharedSecrets = new Map<string, SymmetricCryptoKey>();

  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private cryptoService: CryptoService,
    private platformUtilService: PlatformUtilsService,
    private logService: LogService,
    private i18nService: I18nService,
    private messagingService: MessagingService,
    private stateService: StateService,
    private nativeMessageHandler: NativeMessageHandlerService
  ) {}

  init() {
    ipcRenderer.on("nativeMessaging", async (_event: any, message: any) => {
      this.messageHandler(message);
    });
  }

  private async messageHandler(msg: LegacyMessageWrapper | Message) {
    const outerMessage = msg as Message;
    if (outerMessage.version) {
      this.nativeMessageHandler.handleMessage(outerMessage);
      return;
    }

    const { appId, message: rawMessage } = msg as LegacyMessageWrapper;

    // Request to setup secure encryption
    if ("command" in rawMessage && rawMessage.command === "setupEncryption") {
      const remotePublicKey = Utils.fromB64ToArray(rawMessage.publicKey);

      // Validate the UserId to ensure we are logged into the same account.
      const accounts = await firstValueFrom(this.stateService.accounts$);
      const userIds = Object.keys(accounts);
      if (!userIds.includes(rawMessage.userId)) {
        ipcRenderer.send("nativeMessagingReply", { command: "wrongUserId", appId: appId });
        return;
      }

      if (await this.stateService.getEnableBrowserIntegrationFingerprint()) {
        ipcRenderer.send("nativeMessagingReply", { command: "verifyFingerprint", appId: appId });

        const fingerprint = (
          await this.cryptoService.getFingerprint(
            await this.stateService.getUserId(),
            remotePublicKey
          )
        ).join(" ");

        this.messagingService.send("setFocus");

        // Await confirmation that fingerprint is correct
        const submitted = await Swal.fire({
          titleText: this.i18nService.t("verifyBrowserTitle"),
          html: `${this.i18nService.t("verifyBrowserDesc")}<br><br><strong>${fingerprint}</strong>`,
          showCancelButton: true,
          cancelButtonText: this.i18nService.t("cancel"),
          showConfirmButton: true,
          confirmButtonText: this.i18nService.t("approve"),
          allowOutsideClick: false,
        });

        if (submitted.value !== true) {
          return;
        }
      }

      this.secureCommunication(remotePublicKey, appId);
      return;
    }

    if (this.sharedSecrets.get(appId) == null) {
      ipcRenderer.send("nativeMessagingReply", { command: "invalidateEncryption", appId: appId });
      return;
    }

    const message: LegacyMessage = JSON.parse(
      await this.cryptoService.decryptToUtf8(rawMessage as EncString, this.sharedSecrets.get(appId))
    );

    // Shared secret is invalidated, force re-authentication
    if (message == null) {
      ipcRenderer.send("nativeMessagingReply", { command: "invalidateEncryption", appId: appId });
      return;
    }

    if (Math.abs(message.timestamp - Date.now()) > MessageValidTimeout) {
      this.logService.error("NativeMessage is to old, ignoring.");
      return;
    }

    switch (message.command) {
      case "biometricUnlock": {
        if (!this.platformUtilService.supportsBiometric()) {
          return this.send({ command: "biometricUnlock", response: "not supported" }, appId);
        }

        if (!(await this.stateService.getBiometricUnlock({ userId: message.userId }))) {
          this.send({ command: "biometricUnlock", response: "not enabled" }, appId);

          return await Swal.fire({
            title: this.i18nService.t("biometricsNotEnabledTitle"),
            text: this.i18nService.t("biometricsNotEnabledDesc"),
            showCancelButton: true,
            cancelButtonText: this.i18nService.t("cancel"),
            showConfirmButton: false,
          });
        }

        const key = await this.cryptoService.getKeyFromStorage(
          KeySuffixOptions.Biometric,
          message.userId
        );

        if (key != null) {
          this.send(
            { command: "biometricUnlock", response: "unlocked", keyB64: key.keyB64 },
            appId
          );
        } else {
          this.send({ command: "biometricUnlock", response: "canceled" }, appId);
        }

        break;
      }
      default:
        this.logService.error("NativeMessage, got unknown command.");
        break;
    }
  }

  private async send(message: any, appId: string) {
    message.timestamp = Date.now();

    const encrypted = await this.cryptoService.encrypt(
      JSON.stringify(message),
      this.sharedSecrets.get(appId)
    );

    ipcRenderer.send("nativeMessagingReply", { appId: appId, message: encrypted });
  }

  private async secureCommunication(remotePublicKey: Uint8Array, appId: string) {
    const secret = await this.cryptoFunctionService.randomBytes(64);
    this.sharedSecrets.set(appId, new SymmetricCryptoKey(secret));

    const encryptedSecret = await this.cryptoFunctionService.rsaEncrypt(
      secret,
      remotePublicKey,
      EncryptionAlgorithm
    );
    ipcRenderer.send("nativeMessagingReply", {
      appId: appId,
      command: "setupEncryption",
      sharedSecret: Utils.fromBufferToB64(encryptedSecret),
    });
  }
}
