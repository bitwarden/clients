import { Injectable, inject } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";
import {
  AssignCollectionsDialogRef,
  AssignCollectionsParams,
  AssignCollectionsResult,
  CollectionAssignmentResult,
} from "@bitwarden/vault";

import { AssignCollectionsWebComponent } from "./assign-collections-web.component";

@Injectable()
export class AssignCollectionsWebDialogAdapter implements AssignCollectionsDialogRef {
  private readonly dialogService = inject(DialogService);

  async open(params: AssignCollectionsParams): Promise<AssignCollectionsResult> {
    const dialog = AssignCollectionsWebComponent.open(this.dialogService, { data: params });
    const result = await lastValueFrom(dialog.closed);
    return result === CollectionAssignmentResult.Saved
      ? AssignCollectionsResult.Saved
      : AssignCollectionsResult.Canceled;
  }
}
