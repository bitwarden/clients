import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Params, Router, RouterModule } from "@angular/router";
import { EMPTY, Subject, from, switchMap, takeUntil, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterVerificationEmailClickedRequest } from "@bitwarden/common/auth/models/request/registration/register-verification-email-clicked.request";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";

import { InputPasswordComponent } from "../../input-password/input-password.component";
import { PasswordInputResult } from "../../input-password/password-input-result";

import { RegistrationFinishService } from "./registration-finish.service";

@Component({
  standalone: true,
  selector: "auth-registration-finish",
  templateUrl: "./registration-finish.component.html",
  imports: [CommonModule, JslibModule, RouterModule, InputPasswordComponent],
})
export class RegistrationFinishComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  submitting = false;
  email: string;

  // Note: this token is the email verification token. It is always supplied as a query param, but
  // it either comes from the email verification email or, if email verification is disabled server side
  // via global settings, it comes directly from the registration-start component directly.
  emailVerificationToken: string;

  masterPasswordPolicyOptions: MasterPasswordPolicyOptions | null = null;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private toastService: ToastService,
    private i18nService: I18nService,
    private registrationFinishService: RegistrationFinishService,
    private validationService: ValidationService,
    private accountApiService: AccountApiService,
  ) {}

  async ngOnInit() {
    this.listenForQueryParamChanges();
    this.masterPasswordPolicyOptions =
      await this.registrationFinishService.getMasterPasswordPolicyOptsFromOrgInvite();
  }

  private listenForQueryParamChanges() {
    this.activatedRoute.queryParams
      .pipe(
        tap((qParams: Params) => {
          if (qParams.email != null && qParams.email.indexOf("@") > -1) {
            this.email = qParams.email;
          }

          if (qParams.token != null) {
            this.emailVerificationToken = qParams.token;
          }
        }),
        switchMap((qParams: Params) => {
          if (
            qParams.fromEmail &&
            qParams.fromEmail === "true" &&
            this.email &&
            this.emailVerificationToken
          ) {
            return from(
              this.registerVerificationEmailClicked(this.email, this.emailVerificationToken),
            );
          } else {
            // org invite flow
            this.loading = false;
            return EMPTY;
          }
        }),

        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    this.submitting = true;
    try {
      await this.registrationFinishService.finishRegistration(
        this.email,
        passwordInputResult,
        this.emailVerificationToken,
      );
    } catch (e) {
      this.validationService.showError(e);
      this.submitting = false;
      return;
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("newAccountCreated"),
    });

    this.submitting = false;
    await this.router.navigate(["/login"], { queryParams: { email: this.email } });
  }

  private async registerVerificationEmailClicked(email: string, emailVerificationToken: string) {
    const request = new RegisterVerificationEmailClickedRequest(email, emailVerificationToken);

    try {
      const result = await this.accountApiService.registerVerificationEmailClicked(request);

      if (result == null) {
        this.toastService.showToast({
          title: null,
          message: this.i18nService.t("emailVerifiedV2"),
          variant: "success",
        });
        this.loading = false;
      }
    } catch (e) {
      await this.handleRegisterVerificationEmailClickedError(e);
      this.loading = false;
    }
  }

  private async handleRegisterVerificationEmailClickedError(e: unknown) {
    if (e instanceof ErrorResponse) {
      const errorResponse = e as ErrorResponse;
      switch (errorResponse.statusCode) {
        case HttpStatusCode.BadRequest: {
          if (errorResponse.message.includes("Expired link")) {
            await this.router.navigate(["/signup-link-expired"]);
          } else {
            this.validationService.showError(errorResponse);
          }

          break;
        }
        default:
          this.validationService.showError(errorResponse);
          break;
      }
    } else {
      this.validationService.showError(e);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
