import { Injectable, NgZone } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { BiometricStateService, BiometricsService } from "@bitwarden/key-management";

import { BrowserSyncVerificationDialogComponent } from "../app/components/browser-sync-verification-dialog.component";
import { LegacyMessage } from "../models/native-messaging/legacy-message";
import { LegacyMessageWrapper } from "../models/native-messaging/legacy-message-wrapper";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

const MessageValidTimeout = 10 * 1000;
const HashAlgorithmForAsymmetricEncryption = "sha1";

@Injectable()
export class BiometricMessageHandlerService {
  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private cryptoService: CryptoService,
    private encryptService: EncryptService,
    private logService: LogService,
    private messagingService: MessagingService,
    private desktopSettingService: DesktopSettingsService,
    private biometricStateService: BiometricStateService,
    private biometricsService: BiometricsService,
    private dialogService: DialogService,
    private accountService: AccountService,
    private authService: AuthService,
    private ngZone: NgZone,
  ) {}

  async handleMessage(msg: LegacyMessageWrapper) {
    const { appId, message: rawMessage } = msg as LegacyMessageWrapper;

    // Request to setup secure encryption
    if ("command" in rawMessage && rawMessage.command === "setupEncryption") {
      const remotePublicKey = Utils.fromB64ToArray(rawMessage.publicKey);

      // Validate the UserId to ensure we are logged into the same account.
      const accounts = await firstValueFrom(this.accountService.accounts$);
      const userIds = Object.keys(accounts);
      if (!userIds.includes(rawMessage.userId)) {
        ipc.platform.nativeMessaging.sendMessage({
          command: "wrongUserId",
          appId: appId,
        });
        return;
      }

      if (await firstValueFrom(this.desktopSettingService.browserIntegrationFingerprintEnabled$)) {
        ipc.platform.nativeMessaging.sendMessage({
          command: "verifyFingerprint",
          appId: appId,
        });

        const fingerprint = await this.cryptoService.getFingerprint(
          rawMessage.userId,
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

      await this.secureCommunication(remotePublicKey, appId);
      return;
    }

    if ((await ipc.platform.ephemeralStore.getEphemeralValue(appId)) == null) {
      ipc.platform.nativeMessaging.sendMessage({
        command: "invalidateEncryption",
        appId: appId,
      });
      return;
    }

    const message: LegacyMessage = JSON.parse(
      await this.encryptService.decryptToUtf8(
        rawMessage as EncString,
        SymmetricCryptoKey.fromString(await ipc.platform.ephemeralStore.getEphemeralValue(appId)),
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
        const isTemporarilyDisabled =
          (await this.biometricStateService.getBiometricUnlockEnabled(message.userId as UserId)) &&
          !(await this.biometricsService.supportsBiometric());
        if (isTemporarilyDisabled) {
          return this.send({ command: "biometricUnlock", response: "not available" }, appId);
        }

        if (!(await this.biometricsService.supportsBiometric())) {
          return this.send({ command: "biometricUnlock", response: "not supported" }, appId);
        }

        const userId =
          (message.userId as UserId) ??
          (await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id))));

        if (userId == null) {
          return this.send({ command: "biometricUnlock", response: "not unlocked" }, appId);
        }

        const biometricUnlockPromise =
          message.userId == null
            ? firstValueFrom(this.biometricStateService.biometricUnlockEnabled$)
            : this.biometricStateService.getBiometricUnlockEnabled(message.userId as UserId);
        if (!(await biometricUnlockPromise)) {
          await this.send({ command: "biometricUnlock", response: "not enabled" }, appId);

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

          if (userKey != null) {
            await this.send(
              {
                command: "biometricUnlock",
                response: "unlocked",
                userKeyB64: userKey.keyB64,
              },
              appId,
            );

            const currentlyActiveAccountId = (
              await firstValueFrom(this.accountService.activeAccount$)
            ).id;
            const isCurrentlyActiveAccountUnlocked =
              (await this.authService.getAuthStatus(userId)) == AuthenticationStatus.Unlocked;

            // prevent proc reloading an active account, when it is the same as the browser
            if (currentlyActiveAccountId != message.userId || !isCurrentlyActiveAccountUnlocked) {
              await ipc.platform.reloadProcess();
            }
          } else {
            await this.send({ command: "biometricUnlock", response: "canceled" }, appId);
          }
        } catch (e) {
          await this.send({ command: "biometricUnlock", response: "canceled" }, appId);
        }

        break;
      }
      case "biometricUnlockAvailable": {
        const isAvailable = await this.biometricsService.supportsBiometric();
        return this.send(
          {
            command: "biometricUnlockAvailable",
            response: isAvailable ? "available" : "not available",
          },
          appId,
        );
      }
      default:
        this.logService.error("NativeMessage, got unknown command: " + message.command);
        break;
    }
  }

  private async send(message: any, appId: string) {
    message.timestamp = Date.now();

    const encrypted = await this.encryptService.encrypt(
      JSON.stringify(message),
      SymmetricCryptoKey.fromString(await ipc.platform.ephemeralStore.getEphemeralValue(appId)),
    );

    ipc.platform.nativeMessaging.sendMessage({ appId: appId, message: encrypted });
  }

  private async secureCommunication(remotePublicKey: Uint8Array, appId: string) {
    const secret = await this.cryptoFunctionService.randomBytes(64);
    await ipc.platform.ephemeralStore.setEphemeralValue(
      appId,
      new SymmetricCryptoKey(secret).keyB64,
    );

    const encryptedSecret = await this.cryptoFunctionService.rsaEncrypt(
      secret,
      remotePublicKey,
      HashAlgorithmForAsymmetricEncryption,
    );
    ipc.platform.nativeMessaging.sendMessage({
      appId: appId,
      command: "setupEncryption",
      sharedSecret: Utils.fromBufferToB64(encryptedSecret),
    });
  }
}
