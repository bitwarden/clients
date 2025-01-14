// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { firstValueFrom, map, Observable } from "rxjs";

import { PrfKeySet } from "@bitwarden/auth/common";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { WebauthnLoginAdminService } from "../../../core";
import { CredentialCreateOptionsView } from "../../../core/views/credential-create-options.view";
import { PendingWebauthnLoginCredentialView } from "../../../core/views/pending-webauthn-login-credential.view";

import { CreatePasskeyFailedIcon } from "./create-passkey-failed.icon";
import { CreatePasskeyIcon } from "./create-passkey.icon";

export enum CreateCredentialDialogResult {
  Success,
}

type Step =
  | "userVerification"
  | "credentialCreation"
  | "credentialCreationFailed"
  | "credentialNaming";

@Component({
  templateUrl: "create-credential-dialog.component.html",
})
export class CreateCredentialDialogComponent implements OnInit {
  protected readonly NameMaxCharacters = 50;
  protected readonly CreateCredentialDialogResult = CreateCredentialDialogResult;
  protected readonly Icons = { CreatePasskeyIcon, CreatePasskeyFailedIcon };

  protected currentStep: Step = "userVerification";
  protected invalidSecret = false;
  protected formGroup = this.formBuilder.group({
    userVerification: this.formBuilder.group({
      secret: [null as Verification | null, Validators.required],
    }),
    credentialNaming: this.formBuilder.group({
      name: ["", Validators.maxLength(50)],
      useForEncryption: [true],
    }),
  });

  protected credentialOptions?: CredentialCreateOptionsView;
  protected pendingCredential?: PendingWebauthnLoginCredentialView;
  protected hasPasskeys$?: Observable<boolean>;
  protected loading$ = this.webauthnService.loading$;

  constructor(
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef,
    private webauthnService: WebauthnLoginAdminService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private logService: LogService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.hasPasskeys$ = this.webauthnService
      .getCredentials$()
      .pipe(map((credentials) => credentials.length > 0));
  }

  protected submit = async () => {
    this.dialogRef.disableClose = true;

    try {
      switch (this.currentStep) {
        case "userVerification":
          return await this.submitUserVerification();
        case "credentialCreationFailed":
          return await this.submitCredentialCreationFailed();
        case "credentialCreation":
          return await this.submitCredentialCreation();
        case "credentialNaming":
          return await this.submitCredentialNaming();
      }
    } finally {
      this.dialogRef.disableClose = false;
    }
  };

  protected async submitUserVerification() {
    this.formGroup.controls.userVerification.markAllAsTouched();
    if (this.formGroup.controls.userVerification.invalid) {
      return;
    }

    try {
      this.credentialOptions = await this.webauthnService.getCredentialAttestationOptions(
        this.formGroup.value.userVerification.secret,
      );
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
      return;
    }

    this.currentStep = "credentialCreation";
    await this.submitCredentialCreation();
  }

  protected async submitCredentialCreation() {
    this.pendingCredential = await this.webauthnService.createCredential(this.credentialOptions);
    if (this.pendingCredential === undefined) {
      this.currentStep = "credentialCreationFailed";
      return;
    }

    this.currentStep = "credentialNaming";
  }

  protected async submitCredentialCreationFailed() {
    this.currentStep = "credentialCreation";
    await this.submitCredentialCreation();
  }

  protected async submitCredentialNaming() {
    this.formGroup.controls.credentialNaming.markAllAsTouched();
    if (this.formGroup.controls.credentialNaming.controls.name.invalid) {
      return;
    }

    let keySet: PrfKeySet | undefined;
    if (
      this.pendingCredential.supportsPrf &&
      this.formGroup.value.credentialNaming.useForEncryption
    ) {
      keySet = await this.webauthnService.createKeySet(this.pendingCredential);

      if (keySet === undefined) {
        this.formGroup.controls.credentialNaming.controls.useForEncryption?.setErrors({
          error: {
            message: this.i18nService.t("useForVaultEncryptionErrorReadingPasskey"),
          },
        });
        return;
      }
    }

    const name = this.formGroup.value.credentialNaming.name;

    await this.webauthnService.saveCredential(
      this.formGroup.value.credentialNaming.name,
      this.pendingCredential,
      keySet,
    );

    if (await firstValueFrom(this.hasPasskeys$)) {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("passkeySaved", name),
      });
    } else {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("loginWithPasskeyEnabled"),
      });
    }

    this.dialogRef.close(CreateCredentialDialogResult.Success);
  }
}

/**
 * Strongly typed helper to open a CreateCredentialDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export const openCreateCredentialDialog = (
  dialogService: DialogService,
  config: DialogConfig<unknown>,
) => {
  return dialogService.open<CreateCredentialDialogResult | undefined, unknown>(
    CreateCredentialDialogComponent,
    config,
  );
};
