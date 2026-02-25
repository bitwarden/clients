import { ChangeDetectionStrategy, Component, input, OnInit, output, signal } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import {
  emailAndOtpRequired,
  emailRequired,
  otpInvalid,
  passwordHashB64Invalid,
  passwordHashB64Required,
  SendAccessDomainCredentials,
  SendAccessToken,
  SendHashedPasswordB64,
  sendIdInvalid,
  SendOtp,
  SendTokenService,
} from "@bitwarden/common/auth/send-access";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";
import { SEND_KDF_ITERATIONS } from "@bitwarden/common/tools/send/send-kdf";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { AnonLayoutWrapperDataService, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

import { SendAccessEmailComponent } from "./send-access-email.component";
import { SendAccessPasswordComponent } from "./send-access-password.component";

@Component({
  selector: "app-send-auth",
  templateUrl: "send-auth.component.html",
  imports: [SendAccessPasswordComponent, SendAccessEmailComponent, SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendAuthComponent implements OnInit {
  protected readonly id = input.required<string>();
  protected readonly key = input.required<string>();

  protected accessGranted = output<{
    response?: SendAccessResponse;
    request?: SendAccessRequest;
    accessToken?: SendAccessToken;
  }>();

  authType = AuthType;

  private expiredAuthAttempts = 0;
  private otpSubmitted = false;

  readonly loading = signal<boolean>(false);
  readonly error = signal<boolean>(false);
  readonly unavailable = signal<boolean>(false);
  readonly sendAuthType = signal<AuthType>(AuthType.None);
  readonly enterOtp = signal<boolean>(false);

  sendAccessForm = this.formBuilder.group<{ password?: string; email?: string; otp?: string }>({});

  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private sendApiService: SendApiService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private formBuilder: FormBuilder,
    private configService: ConfigService,
    private sendTokenService: SendTokenService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
  ) {}

  ngOnInit() {
    void this.onSubmit();
  }

  async onSubmit() {
    this.loading.set(true);
    this.unavailable.set(false);
    this.error.set(false);
    try {
      const sendEmailOtp = await this.configService.getFeatureFlag(FeatureFlag.SendEmailOTP);
      if (sendEmailOtp) {
        await this.attemptV2Access();
      } else {
        await this.attemptV1Access();
      }
    } finally {
      this.loading.set(false);
    }
  }

  onBackToEmail() {
    this.enterOtp.set(false);
    this.otpSubmitted = false;
    this.updatePageTitle();
  }

  private async attemptV1Access() {
    try {
      const accessRequest = new SendAccessRequest();
      if (this.sendAuthType() === AuthType.Password) {
        const password = this.sendAccessForm.value.password;
        if (password == null) {
          return;
        }
        accessRequest.password = await this.getPasswordHashB64(password, this.key());
      }
      const sendResponse = await this.sendApiService.postSendAccess(this.id(), accessRequest);
      this.accessGranted.emit({ request: accessRequest, response: sendResponse });
    } catch (e) {
      if (e instanceof ErrorResponse) {
        if (e.statusCode === 401) {
          if (this.sendAuthType() === AuthType.Password) {
            // Password was already required, so this is an invalid password error
            const passwordControl = this.sendAccessForm.get("password");
            if (passwordControl) {
              passwordControl.setErrors({
                invalidPassword: { message: this.i18nService.t("sendPasswordInvalidAskOwner") },
              });
              passwordControl.markAsTouched();
            }
          }
          // Set auth type to Password (either first time or refresh)
          this.sendAuthType.set(AuthType.Password);
        } else if (e.statusCode === 400 && this.sendAuthType() === AuthType.Password) {
          // Server returns 400 for SendAccessResult.PasswordInvalid
          const passwordControl = this.sendAccessForm.get("password");
          if (passwordControl) {
            passwordControl.setErrors({
              invalidPassword: { message: this.i18nService.t("sendPasswordInvalidAskOwner") },
            });
            passwordControl.markAsTouched();
          }
        } else if (e.statusCode === 404) {
          this.unavailable.set(true);
        } else {
          this.error.set(true);
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorOccurred"),
            message: e.message,
          });
        }
      } else {
        this.error.set(true);
      }
    }
  }

  private async attemptV2Access(): Promise<void> {
    let sendAccessCreds: SendAccessDomainCredentials | null = null;
    if (this.sendAuthType() === AuthType.Email) {
      const email = this.sendAccessForm.value.email;
      if (email == null) {
        return;
      }
      if (!this.enterOtp()) {
        sendAccessCreds = { kind: "email", email };
      } else {
        const otp = this.sendAccessForm.value.otp as SendOtp;
        if (otp == null) {
          return;
        }
        sendAccessCreds = { kind: "email_otp", email, otp };
      }
    } else if (this.sendAuthType() === AuthType.Password) {
      const password = this.sendAccessForm.value.password;
      if (password == null) {
        return;
      }
      const passwordHashB64 = await this.getPasswordHashB64(password, this.key());
      sendAccessCreds = { kind: "password", passwordHashB64 };
    }
    const response = !sendAccessCreds
      ? await firstValueFrom(this.sendTokenService.tryGetSendAccessToken$(this.id()))
      : await firstValueFrom(this.sendTokenService.getSendAccessToken$(this.id(), sendAccessCreds));
    if (response instanceof SendAccessToken) {
      this.expiredAuthAttempts = 0;
      this.accessGranted.emit({ accessToken: response });
    } else if (response.kind === "expired") {
      if (this.expiredAuthAttempts > 2) {
        return;
      }
      this.expiredAuthAttempts++;
      await this.attemptV2Access();
    } else if (response.kind === "expected_server") {
      this.expiredAuthAttempts = 0;
      if (emailRequired(response.error)) {
        this.sendAuthType.set(AuthType.Email);
        this.updatePageTitle();
      } else if (emailAndOtpRequired(response.error)) {
        this.enterOtp.set(true);
        if (this.otpSubmitted) {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorOccurred"),
            message: this.i18nService.t("invalidEmailOrVerificationCode"),
          });
        }
        this.otpSubmitted = true;
        this.updatePageTitle();
      } else if (otpInvalid(response.error)) {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: this.i18nService.t("invalidEmailOrVerificationCode"),
        });
      } else if (passwordHashB64Required(response.error)) {
        this.sendAuthType.set(AuthType.Password);
        this.updatePageTitle();
      } else if (passwordHashB64Invalid(response.error)) {
        this.sendAccessForm.controls.password?.setErrors({
          invalidPassword: { message: this.i18nService.t("sendPasswordInvalidAskOwner") },
        });
        this.sendAccessForm.controls.password?.markAsTouched();
      } else if (sendIdInvalid(response.error)) {
        this.unavailable.set(true);
      } else {
        this.error.set(true);
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: response.error.error_description ?? "",
        });
      }
    } else {
      this.expiredAuthAttempts = 0;
      this.error.set(true);
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: response.error,
      });
    }
  }

  private async getPasswordHashB64(password: string, key: string) {
    const keyArray = Utils.fromUrlB64ToArray(key);
    const passwordHash = await this.cryptoFunctionService.pbkdf2(
      password,
      keyArray,
      "sha256",
      SEND_KDF_ITERATIONS,
    );
    return Utils.fromBufferToB64(passwordHash) as SendHashedPasswordB64;
  }

  private updatePageTitle(): void {
    const authType = this.sendAuthType();

    if (authType === AuthType.Email) {
      if (this.enterOtp()) {
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageTitle: { key: "enterTheCodeSentToYourEmail" },
          pageSubtitle: this.sendAccessForm.value.email ?? null,
        });
      } else {
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageTitle: { key: "verifyYourEmailToViewThisSend" },
          pageSubtitle: null,
        });
      }
    } else if (authType === AuthType.Password) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "sendAccessPasswordTitle" },
      });
    }
  }
}
