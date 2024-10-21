import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { lastValueFrom } from "rxjs";
import { first } from "rxjs/operators";

import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderUserStatusType, ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { ProviderUserBulkRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-bulk.request";
import { ProviderUserConfirmRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-confirm.request";
import { ProviderUserUserDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { BasePeopleComponent } from "@bitwarden/web-vault/app/admin-console/common/base.people.component";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/admin-console/organizations/manage/entity-events.component";
import { BulkStatusComponent } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/bulk-status.component";

import { BulkConfirmComponent } from "./bulk/bulk-confirm.component";
import { BulkRemoveComponent } from "./bulk/bulk-remove.component";
import { UserAddEditComponent } from "./user-add-edit.component";

/**
 * @deprecated Please use the {@link MembersComponent} instead.
 */
@Component({
  selector: "provider-people",
  templateUrl: "people.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class PeopleComponent
  extends BasePeopleComponent<ProviderUserUserDetailsResponse>
  implements OnInit
{
  @ViewChild("addEdit", { read: ViewContainerRef, static: true }) addEditModalRef: ViewContainerRef;
  @ViewChild("groupsTemplate", { read: ViewContainerRef, static: true })
  groupsModalRef: ViewContainerRef;
  @ViewChild("bulkStatusTemplate", { read: ViewContainerRef, static: true })
  bulkStatusModalRef: ViewContainerRef;
  @ViewChild("bulkConfirmTemplate", { read: ViewContainerRef, static: true })
  bulkConfirmModalRef: ViewContainerRef;
  @ViewChild("bulkRemoveTemplate", { read: ViewContainerRef, static: true })
  bulkRemoveModalRef: ViewContainerRef;

  userType = ProviderUserType;
  userStatusType = ProviderUserStatusType;
  status: ProviderUserStatusType = null;
  providerId: string;
  accessEvents = false;

  constructor(
    apiService: ApiService,
    private route: ActivatedRoute,
    i18nService: I18nService,
    modalService: ModalService,
    platformUtilsService: PlatformUtilsService,
    keyService: KeyService,
    private encryptService: EncryptService,
    private router: Router,
    searchService: SearchService,
    validationService: ValidationService,
    logService: LogService,
    searchPipe: SearchPipe,
    userNamePipe: UserNamePipe,
    private providerService: ProviderService,
    dialogService: DialogService,
    organizationManagementPreferencesService: OrganizationManagementPreferencesService,
    private configService: ConfigService,
    protected toastService: ToastService,
  ) {
    super(
      apiService,
      searchService,
      i18nService,
      platformUtilsService,
      keyService,
      validationService,
      modalService,
      logService,
      searchPipe,
      userNamePipe,
      dialogService,
      organizationManagementPreferencesService,
      toastService,
    );
  }

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.params.subscribe(async (params) => {
      this.providerId = params.providerId;
      const provider = await this.providerService.get(this.providerId);

      if (!provider.canManageUsers) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["../"], { relativeTo: this.route });
        return;
      }

      this.accessEvents = provider.useEvents;

      await this.load();

      /* eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe, rxjs/no-nested-subscribe */
      this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
        this.searchControl.setValue(qParams.search);
        if (qParams.viewEvents != null) {
          const user = this.users.filter((u) => u.id === qParams.viewEvents);
          if (user.length > 0 && user[0].status === ProviderUserStatusType.Confirmed) {
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.events(user[0]);
          }
        }
      });
    });
  }

  getUsers(): Promise<ListResponse<ProviderUserUserDetailsResponse>> {
    return this.apiService.getProviderUsers(this.providerId);
  }

  deleteUser(id: string): Promise<any> {
    return this.apiService.deleteProviderUser(this.providerId, id);
  }

  revokeUser(id: string): Promise<any> {
    // Not implemented.
    return null;
  }

  restoreUser(id: string): Promise<any> {
    // Not implemented.
    return null;
  }

  reinviteUser(id: string): Promise<any> {
    return this.apiService.postProviderUserReinvite(this.providerId, id);
  }

  async confirmUser(user: ProviderUserUserDetailsResponse, publicKey: Uint8Array): Promise<any> {
    const providerKey = await this.keyService.getProviderKey(this.providerId);
    const key = await this.encryptService.rsaEncrypt(providerKey.key, publicKey);
    const request = new ProviderUserConfirmRequest();
    request.key = key.encryptedString;
    await this.apiService.postProviderUserConfirm(this.providerId, user.id, request);
  }

  async edit(user: ProviderUserUserDetailsResponse) {
    const [modal] = await this.modalService.openViewRef(
      UserAddEditComponent,
      this.addEditModalRef,
      (comp) => {
        comp.name = this.userNamePipe.transform(user);
        comp.providerId = this.providerId;
        comp.providerUserId = user != null ? user.id : null;
        comp.savedUser.subscribe(() => {
          modal.close();
          this.load();
        });
        comp.deletedUser.subscribe(() => {
          modal.close();
          this.removeUser(user);
        });
      },
    );
  }

  async events(user: ProviderUserUserDetailsResponse) {
    await openEntityEventsDialog(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        providerId: this.providerId,
        entityId: user.id,
        showUser: false,
        entity: "user",
      },
    });
  }

  async bulkRemove() {
    if (this.actionPromise != null) {
      return;
    }

    const [modal] = await this.modalService.openViewRef(
      BulkRemoveComponent,
      this.bulkRemoveModalRef,
      (comp) => {
        comp.providerId = this.providerId;
        comp.users = this.getCheckedUsers();
      },
    );

    await modal.onClosedPromise();
    await this.load();
  }

  async bulkReinvite() {
    if (this.actionPromise != null) {
      return;
    }

    const users = this.getCheckedUsers();
    const filteredUsers = users.filter((u) => u.status === ProviderUserStatusType.Invited);

    if (filteredUsers.length <= 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("noSelectedUsersApplicable"),
      });
      return;
    }

    try {
      const request = new ProviderUserBulkRequest(filteredUsers.map((user) => user.id));
      const response = this.apiService.postManyProviderUserReinvite(this.providerId, request);
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises

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

    const [modal] = await this.modalService.openViewRef(
      BulkConfirmComponent,
      this.bulkConfirmModalRef,
      (comp) => {
        comp.providerId = this.providerId;
        comp.users = this.getCheckedUsers();
      },
    );

    await modal.onClosedPromise();
    await this.load();
  }
}
