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

import { DaemonRegistrationService } from "./daemon-registration.service";
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
 * 2. Closes itself.
 * 3. Opens {@link DaemonTokenDialogComponent} to show the one-time token.
 *
 * `DaemonRegistrationService` is provided in this component's `providers` so it
 * only lives while the dialog is open — no singleton leakage.
 */
@Component({
  selector: "app-daemon-register-dialog",
  templateUrl: "./daemon-register-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DaemonRegistrationService],
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
  private readonly registrationService = inject(DaemonRegistrationService);
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

    try {
      const { token, daemon } = await this.registrationService.register(
        this.params.organizationId,
        this.form.controls.name.value,
      );

      // Close the register dialog first, then open the token dialog.
      void this.dialogRef.close({ registered: true });

      DaemonTokenDialogComponent.open(this.dialogService, {
        data: { daemonName: daemon.id, token },
      });
    } catch (e) {
      const message =
        e instanceof ErrorResponse
          ? (e.message ?? this.i18nService.t("unexpectedError"))
          : this.i18nService.t("unexpectedError");
      this.toastService.showToast({ variant: "error", title: null, message });
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
