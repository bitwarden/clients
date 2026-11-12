import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ReactiveFormsModule, Validators, FormBuilder } from "@angular/forms";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

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
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { rotationErrorMessage } from "../rotation-error";
import { ROTATION_TABS, rotationLink } from "../rotation-links";
import { RotationSdkService } from "../rotation-sdk.service";

import { AccessConnectorTokenDialogComponent } from "./access-connector-token-dialog.component";

export type AccessConnectorRegisterDialogParams = {
  organizationId: OrganizationId;
};

/** `undefined` when dismissed without registering. */
export type AccessConnectorRegisterDialogResult = { registered: true } | undefined;

/**
 * Name-entry dialog for a new access connector. On success it closes itself, then opens
 * {@link AccessConnectorTokenDialogComponent} to show the one-time token, and once that is closed
 * opens the new connector's page and confirms the registration there. Callers only refresh.
 */
@Component({
  selector: "app-access-connector-register-dialog",
  templateUrl: "./access-connector-register-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class AccessConnectorRegisterDialogComponent {
  protected readonly params = inject<AccessConnectorRegisterDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<AccessConnectorRegisterDialogResult>>(DialogRef);
  private readonly dialogService = inject(DialogService);
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

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
      const { id, token } = await this.rotationSdk.registerConnector(
        this.params.organizationId,
        name,
      );

      await this.dialogRef.close({ registered: true });

      const tokenDialog = AccessConnectorTokenDialogComponent.open(this.dialogService, {
        data: { token },
      });
      void firstValueFrom(tokenDialog.closed, { defaultValue: undefined }).then(async () => {
        await this.router.navigate(
          rotationLink(this.params.organizationId, ROTATION_TABS.accessConnectors, String(id)),
        );
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorRegistered"),
        });
      });
    } catch (e) {
      const message =
        rotationErrorMessage(e) ??
        (e instanceof ErrorResponse ? e.message : undefined) ??
        this.i18nService.t("pamAccessConnectorRegisterFailed");
      this.toastService.showToast({ variant: "error", message });
    }
  };

  protected cancel(): void {
    void this.dialogRef.close(undefined);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<AccessConnectorRegisterDialogParams>,
  ): DialogRef<AccessConnectorRegisterDialogResult> {
    return dialogService.open<
      AccessConnectorRegisterDialogResult,
      AccessConnectorRegisterDialogParams
    >(AccessConnectorRegisterDialogComponent, config);
  }
}
