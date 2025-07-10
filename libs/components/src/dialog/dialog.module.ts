import { DialogModule as CdkDialogModule } from "@angular/cdk/dialog";
import { NgModule } from "@angular/core";

import { DialogComponent } from "./dialog/dialog.component";
import { DialogService } from "./dialog.service";
import { DialogCloseDirective } from "./directives/dialog-close.directive";
import { IconDirective, SimpleDialogComponent } from "./simple-dialog/simple-dialog.component";

@NgModule({
  imports: [
    CdkDialogModule,
    DialogCloseDirective,
    DialogComponent,
    SimpleDialogComponent,
    IconDirective,
  ],
  exports: [
    CdkDialogModule,
    DialogCloseDirective,
    DialogComponent,
    IconDirective,
    SimpleDialogComponent,
  ],
  providers: [DialogService],
})
export class DialogModule {}
