// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { ChangeDetectionStrategy, Component, input, OnInit, output, signal } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import {
  emailAndOtpRequired,
  emailRequired,
  passwordHashB64Invalid,
  passwordHashB64Required,
  SendAccessDomainCredentials,
  SendAccessToken,
  SendHashedPasswordB64,
  sendIdInvalid,
  SendOtp,
  SendTokenService,
} from "@bitwarden/common/auth/send-access";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";
import { SEND_KDF_ITERATIONS } from "@bitwarden/common/tools/send/send-kdf";
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
    private toastService: ToastService,
    private i18nService: I18nService,
    private formBuilder: FormBuilder,
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
      await this.attemptAccess();
    } finally {
      this.loading.set(false);
    }
  }

  onBackToEmail() {
    this.enterOtp.set(false);
    this.otpSubmitted = false;
    this.updatePageTitle();
  }

  private async attemptAccess(): Promise<void> {
    const authType = this.sendAuthType();

    if (authType === AuthType.None) {
      await this.getTokenWithRetry(null);
      return;
    }

    if (authType === AuthType.Email) {
      await this.handleEmailOtpAuth();
    } else if (authType === AuthType.Password) {
      await this.handlePasswordAuth();
    }
  }

  private async getTokenWithRetry(
    sendAccessCreds: SendAccessDomainCredentials | null,
  ): Promise<void> {
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
      await this.getTokenWithRetry(sendAccessCreds);
    } else if (response.kind === "expected_server") {
      this.expiredAuthAttempts = 0;
      if (emailRequired(response.error)) {
        this.sendAuthType.set(AuthType.Email);
        this.updatePageTitle();
      } else if (emailAndOtpRequired(response.error)) {
        if (sendAccessCreds && sendAccessCreds.kind === "email" && this.enterOtp()) {
          this.toastService.showToast({
            variant: "success",
            title: undefined,
            message: this.i18nService.t("codeResent"),
          });
        } else {
          if (this.otpSubmitted) {
            this.toastService.showToast({
              variant: "error",
              title: undefined,
              message: this.i18nService.t("invalidVerificationCode"),
            });
          }
          this.otpSubmitted = true;
        }
        this.enterOtp.set(true);
        this.updatePageTitle();
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

  private async handleEmailOtpAuth(): Promise<void> {
    const email = this.sendAccessForm.value.email;
    if (email == null) {
      return;
    }

    let sendAccessCreds: SendAccessDomainCredentials;
    if (!this.enterOtp()) {
      sendAccessCreds = { kind: "email", email };
    } else {
      const otp = this.sendAccessForm.value.otp as SendOtp;
      if (otp == null || otp.trim() === "") {
        this.toastService.showToast({
          variant: "error",
          title: undefined,
          message: this.i18nService.t("invalidVerificationCode"),
        });
        return;
      }
      sendAccessCreds = { kind: "email_otp", email, otp };
    }

    await this.getTokenWithRetry(sendAccessCreds);
  }

  private async handlePasswordAuth(): Promise<void> {
    const password = this.sendAccessForm.value.password;
    if (password == null) {
      return;
    }
    const passwordHashB64 = await this.getPasswordHashB64(password, this.key());
    const sendAccessCreds: SendAccessDomainCredentials = { kind: "password", passwordHashB64 };

    await this.getTokenWithRetry(sendAccessCreds);
  }

  async onResendCode() {
    this.unavailable.set(false);
    this.error.set(false);

    const email = this.sendAccessForm.value.email;
    if (email == null) {
      return;
    }

    const sendAccessCreds: SendAccessDomainCredentials = { kind: "email", email };
    await this.getTokenWithRetry(sendAccessCreds);
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
