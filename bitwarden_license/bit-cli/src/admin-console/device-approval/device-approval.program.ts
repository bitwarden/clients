import { program, Command } from "commander";

import { BaseProgram } from "@bitwarden/cli/base-program";

import { ServiceContainer } from "../../service-container";

import { ApproveAllCommand } from "./approve-all.command";
import { ApproveCommand } from "./approve.command";
import { DenyAllCommand } from "./deny-all.command";
import { DenyCommand } from "./deny.command";
import { ListCommand } from "./list.command";

type Options = {
  organizationid: string;
};

export class DeviceApprovalProgram extends BaseProgram {
  constructor(protected serviceContainer: ServiceContainer) {
    super(serviceContainer);
  }

  register() {
    program.addCommand(this.deviceApprovalCommand());
  }

  private deviceApprovalCommand() {
    return new Command("device-approval")
      .description(
        "Manage device approval requests sent to organizations that use SSO with trusted devices.",
      )
      .addCommand(this.listCommand())
      .addCommand(this.approveCommand())
      .addCommand(this.approveAllCommand())
      .addCommand(this.denyCommand())
      .addCommand(this.denyAllCommand());
  }

  private listCommand(): Command {
    return new Command("list")
      .description("List all pending requests for an organization")
      .requiredOption("--organizationid <organizationid>", "The organization id (required)")
      .action(async (options: Options) => {
        await this.exitIfLocked();

        const cmd = ListCommand.create(this.serviceContainer);
        const response = await cmd.run(options.organizationid);
        this.processResponse(response);
      });
  }

  private approveCommand(): Command {
    return new Command("approve")
      .argument("<requestId>", "The id of the request to approve")
      .requiredOption("--organizationid <organizationid>", "The organization id (required)")
      .description("Approve a pending request")
      .action(async (id: string, options: Options) => {
        await this.exitIfLocked();

        const cmd = ApproveCommand.create(this.serviceContainer);
        const response = await cmd.run(options.organizationid, id);
        this.processResponse(response);
      });
  }

  private approveAllCommand(): Command {
    return new Command("approve-all")
      .description("Approve all pending requests for an organization")
      .requiredOption("--organizationid <organizationid>", "The organization id (required)")
      .action(async (options: Options) => {
        await this.exitIfLocked();

        const cmd = ApproveAllCommand.create(this.serviceContainer);
        const response = await cmd.run(options.organizationid);
        this.processResponse(response);
      });
  }

  private denyCommand(): Command {
    return new Command("deny")
      .argument("<requestId>", "The id of the request to deny")
      .requiredOption("--organizationid <organizationid>", "The organization id (required)")
      .description("Deny a pending request")
      .action(async (id: string, options: Options) => {
        await this.exitIfLocked();

        const cmd = DenyCommand.create(this.serviceContainer);
        const response = await cmd.run(options.organizationid, id);
        this.processResponse(response);
      });
  }

  private denyAllCommand(): Command {
    return new Command("deny-all")
      .description("Deny all pending requests for an organization")
      .requiredOption("--organizationid <organizationid>", "The organization id (required)")
      .action(async (options: Options) => {
        await this.exitIfLocked();

        const cmd = DenyAllCommand.create(this.serviceContainer);
        const response = await cmd.run(options.organizationid);
        this.processResponse(response);
      });
  }
}
