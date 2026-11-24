import { UpperCasePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ProviderUserInviteRequest,
  ProviderUserType,
  ProviderUserUpdateRequest,
} from "@bitwarden/common/provider";
import {
  A11yTitleDirective,
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  IconComponent,
  RadioButtonModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { ProviderUser } from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";

export type AddEditMemberDialogParams = {
  providerId: string;
  user?: ProviderUser;
};

export const AddEditMemberDialogResultType = Object.freeze({
  Closed: "closed",
  Deleted: "deleted",
  Saved: "saved",
} as const);
export type AddEditMemberDialogResultType =
  (typeof AddEditMemberDialogResultType)[keyof typeof AddEditMemberDialogResultType];

@Component({
  selector: "add-edit-member-dialog",
  templateUrl: "add-edit-member-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UpperCasePipe,
    ReactiveFormsModule,
    DialogModule,
    FormFieldModule,
    RadioButtonModule,
    ButtonModule,
    IconButtonModule,
    IconComponent,
    AsyncActionsModule,
    A11yTitleDirective,
    I18nPipe,
  ],
})
export class AddEditMemberDialogComponent {
  private readonly apiService = inject(ApiService);
  private readonly dialogRef = inject<DialogRef<AddEditMemberDialogResultType>>(DialogRef);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly userNamePipe = inject(UserNamePipe);
  protected readonly dialogParams = inject<AddEditMemberDialogParams>(DIALOG_DATA);

  protected readonly editing = this.dialogParams.user != null;
  protected readonly title = this.i18nService.t(this.editing ? "editMember" : "inviteMember");

  protected readonly ResultType = AddEditMemberDialogResultType;
  protected readonly UserType = ProviderUserType;
  protected readonly emailBatchLimit = 20;

  protected readonly formGroup = new FormGroup({
    emails: new FormControl(
      { value: "", disabled: this.editing },
      { nonNullable: true, validators: this.editing ? [] : [Validators.required] },
    ),
    type: new FormControl(this.dialogParams.user?.type ?? ProviderUserType.ServiceUser, {
      nonNullable: true,
    }),
  });

  protected readonly delete = async (): Promise<void> => {
    const user = this.dialogParams.user;
    if (user == null) {
      return;
    }

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
      message: this.i18nService.t("removedUserId", userName),
    });

    await this.dialogRef.close(AddEditMemberDialogResultType.Deleted);
  };

  protected readonly submit = async (): Promise<void> => {
    const { emails, type } = this.formGroup.getRawValue();
    const user = this.dialogParams.user;

    if (user != null) {
      const request = new ProviderUserUpdateRequest({ type });
      await this.apiService.putProviderUser(this.dialogParams.providerId, user.id, request);
    } else {
      const request = new ProviderUserInviteRequest({
        emails: emails.trim().split(/\s*,\s*/),
        type,
      });
      await this.apiService.postProviderUserInvite(this.dialogParams.providerId, request);
    }

    const userName = user != null ? this.userNamePipe.transform(user) : undefined;

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(user != null ? "editedUserId" : "invitedUsers", userName),
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
