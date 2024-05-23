import { Decryptable } from "../interfaces/decryptable.interface";
import { InitializerMetadata } from "../interfaces/initializer-metadata.interface";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

export abstract class BulkEncryptService {
  abstract decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]>;
}
