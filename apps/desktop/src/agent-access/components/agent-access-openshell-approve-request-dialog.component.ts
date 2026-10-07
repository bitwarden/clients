import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import {
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OpenShellRequest, OpenShellRequestEndpoint } from "../models/openshell-requests";

const DEFAULT_PORT = 443;

export interface AgentAccessOpenShellApproveRequestDialogParams {
  sandboxName: string;
  request: OpenShellRequest;
}

export type AgentAccessOpenShellApproveRequestDecision = "approve" | "deny" | "createPermission";

export interface AgentAccessOpenShellApproveRequestDialogResult {
  decision: AgentAccessOpenShellApproveRequestDecision;
}

/**
 * Approval popup for one agent permission request (agent-access-architecture.md, §M8.20 rule 16),
 * laid out like the credential approval popups: a callout saying who asks, what it would reach,
 * then Authorize / Deny. Closing it any other way decides nothing. It only reports the decision;
 * the Requests tab acts on it. Everything on the request is untrusted gateway text, shown as text.
 */
@Component({
  selector: "app-agent-access-openshell-approve-request-dialog",
  templateUrl: "agent-access-openshell-approve-request-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, CalloutModule, DialogModule, I18nPipe, TypographyModule],
})
export class AgentAccessOpenShellApproveRequestDialogComponent {
  private readonly dialogRef =
    inject<DialogRef<AgentAccessOpenShellApproveRequestDialogResult>>(DialogRef);
  protected readonly params = inject<AgentAccessOpenShellApproveRequestDialogParams>(DIALOG_DATA);

  static open(
    dialogService: DialogService,
    params: AgentAccessOpenShellApproveRequestDialogParams,
  ) {
    return dialogService.open<
      AgentAccessOpenShellApproveRequestDialogResult,
      AgentAccessOpenShellApproveRequestDialogParams
    >(AgentAccessOpenShellApproveRequestDialogComponent, { data: params });
  }

  protected target(endpoint: OpenShellRequestEndpoint): string {
    return endpoint.port === DEFAULT_PORT ? endpoint.host : `${endpoint.host}:${endpoint.port}`;
  }

  protected decide(decision: AgentAccessOpenShellApproveRequestDecision): void {
    void this.dialogRef.close({ decision });
  }
}
