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

export type DaemonTokenDialogParams = {
  /** The daemon's name (or ID) shown as a subtitle. */
  daemonName: string;
  /**
   * The one-time token to display.
   *
   * SECURITY: this token is shown exactly once. Never log it. Deliver it to the
   * daemon operator out-of-band (e.g. paste into the daemon configuration file).
   * Format: `0.daemon.{apiKeyId}.{clientSecret}:{keyMaterialBase64}`.
   */
  token: string;
};

/**
 * Read-only copy-once dialog for the daemon registration token.
 *
 * Warning callout → single-line read-only token field with an inline copy
 * button (copies + shows a toast; leaves the dialog open so the operator can
 * confirm) → Close button.
 *
 * There is no way to re-fetch the token after this dialog closes. If the
 * operator loses it, they must delete the daemon and re-register.
 *
 * Opened with `disableClose`, so Escape, a backdrop click and the header X cannot
 * dismiss it — the footer Close button is the only exit.
 */
@Component({
  selector: "app-daemon-token-dialog",
  templateUrl: "./daemon-token-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, CalloutModule, DialogModule, FormFieldModule, IconButtonModule, I18nPipe],
})
export class DaemonTokenDialogComponent {
  protected readonly params = inject<DaemonTokenDialogParams>(DIALOG_DATA);
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
    config: DialogConfig<DaemonTokenDialogParams>,
  ): DialogRef<void> {
    return dialogService.open<void, DaemonTokenDialogParams>(DaemonTokenDialogComponent, {
      ...config,
      disableClose: true,
    });
  }
}
