// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BulkEncryptService } from "../../abstractions/bulk-encrypt.service";
import { EncryptService } from "../../abstractions/encrypt.service";
import { Decryptable } from "../../interfaces/decryptable.interface";
import { InitializerMetadata } from "../../interfaces/initializer-metadata.interface";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";

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
