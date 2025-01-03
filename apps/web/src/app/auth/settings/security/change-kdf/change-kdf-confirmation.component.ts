// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { KdfRequest } from "@bitwarden/common/models/request/kdf.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";
import {
  Argon2KdfConfig,
  KdfConfig,
  KdfConfigService,
  KdfType,
  KeyService,
  PBKDF2KdfConfig,
} from "@bitwarden/key-management";

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
    public dialogRef: DialogRef,
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private keyService: KeyService,
    private messagingService: MessagingService,
    @Inject(DIALOG_DATA) params: { kdf: KdfType; kdfConfig: KdfConfig },
    private accountService: AccountService,
    private toastService: ToastService,
    private tokenService: TokenService,
    private syncService: SyncService,
    private fullApiService: ApiService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private kdfConfigService: KdfConfigService,
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
      message: this.i18nService.t("logBackInOnJustOthers"),
    });
    this.loading = false;
  };

  private async makeKeyAndSaveAsync() {
    const masterPassword = this.form.value.masterPassword;

    const { userId, email } = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => ({ userId: a?.id, email: a?.email }))),
    );

    // Ensure the KDF config is valid. Copy the config to ensure the original being mutated does not
    // break this function
    let kdfConfig = this.kdfConfig;
    if (kdfConfig.kdfType === KdfType.PBKDF2_SHA256) {
      kdfConfig = new PBKDF2KdfConfig(kdfConfig.iterations);
    } else {
      kdfConfig = new Argon2KdfConfig(
        kdfConfig.iterations,
        kdfConfig.memory,
        kdfConfig.parallelism,
      );
    }
    kdfConfig.validateKdfConfigForSetting();

    const request = new KdfRequest();
    request.kdf = kdfConfig.kdfType;
    request.kdfIterations = kdfConfig.iterations;
    if (kdfConfig.kdfType === KdfType.Argon2id) {
      request.kdfMemory = kdfConfig.memory;
      request.kdfParallelism = kdfConfig.parallelism;
    }
    const oldMasterKey = await this.keyService.getOrDeriveMasterKey(masterPassword);
    request.masterPasswordHash = await this.keyService.hashMasterKey(masterPassword, oldMasterKey);

    const newMasterKey = await this.keyService.makeMasterKey(masterPassword, email, kdfConfig);
    request.newMasterPasswordHash = await this.keyService.hashMasterKey(
      masterPassword,
      newMasterKey,
    );
    const newUserKey = await this.keyService.encryptUserKeyWithMasterKey(newMasterKey);
    request.key = newUserKey[1].encryptedString;

    await this.apiService.postAccountKdf(request);

    const newSecurityStamp = (await this.fullApiService.getSync()).profile.securityStamp;
    await this.tokenService.setSecurityStamp(newSecurityStamp);
    await this.keyService.setMasterKeyEncryptedUserKey(newUserKey[1].encryptedString, userId);
    await this.keyService.setUserKey(newUserKey[0], userId);
    await this.syncService.fullSync(true);
    await this.masterPasswordService.setMasterKeyHash(
      await this.keyService.hashMasterKey(
        masterPassword,
        newMasterKey,
        HashPurpose.LocalAuthorization,
      ),
      userId,
    );
    await this.masterPasswordService.setMasterKey(newMasterKey, userId);
    await this.kdfConfigService.setKdfConfig(userId, kdfConfig);
    this.dialogRef.close();
  }
}
