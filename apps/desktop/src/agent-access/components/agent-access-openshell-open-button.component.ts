import { ChangeDetectionStrategy, Component, inject, input, signal } from "@angular/core";

import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ButtonModule, MenuModule, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The sandbox page's primary "Open" button (agent-access-architecture.md, §M8.20 rule 15): a shell
 * in the sandbox. "Copy connect command" is always offered; "Open in Terminal" only on macOS, where
 * main launches Terminal. The renderer sends a sandbox name and an action and nothing else; main
 * builds the command. The copied text is a command line with no credential in it.
 */
@Component({
  selector: "app-agent-access-openshell-open-button",
  templateUrl: "agent-access-openshell-open-button.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, I18nPipe, MenuModule],
})
export class AgentAccessOpenShellOpenButtonComponent {
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  readonly sandboxName = input.required<string>();
  readonly disabled = input(false);

  protected readonly canOpenTerminal =
    this.platformUtilsService.getDevice() === DeviceType.MacOsDesktop;
  protected readonly busy = signal(false);

  protected async openTerminal(): Promise<void> {
    const result = await this.request("openTerminal");
    if (result != null && !result.launched) {
      this.showError(null);
    }
  }

  protected async copyCommand(): Promise<void> {
    const result = await this.request("copyCommand");
    if (result != null) {
      this.platformUtilsService.copyToClipboard(result.command);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("agentAccessOsOpenCopied"),
      });
    }
  }

  private async request(
    action: "openTerminal" | "copyCommand",
  ): Promise<{ command: string; launched: boolean } | null> {
    this.busy.set(true);
    try {
      const result = await ipc.agentAccess.openOpenShellShell({
        sandboxName: this.sandboxName(),
        action,
      });
      if (!result.ok) {
        this.showError(result.message);
        return null;
      }
      return result.data;
    } finally {
      this.busy.set(false);
    }
  }

  private showError(message: string | undefined | null): void {
    this.toastService.showToast({
      variant: "error",
      title: this.i18nService.t("agentAccessOsOpenFailed"),
      message: message?.trim() ? message : this.i18nService.t("agentAccessOsPageErrorFailed"),
    });
  }
}
