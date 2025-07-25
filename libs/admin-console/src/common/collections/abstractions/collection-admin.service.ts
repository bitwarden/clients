import { CollectionDetailsResponse } from "@bitwarden/admin-console/common";
import { UserId } from "@bitwarden/common/types/guid";

import { CollectionAccessSelectionView, CollectionAdminView } from "../models";

export abstract class CollectionAdminService {
  abstract getAll(organizationId: string): Promise<CollectionAdminView[]>;
  abstract get(
    organizationId: string,
    collectionId: string,
  ): Promise<CollectionAdminView | undefined>;
  abstract save(
    collection: CollectionAdminView,
    userId: UserId,
  ): Promise<CollectionDetailsResponse>;
  abstract delete(organizationId: string, collectionId: string): Promise<void>;
  abstract bulkAssignAccess(
    organizationId: string,
    collectionIds: string[],
    users: CollectionAccessSelectionView[],
    groups: CollectionAccessSelectionView[],
  ): Promise<void>;
}
