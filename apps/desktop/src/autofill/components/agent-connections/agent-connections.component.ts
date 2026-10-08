import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  ButtonModule,
  DialogService,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AgentFillConnectionView } from "../../models/agent-fill-connection";

import { ConnectAgentDialogComponent } from "./connect-agent-dialog.component";

/**
 * The "Agent connections" section of Settings: the agents allowed to ask this app to fill a login
 * or card. Each row can be paused, resumed or removed. A paused connection is refused until it is
 * resumed; a removed one needs a new connection key.
 */
@Component({
  selector: "app-agent-connections",
  templateUrl: "agent-connections.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    I18nPipe,
    IconButtonModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
})
export class AgentConnectionsComponent implements OnInit {
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);

  protected readonly connections = signal<AgentFillConnectionView[]>([]);

  async ngOnInit() {
    await this.refresh();
  }

  protected async connect() {
    const dialogRef = ConnectAgentDialogComponent.open(this.dialogService);
    await firstValueFrom(dialogRef.closed);
    await this.refresh();
  }

  protected async pause(connection: AgentFillConnectionView) {
    await this.run(() => ipc.autofill.agentFill.connections.pause(connection.id));
  }

  protected async resume(connection: AgentFillConnectionView) {
    await this.run(() => ipc.autofill.agentFill.connections.resume(connection.id));
  }

  protected async remove(connection: AgentFillConnectionView) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removeAgentConnection" },
      content: { key: "removeAgentConnectionConfirm", placeholders: [connection.name] },
      type: "warning",
      acceptButtonText: { key: "remove" },
      cancelButtonText: { key: "cancel" },
    });
    if (confirmed) {
      await this.run(() => ipc.autofill.agentFill.connections.remove(connection.id));
    }
  }

  private async run(action: () => Promise<void>) {
    try {
      await action();
    } catch (e) {
      this.logService.error("[AgentFill] Connection change failed", e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("unexpectedError"),
      });
    }
    await this.refresh();
  }

  private async refresh() {
    try {
      this.connections.set(await ipc.autofill.agentFill.connections.list());
    } catch (e) {
      this.logService.error("[AgentFill] Could not list connections", e);
    }
  }
}
