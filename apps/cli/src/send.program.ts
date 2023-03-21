import * as fs from "fs";
import * as path from "path";

import * as chalk from "chalk";
import * as program from "commander";

import { SendType } from "@bitwarden/common/enums/sendType";
import { Utils } from "@bitwarden/common/misc/utils";

import { Main } from "./bw";
import { GetCommand } from "./commands/get.command";
import { SendCreateCommand } from "./commands/send/create.command";
import { SendDeleteCommand } from "./commands/send/delete.command";
import { SendEditCommand } from "./commands/send/edit.command";
import { SendGetCommand } from "./commands/send/get.command";
import { SendListCommand } from "./commands/send/list.command";
import { SendReceiveCommand } from "./commands/send/receive.command";
import { SendRemovePasswordCommand } from "./commands/send/remove-password.command";
import { Response } from "./models/response";
import { SendFileResponse } from "./models/response/send-file.response";
import { SendTextResponse } from "./models/response/send-text.response";
import { SendResponse } from "./models/response/send.response";
import { Program } from "./program";
import { CliUtils } from "./utils";

const writeLn = CliUtils.writeLn;

export class SendProgram extends Program {
  constructor(main: Main) {
    super(main);
  }

  async register() {
    program.addCommand(this.sendCommand());
    // receive is accessible both at `bw receive` and `bw send receive`
    program.addCommand(this.receiveCommand());
  }

  private sendCommand(): program.Command {
    return new program.Command("send")
      .arguments("<data>")
      .description(
        "Work with Bitwarden sends. A Send can be quickly created using this command or subcommands can be used to fine-tune the Send",
        {
          data: "The data to Send. Specify as a filepath with the --file option",
        }
      )
      .option("-f, --file", "Specifies that <data> is a filepath")
      .option(
        "-d, --deleteInDays <days>",
        "The number of days in the future to set deletion date, defaults to 7",
        "7"
      )
      .option("-a, --maxAccessCount <amount>", "The amount of max possible accesses.")
      .option("--hidden", "Hide <data> in web by default. Valid only if --file is not set.")
      .option(
        "-n, --name <name>",
        "The name of the Send. Defaults to a guid for text Sends and the filename for files."
      )
      .option("--notes <notes>", "Notes to add to the Send.")
      .option(
        "--fullObject",
        "Specifies that the full Send object should be returned rather than just the access url."
      )
      .addCommand(this.listCommand())
      .addCommand(this.templateCommand())
      .addCommand(this.getCommand())
      .addCommand(this.receiveCommand())
      .addCommand(this.createCommand())
      .addCommand(this.editCommand())
      .addCommand(this.removePasswordCommand())
      .addCommand(this.deleteCommand())
      .action(async (data: string, options: program.OptionValues) => {
        const encodedJson = this.makeSendJson(data, options);

        let response: Response;
        if (encodedJson instanceof Response) {
          response = encodedJson;
        } else {
          response = await this.runCreate(encodedJson, options);
        }

        this.processResponse(response);
      });
  }

  private receiveCommand(): program.Command {
    return new program.Command("receive")
      .arguments("<url>")
      .description("Access a Bitwarden Send from a url")
      .option("--password <password>", "Password needed to access the Send.")
      .option("--passwordenv <passwordenv>", "Environment variable storing the Send's password")
      .option(
        "--passwordfile <passwordfile>",
        "Path to a file containing the Sends password as its first line"
      )
      .option("--obj", "Return the Send's json object rather than the Send's content")
      .option("--output <location>", "Specify a file path to save a File-type Send to")
      .on("--help", () => {
        writeLn("");
        writeLn(
          "If a password is required, the provided password is used or the user is prompted."
        );
        writeLn("", true);
      })
      .action(async (url: string, options: program.OptionValues) => {
        const cmd = new SendReceiveCommand(
          this.main.apiService,
          this.main.cryptoService,
          this.main.cryptoFunctionService,
          this.main.platformUtilsService,
          this.main.environmentService
        );
        const response = await cmd.run(url, options);
        this.processResponse(response);
      });
  }

  private listCommand(): program.Command {
    return new program.Command("list")

      .description("List all the Sends owned by you")
      .on("--help", () => {
        writeLn(chalk("This is in the list command"));
      })
      .action(async (options: program.OptionValues) => {
        await this.exitIfLocked();
        const cmd = new SendListCommand(
          this.main.sendService,
          this.main.environmentService,
          this.main.searchService
        );
        const response = await cmd.run(options);
        this.processResponse(response);
      });
  }

  private templateCommand(): program.Command {
    return new program.Command("template")
      .arguments("<object>")
      .description("Get json templates for send objects", {
        object: "Valid objects are: send.text, send.file",
      })
      .action(async (object) => {
        const cmd = new GetCommand(
          this.main.cipherService,
          this.main.folderService,
          this.main.collectionService,
          this.main.totpService,
          this.main.auditService,
          this.main.cryptoService,
          this.main.stateService,
          this.main.searchService,
          this.main.apiService,
          this.main.organizationService
        );
        const response = await cmd.run("template", object, null);
        this.processResponse(response);
      });
  }

  private getCommand(): program.Command {
    return new program.Command("get")
      .arguments("<id>")
      .description("Get Sends owned by you.")
      .option("--output <output>", "Output directory or filename for attachment.")
      .option("--text", "Specifies to return the text content of a Send")
      .on("--help", () => {
        writeLn("");
        writeLn("  Id:");
        writeLn("");
        writeLn("    Search term or Send's globally unique `id`.");
        writeLn("");
        writeLn("    If raw output is specified and no output filename or directory is given for");
        writeLn("    an attachment query, the attachment content is written to stdout.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw send get searchText");
        writeLn("    bw send get id");
        writeLn("    bw send get searchText --text");
        writeLn("    bw send get searchText --file");
        writeLn("    bw send get searchText --file --output ../Photos/photo.jpg");
        writeLn("    bw send get searchText --file --raw");
        writeLn("", true);
      })
      .action(async (id: string, options: program.OptionValues) => {
        await this.exitIfLocked();
        const cmd = new SendGetCommand(
          this.main.sendService,
          this.main.environmentService,
          this.main.searchService,
          this.main.cryptoService
        );
        const response = await cmd.run(id, options);
        this.processResponse(response);
      });
  }

  private createCommand(): program.Command {
    return new program.Command("create")
      .arguments("[encodedJson]")
      .description("create a Send", {
        encodedJson: "JSON object to upload. Can also be piped in through stdin.",
      })
      .option("--file <path>", "file to Send. Can also be specified in parent's JSON.")
      .option("--text <text>", "text to Send. Can also be specified in parent's JSON.")
      .option("--hidden", "text hidden flag. Valid only with the --text option.")
      .option(
        "--password <password>",
        "optional password to access this Send. Can also be specified in JSON"
      )
      .on("--help", () => {
        writeLn("");
        writeLn("Note:");
        writeLn("  Options specified in JSON take precedence over command options");
        writeLn("", true);
      })
      .action(
        async (
          encodedJson: string,
          options: program.OptionValues,
          args: { parent: program.Command }
        ) => {
          // Work-around to support `--fullObject` option for `send create --fullObject`
          // Calling `option('--fullObject', ...)` above won't work due to Commander doesn't like same option
          // to be defind on both parent-command and sub-command
          const { fullObject = false } = args.parent.opts();
          const mergedOptions = {
            ...options,
            fullObject: fullObject,
          };

          const response = await this.runCreate(encodedJson, mergedOptions);
          this.processResponse(response);
        }
      );
  }

  private editCommand(): program.Command {
    return new program.Command("edit")
      .arguments("[encodedJson]")
      .description("edit a Send", {
        encodedJson:
          "Updated JSON object to save. If not provided, encodedJson is read from stdin.",
      })
      .option("--itemid <itemid>", "Overrides the itemId provided in [encodedJson]")
      .on("--help", () => {
        writeLn("");
        writeLn("Note:");
        writeLn("  You cannot update a File-type Send's file. Just delete and remake it");
        writeLn("", true);
      })
      .action(async (encodedJson: string, options: program.OptionValues) => {
        await this.exitIfLocked();
        const getCmd = new SendGetCommand(
          this.main.sendService,
          this.main.environmentService,
          this.main.searchService,
          this.main.cryptoService
        );
        const cmd = new SendEditCommand(this.main.sendService, this.main.stateService, getCmd);
        const response = await cmd.run(encodedJson, options);
        this.processResponse(response);
      });
  }

  private deleteCommand(): program.Command {
    return new program.Command("delete")
      .arguments("<id>")
      .description("delete a Send", {
        id: "The id of the Send to delete.",
      })
      .action(async (id: string) => {
        await this.exitIfLocked();
        const cmd = new SendDeleteCommand(this.main.sendService);
        const response = await cmd.run(id);
        this.processResponse(response);
      });
  }

  private removePasswordCommand(): program.Command {
    return new program.Command("remove-password")
      .arguments("<id>")
      .description("removes the saved password from a Send.", {
        id: "The id of the Send to alter.",
      })
      .action(async (id: string) => {
        await this.exitIfLocked();
        const cmd = new SendRemovePasswordCommand(this.main.sendService);
        const response = await cmd.run(id);
        this.processResponse(response);
      });
  }

  private makeSendJson(data: string, options: program.OptionValues) {
    let sendFile = null;
    let sendText = null;
    let name = Utils.newGuid() as string;
    let type = SendType.Text;
    if (options.file != null) {
      data = path.resolve(data);
      if (!fs.existsSync(data)) {
        return Response.badRequest("data path does not exist");
      }

      sendFile = SendFileResponse.template(data);
      name = path.basename(data);
      type = SendType.File;
    } else {
      sendText = SendTextResponse.template(data, options.hidden);
    }

    const template = Utils.assign(SendResponse.template(null, options.deleteInDays), {
      name: options.name ?? name,
      notes: options.notes,
      file: sendFile,
      text: sendText,
      type: type,
    });

    return Buffer.from(JSON.stringify(template), "utf8").toString("base64");
  }

  private async runCreate(encodedJson: string, options: program.OptionValues) {
    await this.exitIfLocked();
    const cmd = new SendCreateCommand(
      this.main.sendService,
      this.main.stateService,
      this.main.environmentService
    );
    return await cmd.run(encodedJson, options);
  }
}
