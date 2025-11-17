import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { base64ToUint8Array, uint8ArrayToBase64 } from "./crypto-utils";

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

interface StoredKeypair {
  publicKey: string; // base64
  secretKey: string; // base64
  createdAt: number;
}

/**
 * Browser-based Static Keypair Management Service
 *
 * Manages persistent Noise Protocol static keypairs for devices using browser storage.
 * Each device maintains its own static keypair for mutual authentication.
 */
@Injectable({
  providedIn: "root",
})
export class KeypairStorageService {
  private readonly STORAGE_PREFIX = "noise-static-key-";

  constructor(private logService: LogService) {}

  /**
   * Generate a new Noise Protocol static keypair using X25519 (via WebCrypto)
   * @returns KeyPair with public and secret keys
   */
  async generateKeypair(): Promise<KeyPair> {
    try {
      // Generate X25519 keypair using WebCrypto API
      const keyPair = await crypto.subtle.generateKey(
        {
          name: "X25519",
          namedCurve: "X25519",
        } as any, // X25519 is not fully typed yet
        true,
        ["deriveBits"],
      );

      // Export the keys to raw format
      const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
      const secretKeyRaw = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

      // For X25519, we need to extract the raw 32-byte secret key from PKCS#8
      // PKCS#8 format has headers, the actual key is the last 32 bytes
      const secretKeyArray = new Uint8Array(secretKeyRaw);
      const secretKey = secretKeyArray.slice(-32);

      return {
        publicKey: new Uint8Array(publicKeyRaw),
        secretKey: secretKey,
      };
    } catch {
      // Fallback: generate random bytes if X25519 is not supported
      this.logService.warning(
        "[KeypairStorage] X25519 not supported in WebCrypto, using random fallback",
      );

      const secretKey = crypto.getRandomValues(new Uint8Array(32));

      // Simple scalar multiplication for public key (this is a simplified fallback)
      // In production, you'd want proper X25519 implementation
      const publicKey = await this.derivePublicKey(secretKey);

      return {
        publicKey,
        secretKey,
      };
    }
  }

  /**
   * Derive public key from secret key (simplified fallback)
   * Note: This is a placeholder. The WASM module should handle proper X25519.
   */
  private async derivePublicKey(secretKey: Uint8Array): Promise<Uint8Array> {
    // This is a simplified version - the WASM Noise implementation
    // will use proper X25519 scalar multiplication
    const hash = await crypto.subtle.digest("SHA-256", secretKey);
    return new Uint8Array(hash).slice(0, 32);
  }

  /**
   * Generate and persist a new static keypair for a device
   *
   * @param deviceId - Unique identifier for the device
   * @returns KeyPair that was generated and saved
   */
  async generateStaticKeypair(deviceId: string): Promise<KeyPair> {
    const keypair = await this.generateKeypair();
    const storageKey = this.getStorageKey(deviceId);

    const stored: StoredKeypair = {
      publicKey: uint8ArrayToBase64(keypair.publicKey),
      secretKey: uint8ArrayToBase64(keypair.secretKey),
      createdAt: Date.now(),
    };

    localStorage.setItem(storageKey, JSON.stringify(stored));

    this.logService.info(`[KeypairStorage] Generated static keypair for device: ${deviceId}`);
    return keypair;
  }

  /**
   * Load an existing static keypair for a device
   *
   * @param deviceId - Unique identifier for the device
   * @returns KeyPair if found, null if not found
   */
  loadStaticKeypair(deviceId: string): KeyPair | null {
    const storageKey = this.getStorageKey(deviceId);
    const stored = localStorage.getItem(storageKey);

    if (!stored) {
      return null;
    }

    try {
      const parsed: StoredKeypair = JSON.parse(stored);

      return {
        publicKey: base64ToUint8Array(parsed.publicKey),
        secretKey: base64ToUint8Array(parsed.secretKey),
      };
    } catch (error) {
      this.logService.error(
        `[KeypairStorage] Failed to load keypair for device ${deviceId}:`,
        error,
      );
      // Clear corrupted data
      this.logService.info(
        `[KeypairStorage] Clearing corrupted keypair data for device ${deviceId}`,
      );
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  /**
   * Get or create a static keypair for a device
   *
   * Loads existing keypair if available, otherwise generates a new one.
   *
   * @param deviceId - Unique identifier for the device
   * @returns KeyPair for the device
   */
  async getOrCreateStaticKeypair(deviceId: string): Promise<KeyPair> {
    const existing = this.loadStaticKeypair(deviceId);

    if (existing) {
      this.logService.info(
        `[KeypairStorage] Loaded existing static keypair for device: ${deviceId}`,
      );
      return existing;
    }

    this.logService.info(
      `[KeypairStorage] No existing keypair found for device: ${deviceId}, generating new one`,
    );
    return this.generateStaticKeypair(deviceId);
  }

  /**
   * Check if a static keypair exists for a device
   *
   * @param deviceId - Unique identifier for the device
   * @returns true if keypair exists, false otherwise
   */
  hasStaticKeypair(deviceId: string): boolean {
    const storageKey = this.getStorageKey(deviceId);
    return localStorage.getItem(storageKey) !== null;
  }

  /**
   * Delete a static keypair for a device
   *
   * @param deviceId - Unique identifier for the device
   * @returns true if deleted, false if not found
   */
  deleteStaticKeypair(deviceId: string): boolean {
    const storageKey = this.getStorageKey(deviceId);

    if (localStorage.getItem(storageKey) === null) {
      return false;
    }

    try {
      localStorage.removeItem(storageKey);
      this.logService.info(`[KeypairStorage] Deleted static keypair for device: ${deviceId}`);
      return true;
    } catch (error) {
      this.logService.error(
        `[KeypairStorage] Failed to delete keypair for device ${deviceId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * List all devices with stored static keypairs
   *
   * @returns Array of device IDs
   */
  listDevices(): string[] {
    const devices: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.STORAGE_PREFIX)) {
        const deviceId = key.substring(this.STORAGE_PREFIX.length);
        devices.push(deviceId);
      }
    }

    return devices;
  }

  /**
   * Delete all static keypairs
   *
   * WARNING: This will remove all device authentication keys.
   * Devices will need to re-pair after this operation.
   */
  clearAllKeypairs(): void {
    const devices = this.listDevices();

    for (const deviceId of devices) {
      this.deleteStaticKeypair(deviceId);
    }

    this.logService.info("[KeypairStorage] Cleared all static keypairs");
  }

  /**
   * Get the localStorage key for a device's static keypair
   * @param deviceId - Unique identifier for the device
   * @returns localStorage key
   */
  private getStorageKey(deviceId: string): string {
    // Sanitize deviceId to prevent issues
    const sanitized = deviceId.replace(/[^a-zA-Z0-9-_]/g, "_");
    return `${this.STORAGE_PREFIX}${sanitized}`;
  }
}
