import { NgModule } from "@angular/core";

import { SharedModule } from "../../../shared";

import { BulkDeleteDialogComponent } from "./bulk-delete-dialog/bulk-delete-dialog.component";
import { BulkMoveDialogComponent } from "./bulk-move-dialog/bulk-move-dialog.component";

@NgModule({
  imports: [SharedModule],
  declarations: [BulkDeleteDialogComponent, BulkMoveDialogComponent],
  exports: [BulkDeleteDialogComponent, BulkMoveDialogComponent],
})
export class BulkDialogsModule {}
