import { Component, inject, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  firstValueFrom,
  lastValueFrom,
  Observable,
  switchMap,
} from "rxjs";
import { first, map } from "rxjs/operators";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderUserStatusType, ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { ProviderUserBulkRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-bulk.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ProviderId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import {
  CloudBulkReinviteLimit,
  MaxCheckedCount,
  peopleFilter,
  ProviderUser,
  ProvidersTableDataSource,
  showConfirmBanner,
} from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/admin-console/organizations/manage/entity-events.component";
import { BulkStatusComponent } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/bulk-status.component";
import { MemberActionsService } from "@bitwarden/web-vault/app/admin-console/organizations/members/services/member-actions/member-actions.service";

import {
  AddEditMemberDialogComponent,
  AddEditMemberDialogResultType,
} from "./dialogs/add-edit-member-dialog.component";
import { BulkConfirmDialogComponent } from "./dialogs/bulk-confirm-dialog.component";
import { BulkRemoveDialogComponent } from "./dialogs/bulk-remove-dialog.component";
import {
  MemberActionResult,
  ProviderActionsService,
} from "./services/provider-actions/provider-actions.service";

interface BulkProviderFlags {
  showBulkConfirmUsers: boolean;
  showBulkReinviteUsers: boolean;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "members.component.html",
  standalone: false,
})
export class vNextMembersComponent {
  protected apiService = inject(ApiService);
  protected dialogService = inject(DialogService);
  protected i18nService = inject(I18nService);
  protected userNamePipe = inject(UserNamePipe);
  protected validationService = inject(ValidationService);
  protected toastService = inject(ToastService);
  private activatedRoute = inject(ActivatedRoute);
  private providerService = inject(ProviderService);
  private accountService = inject(AccountService);
  private environmentService = inject(EnvironmentService);
  private providerActionsService = inject(ProviderActionsService);
  private memberActionsService = inject(MemberActionsService);
  private logService = inject(LogService);

  protected accessEvents = false;

  protected providerId$: Observable<ProviderId>;
  protected provider$: Observable<Provider | undefined>;

  protected rowHeight = 70;
  protected rowHeightClass = `tw-h-[70px]`;
  protected status: ProviderUserStatusType | undefined;

  protected userStatusType = ProviderUserStatusType;
  protected userType = ProviderUserType;

  protected searchControl = new FormControl("", { nonNullable: true });
  protected statusToggle = new BehaviorSubject<ProviderUserStatusType | undefined>(undefined);

  protected readonly dataSource: WritableSignal<ProvidersTableDataSource> = signal(
    new ProvidersTableDataSource(this.environmentService),
  );
  protected readonly firstLoaded: WritableSignal<boolean> = signal(false);

  protected bulkMenuOptions$ = this.dataSource()
    .usersUpdated()
    .pipe(map((members) => this.bulkMenuOptions(members)));

  protected showConfirmBanner$ = this.dataSource()
    .usersUpdated()
    .pipe(map(() => showConfirmBanner(this.dataSource())));

  protected selectedInvitedCount$ = this.dataSource()
    .usersUpdated()
    .pipe(
      map((members) => members.filter((m) => m.status === ProviderUserStatusType.Invited).length),
    );

  protected isSingleInvite$ = this.selectedInvitedCount$.pipe(map((count) => count === 1));

  protected isProcessing = this.providerActionsService.isProcessing;

  constructor() {
    // Connect the search input and status toggles to the table dataSource filter
    combineLatest([this.searchControl.valueChanges.pipe(debounceTime(200)), this.statusToggle])
      .pipe(takeUntilDestroyed())
      .subscribe(
        ([searchText, status]) => (this.dataSource().filter = peopleFilter(searchText, status)),
      );

    this.providerId$ = this.activatedRoute.params.pipe(map((params) => params.providerId));

    this.provider$ = combineLatest([
      this.providerId$,
      this.accountService.activeAccount$.pipe(getUserId),
    ]).pipe(switchMap(([providerId, userId]) => this.providerService.get$(providerId, userId)));

    combineLatest([this.activatedRoute.queryParams, this.providerId$])
      .pipe(
        first(),
        switchMap(async ([queryParams, providerId]) => {
          this.searchControl.setValue(queryParams.search);
          this.dataSource().filter = peopleFilter(queryParams.search, undefined);

          await this.load();

          if (queryParams.viewEvents != null) {
            const user = this.dataSource().data.find((user) => user.id === queryParams.viewEvents);
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
    this.dataSource().data = response.data;
    this.firstLoaded.set(true);
  }

  async bulkConfirm(providerId: ProviderId): Promise<void> {
    const users = this.dataSource().getCheckedUsersWithLimit(MaxCheckedCount);
    const dialogRef = BulkConfirmDialogComponent.open(this.dialogService, {
      data: {
        providerId: providerId,
        users,
      },
    });

    await lastValueFrom(dialogRef.closed);
    await this.load();
  }

  async bulkReinvite(providerId: ProviderId): Promise<void> {
    let users: ProviderUser[];
    if (this.dataSource().isIncreasedBulkLimitEnabled()) {
      users = this.dataSource().getCheckedUsersInVisibleOrder();
    } else {
      users = this.dataSource().getCheckedUsers();
    }

    const allInvitedUsers = users.filter((user) => user.status === ProviderUserStatusType.Invited);

    // Capture the original count BEFORE enforcing the limit
    const originalInvitedCount = allInvitedUsers.length;

    // In cloud environments, limit invited users and uncheck the excess
    let checkedInvitedUsers: ProviderUser[];
    if (this.dataSource().isIncreasedBulkLimitEnabled()) {
      checkedInvitedUsers = this.dataSource().limitAndUncheckExcess(
        allInvitedUsers,
        CloudBulkReinviteLimit,
      );
    } else {
      checkedInvitedUsers = allInvitedUsers;
    }

    if (checkedInvitedUsers.length <= 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("noSelectedUsersApplicable"),
      });
      return;
    }

    try {
      // In cloud environments, show toast instead of dialog
      if (this.dataSource().isIncreasedBulkLimitEnabled()) {
        await this.apiService.postManyProviderUserReinvite(
          providerId,
          new ProviderUserBulkRequest(checkedInvitedUsers.map((user) => user.id)),
        );

        const selectedCount = originalInvitedCount;
        const invitedCount = checkedInvitedUsers.length;

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
            message:
              invitedCount === 1
                ? this.i18nService.t("reinviteSuccessToast")
                : this.i18nService.t("bulkReinviteSentToast", invitedCount.toString()),
          });
        }
      } else {
        // In self-hosted environments, show legacy dialog
        const request = this.apiService
          .postManyProviderUserReinvite(
            providerId,
            new ProviderUserBulkRequest(checkedInvitedUsers.map((user) => user.id)),
          )
          .then((response) => response.data);

        const dialogRef = BulkStatusComponent.open(this.dialogService, {
          data: {
            users: users,
            filteredUsers: checkedInvitedUsers,
            request,
            successfulMessage: this.i18nService.t("bulkReinviteMessage"),
          },
        });
        await lastValueFrom(dialogRef.closed);
      }
    } catch (error) {
      this.validationService.showError(error);
    }
  }

  async bulkRemove(providerId: ProviderId): Promise<void> {
    const users = this.dataSource().getCheckedUsersWithLimit(MaxCheckedCount);
    const dialogRef = BulkRemoveDialogComponent.open(this.dialogService, {
      data: {
        providerId: providerId,
        users,
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

    const sideEffect = () => this.dataSource().removeUser(user);
    const result = await this.providerActionsService.deleteProviderUser(providerId, user);

    await this.handleMemberActionResult(result, "success", user, sideEffect);
  }

  async reinvite(user: ProviderUser, providerId: ProviderId) {
    const result = await this.providerActionsService.reinviteProvider(providerId, user);
    await this.handleMemberActionResult(result, "success", user);
  }

  async confirm(user: ProviderUser, providerId: ProviderId) {
    const publicKeyResult = await this.memberActionsService.getPublicKeyForConfirm(user);

    if (publicKeyResult == null) {
      this.logService.warning("Public key not found");
      return;
    }

    const result = await this.providerActionsService.confirmProvider(
      user,
      providerId,
      publicKeyResult,
    );
    const sideEffect = () => {
      user.status = this.userStatusType.Confirmed;
      this.dataSource().replaceUser(user);
    };

    await this.handleMemberActionResult(result, "success", user, sideEffect);
  }

  async edit(providerId: ProviderId, user?: ProviderUser): Promise<void> {
    const dialogRef = AddEditMemberDialogComponent.open(this.dialogService, {
      data: {
        providerId,
        user,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    switch (result) {
      case AddEditMemberDialogResultType.Saved:
      case AddEditMemberDialogResultType.Deleted:
        await this.load();
        break;
    }
  }

  openEventsDialog(user: ProviderUser, providerId: ProviderId): DialogRef<void> {
    return openEntityEventsDialog(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        providerId: providerId,
        entityId: user.id,
        showUser: false,
        entity: "user",
      },
    });
  }

  private bulkMenuOptions(providerMembers: ProviderUser[]): BulkProviderFlags {
    const result: BulkProviderFlags = {
      showBulkConfirmUsers: providerMembers.every(
        (m) => m.status == ProviderUserStatusType.Accepted,
      ),
      showBulkReinviteUsers: providerMembers.every(
        (m) => m.status == ProviderUserStatusType.Invited,
      ),
    };

    return result;
  }

  async handleMemberActionResult(
    result: MemberActionResult,
    successKey: string,
    user: ProviderUser,
    sideEffect?: () => void | Promise<void>,
  ) {
    if (result.error != null) {
      this.validationService.showError(result.error);
      this.logService.error(result.error);
      return;
    }

    if (result.success) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(successKey, this.userNamePipe.transform(user)),
      });

      if (sideEffect) {
        await sideEffect();
      }
    }
  }
}
