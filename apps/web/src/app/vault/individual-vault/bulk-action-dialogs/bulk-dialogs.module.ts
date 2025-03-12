import { NgModule } from "@angular/core";

import { SharedModule } from "../../../shared";

import { BulkDeleteDialogComponent } from "./bulk-delete-dialog/bulk-delete-dialog.component";
import { BulkMoveDialogComponent } from "./bulk-move-dialog/bulk-move-dialog.component";
import { BulkShareDialogComponent } from "./bulk-share-dialog/bulk-share-dialog.component";

@NgModule({
  imports: [SharedModule],
  declarations: [BulkDeleteDialogComponent, BulkMoveDialogComponent, BulkShareDialogComponent],
  exports: [BulkDeleteDialogComponent, BulkMoveDialogComponent, BulkShareDialogComponent],
})
export class BulkDialogsModule {}
