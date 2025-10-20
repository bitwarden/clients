import { Component, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { EmailTokenRequest } from "@bitwarden/common/auth/models/request/email-token.request";
import { EmailRequest } from "@bitwarden/common/auth/models/request/email.request";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { TwoFactorApiService } from "@bitwarden/common/auth/two-factor";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
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
    private apiService: ApiService,
    private twoFactorApiService: TwoFactorApiService,
    private i18nService: I18nService,
    private keyService: KeyService,
    private messagingService: MessagingService,
    private formBuilder: FormBuilder,
    private kdfConfigService: KdfConfigService,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    this.userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const twoFactorProviders = await this.twoFactorApiService.getTwoFactorProviders();
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

    if (newEmail == null || masterPassword == null) {
      throw new Error("Missing email or password");
    }

    const existingHash = await this.keyService.hashMasterKey(
      masterPassword,
      await this.keyService.getOrDeriveMasterKey(masterPassword, this.userId),
    );

    if (!this.tokenSent) {
      const request = new EmailTokenRequest();
      request.newEmail = newEmail;
      request.masterPasswordHash = existingHash;
      await this.apiService.postEmailToken(request);
      this.activateStep2();
    } else {
      const token = this.formGroup.value.token;
      if (token == null) {
        throw new Error("Missing token");
      }
      const request = new EmailRequest();
      request.token = token;
      request.newEmail = newEmail;
      request.masterPasswordHash = existingHash;

      const kdfConfig = await firstValueFrom(this.kdfConfigService.getKdfConfig$(this.userId));
      if (kdfConfig == null) {
        throw new Error("Missing kdf config");
      }
      const newMasterKey = await this.keyService.makeMasterKey(masterPassword, newEmail, kdfConfig);
      request.newMasterPasswordHash = await this.keyService.hashMasterKey(
        masterPassword,
        newMasterKey,
      );

      const userKey = await firstValueFrom(this.keyService.userKey$(this.userId));
      if (userKey == null) {
        throw new Error("Can't find UserKey");
      }
      const newUserKey = await this.keyService.encryptUserKeyWithMasterKey(newMasterKey, userKey);
      const encryptedUserKey = newUserKey[1]?.encryptedString;
      if (encryptedUserKey == null) {
        throw new Error("Missing Encrypted User Key");
      }
      request.key = encryptedUserKey;

      await this.apiService.postEmail(request);
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
