import { program, Command } from "commander";

import { BaseProgram } from "@bitwarden/cli/base-program";
import { CliUtils } from "@bitwarden/cli/utils";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ServiceContainer } from "../service-container";

import { AccessGetCommand } from "./access/access-get.command";
import { AccessGrantCommand } from "./access/access-grant.command";
import { AccessRevokeCommand } from "./access/access-revoke.command";
import { AccessSetCommand } from "./access/access-set.command";
import { SmAccessPermissions, SmAccessTargets } from "./access/sm-access-policies";
import { AccessTokenCreateCommand } from "./access-tokens/access-token-create.command";
import { AccessTokenListCommand } from "./access-tokens/access-token-list.command";
import { AccessTokenRevokeCommand } from "./access-tokens/access-token-revoke.command";
import { CountsCommand } from "./counts/counts.command";
import { EventsCommand } from "./events/events.command";
import { GranteesListCommand, SmGranteeKinds } from "./grantees/grantees-list.command";
import { MachineAccountCreateCommand } from "./machine-accounts/machine-account-create.command";
import { MachineAccountDeleteCommand } from "./machine-accounts/machine-account-delete.command";
import { MachineAccountEditCommand } from "./machine-accounts/machine-account-edit.command";
import { MachineAccountGetCommand } from "./machine-accounts/machine-account-get.command";
import { MachineAccountListCommand } from "./machine-accounts/machine-account-list.command";
import { SmExportCommand } from "./porting/sm-export.command";
import { SmImportCommand } from "./porting/sm-import.command";
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
      .addCommand(this.accessCommand())
      .addCommand(this.granteesCommand())
      .addCommand(this.countsCommand())
      .addCommand(this.eventsCommand())
      .addCommand(this.exportCommand())
      .addCommand(this.importCommand())
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

  private accessCommand(): Command {
    const targetDescription = "The object type: " + SmAccessTargets.join(", ");
    const granteeDescription =
      "A user's email, the name of a group, machine account, or project, or a grantee id";
    const permissionOption = "--permission <permission>";
    const permissionDescription =
      "The permission to grant: " + SmAccessPermissions.join(", ") + " (required)";

    return new Command("access")
      .description("Manage who and what can access projects, machine accounts, and secrets.")
      .addCommand(
        new Command("get")
          .description("List the access policies on a project, machine account, or secret.")
          .argument("<target>", targetDescription)
          .argument("<id>", "The id of the object")
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    Projects and secrets list user, group, and machine account access.");
            writeLn("    Machine accounts list user and group access, and the projects the");
            writeLn("    machine account can access.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn("    bw sm access get project <projectId> --organizationid <organizationid>");
            writeLn(
              "    bw sm access get machine-account <machineAccountId> --organizationid <organizationid>",
            );
            writeLn("", true);
          })
          .action(async (target: string, id: string, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await AccessGetCommand.create(this.serviceContainer).run(
              options.organizationid,
              target,
              id,
            );
            this.processResponse(response);
          }),
      )
      .addCommand(
        new Command("set")
          .description("Replace every access policy on a project, machine account, or secret.")
          .argument("<target>", targetDescription)
          .argument("<id>", "The id of the object")
          .argument("[encodedJson]", ENCODED_JSON_DESCRIPTION)
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    Any existing policy not listed in `policies` is removed. Use `grant`");
            writeLn("    and `revoke` to change a single policy.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn(
              "    bw sm template sm-access-policies | jq '.policies[0].id=\"<id>\"' | bw encode | bw sm access set project <projectId> --organizationid <organizationid>",
            );
            writeLn("", true);
          })
          .action(
            async (
              target: string,
              id: string,
              encodedJson: string | undefined,
              options: OrgOptions,
            ) => {
              await this.exitIfLocked();
              const response = await AccessSetCommand.create(this.serviceContainer).run(
                options.organizationid,
                target,
                id,
                encodedJson,
              );
              this.processResponse(response);
            },
          ),
      )
      .addCommand(
        new Command("grant")
          .description("Grant access to a project, machine account, or secret.")
          .argument("<target>", targetDescription)
          .argument("<id>", "The id of the object")
          .argument("<grantee>", granteeDescription)
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .requiredOption(permissionOption, permissionDescription)
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    Other existing policies are kept. Granting to a grantee that already has");
            writeLn("    access changes its permission. People can only be granted read-write");
            writeLn("    access to a machine account.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn(
              "    bw sm access grant project <projectId> alice@example.com --permission read --organizationid <organizationid>",
            );
            writeLn(
              '    bw sm access grant machine-account <machineAccountId> "Backend" --permission read-write --organizationid <organizationid>',
            );
            writeLn("", true);
          })
          .action(
            async (
              target: string,
              id: string,
              grantee: string,
              options: OrgOptions & { permission: string },
            ) => {
              await this.exitIfLocked();
              const response = await AccessGrantCommand.create(this.serviceContainer).run(
                options.organizationid,
                target,
                id,
                grantee,
                options.permission,
              );
              this.processResponse(response);
            },
          ),
      )
      .addCommand(
        new Command("revoke")
          .description("Remove access to a project, machine account, or secret.")
          .argument("<target>", targetDescription)
          .argument("<id>", "The id of the object")
          .argument("<grantee>", granteeDescription)
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    Other existing policies are kept.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn(
              "    bw sm access revoke secret <secretId> alice@example.com --organizationid <organizationid>",
            );
            writeLn("", true);
          })
          .action(async (target: string, id: string, grantee: string, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await AccessRevokeCommand.create(this.serviceContainer).run(
              options.organizationid,
              target,
              id,
              grantee,
            );
            this.processResponse(response);
          }),
      );
  }

  private granteesCommand(): Command {
    return new Command("grantees")
      .description("List who and what can be granted access in Secrets Manager.")
      .addCommand(
        new Command("list")
          .description("List potential grantees of the given type.")
          .argument("<type>", "The grantee type: " + SmGranteeKinds.join(", "))
          .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
          .on("--help", () => {
            writeLn("\n  Notes:");
            writeLn("");
            writeLn("    `people` lists users and groups that can be granted access to projects");
            writeLn("    and machine accounts. `machine-accounts` lists machine accounts that can");
            writeLn("    be granted access to projects. `projects` lists projects a machine");
            writeLn("    account can be granted access to.");
            writeLn("");
            writeLn("  Examples:");
            writeLn("");
            writeLn("    bw sm grantees list people --organizationid <organizationid>");
            writeLn("    bw sm grantees list machine-accounts --organizationid <organizationid>");
            writeLn("", true);
          })
          .action(async (type: string, options: OrgOptions) => {
            await this.exitIfLocked();
            const response = await GranteesListCommand.create(this.serviceContainer).run(
              options.organizationid,
              type,
            );
            this.processResponse(response);
          }),
      );
  }

  private countsCommand(): Command {
    return new Command("counts")
      .description(
        "Show Secrets Manager object counts for an organization, project, or machine account.",
      )
      .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
      .option("--projectid <projectid>", "Show counts for this project")
      .option("--machineaccountid <machineaccountid>", "Show counts for this machine account")
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn("    bw sm counts --organizationid <organizationid>");
        writeLn("    bw sm counts --organizationid <organizationid> --projectid <projectid>");
        writeLn(
          "    bw sm counts --organizationid <organizationid> --machineaccountid <machineaccountid>",
        );
        writeLn("", true);
      })
      .action(async (options: OrgOptions & { projectid?: string; machineaccountid?: string }) => {
        await this.exitIfLocked();
        const response = await CountsCommand.create(this.serviceContainer).run(
          options.organizationid,
          { projectId: options.projectid, machineAccountId: options.machineaccountid },
        );
        this.processResponse(response);
      });
  }

  private eventsCommand(): Command {
    return new Command("events")
      .description("List the event logs for a machine account.")
      .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
      .requiredOption("--machineaccountid <machineaccountid>", "The machine account id (required)")
      .requiredOption("--start <start>", "Start of the date range, e.g. 2026-01-01 (required)")
      .requiredOption("--end <end>", "End of the date range, e.g. 2026-01-31T23:59:59Z (required)")
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn(
          "    bw sm events --organizationid <organizationid> --machineaccountid <machineaccountid> --start 2026-01-01 --end 2026-02-01",
        );
        writeLn("", true);
      })
      .action(
        async (options: OrgOptions & { machineaccountid: string; start: string; end: string }) => {
          await this.exitIfLocked();
          const response = await EventsCommand.create(this.serviceContainer).run(
            options.organizationid,
            {
              machineAccountId: options.machineaccountid,
              start: options.start,
              end: options.end,
            },
          );
          this.processResponse(response);
        },
      );
  }

  private exportCommand(): Command {
    return new Command("export")
      .description("Export an organization's Secrets Manager projects and secrets.")
      .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
      .option("--output <output>", "Output directory or filename. Writes to stdout when omitted.")
      .option("--passwordenv <passwordenv>", "Environment variable storing your master password")
      .option(
        "--passwordfile <passwordfile>",
        "Path to a file containing your master password as its first line",
      )
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn("    Only organization owners and admins can export. The export contains");
        writeLn("    decrypted secret values; store it securely.");
        writeLn("");
        writeLn("    Exporting requires your master password. You are prompted for it unless");
        writeLn("    --passwordfile or --passwordenv is given. With --nointeraction, one of");
        writeLn("    these options is required.");
        writeLn("");
        writeLn("    With `bw serve`, send the master password as `password` in the JSON body");
        writeLn("    of POST /sm/<organizationid>/export.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw sm export --organizationid <organizationid>");
        writeLn("    bw sm export --organizationid <organizationid> --output ./sm-export.json");
        writeLn("    bw sm export --organizationid <organizationid> --passwordfile ~/.bw-password");
        writeLn("", true);
      })
      .action(
        async (
          options: OrgOptions & { output?: string; passwordenv?: string; passwordfile?: string },
        ) => {
          await this.exitIfLocked();
          const response = await SmExportCommand.create(this.serviceContainer).run(
            options.organizationid,
            {
              output: options.output,
              passwordEnv: options.passwordenv,
              passwordFile: options.passwordfile,
            },
          );
          this.processResponse(response);
        },
      );
  }

  private importCommand(): Command {
    return new Command("import")
      .description("Import Secrets Manager projects and secrets into an organization.")
      .argument("<file>", "A file from `bw sm export` or the web vault's Secrets Manager export")
      .requiredOption(ORGANIZATION_ID_OPTION, ORGANIZATION_ID_DESCRIPTION)
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn("    Only organization owners and admins can import.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw sm import ./sm-export.json --organizationid <organizationid>");
        writeLn("", true);
      })
      .action(async (file: string, options: OrgOptions) => {
        await this.exitIfLocked();
        const response = await SmImportCommand.create(this.serviceContainer).run(
          options.organizationid,
          { file },
        );
        this.processResponse(response);
      });
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
