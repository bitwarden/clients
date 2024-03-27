import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { combineLatest, map, Observable, Subject, takeUntil } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordEnrollmentRequest } from "@bitwarden/common/admin-console/abstractions/organization-user/requests";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { EnrollMasterPasswordReset } from "../../../../admin-console/organizations/users/enroll-master-password-reset.component";
import { OptionsInput } from "../shared/components/vault-filter-section.component";
import { OrganizationFilter } from "../shared/models/vault-filter.type";

@Component({
  selector: "app-organization-options",
  templateUrl: "organization-options.component.html",
})
export class OrganizationOptionsComponent implements OnInit, OnDestroy {
  protected actionPromise: Promise<void | boolean>;
  protected resetPasswordPolicy?: Policy | undefined;
  protected loaded = false;
  protected hideMenu = false;
  protected showLeaveOrgOption = false;
  protected organization: OrganizationFilter;

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(OptionsInput) protected organization$: Observable<OrganizationFilter>,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private apiService: ApiService,
    private syncService: SyncService,
    private policyService: PolicyService,
    private logService: LogService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationUserService: OrganizationUserService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private dialogService: DialogService,
  ) {}

  async ngOnInit() {
    const resetPasswordPolicies$ = this.policyService.policies$.pipe(
      map((policies) => policies.filter((policy) => policy.type === PolicyType.ResetPassword)),
    );

    combineLatest([
      this.organization$,
      resetPasswordPolicies$,
      this.userDecryptionOptionsService.userDecryptionOptions$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([organization, resetPasswordPolicies, decryptionOptions]) => {
        this.organization = organization;
        this.resetPasswordPolicy = resetPasswordPolicies.find(
          (p) => p.organizationId === organization.id,
        );

        // A user can leave an organization if they are NOT using TDE and Key Connector, or they have a master password.
        this.showLeaveOrgOption =
          (decryptionOptions.trustedDeviceOption == undefined &&
            decryptionOptions.keyConnectorOption == undefined) ||
          decryptionOptions.hasMasterPassword;

        // Hide the 3 dot menu if the user has no available actions
        this.hideMenu =
          !this.showLeaveOrgOption &&
          !this.showSsoOptions(this.organization) &&
          !this.allowEnrollmentChanges(this.organization);

        this.loaded = true;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  allowEnrollmentChanges(org: OrganizationFilter): boolean {
    if (org?.usePolicies && org?.useResetPassword && org?.hasPublicAndPrivateKeys) {
      if (this.resetPasswordPolicy != undefined && this.resetPasswordPolicy.enabled) {
        return !(org?.resetPasswordEnrolled && this.resetPasswordPolicy.data.autoEnrollEnabled);
      }
    }

    return false;
  }

  showSsoOptions(org: OrganizationFilter) {
    return org?.useSso && org?.identifier;
  }

  async unlinkSso(org: Organization) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: org.name,
      content: { key: "unlinkSsoConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      this.actionPromise = this.apiService.deleteSsoUser(org.id).then(() => {
        return this.syncService.fullSync(true);
      });
      await this.actionPromise;
      this.platformUtilsService.showToast("success", null, "Unlinked SSO");
    } catch (e) {
      this.logService.error(e);
    }
  }

  async leave(org: Organization) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: org.name,
      content: { key: "leaveOrganizationConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      this.actionPromise = this.organizationApiService.leave(org.id);
      await this.actionPromise;
      this.platformUtilsService.showToast("success", null, this.i18nService.t("leftOrganization"));
    } catch (e) {
      this.logService.error(e);
    }
  }

  async toggleResetPasswordEnrollment(org: Organization) {
    if (!this.organization.resetPasswordEnrolled) {
      EnrollMasterPasswordReset.open(this.dialogService, { organization: org });
    } else {
      // Remove reset password
      const request = new OrganizationUserResetPasswordEnrollmentRequest();
      request.masterPasswordHash = "ignored";
      request.resetPasswordKey = null;
      this.actionPromise = this.organizationUserService.putOrganizationUserResetPasswordEnrollment(
        this.organization.id,
        this.organization.userId,
        request,
      );
      try {
        await this.actionPromise;
        this.platformUtilsService.showToast(
          "success",
          null,
          this.i18nService.t("withdrawPasswordResetSuccess"),
        );
        await this.syncService.fullSync(true);
      } catch (e) {
        this.logService.error(e);
      }
    }
  }
}
