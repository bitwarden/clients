import { Injectable, NgZone } from "@angular/core";
import { combineLatest, concatMap, firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { BiometricsCommands, BiometricsStatus, KeyService } from "@bitwarden/key-management";

import { BrowserSyncVerificationDialogComponent } from "../app/components/browser-sync-verification-dialog.component";
import { DesktopBiometricsService } from "../key-management/biometrics/desktop.biometrics.service";
import { LegacyMessage, LegacyMessageWrapper } from "../models/native-messaging";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

const MessageValidTimeout = 10 * 1000;
const HashAlgorithmForAsymmetricEncryption = "sha1";

type ConnectedApp = {
  publicKey: string;
  sessionSecret: string | null;
  trusted: boolean;
};

const ConnectedAppPrefix = "connectedApp_";

class ConnectedApps {
  async get(appId: string): Promise<ConnectedApp | null> {
    if (!(await this.has(appId))) {
      return null;
    }

    return JSON.parse(
      await ipc.platform.ephemeralStore.getEphemeralValue(`${ConnectedAppPrefix}${appId}`),
    );
  }

  async list(): Promise<string[]> {
    return (await ipc.platform.ephemeralStore.listEphemeralValueKeys())
      .filter((key) => key.startsWith(ConnectedAppPrefix))
      .map((key) => key.replace(ConnectedAppPrefix, ""));
  }

  async set(appId: string, value: ConnectedApp) {
    await ipc.platform.ephemeralStore.setEphemeralValue(
      `${ConnectedAppPrefix}${appId}`,
      JSON.stringify(value),
    );
  }

  async has(appId: string) {
    return (await this.list()).find((id) => id === appId) != null;
  }

  async clear() {
    const connected = await this.list();
    for (const appId of connected) {
      await ipc.platform.ephemeralStore.removeEphemeralValue(`${ConnectedAppPrefix}${appId}`);
    }
  }
}

@Injectable()
export class BiometricMessageHandlerService {
  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private logService: LogService,
    private messagingService: MessagingService,
    private desktopSettingService: DesktopSettingsService,
    private biometricsService: DesktopBiometricsService,
    private dialogService: DialogService,
    private accountService: AccountService,
    private authService: AuthService,
    private ngZone: NgZone,
    private configService: ConfigService,
  ) {
    combineLatest([
      this.desktopSettingService.browserIntegrationEnabled$,
      this.desktopSettingService.browserIntegrationFingerprintEnabled$,
    ])
      .pipe(
        concatMap(async ([browserIntegrationEnabled, browserIntegrationFingerprintEnabled]) => {
          if (!browserIntegrationEnabled) {
            this.logService.info("[Native Messaging IPC] Clearing connected apps");
            await this.connectedApps.clear();
          } else if (!browserIntegrationFingerprintEnabled) {
            this.logService.info(
              "[Native Messaging IPC] Browser integration fingerprint validation is disabled, untrusting all connected apps",
            );
            const connected = await this.connectedApps.list();
            for (const appId of connected) {
              const connectedApp = await this.connectedApps.get(appId);
              if (connectedApp != null) {
                connectedApp.trusted = false;
                await this.connectedApps.set(appId, connectedApp);
              }
            }
          }
        }),
      )
      .subscribe();
  }

  private connectedApps: ConnectedApps = new ConnectedApps();

  async init() {
    this.logService.debug(
      "[BiometricMessageHandlerService] Initializing biometric message handler",
    );

    const windowsV2Enabled = await this.configService.getFeatureFlag(
      FeatureFlag.WindowsBiometricsV2,
    );
    if (windowsV2Enabled) {
      await this.biometricsService.enableWindowsV2Biometrics();
    }

    const linuxV2Enabled = await this.configService.getFeatureFlag(FeatureFlag.LinuxBiometricsV2);
    if (linuxV2Enabled) {
      await this.biometricsService.enableLinuxV2Biometrics();
    }
  }

  async handleMessage(msg: LegacyMessageWrapper) {
    const { appId, message: rawMessage } = msg as LegacyMessageWrapper;

    // Request to setup secure encryption
    if ("command" in rawMessage && rawMessage.command === "setupEncryption") {
      if (rawMessage.publicKey == null || rawMessage.userId == null) {
        this.logService.warning(
          "[Native Messaging IPC] Received invalid setupEncryption message. Ignoring.",
        );
        return;
      }
      const remotePublicKey = Utils.fromB64ToArray(rawMessage.publicKey);

      // Validate the UserId to ensure we are logged into the same account.
      const accounts = await firstValueFrom(this.accountService.accounts$);
      const userIds = Object.keys(accounts);
      if (!userIds.includes(rawMessage.userId)) {
        this.logService.info(
          "[Native Messaging IPC] Received message for user that is not logged into the desktop app.",
        );
        ipc.platform.nativeMessaging.sendMessage({
          command: "wrongUserId",
          appId: appId,
        });
        return;
      }

      if (await this.connectedApps.has(appId)) {
        this.logService.info(
          "[Native Messaging IPC] Public key for app id changed. Invalidating trust",
        );
      }

      const connectedApp = {
        publicKey: Utils.fromBufferToB64(remotePublicKey),
        sessionSecret: null,
        trusted: false,
      } as ConnectedApp;
      await this.connectedApps.set(appId, connectedApp);
      await this.secureCommunication(connectedApp, remotePublicKey, appId);
      return;
    }

    const sessionSecret = (await this.connectedApps.get(appId))?.sessionSecret;
    if (sessionSecret == null) {
      this.logService.info(
        "[Native Messaging IPC] Session secret for secure channel is missing. Invalidating encryption...",
      );
      ipc.platform.nativeMessaging.sendMessage({
        command: "invalidateEncryption",
        appId: appId,
      });
      return;
    }

    const message: LegacyMessage = JSON.parse(
      await this.encryptService.decryptString(
        rawMessage as EncString,
        SymmetricCryptoKey.fromString(sessionSecret),
      ),
    );

    // Shared secret is invalidated, force re-authentication
    if (message == null) {
      this.logService.info(
        "[Native Messaging IPC] Secure channel failed to decrypt message. Invalidating encryption...",
      );
      ipc.platform.nativeMessaging.sendMessage({
        command: "invalidateEncryption",
        appId: appId,
      });
      return;
    }

    if (
      message.timestamp == null ||
      Math.abs(message.timestamp - Date.now()) > MessageValidTimeout
    ) {
      this.logService.info("[Native Messaging IPC] Received a too old message. Ignoring.");
      return;
    }

    const messageId = message.messageId;

    switch (message.command) {
      case BiometricsCommands.UnlockWithBiometricsForUser: {
        await this.handleUnlockWithBiometricsForUser(message, messageId, appId);
        break;
      }
      case BiometricsCommands.AuthenticateWithBiometrics: {
        try {
          const unlocked = await this.biometricsService.authenticateWithBiometrics();
          await this.send(
            {
              command: BiometricsCommands.AuthenticateWithBiometrics,
              messageId,
              response: unlocked,
            },
            appId,
          );
        } catch (e) {
          this.logService.error("[Native Messaging IPC] Biometric authentication failed", e);
          await this.send(
            { command: BiometricsCommands.AuthenticateWithBiometrics, messageId, response: false },
            appId,
          );
        }
        break;
      }
      case BiometricsCommands.GetBiometricsStatus: {
        const status = await this.biometricsService.getBiometricsStatus();
        return this.send(
          {
            command: BiometricsCommands.GetBiometricsStatus,
            messageId,
            response: status,
          },
          appId,
        );
      }
      case BiometricsCommands.GetBiometricsStatusForUser: {
        let status = await this.biometricsService.getBiometricsStatusForUser(
          message.userId as UserId,
        );
        if (status == BiometricsStatus.NotEnabledLocally) {
          status = BiometricsStatus.NotEnabledInConnectedDesktopApp;
        }
        return this.send(
          {
            command: BiometricsCommands.GetBiometricsStatusForUser,
            messageId,
            response: status,
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

    const sessionSecret = (await this.connectedApps.get(appId))?.sessionSecret;
    if (sessionSecret == null) {
      throw new Error("Session secret is missing");
    }

    const encrypted = await this.encryptService.encryptString(
      JSON.stringify(message),
      SymmetricCryptoKey.fromString(sessionSecret),
    );

    ipc.platform.nativeMessaging.sendMessage({
      appId: appId,
      messageId: message.messageId,
      message: encrypted,
    });
  }

  private async secureCommunication(
    connectedApp: ConnectedApp,
    remotePublicKey: Uint8Array,
    appId: string,
  ) {
    const secret = await this.cryptoFunctionService.randomBytes(64);

    connectedApp.sessionSecret = new SymmetricCryptoKey(secret).keyB64;
    await this.connectedApps.set(appId, connectedApp);

    this.logService.info("[Native Messaging IPC] Setting up secure channel");
    const encryptedSecret = await this.cryptoFunctionService.rsaEncrypt(
      secret,
      remotePublicKey,
      HashAlgorithmForAsymmetricEncryption,
    );
    ipc.platform.nativeMessaging.sendMessage({
      appId: appId,
      command: "setupEncryption",
      messageId: -1, // to indicate to the other side that this is a new desktop client. refactor later to use proper versioning
      sharedSecret: Utils.fromBufferToB64(encryptedSecret),
    });
  }

  private async handleUnlockWithBiometricsForUser(
    message: LegacyMessage,
    messageId: number,
    appId: string,
  ) {
    const messageUserId = message.userId as UserId;
    if (!(await this.validateFingerprint(appId))) {
      await this.send(
        {
          command: BiometricsCommands.UnlockWithBiometricsForUser,
          messageId,
          response: false,
        },
        appId,
      );
      return;
    }

    try {
      const userKey = await this.biometricsService.unlockWithBiometricsForUser(messageUserId);
      if (userKey != null) {
        this.logService.info("[Native Messaging IPC] Biometric unlock for user: " + messageUserId);
        await this.send(
          {
            command: BiometricsCommands.UnlockWithBiometricsForUser,
            response: true,
            messageId,
            userKeyB64: userKey.keyB64,
          },
          appId,
        );
        await this.processReloadWhenRequired(messageUserId);
      } else {
        await this.send(
          {
            command: BiometricsCommands.UnlockWithBiometricsForUser,
            messageId,
            response: false,
          },
          appId,
        );
      }
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      await this.send(
        { command: BiometricsCommands.UnlockWithBiometricsForUser, messageId, response: false },
        appId,
      );
    }
  }

  /**
   * A process reload after a biometric unlock should happen if the userkey that was used for biometric unlock is for a different user than the
   * currently active account. The userkey for the active account was in memory anyways. Further, if the desktop app is locked, a reload should occur (since the userkey was not already in memory).
   */
  async processReloadWhenRequired(messageUserId: UserId) {
    const currentlyActiveAccountId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (currentlyActiveAccountId == null) {
      return;
    }
    const isCurrentlyActiveAccountUnlocked =
      (await firstValueFrom(this.authService.authStatusFor$(currentlyActiveAccountId))) ==
      AuthenticationStatus.Unlocked;

    if (currentlyActiveAccountId !== messageUserId || !isCurrentlyActiveAccountUnlocked) {
      if (!ipc.platform.isDev) {
        ipc.platform.reloadProcess();
      }
    }
  }

  async validateFingerprint(appId: string): Promise<boolean> {
    if (await firstValueFrom(this.desktopSettingService.browserIntegrationFingerprintEnabled$)) {
      const appToValidate = await this.connectedApps.get(appId);
      if (appToValidate == null) {
        return false;
      }

      if (appToValidate.trusted) {
        return true;
      }

      ipc.platform.nativeMessaging.sendMessage({
        command: "verifyDesktopIPCFingerprint",
        appId: appId,
      });

      const fingerprint = await this.keyService.getFingerprint(
        appId,
        Utils.fromB64ToArray(appToValidate.publicKey),
      );

      this.messagingService.send("setFocus");

      const dialogRef = this.ngZone.run(() =>
        BrowserSyncVerificationDialogComponent.open(this.dialogService, { fingerprint }),
      );

      const browserSyncVerified = await firstValueFrom(dialogRef.closed);
      if (browserSyncVerified !== true) {
        this.logService.info("[Native Messaging IPC] Fingerprint verification failed.");
        ipc.platform.nativeMessaging.sendMessage({
          command: "rejectedDesktopIPCFingerprint",
          appId: appId,
        });
        return false;
      } else {
        this.logService.info("[Native Messaging IPC] Fingerprint verified.");
        ipc.platform.nativeMessaging.sendMessage({
          command: "verifiedDesktopIPCFingerprint",
          appId: appId,
        });
      }

      appToValidate.trusted = true;
      await this.connectedApps.set(appId, appToValidate);
    }

    return true;
  }
}
