// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BulkEncryptService } from "@bitwarden/common/key-management/crypto/abstractions/bulk-encrypt.service";
import { Decryptable } from "@bitwarden/common/platform/interfaces/decryptable.interface";
import { InitializerMetadata } from "@bitwarden/common/platform/interfaces/initializer-metadata.interface";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { EncryptService } from "../abstractions/encrypt.service";

/**
 * @deprecated Will be deleted in an immediate subsequent PR
 */
export class FallbackBulkEncryptService implements BulkEncryptService {
  private featureFlagEncryptService: BulkEncryptService;
  private currentServerConfig: ServerConfig | undefined = undefined;

  constructor(protected encryptService: EncryptService) {}

  /**
   * Decrypts items using a web worker if the environment supports it.
   * Will fall back to the main thread if the window object is not available.
   */
  async decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]> {
    return await this.encryptService.decryptItems(items, key);
  }

  async setFeatureFlagEncryptService(featureFlagEncryptService: BulkEncryptService) {}

  onServerConfigChange(newConfig: ServerConfig): void {}
}
