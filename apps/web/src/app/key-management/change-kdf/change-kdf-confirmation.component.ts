import { Component, Inject } from "@angular/core";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { firstValueFrom, Observable } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  InternalMasterPasswordServiceAbstraction,
  syncLegacyMasterKeyState,
} from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { withPasswordManagerSdk } from "@bitwarden/common/key-management/utils";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
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
    masterPassword: new FormControl<string | null>(null, Validators.required),
  });
  showPassword = false;
  loading = false;

  noLogoutOnKdfChangeFeatureFlag$: Observable<boolean>;

  constructor(
    private i18nService: I18nService,
    private messagingService: MessagingService,
    @Inject(DIALOG_DATA) params: { kdf: KdfType; kdfConfig: KdfConfig },
    private accountService: AccountService,
    private toastService: ToastService,
    private sdkService: SdkService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private dialogRef: DialogRef<ChangeKdfConfirmationComponent>,
    configService: ConfigService,
  ) {
    this.kdfConfig = params.kdfConfig;
    this.noLogoutOnKdfChangeFeatureFlag$ = configService.getFeatureFlag$(
      FeatureFlag.NoLogoutOnKdfChange,
    );
  }

  submit = async () => {
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
    await this.makeKeyAndSave();
    if (await firstValueFrom(this.noLogoutOnKdfChangeFeatureFlag$)) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("encKeySettingsChanged"),
      });
      await this.dialogRef.close();
    } else {
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("encKeySettingsChanged"),
        message: this.i18nService.t("logBackIn"),
      });
      this.messagingService.send("logout");
    }
    this.loading = false;
  };

  private async makeKeyAndSave() {
    const activeAccountId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const masterPassword = this.form.value.masterPassword!;

    // Ensure the KDF config is valid.
    this.kdfConfig.validateKdfConfigForSetting();

    await withPasswordManagerSdk(activeAccountId, this.sdkService, async (sdk) => {
      await sdk.user_crypto_management().change_kdf(masterPassword, this.kdfConfig.toSdkConfig());
    });
    await syncLegacyMasterKeyState(activeAccountId, masterPassword, this.masterPasswordService);
  }
}
