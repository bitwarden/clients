import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import * as sdk from "@bitwarden/sdk-internal";

type KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };

/**
 * Noise Protocol service using Bitwarden SDK
 * Wraps the SDK's Noise Protocol implementation to provide secure Noise_XXpsk3_25519_AESGCM_SHA256 handshakes
 */
@Injectable({
  providedIn: "root",
})
export class NoiseProtocolService {
  constructor(private logService: LogService) {}

  /**
   * Create a new Noise Protocol instance
   */
  createProtocol(isInitiator: boolean, staticKeypair?: KeyPair, psk?: Uint8Array): NoiseProtocol {
    return new NoiseProtocol(isInitiator, staticKeypair, psk, this.logService);
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
 * Noise Protocol wrapper using Bitwarden SDK
 * Implements Noise_XXpsk3_25519_AESGCM_SHA256 pattern
 */
export class NoiseProtocol {
  private handle: number;

  constructor(
    isInitiator: boolean,
    staticKeypair?: KeyPair,
    psk?: Uint8Array,
    private logService?: LogService,
  ) {
    try {
      // Convert optional parameters
      const staticSecretKey = staticKeypair ? staticKeypair.secretKey : null;
      const pskBytes = psk ? psk : null;

      this.log(
        `Creating Noise protocol instance (${isInitiator ? "initiator" : "responder"}, ` +
          `staticKey: ${staticSecretKey ? staticSecretKey.length : "none"} bytes, ` +
          `PSK: ${pskBytes ? pskBytes.length : "none"} bytes)`,
      );

      // Create SDK protocol instance using the built-in noise functions
      this.handle = sdk.create_noise_protocol(isInitiator, staticSecretKey, pskBytes);

      if (this.handle === undefined || this.handle === null) {
        throw new Error("Failed to create NoiseProtocol - SDK returned invalid handle");
      }

      this.log(`Noise XX handshake initialized successfully (handle: ${this.handle})`);
    } catch (error) {
      this.logError("Failed to create SDK NoiseProtocol:", error);
      if (error instanceof Error) {
        this.logError("Error stack:", error.stack);
      }
      throw error;
    }
  }

  /**
   * Write a handshake message
   */
  writeMessage(payload?: Uint8Array): Uint8Array {
    try {
      const payloadArray = payload && payload.length > 0 ? payload : null;
      const message = sdk.noise_write_message(this.handle, payloadArray);

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
      const payload = sdk.noise_read_message(this.handle, message);

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
      sdk.noise_split(this.handle);
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
      const ciphertext = sdk.noise_encrypt_message(this.handle, plaintext);

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
      const plaintext = sdk.noise_decrypt_message(this.handle, ciphertext);

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
    return sdk.noise_is_handshake_complete(this.handle);
  }

  /**
   * Get static public key
   * Note: SDK implementation doesn't expose this directly
   */
  getStaticPublicKey(): Uint8Array {
    throw new Error("getStaticPublicKey not yet implemented for SDK Noise");
  }

  /**
   * Destroy the protocol instance and free resources
   */
  destroy(): void {
    try {
      sdk.destroy_noise_protocol(this.handle);
      this.log("Noise protocol instance destroyed");
    } catch (error) {
      this.logError("Failed to destroy noise protocol:", error);
    }
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
