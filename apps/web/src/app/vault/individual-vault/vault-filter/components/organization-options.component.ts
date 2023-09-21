import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { map, Subject, takeUntil } from "rxjs";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordEnrollmentRequest } from "@bitwarden/common/abstractions/organization-user/requests";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
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
  actionPromise: Promise<void | boolean>;
  policies: Policy[];
  loaded = false;

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(OptionsInput) protected organization: OrganizationFilter,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private apiService: ApiService,
    private syncService: SyncService,
    private policyService: PolicyService,
    private modalService: ModalService,
    private logService: LogService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationUserService: OrganizationUserService,
    private dialogService: DialogService
  ) {}

  async ngOnInit() {
    this.policyService.policies$
      .pipe(
        map((policies) => policies.filter((policy) => policy.type === PolicyType.ResetPassword)),
        takeUntil(this.destroy$)
      )
      .subscribe((policies) => {
        this.policies = policies;
        this.loaded = true;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  allowEnrollmentChanges(org: OrganizationFilter): boolean {
    if (org.usePolicies && org.useResetPassword && org.hasPublicAndPrivateKeys) {
      const policy = this.policies.find((p) => p.organizationId === org.id);
      if (policy != null && policy.enabled) {
        return org.resetPasswordEnrolled && policy.data.autoEnrollEnabled ? false : true;
      }
    }

    return false;
  }

  showEnrolledStatus(org: Organization): boolean {
    return (
      org.useResetPassword &&
      org.resetPasswordEnrolled &&
      this.policies.some((p) => p.organizationId === org.id && p.enabled)
    );
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
      this.modalService.open(EnrollMasterPasswordReset, {
        allowMultipleModals: true,
        data: {
          organization: org,
        },
      });
    } else {
      // Remove reset password
      const request = new OrganizationUserResetPasswordEnrollmentRequest();
      request.masterPasswordHash = "ignored";
      request.resetPasswordKey = null;
      this.actionPromise = this.organizationUserService.putOrganizationUserResetPasswordEnrollment(
        this.organization.id,
        this.organization.userId,
        request
      );
      try {
        await this.actionPromise;
        this.platformUtilsService.showToast(
          "success",
          null,
          this.i18nService.t("withdrawPasswordResetSuccess")
        );
        this.syncService.fullSync(true);
      } catch (e) {
        this.logService.error(e);
      }
    }
  }
}
