import { Component } from "@angular/core";
import { Observable } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { AgentConnectionView } from "@bitwarden/common/tools/agent-connection/models/view/agent-connection.view";
import { AgentConnectionApiService } from "@bitwarden/common/tools/agent-connection/services/agent-connection-api.service.abstraction";
import { InternalAgentConnectionService } from "@bitwarden/common/tools/agent-connection/services/agent-connection.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

/**
 * Settings page listing the user's "Login with Bitwarden" agent connections with a revoke action.
 * Revoking deletes the connection server-side (which pushes to the user's other clients) and from
 * local state; the bot's short-lived token then expires on its own (no refresh).
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [SharedModule, HeaderModule],
  templateUrl: "agent-connections.component.html",
})
export class AgentConnectionsComponent {
  protected connections$: Observable<AgentConnectionView[]> =
    this.agentConnectionService.agentConnectionViews$;

  constructor(
    private agentConnectionService: InternalAgentConnectionService,
    private agentConnectionApiService: AgentConnectionApiService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  async revoke(connection: AgentConnectionView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "loginWithBitwardenRevokeTitle" },
      content: { key: "loginWithBitwardenRevokeConfirm", placeholders: [connection.name] },
      type: "warning",
      acceptButtonText: { key: "revoke" },
    });
    if (!confirmed) {
      return;
    }

    await this.agentConnectionApiService.delete(connection.id);
    await this.agentConnectionService.delete(connection.id);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("loginWithBitwardenRevoked"),
    });
  }
}
