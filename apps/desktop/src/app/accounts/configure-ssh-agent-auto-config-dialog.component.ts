import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

type FileStatus = "missing" | "already-present" | "conflict" | "written" | "error";

interface FileResult {
  path: string;
  status: FileStatus;
  message?: string;
}

interface PreviewResult {
  supported: boolean;
  socketPath?: string;
  files: FileResult[];
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-configure-ssh-agent-auto-config-dialog",
  templateUrl: "configure-ssh-agent-auto-config-dialog.component.html",
  imports: [AsyncActionsModule, ButtonModule, CommonModule, DialogModule, I18nPipe],
})
export class ConfigureSshAgentAutoConfigDialogComponent implements OnInit {
  loading = true;
  supported = true;
  exportLine = "";
  files: FileResult[] = [];

  constructor(
    private readonly dialogRef: DialogRef<boolean>,
    private readonly i18nService: I18nService,
    private readonly logService: LogService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly toastService: ToastService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const result: PreviewResult = await ipc.platform.sshAgentAutoConfig.preview();
      this.populateFromResult(result);
    } catch (err) {
      this.logService.error("sshAgentAutoConfig.preview threw", err);
      this.supported = false;
    } finally {
      this.loading = false;
    }
  }

  statusLabel(status: FileStatus): string {
    switch (status) {
      case "missing":
        return this.i18nService.t("sshAgentAutoConfigStatusMissing");
      case "already-present":
        return this.i18nService.t("sshAgentAutoConfigStatusAlreadyPresent");
      case "conflict":
        return this.i18nService.t("sshAgentAutoConfigStatusConflict");
      case "written":
        return this.i18nService.t("sshAgentAutoConfigStatusWillWrite");
      case "error":
        return this.i18nService.t("sshAgentAutoConfigStatusError");
    }
  }

  copy = () => {
    if (!this.exportLine) {
      return;
    }
    this.platformUtilsService.copyToClipboard(this.exportLine);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("sshAgentAutoConfigCopiedToast"),
    });
  };

  apply = async () => {
    try {
      const result: PreviewResult = await ipc.platform.sshAgentAutoConfig.apply();
      this.populateFromResult(result);

      if (!result.supported) {
        this.toastService.showToast({
          variant: "error",
          title: null,
          message: this.i18nService.t("sshAgentAutoConfigUnsupported"),
        });
        return;
      }

      const anyError = result.files.some((f) => f.status === "error");
      const anyConflict = result.files.some((f) => f.status === "conflict");

      if (anyError) {
        this.toastService.showToast({
          variant: "error",
          title: null,
          message: this.i18nService.t("sshAgentAutoConfigFailed"),
        });
        return;
      }

      if (anyConflict) {
        this.toastService.showToast({
          variant: "warning",
          title: null,
          message: this.i18nService.t("sshAgentAutoConfigConflict"),
        });
        void this.dialogRef.close(true);
        return;
      }

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("sshAgentAutoConfigSuccess"),
      });
      void this.dialogRef.close(true);
    } catch (err) {
      this.logService.error("sshAgentAutoConfig.apply threw", err);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("sshAgentAutoConfigFailed"),
      });
    }
  };

  private populateFromResult(result: PreviewResult) {
    this.supported = result.supported;
    this.files = result.files ?? [];
    this.exportLine = result.socketPath ? `export SSH_AUTH_SOCK="${result.socketPath}"` : "";
  }

  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(ConfigureSshAgentAutoConfigDialogComponent);
  }
}
