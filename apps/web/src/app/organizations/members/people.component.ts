import { Component, OnDestroy, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, concatMap, lastValueFrom, Subject, takeUntil } from "rxjs";

import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CollectionService } from "@bitwarden/common/abstractions/collection.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { OrganizationUserConfirmRequest } from "@bitwarden/common/abstractions/organization-user/requests";
import {
  OrganizationUserBulkResponse,
  OrganizationUserUserDetailsResponse,
} from "@bitwarden/common/abstractions/organization-user/responses";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { PolicyService } from "@bitwarden/common/abstractions/policy/policy.service.abstraction";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { SyncService } from "@bitwarden/common/abstractions/sync/sync.service.abstraction";
import { ValidationService } from "@bitwarden/common/abstractions/validation.service";
import { OrganizationUserStatusType } from "@bitwarden/common/enums/organizationUserStatusType";
import { OrganizationUserType } from "@bitwarden/common/enums/organizationUserType";
import { PolicyType } from "@bitwarden/common/enums/policyType";
import { CollectionData } from "@bitwarden/common/models/data/collection.data";
import { Collection } from "@bitwarden/common/models/domain/collection";
import { OrganizationKeysRequest } from "@bitwarden/common/models/request/organization-keys.request";
import { CollectionDetailsResponse } from "@bitwarden/common/models/response/collection.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { DialogService } from "@bitwarden/components";

import { BasePeopleComponent } from "../../common/base.people.component";
import { GroupService } from "../core";
import { OrganizationUserView } from "../core/views/organization-user.view";
import { EntityEventsComponent } from "../manage/entity-events.component";

import { BulkConfirmComponent } from "./components/bulk/bulk-confirm.component";
import { BulkRemoveComponent } from "./components/bulk/bulk-remove.component";
import { BulkRestoreRevokeComponent } from "./components/bulk/bulk-restore-revoke.component";
import { BulkStatusComponent } from "./components/bulk/bulk-status.component";
import { MemberDialogResult, openUserAddEditDialog } from "./components/member-dialog";
import { ResetPasswordComponent } from "./components/reset-password.component";
import { UserGroupsComponent } from "./components/user-groups.component";

@Component({
  selector: "app-org-people",
  templateUrl: "people.component.html",
})
export class PeopleComponent
  extends BasePeopleComponent<OrganizationUserView>
  implements OnInit, OnDestroy
{
  @ViewChild("groupsTemplate", { read: ViewContainerRef, static: true })
  groupsModalRef: ViewContainerRef;
  @ViewChild("eventsTemplate", { read: ViewContainerRef, static: true })
  eventsModalRef: ViewContainerRef;
  @ViewChild("confirmTemplate", { read: ViewContainerRef, static: true })
  confirmModalRef: ViewContainerRef;
  @ViewChild("resetPasswordTemplate", { read: ViewContainerRef, static: true })
  resetPasswordModalRef: ViewContainerRef;
  @ViewChild("bulkStatusTemplate", { read: ViewContainerRef, static: true })
  bulkStatusModalRef: ViewContainerRef;
  @ViewChild("bulkConfirmTemplate", { read: ViewContainerRef, static: true })
  bulkConfirmModalRef: ViewContainerRef;
  @ViewChild("bulkRemoveTemplate", { read: ViewContainerRef, static: true })
  bulkRemoveModalRef: ViewContainerRef;

  userType = OrganizationUserType;
  userStatusType = OrganizationUserStatusType;

  organizationId: string;
  status: OrganizationUserStatusType = null;
  accessEvents = false;
  accessGroups = false;
  canResetPassword = false; // User permission (admin/custom)
  orgUseResetPassword = false; // Org plan ability
  orgHasKeys = false; // Org public/private keys
  orgResetPasswordPolicyEnabled = false;
  callingUserType: OrganizationUserType = null;

  private destroy$ = new Subject<void>();

  constructor(
    apiService: ApiService,
    private route: ActivatedRoute,
    i18nService: I18nService,
    modalService: ModalService,
    platformUtilsService: PlatformUtilsService,
    cryptoService: CryptoService,
    searchService: SearchService,
    validationService: ValidationService,
    private policyService: PolicyService,
    logService: LogService,
    searchPipe: SearchPipe,
    userNamePipe: UserNamePipe,
    private syncService: SyncService,
    stateService: StateService,
    private organizationService: OrganizationService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationUserService: OrganizationUserService,
    private dialogService: DialogService,
    private groupService: GroupService,
    private collectionService: CollectionService
  ) {
    super(
      apiService,
      searchService,
      i18nService,
      platformUtilsService,
      cryptoService,
      validationService,
      modalService,
      logService,
      searchPipe,
      userNamePipe,
      stateService
    );
  }

  async ngOnInit() {
    combineLatest([this.route.params, this.route.queryParams, this.policyService.policies$])
      .pipe(
        concatMap(async ([params, qParams, policies]) => {
          this.organizationId = params.organizationId;
          const organization = await this.organizationService.get(this.organizationId);
          this.accessEvents = organization.useEvents;
          this.accessGroups = organization.useGroups;
          this.canResetPassword = organization.canManageUsersPassword;
          this.orgUseResetPassword = organization.useResetPassword;
          this.callingUserType = organization.type;
          this.orgHasKeys = organization.hasPublicAndPrivateKeys;

          // Backfill pub/priv key if necessary
          if (this.canResetPassword && !this.orgHasKeys) {
            const orgShareKey = await this.cryptoService.getOrgKey(this.organizationId);
            const orgKeys = await this.cryptoService.makeKeyPair(orgShareKey);
            const request = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
            const response = await this.organizationApiService.updateKeys(
              this.organizationId,
              request
            );
            if (response != null) {
              this.orgHasKeys = response.publicKey != null && response.privateKey != null;
              await this.syncService.fullSync(true); // Replace oganizations with new data
            } else {
              throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
            }
          }

          const resetPasswordPolicy = policies
            .filter((policy) => policy.type === PolicyType.ResetPassword)
            .find((p) => p.organizationId === this.organizationId);
          this.orgResetPasswordPolicyEnabled = resetPasswordPolicy?.enabled;

          await this.load();

          this.searchText = qParams.search;
          if (qParams.viewEvents != null) {
            const user = this.users.filter((u) => u.id === qParams.viewEvents);
            if (user.length > 0 && user[0].status === OrganizationUserStatusType.Confirmed) {
              this.events(user[0]);
            }
          }
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load() {
    await super.load();
  }

  async getUsers(): Promise<OrganizationUserView[]> {
    let groupsPromise: Promise<Map<string, string>>;
    let collectionsPromise: Promise<Map<string, string>>;

    // We don't need both groups and collections for the table, so only load one
    const userPromise = this.organizationUserService.getAllUsers(this.organizationId, {
      includeGroups: this.accessGroups,
      includeCollections: !this.accessGroups,
    });

    // Depending on which column is displayed, we need to load the group/collection names
    if (this.accessGroups) {
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
    const groups = await this.groupService.getAll(this.organizationId);
    const groupNameMap = new Map<string, string>();
    groups.forEach((g) => groupNameMap.set(g.id, g.name));
    return groupNameMap;
  }

  /**
   * Retrieve a map of all collection IDs <-> names for the organization.
   */
  async getCollectionNameMap() {
    const collectionMap = new Map<string, string>();
    const response = await this.apiService.getCollections(this.organizationId);

    const collections = response.data.map(
      (r) => new Collection(new CollectionData(r as CollectionDetailsResponse))
    );
    const decryptedCollections = await this.collectionService.decryptMany(collections);

    decryptedCollections.forEach((c) => collectionMap.set(c.id, c.name));

    return collectionMap;
  }

  deleteUser(id: string): Promise<void> {
    return this.organizationUserService.deleteOrganizationUser(this.organizationId, id);
  }

  revokeUser(id: string): Promise<void> {
    return this.organizationUserService.revokeOrganizationUser(this.organizationId, id);
  }

  restoreUser(id: string): Promise<void> {
    return this.organizationUserService.restoreOrganizationUser(this.organizationId, id);
  }

  reinviteUser(id: string): Promise<void> {
    return this.organizationUserService.postOrganizationUserReinvite(this.organizationId, id);
  }

  async confirmUser(user: OrganizationUserView, publicKey: Uint8Array): Promise<void> {
    const orgKey = await this.cryptoService.getOrgKey(this.organizationId);
    const key = await this.cryptoService.rsaEncrypt(orgKey.key, publicKey.buffer);
    const request = new OrganizationUserConfirmRequest();
    request.key = key.encryptedString;
    await this.organizationUserService.postOrganizationUserConfirm(
      this.organizationId,
      user.id,
      request
    );
  }

  allowResetPassword(orgUser: OrganizationUserView): boolean {
    // Hierarchy check
    let callingUserHasPermission = false;

    switch (this.callingUserType) {
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
      this.canResetPassword &&
      callingUserHasPermission &&
      this.orgUseResetPassword &&
      this.orgHasKeys &&
      orgUser.resetPasswordEnrolled &&
      this.orgResetPasswordPolicyEnabled &&
      orgUser.status === OrganizationUserStatusType.Confirmed
    );
  }

  showEnrolledStatus(orgUser: OrganizationUserUserDetailsResponse): boolean {
    return (
      this.orgUseResetPassword &&
      orgUser.resetPasswordEnrolled &&
      this.orgResetPasswordPolicyEnabled
    );
  }

  async edit(user: OrganizationUserView) {
    const dialog = openUserAddEditDialog(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        organizationId: this.organizationId,
        organizationUserId: user != null ? user.id : null,
        usesKeyConnector: user?.usesKeyConnector,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    switch (result) {
      case MemberDialogResult.Deleted:
        this.removeUser(user);
        break;
      case MemberDialogResult.Saved:
      case MemberDialogResult.Revoked:
      case MemberDialogResult.Restored:
        this.load();
        break;
    }
  }

  async groups(user: OrganizationUserUserDetailsResponse) {
    const [modal] = await this.modalService.openViewRef(
      UserGroupsComponent,
      this.groupsModalRef,
      (comp) => {
        comp.name = this.userNamePipe.transform(user);
        comp.organizationId = this.organizationId;
        comp.organizationUserId = user != null ? user.id : null;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onSavedUser.subscribe(() => {
          modal.close();
          this.load();
        });
      }
    );
  }

  async bulkRemove() {
    if (this.actionPromise != null) {
      return;
    }

    const [modal] = await this.modalService.openViewRef(
      BulkRemoveComponent,
      this.bulkRemoveModalRef,
      (comp) => {
        comp.organizationId = this.organizationId;
        comp.users = this.getCheckedUsers();
      }
    );

    await modal.onClosedPromise();
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

    const ref = this.modalService.open(BulkRestoreRevokeComponent, {
      allowMultipleModals: true,
      data: {
        organizationId: this.organizationId,
        users: this.getCheckedUsers(),
        isRevoking: isRevoking,
      },
    });

    await ref.onClosedPromise();
    await this.load();
  }

  async bulkReinvite() {
    if (this.actionPromise != null) {
      return;
    }

    const users = this.getCheckedUsers();
    const filteredUsers = users.filter((u) => u.status === OrganizationUserStatusType.Invited);

    if (filteredUsers.length <= 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("noSelectedUsersApplicable")
      );
      return;
    }

    try {
      const response = this.organizationUserService.postManyOrganizationUserReinvite(
        this.organizationId,
        filteredUsers.map((user) => user.id)
      );
      this.showBulkStatus(
        users,
        filteredUsers,
        response,
        this.i18nService.t("bulkReinviteMessage")
      );
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = null;
  }

  async bulkConfirm() {
    if (this.actionPromise != null) {
      return;
    }

    const [modal] = await this.modalService.openViewRef(
      BulkConfirmComponent,
      this.bulkConfirmModalRef,
      (comp) => {
        comp.organizationId = this.organizationId;
        comp.users = this.getCheckedUsers();
      }
    );

    await modal.onClosedPromise();
    await this.load();
  }

  async events(user: OrganizationUserView) {
    await this.modalService.openViewRef(EntityEventsComponent, this.eventsModalRef, (comp) => {
      comp.name = this.userNamePipe.transform(user);
      comp.organizationId = this.organizationId;
      comp.entityId = user.id;
      comp.showUser = false;
      comp.entity = "user";
    });
  }

  async resetPassword(user: OrganizationUserView) {
    const [modal] = await this.modalService.openViewRef(
      ResetPasswordComponent,
      this.resetPasswordModalRef,
      (comp) => {
        comp.name = this.userNamePipe.transform(user);
        comp.email = user != null ? user.email : null;
        comp.organizationId = this.organizationId;
        comp.id = user != null ? user.id : null;

        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onPasswordReset.subscribe(() => {
          modal.close();
          this.load();
        });
      }
    );
  }

  protected async removeUserConfirmationDialog(user: OrganizationUserView) {
    const warningMessage = user.usesKeyConnector
      ? this.i18nService.t("removeUserConfirmationKeyConnector")
      : this.i18nService.t("removeOrgUserConfirmation");

    return this.platformUtilsService.showDialog(
      warningMessage,
      this.i18nService.t("removeUserIdAccess", this.userNamePipe.transform(user)),
      this.i18nService.t("yes"),
      this.i18nService.t("no"),
      "warning"
    );
  }

  private async showBulkStatus(
    users: OrganizationUserView[],
    filteredUsers: OrganizationUserView[],
    request: Promise<ListResponse<OrganizationUserBulkResponse>>,
    successfullMessage: string
  ) {
    const [modal, childComponent] = await this.modalService.openViewRef(
      BulkStatusComponent,
      this.bulkStatusModalRef,
      (comp) => {
        comp.loading = true;
      }
    );

    // Workaround to handle closing the modal shortly after it has been opened
    let close = false;
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    modal.onShown.subscribe(() => {
      if (close) {
        modal.close();
      }
    });

    try {
      const response = await request;

      if (modal) {
        const keyedErrors: any = response.data
          .filter((r) => r.error !== "")
          .reduce((a, x) => ({ ...a, [x.id]: x.error }), {});
        const keyedFilteredUsers: any = filteredUsers.reduce((a, x) => ({ ...a, [x.id]: x }), {});

        childComponent.users = users.map((user) => {
          let message = keyedErrors[user.id] ?? successfullMessage;
          // eslint-disable-next-line
          if (!keyedFilteredUsers.hasOwnProperty(user.id)) {
            message = this.i18nService.t("bulkFilteredMessage");
          }

          return {
            user: user,
            error: keyedErrors.hasOwnProperty(user.id), // eslint-disable-line
            message: message,
          };
        });
        childComponent.loading = false;
      }
    } catch {
      close = true;
      modal.close();
    }
  }
}
