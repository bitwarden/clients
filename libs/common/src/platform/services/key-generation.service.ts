import { KdfConfig } from "../../auth/models/domain/kdf-config";
import { CsprngArray } from "../../types/csprng";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { KeyGenerationService as KeyGenerationServiceAbstraction } from "../abstractions/key-generation.service";
import {
  ARGON2_ITERATIONS,
  ARGON2_MEMORY,
  ARGON2_PARALLELISM,
  KdfType,
  PBKDF2_ITERATIONS,
} from "../enums";
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
    kdf: KdfType,
    kdfConfig: KdfConfig,
  ): Promise<SymmetricCryptoKey> {
    let key: Uint8Array = null;
    if (kdf == null || kdf === KdfType.PBKDF2_SHA256) {
      if (kdfConfig.iterations == null) {
        kdfConfig.iterations = PBKDF2_ITERATIONS.defaultValue;
      }

      key = await this.cryptoFunctionService.pbkdf2(password, salt, "sha256", kdfConfig.iterations);
    } else if (kdf == KdfType.Argon2id) {
      if (kdfConfig.iterations == null) {
        kdfConfig.iterations = ARGON2_ITERATIONS.defaultValue;
      }

      if (kdfConfig.memory == null) {
        kdfConfig.memory = ARGON2_MEMORY.defaultValue;
      }

      if (kdfConfig.parallelism == null) {
        kdfConfig.parallelism = ARGON2_PARALLELISM.defaultValue;
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
}
