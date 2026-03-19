import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { SetPinComponent as BaseSetPinComponent } from "@bitwarden/angular/auth/components/set-pin.component";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "set-pin.component.html",
  imports: [
    DialogModule,
    CommonModule,
    I18nPipe,
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
