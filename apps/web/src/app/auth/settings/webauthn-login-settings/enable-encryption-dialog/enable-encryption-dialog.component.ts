// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { firstValueFrom, Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { WebAuthnLoginCredentialAssertionOptionsView } from "@bitwarden/common/auth/models/view/webauthn-login/webauthn-login-credential-assertion-options.view";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { DIALOG_DATA, DialogConfig, DialogRef } from "@bitwarden/components";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { DialogService } from "@bitwarden/components/src/dialog/dialog.service";

import { WebauthnLoginAdminService } from "../../../core/services/webauthn-login/webauthn-login-admin.service";
import { WebauthnLoginCredentialView } from "../../../core/views/webauthn-login-credential.view";

export interface EnableEncryptionDialogParams {
  credentialId: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "enable-encryption-dialog.component.html",
  standalone: false,
})
export class EnableEncryptionDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected invalidSecret = false;
  protected formGroup = this.formBuilder.group({
    userVerification: this.formBuilder.group({
      secret: [null as Verification | null, Validators.required],
    }),
  });

  protected credential?: WebauthnLoginCredentialView;
  protected credentialOptions?: WebAuthnLoginCredentialAssertionOptionsView;
  protected loading$ = this.webauthnService.loading$;

  constructor(
    @Inject(DIALOG_DATA) private params: EnableEncryptionDialogParams,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef,
    private webauthnService: WebauthnLoginAdminService,
    private webauthnLoginService: WebAuthnLoginServiceAbstraction,
    private accountService: AccountService,
  ) {}

  ngOnInit(): void {
    this.webauthnService
      .getCredential$(this.params.credentialId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((credential: any) => (this.credential = credential));
  }

  submit = async () => {
    if (this.credential === undefined) {
      return;
    }
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    this.dialogRef.disableClose = true;
    try {
      this.credentialOptions = await this.webauthnService.getCredentialAssertOptions(
        this.formGroup.value.userVerification.secret,
      );
      await this.webauthnService.enableCredentialEncryption(
        await this.webauthnLoginService.assertCredential(this.credentialOptions),
        userId,
      );
    } catch (error) {
      if (error instanceof ErrorResponse && error.statusCode === 400) {
        this.invalidSecret = true;
      }
      throw error;
    }

    this.dialogRef.close();
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

/**
 * Strongly typed helper to open a EnableEncryptionDialogComponent
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export const openEnableCredentialDialogComponent = (
  dialogService: DialogService,
  config: DialogConfig<EnableEncryptionDialogParams>,
) => {
  return dialogService.open<unknown>(EnableEncryptionDialogComponent, config);
};
