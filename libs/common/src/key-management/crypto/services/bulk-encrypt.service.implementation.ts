import { BulkEncryptService } from "@bitwarden/common/key-management/crypto/abstractions/bulk-encrypt.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Decryptable } from "@bitwarden/common/platform/interfaces/decryptable.interface";
import { InitializerMetadata } from "@bitwarden/common/platform/interfaces/initializer-metadata.interface";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { DefaultFeatureFlagValue, FeatureFlag } from "../../../enums/feature-flag.enum";
import { ServerConfig } from "../../../platform/abstractions/config/server-config";

/**
 * @deprecated Will be deleted in an immediate subsequent PR
 */
export class BulkEncryptServiceImplementation implements BulkEncryptService {
  protected useSDKForDecryption: boolean = DefaultFeatureFlagValue[FeatureFlag.UseSDKForDecryption];

  constructor(
    protected cryptoFunctionService: CryptoFunctionService,
    protected logService: LogService,
  ) {}

  /**
   * Decrypts items using a web worker if the environment supports it.
   * Will fall back to the main thread if the window object is not available.
   */
  async decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (items == null || items.length < 1) {
      return [];
    }

    const results = [];
    for (let i = 0; i < items.length; i++) {
      results.push(await items[i].decrypt(key));
    }
    return results;
  }

  onServerConfigChange(newConfig: ServerConfig): void {}
}
