import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { KeyService, BiometricStateService } from "@bitwarden/key-management";

import { BrowserApi } from "../platform/browser/browser-api";

import RuntimeBackground from "./runtime.background";

const MessageValidTimeout = 10 * 1000;
const MessageNoResponseTimeout = 60 * 1000;
const HashAlgorithmForEncryption = "sha1";

type Message = {
  command: string;
  messageId?: number;

  // Filled in by this service
  userId?: string;
  timestamp?: number;

  // Used for sharing secret
  publicKey?: string;
};

type OuterMessage = {
  message: Message | EncString;
  appId: string;
};

type ReceiveMessage = {
  timestamp: number;
  command: string;
  messageId: number;
  response?: any;

  // Unlock key
  keyB64?: string;
  userKeyB64?: string;
};

type ReceiveMessageOuter = {
  command: string;
  appId: string;
  messageId?: number;

  // Should only have one of these.
  message?: ReceiveMessage | EncString;
  sharedSecret?: string;
};

type Callback = {
  resolver: (value?: unknown) => void;
  rejecter: (reason?: any) => void;
};

type SecureChannel = {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  sharedSecret?: SymmetricCryptoKey;
  setupResolve: (value?: unknown) => void;
};

export class NativeMessagingBackground {
  connected = false;
  private connecting: boolean = false;
  private port?: browser.runtime.Port | chrome.runtime.Port;
  private appId?: string;

  private secureChannel?: SecureChannel;

  private messageId = 0;
  private callbacks = new Map<number, Callback>();
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private cryptoFunctionService: CryptoFunctionService,
    private runtimeBackground: RuntimeBackground,
    private messagingService: MessagingService,
    private appIdService: AppIdService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private authService: AuthService,
    private biometricStateService: BiometricStateService,
    private accountService: AccountService,
  ) {
    if (chrome?.permissions?.onAdded) {
      // Reload extension to activate nativeMessaging
      chrome.permissions.onAdded.addListener((permissions) => {
        if (permissions.permissions?.includes("nativeMessaging")) {
          BrowserApi.reloadExtension();
        }
      });
    }
  }

  async connect() {
    if (!(await BrowserApi.permissionsGranted(["nativeMessaging"]))) {
      this.logService.warning(
        "[Native Messaging IPC] Native messaging permission is missing for biometrics",
      );
      return;
    }
    if (this.connected || this.connecting) {
      return;
    }

    this.logService.info("[Native Messaging IPC] Connecting to Bitwarden Desktop app...");
    const appId = await this.appIdService.getAppId();
    this.appId = appId;
    await this.biometricStateService.setFingerprintValidated(false);

    return new Promise<void>((resolve, reject) => {
      const port = BrowserApi.connectNative("com.8bit.bitwarden");
      this.port = port;

      this.connecting = true;

      const connectedCallback = () => {
        if (!this.platformUtilsService.isSafari()) {
          this.logService.info(
            "[Native Messaging IPC] Connection to Bitwarden Desktop app established!",
          );
        } else {
          this.logService.info(
            "[Native Messaging IPC] Connection to Safari swift module established!",
          );
        }
        this.connected = true;
        this.connecting = false;
        resolve();
      };

      // Safari has a bundled native component which is always available, no need to
      // check if the desktop app is running.
      if (this.platformUtilsService.isSafari()) {
        connectedCallback();
      }

      port.onMessage.addListener(async (messageRaw: unknown) => {
        const message = messageRaw as ReceiveMessageOuter;
        switch (message.command) {
          case "connected":
            connectedCallback();
            break;
          case "disconnected":
            this.logService.info("[Native Messaging IPC] Disconnected from Bitwarden Desktop app.");
            if (this.connecting) {
              reject(new Error("startDesktop"));
            }
            this.connected = false;
            port.disconnect();
            // reject all
            for (const callback of this.callbacks.values()) {
              callback.rejecter("disconnected");
            }
            this.callbacks.clear();
            break;
          case "setupEncryption": {
            // Ignore since it belongs to another device
            if (message.appId !== appId) {
              return;
            }

            if (message.sharedSecret == null) {
              this.logService.info(
                "[Native Messaging IPC] Unable to create secureChannel channel, no shared secret",
              );
              return;
            }
            if (this.secureChannel == null) {
              this.logService.info(
                "[Native Messaging IPC] Unable to create secureChannel channel, no secureChannel communication setup",
              );
              return;
            }

            const encrypted = Utils.fromB64ToArray(message.sharedSecret);
            const decrypted = await this.cryptoFunctionService.rsaDecrypt(
              encrypted,
              this.secureChannel.privateKey,
              HashAlgorithmForEncryption,
            );

            this.secureChannel.sharedSecret = new SymmetricCryptoKey(decrypted);
            this.logService.info("[Native Messaging IPC] Secure channel established");

            this.secureChannel.setupResolve();
            break;
          }
          case "invalidateEncryption":
            // Ignore since it belongs to another device
            if (message.appId !== appId) {
              return;
            }
            this.logService.warning(
              "[Native Messaging IPC] Secure channel encountered an error; disconnecting and wiping keys...",
            );

            this.secureChannel = undefined;
            this.connected = false;

            if (message.messageId != null) {
              if (this.callbacks.has(message.messageId)) {
                this.callbacks.get(message.messageId)?.rejecter({
                  message: "invalidateEncryption",
                });
              }
            }
            return;
          case "verifyFingerprint": {
            this.logService.info("[Native Messaging IPC] Legacy app is requesting fingerprint");
            this.messagingService.send("showUpdateDesktopAppOrDisableFingerprintDialog", {});
            break;
          }
          case "verifyDesktopIPCFingerprint": {
            this.logService.info(
              "[Native Messaging IPC] Desktop app requested trust verification by fingerprint.",
            );
            await this.showFingerprintDialog();
            break;
          }
          case "verifiedDesktopIPCFingerprint": {
            await this.biometricStateService.setFingerprintValidated(true);
            this.messagingService.send("hideNativeMessagingFingerprintDialog", {});
            break;
          }
          case "rejectedDesktopIPCFingerprint": {
            this.messagingService.send("hideNativeMessagingFingerprintDialog", {});
            break;
          }
          case "wrongUserId":
            if (message.messageId != null) {
              if (this.callbacks.has(message.messageId)) {
                this.callbacks.get(message.messageId)?.rejecter({
                  message: "wrongUserId",
                });
              }
            }
            return;
          default:
            // Ignore since it belongs to another device
            if (!this.platformUtilsService.isSafari() && message.appId !== appId) {
              return;
            }

            if (message.message != null) {
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.onMessage(message.message);
            }
        }
      });

      this.port.onDisconnect.addListener((p: any) => {
        let error;
        if (BrowserApi.isWebExtensionsApi) {
          error = p.error.message;
        } else {
          error = chrome.runtime.lastError?.message;
        }

        this.secureChannel = undefined;
        this.connected = false;

        this.logService.error("NativeMessaging port disconnected because of error: " + error);

        const reason = error != null ? "desktopIntegrationDisabled" : undefined;
        reject(new Error(reason));
      });
    });
  }

  async callCommand(message: Message): Promise<any> {
    const messageId = this.messageId++;

    const callback = new Promise((resolver, rejecter) => {
      this.callbacks.set(messageId, { resolver, rejecter });
    });
    message.messageId = messageId;
    try {
      await this.send(message);
    } catch (e) {
      this.logService.info(
        `[Native Messaging IPC] Error sending message of type ${message.command} to Bitwarden Desktop app. Error: ${e}`,
      );
      const callback = this.callbacks.get(messageId);
      this.callbacks.delete(messageId);
      callback?.rejecter("errorConnecting");
    }

    setTimeout(() => {
      if (this.callbacks.has(messageId)) {
        this.logService.info("[Native Messaging IPC] Message timed out and received no response");
        this.callbacks.get(messageId)!.rejecter({
          message: "timeout",
        });
        this.callbacks.delete(messageId);
      }
    }, MessageNoResponseTimeout);

    return callback;
  }

  async send(message: Message) {
    if (!this.connected) {
      await this.connect();
    }

    message.userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    message.timestamp = Date.now();

    if (this.platformUtilsService.isSafari()) {
      this.postMessage(message as any);
    } else {
      this.postMessage({ appId: this.appId!, message: await this.encryptMessage(message) });
    }
  }

  async encryptMessage(message: Message) {
    if (this.secureChannel?.sharedSecret == null) {
      await this.secureCommunication();
    }

    return await this.encryptService.encryptString(
      JSON.stringify(message),
      this.secureChannel!.sharedSecret!,
    );
  }

  private postMessage(message: OuterMessage, messageId?: number) {
    // Wrap in try-catch to when the port disconnected without triggering `onDisconnect`.
    try {
      const msg: any = message;
      if (message.message instanceof EncString) {
        // Alternative, backwards-compatible serialization of EncString
        msg.message = {
          encryptedString: message.message.encryptedString,
          encryptionType: message.message.encryptionType,
          data: message.message.data,
          iv: message.message.iv,
          mac: message.message.mac,
        };
      }
      this.port!.postMessage(msg);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      this.logService.info(
        "[Native Messaging IPC] Disconnected from Bitwarden Desktop app because of the native port disconnecting.",
      );

      this.secureChannel = undefined;
      this.connected = false;

      if (messageId != null && this.callbacks.has(messageId)) {
        this.callbacks.get(messageId)!.rejecter("invalidateEncryption");
      }
    }
  }

  private async onMessage(rawMessage: ReceiveMessage | EncString) {
    let message: ReceiveMessage;
    if (!this.platformUtilsService.isSafari()) {
      if (this.secureChannel?.sharedSecret == null) {
        return;
      }
      message = JSON.parse(
        await this.encryptService.decryptString(
          rawMessage as EncString,
          this.secureChannel.sharedSecret,
        ),
      );
    } else {
      message = rawMessage as ReceiveMessage;
    }

    if (Math.abs(message.timestamp - Date.now()) > MessageValidTimeout) {
      this.logService.info("[Native Messaging IPC] Received an old native message, ignoring...");
      return;
    }

    const messageId = message.messageId;

    if (this.callbacks.has(messageId)) {
      const callback = this.callbacks!.get(messageId)!;
      this.callbacks.delete(messageId);
      callback.resolver(message);
    } else {
      this.logService.info("[Native Messaging IPC] Received message without a callback", message);
    }
  }

  private async secureCommunication() {
    const [publicKey, privateKey] = await this.cryptoFunctionService.rsaGenerateKeyPair(2048);
    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.sendUnencrypted({
      command: "setupEncryption",
      publicKey: Utils.fromBufferToB64(publicKey),
      userId: userId,
      messageId: this.messageId++,
    });

    return new Promise((resolve) => {
      this.secureChannel = {
        publicKey,
        privateKey,
        setupResolve: resolve,
      };
    });
  }

  private async sendUnencrypted(message: Message) {
    if (!this.connected) {
      await this.connect();
    }

    message.timestamp = Date.now();

    this.postMessage({ appId: this.appId!, message: message });
  }

  private async showFingerprintDialog() {
    if (this.secureChannel?.publicKey == null) {
      return;
    }
    const fingerprint = await this.keyService.getFingerprint(
      this.appId!,
      this.secureChannel.publicKey,
    );

    this.messagingService.send("showNativeMessagingFingerprintDialog", {
      fingerprint: fingerprint,
    });
  }
}
