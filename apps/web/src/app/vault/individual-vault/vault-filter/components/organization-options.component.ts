// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import {
  combineLatest,
  firstValueFrom,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordEnrollmentRequest,
} from "@bitwarden/admin-console/common";
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { DialogService, ToastService } from "@bitwarden/components";

import { OrganizationUserResetPasswordService } from "../../../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
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
    private organizationUserApiService: OrganizationUserApiService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private dialogService: DialogService,
    private resetPasswordService: OrganizationUserResetPasswordService,
    private userVerificationService: UserVerificationService,
    private toastService: ToastService,
    private configService: ConfigService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    const resetPasswordPolicies$ = this.policyService.policies$.pipe(
      map((policies) => policies.filter((policy) => policy.type === PolicyType.ResetPassword)),
    );

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const managingOrg$ = this.configService
      .getFeatureFlag$(FeatureFlag.AccountDeprovisioning)
      .pipe(
        switchMap((isAccountDeprovisioningEnabled) =>
          isAccountDeprovisioningEnabled
            ? this.organizationService
                .organizations$(userId)
                .pipe(
                  map((organizations) =>
                    organizations.find((o) => o.userIsManagedByOrganization === true),
                  ),
                )
            : of(null),
        ),
      );

    combineLatest([
      this.organization$,
      resetPasswordPolicies$,
      this.userDecryptionOptionsService.userDecryptionOptions$,
      managingOrg$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([organization, resetPasswordPolicies, decryptionOptions, managingOrg]) => {
        this.organization = organization;
        this.resetPasswordPolicy = resetPasswordPolicies.find(
          (p) => p.organizationId === organization.id,
        );

        // A user can leave an organization if they are NOT a managed user and they are NOT using TDE and Key Connector, or they have a master password.
        this.showLeaveOrgOption =
          managingOrg?.id !== organization.id &&
          ((decryptionOptions.trustedDeviceOption == undefined &&
            decryptionOptions.keyConnectorOption == undefined) ||
            decryptionOptions.hasMasterPassword);

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
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("unlinkedSso"),
      });
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
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("leftOrganization"),
      });
    } catch (e) {
      this.logService.error(e);
    }
  }

  async toggleResetPasswordEnrollment(org: Organization) {
    if (!this.organization.resetPasswordEnrolled) {
      await EnrollMasterPasswordReset.open(
        this.dialogService,
        { organization: org },
        this.resetPasswordService,
        this.organizationUserApiService,
        this.platformUtilsService,
        this.i18nService,
        this.syncService,
        this.logService,
        this.userVerificationService,
        this.toastService,
      );
    } else {
      // Remove reset password
      const request = new OrganizationUserResetPasswordEnrollmentRequest();
      request.masterPasswordHash = "ignored";
      request.resetPasswordKey = null;
      this.actionPromise =
        this.organizationUserApiService.putOrganizationUserResetPasswordEnrollment(
          this.organization.id,
          this.organization.userId,
          request,
        );
      try {
        await this.actionPromise;
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("withdrawPasswordResetSuccess"),
        });
        await this.syncService.fullSync(true);
      } catch (e) {
        this.logService.error(e);
      }
    }
  }
}
