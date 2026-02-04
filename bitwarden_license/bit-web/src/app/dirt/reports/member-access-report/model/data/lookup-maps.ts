import { CollectionAccess } from "./collection-access";

/**
 * Lookup maps for efficient data access during member processing.
 * These maps provide O(1) access to related data structures built during report generation.
 */
export interface LookupMaps {
  /** Map: userId → direct collection access[] */
  userCollectionMap: Map<string, CollectionAccess[]>;
  /** Map: groupId → collection access[] */
  groupCollectionMap: Map<string, CollectionAccess[]>;
  /** Map: userId → groupId[] */
  userGroupMap: Map<string, string[]>;
  /** Map: collectionId → cipher count */
  collectionCipherCountMap: Map<string, number>;
  /** Map: groupId → group name */
  groupNameMap: Map<string, string>;
  /** Map: collectionId → collection name (decrypted) */
  collectionNameMap: Map<string, string>;
}
