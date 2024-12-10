// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { CollectionData, Collection, CollectionView } from "../models";

export abstract class CollectionService {
  encryptedCollections$: Observable<Collection[]>;
  decryptedCollections$: Observable<CollectionView[]>;

  clearActiveUserCache: () => Promise<void>;
  encrypt: (model: CollectionView) => Promise<Collection>;
  decryptedCollectionViews$: (ids: CollectionId[]) => Observable<CollectionView[]>;
  /**
   * @deprecated This method will soon be made private
   * See PM-12375
   */
  decryptMany: (
    collections: Collection[],
    orgKeys?: Record<OrganizationId, OrgKey>,
  ) => Promise<CollectionView[]>;
  get: (id: string) => Promise<Collection>;
  getAll: () => Promise<Collection[]>;
  getAllDecrypted: () => Promise<CollectionView[]>;
  getAllNested: (collections?: CollectionView[]) => Promise<TreeNode<CollectionView>[]>;
  getNested: (id: string) => Promise<TreeNode<CollectionView>>;
  upsert: (collection: CollectionData | CollectionData[]) => Promise<any>;
  replace: (collections: { [id: string]: CollectionData }, userId: UserId) => Promise<any>;
  clear: (userId?: string) => Promise<void>;
  delete: (id: string | string[]) => Promise<any>;
}
