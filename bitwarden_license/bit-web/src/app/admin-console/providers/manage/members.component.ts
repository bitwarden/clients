import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  signal,
  WritableSignal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  firstValueFrom,
  lastValueFrom,
  Observable,
  switchMap,
} from "rxjs";
import { first, map, tap } from "rxjs/operators";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderUserStatusType, ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { ProviderUserBulkRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-bulk.request";
import { ProviderUserConfirmRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-confirm.request";
import { ProviderUserUserDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ProviderId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import {
  peopleFilter,
  PeopleTableDataSource,
} from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/admin-console/organizations/manage/entity-events.component";
import { UserConfirmComponent } from "@bitwarden/web-vault/app/admin-console/organizations/manage/user-confirm.component";
import { BulkStatusComponent } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/bulk-status.component";
import { MemberActionResult } from "@bitwarden/web-vault/app/admin-console/organizations/members/services/member-actions/member-actions.service";

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersComponent {
  protected apiService = inject(ApiService);
  protected i18nService = inject(I18nService);
  protected keyService = inject(KeyService);
  protected validationService = inject(ValidationService);
  protected logService = inject(LogService);
  protected userNamePipe = inject(UserNamePipe);
  protected dialogService = inject(DialogService);
  protected organizationManagementPreferencesService = inject(
    OrganizationManagementPreferencesService,
  );
  protected toastService = inject(ToastService);
  private encryptService = inject(EncryptService);
  private activatedRoute = inject(ActivatedRoute);
  private providerService = inject(ProviderService);
  private router = inject(Router);
  private accountService = inject(AccountService);
  private changeDetectorRef = inject(ChangeDetectorRef);

  protected accessEvents = false;
  protected dataSource = new MembersTableDataSource();

  protected providerId$: Observable<ProviderId>;
  protected provider$: Observable<Provider | undefined>;

  protected rowHeight = 70;
  protected rowHeightClass = `tw-h-[70px]`;
  protected status: ProviderUserStatusType | undefined;

  protected userStatusType = ProviderUserStatusType;
  protected userType = ProviderUserType;

  protected searchControl = new FormControl("", { nonNullable: true });
  protected statusToggle = new BehaviorSubject<ProviderUserStatusType | undefined>(undefined);
  protected readonly firstLoaded: WritableSignal<boolean> = signal(false);

  /**
   * Shows a banner alerting the admin that users need to be confirmed.
   */
  get showConfirmUsers(): boolean {
    return (
      this.dataSource.activeUserCount > 1 &&
      this.dataSource.confirmedUserCount > 0 &&
      this.dataSource.confirmedUserCount < 3 &&
      this.dataSource.acceptedUserCount > 0
    );
  }

  get showBulkConfirmUsers(): boolean {
    return this.dataSource
      .getCheckedUsers()
      .every((member) => member.status == this.userStatusType.Accepted);
  }

  get showBulkReinviteUsers(): boolean {
    return this.dataSource
      .getCheckedUsers()
      .every((member) => member.status == this.userStatusType.Invited);
  }

  constructor() {
    this.dataSource
      .connect()
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.changeDetectorRef.markForCheck();
      });

    // Connect the search input and status toggles to the table dataSource filter
    combineLatest([this.searchControl.valueChanges.pipe(debounceTime(200)), this.statusToggle])
      .pipe(takeUntilDestroyed())
      .subscribe(
        ([searchText, status]) => (this.dataSource.filter = peopleFilter(searchText, status)),
      );

    this.providerId$ = this.activatedRoute.params.pipe(map((params) => params.providerId));

    this.provider$ = combineLatest([
      this.providerId$,
      this.accountService.activeAccount$.pipe(getUserId),
    ]).pipe(
      switchMap(([providerId, userId]) => this.providerService.get$(providerId, userId)),
      tap(async (provider) => {
        if (!provider || !provider.canManageUsers) {
          return await this.router.navigate(["../"], { relativeTo: this.activatedRoute });
        }
      }),
    );

    combineLatest([this.activatedRoute.queryParams, this.providerId$])
      .pipe(
        first(),
        switchMap(async ([queryParams, providerId]) => {
          this.searchControl.setValue(queryParams.search);
          this.dataSource.filter = peopleFilter(queryParams.search, undefined);

          await this.load();

          if (queryParams.viewEvents != null) {
            const user = this.dataSource.data.find((user) => user.id === queryParams.viewEvents);
            if (user && user.status === ProviderUserStatusType.Confirmed) {
              this.openEventsDialog(user, providerId);
            }
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  async load() {
    const providerId = await firstValueFrom(this.providerId$);
    const response = await this.apiService.getProviderUsers(providerId);
    this.dataSource.data = response.data != null && response.data.length > 0 ? response.data : [];
    this.firstLoaded.set(true);
  }

  async bulkConfirm(providerId: ProviderId): Promise<void> {
    const dialogRef = BulkConfirmDialogComponent.open(this.dialogService, {
      data: {
        providerId: providerId,
        users: this.dataSource.getCheckedUsers(),
      },
    });

    await lastValueFrom(dialogRef.closed);
    await this.load();
  }

  async bulkReinvite(providerId: ProviderId): Promise<void> {
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
        providerId,
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

  async invite(providerId: ProviderId) {
    await this.edit(null, providerId);
  }

  async bulkRemove(providerId: ProviderId): Promise<void> {
    const dialogRef = BulkRemoveDialogComponent.open(this.dialogService, {
      data: {
        providerId: providerId,
        users: this.dataSource.getCheckedUsers(),
      },
    });

    await lastValueFrom(dialogRef.closed);
    await this.load();
  }

  private async removeUserConfirmationDialog(user: ProviderUser) {
    return this.dialogService.openSimpleDialog({
      title: this.userNamePipe.transform(user),
      content: { key: "removeUserConfirmation" },
      type: "warning",
    });
  }

  async remove(user: ProviderUser, providerId: ProviderId) {
    const confirmed = await this.removeUserConfirmationDialog(user);
    if (!confirmed) {
      return false;
    }

    try {
      const result = await this.removeUserInternal(user.id, providerId);
      if (result.success) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("removedUserId", this.userNamePipe.transform(user)),
        });
        this.dataSource.removeUser(user);
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      this.validationService.showError(e);
    }
  }

  async reinvite(user: ProviderUser, providerId: ProviderId) {
    try {
      const result = await this.reinviteUserInternal(user.id, providerId);
      if (result.success) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("hasBeenReinvited", this.userNamePipe.transform(user)),
        });
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      this.validationService.showError(e);
    }
  }

  async confirm(user: ProviderUser, providerId: ProviderId) {
    const confirmUser = async (publicKey: Uint8Array) => {
      try {
        const result = await this.confirmUserInternal(user, publicKey, providerId);
        if (result.success) {
          user.status = this.userStatusType.Confirmed;
          this.dataSource.replaceUser(user);

          this.toastService.showToast({
            variant: "success",
            message: this.i18nService.t("hasBeenConfirmed", this.userNamePipe.transform(user)),
          });
        } else {
          throw new Error(result.error);
        }
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

  private async confirmUserInternal(
    user: ProviderUser,
    publicKey: Uint8Array,
    providerId: ProviderId,
  ): Promise<MemberActionResult> {
    try {
      const providerKey = await firstValueFrom(
        this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) => this.keyService.providerKeys$(userId)),
          map((providerKeys) => providerKeys?.[providerId as ProviderId] ?? null),
        ),
      );
      assertNonNullish(providerKey, "Provider key not found");

      const key = await this.encryptService.encapsulateKeyUnsigned(providerKey, publicKey);
      const request = new ProviderUserConfirmRequest();
      request.key = key.encryptedString;
      await this.apiService.postProviderUserConfirm(providerId, user.id, request);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async removeUserInternal(
    id: string,
    providerId: ProviderId,
  ): Promise<MemberActionResult> {
    try {
      await this.apiService.deleteProviderUser(providerId, id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  edit = async (user: ProviderUser | null, providerId: ProviderId): Promise<void> => {
    const data: AddEditMemberDialogParams = {
      providerId: providerId,
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

  openEventsDialog = (user: ProviderUser, providerId: ProviderId): DialogRef<void> =>
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        providerId: providerId,
        entityId: user.id,
        showUser: false,
        entity: "user",
      },
    });

  private async reinviteUserInternal(
    id: string,
    providerId: ProviderId,
  ): Promise<MemberActionResult> {
    try {
      await this.apiService.postProviderUserReinvite(providerId, id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
