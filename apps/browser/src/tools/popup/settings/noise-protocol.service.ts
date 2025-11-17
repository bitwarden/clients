import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

type KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };

/**
 * Noise Protocol WASM adapter for browser extension
 * Wraps the Rust/WASM implementation to provide secure Noise_XXpsk3_25519_AESGCM_SHA256 handshakes
 */
@Injectable({
  providedIn: "root",
})
export class NoiseProtocolService {
  private wasmModule: any = null;
  private isInitialized = false;

  constructor(private logService: LogService) {}

  /**
   * Initialize the WASM module
   * Must be called before using any other methods
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Import the WASM module - hardcoded path for demo
      // The WASM file will be in the build output directory alongside other assets
      const wasmModule = await import("./rust_noise.js");

      // Initialize WASM - for --target web, the default export is the init function
      if (typeof wasmModule.default === "function") {
        // Pass the WASM file path explicitly to avoid import.meta.url issues in bundled code
        await wasmModule.default("./rust_noise_bg.wasm");
      } else if (typeof wasmModule.init === "function") {
        // Fallback for other targets
        await wasmModule.init();
      }

      this.wasmModule = wasmModule;
      this.isInitialized = true;
      this.logService.info("[NoiseProtocol] WASM module initialized");
    } catch (error) {
      this.logService.error("[NoiseProtocol] Failed to initialize WASM module:", error);
      throw new Error(`Failed to initialize Noise Protocol WASM: ${error}`);
    }
  }

  /**
   * Create a new Noise Protocol instance
   */
  createProtocol(isInitiator: boolean, staticKeypair?: KeyPair, psk?: Uint8Array): NoiseProtocol {
    if (!this.isInitialized || !this.wasmModule) {
      throw new Error("NoiseProtocolService not initialized. Call initialize() first.");
    }

    return new NoiseProtocol(this.wasmModule, isInitiator, staticKeypair, psk, this.logService);
  }

  /**
   * Perform full XXpsk3 handshake (3 messages)
   */
  async performXXHandshake(
    isInitiator: boolean,
    sendMessage: (msg: Uint8Array) => Promise<Uint8Array>,
    staticKeypair?: KeyPair,
    psk?: Uint8Array,
  ): Promise<NoiseProtocol> {
    await this.initialize();

    const noise = this.createProtocol(isInitiator, staticKeypair, psk);

    if (isInitiator) {
      this.logService.info("[NoiseProtocol] Step 1: Initiator sending message 1 (-> e)");
      const msg1 = noise.writeMessage();
      const msg2 = await sendMessage(msg1);

      this.logService.info(
        "[NoiseProtocol] Step 2: Initiator received message 2 (<- e, ee, s, es)",
      );
      noise.readMessage(msg2);

      this.logService.info("[NoiseProtocol] Step 3: Initiator sending message 3 (-> s, se, psk)");
      const msg3 = noise.writeMessage();
      await sendMessage(msg3);

      noise.split();
    } else {
      this.logService.info("[NoiseProtocol] Responder waiting for messages...");
      // Responder waits for messages, handled separately
    }

    return noise;
  }
}

/**
 * Noise Protocol wrapper using Rust/WASM implementation
 * Implements Noise_XXpsk3_25519_AESGCM_SHA256 pattern
 */
export class NoiseProtocol {
  private wasmProtocol: any;
  private isInitiator: boolean;

  constructor(
    wasmModule: any,
    isInitiator: boolean,
    staticKeypair?: KeyPair,
    psk?: Uint8Array,
    private logService?: LogService,
  ) {
    this.isInitiator = isInitiator;

    try {
      // Convert optional parameters
      const staticSecretKey = staticKeypair ? staticKeypair.secretKey : null;
      const pskBytes = psk ? psk : null;

      // Create WASM protocol instance
      this.wasmProtocol = new wasmModule.NoiseProtocol(isInitiator, staticSecretKey, pskBytes);

      this.log(
        `Noise XX handshake initialized (${isInitiator ? "initiator" : "responder"}, PSK: ${psk ? "yes" : "no"})`,
      );
    } catch (error) {
      this.logError("Failed to create WASM NoiseProtocol:", error);
      throw error;
    }
  }

  /**
   * Write a handshake message
   */
  writeMessage(payload?: Uint8Array): Uint8Array {
    try {
      const payloadArray = payload && payload.length > 0 ? payload : null;
      const message = this.wasmProtocol.writeMessage(payloadArray);

      this.log(`Sent handshake message (length: ${message.length})`);
      return message;
    } catch (error) {
      this.logError("Failed to write message:", error);
      throw error;
    }
  }

  /**
   * Read a handshake message
   */
  readMessage(message: Uint8Array): Uint8Array {
    try {
      const payload = this.wasmProtocol.readMessage(message);

      this.log(
        `Received handshake message (length: ${message.length}, payload: ${payload.length})`,
      );
      return payload;
    } catch (error) {
      this.logError("Failed to read message:", error);
      throw error;
    }
  }

  /**
   * Complete the handshake and derive transport keys
   */
  split(): void {
    try {
      this.wasmProtocol.split();
      this.log("Handshake complete - transport keys derived");
    } catch (error) {
      this.logError("Failed to split:", error);
      throw error;
    }
  }

  /**
   * Encrypt a message after handshake is complete
   */
  encryptMessage(plaintext: Uint8Array): Uint8Array {
    try {
      const ciphertext = this.wasmProtocol.encryptMessage(plaintext);

      this.log(`Message encrypted (length: ${ciphertext.length})`);
      return ciphertext;
    } catch (error) {
      this.logError("Failed to encrypt:", error);
      throw error;
    }
  }

  /**
   * Decrypt a message after handshake is complete
   */
  decryptMessage(ciphertext: Uint8Array): Uint8Array {
    try {
      const plaintext = this.wasmProtocol.decryptMessage(ciphertext);

      this.log(`Message decrypted (length: ${plaintext.length})`);
      return plaintext;
    } catch (error) {
      this.logError("Failed to decrypt:", error);
      throw error;
    }
  }

  /**
   * Check if handshake is complete
   */
  isHandshakeComplete(): boolean {
    return this.wasmProtocol.isHandshakeComplete();
  }

  /**
   * Get static public key
   * Note: WASM implementation doesn't expose this directly
   */
  getStaticPublicKey(): Uint8Array {
    throw new Error("getStaticPublicKey not yet implemented for WASM");
  }

  private log(message: string) {
    if (this.logService) {
      this.logService.info(`[NoiseProtocol] ${message}`);
    }
  }

  private logError(message: string, error?: any) {
    if (this.logService) {
      this.logService.error(`[NoiseProtocol] ${message}`, error);
    }
  }
}
