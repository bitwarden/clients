import { program, Command } from "commander";

import { BaseProgram } from "@bitwarden/cli/base-program";
import { CliUtils } from "@bitwarden/cli/utils";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ServiceContainer } from "../service-container";

import { AccessTokenCreateCommand } from "./access-tokens/access-token-create.command";
import { AccessTokenListCommand } from "./access-tokens/access-token-list.command";
import { AccessTokenRevokeCommand } from "./access-tokens/access-token-revoke.command";
import { MachineAccountCreateCommand } from "./machine-accounts/machine-account-create.command";
import { MachineAccountDeleteCommand } from "./machine-accounts/machine-account-delete.command";
import { MachineAccountEditCommand } from "./machine-accounts/machine-account-edit.command";
import { MachineAccountGetCommand } from "./machine-accounts/machine-account-get.command";
import { MachineAccountListCommand } from "./machine-accounts/machine-account-list.command";
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
import { SmTemplateObjects, TemplateCommand } from "./templates/template.command";
import { TrashEmptyCommand } from "./trash/trash-empty.command";
import { TrashListCommand } from "./trash/trash-list.command";
import { TrashRestoreCommand } from "./trash/trash-restore.command";

const writeLn = CliUtils.writeLn;

const ORGANIZATION_ID_OPTION = "--organizationid <organizationid>";
const ORGANIZATION_ID_DESCRIPTION = "The organization id (required)";
const ENCODED_JSON_DESCRIPTION =
  "Base64 encoded JSON of the object, e.g. from `bw sm template` and `bw encode`. Can also be piped into stdin.";

type OrgOptions = {
  organizationid: string;
};

type TrashOptions = OrgOptions & {
  all?: boolean;
};

type MachineAccountOptions = OrgOptions & {
  machineaccountid: string;
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
      .addCommand(this.machineAccountCommand())
      .addCommand(this.accessTokenCommand())
      .addCommand(this.trashCommand())
      .addCommand(this.templateCommand())
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn("    bw sm project list --organizationid <organizationid>");
        writeLn("    bw sm secret list --organizationid <organizationid> --projectid <projectid>");
        writeLn("    bw sm machine-account list --organizationid <organizationid>");
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
            const response = await SecretListCommand.create(this.serviceContainer).run(
              options.organizationid,
              options.projectid,
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
            const response = await SecretGetCommand.create(this.serviceContainer).run(
              options.organizationid,
              secretId,
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
            const response = await SecretCreateCommand.create(this.serviceContainer).run(
              options.organizationid,
              encodedJson,
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
              const response = await SecretEditCommand.create(this.serviceContainer).run(
                options.organizationid,
                secretId,
                encodedJson,
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
            const response = await SecretDeleteCommand.create(this.serviceContainer).run(
              options.organizationid,
              secretIds,
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
            const response = await SecretVersionsCommand.create(this.serviceContainer).run(
              options.organizationid,
              secretId,
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
            const response = await SecretRestoreVersionCommand.create(this.serviceContainer).run(
              options.organizationid,
              secretId,
              versionId,
            );
            this.processResponse(response);
          }),
      );
  }

  private machineAccountCommand(): Command {
    return new Command("machine-account")
      .description("Manage Secrets Manager machine accounts.")
      .addCommand(
        new Command("list")
          .description("List the machine accounts you can access in an organization.")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn("    bw sm machine-account list --organizationid <organizationid>");
            writeLn("", true);
          })
          .action(async (options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await MachineAccountListCommand.create(this.serviceContainer).run(
              options.organizationid,
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("get")
          .description("Get a machine account.")
          .argument("<machineAccountId>", "The id of the machine account")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn(
              "    bw sm machine-account get <machineAccountId> --organizationid <organizationid>",
            );
            writeLn("", true);
          })
          .action(async (machineAccountId: string, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await MachineAccountGetCommand.create(this.serviceContainer).run(
              options.organizationid,
              machineAccountId,
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("create")
          .description("Create a machine account.")
          .argument("[encodedJson]", ENCODED_JSON_DESCRIPTION)
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn(
              "    bw sm template sm-machine-account | jq '.name=\"CI\"' | bw encode | bw sm machine-account create --organizationid <organizationid>",
            );
            writeLn("", true);
          })
          .action(async (encodedJson: string | undefined, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await MachineAccountCreateCommand.create(this.serviceContainer).run(
              options.organizationid,
              encodedJson,
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("edit")
          .description("Rename a machine account.")
          .argument("<machineAccountId>", "The id of the machine account")
          .argument("[encodedJson]", ENCODED_JSON_DESCRIPTION)
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn(
              '    echo \'{"name":"CI"}\' | bw encode | bw sm machine-account edit <machineAccountId> --organizationid <organizationid>',
            );
            writeLn("", true);
          })
          .action(
            async (
              machineAccountId: string,
              encodedJson: string | undefined,
              options: OrgOptions,
            ) => {
              await this.exitIfLocked();
              const response = await MachineAccountEditCommand.create(this.serviceContainer).run(
                options.organizationid,
                machineAccountId,
                encodedJson,
              );
              this.processResponse(response);
            },
          ),
      )
      .addCommand(
        new Command("delete")
          .description("Permanently delete one or more machine accounts.")
          .argument("<machineAccountIds...>", "The ids of the machine accounts")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    The machine accounts' access tokens stop working immediately.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn(
              "    bw sm machine-account delete <machineAccountId> --organizationid <organizationid>",
            );
            writeLn("", true);
          })
          .action(async (machineAccountIds: string[], options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await MachineAccountDeleteCommand.create(this.serviceContainer).run(
              options.organizationid,
              machineAccountIds,
            );
            this.processResponse(response);
          }),
      );
  }

  private accessTokenCommand(): Command {
    const machineAccountOption = "--machineaccountid <machineaccountid>";
    const machineAccountDescription = "The machine account id (required)";

    return new Command("access-token")
      .description("Manage machine account access tokens.")
      .addCommand(
        new Command("list")
          .description("List a machine account's access tokens.")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .requiredOption(machineAccountOption, machineAccountDescription)
          .on("--help", () => {
            writeLn("\n  Examples:");
            writeLn("");
            writeLn(
              "    bw sm access-token list --organizationid <organizationid> --machineaccountid <machineaccountid>",
            );
            writeLn("", true);
          })
          .action(async (options: MachineAccountOptions) => {
            await this.exitIfLocked();
            const response = await AccessTokenListCommand.create(this.serviceContainer).run(
              options.organizationid,
              options.machineaccountid,
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("create")
          .description("Create an access token for a machine account.")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .requiredOption(machineAccountOption, machineAccountDescription)
          .requiredOption("--name <name>", "The name of the access token (required)")
          .option(
            "--expires <date|never>",
            'When the access token expires, as an ISO 8601 date, or "never" for a token that does not expire. Defaults to never.',
          )
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    The access token is only shown once and cannot be retrieved later.");
            writeLn("    Store it somewhere safe before closing your terminal.");
            writeLn("");
            writeLn("    Use --raw to print only the access token.");
            writeLn("");
            writeLn("    --expires accepts an ISO 8601 date, or never (also none) for a token");
            writeLn("    that does not expire. Omitting --expires is the same as never.");
            writeLn("");
            writeLn("    With `bw serve`, `expires` is required in the JSON body of");
            writeLn(
              "    POST /sm/<organizationid>/machine-accounts/<machineaccountid>/access-tokens.",
            );
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn(
              '    bw sm access-token create --organizationid <organizationid> --machineaccountid <machineaccountid> --name "CI"',
            );
            writeLn(
              '    bw sm access-token create --organizationid <organizationid> --machineaccountid <machineaccountid> --name "CI" --expires never',
            );
            writeLn(
              '    bw sm access-token create --organizationid <organizationid> --machineaccountid <machineaccountid> --name "CI" --expires 2026-12-31 --raw',
            );
            writeLn("", true);
          })
          .action(async (options: MachineAccountOptions & { name: string; expires?: string }) => {
            await this.exitIfLocked();
            const response = await AccessTokenCreateCommand.create(this.serviceContainer).run(
              options.organizationid,
              options.machineaccountid,
              {
                name: options.name,
                expires: options.expires,
                raw: process.env.BW_RAW === "true",
              },
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("revoke")
          .description("Revoke one or more of a machine account's access tokens.")
          .argument("<accessTokenIds...>", "The ids of the access tokens")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .requiredOption(machineAccountOption, machineAccountDescription)
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    Revoked access tokens stop working immediately.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn(
              "    bw sm access-token revoke <accessTokenId> --organizationid <organizationid> --machineaccountid <machineaccountid>",
            );
            writeLn("", true);
          })
          .action(async (accessTokenIds: string[], options: MachineAccountOptions) => {
            await this.exitIfLocked();
            const response = await AccessTokenRevokeCommand.create(this.serviceContainer).run(
              options.organizationid,
              options.machineaccountid,
              accessTokenIds,
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
            const response = await TrashListCommand.create(this.serviceContainer).run(
              options.organizationid,
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
            const response = await TrashRestoreCommand.create(this.serviceContainer).run(
              options.organizationid,
              { secretIds, all: options.all },
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
            const response = await TrashEmptyCommand.create(this.serviceContainer).run(
              options.organizationid,
              { secretIds, all: options.all },
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
