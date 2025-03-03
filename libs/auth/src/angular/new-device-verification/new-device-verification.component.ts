import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  ToastService,
} from "@bitwarden/components";

import { LoginEmailServiceAbstraction } from "../../common/abstractions/login-email.service";
import { LoginStrategyServiceAbstraction } from "../../common/abstractions/login-strategy.service";

/**
 * Component for verifying a new device via a one-time password (OTP).
 */
@Component({
  standalone: true,
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
    private toastService: ToastService,
    private i18nService: I18nService,
    private syncService: SyncService,
    private loginEmailService: LoginEmailServiceAbstraction,
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

      if (authResult.forcePasswordReset) {
        await this.router.navigate(["/update-temp-password"]);
        return;
      }

      this.loginEmailService.clearValues();

      await this.syncService.fullSync(true);

      // If verification succeeds, navigate to vault
      await this.router.navigate(["/vault"]);
    } catch (e) {
      this.logService.error(e);
      const errorMessage =
        (e as any)?.response?.error_description ?? this.i18nService.t("errorOccurred");
      codeControl.setErrors({ serverError: { message: errorMessage } });
    }
  };
}
