import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PluralizePipe } from "@bitwarden/angular/pipes/pluralize.pipe";
import { ButtonModule, DialogModule, DialogService } from "@bitwarden/components";
import {
  AssignCollectionsComponent,
  CollectionAssignmentParams,
  CollectionAssignmentResult,
} from "@bitwarden/vault";

@Component({
  standalone: true,
  templateUrl: "./assign-collections-desktop.component.html",
  imports: [AssignCollectionsComponent, PluralizePipe, DialogModule, ButtonModule, JslibModule],
})
export class AssignCollectionsDesktopComponent {
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
      AssignCollectionsDesktopComponent,
      config,
    );
  }
}
