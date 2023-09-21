import { CsprngArray } from "../../types/csprng";
import { DecryptParameters } from "../models/domain/decrypt-parameters";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

export abstract class CryptoFunctionService {
  pbkdf2: (
    password: string | Uint8Array,
    salt: string | Uint8Array,
    algorithm: "sha256" | "sha512",
    iterations: number
  ) => Promise<Uint8Array>;
  argon2: (
    password: string | Uint8Array,
    salt: string | Uint8Array,
    iterations: number,
    memory: number,
    parallelism: number
  ) => Promise<Uint8Array>;
  hkdf: (
    ikm: Uint8Array,
    salt: string | Uint8Array,
    info: string | Uint8Array,
    outputByteSize: number,
    algorithm: "sha256" | "sha512"
  ) => Promise<Uint8Array>;
  hkdfExpand: (
    prk: Uint8Array,
    info: string | Uint8Array,
    outputByteSize: number,
    algorithm: "sha256" | "sha512"
  ) => Promise<Uint8Array>;
  hash: (
    value: string | Uint8Array,
    algorithm: "sha1" | "sha256" | "sha512" | "md5"
  ) => Promise<Uint8Array>;
  hmac: (
    value: Uint8Array,
    key: Uint8Array,
    algorithm: "sha1" | "sha256" | "sha512"
  ) => Promise<Uint8Array>;
  compare: (a: Uint8Array, b: Uint8Array) => Promise<boolean>;
  hmacFast: (
    value: Uint8Array | string,
    key: Uint8Array | string,
    algorithm: "sha1" | "sha256" | "sha512"
  ) => Promise<Uint8Array | string>;
  compareFast: (a: Uint8Array | string, b: Uint8Array | string) => Promise<boolean>;
  aesEncrypt: (data: Uint8Array, iv: Uint8Array, key: Uint8Array) => Promise<Uint8Array>;
  aesDecryptFastParameters: (
    data: string,
    iv: string,
    mac: string,
    key: SymmetricCryptoKey
  ) => DecryptParameters<Uint8Array | string>;
  aesDecryptFast: (parameters: DecryptParameters<Uint8Array | string>) => Promise<string>;
  aesDecrypt: (data: Uint8Array, iv: Uint8Array, key: Uint8Array) => Promise<Uint8Array>;
  rsaEncrypt: (
    data: Uint8Array,
    publicKey: Uint8Array,
    algorithm: "sha1" | "sha256"
  ) => Promise<Uint8Array>;
  rsaDecrypt: (
    data: Uint8Array,
    privateKey: Uint8Array,
    algorithm: "sha1" | "sha256"
  ) => Promise<Uint8Array>;
  rsaExtractPublicKey: (privateKey: Uint8Array) => Promise<Uint8Array>;
  rsaGenerateKeyPair: (length: 1024 | 2048 | 4096) => Promise<[Uint8Array, Uint8Array]>;
  /**
   * Generates a key of the given length suitable for use in AES encryption
   */
  aesGenerateKey: (bitLength: 128 | 192 | 256 | 512) => Promise<CsprngArray>;
  /**
   * Generates a random array of bytes of the given length. Uses a cryptographically secure random number generator.
   *
   * Do not use this for generating encryption keys. Use aesGenerateKey or rsaGenerateKeyPair instead.
   */
  randomBytes: (length: number) => Promise<CsprngArray>;
}
