// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";

export abstract class ImportCollectionServiceAbstraction {
  getAllAdminCollections: (organizationId: string) => Promise<CollectionView[]>;
}
