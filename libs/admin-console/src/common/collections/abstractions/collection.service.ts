import { Observable } from "rxjs";

import { CollectionId, UserId } from "@bitwarden/common/types/guid";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { CollectionData, Collection, CollectionView } from "../models";

export abstract class CollectionService {
  abstract encryptedCollections$: (userId: UserId) => Observable<Collection[]>;
  abstract decryptedCollections$: (userId: UserId) => Observable<CollectionView[]>;
  abstract upsert: (collection: CollectionData | CollectionData[], userId: UserId) => Promise<any>;
  abstract replace: (collections: { [id: string]: CollectionData }, userId: UserId) => Promise<any>;
  /**
   * Clear decrypted state without affecting encrypted state.
   * Used for locking the vault.
   */
  abstract clearDecryptedState: (userId: UserId) => Promise<void>;
  /**
   * Clear decrypted and encrypted state.
   * Used for logging out.
   */
  abstract clear: (userId: UserId) => Promise<void>;
  abstract delete: (id: CollectionId | CollectionId[], userId: UserId) => Promise<any>;
  abstract encrypt: (model: CollectionView, userId: UserId) => Promise<Collection>;
  /**
   * Transforms the input CollectionViews into TreeNodes
   */
  abstract getAllNested: (collections: CollectionView[]) => TreeNode<CollectionView>[];
  /**
   * Transforms the input CollectionViews into TreeNodes and then returns the Treenode with the specified id
   */
  abstract getNested: (collections: CollectionView[], id: string) => TreeNode<CollectionView>;
}
