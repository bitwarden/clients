// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionView } from "@bitwarden/admin-console/common";

export abstract class ImportCollectionServiceAbstraction {
  getAllAdminCollections: (organizationId: string) => Promise<CollectionView[]>;
}
