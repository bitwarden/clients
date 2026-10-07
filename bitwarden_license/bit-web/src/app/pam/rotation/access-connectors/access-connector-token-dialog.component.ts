import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type AccessConnectorTokenDialogParams = {
  accessConnectorName: string;
  /**
   * Shown once; never log it. Format:
   * `0.access-connector.{apiKeyId}.{clientSecret}:{keyMaterialBase64}`.
   */
  token: string;
};

/**
 * Shows the registration token once; a lost token means deleting and re-registering the access
 * connector. Opened with `disableClose`, so only the footer Close button dismisses it.
 */
@Component({
  selector: "app-access-connector-token-dialog",
  templateUrl: "./access-connector-token-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, CalloutModule, DialogModule, FormFieldModule, IconButtonModule, I18nPipe],
})
export class AccessConnectorTokenDialogComponent {
  protected readonly params = inject<AccessConnectorTokenDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef>(DialogRef);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected copyToken(): void {
    this.platformUtilsService.copyToClipboard(this.params.token);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("pamAccessConnectorTokenCopied"),
    });
  }

  protected close(): void {
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
