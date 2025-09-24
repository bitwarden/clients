import { Directive } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { firstValueFrom, lastValueFrom, debounceTime, combineLatest, BehaviorSubject } from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
  ProviderUserStatusType,
  ProviderUserType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProviderUserUserDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { OrganizationUserView } from "../organizations/core/views/organization-user.view";
import { UserConfirmComponent } from "../organizations/manage/user-confirm.component";

import { PeopleTableDataSource, peopleFilter } from "./people-table-data-source";

export type StatusType = OrganizationUserStatusType | ProviderUserStatusType;
export type UserViewTypes = ProviderUserUserDetailsResponse | OrganizationUserView;

/**
 * A refactored copy of BasePeopleComponent, using the component library table and other modern features.
 * This will replace BasePeopleComponent once all subclasses have been changed over to use this class.
 */
@Directive()
export abstract class BaseMembersComponent<UserView extends UserViewTypes> {
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

  abstract userType: typeof OrganizationUserType | typeof ProviderUserType;
  abstract userStatusType: typeof OrganizationUserStatusType | typeof ProviderUserStatusType;

  protected abstract dataSource: PeopleTableDataSource<UserView>;

  firstLoaded: boolean = false;

  /**
   * The currently selected status filter, or undefined to show all active users.
   */
  status?: StatusType;

  /**
   * The currently executing promise - used to avoid multiple user actions executing at once.
   */
  actionPromise?: Promise<void>;

  protected searchControl = new FormControl("", { nonNullable: true });
  protected statusToggle = new BehaviorSubject<StatusType | undefined>(undefined);

  constructor(
    protected apiService: ApiService,
    protected i18nService: I18nService,
    protected keyService: KeyService,
    protected validationService: ValidationService,
    protected logService: LogService,
    protected userNamePipe: UserNamePipe,
    protected dialogService: DialogService,
    protected organizationManagementPreferencesService: OrganizationManagementPreferencesService,
    protected toastService: ToastService,
  ) {
    // Connect the search input and status toggles to the table dataSource filter
    combineLatest([this.searchControl.valueChanges.pipe(debounceTime(200)), this.statusToggle])
      .pipe(takeUntilDestroyed())
      .subscribe(
        ([searchText, status]) => (this.dataSource.filter = peopleFilter(searchText, status)),
      );
  }

  abstract edit(user: UserView, organization?: Organization): void;
  abstract getUsers(organization?: Organization): Promise<ListResponse<UserView> | UserView[]>;
  abstract removeUser(id: string, organization?: Organization): Promise<void>;
  abstract reinviteUser(id: string, organization?: Organization): Promise<void>;
  abstract confirmUser(
    user: UserView,
    publicKey: Uint8Array,
    organization?: Organization,
  ): Promise<void>;
  abstract invite(organization?: Organization): void;

  async load(organization?: Organization) {
    // Load new users from the server
    const response = await this.getUsers(organization);

    // GetUsers can return a ListResponse or an Array
    if (response instanceof ListResponse) {
      this.dataSource.data = response.data != null && response.data.length > 0 ? response.data : [];
    } else if (Array.isArray(response)) {
      this.dataSource.data = response;
    }

    this.firstLoaded = true;
  }

  protected async removeUserConfirmationDialog(user: UserView) {
    return this.dialogService.openSimpleDialog({
      title: this.userNamePipe.transform(user),
      content: { key: "removeUserConfirmation" },
      type: "warning",
    });
  }

  async remove(user: UserView, organization?: Organization) {
    const confirmed = await this.removeUserConfirmationDialog(user);
    if (!confirmed) {
      return false;
    }

    this.actionPromise = this.removeUser(user.id, organization);
    try {
      await this.actionPromise;
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("removedUserId", this.userNamePipe.transform(user)),
      });
      this.dataSource.removeUser(user);
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = undefined;
  }

  async reinvite(user: UserView, organization?: Organization) {
    if (this.actionPromise != null) {
      return;
    }

    this.actionPromise = this.reinviteUser(user.id, organization);
    try {
      await this.actionPromise;
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("hasBeenReinvited", this.userNamePipe.transform(user)),
      });
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = undefined;
  }

  async confirm(user: UserView, organization?: Organization) {
    const confirmUser = async (publicKey: Uint8Array) => {
      try {
        this.actionPromise = this.confirmUser(user, publicKey, organization);
        await this.actionPromise;
        user.status = this.userStatusType.Confirmed;
        this.dataSource.replaceUser(user);

        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("hasBeenConfirmed", this.userNamePipe.transform(user)),
        });
      } catch (e) {
        this.validationService.showError(e);
        throw e;
      } finally {
        this.actionPromise = undefined;
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
}
