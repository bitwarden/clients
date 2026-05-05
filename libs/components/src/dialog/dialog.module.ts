import { DialogModule as CdkDialogModule } from "@angular/cdk/dialog";
import { NgModule } from "@angular/core";

import { DialogComponent } from "./dialog/dialog.component";
import { DialogService } from "./dialog.service";
import { DialogCloseDirective } from "./directives/dialog-close.directive";
import {
  DialogFooterDirective,
  IconDirective,
  SimpleDialogComponent,
} from "./simple-dialog/simple-dialog.component";

@NgModule({
  imports: [
    CdkDialogModule,
    DialogCloseDirective,
    DialogComponent,
    SimpleDialogComponent,
    IconDirective,
    DialogFooterDirective,
  ],
  exports: [
    CdkDialogModule,
    DialogCloseDirective,
    DialogComponent,
    IconDirective,
    DialogFooterDirective,
    SimpleDialogComponent,
  ],
  providers: [DialogService],
})
export class DialogModule {}
