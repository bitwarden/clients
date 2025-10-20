import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { SetPinComponent as BaseSetPinComponent } from "@bitwarden/angular/auth/components/set-pin.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  templateUrl: "set-pin.component.html",
  imports: [
    DialogModule,
    CommonModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    FormFieldModule,
  ],
})
export class SetPinComponent extends BaseSetPinComponent {
  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(SetPinComponent);
  }
}
