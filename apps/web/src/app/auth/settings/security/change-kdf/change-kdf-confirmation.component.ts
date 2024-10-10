import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { KdfRequest } from "@bitwarden/common/models/request/kdf.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { KdfType } from "@bitwarden/common/platform/enums";
import { ToastService } from "@bitwarden/components";

@Component({
  selector: "app-change-kdf-confirmation",
  templateUrl: "change-kdf-confirmation.component.html",
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
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private cryptoService: CryptoService,
    private messagingService: MessagingService,
    @Inject(DIALOG_DATA) params: { kdf: KdfType; kdfConfig: KdfConfig },
    private accountService: AccountService,
    private toastService: ToastService,
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

    const request = new KdfRequest();
    request.kdf = this.kdfConfig.kdfType;
    request.kdfIterations = this.kdfConfig.iterations;
    if (this.kdfConfig.kdfType === KdfType.Argon2id) {
      request.kdfMemory = this.kdfConfig.memory;
      request.kdfParallelism = this.kdfConfig.parallelism;
    }
    const masterKey = await this.cryptoService.getOrDeriveMasterKey(masterPassword);
    request.masterPasswordHash = await this.cryptoService.hashMasterKey(masterPassword, masterKey);
    const email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

    const newMasterKey = await this.cryptoService.makeMasterKey(
      masterPassword,
      email,
      this.kdfConfig,
    );
    request.newMasterPasswordHash = await this.cryptoService.hashMasterKey(
      masterPassword,
      newMasterKey,
    );
    const newUserKey = await this.cryptoService.encryptUserKeyWithMasterKey(newMasterKey);
    request.key = newUserKey[1].encryptedString;

    await this.apiService.postAccountKdf(request);
  }
}
