import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsCommands, KeyService } from "@bitwarden/key-management";

import { IpcSocketService } from "./ipc-socket.service";

const MESSAGE_VALID_TIMEOUT = 10 * 1000; // 10 seconds
const MESSAGE_NO_RESPONSE_TIMEOUT = 60 * 1000; // 60 seconds
const HASH_ALGORITHM_FOR_ENCRYPTION = "sha1";

type Message = {
  command: string;
  messageId?: number;
  userId?: string;
  timestamp?: number;
  publicKey?: string;
};

type OuterMessage = {
  message: Message | EncString | EncStringJson;
  appId: string;
};

// For serializing EncString in a backwards-compatible way
type EncStringJson = {
  encryptedString: string;
  encryptionType: number;
  data: string;
  iv: string;
  mac: string;
};

type ReceivedMessage = {
  timestamp: number;
  command: string;
  messageId: number;
  response?: unknown;
  userKeyB64?: string;
};

type ReceivedMessageOuter = {
  command: string;
  appId: string;
  messageId?: number;
  message?: ReceivedMessage | EncString;
  sharedSecret?: string;
};

type Callback = {
  resolver: (value: unknown) => void;
  rejecter: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type SecureChannel = {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  sharedSecret?: SymmetricCryptoKey;
  setupResolve?: (value?: unknown) => void;
};

/**
 * Native messaging client for communicating with the Bitwarden desktop app.
 *
 * This implements the same IPC protocol used by the browser extension:
 * 1. Connect to the desktop app via Unix socket / named pipe
 * 2. Set up encrypted communication using RSA key exchange
 * 3. Send/receive encrypted commands (biometric unlock, status checks, etc.)
 */
export class NativeMessagingClient {
  private connected = false;
  private connecting = false;
  private appId: string | null = null;

  private secureChannel: SecureChannel | null = null;
  private messageId = 0;
  private callbacks = new Map<number, Callback>();

  private ipcSocket: IpcSocketService;

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private cryptoFunctionService: CryptoFunctionService,
    private appIdService: AppIdService,
    private logService: LogService,
    private accountService: AccountService,
  ) {
    this.ipcSocket = new IpcSocketService(logService);
  }

  /**
   * Check if the desktop app is available (socket exists).
   */
  async isDesktopAppAvailable(): Promise<boolean> {
    return this.ipcSocket.isSocketAvailable();
  }

  /**
   * Connect to the desktop app.
   *
   * Note: Unlike the browser extension which uses the desktop_proxy binary,
   * we connect directly to the IPC socket. The "connected" message is NOT
   * sent by the server - it's generated locally by the proxy. So we consider
   * connection successful when the socket connects.
   */
  async connect(): Promise<void> {
    if (this.connected || this.connecting) {
      return;
    }

    this.logService.info("[Native Messaging] Connecting to Bitwarden Desktop app...");
    this.appId = await this.appIdService.getAppId();
    this.connecting = true;

    try {
      await this.ipcSocket.connect();

      // Set up message handler
      this.ipcSocket.onMessage((message) => {
        // FIXME: Verify that this floating promise is intentional
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.handleMessage(message as ReceivedMessageOuter);
      });

      this.ipcSocket.onDisconnect(() => {
        this.logService.info("[Native Messaging] Disconnected from Bitwarden Desktop app.");
        this.connected = false;
        this.secureChannel = null;

        // Clear timeouts and reject all pending callbacks
        for (const callback of this.callbacks.values()) {
          clearTimeout(callback.timeout);
          callback.rejecter("disconnected");
        }
        this.callbacks.clear();
      });

      // Socket connection successful - we're connected!
      // (Unlike browser extension, there's no "connected" message from the server)
      this.connected = true;
      this.connecting = false;
      this.logService.info("[Native Messaging] Connected to Bitwarden Desktop app!");
    } catch (e) {
      this.connecting = false;
      throw e;
    }
  }

  /**
   * Disconnect from the desktop app.
   */
  disconnect(): void {
    this.ipcSocket.disconnect();
    this.connected = false;
    this.secureChannel = null;
  }

  /**
   * Send a command to the desktop app and wait for a response.
   */
  async callCommand(message: Message): Promise<ReceivedMessage> {
    const messageId = this.messageId++;

    const callback = new Promise<ReceivedMessage>((resolver, rejecter) => {
      // Set up timeout (stored so we can clear it when response arrives)
      const timeout = setTimeout(() => {
        if (this.callbacks.has(messageId)) {
          this.logService.info("[Native Messaging] Message timed out and received no response");
          this.callbacks.delete(messageId);
          rejecter({ message: "timeout" });
        }
      }, MESSAGE_NO_RESPONSE_TIMEOUT);

      this.callbacks.set(messageId, {
        resolver: resolver as (value: unknown) => void,
        rejecter,
        timeout,
      });
    });

    message.messageId = messageId;

    try {
      await this.send(message);
    } catch (e) {
      this.logService.info(
        `[Native Messaging] Error sending message of type ${message.command}: ${e}`,
      );
      const cb = this.callbacks.get(messageId);
      if (cb) {
        clearTimeout(cb.timeout);
        this.callbacks.delete(messageId);
        cb.rejecter("errorConnecting");
      }
      throw e;
    }

    return callback;
  }

  /**
   * Send a message to the desktop app (encrypted if secure channel is established).
   */
  private async send(message: Message): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    message.userId = activeAccount?.id;
    message.timestamp = Date.now();

    this.postMessage({
      appId: this.appId!,
      message: await this.encryptMessage(message),
    });
  }

  /**
   * Encrypt a message using the secure channel's shared secret.
   */
  private async encryptMessage(message: Message): Promise<EncString | Message> {
    if (this.secureChannel?.sharedSecret == null) {
      await this.secureCommunication();
    }

    return await this.encryptService.encryptString(
      JSON.stringify(message),
      this.secureChannel!.sharedSecret!,
    );
  }

  /**
   * Post a message to the IPC socket.
   */
  private postMessage(message: OuterMessage): void {
    try {
      const msg: Record<string, unknown> = { ...message };

      // Serialize EncString in backwards-compatible format
      if (message.message instanceof EncString) {
        msg.message = {
          encryptedString: message.message.encryptedString,
          encryptionType: message.message.encryptionType,
          data: message.message.data,
          iv: message.message.iv,
          mac: message.message.mac,
        };
      }

      this.ipcSocket.sendMessage(msg);
    } catch (e) {
      this.logService.info("[Native Messaging] Error sending message:", e);
      this.secureChannel = null;
      this.connected = false;
      throw e;
    }
  }

  /**
   * Handle incoming messages from the desktop app.
   */
  private async handleMessage(message: ReceivedMessageOuter): Promise<void> {
    switch (message.command) {
      case "connected":
        // This shouldn't happen when connecting directly (not via proxy)
        // but handle it gracefully just in case
        this.logService.debug("[Native Messaging] Received connected message");
        break;

      case "disconnected":
        // This shouldn't happen when connecting directly (not via proxy)
        this.logService.info("[Native Messaging] Received disconnected message");
        this.connected = false;
        this.ipcSocket.disconnect();
        break;

      case "setupEncryption":
        if (message.appId !== this.appId) {
          return;
        }
        await this.handleSetupEncryption(message);
        break;

      case "invalidateEncryption":
        if (message.appId !== this.appId) {
          return;
        }
        this.logService.warning(
          "[Native Messaging] Secure channel encountered an error; disconnecting...",
        );
        this.secureChannel = null;
        this.connected = false;

        if (message.messageId != null && this.callbacks.has(message.messageId)) {
          this.callbacks.get(message.messageId)?.rejecter({ message: "invalidateEncryption" });
        }
        break;

      case "wrongUserId":
        if (message.messageId != null && this.callbacks.has(message.messageId)) {
          this.callbacks.get(message.messageId)?.rejecter({ message: "wrongUserId" });
        }
        break;

      case "verifyDesktopIPCFingerprint":
        this.logService.info("[Native Messaging] Desktop app requested fingerprint verification.");
        await this.showFingerprint();
        break;

      case "verifiedDesktopIPCFingerprint":
        this.logService.info("[Native Messaging] Desktop app verified fingerprint.");
        break;

      case "rejectedDesktopIPCFingerprint":
        this.logService.warning("[Native Messaging] Desktop app rejected fingerprint.");
        break;

      default:
        // Ignore messages for other apps
        if (message.appId !== this.appId) {
          return;
        }

        if (message.message != null) {
          await this.handleEncryptedMessage(message.message);
        }
    }
  }

  /**
   * Handle the setupEncryption response from the desktop app.
   */
  private async handleSetupEncryption(message: ReceivedMessageOuter): Promise<void> {
    if (message.sharedSecret == null) {
      this.logService.info("[Native Messaging] No shared secret in setupEncryption response");
      return;
    }

    if (this.secureChannel == null) {
      this.logService.info("[Native Messaging] No secure channel setup in progress");
      return;
    }

    const encrypted = Utils.fromB64ToArray(message.sharedSecret);
    const decrypted = await this.cryptoFunctionService.rsaDecrypt(
      encrypted,
      this.secureChannel.privateKey,
      HASH_ALGORITHM_FOR_ENCRYPTION,
    );

    this.secureChannel.sharedSecret = new SymmetricCryptoKey(decrypted);
    this.logService.info("[Native Messaging] Secure channel established");

    if (this.secureChannel.setupResolve) {
      this.secureChannel.setupResolve();
    }
  }

  /**
   * Handle an encrypted message from the desktop app.
   */
  private async handleEncryptedMessage(
    rawMessage: ReceivedMessage | EncString | EncStringJson,
  ): Promise<void> {
    if (this.secureChannel?.sharedSecret == null) {
      return;
    }

    let encString: EncString;
    if (rawMessage instanceof EncString) {
      encString = rawMessage;
    } else if ("encryptedString" in rawMessage || "encryptionType" in rawMessage) {
      // Reconstruct EncString from JSON representation
      const json = rawMessage as EncStringJson;
      encString = new EncString(json.encryptedString || `${json.encryptionType}.${json.data}`);
    } else {
      // Already decrypted (shouldn't happen in normal flow)
      this.processDecryptedMessage(rawMessage as ReceivedMessage);
      return;
    }

    const decrypted = await this.encryptService.decryptString(
      encString,
      this.secureChannel.sharedSecret,
    );
    const message: ReceivedMessage = JSON.parse(decrypted);

    this.processDecryptedMessage(message);
  }

  /**
   * Process a decrypted message and resolve any pending callbacks.
   */
  private processDecryptedMessage(message: ReceivedMessage): void {
    if (Math.abs(message.timestamp - Date.now()) > MESSAGE_VALID_TIMEOUT) {
      this.logService.info("[Native Messaging] Received an old message, ignoring...");
      return;
    }

    const messageId = message.messageId;

    if (this.callbacks.has(messageId)) {
      const callback = this.callbacks.get(messageId)!;
      clearTimeout(callback.timeout);
      this.callbacks.delete(messageId);
      callback.resolver(message);
    } else {
      this.logService.info("[Native Messaging] Received message without a callback", message);
    }
  }

  /**
   * Set up secure communication with RSA key exchange.
   */
  private async secureCommunication(): Promise<void> {
    const [publicKey, privateKey] = await this.cryptoFunctionService.rsaGenerateKeyPair(2048);
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    const userId = activeAccount?.id;

    // Send public key to desktop app
    this.postMessage({
      appId: this.appId!,
      message: {
        command: "setupEncryption",
        publicKey: Utils.fromBufferToB64(publicKey),
        userId: userId,
        messageId: this.messageId++,
        timestamp: Date.now(),
      },
    });

    return new Promise((resolve) => {
      this.secureChannel = {
        publicKey,
        privateKey,
        setupResolve: resolve,
      };
    });
  }

  /**
   * Display the fingerprint for verification in the terminal.
   */
  private async showFingerprint(): Promise<void> {
    if (this.secureChannel?.publicKey == null) {
      return;
    }

    const fingerprint = await this.keyService.getFingerprint(
      this.appId!,
      this.secureChannel.publicKey,
    );

    // Write to stderr so it doesn't interfere with command output
    const write = (line: string) => process.stderr.write(line + "\n");
    write("\n┌────────────────────────────────────────────────────────────┐");
    write("│            Bitwarden Desktop App Verification              │");
    write("├────────────────────────────────────────────────────────────┤");
    write("│                                                            │");
    write("│  Verify this fingerprint matches the one shown in the     │");
    write("│  Bitwarden Desktop app to confirm the secure connection.  │");
    write("│                                                            │");
    write("│  Fingerprint:                                              │");
    write(`│    ${fingerprint.join("-")}`.padEnd(61) + "│");
    write("│                                                            │");
    write("│  Accept the connection in the Desktop app to continue.    │");
    write("└────────────────────────────────────────────────────────────┘\n");
  }

  /**
   * Get biometrics status from the desktop app.
   */
  async getBiometricsStatus(): Promise<unknown> {
    const response = await this.callCommand({
      command: BiometricsCommands.GetBiometricsStatus,
    });
    return response.response;
  }

  /**
   * Get biometrics status for a specific user.
   */
  async getBiometricsStatusForUser(userId: UserId): Promise<unknown> {
    const response = await this.callCommand({
      command: BiometricsCommands.GetBiometricsStatusForUser,
      userId: userId,
    });
    return response.response;
  }

  /**
   * Unlock with biometrics for a specific user.
   * Returns the user key if successful.
   */
  async unlockWithBiometricsForUser(userId: UserId): Promise<string | null> {
    const response = await this.callCommand({
      command: BiometricsCommands.UnlockWithBiometricsForUser,
      userId: userId,
    });

    if (response.response) {
      return response.userKeyB64 ?? null;
    }

    return null;
  }

  /**
   * Authenticate with biometrics (without returning keys).
   */
  async authenticateWithBiometrics(): Promise<boolean> {
    const response = await this.callCommand({
      command: BiometricsCommands.AuthenticateWithBiometrics,
    });
    return response.response === true;
  }
}
