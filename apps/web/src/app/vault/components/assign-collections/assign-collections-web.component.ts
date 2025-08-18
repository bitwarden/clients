// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";

import { PluralizePipe } from "@bitwarden/angular/pipes/pluralize.pipe";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";
import {
  AssignCollectionsComponent,
  CollectionAssignmentParams,
  CollectionAssignmentResult,
} from "@bitwarden/vault";

import { SharedModule } from "../../../shared";

@Component({
  imports: [SharedModule, AssignCollectionsComponent, PluralizePipe],
  templateUrl: "./assign-collections-web.component.html",
})
export class AssignCollectionsWebComponent {
  protected editableItemCount: number;

  constructor(
    @Inject(DIALOG_DATA) public params: CollectionAssignmentParams,
    private dialogRef: DialogRef<CollectionAssignmentResult>,
  ) {}

  protected async onCollectionAssign(result: CollectionAssignmentResult) {
    this.dialogRef.close(result);
  }

  static open(dialogService: DialogService, config: DialogConfig<CollectionAssignmentParams>) {
    return dialogService.open<CollectionAssignmentResult, CollectionAssignmentParams>(
      AssignCollectionsWebComponent,
      config,
    );
  }
}
