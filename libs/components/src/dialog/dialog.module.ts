import { DialogModule as CdkDialogModule } from "@angular/cdk/dialog";
import { NgModule } from "@angular/core";

import { DialogComponent } from "./dialog/dialog.component";
import { DialogContainerComponent } from "./dialog-container/dialog-container.component";
import { DialogService } from "./dialog.service";
import { DialogCloseDirective } from "./directives/dialog-close.directive";
import { IconDirective, SimpleDialogComponent } from "./simple-dialog/simple-dialog.component";

@NgModule({
  imports: [
    CdkDialogModule,
    DialogCloseDirective,
    DialogContainerComponent,
    DialogComponent,
    SimpleDialogComponent,
    IconDirective,
  ],
  exports: [
    CdkDialogModule,
    DialogCloseDirective,
    DialogContainerComponent,
    DialogComponent,
    IconDirective,
    SimpleDialogComponent,
  ],
  providers: [DialogService],
})
export class DialogModule {}
