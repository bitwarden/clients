import { Injectable, inject } from "@angular/core";
import { lastValueFrom } from "rxjs";
import { map } from "rxjs/operators";

import { DialogService } from "@bitwarden/components";
import {
  BulkDeleteDialogParams,
  BulkDeleteDialogRef,
  BulkDeleteDialogResult,
} from "@bitwarden/vault";

import { openBulkDeleteDialog } from "./bulk-delete-dialog/bulk-delete-dialog.component";

@Injectable()
export class BulkDeleteDialogWebAdapter implements BulkDeleteDialogRef {
  private readonly dialogService = inject(DialogService);

  async open(params: BulkDeleteDialogParams): Promise<BulkDeleteDialogResult> {
    const dialog = openBulkDeleteDialog(this.dialogService, { data: params });
    return lastValueFrom(dialog.closed.pipe(map((r) => r ?? BulkDeleteDialogResult.Canceled)));
  }
}
