// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { CryptoFunctionService } from "../../key-management/crypto/abstractions/crypto-function.service";
import { CsprngArray } from "../../types/csprng";
import { KeyGenerationService as KeyGenerationServiceAbstraction } from "../abstractions/key-generation.service";
import { SdkLoadService } from "../abstractions/sdk/sdk-load.service";
import { EncryptionType } from "../enums";
import { Utils } from "../misc/utils";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

export class KeyGenerationService implements KeyGenerationServiceAbstraction {
  constructor(private cryptoFunctionService: CryptoFunctionService) {}

  async createKey(bitLength: 256 | 512): Promise<SymmetricCryptoKey> {
    const key = await this.cryptoFunctionService.aesGenerateKey(bitLength);
    return new SymmetricCryptoKey(key);
  }

  async createKeyWithPurpose(
    bitLength: 128 | 192 | 256 | 512,
    purpose: string,
    salt?: string,
  ): Promise<{ salt: string; material: CsprngArray; derivedKey: SymmetricCryptoKey }> {
    if (salt == null) {
      const bytes = await this.cryptoFunctionService.randomBytes(32);
      salt = Utils.fromBufferToUtf8(bytes);
    }
    const material = await this.cryptoFunctionService.aesGenerateKey(bitLength);
    const key = await this.cryptoFunctionService.hkdf(material, salt, purpose, 64, "sha256");
    return { salt, material, derivedKey: new SymmetricCryptoKey(key) };
  }

  async deriveKeyFromMaterial(
    material: CsprngArray,
    salt: string,
    purpose: string,
  ): Promise<SymmetricCryptoKey> {
    const key = await this.cryptoFunctionService.hkdf(material, salt, purpose, 64, "sha256");
    return new SymmetricCryptoKey(key);
  }

  async deriveKeyFromPassword(
    password: string | Uint8Array,
    salt: string | Uint8Array,
    kdfConfig: KdfConfig,
  ): Promise<SymmetricCryptoKey> {
    if (typeof password === "string") {
      password = new TextEncoder().encode(password);
    }
    if (typeof salt === "string") {
      salt = new TextEncoder().encode(salt);
    }

    await SdkLoadService.Ready;
    return new SymmetricCryptoKey(
      PureCrypto.derive_kdf_material(password, salt, kdfConfig.toSdkConfig()),
    );
  }

  async stretchKey(key: SymmetricCryptoKey): Promise<SymmetricCryptoKey> {
    // The key to be stretched is actually usually the output of a KDF, and not actually meant for AesCbc256_B64 encryption,
    // but has the same key length. Only 256-bit key materials should be stretched.
    if (key.inner().type != EncryptionType.AesCbc256_B64) {
      throw new Error("Key passed into stretchKey is not a 256-bit key.");
    }

    const newKey = new Uint8Array(64);
    // Master key and pin key are always 32 bytes
    const encKey = await this.cryptoFunctionService.hkdfExpand(
      key.inner().encryptionKey,
      "enc",
      32,
      "sha256",
    );
    const macKey = await this.cryptoFunctionService.hkdfExpand(
      key.inner().encryptionKey,
      "mac",
      32,
      "sha256",
    );

    newKey.set(new Uint8Array(encKey));
    newKey.set(new Uint8Array(macKey), 32);

    return new SymmetricCryptoKey(newKey);
  }
}
