// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ViewChild, ViewContainerRef } from "@angular/core";
import { FormControl } from "@angular/forms";
import { firstValueFrom, concatMap, map, lastValueFrom, startWith, debounceTime } from "rxjs";

import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
  ProviderUserStatusType,
  ProviderUserType,
} from "@bitwarden/common/admin-console/enums";
import { ProviderUserUserDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { OrganizationUserView } from "../organizations/core/views/organization-user.view";
import { UserConfirmComponent } from "../organizations/manage/user-confirm.component";

type StatusType = OrganizationUserStatusType | ProviderUserStatusType;

const MaxCheckedCount = 500;

@Directive()
export abstract class BasePeopleComponent<
  UserType extends ProviderUserUserDetailsResponse | OrganizationUserView,
> {
  @ViewChild("confirmTemplate", { read: ViewContainerRef, static: true })
  confirmModalRef: ViewContainerRef;

  get allCount() {
    return this.activeUsers != null ? this.activeUsers.length : 0;
  }

  get invitedCount() {
    return this.statusMap.has(this.userStatusType.Invited)
      ? this.statusMap.get(this.userStatusType.Invited).length
      : 0;
  }

  get acceptedCount() {
    return this.statusMap.has(this.userStatusType.Accepted)
      ? this.statusMap.get(this.userStatusType.Accepted).length
      : 0;
  }

  get confirmedCount() {
    return this.statusMap.has(this.userStatusType.Confirmed)
      ? this.statusMap.get(this.userStatusType.Confirmed).length
      : 0;
  }

  get revokedCount() {
    return this.statusMap.has(this.userStatusType.Revoked)
      ? this.statusMap.get(this.userStatusType.Revoked).length
      : 0;
  }

  get showConfirmUsers(): boolean {
    return (
      this.activeUsers != null &&
      this.statusMap != null &&
      this.activeUsers.length > 1 &&
      this.confirmedCount > 0 &&
      this.confirmedCount < 3 &&
      this.acceptedCount > 0
    );
  }

  get showBulkConfirmUsers(): boolean {
    return this.acceptedCount > 0;
  }

  abstract userType: typeof OrganizationUserType | typeof ProviderUserType;
  abstract userStatusType: typeof OrganizationUserStatusType | typeof ProviderUserStatusType;

  loading = true;
  statusMap = new Map<StatusType, UserType[]>();
  status: StatusType;
  users: UserType[] = [];
  pagedUsers: UserType[] = [];
  actionPromise: Promise<void>;

  protected allUsers: UserType[] = [];
  protected activeUsers: UserType[] = [];

  protected didScroll = false;
  protected pageSize = 100;

  protected searchControl = new FormControl("", { nonNullable: true });
  protected isSearching$ = this.searchControl.valueChanges.pipe(
    debounceTime(500),
    concatMap((searchText) => this.searchService.isSearchable(searchText)),
    startWith(false),
  );
  protected isPaging$ = this.isSearching$.pipe(
    map((isSearching) => {
      if (isSearching && this.didScroll) {
        this.resetPaging();
      }
      return !isSearching && this.users && this.users.length > this.pageSize;
    }),
  );

  private pagedUsersCount = 0;

  constructor(
    protected apiService: ApiService,
    private searchService: SearchService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected keyService: KeyService,
    protected validationService: ValidationService,
    private logService: LogService,
    private searchPipe: SearchPipe,
    protected userNamePipe: UserNamePipe,
    protected dialogService: DialogService,
    protected organizationManagementPreferencesService: OrganizationManagementPreferencesService,
    protected toastService: ToastService,
  ) {}

  abstract edit(user: UserType): void;
  abstract getUsers(): Promise<ListResponse<UserType> | UserType[]>;
  abstract deleteUser(id: string): Promise<void>;
  abstract revokeUser(id: string): Promise<void>;
  abstract restoreUser(id: string): Promise<void>;
  abstract reinviteUser(id: string): Promise<void>;
  abstract confirmUser(user: UserType, publicKey: Uint8Array): Promise<void>;

  async load() {
    const response = await this.getUsers();
    this.statusMap.clear();
    this.activeUsers = [];
    for (const status of Utils.iterateEnum(this.userStatusType)) {
      this.statusMap.set(status, []);
    }

    if (response instanceof ListResponse) {
      this.allUsers = response.data != null && response.data.length > 0 ? response.data : [];
    } else if (Array.isArray(response)) {
      this.allUsers = response;
    }

    this.allUsers.sort(
      Utils.getSortFunction<ProviderUserUserDetailsResponse | OrganizationUserView>(
        this.i18nService,
        "email",
      ),
    );
    this.allUsers.forEach((u) => {
      if (!this.statusMap.has(u.status)) {
        this.statusMap.set(u.status, [u]);
      } else {
        this.statusMap.get(u.status).push(u);
      }
      if (u.status !== this.userStatusType.Revoked) {
        this.activeUsers.push(u);
      }
    });
    this.filter(this.status);
    this.loading = false;
  }

  filter(status: StatusType) {
    this.status = status;
    if (this.status != null) {
      this.users = this.statusMap.get(this.status);
    } else {
      this.users = this.activeUsers;
    }
    // Reset checkbox selecton
    this.selectAll(false);
    this.resetPaging();
  }

  loadMore() {
    if (!this.users || this.users.length <= this.pageSize) {
      return;
    }
    const pagedLength = this.pagedUsers.length;
    let pagedSize = this.pageSize;
    if (pagedLength === 0 && this.pagedUsersCount > this.pageSize) {
      pagedSize = this.pagedUsersCount;
    }
    if (this.users.length > pagedLength) {
      this.pagedUsers = this.pagedUsers.concat(
        this.users.slice(pagedLength, pagedLength + pagedSize),
      );
    }
    this.pagedUsersCount = this.pagedUsers.length;
    this.didScroll = this.pagedUsers.length > this.pageSize;
  }

  checkUser(user: UserType, select?: boolean) {
    (user as any).checked = select == null ? !(user as any).checked : select;
  }

  selectAll(select: boolean) {
    if (select) {
      this.selectAll(false);
    }

    const filteredUsers = this.searchPipe.transform(
      this.users,
      this.searchControl.value,
      "name",
      "email",
      "id",
    );

    const selectCount =
      select && filteredUsers.length > MaxCheckedCount ? MaxCheckedCount : filteredUsers.length;
    for (let i = 0; i < selectCount; i++) {
      this.checkUser(filteredUsers[i], select);
    }
  }

  resetPaging() {
    this.pagedUsers = [];
    this.loadMore();
  }

  invite() {
    this.edit(null);
  }

  protected async removeUserConfirmationDialog(user: UserType) {
    return this.dialogService.openSimpleDialog({
      title: this.userNamePipe.transform(user),
      content: { key: "removeUserConfirmation" },
      type: "warning",
    });
  }

  async remove(user: UserType) {
    const confirmed = await this.removeUserConfirmationDialog(user);
    if (!confirmed) {
      return false;
    }

    this.actionPromise = this.deleteUser(user.id);
    try {
      await this.actionPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("removedUserId", this.userNamePipe.transform(user)),
      });
      this.removeUser(user);
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = null;
  }

  protected async revokeUserConfirmationDialog(user: UserType) {
    return this.dialogService.openSimpleDialog({
      title: { key: "revokeAccess", placeholders: [this.userNamePipe.transform(user)] },
      content: this.revokeWarningMessage(),
      acceptButtonText: { key: "revokeAccess" },
      type: "warning",
    });
  }

  async revoke(user: UserType) {
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

  async restore(user: UserType) {
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

  async reinvite(user: UserType) {
    if (this.actionPromise != null) {
      return;
    }

    this.actionPromise = this.reinviteUser(user.id);
    try {
      await this.actionPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("hasBeenReinvited", this.userNamePipe.transform(user)),
      });
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = null;
  }

  async confirm(user: UserType) {
    function updateUser(self: BasePeopleComponent<UserType>) {
      user.status = self.userStatusType.Confirmed;
      const mapIndex = self.statusMap.get(self.userStatusType.Accepted).indexOf(user);
      if (mapIndex > -1) {
        self.statusMap.get(self.userStatusType.Accepted).splice(mapIndex, 1);
        self.statusMap.get(self.userStatusType.Confirmed).push(user);
      }
    }

    const confirmUser = async (publicKey: Uint8Array) => {
      try {
        this.actionPromise = this.confirmUser(user, publicKey);
        await this.actionPromise;
        updateUser(this);
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("hasBeenConfirmed", this.userNamePipe.transform(user)),
        });
      } catch (e) {
        this.validationService.showError(e);
        throw e;
      } finally {
        this.actionPromise = null;
      }
    };

    if (this.actionPromise != null) {
      return;
    }

    try {
      const publicKeyResponse = await this.apiService.getUserPublicKey(user.userId);
      const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

      const autoConfirm = await firstValueFrom(
        this.organizationManagementPreferencesService.autoConfirmFingerPrints.state$,
      );
      if (autoConfirm == null || !autoConfirm) {
        const dialogRef = UserConfirmComponent.open(this.dialogService, {
          data: {
            name: this.userNamePipe.transform(user),
            userId: user != null ? user.userId : null,
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

  protected revokeWarningMessage(): string {
    return this.i18nService.t("revokeUserConfirmation");
  }

  protected getCheckedUsers() {
    return this.users.filter((u) => (u as any).checked);
  }

  protected removeUser(user: UserType) {
    let index = this.users.indexOf(user);
    if (index > -1) {
      this.users.splice(index, 1);
      this.resetPaging();
    }

    index = this.allUsers.indexOf(user);
    if (index > -1) {
      this.allUsers.splice(index, 1);
    }

    if (this.statusMap.has(user.status)) {
      index = this.statusMap.get(user.status).indexOf(user);
      if (index > -1) {
        this.statusMap.get(user.status).splice(index, 1);
      }
    }
  }
}
