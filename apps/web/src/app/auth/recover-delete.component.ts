// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DeleteRecoverRequest } from "@bitwarden/common/models/request/delete-recover.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-recover-delete",
  templateUrl: "recover-delete.component.html",
  imports: [
    ReactiveFormsModule,
    RouterLink,
    JslibModule,
    AsyncActionsModule,
    ButtonModule,
    FormFieldModule,
    I18nPipe,
    TypographyModule,
  ],
})
export class RecoverDeleteComponent {
  protected recoverDeleteForm = new FormGroup({
    email: new FormControl("", [Validators.required]),
  });

  get email() {
    return this.recoverDeleteForm.controls.email;
  }

  constructor(
    private router: Router,
    private apiService: ApiService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  submit = async () => {
    if (this.recoverDeleteForm.invalid) {
      return;
    }

    const request = new DeleteRecoverRequest();
    request.email = this.email.value.trim().toLowerCase();
    await this.apiService.postAccountRecoverDelete(request);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("deleteRecoverEmailSent"),
    });

    await this.router.navigate(["/"]);
  };
}
