import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  CalloutModule,
  CheckboxModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type AccessConnectorTokenDialogParams = {
  /**
   * Shown once; never log it. Format:
   * `0.access-connector.{apiKeyId}.{clientSecret}:{keyMaterialBase64}`.
   */
  token: string;
};

/**
 * Shows the registration token once; a lost token means deleting and re-registering the access
 * connector. Opened with `disableClose`, so only the footer Close button dismisses it, and that
 * stays disabled until the admin confirms they stored the token.
 */
@Component({
  selector: "app-access-connector-token-dialog",
  templateUrl: "./access-connector-token-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    CalloutModule,
    CheckboxModule,
    DialogModule,
    FormFieldModule,
    IconButtonModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class AccessConnectorTokenDialogComponent {
  protected readonly params = inject<AccessConnectorTokenDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef>(DialogRef);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly stored = signal(false);

  protected onStoredChange(event: Event): void {
    this.stored.set((event.target as HTMLInputElement).checked);
  }

  protected copyToken(): void {
    this.platformUtilsService.copyToClipboard(this.params.token);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("pamTokenCopied"),
    });
  }

  protected close(): void {
    if (!this.stored()) {
      return;
    }
    void this.dialogRef.close();
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<AccessConnectorTokenDialogParams>,
  ): DialogRef<void> {
    return dialogService.open<void, AccessConnectorTokenDialogParams>(
      AccessConnectorTokenDialogComponent,
      {
        ...config,
        disableClose: true,
      },
    );
  }
}
