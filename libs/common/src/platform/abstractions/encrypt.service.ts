import { Decryptable } from "../interfaces/decryptable.interface";
import { Encrypted } from "../interfaces/encrypted";
import { InitializerMetadata } from "../interfaces/initializer-metadata.interface";
import { EncArrayBuffer } from "../models/domain/enc-array-buffer";
import { EncString } from "../models/domain/enc-string";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

export abstract class EncryptService {
  abstract encrypt(plainValue: string | Uint8Array, key: SymmetricCryptoKey): Promise<EncString>;
  abstract encryptToBytes: (
    plainValue: Uint8Array,
    key?: SymmetricCryptoKey
  ) => Promise<EncArrayBuffer>;
  abstract decryptToUtf8: (encString: EncString, key: SymmetricCryptoKey) => Promise<string>;
  abstract decryptToBytes: (encThing: Encrypted, key: SymmetricCryptoKey) => Promise<Uint8Array>;
  abstract resolveLegacyKey: (key: SymmetricCryptoKey, encThing: Encrypted) => SymmetricCryptoKey;
  abstract decryptItems: <T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey
  ) => Promise<T[]>;
}
