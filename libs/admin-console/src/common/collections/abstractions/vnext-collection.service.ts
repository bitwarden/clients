// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { CollectionData, Collection, CollectionView } from "../models";

export abstract class vNextCollectionService {
  encryptedCollections$: (userId: UserId) => Observable<Collection[]>;
  decryptedCollections$: (userId: UserId) => Observable<CollectionView[]>;
  upsert: (collection: CollectionData | CollectionData[], userId: UserId) => Promise<any>;
  replace: (collections: { [id: string]: CollectionData }, userId: UserId) => Promise<any>;
  /**
   * Clear decrypted state without affecting encrypted state.
   * Used for locking the vault.
   */
  clearDecryptedState: (userId: UserId) => Promise<void>;
  /**
   * Clear decrypted and encrypted state.
   * Used for logging out.
   */
  clear: (userId: UserId) => Promise<void>;
  delete: (id: string | string[], userId: UserId) => Promise<any>;
  encrypt: (model: CollectionView) => Promise<Collection>;
  /**
   * @deprecated This method will soon be made private, use `decryptedCollections$` instead.
   */
  decryptMany: (
    collections: Collection[],
    orgKeys?: Record<OrganizationId, OrgKey> | null,
  ) => Promise<CollectionView[]>;
  /**
   * Transforms the input CollectionViews into TreeNodes
   */
  getAllNested: (collections: CollectionView[]) => TreeNode<CollectionView>[];
  /**
   * Transforms the input CollectionViews into TreeNodes and then returns the Treenode with the specified id
   */
  getNested: (collections: CollectionView[], id: string) => TreeNode<CollectionView>;
}
