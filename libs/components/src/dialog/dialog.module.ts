import { DialogModule as CdkDialogModule } from "@angular/cdk/dialog";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { AsyncActionsModule } from "../async-actions";
import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { SharedModule } from "../shared";

import { DialogComponent } from "./dialog/dialog.component";
import { DialogService } from "./dialog.service";
import { DialogCloseDirective } from "./directives/dialog-close.directive";
import { DialogTitleContainerDirective } from "./directives/dialog-title-container.directive";
import { SimpleConfigurableDialogComponent } from "./simple-dialog/simple-configurable-dialog/simple-configurable-dialog.component";
import { IconDirective, SimpleDialogComponent } from "./simple-dialog/simple-dialog.component";

@NgModule({
  imports: [
    SharedModule,
    AsyncActionsModule,
    ButtonModule,
    CdkDialogModule,
    IconButtonModule,
    ReactiveFormsModule,
  ],
  declarations: [
    DialogCloseDirective,
    DialogTitleContainerDirective,
    DialogComponent,
    SimpleDialogComponent,
    SimpleConfigurableDialogComponent,
    IconDirective,
  ],
  exports: [
    CdkDialogModule,
    DialogComponent,
    SimpleDialogComponent,
    DialogCloseDirective,
    IconDirective,
  ],
  providers: [DialogService],
})
export class DialogModule {}
