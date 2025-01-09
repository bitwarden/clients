// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { ProviderUserInviteRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-invite.request";
import { ProviderUserUpdateRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-update.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

/**
 * @deprecated Please use the {@link MembersDialogComponent} instead.
 */
@Component({
  selector: "provider-user-add-edit",
  templateUrl: "user-add-edit.component.html",
})
export class UserAddEditComponent implements OnInit {
  @Input() name: string;
  @Input() providerUserId: string;
  @Input() providerId: string;
  @Output() savedUser = new EventEmitter();
  @Output() deletedUser = new EventEmitter();

  loading = true;
  editMode = false;
  title: string;
  emails: string;
  type: ProviderUserType = ProviderUserType.ServiceUser;
  permissions = new PermissionsApi();
  showCustom = false;
  access: "all" | "selected" = "selected";
  formPromise: Promise<any>;
  deletePromise: Promise<any>;
  userType = ProviderUserType;

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private dialogService: DialogService,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    this.editMode = this.loading = this.providerUserId != null;

    if (this.editMode) {
      this.editMode = true;
      this.title = this.i18nService.t("editMember");
      try {
        const user = await this.apiService.getProviderUser(this.providerId, this.providerUserId);
        this.type = user.type;
      } catch (e) {
        this.logService.error(e);
      }
    } else {
      this.title = this.i18nService.t("inviteMember");
    }

    this.loading = false;
  }

  async submit() {
    try {
      if (this.editMode) {
        const request = new ProviderUserUpdateRequest();
        request.type = this.type;
        this.formPromise = this.apiService.putProviderUser(
          this.providerId,
          this.providerUserId,
          request,
        );
      } else {
        const request = new ProviderUserInviteRequest();
        request.emails = this.emails.trim().split(/\s*,\s*/);
        request.type = this.type;
        this.formPromise = this.apiService.postProviderUserInvite(this.providerId, request);
      }
      await this.formPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t(this.editMode ? "editedUserId" : "invitedUsers", this.name),
      });
      this.savedUser.emit();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async delete() {
    if (!this.editMode) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.name,
      content: { key: "removeUserConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      this.deletePromise = this.apiService.deleteProviderUser(this.providerId, this.providerUserId);
      await this.deletePromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("removedUserId", this.name),
      });
      this.deletedUser.emit();
    } catch (e) {
      this.logService.error(e);
    }
  }
}
