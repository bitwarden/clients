import { Injectable, inject } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";
import {
  BulkEditCollectionAccessDialogRef,
  BulkEditCollectionAccessParams,
  BulkEditCollectionAccessResult,
} from "@bitwarden/vault";

import {
  BulkCollectionsDialogComponent,
  BulkCollectionsDialogResult,
} from "./bulk-collections-dialog.component";

@Injectable()
export class BulkEditCollectionAccessWebDialogAdapter implements BulkEditCollectionAccessDialogRef {
  private readonly dialogService = inject(DialogService);

  async open(params: BulkEditCollectionAccessParams): Promise<BulkEditCollectionAccessResult> {
    const dialog = BulkCollectionsDialogComponent.open(this.dialogService, { data: params });
    const result = await lastValueFrom(dialog.closed);
    return result === BulkCollectionsDialogResult.Saved
      ? BulkEditCollectionAccessResult.Saved
      : BulkEditCollectionAccessResult.Canceled;
  }
}
