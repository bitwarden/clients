// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, firstValueFrom, lastValueFrom, switchMap } from "rxjs";
import { first } from "rxjs/operators";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderUserStatusType, ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { ProviderUserBulkRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-bulk.request";
import { ProviderUserConfirmRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-confirm.request";
import { ProviderUserUserDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { BaseMembersComponent } from "@bitwarden/web-vault/app/admin-console/common/base-members.component";
import {
  peopleFilter,
  PeopleTableDataSource,
} from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/admin-console/organizations/manage/entity-events.component";
import { BulkStatusComponent } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/bulk-status.component";

import {
  AddEditMemberDialogComponent,
  AddEditMemberDialogParams,
  AddEditMemberDialogResultType,
} from "./dialogs/add-edit-member-dialog.component";
import { BulkConfirmDialogComponent } from "./dialogs/bulk-confirm-dialog.component";
import { BulkRemoveDialogComponent } from "./dialogs/bulk-remove-dialog.component";

type ProviderUser = ProviderUserUserDetailsResponse;

class MembersTableDataSource extends PeopleTableDataSource<ProviderUser> {
  protected statusType = ProviderUserStatusType;
}

@Component({
  templateUrl: "members.component.html",
  standalone: false,
})
export class MembersComponent extends BaseMembersComponent<ProviderUser> {
  accessEvents = false;
  dataSource = new MembersTableDataSource();
  loading = true;
  providerId: string;
  rowHeight = 70;
  rowHeightClass = `tw-h-[70px]`;
  status: ProviderUserStatusType = null;

  userStatusType = ProviderUserStatusType;
  userType = ProviderUserType;

  constructor(
    apiService: ApiService,
    keyService: KeyService,
    dialogService: DialogService,
    i18nService: I18nService,
    logService: LogService,
    organizationManagementPreferencesService: OrganizationManagementPreferencesService,
    toastService: ToastService,
    userNamePipe: UserNamePipe,
    validationService: ValidationService,
    private encryptService: EncryptService,
    private activatedRoute: ActivatedRoute,
    private providerService: ProviderService,
    private router: Router,
    private accountService: AccountService,
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

    combineLatest([
      this.activatedRoute.parent.params,
      this.activatedRoute.queryParams.pipe(first()),
    ])
      .pipe(
        switchMap(async ([urlParams, queryParams]) => {
          this.searchControl.setValue(queryParams.search);
          this.dataSource.filter = peopleFilter(queryParams.search, null);

          this.providerId = urlParams.providerId;
          const provider = await firstValueFrom(
            this.accountService.activeAccount$.pipe(
              getUserId,
              switchMap((userId) => this.providerService.get$(this.providerId, userId)),
            ),
          );

          if (!provider || !provider.canManageUsers) {
            return await this.router.navigate(["../"], { relativeTo: this.activatedRoute });
          }
          this.accessEvents = provider.useEvents;
          await this.load();

          if (queryParams.viewEvents != null) {
            const user = this.dataSource.data.find((user) => user.id === queryParams.viewEvents);
            if (user && user.status === ProviderUserStatusType.Confirmed) {
              this.openEventsDialog(user);
            }
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  async bulkConfirm(): Promise<void> {
    if (this.actionPromise != null) {
      return;
    }

    const dialogRef = BulkConfirmDialogComponent.open(this.dialogService, {
      data: {
        providerId: this.providerId,
        users: this.dataSource.getCheckedUsers(),
      },
    });

    await lastValueFrom(dialogRef.closed);
    await this.load();
  }

  async bulkReinvite(): Promise<void> {
    if (this.actionPromise != null) {
      return;
    }

    const checkedUsers = this.dataSource.getCheckedUsers();
    const checkedInvitedUsers = checkedUsers.filter(
      (user) => user.status === ProviderUserStatusType.Invited,
    );

    if (checkedInvitedUsers.length <= 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("noSelectedUsersApplicable"),
      });
      return;
    }

    try {
      const request = this.apiService.postManyProviderUserReinvite(
        this.providerId,
        new ProviderUserBulkRequest(checkedInvitedUsers.map((user) => user.id)),
      );

      const dialogRef = BulkStatusComponent.open(this.dialogService, {
        data: {
          users: checkedUsers,
          filteredUsers: checkedInvitedUsers,
          request,
          successfulMessage: this.i18nService.t("bulkReinviteMessage"),
        },
      });
      await lastValueFrom(dialogRef.closed);
    } catch (error) {
      this.validationService.showError(error);
    }
  }

  async invite() {
    await this.edit(null);
  }

  async bulkRemove(): Promise<void> {
    if (this.actionPromise != null) {
      return;
    }

    const dialogRef = BulkRemoveDialogComponent.open(this.dialogService, {
      data: {
        providerId: this.providerId,
        users: this.dataSource.getCheckedUsers(),
      },
    });

    await lastValueFrom(dialogRef.closed);
    await this.load();
  }

  async confirmUser(user: ProviderUser, publicKey: Uint8Array): Promise<void> {
    const providerKey = await this.keyService.getProviderKey(this.providerId);
    const key = await this.encryptService.encapsulateKeyUnsigned(providerKey, publicKey);
    const request = new ProviderUserConfirmRequest();
    request.key = key.encryptedString;
    await this.apiService.postProviderUserConfirm(this.providerId, user.id, request);
  }

  removeUser = (id: string): Promise<void> =>
    this.apiService.deleteProviderUser(this.providerId, id);

  edit = async (user: ProviderUser | null): Promise<void> => {
    const data: AddEditMemberDialogParams = {
      providerId: this.providerId,
    };

    if (user != null) {
      data.user = {
        id: user.id,
        name: this.userNamePipe.transform(user),
        type: user.type,
      };
    }

    const dialogRef = AddEditMemberDialogComponent.open(this.dialogService, {
      data,
    });

    const result = await lastValueFrom(dialogRef.closed);

    switch (result) {
      case AddEditMemberDialogResultType.Saved:
      case AddEditMemberDialogResultType.Deleted:
        await this.load();
        break;
    }
  };

  openEventsDialog = (user: ProviderUser): DialogRef<void> =>
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        providerId: this.providerId,
        entityId: user.id,
        showUser: false,
        entity: "user",
      },
    });

  getUsers = (): Promise<ListResponse<ProviderUser>> =>
    this.apiService.getProviderUsers(this.providerId);

  reinviteUser = (id: string): Promise<void> =>
    this.apiService.postProviderUserReinvite(this.providerId, id);
}
