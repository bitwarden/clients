import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DIALOG_DATA,
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  CenterPositionStrategy,
  DialogModule,
  DialogRef,
  DialogService,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

const SSH_AGENT_HELP_URI = "https://bitwarden.com/help/ssh-agent/";

export type SshAgentSetupDialogData = {
  /** Unix socket path, or the Windows named pipe, the agent listens on. */
  socketAddress: string;
};

@Component({
  templateUrl: "ssh-agent-setup-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    I18nPipe,
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    IconButtonModule,
  ],
})
export class SshAgentSetupDialogComponent {
  protected readonly data = inject<SshAgentSetupDialogData>(DIALOG_DATA);

  private readonly dialogRef = inject(DialogRef);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  // Windows clients find the agent on the well-known OpenSSH named pipe, so there is
  // nothing to export there; every other platform needs SSH_AUTH_SOCK pointed at us.
  protected readonly isWindows =
    this.platformUtilsService.getDevice() === DeviceType.WindowsDesktop;

  protected readonly envVarLine = `export SSH_AUTH_SOCK=${this.data.socketAddress}`;

  static open(dialogService: DialogService, data: SshAgentSetupDialogData) {
    return dialogService.open<void>(SshAgentSetupDialogComponent, {
      data,
      positionStrategy: new CenterPositionStrategy(),
    });
  }

  protected copyEnvVarLine() {
    this.platformUtilsService.copyToClipboard(this.envVarLine);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("sshAgentSocketPath")),
    });
  }

  /**
   * Configures the machine for the user: appends the export line to the shell
   * profiles on unix, disables the built-in OpenSSH agent service on Windows.
   */
  protected readonly applyAutomatically = async () => {
    try {
      await ipc.autofill.sshAgent.applyConfiguration();
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("sshAgentSetupApplyFailed"),
      });
      return;
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("sshAgentSetupApplied"),
    });
    await this.dialogRef.close();
  };

  protected launchHelp() {
    this.platformUtilsService.launchUri(SSH_AGENT_HELP_URI);
  }
}
