import { NgModule } from "@angular/core";

import { SharedModule } from "../../../shared";

import { BulkDeleteDialogComponent } from "./bulk-delete-dialog/bulk-delete-dialog.component";

@NgModule({
  imports: [SharedModule],
  declarations: [BulkDeleteDialogComponent],
  exports: [BulkDeleteDialogComponent],
})
export class BulkDeleteDialogsModule {}
