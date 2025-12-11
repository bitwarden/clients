import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  signal,
  Signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  debounceTime,
  filter,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  merge,
  Observable,
  shareReplay,
  startWith,
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
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { getById } from "@bitwarden/common/platform/misc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import {
  CloudBulkReinviteLimit,
  MaxCheckedCount,
  peopleFilter,
  PeopleTableDataSource,
} from "../../common/people-table-data-source";
import { OrganizationUserView } from "../core/views/organization-user.view";
import { UserConfirmComponent } from "../manage/user-confirm.component";

import { AccountRecoveryDialogResultType } from "./components/account-recovery/account-recovery-dialog.component";
import { MemberDialogResult, MemberDialogTab } from "./components/member-dialog";
import { MemberDialogManagerService, OrganizationMembersService } from "./services";
import { DeleteManagedMemberWarningService } from "./services/delete-managed-member/delete-managed-member-warning.service";
import {
  MemberActionsService,
  MemberActionResult,
} from "./services/member-actions/member-actions.service";

interface BulkFlags {
  showConfirmUsers: boolean;
  showBulkConfirmUsers: boolean;
  showBulkReinviteUsers: boolean;
  showBulkRestoreUsers: boolean;
  showBulkRevokeUsers: boolean;
  showBulkRemoveUsers: boolean;
  showBulkDeleteUsers: boolean;
}

class MembersTableDataSource extends PeopleTableDataSource<OrganizationUserView> {
  protected statusType = OrganizationUserStatusType;
}

@Component({
  templateUrl: "members.component.html",
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersComponent {
  protected apiService = inject(ApiService);
  protected i18nService = inject(I18nService);
  protected organizationManagementPreferencesService = inject(
    OrganizationManagementPreferencesService,
  );
  protected keyService = inject(KeyService);
  protected validationService = inject(ValidationService);
  protected logService = inject(LogService);
  protected userNamePipe = inject(UserNamePipe);
  protected dialogService = inject(DialogService);
  protected toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  protected deleteManagedMemberWarningService = inject(DeleteManagedMemberWarningService);
  private organizationWarningsService = inject(OrganizationWarningsService);
  private memberActionsService = inject(MemberActionsService);
  private memberDialogManager = inject(MemberDialogManagerService);
  protected billingConstraint = inject(BillingConstraintService);
  protected memberService = inject(OrganizationMembersService);
  private organizationService = inject(OrganizationService);
  private accountService = inject(AccountService);
  private policyService = inject(PolicyService);
  private policyApiService = inject(PolicyApiServiceAbstraction);
  private organizationMetadataService = inject(OrganizationMetadataServiceAbstraction);
  private configService = inject(ConfigService);
  private environmentService = inject(EnvironmentService);
  private changeDetectionRef = inject(ChangeDetectorRef);

  private userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  protected userType = OrganizationUserType;
  protected userStatusType = OrganizationUserStatusType;
  protected memberTab = MemberDialogTab;
  protected dataSource = new MembersTableDataSource(this.configService, this.environmentService);

  protected searchControl = new FormControl("", { nonNullable: true });
  protected statusToggle = new BehaviorSubject<OrganizationUserStatusType | undefined>(undefined);

  protected readonly organization: Signal<Organization | undefined>;
  protected readonly firstLoaded = signal(false);

  bulkFlags$: Observable<BulkFlags> = this.dataSource.usersUpdated().pipe(
    startWith(null), // initial emission to kick off reactive member options menu actions
    map(() => {
      const checkedUsers = this.dataSource.getCheckedUsers();
      const result = {
        showConfirmUsers: true,
        showBulkConfirmUsers: true,
        showBulkReinviteUsers: true,
        showBulkRestoreUsers: true,
        showBulkRevokeUsers: true,
        showBulkRemoveUsers: true,
        showBulkDeleteUsers: true,
      };

      if (checkedUsers.length) {
        checkedUsers.forEach((member) => {
          if (member.status !== this.userStatusType.Accepted) {
            result.showBulkConfirmUsers = false;
          }
          if (member.status !== this.userStatusType.Invited) {
            result.showBulkReinviteUsers = false;
          }
          if (member.status !== this.userStatusType.Revoked) {
            result.showBulkRestoreUsers = false;
          }
          if (member.status == this.userStatusType.Revoked) {
            result.showBulkRevokeUsers = false;
          }

          result.showBulkRemoveUsers = !member.managedByOrganization;

          const validStatuses = [
            this.userStatusType.Accepted,
            this.userStatusType.Confirmed,
            this.userStatusType.Revoked,
          ];

          result.showBulkDeleteUsers =
            member.managedByOrganization && validStatuses.includes(member.status);
        });
      }

      result.showConfirmUsers =
        this.dataSource.activeUserCount > 1 &&
        this.dataSource.confirmedUserCount > 0 &&
        this.dataSource.confirmedUserCount < 3 &&
        this.dataSource.acceptedUserCount > 0;

      return result;
    }),
  );

  protected readonly canUseSecretsManager: Signal<boolean> = computed(
    () => this.organization()?.useSecretsManager ?? false,
  );

  protected readonly showUserManagementControls: Signal<boolean> = computed(
    () => this.organization()?.canManageUsers ?? false,
  );

  protected billingMetadata$: Observable<OrganizationBillingMetadataResponse>;

  protected resetPasswordPolicyEnabled$: Observable<boolean>;

  // Fixed sizes used for cdkVirtualScroll
  protected rowHeight = 66;
  protected rowHeightClass = `tw-h-[66px]`;

  constructor() {
    this.dataSource
      .connect()
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.changeDetectionRef.markForCheck();
      });

    combineLatest([this.searchControl.valueChanges.pipe(debounceTime(200)), this.statusToggle])
      .pipe(takeUntilDestroyed())
      .subscribe(
        ([searchText, status]) => (this.dataSource.filter = peopleFilter(searchText, status)),
      );

    this.dataSource = new MembersTableDataSource(this.configService, this.environmentService);

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

  async load(organization: Organization) {
    const response = await this.memberService.loadUsers(organization);
    this.dataSource.data = Array.isArray(response) ? response : [];
    this.firstLoaded.set(true);
  }

  async remove(user: OrganizationUserView, organization: Organization) {
    const confirmed = await this.memberDialogManager.openRemoveUserConfirmationDialog(user);

    if (!confirmed) {
      return false;
    }

    try {
      const result = await this.memberActionsService.removeUser(organization, user.id);
      const sideEffect = () => this.dataSource.removeUser(user);
      await this.handleMemberActionResult(result, "removedUserId", user, sideEffect);
    } catch (e) {
      this.validationService.showError(e);
    }
  }

  async reinvite(user: OrganizationUserView, organization: Organization) {
    try {
      const result = await this.memberActionsService.reinviteUser(organization, user.id);
      await this.handleMemberActionResult(result, "hasBeenReinvited", user);
    } catch (e) {
      this.validationService.showError(e);
    }
  }

  async confirm(user: OrganizationUserView, organization: Organization) {
    const confirmUserSideEffect = () => {
      user.status = this.userStatusType.Confirmed;
      this.dataSource.replaceUser(user);
    };

    const confirmUser = async (publicKey: Uint8Array) => {
      try {
        const result = await this.memberActionsService.confirmUser(user, publicKey, organization);
        await this.handleMemberActionResult(
          result,
          "hasBeenConfirmed",
          user,
          confirmUserSideEffect,
        );
      } catch (e) {
        this.validationService.showError(e);
        throw e;
      }
    };

    try {
      const publicKeyResponse = await this.apiService.getUserPublicKey(user.userId);
      const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

      const autoConfirm = await firstValueFrom(
        this.organizationManagementPreferencesService.autoConfirmFingerPrints.state$,
      );
      if (user == null) {
        throw new Error("Cannot confirm null user.");
      }
      if (autoConfirm == null || !autoConfirm) {
        const dialogRef = UserConfirmComponent.open(this.dialogService, {
          data: {
            name: this.userNamePipe.transform(user),
            userId: user.userId,
            publicKey: publicKey,
            confirmUser: () => confirmUser(publicKey),
          },
        });
        await lastValueFrom(dialogRef.closed);

        return;
      }

      try {
        const fingerprint = await this.keyService.getFingerprint(user.userId, publicKey);
        this.logService.info(`User's fingerprint: ${fingerprint.join("-")}`);
      } catch (e) {
        this.logService.error(e);
      }
      await confirmUser(publicKey);
    } catch (e) {
      this.logService.error(`Handled exception: ${e}`);
    }
  }

  async revoke(user: OrganizationUserView, organization: Organization) {
    const confirmed = await this.memberDialogManager.openRevokeUserConfirmationDialog(user);

    if (!confirmed) {
      return false;
    }

    try {
      const result = await this.memberActionsService.revokeUser(organization, user.id);
      const sideEffect = async () => await this.load(organization);
      await this.handleMemberActionResult(result, "revokedUserId", user, sideEffect);
    } catch (e) {
      this.validationService.showError(e);
    }
  }

  async restore(user: OrganizationUserView, organization: Organization) {
    try {
      const result = await this.memberActionsService.restoreUser(organization, user.id);
      const sideEffect = async () => await this.load(organization);
      await this.handleMemberActionResult(result, "restoredUserId", user, sideEffect);
    } catch (e) {
      this.validationService.showError(e);
    }
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
    const users = this.dataSource.getCheckedUsersWithLimit(MaxCheckedCount);
    await this.memberDialogManager.openBulkRemoveDialog(organization, users);
    this.organizationMetadataService.refreshMetadataCache();
    await this.load(organization);
  }

  async bulkDelete(organization: Organization) {
    const users = this.dataSource.getCheckedUsersWithLimit(MaxCheckedCount);
    await this.memberDialogManager.openBulkDeleteDialog(organization, users);
    await this.load(organization);
  }

  async bulkRevokeOrRestore(isRevoking: boolean, organization: Organization) {
    const users = this.dataSource.getCheckedUsersWithLimit(MaxCheckedCount);
    await this.memberDialogManager.openBulkRestoreRevokeDialog(organization, users, isRevoking);
    await this.load(organization);
  }

  async bulkReinvite(organization: Organization) {
    let users: OrganizationUserView[];
    if (this.dataSource.isIncreasedBulkLimitEnabled()) {
      users = this.dataSource.getCheckedUsersInVisibleOrder();
    } else {
      users = this.dataSource.getCheckedUsers();
    }

    const allInvitedUsers = users.filter((u) => u.status === OrganizationUserStatusType.Invited);

    // Capture the original count BEFORE enforcing the limit
    const originalInvitedCount = allInvitedUsers.length;

    // When feature flag is enabled, limit invited users and uncheck the excess
    let filteredUsers: OrganizationUserView[];
    if (this.dataSource.isIncreasedBulkLimitEnabled()) {
      filteredUsers = this.dataSource.limitAndUncheckExcess(
        allInvitedUsers,
        CloudBulkReinviteLimit,
      );
    } else {
      filteredUsers = allInvitedUsers;
    }

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
        filteredUsers.map((user) => user.id as UserId),
      );

      if (!result.successful) {
        throw new Error();
      }

      // When feature flag is enabled, show toast instead of dialog
      if (this.dataSource.isIncreasedBulkLimitEnabled()) {
        const selectedCount = originalInvitedCount;
        const invitedCount = filteredUsers.length;

        if (selectedCount > CloudBulkReinviteLimit) {
          const excludedCount = selectedCount - CloudBulkReinviteLimit;
          this.toastService.showToast({
            variant: "success",
            message: this.i18nService.t(
              "bulkReinviteLimitedSuccessToast",
              CloudBulkReinviteLimit.toLocaleString(),
              selectedCount.toLocaleString(),
              excludedCount.toLocaleString(),
            ),
          });
        } else {
          this.toastService.showToast({
            variant: "success",
            message: this.i18nService.t("bulkReinviteSuccessToast", invitedCount.toString()),
          });
        }
      } else {
        // Feature flag disabled - show legacy dialog
        await this.memberDialogManager.openBulkStatusDialog(
          users,
          filteredUsers,
          Promise.resolve(result.successful),
          this.i18nService.t("bulkReinviteMessage"),
        );
      }
    } catch (e) {
      this.validationService.showError(e);
    }
  }

  async bulkConfirm(organization: Organization) {
    const users = this.dataSource.getCheckedUsersWithLimit(MaxCheckedCount);
    await this.memberDialogManager.openBulkConfirmDialog(organization, users);
    await this.load(organization);
  }

  async bulkEnableSM(organization: Organization) {
    const users = this.dataSource.getCheckedUsersWithLimit(MaxCheckedCount);
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

  async deleteUser(user: OrganizationUserView, organization: Organization) {
    const confirmed = await this.memberDialogManager.openDeleteUserConfirmationDialog(
      user,
      organization,
    );

    if (!confirmed) {
      return false;
    }

    try {
      const result = await this.memberActionsService.deleteUser(organization, user.id);
      await this.handleMemberActionResult(result, "organizationUserDeleted", user, () => {
        this.dataSource.removeUser(user);
      });
    } catch (e) {
      this.validationService.showError(e);
    }
  }

  async handleMemberActionResult(
    result: MemberActionResult,
    successKey: string,
    user: OrganizationUserView,
    sideEffect?: () => void | Promise<void>,
  ) {
    if (result.success) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(successKey, this.userNamePipe.transform(user)),
      });
      if (sideEffect) {
        await sideEffect();
      }
    } else {
      throw new Error(result.error);
    }
  }
}
