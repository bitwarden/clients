// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LoginEmailServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PasswordHintRequest } from "@bitwarden/common/auth/models/request/password-hint.request";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  ToastService,
} from "@bitwarden/components";

@Component({
  standalone: true,
  templateUrl: "./password-hint.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    FormFieldModule,
    JslibModule,
    ReactiveFormsModule,
    RouterModule,
  ],
})
export class PasswordHintComponent implements OnInit {
  protected clientType: ClientType;

  protected formGroup = this.formBuilder.group({
    email: ["", [Validators.required, Validators.email]],
  });

  protected get email() {
    return this.formGroup.controls.email.value;
  }

  constructor(
    private apiService: ApiService,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private loginEmailService: LoginEmailServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private router: Router,
  ) {
    this.clientType = this.platformUtilsService.getClientType();
  }

  async ngOnInit(): Promise<void> {
    const email = (await firstValueFrom(this.loginEmailService.loginEmail$)) ?? "";
    this.formGroup.controls.email.setValue(email);
  }

  submit = async () => {
    const isEmailValid = this.validateEmailOrShowToast(this.email);
    if (!isEmailValid) {
      return;
    }

    await this.apiService.postPasswordHint(new PasswordHintRequest(this.email));

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("masterPassSent"),
    });

    await this.router.navigate(["login"]);
  };

  protected async cancel() {
    this.loginEmailService.setLoginEmail(this.email);
    await this.router.navigate(["login"]);
  }

  private validateEmailOrShowToast(email: string): boolean {
    // If email is null or empty, show error toast and return false
    if (email == null || email === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("emailRequired"),
      });
      return false;
    }

    // If not a valid email format, show error toast and return false
    if (email.indexOf("@") === -1) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidEmail"),
      });
      return false;
    }

    return true; // email is valid
  }
}
