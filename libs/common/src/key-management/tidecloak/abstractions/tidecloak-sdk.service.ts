/**
 * Abstraction for the TideCloak SDK.
 * This service wraps the TideCloak JavaScript SDK for performing
 * Secure Multiparty Computation (SMPC) operations.
 *
 * The SDK communicates with ORK (Operational Recovery Key) nodes
 * to perform distributed encryption/decryption where the actual
 * keys are never assembled on any single machine.
 */
export abstract class TideCloakSdkService {
  /**
   * Initializes the TideCloak SDK with the given configuration URL.
   * @param tideCloakUrl - The URL of the TideCloak service
   */
  abstract initialize(tideCloakUrl: string): Promise<void>;

  /**
   * Performs distributed decryption using SMPC.
   * The decryption key is split across ORK nodes and the actual
   * decryption happens client-side without any single node having
   * access to the complete key.
   *
   * @param items - Array of items to decrypt, each with encrypted data and permission tags
   * @returns Array of decrypted data as Uint8Array
   */
  abstract doDecrypt(
    items: Array<{ encrypted: string; tags: string[] }>,
  ): Promise<Uint8Array[]>;

  /**
   * Performs distributed encryption using SMPC.
   * The encryption key is split across ORK nodes and the encryption
   * is performed in a distributed manner.
   *
   * @param items - Array of items to encrypt, each with data and permission tags
   * @returns Array of encrypted data as base64 strings
   */
  abstract doEncrypt(
    items: Array<{ data: Uint8Array; tags: string[] }>,
  ): Promise<string[]>;

  /**
   * Checks if the SDK is currently initialized.
   * @returns True if the SDK has been initialized
   */
  abstract isInitialized(): boolean;

  /**
   * Gets the current TideCloak URL the SDK is configured with.
   * @returns The TideCloak URL or null if not initialized
   */
  abstract getCurrentUrl(): string | null;
}
