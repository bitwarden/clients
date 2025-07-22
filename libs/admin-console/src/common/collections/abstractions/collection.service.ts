// FIXME: Update this file to be type safe and remove this and next line
import { Observable } from "rxjs";

import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { CollectionData, Collection, CollectionView } from "../models";

export abstract class CollectionService {
  abstract encryptedCollections$: Observable<Collection[]>;
  abstract decryptedCollections$: Observable<CollectionView[]>;

  abstract clearActiveUserCache(): Promise<void>;
  abstract encrypt(model: CollectionView): Promise<Collection>;
  abstract decryptedCollectionViews$(ids: CollectionId[]): Observable<CollectionView[]>;
  /**
   * @deprecated This method will soon be made private
   * See PM-12375
   */
  abstract decryptMany(
    collections: Collection[],
    orgKeys?: Record<OrganizationId, OrgKey>,
  ): Promise<CollectionView[]>;
  abstract get(id: string): Promise<Collection>;
  abstract getAll(): Promise<Collection[]>;
  abstract getAllDecrypted(): Promise<CollectionView[]>;
  abstract getAllNested(collections?: CollectionView[]): Promise<TreeNode<CollectionView>[]>;
  abstract getNested(id: string): Promise<TreeNode<CollectionView>>;
  abstract upsert(collection: CollectionData | CollectionData[]): Promise<any>;
  abstract replace(collections: { [id: string]: CollectionData }, userId: UserId): Promise<any>;
  abstract clear(userId?: string): Promise<void>;
  abstract delete(id: string | string[]): Promise<any>;
}
