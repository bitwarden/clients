import { Component, computed, Signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import {
  catchError,
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserConfirmRequest,
  OrganizationUserUserDetailsResponse,
  CollectionService,
  CollectionData,
  Collection,
  CollectionDetailsResponse,
} from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { PolicyApiServiceAbstraction as PolicyApiService } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
  PolicyType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { isNotSelfUpgradable, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, SimpleDialogOptions, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import {
  ChangePlanDialogResultType,
  openChangePlanDialog,
} from "../../../billing/organizations/change-plan-dialog.component";
import { BaseMembersComponent } from "../../common/base-members.component";
import { PeopleTableDataSource } from "../../common/people-table-data-source";
import { GroupApiService } from "../core";
import { OrganizationUserView } from "../core/views/organization-user.view";
import { openEntityEventsDialog } from "../manage/entity-events.component";

import {
  AccountRecoveryDialogComponent,
  AccountRecoveryDialogResultType,
} from "./components/account-recovery/account-recovery-dialog.component";
import { BulkConfirmDialogComponent } from "./components/bulk/bulk-confirm-dialog.component";
import { BulkDeleteDialogComponent } from "./components/bulk/bulk-delete-dialog.component";
import { BulkEnableSecretsManagerDialogComponent } from "./components/bulk/bulk-enable-sm-dialog.component";
import { BulkRemoveDialogComponent } from "./components/bulk/bulk-remove-dialog.component";
import { BulkRestoreRevokeComponent } from "./components/bulk/bulk-restore-revoke.component";
import { BulkStatusComponent } from "./components/bulk/bulk-status.component";
import {
  MemberDialogResult,
  MemberDialogTab,
  openUserAddEditDialog,
} from "./components/member-dialog";
import { isFixedSeatPlan } from "./components/member-dialog/validators/org-seat-limit-reached.validator";
import { DeleteManagedMemberWarningService } from "./services/delete-managed-member/delete-managed-member-warning.service";
import { OrganizationUserService } from "./services/organization-user/organization-user.service";

class MembersTableDataSource extends PeopleTableDataSource<OrganizationUserView> {
  protected statusType = OrganizationUserStatusType;
}

@Component({
  templateUrl: "members.component.html",
  standalone: false,
})
export class MembersComponent extends BaseMembersComponent<OrganizationUserView> {
  userType = OrganizationUserType;
  userStatusType = OrganizationUserStatusType;
  memberTab = MemberDialogTab;
  protected dataSource = new MembersTableDataSource();

  organization: Signal<Organization | undefined>;
  status: OrganizationUserStatusType | undefined;
  orgResetPasswordPolicyEnabled = false;

  protected canUseSecretsManager: Signal<boolean> = computed(
    () => this.organization()?.useSecretsManager ?? false,
  );
  protected showUserManagementControls: Signal<boolean> = computed(
    () => this.organization()?.canManageUsers ?? false,
  );
  protected billingMetadata$: Observable<OrganizationBillingMetadataResponse>;

  // Fixed sizes used for cdkVirtualScroll
  protected rowHeight = 66;
  protected rowHeightClass = `tw-h-[66px]`;

  private userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  constructor(
    apiService: ApiService,
    i18nService: I18nService,
    organizationManagementPreferencesService: OrganizationManagementPreferencesService,
    keyService: KeyService,
    private encryptService: EncryptService,
    validationService: ValidationService,
    logService: LogService,
    userNamePipe: UserNamePipe,
    dialogService: DialogService,
    toastService: ToastService,
    private policyService: PolicyService,
    private policyApiService: PolicyApiService,
    private route: ActivatedRoute,
    private syncService: SyncService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationUserApiService: OrganizationUserApiService,
    private router: Router,
    private groupService: GroupApiService,
    private collectionService: CollectionService,
    private billingApiService: BillingApiServiceAbstraction,
    protected deleteManagedMemberWarningService: DeleteManagedMemberWarningService,
    private configService: ConfigService,
    private organizationUserService: OrganizationUserService,
    private organizationWarningsService: OrganizationWarningsService,
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
            this.organizationService
              .organizations$(userId)
              .pipe(getOrganizationById(params.organizationId)),
          ),
        ),
      ),
      filter((organization): organization is Organization => organization != null),
      shareReplay({ refCount: true, bufferSize: 1 }),
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

    combineLatest([this.route.queryParams, policies$, organization$])
      .pipe(
        concatMap(async ([qParams, policies, organization]) => {
          // Backfill pub/priv key if necessary
          if (organization.canManageUsersPassword && !organization.hasPublicAndPrivateKeys) {
            const orgShareKey = await firstValueFrom(
              this.userId$.pipe(
                switchMap((userId) => this.keyService.orgKeys$(userId)),
                map((orgKeys) => {
                  if (orgKeys == null || orgKeys[organization.id] == null) {
                    throw new Error("Organization keys not found for provided User.");
                  }
                  return orgKeys[organization.id];
                }),
              ),
            );

            const [orgPublicKey, encryptedOrgPrivateKey] =
              await this.keyService.makeKeyPair(orgShareKey);
            if (encryptedOrgPrivateKey.encryptedString == null) {
              throw new Error("Encrypted private key is null.");
            }
            const request = new OrganizationKeysRequest(
              orgPublicKey,
              encryptedOrgPrivateKey.encryptedString,
            );
            const response = await this.organizationApiService.updateKeys(organization.id, request);
            if (response != null) {
              await this.syncService.fullSync(true); // Replace organizations with new data
            } else {
              throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
            }
          }

          const resetPasswordPolicy = policies
            .filter((policy) => policy.type === PolicyType.ResetPassword)
            .find((p) => p.organizationId === organization.id);
          this.orgResetPasswordPolicyEnabled = resetPasswordPolicy?.enabled ?? false;

          await this.load(organization);

          this.searchControl.setValue(qParams.search);

          if (qParams.viewEvents != null) {
            const user = this.dataSource.data.filter((u) => u.id === qParams.viewEvents);
            if (user.length > 0 && user[0].status === OrganizationUserStatusType.Confirmed) {
              this.openEventsDialog(user[0], organization);
            }
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.billingMetadata$ = organization$.pipe(
      switchMap((organization) =>
        this.billingApiService.getOrganizationBillingMetadata(organization.id),
      ),
      catchError((error: unknown) => {
        this.logService.error("Failed to load billing metadata", error);
        return of();
      }),
    );

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
  }

  async getUsers(organization: Organization): Promise<OrganizationUserView[]> {
    let groupsPromise: Promise<Map<string, string>> | undefined;
    let collectionsPromise: Promise<Map<string, string>> | undefined;

    // We don't need both groups and collections for the table, so only load one
    const userPromise = this.organizationUserApiService.getAllUsers(organization.id, {
      includeGroups: organization.useGroups,
      includeCollections: !organization.useGroups,
    });

    // Depending on which column is displayed, we need to load the group/collection names
    if (organization.useGroups) {
      groupsPromise = this.getGroupNameMap(organization);
    } else {
      collectionsPromise = this.getCollectionNameMap(organization);
    }

    const [usersResponse, groupNamesMap, collectionNamesMap] = await Promise.all([
      userPromise,
      groupsPromise,
      collectionsPromise,
    ]);

    return (
      usersResponse.data?.map<OrganizationUserView>((r) => {
        const userView = OrganizationUserView.fromResponse(r);

        userView.groupNames = userView.groups
          .map((g) => groupNamesMap?.get(g))
          .filter((name): name is string => name != null)
          .sort(this.i18nService.collator?.compare);
        userView.collectionNames = userView.collections
          .map((c) => collectionNamesMap?.get(c.id))
          .filter((name): name is string => name != null)
          .sort(this.i18nService.collator?.compare);

        return userView;
      }) ?? []
    );
  }

  async getGroupNameMap(organization: Organization): Promise<Map<string, string>> {
    const groups = await this.groupService.getAll(organization.id);
    const groupNameMap = new Map<string, string>();
    groups.forEach((g) => groupNameMap.set(g.id, g.name));
    return groupNameMap;
  }

  /**
   * Retrieve a map of all collection IDs <-> names for the organization.
   */
  async getCollectionNameMap(organization: Organization) {
    const response = from(this.apiService.getCollections(organization.id)).pipe(
      map((res) =>
        res.data.map((r) =>
          Collection.fromCollectionData(new CollectionData(r as CollectionDetailsResponse)),
        ),
      ),
    );

    const decryptedCollections$ = combineLatest([
      this.userId$.pipe(
        switchMap((userId) => this.keyService.orgKeys$(userId)),
        filter((orgKeys) => orgKeys != null),
      ),
      response,
    ]).pipe(
      switchMap(([orgKeys, collections]) =>
        this.collectionService.decryptMany$(collections, orgKeys),
      ),
      map((collections) => {
        const collectionMap = new Map<string, string>();
        collections.forEach((c) => collectionMap.set(c.id, c.name));
        return collectionMap;
      }),
    );

    return await firstValueFrom(decryptedCollections$);
  }

  removeUser(id: string, organization: Organization): Promise<void> {
    return this.organizationUserApiService.removeOrganizationUser(organization.id, id);
  }

  revokeUser(id: string, organization: Organization): Promise<void> {
    return this.organizationUserApiService.revokeOrganizationUser(organization.id, id);
  }

  restoreUser(id: string, organization: Organization): Promise<void> {
    return this.organizationUserApiService.restoreOrganizationUser(organization.id, id);
  }

  reinviteUser(id: string, organization: Organization): Promise<void> {
    return this.organizationUserApiService.postOrganizationUserReinvite(organization.id, id);
  }

  async confirmUser(
    user: OrganizationUserView,
    publicKey: Uint8Array,
    organization: Organization,
  ): Promise<void> {
    if (
      await firstValueFrom(this.configService.getFeatureFlag$(FeatureFlag.CreateDefaultLocation))
    ) {
      await firstValueFrom(this.organizationUserService.confirmUser(organization, user, publicKey));
    } else {
      const request = await firstValueFrom(
        this.userId$.pipe(
          switchMap((userId) => this.keyService.orgKeys$(userId)),
          filter((orgKeys) => orgKeys != null),
          map((orgKeys) => orgKeys[organization.id]),
          switchMap((orgKey) => this.encryptService.encapsulateKeyUnsigned(orgKey, publicKey)),
          map((encKey) => {
            const req = new OrganizationUserConfirmRequest();
            req.key = encKey.encryptedString;
            return req;
          }),
        ),
      );

      await this.organizationUserApiService.postOrganizationUserConfirm(
        organization.id,
        user.id,
        request,
      );
    }
  }

  async revoke(user: OrganizationUserView, organization: Organization) {
    const confirmed = await this.revokeUserConfirmationDialog(user);

    if (!confirmed) {
      return false;
    }

    this.actionPromise = this.revokeUser(user.id, organization);
    try {
      await this.actionPromise;
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("revokedUserId", this.userNamePipe.transform(user)),
      });
      await this.load(organization);
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = undefined;
  }

  async restore(user: OrganizationUserView, organization: Organization) {
    this.actionPromise = this.restoreUser(user.id, organization);
    try {
      await this.actionPromise;
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("restoredUserId", this.userNamePipe.transform(user)),
      });
      await this.load(organization);
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = undefined;
  }

  allowResetPassword(orgUser: OrganizationUserView, organization: Organization): boolean {
    let callingUserHasPermission = false;

    switch (organization.type) {
      case OrganizationUserType.Owner:
        callingUserHasPermission = true;
        break;
      case OrganizationUserType.Admin:
        callingUserHasPermission = orgUser.type !== OrganizationUserType.Owner;
        break;
      case OrganizationUserType.Custom:
        callingUserHasPermission =
          orgUser.type !== OrganizationUserType.Owner &&
          orgUser.type !== OrganizationUserType.Admin;
        break;
    }

    return (
      organization.canManageUsersPassword &&
      callingUserHasPermission &&
      organization.useResetPassword &&
      organization.hasPublicAndPrivateKeys &&
      orgUser.resetPasswordEnrolled &&
      this.orgResetPasswordPolicyEnabled &&
      orgUser.status === OrganizationUserStatusType.Confirmed
    );
  }

  showEnrolledStatus(
    orgUser: OrganizationUserUserDetailsResponse,
    organization: Organization,
  ): boolean {
    return (
      organization.useResetPassword &&
      orgUser.resetPasswordEnrolled &&
      this.orgResetPasswordPolicyEnabled
    );
  }

  private getManageBillingText(organization: Organization): string {
    return organization.canEditSubscription ? "ManageBilling" : "NoManageBilling";
  }

  private getProductKey(organization: Organization): string {
    let product = "";
    switch (organization.productTierType) {
      case ProductTierType.Free:
        product = "freeOrg";
        break;
      case ProductTierType.TeamsStarter:
        product = "teamsStarterPlan";
        break;
      case ProductTierType.Families:
        product = "familiesPlan";
        break;
      default:
        throw new Error(`Unsupported product type: ${organization.productTierType}`);
    }
    return `${product}InvLimitReached${this.getManageBillingText(organization)}`;
  }

  private getDialogContent(organization: Organization): string {
    return this.i18nService.t(this.getProductKey(organization), organization.seats);
  }

  private getAcceptButtonText(organization: Organization): string {
    if (!organization.canEditSubscription) {
      return this.i18nService.t("ok");
    }

    const productType = organization.productTierType;

    if (isNotSelfUpgradable(productType)) {
      throw new Error(`Unsupported product type: ${productType}`);
    }

    return this.i18nService.t("upgrade");
  }

  private async handleDialogClose(
    result: boolean | undefined,
    organization: Organization,
  ): Promise<void> {
    if (!result || !organization.canEditSubscription) {
      return;
    }

    const productType = organization.productTierType;

    if (isNotSelfUpgradable(productType)) {
      throw new Error(`Unsupported product type: ${organization.productTierType}`);
    }

    await this.router.navigate(["/organizations", organization.id, "billing", "subscription"], {
      queryParams: { upgrade: true },
    });
  }

  private async showSeatLimitReachedDialog(organization: Organization): Promise<void> {
    const orgUpgradeSimpleDialogOpts: SimpleDialogOptions = {
      title: this.i18nService.t("upgradeOrganization"),
      content: this.getDialogContent(organization),
      type: "primary",
      acceptButtonText: this.getAcceptButtonText(organization),
    };

    if (!organization.canEditSubscription) {
      orgUpgradeSimpleDialogOpts.cancelButtonText = null;
    }

    const simpleDialog = this.dialogService.openSimpleDialogRef(orgUpgradeSimpleDialogOpts);
    await lastValueFrom(
      simpleDialog.closed.pipe(map((closed) => this.handleDialogClose(closed, organization))),
    );
  }

  private async handleInviteDialog(organization: Organization) {
    const dialog = openUserAddEditDialog(this.dialogService, {
      data: {
        kind: "Add",
        organizationId: organization.id,
        allOrganizationUserEmails: this.dataSource.data?.map((user) => user.email) ?? [],
        occupiedSeatCount:
          (await firstValueFrom(this.billingMetadata$)).organizationOccupiedSeats ?? 0,
        isOnSecretsManagerStandalone:
          (await firstValueFrom(this.billingMetadata$)).isOnSecretsManagerStandalone ?? false,
      },
    });

    const result = await lastValueFrom(dialog.closed);

    if (result === MemberDialogResult.Saved) {
      await this.load(organization);
    }
  }

  private async handleSeatLimitForFixedTiers(organization: Organization) {
    if (!organization.canEditSubscription) {
      await this.showSeatLimitReachedDialog(organization);
      return;
    }

    const reference = openChangePlanDialog(this.dialogService, {
      data: {
        organizationId: organization.id,
        productTierType: organization.productTierType,
      },
    });

    const result = await lastValueFrom(reference.closed);

    if (result === ChangePlanDialogResultType.Submitted) {
      await this.load(organization);
    }
  }

  async invite(organization: Organization) {
    if (
      organization.hasReseller &&
      organization.seats === (await firstValueFrom(this.billingMetadata$)).organizationOccupiedSeats
    ) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("seatLimitReached"),
        message: this.i18nService.t("contactYourProvider"),
      });

      return;
    }

    if (
      (await firstValueFrom(this.billingMetadata$)).organizationOccupiedSeats ===
        organization.seats &&
      isFixedSeatPlan(organization.productTierType)
    ) {
      await this.handleSeatLimitForFixedTiers(organization);

      return;
    }

    await this.handleInviteDialog(organization);
  }

  async edit(
    user: OrganizationUserView,
    organization: Organization,
    initialTab: MemberDialogTab = MemberDialogTab.Role,
  ) {
    const dialog = openUserAddEditDialog(this.dialogService, {
      data: {
        kind: "Edit",
        name: this.userNamePipe.transform(user),
        organizationId: organization.id,
        organizationUserId: user.id,
        usesKeyConnector: user.usesKeyConnector,
        isOnSecretsManagerStandalone:
          (await firstValueFrom(this.billingMetadata$)).isOnSecretsManagerStandalone ?? false,
        initialTab: initialTab,
        managedByOrganization: user.managedByOrganization,
      },
    });

    const result = await lastValueFrom(dialog.closed);
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

    const dialogRef = BulkRemoveDialogComponent.open(this.dialogService, {
      data: {
        organizationId: organization.id,
        users: this.dataSource.getCheckedUsers(),
      },
    });
    await lastValueFrom(dialogRef.closed);
    await this.load(organization);
  }

  async bulkDelete(organization: Organization) {
    const warningAcknowledged = await firstValueFrom(
      this.deleteManagedMemberWarningService.warningAcknowledged(organization.id),
    );

    if (
      !warningAcknowledged &&
      organization.canManageUsers &&
      organization.productTierType === ProductTierType.Enterprise
    ) {
      const acknowledged = await this.deleteManagedMemberWarningService.showWarning();
      if (!acknowledged) {
        return;
      }
    }

    if (this.actionPromise != null) {
      return;
    }

    const dialogRef = BulkDeleteDialogComponent.open(this.dialogService, {
      data: {
        organizationId: organization.id,
        users: this.dataSource.getCheckedUsers(),
      },
    });
    await lastValueFrom(dialogRef.closed);
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

    const ref = BulkRestoreRevokeComponent.open(this.dialogService, {
      organizationId: organization.id,
      users: this.dataSource.getCheckedUsers(),
      isRevoking: isRevoking,
    });

    await firstValueFrom(ref.closed);
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
      const response = this.organizationUserApiService.postManyOrganizationUserReinvite(
        organization.id,
        filteredUsers.map((user) => user.id),
      );
      // Bulk Status component open
      const dialogRef = BulkStatusComponent.open(this.dialogService, {
        data: {
          users: users,
          filteredUsers: filteredUsers,
          request: response,
          successfulMessage: this.i18nService.t("bulkReinviteMessage"),
        },
      });
      await lastValueFrom(dialogRef.closed);
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = undefined;
  }

  async bulkConfirm(organization: Organization) {
    if (this.actionPromise != null) {
      return;
    }

    const dialogRef = BulkConfirmDialogComponent.open(this.dialogService, {
      data: {
        organization: organization,
        users: this.dataSource.getCheckedUsers(),
      },
    });

    await lastValueFrom(dialogRef.closed);
    await this.load(organization);
  }

  async bulkEnableSM(organization: Organization) {
    const users = this.dataSource.getCheckedUsers().filter((ou) => !ou.accessSecretsManager);

    if (users.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("noSelectedUsersApplicable"),
      });
      return;
    }

    const dialogRef = BulkEnableSecretsManagerDialogComponent.open(this.dialogService, {
      orgId: organization.id,
      users,
    });

    await lastValueFrom(dialogRef.closed);
    this.dataSource.uncheckAllUsers();
    await this.load(organization);
  }

  openEventsDialog(user: OrganizationUserView, organization: Organization) {
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        organizationId: organization.id,
        entityId: user.id,
        showUser: false,
        entity: "user",
      },
    });
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

    const dialogRef = AccountRecoveryDialogComponent.open(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        email: user.email,
        organizationId: organization.id as OrganizationId,
        organizationUserId: user.id,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);
    if (result === AccountRecoveryDialogResultType.Ok) {
      await this.load(organization);
    }

    return;
  }

  protected async removeUserConfirmationDialog(user: OrganizationUserView) {
    const content = user.usesKeyConnector
      ? "removeUserConfirmationKeyConnector"
      : "removeOrgUserConfirmation";

    const confirmed = await this.dialogService.openSimpleDialog({
      title: {
        key: "removeUserIdAccess",
        placeholders: [this.userNamePipe.transform(user)],
      },
      content: { key: content },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    if (user.status > OrganizationUserStatusType.Invited && user.hasMasterPassword === false) {
      return await this.noMasterPasswordConfirmationDialog(user);
    }

    return true;
  }

  protected async revokeUserConfirmationDialog(user: OrganizationUserView) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "revokeAccess", placeholders: [this.userNamePipe.transform(user)] },
      content: this.i18nService.t("revokeUserConfirmation"),
      acceptButtonText: { key: "revokeAccess" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    if (user.status > OrganizationUserStatusType.Invited && user.hasMasterPassword === false) {
      return await this.noMasterPasswordConfirmationDialog(user);
    }

    return true;
  }

  async deleteUser(user: OrganizationUserView, organization: Organization) {
    const warningAcknowledged = await firstValueFrom(
      this.deleteManagedMemberWarningService.warningAcknowledged(organization.id),
    );

    if (
      !warningAcknowledged &&
      organization.canManageUsers &&
      organization.productTierType === ProductTierType.Enterprise
    ) {
      const acknowledged = await this.deleteManagedMemberWarningService.showWarning();
      if (!acknowledged) {
        return false;
      }
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: {
        key: "deleteOrganizationUser",
        placeholders: [this.userNamePipe.transform(user)],
      },
      content: {
        key: "deleteOrganizationUserWarningDesc",
        placeholders: [this.userNamePipe.transform(user)],
      },
      type: "warning",
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
    });

    if (!confirmed) {
      return false;
    }

    await this.deleteManagedMemberWarningService.acknowledgeWarning(organization.id);

    this.actionPromise = this.organizationUserApiService.deleteOrganizationUser(
      organization.id,
      user.id,
    );
    try {
      await this.actionPromise;
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

  private async noMasterPasswordConfirmationDialog(user: OrganizationUserView) {
    return this.dialogService.openSimpleDialog({
      title: {
        key: "removeOrgUserNoMasterPasswordTitle",
      },
      content: {
        key: "removeOrgUserNoMasterPasswordDesc",
        placeholders: [this.userNamePipe.transform(user)],
      },
      type: "warning",
    });
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

  async navigateToPaymentMethod(organization: Organization) {
    const managePaymentDetailsOutsideCheckout = await this.configService.getFeatureFlag(
      FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout,
    );
    const route = managePaymentDetailsOutsideCheckout ? "payment-details" : "payment-method";
    await this.router.navigate(["organizations", `${organization.id}`, "billing", route], {
      state: { launchPaymentModalAutomatically: true },
    });
  }
}
