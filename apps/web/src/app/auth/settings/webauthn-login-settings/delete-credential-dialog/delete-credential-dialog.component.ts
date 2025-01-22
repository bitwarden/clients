// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogConfig, DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { Verification } from "@bitwarden/common/auth/types/verification";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { WebauthnLoginAdminService } from "../../../core";
import { WebauthnLoginCredentialView } from "../../../core/views/webauthn-login-credential.view";

export interface DeleteCredentialDialogParams {
  credentialId: string;
}

@Component({
  templateUrl: "delete-credential-dialog.component.html",
})
export class DeleteCredentialDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected invalidSecret = false;
  protected formGroup = this.formBuilder.group({
    secret: null as Verification | null,
  });
  protected credential?: WebauthnLoginCredentialView;
  protected loading$ = this.webauthnService.loading$;

  constructor(
    @Inject(DIALOG_DATA) private params: DeleteCredentialDialogParams,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef,
    private webauthnService: WebauthnLoginAdminService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private logService: LogService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.webauthnService
      .getCredential$(this.params.credentialId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((credential) => (this.credential = credential));
  }

  submit = async () => {
    if (this.credential === undefined) {
      return;
    }

    this.dialogRef.disableClose = true;
    try {
      await this.webauthnService.deleteCredential(this.credential.id, this.formGroup.value.secret);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("passkeyRemoved"),
      });
    } catch (error) {
      if (error instanceof ErrorResponse && error.statusCode === 400) {
        this.invalidSecret = true;
      } else {
        this.logService?.error(error);
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("unexpectedError"),
          message: error.message,
        });
      }
      return false;
    } finally {
      this.dialogRef.disableClose = false;
    }

    this.dialogRef.close();
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

/**
 * Strongly typed helper to open a DeleteCredentialDialogComponent
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export const openDeleteCredentialDialogComponent = (
  dialogService: DialogService,
  config: DialogConfig<DeleteCredentialDialogParams>,
) => {
  return dialogService.open<unknown>(DeleteCredentialDialogComponent, config);
};
