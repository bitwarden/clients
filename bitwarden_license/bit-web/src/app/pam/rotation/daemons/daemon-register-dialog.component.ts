import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ReactiveFormsModule, Validators, FormBuilder } from "@angular/forms";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { RotationSdkService } from "../rotation-sdk.service";

import { DaemonTokenDialogComponent } from "./daemon-token-dialog.component";

export type DaemonRegisterDialogParams = {
  organizationId: OrganizationId;
};

/**
 * Result of a successful registration. `undefined` means the dialog was dismissed
 * without registering (cancel, X, backdrop, escape).
 */
export type DaemonRegisterDialogResult = { registered: true } | undefined;

/**
 * Name-entry dialog for registering a new rotation daemon.
 *
 * On successful submit:
 * 1. Calls {@link DaemonRegistrationService.register} to derive the key + POST to the server.
 * 2. Closes itself, awaiting the promise {@link DialogRef.close} returns.
 * 3. Opens {@link DaemonTokenDialogComponent} to show the one-time token.
 *
 * `DaemonRegistrationService` is provided in this component's `providers` so it
 * only lives while the dialog is open — no singleton leakage.
 */
@Component({
  selector: "app-daemon-register-dialog",
  templateUrl: "./daemon-register-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
  ],
})
export class DaemonRegisterDialogComponent {
  protected readonly params = inject<DaemonRegisterDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<DaemonRegisterDialogResult>>(DialogRef);
  private readonly dialogService = inject(DialogService);
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(200)]],
  });

  protected readonly submit = async (): Promise<void> => {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const name = this.form.controls.name.value;

    try {
      // The SDK derives the key material, calls the server, and assembles the one-time token.
      const { token } = await this.rotationSdk.registerConnector(this.params.organizationId, name);

      await this.dialogRef.close({ registered: true });

      // Show the operator-entered name (not the daemon's GUID) as the dialog subtitle.
      DaemonTokenDialogComponent.open(this.dialogService, {
        data: { daemonName: name, token },
      });
    } catch (e) {
      const message =
        e instanceof ErrorResponse
          ? (e.message ?? this.i18nService.t("unexpectedError"))
          : this.i18nService.t("unexpectedError");
      this.toastService.showToast({ variant: "error", message });
    }
  };

  protected cancel(): void {
    void this.dialogRef.close(undefined);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<DaemonRegisterDialogParams>,
  ): DialogRef<DaemonRegisterDialogResult> {
    return dialogService.open<DaemonRegisterDialogResult, DaemonRegisterDialogParams>(
      DaemonRegisterDialogComponent,
      config,
    );
  }
}
