// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionDetailsResponse } from "@bitwarden/admin-console/common";

import { CollectionAccessSelectionView, CollectionAdminView } from "../models";

export abstract class CollectionAdminService {
  getAll: (organizationId: string) => Promise<CollectionAdminView[]>;
  get: (organizationId: string, collectionId: string) => Promise<CollectionAdminView | undefined>;
  save: (collection: CollectionAdminView) => Promise<CollectionDetailsResponse>;
  delete: (organizationId: string, collectionId: string) => Promise<void>;
  bulkAssignAccess: (
    organizationId: string,
    collectionIds: string[],
    users: CollectionAccessSelectionView[],
    groups: CollectionAccessSelectionView[],
  ) => Promise<void>;
}
