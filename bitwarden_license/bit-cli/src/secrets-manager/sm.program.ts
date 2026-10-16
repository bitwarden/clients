import { program, Command } from "commander";

import { BaseProgram } from "@bitwarden/cli/base-program";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ServiceContainer } from "../service-container";

export class SmProgram extends BaseProgram {
  constructor(protected serviceContainer: ServiceContainer) {
    super(serviceContainer);
  }

  register() {
    // Hidden from `bw --help` until the SmCli feature flag is removed.
    program.addCommand(this.smCommand(), { hidden: true });
  }

  private smCommand(): Command {
    return new Command("sm")
      .description(
        "Manage Secrets Manager projects, secrets, and machine accounts in an organization.",
      )
      .hook("preAction", () => this.exitIfFeatureFlagDisabled(FeatureFlag.SmCli));
  }
}
