import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
} from "@bitwarden/components";

import { LoginStrategyServiceAbstraction } from "../../common/abstractions/login-strategy.service";
import { PasswordLoginStrategy } from "../../common/login-strategies/password-login.strategy";

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
    code: ["", [Validators.required]],
  });

  protected disableRequestOTP = false;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private passwordLoginStrategy: PasswordLoginStrategy,
    private apiService: ApiService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private logService: LogService,
  ) {}

  async ngOnInit() {
    // Redirect to login if session times out
    this.passwordLoginStrategy.sessionTimeout$
      .pipe(takeUntil(this.destroy$))
      .subscribe((timedOut) => {
        if (timedOut) {
          this.logService.error("Session timed out.");
          void this.router.navigate(["/login"]);
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
    if (this.formGroup.invalid) {
      return;
    }

    const codeControl = this.formGroup.get("code");
    const code = codeControl?.value;
    if (!codeControl || !code) {
      this.logService.error("Code is required");
      return;
    }

    try {
      const authResult = await this.loginStrategyService.logInNewDeviceVerification(code);

      if (authResult.requiresTwoFactor) {
        await this.router.navigate(["/2fa"]);
        return;
      }

      if (authResult.forcePasswordReset) {
        await this.router.navigate(["/update-temp-password"]);
        return;
      }

      // If verification succeeds, navigate to vault
      await this.router.navigate(["/vault"]);
    } catch (e) {
      this.logService.error(e);
      codeControl.setErrors({ invalid: true });
    }
  };
}
