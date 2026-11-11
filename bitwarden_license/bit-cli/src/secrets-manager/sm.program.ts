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
import { SecretCreateCommand } from "./secrets/secret-create.command";
import { SecretDeleteCommand } from "./secrets/secret-delete.command";
import { SecretEditCommand } from "./secrets/secret-edit.command";
import { SecretGetCommand } from "./secrets/secret-get.command";
import { SecretListCommand } from "./secrets/secret-list.command";
import { SecretRestoreVersionCommand } from "./secrets/secret-restore-version.command";
import { SecretVersionsCommand } from "./secrets/secret-versions.command";
import { withSmOrganization } from "./sm-command.utils";
import { SmTemplateObjects, TemplateCommand } from "./templates/template.command";
import { TrashEmptyCommand } from "./trash/trash-empty.command";
import { TrashListCommand } from "./trash/trash-list.command";
import { TrashRestoreCommand } from "./trash/trash-restore.command";

const writeLn = CliUtils.writeLn;

const ORGANIZATION_ID_OPTION = "--organizationid <organizationid>";
const ORGANIZATION_ID_DESCRIPTION = "The organization id (required)";
const ENCODED_JSON_DESCRIPTION =
  "Base64 encoded JSON of the object, e.g. from `bw encode`. Can also be piped into stdin.";

type OrgOptions = {
  organizationid: string;
};

type TrashOptions = OrgOptions & {
  all?: boolean;
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
      .addCommand(this.secretCommand())
      .addCommand(this.trashCommand())
      .addCommand(this.templateCommand())
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn("    bw sm project list --organizationid <organizationid>");
        writeLn("    bw sm secret list --organizationid <organizationid> --projectid <projectid>");
        writeLn("    bw sm template sm-secret");
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
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) => ProjectListCommand.create(this.serviceContainer).run(org),
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
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) => ProjectGetCommand.create(this.serviceContainer).run(org, projectId),
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
              '    echo \'{"name":"Backend"}\' | bw encode | bw sm project create --organizationid <organizationid>',
            );
            writeLn("", true);
          })
          .action(async (encodedJson: string | undefined, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) => ProjectCreateCommand.create(this.serviceContainer).run(org, encodedJson),
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
              const response = await withSmOrganization(
                this.serviceContainer,
                options.organizationid,
                (org) =>
                  ProjectEditCommand.create(this.serviceContainer).run(org, projectId, encodedJson),
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
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) => ProjectDeleteCommand.create(this.serviceContainer).run(org, projectIds),
            );
            this.processResponse(response);
          }),
      );
  }

  private secretCommand(): Command {
    return new Command("secret")
      .description("Manage Secrets Manager secrets.")
      .addCommand(
        new Command("list")
          .description("List the secrets you can access in an organization or project.")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .option("--projectid <projectid>", "Only list secrets in this project")
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    Secret values are not included. Use `bw sm secret get` to read a value.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn("    bw sm secret list --organizationid <organizationid>");
            writeLn(
              "    bw sm secret list --organizationid <organizationid> --projectid <projectid>",
            );
            writeLn("", true);
          })
          .action(async (options: OrgOptions & { projectid?: string }) => {
            await this.exitIfLocked();
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) => SecretListCommand.create(this.serviceContainer).run(org, options.projectid),
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("get")
          .description("Get a secret, including its value.")
          .argument("<secretId>", "The id of the secret")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn("    bw sm secret get <secretId> --organizationid <organizationid>");
            writeLn("", true);
          })
          .action(async (secretId: string, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) => SecretGetCommand.create(this.serviceContainer).run(org, secretId),
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("create")
          .description("Create a secret.")
          .argument("[encodedJson]", ENCODED_JSON_DESCRIPTION)
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    `key` is required. `projectIds` may contain at most one project id.");
            writeLn("    Only organization admins can create a secret without a project.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn(
              '    bw sm template sm-secret | jq \'.key="DB_PASSWORD" | .value="hunter2" | .projectIds=["<projectId>"]\' | bw encode | bw sm secret create --organizationid <organizationid>',
            );
            writeLn("", true);
          })
          .action(async (encodedJson: string | undefined, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) => SecretCreateCommand.create(this.serviceContainer).run(org, encodedJson),
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("edit")
          .description("Edit a secret.")
          .argument("<secretId>", "The id of the secret")
          .argument("[encodedJson]", ENCODED_JSON_DESCRIPTION)
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    Only the `key`, `value`, `note`, and `projectIds` properties in the");
            writeLn("    request are changed; missing properties keep their current values.");
            writeLn("    Access to the secret is not changed.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn(
              '    echo \'{"value":"new value"}\' | bw encode | bw sm secret edit <secretId> --organizationid <organizationid>',
            );
            writeLn("", true);
          })
          .action(
            async (secretId: string, encodedJson: string | undefined, options: OrgOptions) => {
              await this.exitIfLocked();
              const response = await withSmOrganization(
                this.serviceContainer,
                options.organizationid,
                (org) =>
                  SecretEditCommand.create(this.serviceContainer).run(org, secretId, encodedJson),
              );
              this.processResponse(response);
            },
          ),
      )
      .addCommand(
        new Command("delete")
          .description("Move one or more secrets to the trash.")
          .argument("<secretIds...>", "The ids of the secrets")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    Deleted secrets can be restored with `bw sm trash restore`.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn("    bw sm secret delete <secretId> --organizationid <organizationid>");
            writeLn(
              "    bw sm secret delete <secretId> <secretId> --organizationid <organizationid>",
            );
            writeLn("", true);
          })
          .action(async (secretIds: string[], options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) => SecretDeleteCommand.create(this.serviceContainer).run(org, secretIds),
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("versions")
          .description("List the previous values of a secret, newest first.")
          .argument("<secretId>", "The id of the secret")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn("    bw sm secret versions <secretId> --organizationid <organizationid>");
            writeLn("", true);
          })
          .action(async (secretId: string, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) => SecretVersionsCommand.create(this.serviceContainer).run(org, secretId),
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("restore-version")
          .description("Restore a previous value of a secret.")
          .argument("<secretId>", "The id of the secret")
          .argument("<versionId>", "The id of the version, from `bw sm secret versions`")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn(
              "    bw sm secret restore-version <secretId> <versionId> --organizationid <organizationid>",
            );
            writeLn("", true);
          })
          .action(async (secretId: string, versionId: string, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) =>
                SecretRestoreVersionCommand.create(this.serviceContainer).run(
                  org,
                  secretId,
                  versionId,
                ),
            );
            this.processResponse(response);
          }),
      );
  }

  private trashCommand(): Command {
    return new Command("trash")
      .description("Manage deleted Secrets Manager secrets.")
      .addCommand(
        new Command("list")
          .description("List the secrets in an organization's trash.")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn("    bw sm trash list --organizationid <organizationid>");
            writeLn("", true);
          })
          .action(async (options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) => TrashListCommand.create(this.serviceContainer).run(org),
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("restore")
          .description("Restore secrets from the trash.")
          .argument("[secretIds...]", "The ids of the trashed secrets")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .option("--all", "Restore every secret in the trash")
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn("    bw sm trash restore <secretId> --organizationid <organizationid>");
            writeLn("    bw sm trash restore --all --organizationid <organizationid>");
            writeLn("", true);
          })
          .action(async (secretIds: string[], options: TrashOptions) => {
            await this.exitIfLocked();
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) =>
                TrashRestoreCommand.create(this.serviceContainer).run(org, {
                  secretIds,
                  all: options.all,
                }),
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("empty")
          .description("Permanently delete secrets from the trash.")
          .argument("[secretIds...]", "The ids of the trashed secrets")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .option("--all", "Permanently delete every secret in the trash")
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    Permanently deleted secrets cannot be recovered.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn("    bw sm trash empty <secretId> --organizationid <organizationid>");
            writeLn("    bw sm trash empty --all --organizationid <organizationid>");
            writeLn("", true);
          })
          .action(async (secretIds: string[], options: TrashOptions) => {
            await this.exitIfLocked();
            const response = await withSmOrganization(
              this.serviceContainer,
              options.organizationid,
              (org) =>
                TrashEmptyCommand.create(this.serviceContainer).run(org, {
                  secretIds,
                  all: options.all,
                }),
            );
            this.processResponse(response);
          }),
      );
  }

  private templateCommand(): Command {
    return new Command("template")
      .description("Get a JSON template for creating or editing a Secrets Manager object.")
      .argument("<object>", "The template object: " + SmTemplateObjects.join(", "))
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn("    bw sm template sm-project");
        writeLn("    bw sm template sm-secret");
        writeLn("    bw sm template sm-machine-account");
        writeLn("", true);
      })
      .action(async (object: string) => {
        const response = await TemplateCommand.create().run(object);
        this.processResponse(response);
      });
  }
}
