import { Subject, firstValueFrom, takeUntil } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { UserKeyStateService } from "@bitwarden/common/key-management/user-key-state";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import {
  isForwardedIpcMessage,
  isIpcMessage,
} from "@bitwarden/common/platform/ipc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { ipc } from "@bitwarden/desktop-napi";
import { BiometricsCommands, BiometricsStatus } from "@bitwarden/key-management";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { DesktopBiometricsService } from "../key-management/biometrics/desktop.biometrics.service";
import { NativeMessagingMain } from "../main/native-messaging.main";
import { WindowMain } from "../main/window.main";
import { LegacyMessage, LegacyMessageWrapper } from "../models/native-messaging";
import { Message } from "../models/native-messaging/message";
import { isDev } from "../utils";

const MessageValidTimeout = 10 * 1000;
const HashAlgorithmForAsymmetricEncryption = "sha1";

type ConnectedApp = {
  publicKey: string;
  sessionSecret: string | null;
};

/**
 * Per-app handshake state for the legacy biometric native-messaging protocol.
 *
 * In the main process this is a plain in-memory map. It naturally survives renderer reloads
 * (the main process does not reload), which is the property the renderer previously relied on
 * the main-process ephemeral store for.
 */
class ConnectedApps {
  private apps = new Map<string, ConnectedApp>();

  get(appId: string): ConnectedApp | null {
    return this.apps.get(appId) ?? null;
  }

  set(appId: string, value: ConnectedApp) {
    this.apps.set(appId, value);
  }

  has(appId: string): boolean {
    return this.apps.has(appId);
  }

  clear() {
    this.apps.clear();
  }
}

/**
 * Main-process handler for the legacy browser-extension <-> desktop biometric-unlock protocol.
 *
 * This is the main-process counterpart to the renderer `BiometricMessageHandlerService`. Handling
 * the protocol in main lets it consume {@link NativeMessagingMain.messages$} directly and reply via
 * {@link NativeMessagingMain.sendTo}, eliminating the webContents round-trip through the renderer.
 *
 * It performs no vault decryption and shows no UI; it only establishes an encrypted channel and
 * drives the main biometric operations already available via {@link DesktopBiometricsService}.
 */
export class BiometricMessageHandlerMain {
  private connectedApps: ConnectedApps = new ConnectedApps();
  private destroy$ = new Subject<void>();

  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private encryptService: EncryptService,
    private logService: LogService,
    private biometricsService: DesktopBiometricsService,
    private accountService: AccountService,
    private userKeyStateService: UserKeyStateService,
    private nativeMessagingMain: NativeMessagingMain,
    private windowMain: WindowMain,
  ) {}

  /**
   * Subscribe to inbound native messages and handle the legacy biometric protocol. Non-biometric
   * messages (SDK IPC and the versioned DuckDuckGo protocol) are ignored here; those continue to be
   * routed to the renderer by {@link NativeMessagingMain}.
   */
  init() {
    this.logService.debug("[BiometricMessageHandlerMain] Initializing biometric message handler");
    this.nativeMessagingMain.messages$.pipe(takeUntil(this.destroy$)).subscribe((rawMessage) => {
      void this.dispatch(rawMessage).catch((e) =>
        this.logService.error("[Native Messaging IPC] Error handling biometric message", e),
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
      // Malformed messages are ignored; other subscribers log their own parse failures.
      return;
    }

    // SDK IPC messages are handled by IpcMainService; the versioned DuckDuckGo protocol is handled
    // in the renderer. Only the unversioned legacy biometric protocol is handled here.
    if (isIpcMessage(parsed) || isForwardedIpcMessage(parsed)) {
      return;
    }
    if ((parsed as Message).version) {
      return;
    }

    await this.handleMessage(parsed as LegacyMessageWrapper, rawMessage.clientId);
  }

  async handleMessage(msg: LegacyMessageWrapper, clientId: number) {
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
        this.nativeMessagingMain.sendTo(clientId, {
          command: "wrongUserId",
          appId: appId,
        });
        return;
      }

      if (this.connectedApps.has(appId)) {
        this.logService.info(
          "[Native Messaging IPC] Public key for app id changed. Invalidating trust",
        );
      }

      const connectedApp = {
        publicKey: Utils.fromBufferToB64(remotePublicKey),
        sessionSecret: null,
      } as ConnectedApp;
      this.connectedApps.set(appId, connectedApp);
      await this.secureCommunication(connectedApp, remotePublicKey, appId, clientId);
      return;
    }

    const sessionSecret = this.connectedApps.get(appId)?.sessionSecret;
    if (sessionSecret == null) {
      this.logService.info(
        "[Native Messaging IPC] Session secret for secure channel is missing. Invalidating encryption...",
      );
      this.nativeMessagingMain.sendTo(clientId, {
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
      this.nativeMessagingMain.sendTo(clientId, {
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
        await this.handleUnlockWithBiometricsForUser(message, messageId, appId, clientId);
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
            clientId,
          );
        } catch (e) {
          this.logService.error("[Native Messaging IPC] Biometric authentication failed", e);
          await this.send(
            { command: BiometricsCommands.AuthenticateWithBiometrics, messageId, response: false },
            appId,
            clientId,
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
          clientId,
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
          clientId,
        );
      }
      default:
        this.logService.error("NativeMessage, got unknown command: " + message.command);
        break;
    }
  }

  private async send(message: any, appId: string, clientId: number) {
    message.timestamp = Date.now();

    const sessionSecret = this.connectedApps.get(appId)?.sessionSecret;
    if (sessionSecret == null) {
      throw new Error("Session secret is missing");
    }

    const encrypted = await this.encryptService.encryptString(
      JSON.stringify(message),
      SymmetricCryptoKey.fromString(sessionSecret),
    );

    this.nativeMessagingMain.sendTo(clientId, {
      appId: appId,
      messageId: message.messageId,
      message: encrypted,
    });
  }

  private async secureCommunication(
    connectedApp: ConnectedApp,
    remotePublicKey: Uint8Array,
    appId: string,
    clientId: number,
  ) {
    await SdkLoadService.Ready;
    const secret = SymmetricCryptoKey.fromSdk(PureCrypto.make_aes256_cbc_hmac_key());

    connectedApp.sessionSecret = secret.keyB64;
    this.connectedApps.set(appId, connectedApp);

    this.logService.info("[Native Messaging IPC] Setting up secure channel");
    const encryptedSecret = await this.cryptoFunctionService.rsaEncrypt(
      secret.toEncoded(),
      remotePublicKey,
      HashAlgorithmForAsymmetricEncryption,
    );
    this.nativeMessagingMain.sendTo(clientId, {
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
    clientId: number,
  ) {
    const messageUserId = message.userId as UserId;

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
          clientId,
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
          clientId,
        );
      }
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      await this.send(
        { command: BiometricsCommands.UnlockWithBiometricsForUser, messageId, response: false },
        appId,
        clientId,
      );
    }
  }

  /**
   * A process reload after a biometric unlock should happen if the userkey that was used for biometric unlock is for a different user than the
   * currently active account. The userkey for the active account was in memory anyways. Further, if the desktop app is locked, a reload should occur (since the userkey was not already in memory).
   *
   * The active account's unlock state is derived from whether its user key is present in the
   * main-process {@link UserKeyStateService} (the authoritative in-memory copy), which avoids
   * needing a renderer-side AuthService in the main process.
   */
  async processReloadWhenRequired(messageUserId: UserId) {
    const currentlyActiveAccountId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (currentlyActiveAccountId == null) {
      return;
    }
    const isCurrentlyActiveAccountUnlocked =
      (await this.userKeyStateService.getUserKey(currentlyActiveAccountId)) != null;

    if (currentlyActiveAccountId !== messageUserId || !isCurrentlyActiveAccountUnlocked) {
      if (!isDev()) {
        await this.windowMain.reloadProcess();
      }
    }
  }
}
