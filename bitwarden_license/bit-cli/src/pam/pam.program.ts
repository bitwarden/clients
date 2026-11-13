import { Command, program } from "commander";

import { BaseProgram } from "@bitwarden/cli/base-program";

import { ServiceContainer } from "../service-container";

import { registerApprovals } from "./approvals";
import { registerConnectors } from "./connectors";
import { registerLeases } from "./leases";
import { registerRequests } from "./requests";
import { registerRotation } from "./rotation";
import { registerRules } from "./rules";
import { registerStatus } from "./status";
import { registerTargets } from "./targets";

/**
 * Defines `bw privileged-controls` and mounts every group on it. A group is mounted by one fixed
 * `register<Group>(pam, container)` function exported from its `index.ts`, so adding a group's
 * commands never touches this file.
 */
export class PamProgram extends BaseProgram {
  constructor(protected serviceContainer: ServiceContainer) {
    super(serviceContainer);
  }

  register() {
    program.addCommand(this.pamCommand());
  }

  private pamCommand(): Command {
    const pam = new Command("privileged-controls")
      .alias("pc")
      .description(
        "Manage Privileged Controls: access requests, leases, approvals, access rules, and credential rotation.",
      );

    registerRequests(pam, this.serviceContainer);
    registerLeases(pam, this.serviceContainer);
    registerApprovals(pam, this.serviceContainer);
    registerRules(pam, this.serviceContainer);
    registerConnectors(pam, this.serviceContainer);
    registerTargets(pam, this.serviceContainer);
    registerRotation(pam, this.serviceContainer);
    registerStatus(pam, this.serviceContainer);

    return pam;
  }
}
