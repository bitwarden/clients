import { Observable } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { ImportDestinations } from "../models/import-destination";
import { ImportResult } from "../models/import-result";

/** The part of `CollectionService` the importer uses; it can't import admin-console itself. */
export interface ImportDestinationCollections {
  decryptedCollections$(userId: UserId): Observable<CollectionView[]>;
}

export abstract class ImportDestinationServiceAbstraction {
  /** Re-emits when orgs, collections or policies change. Errors if any lookup fails. */
  abstract readonly destinations$: Observable<ImportDestinations>;

  /**
   * Whether an org import with no shared folder chosen would be rejected for unassigned items,
   * counting only the items the organization lets through.
   */
  abstract hasUnassignedItems(
    result: ImportResult,
    organizationId?: OrganizationId,
  ): Promise<boolean>;
}
