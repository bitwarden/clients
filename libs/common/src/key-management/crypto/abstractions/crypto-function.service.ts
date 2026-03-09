import { CsprngArray } from "../../../types/csprng";

export abstract class CryptoFunctionService {
  /**
   * @deprecated ⚠️️ HAZMAT WARNING ⚠️️: DO NOT USE THIS FOR NEW CODE. CONTACT KEY MANAGEMENT IF YOU THINK YOU NEED TO. Implement low-level crypto operations
   * in the SDK instead. Further, you should probably never find yourself using this low-level crypto function.
   */
  abstract pbkdf2(
    password: string | Uint8Array,
    salt: string | Uint8Array,
    algorithm: "sha256" | "sha512",
    iterations: number,
  ): Promise<Uint8Array>;
  /**
   * @deprecated ⚠️️ HAZMAT WARNING ⚠️️: DO NOT USE THIS FOR NEW CODE. CONTACT KEY MANAGEMENT IF YOU THINK YOU NEED TO. Implement low-level crypto operations
   * in the SDK instead. Further, you should probably never find yourself using this low-level crypto function.
   */
  abstract hkdf(
    ikm: Uint8Array,
    salt: string | Uint8Array,
    info: string | Uint8Array,
    outputByteSize: number,
    algorithm: "sha256" | "sha512",
  ): Promise<Uint8Array>;
  /**
   * @deprecated ⚠️️ HAZMAT WARNING ⚠️️: DO NOT USE THIS FOR NEW CODE. CONTACT KEY MANAGEMENT IF YOU THINK YOU NEED TO. Implement low-level crypto operations
   * in the SDK instead. Further, you should probably never find yourself using this low-level crypto function.
   */
  abstract hkdfExpand(
    prk: Uint8Array,
    info: string | Uint8Array,
    outputByteSize: number,
    algorithm: "sha256" | "sha512",
  ): Promise<Uint8Array>;
  /**
   * @deprecated ️️⚠️️ HAZMAT WARNING ⚠️️: DO NOT USE THIS FOR NEW CODE. CONTACT KEY MANAGEMENT IF YOU THINK YOU NEED TO. Implement low-level crypto operations
   * in the SDK instead. Further, you should probably never find yourself using this low-level crypto function.
   */
  abstract hash(
    value: string | Uint8Array,
    algorithm: "sha1" | "sha256" | "sha512" | "md5",
  ): Promise<Uint8Array>;
  /**
   * @deprecated ️️⚠️️ HAZMAT WARNING ⚠️️: DO NOT USE THIS FOR NEW CODE. CONTACT KEY MANAGEMENT IF YOU THINK YOU NEED TO. Implement low-level crypto operations
   * in the SDK instead. Further, you should probably never find yourself using this low-level crypto function.
   */
  abstract rsaEncrypt(
    data: Uint8Array,
    publicKey: Uint8Array,
    algorithm: "sha1",
  ): Promise<Uint8Array>;
  /**
   * @deprecated ️️⚠️️ HAZMAT WARNING ⚠️️: DO NOT USE THIS FOR NEW CODE. CONTACT KEY MANAGEMENT IF YOU THINK YOU NEED TO. Implement low-level crypto operations
   * in the SDK instead. Further, you should probably never find yourself using this low-level crypto function.
   */
  abstract rsaDecrypt(
    data: Uint8Array,
    privateKey: Uint8Array,
    algorithm: "sha1",
  ): Promise<Uint8Array>;
  abstract rsaExtractPublicKey(privateKey: Uint8Array): Promise<Uint8Array>;
  abstract rsaGenerateKeyPair(length: 2048): Promise<[Uint8Array, Uint8Array]>;
  /**
   * Generates a key of the given length suitable for use in AES encryption
   */
  abstract aesGenerateKey(bitLength: 128 | 192 | 256 | 512): Promise<CsprngArray>;
  /**
   * Generates a random array of bytes of the given length. Uses a cryptographically secure random number generator.
   * Do not use this for generating encryption keys. Use aesGenerateKey or rsaGenerateKeyPair instead.
   */
  abstract randomBytes(length: number): Promise<CsprngArray>;
}
