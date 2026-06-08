import { InjectionToken } from "@angular/core";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";

export interface BulkDeleteDialogParams {
  cipherIds?: string[];
  permanent?: boolean;
  organization?: Organization;
  organizations?: Organization[];
  collections?: CollectionView[];
  unassignedCiphers?: string[];
}

export const BulkDeleteDialogResult = {
  Deleted: "deleted",
  Canceled: "canceled",
} as const;

export type BulkDeleteDialogResult = UnionOfValues<typeof BulkDeleteDialogResult>;

export interface BulkDeleteDialogRef {
  open(params: BulkDeleteDialogParams): Promise<BulkDeleteDialogResult>;
}

export const BULK_DELETE_DIALOG = new InjectionToken<BulkDeleteDialogRef>("BULK_DELETE_DIALOG");
