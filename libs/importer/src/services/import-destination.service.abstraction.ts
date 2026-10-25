import { Observable } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { UserId } from "@bitwarden/common/types/guid";

import { ImportDestinations } from "../models/import-destination";
import { ImportResult } from "../models/import-result";

/** The part of `CollectionService` the importer uses; it can't import admin-console itself. */
export interface ImportDestinationCollections {
  decryptedCollections$(userId: UserId): Observable<CollectionView[]>;
}

export abstract class ImportDestinationServiceAbstraction {
  /** Re-emits when orgs, collections or policies change. Errors if any lookup fails. */
  abstract readonly destinations$: Observable<ImportDestinations>;

  /** Items of `result` that will import: everything except types a policy removes. */
  abstract importableCount(result: ImportResult): Promise<number>;

  /** Whether an org import with no shared folder chosen would be rejected for unassigned items. */
  abstract hasUnassignedItems(result: ImportResult): Promise<boolean>;
}
