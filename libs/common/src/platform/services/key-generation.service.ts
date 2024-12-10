// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KdfConfig, PBKDF2KdfConfig, Argon2KdfConfig, KdfType } from "@bitwarden/key-management";

import { CsprngArray } from "../../types/csprng";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { KeyGenerationService as KeyGenerationServiceAbstraction } from "../abstractions/key-generation.service";
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
    let key: Uint8Array = null;
    if (kdfConfig.kdfType == null || kdfConfig.kdfType === KdfType.PBKDF2_SHA256) {
      if (kdfConfig.iterations == null) {
        kdfConfig.iterations = PBKDF2KdfConfig.ITERATIONS.defaultValue;
      }

      key = await this.cryptoFunctionService.pbkdf2(password, salt, "sha256", kdfConfig.iterations);
    } else if (kdfConfig.kdfType == KdfType.Argon2id) {
      if (kdfConfig.iterations == null) {
        kdfConfig.iterations = Argon2KdfConfig.ITERATIONS.defaultValue;
      }

      if (kdfConfig.memory == null) {
        kdfConfig.memory = Argon2KdfConfig.MEMORY.defaultValue;
      }

      if (kdfConfig.parallelism == null) {
        kdfConfig.parallelism = Argon2KdfConfig.PARALLELISM.defaultValue;
      }

      const saltHash = await this.cryptoFunctionService.hash(salt, "sha256");
      key = await this.cryptoFunctionService.argon2(
        password,
        saltHash,
        kdfConfig.iterations,
        kdfConfig.memory * 1024, // convert to KiB from MiB
        kdfConfig.parallelism,
      );
    } else {
      throw new Error("Unknown Kdf.");
    }
    return new SymmetricCryptoKey(key);
  }

  async stretchKey(key: SymmetricCryptoKey): Promise<SymmetricCryptoKey> {
    const newKey = new Uint8Array(64);
    const encKey = await this.cryptoFunctionService.hkdfExpand(key.key, "enc", 32, "sha256");
    const macKey = await this.cryptoFunctionService.hkdfExpand(key.key, "mac", 32, "sha256");

    newKey.set(new Uint8Array(encKey));
    newKey.set(new Uint8Array(macKey), 32);

    return new SymmetricCryptoKey(newKey);
  }
}
