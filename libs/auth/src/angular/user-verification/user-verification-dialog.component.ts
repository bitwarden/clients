// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationWithSecret } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { ActiveClientVerificationOption } from "./active-client-verification-option.enum";
import {
  UserVerificationDialogOptions,
  UserVerificationDialogResult,
} from "./user-verification-dialog.types";
import { UserVerificationFormInputComponent } from "./user-verification-form-input.component";

@Component({
  templateUrl: "user-verification-dialog.component.html",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    ButtonModule,
    DialogModule,
    AsyncActionsModule,
    UserVerificationFormInputComponent,
    CalloutModule,
  ],
})
export class UserVerificationDialogComponent {
  verificationForm = this.formBuilder.group({
    secret: this.formBuilder.control<VerificationWithSecret | null>(null),
  });

  get secret() {
    return this.verificationForm.controls.secret;
  }

  invalidSecret = false;
  activeClientVerificationOption: ActiveClientVerificationOption;
  readonly ActiveClientVerificationOption = ActiveClientVerificationOption;

  constructor(
    @Inject(DIALOG_DATA) public dialogOptions: UserVerificationDialogOptions,
    private dialogRef: DialogRef<UserVerificationDialogResult | string>,
    private formBuilder: FormBuilder,
    private userVerificationService: UserVerificationService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  /**
   * Opens the user verification dialog.
   *
   * @param {DialogService} dialogService - The service used to open the dialog.
   * @param {UserVerificationDialogOptions} data - Parameters for configuring the dialog.
   * @returns {Promise<UserVerificationDialogResult>} A promise that resolves to the result of the user verification process.
   *
   * @example
   * // Example 1: Default, simple scenario
   * const result = await UserVerificationDialogComponent.open(
   *   this.dialogService,
   *   {}
   * );
   *
   * // Handle the result of the dialog based on user action and verification success
   * if (result.userAction === 'cancel') {
   *   // User cancelled the dialog
   *   return;
   * }
   *
   * // User confirmed the dialog so check verification success
   * if (!result.verificationSuccess) {
   *   // verification failed
   *   return;
   * }
   *
   * ----------------------------------------------------------
   *
   * @example
   * // Example 2: Custom scenario
   * const result = await UserVerificationDialogComponent.open(
   *   this.dialogService,
   *   {
   *     title: 'customTitle',
   *     bodyText: 'customBodyText',
   *     calloutOptions: {
   *       text: 'customCalloutText',
   *       type: 'warning',
   *     },
   *     confirmButtonOptions: {
   *       text: 'customConfirmButtonText',
   *       type: 'danger',
   *     }
   *   }
   * );
   *
   * // Handle the result of the dialog based on user action and verification success
   * if (result.userAction === 'cancel') {
   *   // User cancelled the dialog
   *   return;
   * }
   *
   * // User confirmed the dialog so check verification success
   * if (!result.verificationSuccess) {
   *   // verification failed
   *   return;
   * }
   *
   * ----------------------------------------------------------
   *
   * @example
   * // Example 3: Client side verification scenario only
   * const result = await UserVerificationDialogComponent.open(
   *   this.dialogService,
   *   { clientSideOnlyVerification: true }
   * );
   *
   * // Handle the result of the dialog based on user action and verification success
   * if (result.userAction === 'cancel') {
   *   // User cancelled the dialog
   *   return;
   * }
   *
   * // User confirmed the dialog so check verification success
   * if (!result.verificationSuccess) {
   *   if (result.noAvailableClientVerificationMethods) {
   *     // No client-side verification methods are available
   *     // Could send user to configure a verification method like PIN or biometrics
   *   }
   *   return;
   * }
   *
   * ----------------------------------------------------------
   *
   * @example
   * // Example 4: Custom user verification validation
   *
   * const result = await UserVerificationDialogComponent.open(dialogService, {
   *   verificationType: {
   *     type: "custom",
   *     // Pass in a function that will be used to validate the input of the
   *     // verification dialog, returning true when finished.
   *     verificationFn: async (secret: VerificationWithSecret) => {
   *       const request = await userVerificationService.buildRequest<CustomRequestType>(secret);
   *
   *      // ... Do something with the custom request type
   *
   *       await someServicer.sendMyRequestThatVerfiesUserIdentity(
   *         // ... Some other data
   *         request,
   *       );
   *       return true;
   *     },
   *   },
   * });
   *
   * // ... Evaluate the result as usual
   */
  static async open(
    dialogService: DialogService,
    data: UserVerificationDialogOptions,
  ): Promise<UserVerificationDialogResult> {
    const dialogRef = dialogService.open<UserVerificationDialogResult | string>(
      UserVerificationDialogComponent,
      {
        data,
      },
    );

    const dialogResult = await firstValueFrom(dialogRef.closed);

    // An empty string is returned when the user hits the x to close the dialog.
    // Undefined is returned when the users hits the escape key to close the dialog.
    if (typeof dialogResult === "string" || dialogResult === undefined) {
      // User used x to close dialog
      return {
        userAction: "cancel",
        verificationSuccess: false,
      };
    } else {
      return dialogResult;
    }
  }

  handleActiveClientVerificationOptionChange(
    activeClientVerificationOption: ActiveClientVerificationOption,
  ) {
    this.activeClientVerificationOption = activeClientVerificationOption;
  }

  handleBiometricsVerificationResultChange(biometricsVerificationResult: boolean) {
    if (biometricsVerificationResult) {
      this.close({
        userAction: "confirm",
        verificationSuccess: true,
        noAvailableClientVerificationMethods: false,
      });
    }
  }

  submit = async () => {
    if (this.activeClientVerificationOption === ActiveClientVerificationOption.None) {
      this.close({
        userAction: "confirm",
        verificationSuccess: false,
        noAvailableClientVerificationMethods: true,
      });
      return;
    }

    this.verificationForm.markAllAsTouched();

    if (this.verificationForm.invalid) {
      return;
    }

    try {
      if (
        typeof this.dialogOptions.verificationType === "object" &&
        this.dialogOptions.verificationType.type === "custom"
      ) {
        const success = await this.dialogOptions.verificationType.verificationFn(this.secret.value);
        this.close({
          userAction: "confirm",
          verificationSuccess: success,
        });
        return;
      }

      // TODO: once we migrate all user verification scenarios to use this new implementation,
      // we should consider refactoring the user verification service handling of the
      // OTP and MP flows to not throw errors on verification failure.
      const verificationResult = await this.userVerificationService.verifyUser(this.secret.value);

      if (verificationResult) {
        this.invalidSecret = false;
        this.close({
          userAction: "confirm",
          verificationSuccess: true,
          noAvailableClientVerificationMethods: false,
        });
      } else {
        this.invalidSecret = true;

        // Only pin should ever get here, but added this check to be safe.
        if (this.activeClientVerificationOption === ActiveClientVerificationOption.Pin) {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("error"),
            message: this.i18nService.t("invalidPin"),
          });
        } else {
          this.toastService.showToast({
            variant: "error",
            title: null,
            message: this.i18nService.t("unexpectedError"),
          });
        }
      }
    } catch (e) {
      // Catch handles OTP and MP verification scenarios as those throw errors on verification failure instead of returning false like PIN and biometrics.
      this.invalidSecret = true;
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("error"),
        message: e.message,
      });
      return;
    }
  };

  cancel() {
    this.close({
      userAction: "cancel",
      verificationSuccess: false,
    });
  }

  close(dialogResult: UserVerificationDialogResult) {
    this.dialogRef.close(dialogResult);
  }
}
