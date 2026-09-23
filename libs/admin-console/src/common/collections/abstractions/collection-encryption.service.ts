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
   * @returns A promise that resolves to the decrypted collection view
   */
  abstract decrypt(collection: Collection, userId: UserId): Promise<CollectionView>;

  /**
   * Decrypts many collections using the SDK for the given userId.
   *
   * @param collections The encrypted collection objects
   * @param userId The user ID whose keys will be used for decryption
   *
   * @returns A promise that resolves to an array of decrypted collection views
   */
  abstract decryptMany(collections: Collection[], userId: UserId): Promise<CollectionView[]>;
}
