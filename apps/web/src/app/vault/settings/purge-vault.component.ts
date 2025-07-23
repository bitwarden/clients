// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { UserVerificationModule } from "../../auth/shared/components/user-verification";
import { SharedModule } from "../../shared";

export interface PurgeVaultDialogData {
  organizationId: string;
}

@Component({
  templateUrl: "purge-vault.component.html",
  imports: [SharedModule, UserVerificationModule],
})
export class PurgeVaultComponent {
  organizationId: string = null;

  formGroup = new FormGroup({
    masterPassword: new FormControl<Verification>(null),
  });

  constructor(
    @Inject(DIALOG_DATA) protected data: PurgeVaultDialogData,
    private dialogRef: DialogRef,
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private userVerificationService: UserVerificationService,
    private router: Router,
    private syncService: SyncService,
    private toastService: ToastService,
  ) {
    this.organizationId = data && data.organizationId ? data.organizationId : null;
  }

  submit = async () => {
    const response = this.userVerificationService
      .buildRequest(this.formGroup.value.masterPassword)
      .then((request) => this.apiService.postPurgeCiphers(request, this.organizationId));
    await response;
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("vaultPurged"),
    });
    await this.syncService.fullSync(true);
    if (this.organizationId != null) {
      await this.router.navigate(["organizations", this.organizationId, "vault"]);
    } else {
      await this.router.navigate(["vault"]);
    }
    this.dialogRef.close();
  };

  static open(dialogService: DialogService, config?: DialogConfig<PurgeVaultDialogData>) {
    return dialogService.open(PurgeVaultComponent, config);
  }
}
