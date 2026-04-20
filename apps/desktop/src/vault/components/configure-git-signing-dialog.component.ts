import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  buildGitSigningCommands,
  GitSigningCommand,
} from "../services/git-signing-commands";

export interface ConfigureGitSigningDialogData {
  cipher: CipherView;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-configure-git-signing-dialog",
  templateUrl: "configure-git-signing-dialog.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    DialogModule,
    I18nPipe,
  ],
})
export class ConfigureGitSigningDialogComponent implements OnInit {
  commands: GitSigningCommand[] = [];
  displayBlock = "";

  constructor(
    @Inject(DIALOG_DATA) private readonly data: ConfigureGitSigningDialogData,
    private readonly dialogRef: DialogRef<boolean>,
    private readonly i18nService: I18nService,
    private readonly logService: LogService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.commands = buildGitSigningCommands(this.data.cipher.sshKey.publicKey);
    this.displayBlock = this.commands.map((c) => c.display).join("\n");
  }

  copy = () => {
    this.platformUtilsService.copyToClipboard(this.displayBlock);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("gitSigningCopiedToast"),
    });
  };

  apply = async () => {
    try {
      const result = await ipc.platform.gitSigning.apply(
        this.commands.map((c) => ({ args: c.args })),
      );

      if (result.success) {
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("gitSigningApplySuccess"),
        });
        void this.dialogRef.close(true);
        return;
      }

      const failed = result.steps[result.steps.length - 1];
      this.logService.warning(
        `git config failed with exit ${failed?.exitCode ?? "?"}: ${failed?.stderr ?? ""}`,
      );
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("gitSigningApplyFailed"),
      });
    } catch (err) {
      this.logService.error("gitSigning.apply threw", err);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("gitSigningApplyFailed"),
      });
    }
  };

  static open(dialogService: DialogService, data: ConfigureGitSigningDialogData) {
    return dialogService.open<boolean, ConfigureGitSigningDialogData>(
      ConfigureGitSigningDialogComponent,
      { data },
    );
  }
}
