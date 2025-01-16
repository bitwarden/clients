import { KdfConfig } from "@bitwarden/key-management";

import { CsprngArray } from "../../types/csprng";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

export abstract class KeyGenerationService {
  /**
   * Generates a key of the given length suitable for use in AES encryption
   * @param bitLength Length of key.
   * 256 bits = 32 bytes
   * 512 bits = 64 bytes
   * @returns Generated key.
   */
  abstract createKey(bitLength: 256 | 512): Promise<SymmetricCryptoKey>;
  /**
   * Generates key material from CSPRNG and derives a 64 byte key from it.
   * Uses HKDF, see {@link https://datatracker.ietf.org/doc/html/rfc5869 RFC 5869}
   * for details.
   * @param bitLength Length of key material.
   * @param purpose Purpose for the key derivation function.
   * Different purposes results in different keys, even with the same material.
   * @param salt Optional. If not provided will be generated from CSPRNG.
   * @returns An object containing the salt, key material, and derived key.
   */
  abstract createKeyWithPurpose(
    bitLength: 128 | 192 | 256 | 512,
    purpose: string,
    salt?: string,
  ): Promise<{ salt: string; material: CsprngArray; derivedKey: SymmetricCryptoKey }>;
  /**
   * Derives a 64 byte key from key material.
   * @remark The key material should be generated from {@link createKey}, or {@link createKeyWithPurpose}.
   * Uses HKDF, see {@link https://datatracker.ietf.org/doc/html/rfc5869 RFC 5869} for details.
   * @param material key material.
   * @param salt Salt for the key derivation function.
   * @param purpose Purpose for the key derivation function.
   * Different purposes results in different keys, even with the same material.
   * @returns 64 byte derived key.
   */
  abstract deriveKeyFromMaterial(
    material: CsprngArray,
    salt: string,
    purpose: string,
  ): Promise<SymmetricCryptoKey>;
  /**
   * Derives a 32 byte key from a password using a key derivation function.
   * @param password Password to derive the key from.
   * @param salt Salt for the key derivation function.
   * @param kdfConfig Configuration for the key derivation function.
   * @returns 32 byte derived key.
   */
  abstract deriveKeyFromPassword(
    password: string | Uint8Array,
    salt: string | Uint8Array,
    kdfConfig: KdfConfig,
  ): Promise<SymmetricCryptoKey>;

  /**
   * Derives a 64 byte key from a 32 byte key using a key derivation function.
   * @param key 32 byte key.
   * @returns 64 byte derived key.
   */
  abstract stretchKey(key: SymmetricCryptoKey): Promise<SymmetricCryptoKey>;
}
