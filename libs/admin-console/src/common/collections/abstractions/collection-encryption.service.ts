import { Observable } from "rxjs";

import { Collection } from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { UserId } from "@bitwarden/common/types/guid";

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
   * A collection that fails to decrypt never aborts the rest of the batch. What happens to it
   * depends on the `CollectionBulkDecryptWithFailures` feature flag: while the flag is off the
   * failure is logged and the collection is dropped from the result; once it is on the collection
   * is included with `decryptionFailure` set and its `name` replaced by the decrypt-error
   * placeholder, so the item is still shown to the user rather than silently disappearing.
   *
   * @param collections The encrypted collection objects
   * @param userId The user ID whose keys will be used for decryption
   *
   * @returns An observable that emits an array of decrypted collection views
   */
  abstract decryptMany(collections: Collection[], userId: UserId): Observable<CollectionView[]>;
}
