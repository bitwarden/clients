// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, lastValueFrom } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordEnrollmentRequest,
} from "@bitwarden/admin-console/common";
import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationWithSecret } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { AccountRecoveryTrustComponent } from "@bitwarden/key-management-ui";

import { OrganizationUserResetPasswordService } from "../members/services/organization-user-reset-password/organization-user-reset-password.service";

interface EnrollMasterPasswordResetData {
  organization: Organization;
}

export class EnrollMasterPasswordReset {
  constructor() {}

  static async open(
    dialogService: DialogService,
    data: EnrollMasterPasswordResetData,
    resetPasswordService: OrganizationUserResetPasswordService,
    organizationUserApiService: OrganizationUserApiService,
    i18nService: I18nService,
    syncService: SyncService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    toastService: ToastService,
    keyService: KeyService,
    accountService: AccountService,
    organizationApiService: OrganizationApiServiceAbstraction,
  ) {
    const result = await UserVerificationDialogComponent.open(dialogService, {
      title: "enrollAccountRecovery",
      calloutOptions: {
        text: "resetPasswordEnrollmentWarning",
        type: "warning",
      },
      verificationType: {
        type: "custom",
        verificationFn: async (secret: VerificationWithSecret) => {
          const activeUserId = (await firstValueFrom(accountService.activeAccount$)).id;

          const publicKey = Utils.fromB64ToArray(
            (await organizationApiService.getKeys(data.organization.id)).publicKey,
          );

          const request =
            await userVerificationService.buildRequest<OrganizationUserResetPasswordEnrollmentRequest>(
              secret,
            );
          const dialogRef = AccountRecoveryTrustComponent.open(dialogService, {
            name: data.organization.name,
            orgId: data.organization.id,
            publicKey,
          });
          const result = await lastValueFrom(dialogRef.closed);
          if (result !== true) {
            throw new Error("Organization not trusted, aborting user key rotation");
          }

          const trustedOrgPublicKeys = [publicKey];
          const userKey = await firstValueFrom(keyService.userKey$(activeUserId));

          request.resetPasswordKey = await resetPasswordService.buildRecoveryKey(
            data.organization.id,
            userKey,
            trustedOrgPublicKeys,
          );

          // Process the enrollment request, which is an endpoint that is
          // gated by a server-side check of the master password hash
          await organizationUserApiService.putOrganizationUserResetPasswordEnrollment(
            data.organization.id,
            data.organization.userId,
            request,
          );
          return true;
        },
      },
    });

    // User canceled enrollment
    if (result.userAction === "cancel") {
      return;
    }

    // Enrollment failed
    if (!result.verificationSuccess) {
      return;
    }

    // Enrollment succeeded
    try {
      toastService.showToast({
        variant: "success",
        title: null,
        message: i18nService.t("enrollPasswordResetSuccess"),
      });
      await syncService.fullSync(true);
    } catch (e) {
      logService.error(e);
    }
  }
}
