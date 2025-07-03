import { Decryptable } from "@bitwarden/common/platform/interfaces/decryptable.interface";
import { InitializerMetadata } from "@bitwarden/common/platform/interfaces/initializer-metadata.interface";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { ServerConfig } from "../../../platform/abstractions/config/server-config";

import { EncryptServiceImplementation } from "./encrypt.service.implementation";

/**
 * @deprecated Will be deleted in an immediate subsequent PR
 */
export class MultithreadEncryptServiceImplementation extends EncryptServiceImplementation {
  protected useSDKForDecryption: boolean = true;

  /**
   * Sends items to a web worker to decrypt them.
   * This utilises multithreading to decrypt items faster without interrupting other operations (e.g. updating UI).
   */
  async decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]> {
    return await super.decryptItems(items, key);
  }

  override onServerConfigChange(newConfig: ServerConfig): void {}
}
