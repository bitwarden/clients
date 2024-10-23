import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy } from "@angular/core";
import { FormBuilder, FormControl, Validators } from "@angular/forms";
import { Subject } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { UserVerificationModule } from "../../../../auth/shared/components/user-verification";
import { SharedModule } from "../../../../shared/shared.module";
import { OrganizationUserView } from "../../core/views/organization-user.view";

export interface DeleteOrganizationUserDialogParams {
  organizationId: string;
  user: OrganizationUserView;
}

export enum DeleteOrganizationUserDialogResult {
  Deleted = "deleted",
  Canceled = "canceled",
}

@Component({
  selector: "app-delete-organizationuser",
  standalone: true,
  imports: [SharedModule, UserVerificationModule],
  templateUrl: "delete-organizationuser-dialog.component.html",
})
export class DeleteOrganizationUserDialogComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  protected formGroup = this.formBuilder.group({
    secret: new FormControl<Verification>(null, [Validators.required]),
  });
  formPromise: Promise<void>;
  protected userName: string;

  constructor(
    @Inject(DIALOG_DATA) private params: DeleteOrganizationUserDialogParams,
    private dialogRef: DialogRef<DeleteOrganizationUserDialogResult>,
    private i18nService: I18nService,
    private userVerificationService: UserVerificationService,
    private organizationUserApiService: OrganizationUserApiService,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private userNamePipe: UserNamePipe,
  ) {
    this.userName = this.userNamePipe.transform(params.user);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected submit = async () => {
    await this.userVerificationService
      .buildRequest(this.formGroup.value.secret)
      .then((request) =>
        this.organizationUserApiService.deleteOrganizationUser(
          this.params.organizationId,
          this.params.user.id,
          request,
        ),
      );

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("organizationUserDeleted", this.userName),
    });
    this.dialogRef.close(DeleteOrganizationUserDialogResult.Deleted);
  };
}

/**
 * Strongly typed helper to open a Delete Organization User dialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export function openDeleteOrganizationUserDialog(
  dialogService: DialogService,
  config: DialogConfig<DeleteOrganizationUserDialogParams>,
) {
  return dialogService.open<DeleteOrganizationUserDialogResult, DeleteOrganizationUserDialogParams>(
    DeleteOrganizationUserDialogComponent,
    config,
  );
}
