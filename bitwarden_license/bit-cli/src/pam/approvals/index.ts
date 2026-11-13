import { Command } from "commander";

import { ServiceContainer } from "../../service-container";

import { ApprovalsProgram } from "./approvals.program";

/** Mounts `bw privileged-controls approval`: the approver inbox, history, decisions, withdrawals and lease revocation. */
export function registerApprovals(pam: Command, container: ServiceContainer): void {
  pam.addCommand(new ApprovalsProgram(container).command());
}
