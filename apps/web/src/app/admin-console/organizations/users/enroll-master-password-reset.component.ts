import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordEnrollmentRequest } from "@bitwarden/common/admin-console/abstractions/organization-user/requests";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { AccountRecoveryService } from "../members/services/account-recovery/account-recovery.service";

interface EnrollMasterPasswordResetData {
  organization: Organization;
}

@Component({
  selector: "app-enroll-master-password-reset",
  templateUrl: "enroll-master-password-reset.component.html",
})
export class EnrollMasterPasswordReset {
  protected organization: Organization;

  protected formGroup = new FormGroup({
    verification: new FormControl<Verification>(null, Validators.required),
  });

  constructor(
    private dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: EnrollMasterPasswordResetData,
    private accountRecoveryService: AccountRecoveryService,
    private userVerificationService: UserVerificationService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private syncService: SyncService,
    private logService: LogService,
    private organizationUserService: OrganizationUserService,
  ) {
    this.organization = data.organization;
  }

  submit = async () => {
    try {
      await this.userVerificationService
        .buildRequest(
          this.formGroup.value.verification,
          OrganizationUserResetPasswordEnrollmentRequest,
        )
        .then(async (request) => {
          // Create request and execute enrollment
          request.resetPasswordKey = await this.accountRecoveryService.buildRecoveryKey(
            this.organization.id,
          );
          await this.organizationUserService.putOrganizationUserResetPasswordEnrollment(
            this.organization.id,
            this.organization.userId,
            request,
          );

          await this.syncService.fullSync(true, "enroll-master-password-reset");
        });
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("enrollPasswordResetSuccess"),
      );
      this.dialogRef.close();
    } catch (e) {
      this.logService.error(e);
    }
  };

  static open(dialogService: DialogService, data: EnrollMasterPasswordResetData) {
    return dialogService.open(EnrollMasterPasswordReset, { data });
  }
}
