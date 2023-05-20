import { DialogModule as CdkDialogModule } from "@angular/cdk/dialog";
import { NgModule } from "@angular/core";

import { DialogServiceAbstraction } from "@bitwarden/angular/services/dialog";

import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { SharedModule } from "../shared";
import { SpinnerComponent } from "../spinner";

import { DialogComponent } from "./dialog/dialog.component";
import { DialogService } from "./dialog.service";
import { DialogCloseDirective } from "./directives/dialog-close.directive";
import { DialogTitleContainerDirective } from "./directives/dialog-title-container.directive";
import { SimpleConfigurableDialogComponent } from "./simple-configurable-dialog/simple-configurable-dialog.component";
import { IconDirective, SimpleDialogComponent } from "./simple-dialog/simple-dialog.component";

@NgModule({
  imports: [SharedModule, IconButtonModule, CdkDialogModule, ButtonModule, SpinnerComponent],
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
  providers: [
    {
      provide: DialogServiceAbstraction,
      useClass: DialogService,
    },
  ],
})
export class DialogModule {}
