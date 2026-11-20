import { Injectable } from "@angular/core";

import {
  SshAgentSetupApi,
  SshAgentSetupApplyResult,
  SshAgentSetupEnvironment,
  SshAgentSetupOverallStatus,
  SshAgentSetupPlan,
  SshAgentVerifyResult,
} from "../../../autofill/models/ssh-agent-setup";

/**
 * Thin renderer-side wrapper around the main-process SSH agent setup API exposed by the preload
 * script as `ipc.autofill.sshAgent.setup`. Components depend on this class so tests can mock it.
 *
 * Every method is async so a missing bridge surfaces as a rejected promise, not a sync throw.
 */
@Injectable({ providedIn: "root" })
export class SshAgentSetupClient implements SshAgentSetupApi {
  private get api(): SshAgentSetupApi {
    return ipc.autofill.sshAgent.setup;
  }

  async getEnvironment(): Promise<SshAgentSetupEnvironment> {
    return this.api.getEnvironment();
  }

  async getStatus(): Promise<SshAgentSetupOverallStatus> {
    return this.api.getStatus();
  }

  async getPlan(): Promise<SshAgentSetupPlan> {
    return this.api.getPlan();
  }

  async apply(planId: string, stepIds: string[]): Promise<SshAgentSetupApplyResult[]> {
    return this.api.apply(planId, stepIds);
  }

  async undo(): Promise<SshAgentSetupApplyResult[]> {
    return this.api.undo();
  }

  async verify(): Promise<SshAgentVerifyResult> {
    return this.api.verify();
  }
}
