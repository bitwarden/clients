import { NgModule } from "@angular/core";

import { Vfo1I18nPipe } from "@bitwarden/vault";

import { SharedModule } from "../../../shared";

import { BulkDeleteDialogComponent } from "./bulk-delete-dialog/bulk-delete-dialog.component";

@NgModule({
  imports: [SharedModule, Vfo1I18nPipe],
  declarations: [BulkDeleteDialogComponent],
  exports: [BulkDeleteDialogComponent],
})
export class BulkDeleteDialogsModule {}
