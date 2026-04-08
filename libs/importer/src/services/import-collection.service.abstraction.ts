// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { UserId } from "@bitwarden/user-core";

export abstract class ImportCollectionServiceAbstraction {
  getAllAdminCollections: (organizationId: string, userId: UserId) => Promise<CollectionView[]>;
}
