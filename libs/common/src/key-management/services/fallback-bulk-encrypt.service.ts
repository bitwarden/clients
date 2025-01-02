// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Decryptable } from "@bitwarden/common/platform/interfaces/decryptable.interface";
import { InitializerMetadata } from "@bitwarden/common/platform/interfaces/initializer-metadata.interface";
import { EncryptService, SymmetricCryptoKey } from "@bitwarden/key-management";

import { BulkEncryptService } from "../abstractions/bulk-encrypt.service";

/**
 * @deprecated For the feature flag from PM-4154, remove once feature is rolled out
 */
export class FallbackBulkEncryptService implements BulkEncryptService {
  private featureFlagEncryptService: BulkEncryptService;

  constructor(protected encryptService: EncryptService) {}

  /**
   * Decrypts items using a web worker if the environment supports it.
   * Will fall back to the main thread if the window object is not available.
   */
  async decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]> {
    if (this.featureFlagEncryptService != null) {
      return await this.featureFlagEncryptService.decryptItems(items, key);
    } else {
      return await this.encryptService.decryptItems(items, key);
    }
  }

  async setFeatureFlagEncryptService(featureFlagEncryptService: BulkEncryptService) {
    this.featureFlagEncryptService = featureFlagEncryptService;
  }
}
