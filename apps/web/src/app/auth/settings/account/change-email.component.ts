import { Component, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ChangeEmailService } from "@bitwarden/common/auth/services/change-email/change-email.service";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-change-email",
  templateUrl: "change-email.component.html",
  imports: [SharedModule],
})
export class ChangeEmailComponent implements OnInit {
  tokenSent = false;
  showTwoFactorEmailWarning = false;
  userId: UserId | undefined;

  formGroup = this.formBuilder.group({
    step1: this.formBuilder.group({
      masterPassword: ["", [Validators.required]],
      newEmail: ["", [Validators.required, Validators.email]],
    }),
    token: [{ value: "", disabled: true }, [Validators.required]],
  });

  constructor(
    private accountService: AccountService,
    private twoFactorService: TwoFactorService,
    private i18nService: I18nService,
    private messagingService: MessagingService,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private changeEmailService: ChangeEmailService,
  ) {}

  async ngOnInit() {
    this.userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const twoFactorProviders = await this.twoFactorService.getEnabledTwoFactorProviders();
    this.showTwoFactorEmailWarning = twoFactorProviders.data.some(
      (p) => p.type === TwoFactorProviderType.Email && p.enabled,
    );
  }

  submit = async () => {
    if (this.userId == null) {
      throw new Error("Can't find user");
    }

    // This form has multiple steps, so we need to mark all the groups as touched.
    this.formGroup.controls.step1.markAllAsTouched();

    if (this.tokenSent) {
      this.formGroup.controls.token.markAllAsTouched();
    }

    // Exit if the form is invalid.
    if (this.formGroup.invalid) {
      return;
    }

    const step1Value = this.formGroup.controls.step1.value;
    const newEmail = step1Value.newEmail?.trim().toLowerCase();
    const masterPassword = step1Value.masterPassword;

    const ctx = "Could not update email.";
    assertNonNullish(newEmail, "email", ctx);
    assertNonNullish(masterPassword, "password", ctx);

    if (!this.tokenSent) {
      await this.changeEmailService.requestEmailToken(masterPassword, newEmail, this.userId);
      this.activateStep2();
    } else {
      const token = this.formGroup.value.token;
      if (token == null) {
        throw new Error("Missing token");
      }

      await this.changeEmailService.confirmEmailChange(
        masterPassword,
        newEmail,
        token,
        this.userId,
      );
      this.reset();
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("emailChanged"),
        message: this.i18nService.t("logBackIn"),
      });
      this.messagingService.send("logout");
    }
  };

  // Disable step1 and enable token
  activateStep2() {
    this.formGroup.controls.step1.disable();
    this.formGroup.controls.token.enable();

    this.tokenSent = true;
  }

  // Reset form and re-enable step1
  reset() {
    this.formGroup.reset();
    this.formGroup.controls.step1.enable();
    this.formGroup.controls.token.disable();

    this.tokenSent = false;
  }
}
