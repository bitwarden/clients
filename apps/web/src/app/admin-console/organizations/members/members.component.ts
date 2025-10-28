import { Component, computed, Signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  from,
  map,
  merge,
  Observable,
  shareReplay,
  switchMap,
  take,
} from "rxjs";

import { OrganizationUserUserDetailsResponse } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
  PolicyType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { getById } from "@bitwarden/common/platform/misc";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import { BaseMembersComponent } from "../../common/base-members.component";
import { PeopleTableDataSource } from "../../common/people-table-data-source";
import { OrganizationUserView } from "../core/views/organization-user.view";

import { AccountRecoveryDialogResultType } from "./components/account-recovery/account-recovery-dialog.component";
import { MemberDialogResult, MemberDialogTab } from "./components/member-dialog";
import { MemberDialogManagerService, OrganizationMembersService } from "./services";
import { DeleteManagedMemberWarningService } from "./services/delete-managed-member/delete-managed-member-warning.service";
import {
  MemberActionsService,
  MemberActionResult,
} from "./services/member-actions/member-actions.service";

class MembersTableDataSource extends PeopleTableDataSource<OrganizationUserView> {
  protected statusType = OrganizationUserStatusType;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "members.component.html",
  standalone: false,
})
export class MembersComponent extends BaseMembersComponent<OrganizationUserView> {
  userType = OrganizationUserType;
  userStatusType = OrganizationUserStatusType;
  memberTab = MemberDialogTab;
  protected dataSource = new MembersTableDataSource();

  readonly organization: Signal<Organization | undefined>;
  status: OrganizationUserStatusType | undefined;

  private userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  resetPasswordPolicyEnabled$: Observable<boolean>;

  protected readonly canUseSecretsManager: Signal<boolean> = computed(
    () => this.organization()?.useSecretsManager ?? false,
  );
  protected readonly showUserManagementControls: Signal<boolean> = computed(
    () => this.organization()?.canManageUsers ?? false,
  );
  protected billingMetadata$: Observable<OrganizationBillingMetadataResponse>;

  // Fixed sizes used for cdkVirtualScroll
  protected rowHeight = 66;
  protected rowHeightClass = `tw-h-[66px]`;

  constructor(
    apiService: ApiService,
    i18nService: I18nService,
    organizationManagementPreferencesService: OrganizationManagementPreferencesService,
    keyService: KeyService,
    validationService: ValidationService,
    logService: LogService,
    userNamePipe: UserNamePipe,
    dialogService: DialogService,
    toastService: ToastService,
    private route: ActivatedRoute,
    protected deleteManagedMemberWarningService: DeleteManagedMemberWarningService,
    private organizationWarningsService: OrganizationWarningsService,
    private memberActionsService: MemberActionsService,
    private memberDialogManager: MemberDialogManagerService,
    protected billingConstraint: BillingConstraintService,
    protected memberService: OrganizationMembersService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private policyService: PolicyService,
    private policyApiService: PolicyApiServiceAbstraction,
    private organizationMetadataService: OrganizationMetadataServiceAbstraction,
  ) {
    super(
      apiService,
      i18nService,
      keyService,
      validationService,
      logService,
      userNamePipe,
      dialogService,
      organizationManagementPreferencesService,
      toastService,
    );

    const organization$ = this.route.params.pipe(
      concatMap((params) =>
        this.userId$.pipe(
          switchMap((userId) =>
            this.organizationService.organizations$(userId).pipe(getById(params.organizationId)),
          ),
          filter((organization): organization is Organization => organization != null),
          shareReplay({ refCount: true, bufferSize: 1 }),
        ),
      ),
    );

    this.organization = toSignal(organization$);

    const policies$ = combineLatest([this.userId$, organization$]).pipe(
      switchMap(([userId, organization]) =>
        organization.isProviderUser
          ? from(this.policyApiService.getPolicies(organization.id)).pipe(
              map((response) => Policy.fromListResponse(response)),
            )
          : this.policyService.policies$(userId),
      ),
    );

    this.resetPasswordPolicyEnabled$ = combineLatest([organization$, policies$]).pipe(
      map(
        ([organization, policies]) =>
          policies
            .filter((policy) => policy.type === PolicyType.ResetPassword)
            .find((p) => p.organizationId === organization.id)?.enabled ?? false,
      ),
    );

    combineLatest([this.route.queryParams, organization$])
      .pipe(
        concatMap(async ([qParams, organization]) => {
          await this.load(organization!);

          this.searchControl.setValue(qParams.search);

          if (qParams.viewEvents != null) {
            const user = this.dataSource.data.filter((u) => u.id === qParams.viewEvents);
            if (user.length > 0 && user[0].status === OrganizationUserStatusType.Confirmed) {
              this.openEventsDialog(user[0], organization!);
            }
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    organization$
      .pipe(
        switchMap((organization) =>
          merge(
            this.organizationWarningsService.showInactiveSubscriptionDialog$(organization),
            this.organizationWarningsService.showSubscribeBeforeFreeTrialEndsDialog$(organization),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.billingMetadata$ = organization$.pipe(
      switchMap((organization) =>
        this.organizationMetadataService.getOrganizationMetadata$(organization.id),
      ),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    // Stripe is slow, so kick this off in the background but without blocking page load.
    // Anyone who needs it will still await the first emission.
    this.billingMetadata$.pipe(take(1), takeUntilDestroyed()).subscribe();
  }

  override async load(organization: Organization) {
    await super.load(organization);
  }

  async getUsers(organization: Organization): Promise<OrganizationUserView[]> {
    return await this.memberService.loadUsers(organization);
  }

  async removeUser(id: string, organization: Organization): Promise<MemberActionResult> {
    return await this.memberActionsService.removeUser(organization, id);
  }

  async revokeUser(id: string, organization: Organization): Promise<MemberActionResult> {
    return await this.memberActionsService.revokeUser(organization, id);
  }

  async restoreUser(id: string, organization: Organization): Promise<MemberActionResult> {
    return await this.memberActionsService.restoreUser(organization, id);
  }

  async reinviteUser(id: string, organization: Organization): Promise<MemberActionResult> {
    return await this.memberActionsService.reinviteUser(organization, id);
  }

  async confirmUser(
    user: OrganizationUserView,
    publicKey: Uint8Array,
    organization: Organization,
  ): Promise<MemberActionResult> {
    return await this.memberActionsService.confirmUser(user, publicKey, organization);
  }

  async revoke(user: OrganizationUserView, organization: Organization) {
    const confirmed = await this.revokeUserConfirmationDialog(user);

    if (!confirmed) {
      return false;
    }

    this.actionPromise = this.revokeUser(user.id, organization);
    try {
      const result = await this.actionPromise;
      if (result.success) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("revokedUserId", this.userNamePipe.transform(user)),
        });
        await this.load(organization);
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = undefined;
  }

  async restore(user: OrganizationUserView, organization: Organization) {
    this.actionPromise = this.restoreUser(user.id, organization);
    try {
      const result = await this.actionPromise;
      if (result.success) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("restoredUserId", this.userNamePipe.transform(user)),
        });
        await this.load(organization);
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = undefined;
  }

  allowResetPassword(
    orgUser: OrganizationUserView,
    organization: Organization,
    orgResetPasswordPolicyEnabled: boolean,
  ): boolean {
    return this.memberActionsService.allowResetPassword(
      orgUser,
      organization,
      orgResetPasswordPolicyEnabled,
    );
  }

  showEnrolledStatus(
    orgUser: OrganizationUserUserDetailsResponse,
    organization: Organization,
    orgResetPasswordPolicyEnabled: boolean,
  ): boolean {
    return (
      organization.useResetPassword &&
      orgUser.resetPasswordEnrolled &&
      orgResetPasswordPolicyEnabled
    );
  }

  private async handleInviteDialog(organization: Organization) {
    const billingMetadata = await firstValueFrom(this.billingMetadata$);
    const allUserEmails = this.dataSource.data?.map((user) => user.email) ?? [];

    const result = await this.memberDialogManager.openInviteDialog(
      organization,
      billingMetadata,
      allUserEmails,
    );

    if (result === MemberDialogResult.Saved) {
      await this.load(organization);
    }
  }

  async invite(organization: Organization) {
    const billingMetadata = await firstValueFrom(this.billingMetadata$);
    const seatLimitResult = this.billingConstraint.checkSeatLimit(organization, billingMetadata);
    if (!(await this.billingConstraint.seatLimitReached(seatLimitResult, organization))) {
      await this.handleInviteDialog(organization);
      this.organizationMetadataService.refreshMetadataCache();
    }
  }

  async edit(
    user: OrganizationUserView,
    organization: Organization,
    initialTab: MemberDialogTab = MemberDialogTab.Role,
  ) {
    const billingMetadata = await firstValueFrom(this.billingMetadata$);

    const result = await this.memberDialogManager.openEditDialog(
      user,
      organization,
      billingMetadata,
      initialTab,
    );

    switch (result) {
      case MemberDialogResult.Deleted:
        this.dataSource.removeUser(user);
        break;
      case MemberDialogResult.Saved:
      case MemberDialogResult.Revoked:
      case MemberDialogResult.Restored:
        await this.load(organization);
        break;
    }
  }

  async bulkRemove(organization: Organization) {
    if (this.actionPromise != null) {
      return;
    }

    await this.memberDialogManager.openBulkRemoveDialog(
      organization,
      this.dataSource.getCheckedUsers(),
    );
    this.organizationMetadataService.refreshMetadataCache();
    await this.load(organization);
  }

  async bulkDelete(organization: Organization) {
    if (this.actionPromise != null) {
      return;
    }

    await this.memberDialogManager.openBulkDeleteDialog(
      organization,
      this.dataSource.getCheckedUsers(),
    );
    await this.load(organization);
  }

  async bulkRevoke(organization: Organization) {
    await this.bulkRevokeOrRestore(true, organization);
  }

  async bulkRestore(organization: Organization) {
    await this.bulkRevokeOrRestore(false, organization);
  }

  async bulkRevokeOrRestore(isRevoking: boolean, organization: Organization) {
    if (this.actionPromise != null) {
      return;
    }

    await this.memberDialogManager.openBulkRestoreRevokeDialog(
      organization,
      this.dataSource.getCheckedUsers(),
      isRevoking,
    );
    await this.load(organization);
  }

  async bulkReinvite(organization: Organization) {
    if (this.actionPromise != null) {
      return;
    }

    const users = this.dataSource.getCheckedUsers();
    const filteredUsers = users.filter((u) => u.status === OrganizationUserStatusType.Invited);

    if (filteredUsers.length <= 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("noSelectedUsersApplicable"),
      });
      return;
    }

    try {
      const result = await this.memberActionsService.bulkReinvite(
        organization,
        filteredUsers.map((user) => user.id),
      );

      if (!result.successful) {
        throw new Error();
      }

      // Bulk Status component open
      await this.memberDialogManager.openBulkStatusDialog(
        users,
        filteredUsers,
        Promise.resolve(result.successful),
        this.i18nService.t("bulkReinviteMessage"),
      );
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = undefined;
  }

  async bulkConfirm(organization: Organization) {
    if (this.actionPromise != null) {
      return;
    }

    await this.memberDialogManager.openBulkConfirmDialog(
      organization,
      this.dataSource.getCheckedUsers(),
    );
    await this.load(organization);
  }

  async bulkEnableSM(organization: Organization) {
    const users = this.dataSource.getCheckedUsers();

    await this.memberDialogManager.openBulkEnableSecretsManagerDialog(organization, users);

    this.dataSource.uncheckAllUsers();
    await this.load(organization);
  }

  openEventsDialog(user: OrganizationUserView, organization: Organization) {
    this.memberDialogManager.openEventsDialog(user, organization);
  }

  async resetPassword(user: OrganizationUserView, organization: Organization) {
    if (!user || !user.email || !user.id) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("orgUserDetailsNotFound"),
      });
      this.logService.error("Org user details not found when attempting account recovery");

      return;
    }

    const result = await this.memberDialogManager.openAccountRecoveryDialog(user, organization);
    if (result === AccountRecoveryDialogResultType.Ok) {
      await this.load(organization);
    }

    return;
  }

  protected async removeUserConfirmationDialog(user: OrganizationUserView) {
    return await this.memberDialogManager.openRemoveUserConfirmationDialog(user);
  }

  protected async revokeUserConfirmationDialog(user: OrganizationUserView) {
    return await this.memberDialogManager.openRevokeUserConfirmationDialog(user);
  }

  async deleteUser(user: OrganizationUserView, organization: Organization) {
    const confirmed = await this.memberDialogManager.openDeleteUserConfirmationDialog(
      user,
      organization,
    );

    if (!confirmed) {
      return false;
    }

    this.actionPromise = this.memberActionsService.deleteUser(organization, user.id);
    try {
      const result = await this.actionPromise;
      if (!result.success) {
        throw new Error(result.error);
      }
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("organizationUserDeleted", this.userNamePipe.transform(user)),
      });
      this.dataSource.removeUser(user);
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = undefined;
  }

  get showBulkRestoreUsers(): boolean {
    return this.dataSource
      .getCheckedUsers()
      .every((member) => member.status == this.userStatusType.Revoked);
  }

  get showBulkRevokeUsers(): boolean {
    return this.dataSource
      .getCheckedUsers()
      .every((member) => member.status != this.userStatusType.Revoked);
  }

  get showBulkRemoveUsers(): boolean {
    return this.dataSource.getCheckedUsers().every((member) => !member.managedByOrganization);
  }

  get showBulkDeleteUsers(): boolean {
    const validStatuses = [
      this.userStatusType.Accepted,
      this.userStatusType.Confirmed,
      this.userStatusType.Revoked,
    ];

    return this.dataSource
      .getCheckedUsers()
      .every((member) => member.managedByOrganization && validStatuses.includes(member.status));
  }
}
