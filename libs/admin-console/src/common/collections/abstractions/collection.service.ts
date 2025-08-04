import { Observable } from "rxjs";

import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { CollectionData, Collection, CollectionView } from "../models";

export abstract class CollectionService {
  abstract encryptedCollections$(userId: UserId): Observable<Collection[] | null>;
  abstract decryptedCollections$(userId: UserId): Observable<CollectionView[]>;
  abstract upsert(collection: CollectionData, userId: UserId): Promise<any>;
  abstract replace(collections: { [id: string]: CollectionData }, userId: UserId): Promise<any>;
  /**
   * @deprecated This method will soon be made private, use `decryptedCollections$` instead.
   */
  abstract decryptMany$(
    collections: Collection[],
    orgKeys: Record<OrganizationId, OrgKey>,
  ): Observable<CollectionView[]>;
  abstract delete(ids: CollectionId[], userId: UserId): Promise<any>;
  abstract encrypt(model: CollectionView, userId: UserId): Promise<Collection>;
  /**
   * Transforms the input CollectionViews into TreeNodes
   */
  abstract getAllNested(collections: CollectionView[]): TreeNode<CollectionView>[];
  /*
   * Transforms the input CollectionViews into TreeNodes and then returns the Treenode with the specified id
   */
  abstract getNested(collections: CollectionView[], id: string): TreeNode<CollectionView>;
}
