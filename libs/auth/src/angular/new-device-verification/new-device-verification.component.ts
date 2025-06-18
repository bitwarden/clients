import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LoginSuccessHandlerService } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
} from "@bitwarden/components";

import { LoginStrategyServiceAbstraction } from "../../common/abstractions/login-strategy.service";

/**
 * Component for verifying a new device via a one-time password (OTP).
 */
@Component({
  selector: "app-new-device-verification",
  templateUrl: "./new-device-verification.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    JslibModule,
    ButtonModule,
    FormFieldModule,
    IconButtonModule,
    LinkModule,
  ],
})
export class NewDeviceVerificationComponent implements OnInit, OnDestroy {
  formGroup = this.formBuilder.group({
    code: [
      "",
      {
        validators: [Validators.required],
        updateOn: "change",
      },
    ],
  });

  protected disableRequestOTP = false;
  private destroy$ = new Subject<void>();
  protected authenticationSessionTimeoutRoute = "/authentication-timeout";

  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private apiService: ApiService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private logService: LogService,
    private i18nService: I18nService,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
  ) {}

  async ngOnInit() {
    // Redirect to timeout route if session expires
    this.loginStrategyService.authenticationSessionTimeout$
      .pipe(takeUntil(this.destroy$))
      .subscribe((expired) => {
        if (!expired) {
          return;
        }

        try {
          void this.router.navigate([this.authenticationSessionTimeoutRoute]);
        } catch (err) {
          this.logService.error(
            `Failed to navigate to ${this.authenticationSessionTimeoutRoute} route`,
            err,
          );
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Resends the OTP for device verification.
   */
  async resendOTP() {
    this.disableRequestOTP = true;
    try {
      const email = await this.loginStrategyService.getEmail();
      const masterPasswordHash = await this.loginStrategyService.getMasterPasswordHash();

      if (!email || !masterPasswordHash) {
        throw new Error("Missing email or master password hash");
      }

      await this.apiService.send(
        "POST",
        "/accounts/resend-new-device-otp",
        {
          email: email,
          masterPasswordHash: masterPasswordHash,
        },
        false,
        false,
      );
    } catch (e) {
      this.logService.error(e);
    } finally {
      this.disableRequestOTP = false;
    }
  }

  /**
   * Submits the OTP for device verification.
   */
  submit = async (): Promise<void> => {
    const codeControl = this.formGroup.get("code");
    if (!codeControl || !codeControl.value) {
      return;
    }

    try {
      const authResult = await this.loginStrategyService.logInNewDeviceVerification(
        codeControl.value,
      );

      if (authResult.requiresTwoFactor) {
        await this.router.navigate(["/2fa"]);
        return;
      }

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.loginSuccessHandlerService.run(authResult.userId);

      // If verification succeeds, navigate to vault
      await this.router.navigate(["/vault"]);
    } catch (e) {
      this.logService.error(e);
      let errorMessage =
        ((e as any)?.response?.error_description as string) ?? this.i18nService.t("errorOccurred");

      if (errorMessage.includes("Invalid New Device OTP")) {
        errorMessage = this.i18nService.t("invalidVerificationCode");
      }

      codeControl.setErrors({ serverError: { message: errorMessage } });
      // For enter key press scenarios, we have to manually mark the control as touched
      // to get the error message to display
      codeControl.markAsTouched();
    }
  };
}
