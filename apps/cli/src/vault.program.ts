// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { program, Command } from "commander";

import { ConfirmCommand } from "./admin-console/commands/confirm.command";
import { ShareCommand } from "./admin-console/commands/share.command";
import { BaseProgram } from "./base-program";
import { EditCommand } from "./commands/edit.command";
import { GetCommand } from "./commands/get.command";
import { ListCommand } from "./commands/list.command";
import { RestoreCommand } from "./commands/restore.command";
import { Response } from "./models/response";
import { ExportCommand } from "./tools/export.command";
import { ImportCommand } from "./tools/import.command";
import { CliUtils } from "./utils";
import { CreateCommand } from "./vault/create.command";
import { DeleteCommand } from "./vault/delete.command";

const writeLn = CliUtils.writeLn;

export class VaultProgram extends BaseProgram {
  register() {
    program
      .addCommand(this.listCommand())
      .addCommand(this.getCommand())
      .addCommand(this.createCommand())
      .addCommand(this.editCommand())
      .addCommand(this.deleteCommand())
      .addCommand(this.restoreCommand())
      .addCommand(this.shareCommand("move", false))
      .addCommand(this.confirmCommand())
      .addCommand(this.importCommand())
      .addCommand(this.exportCommand())
      .addCommand(this.shareCommand("share", true));
  }

  private validateObject(requestedObject: string, validObjects: string[]): boolean {
    let success = true;
    if (!validObjects.includes(requestedObject)) {
      success = false;
      this.processResponse(
        Response.badRequest(
          'Unknown object "' +
            requestedObject +
            '". Allowed objects are ' +
            validObjects.join(", ") +
            ".",
        ),
      );
    }
    return success;
  }

  private listCommand(): Command {
    const listObjects = [
      "items",
      "folders",
      "collections",
      "org-collections",
      "org-members",
      "organizations",
    ];

    return new Command("list")
      .argument("<object>", "Valid objects are: " + listObjects.join(", "))
      .description("List an array of objects from the vault.")
      .option("--search <search>", "Perform a search on the listed objects.")
      .option("--url <url>", "Filter items of type login with a url-match search.")
      .option("--folderid <folderid>", "Filter items by folder id.")
      .option("--collectionid <collectionid>", "Filter items by collection id.")
      .option(
        "--organizationid <organizationid>",
        "Filter items or collections by organization id.",
      )
      .option("--trash", "Filter items that are deleted and in the trash.")
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn("    Combining search with a filter performs a logical AND operation.");
        writeLn("");
        writeLn("    Combining multiple filters performs a logical OR operation.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw list items");
        writeLn("    bw list items --folderid 60556c31-e649-4b5d-8daf-fc1c391a1bf2");
        writeLn(
          "    bw list items --search google --folderid 60556c31-e649-4b5d-8daf-fc1c391a1bf2",
        );
        writeLn("    bw list items --url https://google.com");
        writeLn("    bw list items --folderid null");
        writeLn("    bw list items --organizationid notnull");
        writeLn(
          "    bw list items --folderid 60556c31-e649-4b5d-8daf-fc1c391a1bf2 --organizationid notnull",
        );
        writeLn("    bw list items --trash");
        writeLn("    bw list folders --search email");
        writeLn("    bw list org-members --organizationid 60556c31-e649-4b5d-8daf-fc1c391a1bf2");
        writeLn("", true);
      })
      .action(async (object, cmd) => {
        if (!this.validateObject(object, listObjects)) {
          return;
        }

        await this.exitIfLocked();
        const command = new ListCommand(
          this.serviceContainer.cipherService,
          this.serviceContainer.folderService,
          this.serviceContainer.collectionService,
          this.serviceContainer.organizationService,
          this.serviceContainer.searchService,
          this.serviceContainer.organizationUserApiService,
          this.serviceContainer.apiService,
          this.serviceContainer.eventCollectionService,
          this.serviceContainer.accountService,
          this.serviceContainer.keyService,
          this.serviceContainer.cliRestrictedItemTypesService,
        );
        const response = await command.run(object, cmd);

        this.processResponse(response);
      });
  }

  private getCommand(): Command {
    const getObjects = [
      "item",
      "username",
      "password",
      "uri",
      "totp",
      "notes",
      "exposed",
      "attachment",
      "folder",
      "collection",
      "org-collection",
      "organization",
      "template",
      "fingerprint",
      "send",
    ];
    return new Command("get")
      .argument("<object>", "Valid objects are: " + getObjects.join(", "))
      .argument("<id>", "Search term or object's globally unique `id`.")
      .description("Get an object from the vault.")
      .option("--itemid <itemid>", "Attachment's item id.")
      .option("--output <output>", "Output directory or filename for attachment.")
      .option("--organizationid <organizationid>", "Organization id for an organization object.")
      .on("--help", () => {
        writeLn("\n  If raw output is specified and no output filename or directory is given for");
        writeLn("  an attachment query, the attachment content is written to stdout.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw get item 99ee88d2-6046-4ea7-92c2-acac464b1412");
        writeLn("    bw get password https://google.com");
        writeLn("    bw get totp google.com");
        writeLn("    bw get notes google.com");
        writeLn("    bw get exposed yahoo.com");
        writeLn(
          "    bw get attachment b857igwl1dzrs2 --itemid 99ee88d2-6046-4ea7-92c2-acac464b1412 " +
            "--output ./photo.jpg",
        );
        writeLn(
          "    bw get attachment photo.jpg --itemid 99ee88d2-6046-4ea7-92c2-acac464b1412 --raw",
        );
        writeLn("    bw get folder email");
        writeLn("    bw get template folder");
        writeLn("", true);
      })
      .action(async (object, id, cmd) => {
        if (!this.validateObject(object, getObjects)) {
          return;
        }

        await this.exitIfLocked();
        const command = new GetCommand(
          this.serviceContainer.cipherService,
          this.serviceContainer.folderService,
          this.serviceContainer.collectionService,
          this.serviceContainer.totpService,
          this.serviceContainer.auditService,
          this.serviceContainer.keyService,
          this.serviceContainer.encryptService,
          this.serviceContainer.searchService,
          this.serviceContainer.apiService,
          this.serviceContainer.organizationService,
          this.serviceContainer.eventCollectionService,
          this.serviceContainer.billingAccountProfileStateService,
          this.serviceContainer.accountService,
          this.serviceContainer.cliRestrictedItemTypesService,
        );
        const response = await command.run(object, id, cmd);
        this.processResponse(response);
      });
  }

  private createCommand() {
    const createObjects = ["item", "attachment", "folder", "org-collection"];
    return new Command("create")
      .argument("<object>", "Valid objects are: " + createObjects.join(", "))
      .argument(
        "[encodedJson]",
        "Encoded json of the object to create. Can also be piped into stdin.",
      )
      .description("Create an object in the vault.")
      .option("--file <file>", "Path to file for attachment.")
      .option("--itemid <itemid>", "Attachment's item id.")
      .option("--organizationid <organizationid>", "Organization id for an organization object.")
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn("    bw create folder eyJuYW1lIjoiTXkgRm9sZGVyIn0K");
        writeLn("    echo 'eyJuYW1lIjoiTXkgRm9sZGVyIn0K' | bw create folder");
        writeLn(
          "    bw create attachment --file ./myfile.csv " +
            "--itemid 16b15b89-65b3-4639-ad2a-95052a6d8f66",
        );
        writeLn("", true);
      })
      .action(async (object, encodedJson, cmd) => {
        if (!this.validateObject(object, createObjects)) {
          return;
        }

        await this.exitIfLocked();
        const command = new CreateCommand(
          this.serviceContainer.cipherService,
          this.serviceContainer.folderService,
          this.serviceContainer.keyService,
          this.serviceContainer.encryptService,
          this.serviceContainer.apiService,
          this.serviceContainer.folderApiService,
          this.serviceContainer.billingAccountProfileStateService,
          this.serviceContainer.organizationService,
          this.serviceContainer.accountService,
          this.serviceContainer.cliRestrictedItemTypesService,
        );
        const response = await command.run(object, encodedJson, cmd);
        this.processResponse(response);
      });
  }

  private editCommand(): Command {
    const editObjects = ["item", "item-collections", "folder", "org-collection"];
    return new Command("edit")
      .argument("<object>", "Valid objects are: " + editObjects.join(", "))
      .argument("<id>", "Object's globally unique `id`.")
      .argument(
        "[encodedJson]",
        "Encoded json of the object to create. Can also be piped into stdin.",
      )
      .description("Edit an object from the vault.")
      .option("--organizationid <organizationid>", "Organization id for an organization object.")
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn(
          "    bw edit folder 5cdfbd80-d99f-409b-915b-f4c5d0241b02 eyJuYW1lIjoiTXkgRm9sZGVyMiJ9Cg==",
        );
        writeLn(
          "    echo 'eyJuYW1lIjoiTXkgRm9sZGVyMiJ9Cg==' | " +
            "bw edit folder 5cdfbd80-d99f-409b-915b-f4c5d0241b02",
        );
        writeLn(
          "    bw edit item-collections 78307355-fd25-416b-88b8-b33fd0e88c82 " +
            "WyI5NzQwNTNkMC0zYjMzLTRiOTgtODg2ZS1mZWNmNWM4ZGJhOTYiXQ==",
        );
        writeLn("", true);
      })
      .action(async (object, id, encodedJson, cmd) => {
        if (!this.validateObject(object, editObjects)) {
          return;
        }

        await this.exitIfLocked();
        const command = new EditCommand(
          this.serviceContainer.cipherService,
          this.serviceContainer.folderService,
          this.serviceContainer.keyService,
          this.serviceContainer.encryptService,
          this.serviceContainer.apiService,
          this.serviceContainer.folderApiService,
          this.serviceContainer.accountService,
          this.serviceContainer.cliRestrictedItemTypesService,
          this.serviceContainer.policyService,
        );
        const response = await command.run(object, id, encodedJson, cmd);
        this.processResponse(response);
      });
  }

  private deleteCommand(): Command {
    const deleteObjects = ["item", "attachment", "folder", "org-collection"];
    return new Command("delete")
      .argument("<object>", "Valid objects are: " + deleteObjects.join(", "))
      .argument("<id>", "Object's globally unique `id`.")
      .description("Delete an object from the vault.")
      .option("--itemid <itemid>", "Attachment's item id.")
      .option("--organizationid <organizationid>", "Organization id for an organization object.")
      .option(
        "-p, --permanent",
        "Permanently deletes the item instead of soft-deleting it (item only).",
      )
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn("    bw delete item 7063feab-4b10-472e-b64c-785e2b870b92");
        writeLn("    bw delete item 89c21cd2-fab0-4f69-8c6e-ab8a0168f69a --permanent");
        writeLn("    bw delete folder 5cdfbd80-d99f-409b-915b-f4c5d0241b02");
        writeLn(
          "    bw delete attachment b857igwl1dzrs2 --itemid 310d5ffd-e9a2-4451-af87-ea054dce0f78",
        );
        writeLn("", true);
      })
      .action(async (object, id, cmd) => {
        if (!this.validateObject(object, deleteObjects)) {
          return;
        }

        await this.exitIfLocked();
        const command = new DeleteCommand(
          this.serviceContainer.cipherService,
          this.serviceContainer.folderService,
          this.serviceContainer.apiService,
          this.serviceContainer.folderApiService,
          this.serviceContainer.billingAccountProfileStateService,
          this.serviceContainer.cipherAuthorizationService,
          this.serviceContainer.accountService,
          this.serviceContainer.cliRestrictedItemTypesService,
        );
        const response = await command.run(object, id, cmd);
        this.processResponse(response);
      });
  }

  private restoreCommand(): Command {
    const restoreObjects = ["item"];
    return new Command("restore")
      .argument("<object>", "Valid objects are: " + restoreObjects.join(", "))
      .argument("<id>", "Object's globally unique `id`.")
      .description("Restores an object from the trash.")
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn("    bw restore item 7063feab-4b10-472e-b64c-785e2b870b92");
        writeLn("", true);
      })
      .action(async (object, id, cmd) => {
        if (!this.validateObject(object, restoreObjects)) {
          return;
        }

        await this.exitIfLocked();
        const command = new RestoreCommand(
          this.serviceContainer.cipherService,
          this.serviceContainer.accountService,
          this.serviceContainer.cipherAuthorizationService,
        );
        const response = await command.run(object, id);
        this.processResponse(response);
      });
  }

  private shareCommand(commandName: string, deprecated: boolean): Command {
    return new Command(commandName)
      .argument("<id>", "Object's globally unique `id`.")
      .argument("<organizationId>", "Organization's globally unique `id`.")
      .argument(
        "[encodedJson]",
        "Encoded json of an array of collection ids. Can also be piped into stdin.",
      )
      .description((deprecated ? "--DEPRECATED-- " : "") + "Move an item to an organization.")
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn(
          "    bw " +
            commandName +
            " 4af958ce-96a7-45d9-beed-1e70fabaa27a " +
            "6d82949b-b44d-468a-adae-3f3bacb0ea32 WyI5NzQwNTNkMC0zYjMzLTRiOTgtODg2ZS1mZWNmNWM4ZGJhOTYiXQ==",
        );
        writeLn(
          "    echo '[\"974053d0-3b33-4b98-886e-fecf5c8dba96\"]' | bw encode | " +
            "bw " +
            commandName +
            " 4af958ce-96a7-45d9-beed-1e70fabaa27a 6d82949b-b44d-468a-adae-3f3bacb0ea32",
        );
        if (deprecated) {
          writeLn("");
          writeLn('--DEPRECATED See "bw move" for the current implementation--');
        }
        writeLn("", true);
      })
      .action(async (id, organizationId, encodedJson, cmd) => {
        await this.exitIfLocked();
        const command = new ShareCommand(
          this.serviceContainer.cipherService,
          this.serviceContainer.accountService,
        );
        const response = await command.run(id, organizationId, encodedJson);
        this.processResponse(response);
      });
  }

  private confirmCommand(): Command {
    const confirmObjects = ["org-member"];
    return new Command("confirm")
      .argument("<object>", "Valid objects are: " + confirmObjects.join(", "))
      .argument("<id>", "Object's globally unique `id`.")
      .description("Confirm an object to the organization.")
      .option("--organizationid <organizationid>", "Organization id for an organization object.")
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn(
          "    bw confirm org-member 7063feab-4b10-472e-b64c-785e2b870b92 " +
            "--organizationid 310d5ffd-e9a2-4451-af87-ea054dce0f78",
        );
        writeLn("", true);
      })
      .action(async (object, id, cmd) => {
        if (!this.validateObject(object, confirmObjects)) {
          return;
        }

        await this.exitIfLocked();
        const command = new ConfirmCommand(
          this.serviceContainer.apiService,
          this.serviceContainer.keyService,
          this.serviceContainer.encryptService,
          this.serviceContainer.organizationUserApiService,
          this.serviceContainer.configService,
          this.serviceContainer.i18nService,
        );
        const response = await command.run(object, id, cmd);
        this.processResponse(response);
      });
  }

  private importCommand(): Command {
    return new Command("import")
      .argument("[format]", "The format of [input]")
      .argument("[input]", "Filepath to data to import")
      .description("Import vault data from a file.")
      .option("--formats", "List formats")
      .option("--organizationid <organizationid>", "ID of the organization to import to.")
      .on("--help", () => {
        writeLn("\n Examples:");
        writeLn("");
        writeLn("    bw import --formats");
        writeLn("    bw import bitwardencsv ./from/source.csv");
        writeLn("    bw import keepass2xml keepass_backup.xml");
        writeLn(
          "    bw import --organizationid cf14adc3-aca5-4573-890a-f6fa231436d9 keepass2xml keepass_backup.xml",
        );
      })
      .action(async (format, filepath, options) => {
        await this.exitIfLocked();
        const command = new ImportCommand(
          this.serviceContainer.importService,
          this.serviceContainer.organizationService,
          this.serviceContainer.syncService,
          this.serviceContainer.accountService,
        );
        const response = await command.run(format, filepath, options);
        this.processResponse(response);
      });
  }

  private exportCommand(): Command {
    return new Command("export")
      .description("Export vault data to a CSV, JSON or ZIP file.")
      .option("--output <output>", "Output directory or filename.")
      .option("--format <format>", "Export file format.")
      .option(
        "--password [password]",
        "Use password to encrypt instead of your Bitwarden account encryption key. Only applies to the encrypted_json format.",
      )
      .option("--organizationid <organizationid>", "Organization id for an organization.")
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn(
          "    Valid formats are `csv`, `json`, `encrypted_json` and zip. Default format is `csv`.",
        );
        writeLn("");
        writeLn(
          "    If --raw option is specified and no output filename or directory is given, the",
        );
        writeLn("    result is written to stdout.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw export");
        writeLn("    bw --raw export");
        writeLn("    bw export myPassword321");
        writeLn("    bw export myPassword321 --format json");
        writeLn("    bw export --output ./exp/bw.csv");
        writeLn("    bw export myPassword321 --output bw.json --format json");
        writeLn(
          "    bw export myPassword321 --organizationid 7063feab-4b10-472e-b64c-785e2b870b92",
        );
        writeLn("", true);
      })
      .action(async (options) => {
        await this.exitIfLocked();
        const command = new ExportCommand(
          this.serviceContainer.exportService,
          this.serviceContainer.policyService,
          this.serviceContainer.eventCollectionService,
          this.serviceContainer.accountService,
        );
        const response = await command.run(options);
        this.processResponse(response);
      });
  }
}
