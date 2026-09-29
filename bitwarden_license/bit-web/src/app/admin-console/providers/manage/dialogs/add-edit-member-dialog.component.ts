import { Component, Inject } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { ProviderUserInviteRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-invite.request";
import { ProviderUserUpdateRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-update.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { ProviderUser } from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";

export type AddEditMemberDialogParams = {
  providerId: string;
  user?: ProviderUser;
};

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum AddEditMemberDialogResultType {
  Closed = "closed",
  Deleted = "deleted",
  Saved = "saved",
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "add-edit-member-dialog.component.html",
  standalone: false,
})
export class AddEditMemberDialogComponent {
  editing = false;
  loading = true;
  title: string;

  protected ResultType = AddEditMemberDialogResultType;
  protected UserType = ProviderUserType;

  protected formGroup = new FormGroup({
    emails: new FormControl<string>("", [Validators.required]),
    type: new FormControl(this.dialogParams.user?.type ?? ProviderUserType.ServiceUser),
  });

  constructor(
    private apiService: ApiService,
    @Inject(DIALOG_DATA) protected dialogParams: AddEditMemberDialogParams,
    private dialogRef: DialogRef<AddEditMemberDialogResultType>,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private toastService: ToastService,
    private userNamePipe: UserNamePipe,
  ) {
    this.editing = this.loading = this.dialogParams.user != null;
    if (this.editing) {
      this.title = this.i18nService.t("editMember");
      const emailControl = this.formGroup.controls.emails;
      emailControl.removeValidators(Validators.required);
      emailControl.disable();
    } else {
      this.title = this.i18nService.t("inviteMember");
    }

    this.loading = false;
  }

  delete = async (): Promise<void> => {
    if (!this.editing || this.dialogParams.user == null) {
      return;
    }

    const user = this.dialogParams.user;
    const userName = this.userNamePipe.transform(user);

    const confirmed = await this.dialogService.openSimpleDialog({
      title: userName,
      content: { key: "removeUserConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    await this.apiService.deleteProviderUser(this.dialogParams.providerId, user.id);

    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("removedUserId", userName),
    });

    await this.dialogRef.close(AddEditMemberDialogResultType.Deleted);
  };

  submit = async (): Promise<void> => {
    const type = this.formGroup.value.type;
    if (type == null) {
      return;
    }

    if (this.editing) {
      if (this.dialogParams.user == null) {
        return;
      }
      const request = new ProviderUserUpdateRequest({ type });
      await this.apiService.putProviderUser(
        this.dialogParams.providerId,
        this.dialogParams.user.id,
        request,
      );
    } else {
      const emails = this.formGroup.value.emails;
      if (emails == null) {
        return;
      }
      const request = new ProviderUserInviteRequest({
        emails: emails.trim().split(/\s*,\s*/),
        type,
      });
      await this.apiService.postProviderUserInvite(this.dialogParams.providerId, request);
    }

    const userName = this.editing ? this.userNamePipe.transform(this.dialogParams.user) : undefined;

    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t(this.editing ? "editedUserId" : "invitedUsers", userName),
    });

    await this.dialogRef.close(AddEditMemberDialogResultType.Saved);
  };

  static open(dialogService: DialogService, dialogConfig: DialogConfig<AddEditMemberDialogParams>) {
    return dialogService.open<AddEditMemberDialogResultType, AddEditMemberDialogParams>(
      AddEditMemberDialogComponent,
      dialogConfig,
    );
  }
}
