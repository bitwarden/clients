import { Injectable, NgZone } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { MasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { BrowserSyncVerificationDialogComponent } from "../app/components/browser-sync-verification-dialog.component";
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
    private masterPasswordService: MasterPasswordServiceAbstraction,
    private cryptoFunctionService: CryptoFunctionService,
    private cryptoService: CryptoService,
    private platformUtilService: PlatformUtilsService,
    private logService: LogService,
    private messagingService: MessagingService,
    private stateService: StateService,
    private biometricStateService: BiometricStateService,
    private nativeMessageHandler: NativeMessageHandlerService,
    private dialogService: DialogService,
    private ngZone: NgZone,
  ) {}

  init() {
    ipc.platform.nativeMessaging.onMessage((message) => this.messageHandler(message));
  }

  private async messageHandler(msg: LegacyMessageWrapper | Message) {
    const outerMessage = msg as Message;
    if (outerMessage.version) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
        ipc.platform.nativeMessaging.sendMessage({
          command: "wrongUserId",
          appId: appId,
        });
        return;
      }

      if (await this.stateService.getEnableBrowserIntegrationFingerprint()) {
        ipc.platform.nativeMessaging.sendMessage({
          command: "verifyFingerprint",
          appId: appId,
        });

        const fingerprint = await this.cryptoService.getFingerprint(
          await this.stateService.getUserId(),
          remotePublicKey,
        );

        this.messagingService.send("setFocus");

        const dialogRef = this.ngZone.run(() =>
          BrowserSyncVerificationDialogComponent.open(this.dialogService, { fingerprint }),
        );

        const browserSyncVerified = await firstValueFrom(dialogRef.closed);

        if (browserSyncVerified !== true) {
          return;
        }
      }

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.secureCommunication(remotePublicKey, appId);
      return;
    }

    if (this.sharedSecrets.get(appId) == null) {
      ipc.platform.nativeMessaging.sendMessage({
        command: "invalidateEncryption",
        appId: appId,
      });
      return;
    }

    const message: LegacyMessage = JSON.parse(
      await this.cryptoService.decryptToUtf8(
        rawMessage as EncString,
        this.sharedSecrets.get(appId),
      ),
    );

    // Shared secret is invalidated, force re-authentication
    if (message == null) {
      ipc.platform.nativeMessaging.sendMessage({
        command: "invalidateEncryption",
        appId: appId,
      });
      return;
    }

    if (Math.abs(message.timestamp - Date.now()) > MessageValidTimeout) {
      this.logService.error("NativeMessage is to old, ignoring.");
      return;
    }

    switch (message.command) {
      case "biometricUnlock": {
        if (!(await this.platformUtilService.supportsBiometric())) {
          return this.send({ command: "biometricUnlock", response: "not supported" }, appId);
        }

        const biometricUnlockPromise =
          message.userId == null
            ? firstValueFrom(this.biometricStateService.biometricUnlockEnabled$)
            : this.biometricStateService.getBiometricUnlockEnabled(message.userId as UserId);
        if (!(await biometricUnlockPromise)) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.send({ command: "biometricUnlock", response: "not enabled" }, appId);

          return this.ngZone.run(() =>
            this.dialogService.openSimpleDialog({
              type: "warning",
              title: { key: "biometricsNotEnabledTitle" },
              content: { key: "biometricsNotEnabledDesc" },
              cancelButtonText: null,
              acceptButtonText: { key: "cancel" },
            }),
          );
        }

        try {
          const userKey = await this.cryptoService.getUserKeyFromStorage(
            KeySuffixOptions.Biometric,
            message.userId,
          );
          const masterKey = await firstValueFrom(
            this.masterPasswordService.masterKey$(message.userId as UserId),
          );

          if (userKey != null) {
            // we send the master key still for backwards compatibility
            // with older browser extensions
            // TODO: Remove after 2023.10 release (https://bitwarden.atlassian.net/browse/PM-3472)
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.send(
              {
                command: "biometricUnlock",
                response: "unlocked",
                keyB64: masterKey?.keyB64,
                userKeyB64: userKey.keyB64,
              },
              appId,
            );
          } else {
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.send({ command: "biometricUnlock", response: "canceled" }, appId);
          }
        } catch (e) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
      this.sharedSecrets.get(appId),
    );

    ipc.platform.nativeMessaging.sendMessage({ appId: appId, message: encrypted });
  }

  private async secureCommunication(remotePublicKey: Uint8Array, appId: string) {
    const secret = await this.cryptoFunctionService.randomBytes(64);
    this.sharedSecrets.set(appId, new SymmetricCryptoKey(secret));

    const encryptedSecret = await this.cryptoFunctionService.rsaEncrypt(
      secret,
      remotePublicKey,
      EncryptionAlgorithm,
    );
    ipc.platform.nativeMessaging.sendMessage({
      appId: appId,
      command: "setupEncryption",
      sharedSecret: Utils.fromBufferToB64(encryptedSecret),
    });
  }
}
