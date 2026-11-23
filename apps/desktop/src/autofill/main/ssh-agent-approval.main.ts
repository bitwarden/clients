import { dialog } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/** How long the user has to answer before the request is denied. */
const APPROVAL_TIMEOUT_MS = 60_000;

const ButtonIndex = Object.freeze({
  Authorize: 0,
  Deny: 1,
} as const);

export interface SshApprovalRequest {
  cipherName: string;
  application: string;
  isAgentForwarding: boolean;
  /** The signing namespace, e.g. `git`; empty for a login. */
  namespace?: string;
  /** The AI agent that started the requesting process, e.g. `claude`. */
  aiAgent?: string;
}

/**
 * Asks the user to approve an SSH key use in a window of its own, so the request does not need the
 * app window (or its renderer) to exist.
 *
 * Closing the window, pressing Deny, or letting it sit for a minute all deny the request.
 */
export class SshAgentApprovalMain {
  constructor(private i18nService: I18nService) {}

  /** Resolves to whether the user authorized the request. */
  async request(request: SshApprovalRequest): Promise<boolean> {
    const { response } = await dialog.showMessageBox({
      type: "warning",
      title: this.i18nService.t("sshkeyApprovalTitle"),
      message: this.message(request),
      detail: this.warnings(request),
      buttons: [this.i18nService.t("authorize"), this.i18nService.t("deny")],
      defaultId: ButtonIndex.Deny,
      cancelId: ButtonIndex.Deny,
      noLink: true,
      // Aborting closes the window as if the user had cancelled it, which denies.
      signal: AbortSignal.timeout(APPROVAL_TIMEOUT_MS),
    });

    return response === ButtonIndex.Authorize;
  }

  // e.g. "ssh is requesting access to My key in order to authenticate to a server"
  private message(request: SshApprovalRequest): string {
    return [
      request.application,
      this.i18nService.t("sshkeyApprovalMessageInfix"),
      request.cipherName,
      this.i18nService.t("sshkeyApprovalMessageSuffix"),
      this.i18nService.t(this.actionKey(request.namespace)),
    ].join(" ");
  }

  private actionKey(namespace?: string): string {
    if (namespace === "git") {
      return "sshActionGitSign";
    }
    if (namespace != null && namespace !== "") {
      return "sshActionSign";
    }
    return "sshActionLogin";
  }

  private warnings(request: SshApprovalRequest): string {
    const warnings: string[] = [];
    if (request.isAgentForwarding) {
      warnings.push(
        `${this.i18nService.t("agentForwardingWarningTitle")}\n${this.i18nService.t("agentForwardingWarningText")}`,
      );
    }
    if (request.aiAgent) {
      warnings.push(
        `${this.i18nService.t("sshAgentAiAgentWarningTitle")}\n${this.i18nService.t("sshAgentAiAgentWarningText", request.aiAgent)}`,
      );
    }

    return warnings.join("\n\n");
  }
}
