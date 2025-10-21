// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ChangeKdfService } from "@bitwarden/common/key-management/kdf/change-kdf-service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { DIALOG_DATA, ToastService } from "@bitwarden/components";
import { KdfConfig, KdfType } from "@bitwarden/key-management";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-change-kdf-confirmation",
  templateUrl: "change-kdf-confirmation.component.html",
  standalone: false,
})
export class ChangeKdfConfirmationComponent {
  kdfConfig: KdfConfig;

  form = new FormGroup({
    masterPassword: new FormControl(null, Validators.required),
  });
  showPassword = false;
  masterPassword: string;
  loading = false;

  constructor(
    private i18nService: I18nService,
    private messagingService: MessagingService,
    @Inject(DIALOG_DATA) params: { kdf: KdfType; kdfConfig: KdfConfig },
    private accountService: AccountService,
    private toastService: ToastService,
    private changeKdfService: ChangeKdfService,
  ) {
    this.kdfConfig = params.kdfConfig;
    this.masterPassword = null;
  }

  submit = async () => {
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
    await this.makeKeyAndSaveAsync();
    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("encKeySettingsChanged"),
      message: this.i18nService.t("logBackIn"),
    });
    this.messagingService.send("logout");
    this.loading = false;
  };

  private async makeKeyAndSaveAsync() {
    const masterPassword = this.form.value.masterPassword;

    // Ensure the KDF config is valid.
    this.kdfConfig.validateKdfConfigForSetting();

    const activeAccountId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    await this.changeKdfService.updateUserKdfParams(
      masterPassword,
      this.kdfConfig,
      activeAccountId,
    );
  }
}
