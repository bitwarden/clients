import { Observable } from "rxjs";

import { Collection } from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { UserId } from "@bitwarden/common/types/guid";

/**
 * The result of decrypting a batch of collections where individual failures do not abort the
 * rest of the batch. A collection that fails to decrypt is returned in `failure` instead of
 * being silently dropped.
 */
export type CollectionDecryptionResult = {
  success: CollectionView[];
  failure: Collection[];
};

/**
 * Service responsible for encrypting and decrypting collections using the Rust SDK.
 */
export abstract class CollectionEncryptionService {
  /**
   * Decrypts a single collection using the SDK for the given userId.
   *
   * @param collection The encrypted collection object
   * @param userId The user ID whose keys will be used for decryption
   *
   * @returns An observable that emits the decrypted collection view
   */
  abstract decrypt(collection: Collection, userId: UserId): Observable<CollectionView>;

  /**
   * Decrypts many collections using the SDK for the given userId.
   *
   * @param collections The encrypted collection objects
   * @param userId The user ID whose keys will be used for decryption
   *
   * @returns An observable that emits an array of decrypted collection views
   */
  abstract decryptMany(collections: Collection[], userId: UserId): Observable<CollectionView[]>;

  /**
   * Decrypts many collections using the SDK for the given userId, returning successes and
   * failures separately. Unlike `decryptMany`, a single collection that fails to decrypt does
   * not silently drop — it is returned in `failure` instead.
   *
   * Implementations may use `FeatureFlag.CollectionBulkDecryptWithFailures` to choose between a
   * batched SDK call and decrypting collections one at a time, but both paths must uphold this
   * success/failure contract.
   *
   * @param collections The encrypted collection objects
   * @param userId The user ID whose keys will be used for decryption
   *
   * @returns An observable that emits a {@link CollectionDecryptionResult}
   */
  abstract decryptManyWithFailures(
    collections: Collection[],
    userId: UserId,
  ): Observable<CollectionDecryptionResult>;
}
