import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import {
  MasterKey,
  SymmetricCryptoKey,
  UserKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { BrowserApi } from "../platform/browser/browser-api";

import RuntimeBackground from "./runtime.background";

const MessageValidTimeout = 10 * 1000;
const EncryptionAlgorithm = "sha1";

type Message = {
  command: string;

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
  response?: any;

  // Unlock key
  keyB64?: string;
  userKeyB64?: string;
};

type ReceiveMessageOuter = {
  command: string;
  appId: string;

  // Should only have one of these.
  message?: EncString;
  sharedSecret?: string;
};

export class NativeMessagingBackground {
  private connected = false;
  private connecting: boolean;
  private port: browser.runtime.Port | chrome.runtime.Port;

  private resolver: any = null;
  private privateKey: Uint8Array = null;
  private publicKey: Uint8Array = null;
  private secureSetupResolve: any = null;
  private sharedSecret: SymmetricCryptoKey;
  private appId: string;
  private validatingFingerprint: boolean;

  constructor(
    private cryptoService: CryptoService,
    private cryptoFunctionService: CryptoFunctionService,
    private runtimeBackground: RuntimeBackground,
    private i18nService: I18nService,
    private messagingService: MessagingService,
    private appIdService: AppIdService,
    private platformUtilsService: PlatformUtilsService,
    private stateService: StateService,
    private logService: LogService,
    private authService: AuthService
  ) {
    this.stateService.setBiometricFingerprintValidated(false);

    if (chrome?.permissions?.onAdded) {
      // Reload extension to activate nativeMessaging
      chrome.permissions.onAdded.addListener((permissions) => {
        BrowserApi.reloadExtension(null);
      });
    }
  }

  async connect() {
    this.appId = await this.appIdService.getAppId();
    this.stateService.setBiometricFingerprintValidated(false);

    return new Promise<void>((resolve, reject) => {
      this.port = BrowserApi.connectNative("com.8bit.bitwarden");

      this.connecting = true;

      const connectedCallback = () => {
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
            if (this.connecting) {
              reject("startDesktop");
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
              EncryptionAlgorithm
            );

            if (this.validatingFingerprint) {
              this.validatingFingerprint = false;
              this.stateService.setBiometricFingerprintValidated(true);
            }
            this.sharedSecret = new SymmetricCryptoKey(decrypted);
            this.secureSetupResolve();
            break;
          }
          case "invalidateEncryption":
            // Ignore since it belongs to another device
            if (message.appId !== this.appId) {
              return;
            }

            this.sharedSecret = null;
            this.privateKey = null;
            this.connected = false;

            this.messagingService.send("showDialog", {
              title: { key: "nativeMessagingInvalidEncryptionTitle" },
              content: { key: "nativeMessagingInvalidEncryptionDesc" },
              acceptButtonText: { key: "ok" },
              cancelButtonText: null,
              type: "danger",
            });
            break;
          case "verifyFingerprint": {
            if (this.sharedSecret == null) {
              this.validatingFingerprint = true;
              this.showFingerprintDialog();
            }
            break;
          }
          case "wrongUserId":
            this.showWrongUserDialog();
            break;
          default:
            // Ignore since it belongs to another device
            if (!this.platformUtilsService.isSafari() && message.appId !== this.appId) {
              return;
            }

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

        const reason = error != null ? "desktopIntegrationDisabled" : null;
        reject(reason);
      });
    });
  }

  showWrongUserDialog() {
    this.messagingService.send("showDialog", {
      title: { key: "nativeMessagingWrongUserTitle" },
      content: { key: "nativeMessagingWrongUserDesc" },
      acceptButtonText: { key: "ok" },
      cancelButtonText: null,
      type: "danger",
    });
  }

  async send(message: Message) {
    if (!this.connected) {
      await this.connect();
    }

    message.userId = await this.stateService.getUserId();
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

    return await this.cryptoService.encrypt(JSON.stringify(message), this.sharedSecret);
  }

  getResponse(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.resolver = resolve;
    });
  }

  private postMessage(message: OuterMessage) {
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
      this.logService.error("NativeMessaging port disconnected, disconnecting.");

      this.sharedSecret = null;
      this.privateKey = null;
      this.connected = false;

      this.messagingService.send("showDialog", {
        title: { key: "nativeMessagingInvalidEncryptionTitle" },
        content: { key: "nativeMessagingInvalidEncryptionDesc" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "danger",
      });
    }
  }

  private async onMessage(rawMessage: ReceiveMessage | EncString) {
    let message = rawMessage as ReceiveMessage;
    if (!this.platformUtilsService.isSafari()) {
      message = JSON.parse(
        await this.cryptoService.decryptToUtf8(rawMessage as EncString, this.sharedSecret)
      );
    }

    if (Math.abs(message.timestamp - Date.now()) > MessageValidTimeout) {
      this.logService.error("NativeMessage is to old, ignoring.");
      return;
    }

    switch (message.command) {
      case "biometricUnlock": {
        await this.stateService.setBiometricAwaitingAcceptance(null);

        if (message.response === "not enabled") {
          this.messagingService.send("showDialog", {
            title: { key: "biometricsNotEnabledTitle" },
            content: { key: "biometricsNotEnabledDesc" },
            acceptButtonText: { key: "ok" },
            cancelButtonText: null,
            type: "danger",
          });
          break;
        } else if (message.response === "not supported") {
          this.messagingService.send("showDialog", {
            title: { key: "biometricsNotSupportedTitle" },
            content: { key: "biometricsNotSupportedDesc" },
            acceptButtonText: { key: "ok" },
            cancelButtonText: null,
            type: "danger",
          });
          break;
        }

        const enabled = await this.stateService.getBiometricUnlock();
        if (enabled === null || enabled === false) {
          if (message.response === "unlocked") {
            await this.stateService.setBiometricUnlock(true);
          }
          break;
        }

        // Ignore unlock if already unlocked
        if ((await this.authService.getAuthStatus()) === AuthenticationStatus.Unlocked) {
          break;
        }

        if (message.response === "unlocked") {
          try {
            if (message.userKeyB64) {
              const userKey = new SymmetricCryptoKey(
                Utils.fromB64ToArray(message.userKeyB64)
              ) as UserKey;
              await this.cryptoService.setUserKey(userKey);
            } else if (message.keyB64) {
              // Backwards compatibility to support cases in which the user hasn't updated their desktop app
              // TODO: Remove after 2023.10 release (https://bitwarden.atlassian.net/browse/PM-3472)
              let encUserKey = await this.stateService.getEncryptedCryptoSymmetricKey();
              encUserKey ||= await this.stateService.getMasterKeyEncryptedUserKey();
              if (!encUserKey) {
                throw new Error("No encrypted user key found");
              }
              const masterKey = new SymmetricCryptoKey(
                Utils.fromB64ToArray(message.keyB64)
              ) as MasterKey;
              const userKey = await this.cryptoService.decryptUserKeyWithMasterKey(
                masterKey,
                new EncString(encUserKey)
              );
              await this.cryptoService.setMasterKey(masterKey);
              await this.cryptoService.setUserKey(userKey);
            } else {
              throw new Error("No key received");
            }
          } catch (e) {
            this.logService.error("Unable to set key: " + e);
            this.messagingService.send("showDialog", {
              title: { key: "biometricsFailedTitle" },
              content: { key: "biometricsFailedDesc" },
              acceptButtonText: { key: "ok" },
              cancelButtonText: null,
              type: "danger",
            });

            // Exit early
            if (this.resolver) {
              this.resolver(message);
            }
            return;
          }

          // Verify key is correct by attempting to decrypt a secret
          try {
            await this.cryptoService.getFingerprint(await this.stateService.getUserId());
          } catch (e) {
            this.logService.error("Unable to verify key: " + e);
            await this.cryptoService.clearKeys();
            this.showWrongUserDialog();

            // Exit early
            if (this.resolver) {
              this.resolver(message);
            }
            return;
          }

          this.runtimeBackground.processMessage({ command: "unlocked" }, null, null);
        }
        break;
      }
      default:
        this.logService.error("NativeMessage, got unknown command: " + message.command);
        break;
    }

    if (this.resolver) {
      this.resolver(message);
    }
  }

  private async secureCommunication() {
    const [publicKey, privateKey] = await this.cryptoFunctionService.rsaGenerateKeyPair(2048);
    this.publicKey = publicKey;
    this.privateKey = privateKey;

    this.sendUnencrypted({
      command: "setupEncryption",
      publicKey: Utils.fromBufferToB64(publicKey),
      userId: await this.stateService.getUserId(),
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
    const fingerprint = await this.cryptoService.getFingerprint(
      await this.stateService.getUserId(),
      this.publicKey
    );

    this.messagingService.send("showNativeMessagingFinterprintDialog", {
      fingerprint: fingerprint,
    });
  }
}
