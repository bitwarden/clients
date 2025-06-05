import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { Decryptable } from "../../../platform/interfaces/decryptable.interface";
import { InitializerMetadata } from "../../../platform/interfaces/initializer-metadata.interface";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";

export abstract class BulkEncryptService {
  abstract decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]>;

  abstract onServerConfigChange(newConfig: ServerConfig): void;
}
