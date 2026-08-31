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
   * Collections that fail to decrypt do not abort the rest of the batch. Instead they are
   * included in the result with `decryptionFailure` set and decryption-dependent fields (e.g.
   * `name`) left empty, so the item is still shown to the user rather than silently dropped.
   *
   * @param collections The encrypted collection objects
   * @param userId The user ID whose keys will be used for decryption
   *
   * @returns An observable that emits an array of decrypted collection views
   */
  abstract decryptMany(collections: Collection[], userId: UserId): Observable<CollectionView[]>;
}
