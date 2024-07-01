import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { PluralizePipe } from "@bitwarden/angular/pipes/pluralize.pipe";
import { DialogService } from "@bitwarden/components";
import {
  AssignCollectionsComponent,
  CollectionAssignmentParams,
  CollectionAssignmentResult,
} from "@bitwarden/vault";

import { SharedModule } from "../../../shared";

@Component({
  imports: [SharedModule, AssignCollectionsComponent, PluralizePipe],
  templateUrl: "./assign-collections-web.component.html",
  standalone: true,
})
export class AssignCollectionsWebComponent {
  protected loading = false;
  protected disabled = false;
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
