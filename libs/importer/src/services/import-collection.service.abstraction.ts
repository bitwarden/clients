// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";

export abstract class ImportCollectionServiceAbstraction {
  abstract getAllAdminCollections(organizationId: string): Promise<CollectionView[]>;
}
