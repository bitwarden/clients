// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, lastValueFrom } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordEnrollmentRequest,
} from "@bitwarden/admin-console/common";
import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationWithSecret } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import {
  OrganizationTrustComponent,
  OrganizationTrustDialogResult,
} from "../manage/organization-trust.component";
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
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    syncService: SyncService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    toastService: ToastService,
    keyService: KeyService,
    accountService: AccountService,
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
          const request =
            await userVerificationService.buildRequest<OrganizationUserResetPasswordEnrollmentRequest>(
              secret,
            );
          const orgs = await resetPasswordService.getPublicKeys();
          const organization = orgs.filter((d) => d.orgId === data.organization.id)[0];
          const dialogRef = OrganizationTrustComponent.open(dialogService, {
            data: {
              name: organization.orgName,
              orgId: organization.orgId,
              publicKey: organization.publicKey,
            },
          });
          const result = await lastValueFrom(dialogRef.closed);
          if (result === OrganizationTrustDialogResult.Trusted) {
            logService.info("[Master password enrollment] Organization trusted");
          } else {
            logService.info("[Master password enrollment] Organization not trusted");
            throw new Error("Organization not trusted, aborting user key rotation");
          }

          const trustedOrgPublicKeys = [organization.publicKey];
          const activeUserId = (await firstValueFrom(accountService.activeAccount$)).id;
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
