import { Observable } from "rxjs";

import { Collection } from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { UserId } from "@bitwarden/common/types/guid";

/**
 * Result of decrypting a batch of collections. Collections that fail to decrypt are returned
 * in `failure` instead of aborting the batch.
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
   * Like `decryptMany`, but returns failures separately instead of dropping them.
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
