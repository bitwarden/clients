// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import {
  combineLatest,
  concatMap,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  Observable,
  shareReplay,
  switchMap,
  tap,
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
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, SimpleDialogOptions, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import {
  ChangePlanDialogResultType,
  openChangePlanDialog,
} from "../../../billing/organizations/change-plan-dialog.component";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";
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

  organization: Organization;
  status: OrganizationUserStatusType = null;
  orgResetPasswordPolicyEnabled = false;
  orgIsOnSecretsManagerStandalone = false;

  protected canUseSecretsManager$: Observable<boolean>;
  protected showUserManagementControls$: Observable<boolean>;

  // Fixed sizes used for cdkVirtualScroll
  protected rowHeight = 66;
  protected rowHeightClass = `tw-h-[66px]`;

  private organizationUsersCount = 0;

  get occupiedSeatCount(): number {
    return this.organizationUsersCount;
  }

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
        this.accountService.activeAccount$.pipe(
          switchMap((account) =>
            this.organizationService
              .organizations$(account?.id)
              .pipe(getOrganizationById(params.organizationId)),
          ),
        ),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.canUseSecretsManager$ = organization$.pipe(map((org) => org.useSecretsManager));

    const policies$ = combineLatest([
      this.accountService.activeAccount$.pipe(getUserId),
      organization$,
    ]).pipe(
      switchMap(([userId, organization]) => {
        if (organization.isProviderUser) {
          return from(this.policyApiService.getPolicies(organization.id)).pipe(
            map((response) => Policy.fromListResponse(response)),
          );
        }

        return this.policyService.policies$(userId);
      }),
    );

    combineLatest([this.route.queryParams, policies$, organization$])
      .pipe(
        concatMap(async ([qParams, policies, organization]) => {
          this.organization = organization;

          // Backfill pub/priv key if necessary
          if (
            this.organization.canManageUsersPassword &&
            !this.organization.hasPublicAndPrivateKeys
          ) {
            const orgShareKey = await this.keyService.getOrgKey(this.organization.id);
            const orgKeys = await this.keyService.makeKeyPair(orgShareKey);
            const request = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
            const response = await this.organizationApiService.updateKeys(
              this.organization.id,
              request,
            );
            if (response != null) {
              this.organization.hasPublicAndPrivateKeys =
                response.publicKey != null && response.privateKey != null;
              await this.syncService.fullSync(true); // Replace organizations with new data
            } else {
              throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
            }
          }

          const resetPasswordPolicy = policies
            .filter((policy) => policy.type === PolicyType.ResetPassword)
            .find((p) => p.organizationId === this.organization.id);
          this.orgResetPasswordPolicyEnabled = resetPasswordPolicy?.enabled;

          const billingMetadata = await this.billingApiService.getOrganizationBillingMetadata(
            this.organization.id,
          );

          this.orgIsOnSecretsManagerStandalone = billingMetadata.isOnSecretsManagerStandalone;
          this.organizationUsersCount = billingMetadata.organizationOccupiedSeats;

          await this.load();

          this.searchControl.setValue(qParams.search);

          if (qParams.viewEvents != null) {
            const user = this.dataSource.data.filter((u) => u.id === qParams.viewEvents);
            if (user.length > 0 && user[0].status === OrganizationUserStatusType.Confirmed) {
              this.openEventsDialog(user[0]);
            }
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.showUserManagementControls$ = organization$.pipe(
      map((organization) => organization.canManageUsers),
    );
    organization$
      .pipe(
        takeUntilDestroyed(),
        tap((org) => (this.organization = org)),
        switchMap((org) => this.organizationWarningsService.showInactiveSubscriptionDialog$(org)),
      )
      .subscribe();
  }

  async getUsers(): Promise<OrganizationUserView[]> {
    let groupsPromise: Promise<Map<string, string>>;
    let collectionsPromise: Promise<Map<string, string>>;

    // We don't need both groups and collections for the table, so only load one
    const userPromise = this.organizationUserApiService.getAllUsers(this.organization.id, {
      includeGroups: this.organization.useGroups,
      includeCollections: !this.organization.useGroups,
    });

    // Depending on which column is displayed, we need to load the group/collection names
    if (this.organization.useGroups) {
      groupsPromise = this.getGroupNameMap();
    } else {
      collectionsPromise = this.getCollectionNameMap();
    }

    const [usersResponse, groupNamesMap, collectionNamesMap] = await Promise.all([
      userPromise,
      groupsPromise,
      collectionsPromise,
    ]);

    return usersResponse.data?.map<OrganizationUserView>((r) => {
      const userView = OrganizationUserView.fromResponse(r);

      userView.groupNames = userView.groups
        .map((g) => groupNamesMap.get(g))
        .sort(this.i18nService.collator?.compare);
      userView.collectionNames = userView.collections
        .map((c) => collectionNamesMap.get(c.id))
        .sort(this.i18nService.collator?.compare);

      return userView;
    });
  }

  async getGroupNameMap(): Promise<Map<string, string>> {
    const groups = await this.groupService.getAll(this.organization.id);
    const groupNameMap = new Map<string, string>();
    groups.forEach((g) => groupNameMap.set(g.id, g.name));
    return groupNameMap;
  }

  /**
   * Retrieve a map of all collection IDs <-> names for the organization.
   */
  async getCollectionNameMap() {
    const response = from(this.apiService.getCollections(this.organization.id)).pipe(
      map((res) =>
        res.data.map((r) => new Collection(new CollectionData(r as CollectionDetailsResponse))),
      ),
    );

    const decryptedCollections$ = combineLatest([
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.keyService.orgKeys$(userId)),
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

  removeUser(id: string): Promise<void> {
    return this.organizationUserApiService.removeOrganizationUser(this.organization.id, id);
  }

  revokeUser(id: string): Promise<void> {
    return this.organizationUserApiService.revokeOrganizationUser(this.organization.id, id);
  }

  restoreUser(id: string): Promise<void> {
    return this.organizationUserApiService.restoreOrganizationUser(this.organization.id, id);
  }

  reinviteUser(id: string): Promise<void> {
    return this.organizationUserApiService.postOrganizationUserReinvite(this.organization.id, id);
  }

  async confirmUser(user: OrganizationUserView, publicKey: Uint8Array): Promise<void> {
    if (
      await firstValueFrom(this.configService.getFeatureFlag$(FeatureFlag.CreateDefaultLocation))
    ) {
      await firstValueFrom(
        this.organizationUserService.confirmUser(this.organization, user, publicKey),
      );
    } else {
      const orgKey = await this.keyService.getOrgKey(this.organization.id);
      const key = await this.encryptService.encapsulateKeyUnsigned(orgKey, publicKey);
      const request = new OrganizationUserConfirmRequest();
      request.key = key.encryptedString;
      await this.organizationUserApiService.postOrganizationUserConfirm(
        this.organization.id,
        user.id,
        request,
      );
    }
  }

  async revoke(user: OrganizationUserView) {
    const confirmed = await this.revokeUserConfirmationDialog(user);

    if (!confirmed) {
      return false;
    }

    this.actionPromise = this.revokeUser(user.id);
    try {
      await this.actionPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("revokedUserId", this.userNamePipe.transform(user)),
      });
      await this.load();
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = null;
  }

  async restore(user: OrganizationUserView) {
    this.actionPromise = this.restoreUser(user.id);
    try {
      await this.actionPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("restoredUserId", this.userNamePipe.transform(user)),
      });
      await this.load();
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = null;
  }

  allowResetPassword(orgUser: OrganizationUserView): boolean {
    // Hierarchy check
    let callingUserHasPermission = false;

    switch (this.organization.type) {
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

    // Final
    return (
      this.organization.canManageUsersPassword &&
      callingUserHasPermission &&
      this.organization.useResetPassword &&
      this.organization.hasPublicAndPrivateKeys &&
      orgUser.resetPasswordEnrolled &&
      this.orgResetPasswordPolicyEnabled &&
      orgUser.status === OrganizationUserStatusType.Confirmed
    );
  }

  showEnrolledStatus(orgUser: OrganizationUserUserDetailsResponse): boolean {
    return (
      this.organization.useResetPassword &&
      orgUser.resetPasswordEnrolled &&
      this.orgResetPasswordPolicyEnabled
    );
  }

  private getManageBillingText(): string {
    return this.organization.canEditSubscription ? "ManageBilling" : "NoManageBilling";
  }

  private getProductKey(productType: ProductTierType): string {
    let product = "";
    switch (productType) {
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
        throw new Error(`Unsupported product type: ${productType}`);
    }
    return `${product}InvLimitReached${this.getManageBillingText()}`;
  }

  private getDialogContent(): string {
    return this.i18nService.t(
      this.getProductKey(this.organization.productTierType),
      this.organization.seats,
    );
  }

  private getAcceptButtonText(): string {
    if (!this.organization.canEditSubscription) {
      return this.i18nService.t("ok");
    }

    const productType = this.organization.productTierType;

    if (isNotSelfUpgradable(productType)) {
      throw new Error(`Unsupported product type: ${productType}`);
    }

    return this.i18nService.t("upgrade");
  }

  private async handleDialogClose(result: boolean | undefined): Promise<void> {
    if (!result || !this.organization.canEditSubscription) {
      return;
    }

    const productType = this.organization.productTierType;

    if (isNotSelfUpgradable(productType)) {
      throw new Error(`Unsupported product type: ${this.organization.productTierType}`);
    }

    await this.router.navigate(
      ["/organizations", this.organization.id, "billing", "subscription"],
      { queryParams: { upgrade: true } },
    );
  }

  private async showSeatLimitReachedDialog(): Promise<void> {
    const orgUpgradeSimpleDialogOpts: SimpleDialogOptions = {
      title: this.i18nService.t("upgradeOrganization"),
      content: this.getDialogContent(),
      type: "primary",
      acceptButtonText: this.getAcceptButtonText(),
    };

    if (!this.organization.canEditSubscription) {
      orgUpgradeSimpleDialogOpts.cancelButtonText = null;
    }

    const simpleDialog = this.dialogService.openSimpleDialogRef(orgUpgradeSimpleDialogOpts);
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    firstValueFrom(simpleDialog.closed).then(this.handleDialogClose.bind(this));
  }

  private async handleInviteDialog() {
    const dialog = openUserAddEditDialog(this.dialogService, {
      data: {
        kind: "Add",
        organizationId: this.organization.id,
        allOrganizationUserEmails: this.dataSource.data?.map((user) => user.email) ?? [],
        occupiedSeatCount: this.occupiedSeatCount,
        isOnSecretsManagerStandalone: this.orgIsOnSecretsManagerStandalone,
      },
    });

    const result = await lastValueFrom(dialog.closed);

    if (result === MemberDialogResult.Saved) {
      await this.load();
    }
  }

  private async handleSeatLimitForFixedTiers() {
    if (!this.organization.canEditSubscription) {
      await this.showSeatLimitReachedDialog();
      return;
    }

    const reference = openChangePlanDialog(this.dialogService, {
      data: {
        organizationId: this.organization.id,
        subscription: null,
        productTierType: this.organization.productTierType,
      },
    });

    const result = await lastValueFrom(reference.closed);

    if (result === ChangePlanDialogResultType.Submitted) {
      await this.load();
    }
  }

  async invite() {
    if (this.organization.hasReseller && this.organization.seats === this.occupiedSeatCount) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("seatLimitReached"),
        message: this.i18nService.t("contactYourProvider"),
      });

      return;
    }

    if (
      this.occupiedSeatCount === this.organization.seats &&
      isFixedSeatPlan(this.organization.productTierType)
    ) {
      await this.handleSeatLimitForFixedTiers();

      return;
    }

    await this.handleInviteDialog();
  }

  async edit(user: OrganizationUserView, initialTab: MemberDialogTab = MemberDialogTab.Role) {
    const dialog = openUserAddEditDialog(this.dialogService, {
      data: {
        kind: "Edit",
        name: this.userNamePipe.transform(user),
        organizationId: this.organization.id,
        organizationUserId: user.id,
        usesKeyConnector: user.usesKeyConnector,
        isOnSecretsManagerStandalone: this.orgIsOnSecretsManagerStandalone,
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
        await this.load();
        break;
    }
  }

  async bulkRemove() {
    if (this.actionPromise != null) {
      return;
    }

    const dialogRef = BulkRemoveDialogComponent.open(this.dialogService, {
      data: {
        organizationId: this.organization.id,
        users: this.dataSource.getCheckedUsers(),
      },
    });
    await lastValueFrom(dialogRef.closed);
    await this.load();
  }

  async bulkDelete() {
    const warningAcknowledged = await firstValueFrom(
      this.deleteManagedMemberWarningService.warningAcknowledged(this.organization.id),
    );

    if (
      !warningAcknowledged &&
      this.organization.canManageUsers &&
      this.organization.productTierType === ProductTierType.Enterprise
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
        organizationId: this.organization.id,
        users: this.dataSource.getCheckedUsers(),
      },
    });
    await lastValueFrom(dialogRef.closed);
    await this.load();
  }

  async bulkRevoke() {
    await this.bulkRevokeOrRestore(true);
  }

  async bulkRestore() {
    await this.bulkRevokeOrRestore(false);
  }

  async bulkRevokeOrRestore(isRevoking: boolean) {
    if (this.actionPromise != null) {
      return;
    }

    const ref = BulkRestoreRevokeComponent.open(this.dialogService, {
      organizationId: this.organization.id,
      users: this.dataSource.getCheckedUsers(),
      isRevoking: isRevoking,
    });

    await firstValueFrom(ref.closed);
    await this.load();
  }

  async bulkReinvite() {
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
        this.organization.id,
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
    this.actionPromise = null;
  }

  async bulkConfirm() {
    if (this.actionPromise != null) {
      return;
    }

    const dialogRef = BulkConfirmDialogComponent.open(this.dialogService, {
      data: {
        organization: this.organization,
        users: this.dataSource.getCheckedUsers(),
      },
    });

    await lastValueFrom(dialogRef.closed);
    await this.load();
  }

  async bulkEnableSM() {
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
      orgId: this.organization.id,
      users,
    });

    await lastValueFrom(dialogRef.closed);
    this.dataSource.uncheckAllUsers();
    await this.load();
  }

  openEventsDialog(user: OrganizationUserView) {
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        organizationId: this.organization.id,
        entityId: user.id,
        showUser: false,
        entity: "user",
      },
    });
  }

  async resetPassword(user: OrganizationUserView) {
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
        organizationId: this.organization.id as OrganizationId,
        organizationUserId: user.id,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);
    if (result === AccountRecoveryDialogResultType.Ok) {
      await this.load();
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

  async deleteUser(user: OrganizationUserView) {
    const warningAcknowledged = await firstValueFrom(
      this.deleteManagedMemberWarningService.warningAcknowledged(this.organization.id),
    );

    if (
      !warningAcknowledged &&
      this.organization.canManageUsers &&
      this.organization.productTierType === ProductTierType.Enterprise
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

    await this.deleteManagedMemberWarningService.acknowledgeWarning(this.organization.id);

    this.actionPromise = this.organizationUserApiService.deleteOrganizationUser(
      this.organization.id,
      user.id,
    );
    try {
      await this.actionPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("organizationUserDeleted", this.userNamePipe.transform(user)),
      });
      this.dataSource.removeUser(user);
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = null;
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

  async navigateToPaymentMethod() {
    const managePaymentDetailsOutsideCheckout = await this.configService.getFeatureFlag(
      FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout,
    );
    const route = managePaymentDetailsOutsideCheckout ? "payment-details" : "payment-method";
    await this.router.navigate(["organizations", `${this.organization?.id}`, "billing", route], {
      state: { launchPaymentModalAutomatically: true },
    });
  }
}
