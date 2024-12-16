// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { delay, filter, firstValueFrom, from, map, race, timer } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { KeyService, BiometricStateService, BiometricsCommands } from "@bitwarden/key-management";

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
  message?: EncString;
  sharedSecret?: string;
};

type Callback = {
  resolver: any;
  rejecter: any;
};

export class NativeMessagingBackground {
  connected = false;
  private connecting: boolean;
  private port: browser.runtime.Port | chrome.runtime.Port;

  private privateKey: Uint8Array = null;
  private publicKey: Uint8Array = null;
  private secureSetupResolve: any = null;
  private sharedSecret: SymmetricCryptoKey;
  private appId: string;
  private validatingFingerprint: boolean;

  private messageId = 0;
  private callbacks = new Map<number, Callback>();

  isConnectedToOutdatedDesktopClient = true;

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
    this.logService.info("[Native Messaging IPC] Connecting to Bitwarden Desktop app...");
    this.appId = await this.appIdService.getAppId();
    await this.biometricStateService.setFingerprintValidated(false);

    return new Promise<void>((resolve, reject) => {
      this.port = BrowserApi.connectNative("com.8bit.bitwarden");

      this.connecting = true;

      const connectedCallback = () => {
        this.logService.info(
          "[Native Messaging IPC] Connection to Bitwarden Desktop app established!",
        );
        this.connected = true;
        this.connecting = false;
        resolve();
      };

      // Safari has a bundled native component which is always available, no need to
      // check if the desktop app is running.
      if (this.platformUtilsService.isSafari()) {
        connectedCallback();
      }

      this.port.onMessage.addListener(async (message: ReceiveMessageOuter) => {
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
            this.port.disconnect();
            break;
          case "setupEncryption": {
            // Ignore since it belongs to another device
            if (message.appId !== this.appId) {
              return;
            }

            const encrypted = Utils.fromB64ToArray(message.sharedSecret);
            const decrypted = await this.cryptoFunctionService.rsaDecrypt(
              encrypted,
              this.privateKey,
              HashAlgorithmForEncryption,
            );

            if (this.validatingFingerprint) {
              this.validatingFingerprint = false;
              await this.biometricStateService.setFingerprintValidated(true);
            }
            this.sharedSecret = new SymmetricCryptoKey(decrypted);
            this.logService.info("[Native Messaging IPC] Secure channel established");

            if ("messageId" in message) {
              this.logService.info("[Native Messaging IPC] Non-legacy desktop client");
              this.isConnectedToOutdatedDesktopClient = false;
            } else {
              this.logService.info("[Native Messaging IPC] Legacy desktop client");
              this.isConnectedToOutdatedDesktopClient = true;
            }

            this.secureSetupResolve();
            break;
          }
          case "invalidateEncryption":
            // Ignore since it belongs to another device
            if (message.appId !== this.appId) {
              return;
            }
            this.logService.warning(
              "[Native Messaging IPC] Secure channel encountered an error; disconnecting and wiping keys...",
            );

            this.sharedSecret = null;
            this.privateKey = null;
            this.connected = false;

            if (this.callbacks.has(message.messageId)) {
              this.callbacks.get(message.messageId).rejecter({
                message: "invalidateEncryption",
              });
            }
            return;
          case "verifyFingerprint": {
            if (this.sharedSecret == null) {
              this.logService.info(
                "[Native Messaging IPC] Desktop app requested trust verification by fingerprint.",
              );
              this.validatingFingerprint = true;
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.showFingerprintDialog();
            }
            break;
          }
          case "wrongUserId":
            if (this.callbacks.has(message.messageId)) {
              this.callbacks.get(message.messageId).rejecter({
                message: "wrongUserId",
              });
            }
            return;
          default:
            // Ignore since it belongs to another device
            if (!this.platformUtilsService.isSafari() && message.appId !== this.appId) {
              return;
            }

            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.onMessage(message.message);
        }
      });

      this.port.onDisconnect.addListener((p: any) => {
        let error;
        if (BrowserApi.isWebExtensionsApi) {
          error = p.error.message;
        } else {
          error = chrome.runtime.lastError.message;
        }

        this.sharedSecret = null;
        this.privateKey = null;
        this.connected = false;

        this.logService.error("NativeMessaging port disconnected because of error: " + error);

        const reason = error != null ? "desktopIntegrationDisabled" : null;
        reject(new Error(reason));
      });
    });
  }

  async callCommand(message: Message): Promise<any> {
    const messageId = this.messageId++;

    if (
      message.command == BiometricsCommands.Unlock ||
      message.command == BiometricsCommands.IsAvailable
    ) {
      // TODO remove after 2025.01
      // wait until there is no other callbacks, or timeout
      const call = await firstValueFrom(
        race(
          from([false]).pipe(delay(5000)),
          timer(0, 100).pipe(
            filter(() => this.callbacks.size === 0),
            map(() => true),
          ),
        ),
      );
      if (!call) {
        this.logService.info(
          `[Native Messaging IPC] Message of type ${message.command} did not get a response before timing out`,
        );
        return;
      }
    }

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
      callback.rejecter("errorConnecting");
    }

    setTimeout(() => {
      if (this.callbacks.has(messageId)) {
        this.logService.info("[Native Messaging IPC] Message timed out and received no response");
        this.callbacks.get(messageId).rejecter({
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
      this.postMessage({ appId: this.appId, message: await this.encryptMessage(message) });
    }
  }

  async encryptMessage(message: Message) {
    if (this.sharedSecret == null) {
      await this.secureCommunication();
    }

    return await this.encryptService.encrypt(JSON.stringify(message), this.sharedSecret);
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
      this.port.postMessage(msg);
    } catch (e) {
      this.logService.info(
        "[Native Messaging IPC] Disconnected from Bitwarden Desktop app because of the native port disconnecting.",
      );

      this.sharedSecret = null;
      this.privateKey = null;
      this.connected = false;

      if (this.callbacks.has(messageId)) {
        this.callbacks.get(messageId).rejecter("invalidateEncryption");
      }
    }
  }

  private async onMessage(rawMessage: ReceiveMessage | EncString) {
    let message = rawMessage as ReceiveMessage;
    if (!this.platformUtilsService.isSafari()) {
      message = JSON.parse(
        await this.encryptService.decryptToUtf8(
          rawMessage as EncString,
          this.sharedSecret,
          "ipc-desktop-ipc-channel-key",
        ),
      );
    }

    if (Math.abs(message.timestamp - Date.now()) > MessageValidTimeout) {
      this.logService.info("[Native Messaging IPC] Received an old native message, ignoring...");
      return;
    }

    const messageId = message.messageId;

    if (
      message.command == BiometricsCommands.Unlock ||
      message.command == BiometricsCommands.IsAvailable
    ) {
      this.logService.info(
        `[Native Messaging IPC] Received legacy message of type ${message.command}`,
      );
      const messageId = this.callbacks.keys().next().value;
      const resolver = this.callbacks.get(messageId);
      this.callbacks.delete(messageId);
      resolver.resolver(message);
      return;
    }

    if (this.callbacks.has(messageId)) {
      this.callbacks.get(messageId).resolver(message);
    } else {
      this.logService.info("[Native Messaging IPC] Received message without a callback", message);
    }
  }

  private async secureCommunication() {
    const [publicKey, privateKey] = await this.cryptoFunctionService.rsaGenerateKeyPair(2048);
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.sendUnencrypted({
      command: "setupEncryption",
      publicKey: Utils.fromBufferToB64(publicKey),
      userId: userId,
      messageId: this.messageId++,
    });

    return new Promise((resolve, reject) => (this.secureSetupResolve = resolve));
  }

  private async sendUnencrypted(message: Message) {
    if (!this.connected) {
      await this.connect();
    }

    message.timestamp = Date.now();

    this.postMessage({ appId: this.appId, message: message });
  }

  private async showFingerprintDialog() {
    const fingerprint = await this.keyService.getFingerprint(
      (await firstValueFrom(this.accountService.activeAccount$))?.id,
      this.publicKey,
    );

    this.messagingService.send("showNativeMessagingFinterprintDialog", {
      fingerprint: fingerprint,
    });
  }
}
