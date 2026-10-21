import { program, Command } from "commander";

import { BaseProgram } from "@bitwarden/cli/base-program";
import { CliUtils } from "@bitwarden/cli/utils";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ServiceContainer } from "../service-container";

import { ProjectCreateCommand } from "./projects/project-create.command";
import { ProjectDeleteCommand } from "./projects/project-delete.command";
import { ProjectEditCommand } from "./projects/project-edit.command";
import { ProjectGetCommand } from "./projects/project-get.command";
import { ProjectListCommand } from "./projects/project-list.command";

const writeLn = CliUtils.writeLn;

const ORGANIZATION_ID_OPTION = "--organizationid <organizationid>";
const ORGANIZATION_ID_DESCRIPTION = "The organization id (required)";
const ENCODED_JSON_DESCRIPTION =
  "Base64 encoded JSON of the object, e.g. from `bw sm template` and `bw encode`. Can also be piped into stdin.";

type OrgOptions = {
  organizationid: string;
};

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
      .hook("preAction", () => this.exitIfFeatureFlagDisabled(FeatureFlag.SmCli))
      .addCommand(this.projectCommand())
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn("    bw sm project list --organizationid <organizationid>");
        writeLn("", true);
      });
  }

  private projectCommand(): Command {
    return new Command("project")
      .description("Manage Secrets Manager projects.")
      .addCommand(
        new Command("list")
          .description("List the projects you can access in an organization.")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn("    bw sm project list --organizationid <organizationid>");
            writeLn("", true);
          })
          .action(async (options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await ProjectListCommand.create(this.serviceContainer).run(
              options.organizationid,
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("get")
          .description("Get a project.")
          .argument("<projectId>", "The id of the project")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn("    bw sm project get <projectId> --organizationid <organizationid>");
            writeLn("", true);
          })
          .action(async (projectId: string, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await ProjectGetCommand.create(this.serviceContainer).run(
              options.organizationid,
              projectId,
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("create")
          .description("Create a project.")
          .argument("[encodedJson]", ENCODED_JSON_DESCRIPTION)
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn(
              "    bw sm template sm-project | jq '.name=\"Backend\"' | bw encode | bw sm project create --organizationid <organizationid>",
            );
            writeLn("", true);
          })
          .action(async (encodedJson: string | undefined, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await ProjectCreateCommand.create(this.serviceContainer).run(
              options.organizationid,
              encodedJson,
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("edit")
          .description("Rename a project.")
          .argument("<projectId>", "The id of the project")
          .argument("[encodedJson]", ENCODED_JSON_DESCRIPTION)
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn(
              '    echo \'{"name":"Backend"}\' | bw encode | bw sm project edit <projectId> --organizationid <organizationid>',
            );
            writeLn("", true);
          })
          .action(
            async (projectId: string, encodedJson: string | undefined, options: OrgOptions) => {
              await this.exitIfLocked();
              const response = await ProjectEditCommand.create(this.serviceContainer).run(
                options.organizationid,
                projectId,
                encodedJson,
              );
              this.processResponse(response);
            },
          ),
      )
      .addCommand(
        new Command("delete")
          .description("Permanently delete one or more projects.")
          .argument("<projectIds...>", "The ids of the projects")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    Secrets in a deleted project are kept but are no longer in a project.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn("    bw sm project delete <projectId> --organizationid <organizationid>");
            writeLn(
              "    bw sm project delete <projectId> <projectId> --organizationid <organizationid>",
            );
            writeLn("", true);
          })
          .action(async (projectIds: string[], options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await ProjectDeleteCommand.create(this.serviceContainer).run(
              options.organizationid,
              projectIds,
            );
            this.processResponse(response);
          }),
      );
  }
}
