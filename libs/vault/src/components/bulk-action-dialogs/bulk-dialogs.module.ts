import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DialogModule,
  FormFieldModule,
  SelectModule,
} from "@bitwarden/components";

import { BulkMoveDialogComponent } from "./bulk-move-dialog/bulk-move-dialog.component";

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    SelectModule,
  ],
  declarations: [BulkMoveDialogComponent],
  exports: [BulkMoveDialogComponent],
})
export class BulkDialogsModule {}
