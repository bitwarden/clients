// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as fs from "fs";
import * as path from "path";

import * as chalk from "chalk";
import { program, Command, Option, OptionValues } from "commander";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";

import { BaseProgram } from "../../base-program";
import { Response } from "../../models/response";
import { CliUtils } from "../../utils";

import {
  SendCreateCommand,
  SendDeleteCommand,
  SendEditCommand,
  SendGetCommand,
  SendListCommand,
  SendReceiveCommand,
  SendRemovePasswordCommand,
  SendTemplateCommand,
} from "./commands";
import { SendFileResponse } from "./models/send-file.response";
import { SendTextResponse } from "./models/send-text.response";
import { SendResponse } from "./models/send.response";
import { parseEmail } from "./util";

const writeLn = CliUtils.writeLn;

export class SendProgram extends BaseProgram {
  register() {
    program.addCommand(this.sendCommand());
    // receive is accessible both at `bw receive` and `bw send receive`
    program.addCommand(this.receiveCommand());
  }

  private sendCommand(): Command {
    return new Command("send")
      .argument("<data>", "The data to Send. Specify as a filepath with the --file option")
      .description(
        "Work with Bitwarden sends. A Send can be quickly created using this command or subcommands can be used to fine-tune the Send",
      )
      .option("-f, --file", "Specifies that <data> is a filepath")
      .option(
        "-d, --deleteInDays <days>",
        "The number of days in the future to set deletion date, defaults to 7",
        "7",
      )
      .addOption(
        new Option(
          "--password <password>",
          "optional password to access this Send. Can also be specified in JSON.",
        ).conflicts("email"),
      )
      .addOption(
        new Option(
          "--email <email>",
          "optional emails to access this Send. Can also be specified in JSON.",
        )
          .argParser(parseEmail)
          .hideHelp(),
      )
      .option("-a, --maxAccessCount <amount>", "The amount of max possible accesses.")
      .option("--hidden", "Hide <data> in web by default. Valid only if --file is not set.")
      .option(
        "-n, --name <name>",
        "The name of the Send. Defaults to a guid for text Sends and the filename for files.",
      )
      .option("--notes <notes>", "Notes to add to the Send.")
      .option(
        "--fullObject",
        "Specifies that the full Send object should be returned rather than just the access url.",
      )
      .addCommand(this.listCommand())
      .addCommand(this.templateCommand())
      .addCommand(this.getCommand())
      .addCommand(this.receiveCommand())
      .addCommand(this.createCommand())
      .addCommand(this.editCommand())
      .addCommand(this.removePasswordCommand())
      .addCommand(this.deleteCommand())
      .action(async (data: string, options: OptionValues) => {
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

  private receiveCommand(): Command {
    return new Command("receive")
      .arguments("<url>")
      .description("Access a Bitwarden Send from a url")
      .option("--password <password>", "Password needed to access the Send.")
      .option("--passwordenv <passwordenv>", "Environment variable storing the Send's password")
      .option(
        "--passwordfile <passwordfile>",
        "Path to a file containing the Sends password as its first line",
      )
      .option("--obj", "Return the Send's json object rather than the Send's content")
      .option("--output <location>", "Specify a file path to save a File-type Send to")
      .on("--help", () => {
        writeLn("");
        writeLn(
          "If a password is required, the provided password is used or the user is prompted.",
        );
        writeLn("", true);
      })
      .action(async (url: string, options: OptionValues) => {
        const cmd = new SendReceiveCommand(
          this.serviceContainer.keyService,
          this.serviceContainer.encryptService,
          this.serviceContainer.cryptoFunctionService,
          this.serviceContainer.platformUtilsService,
          this.serviceContainer.environmentService,
          this.serviceContainer.sendApiService,
          this.serviceContainer.accountService,
          this.serviceContainer.apiService,
        );
        const response = await cmd.run(url, options);
        this.processResponse(response);
      });
  }

  private listCommand(): Command {
    return new Command("list")

      .description("List all the Sends owned by you")
      .on("--help", () => {
        writeLn(chalk("This is in the list command"));
      })
      .action(async (options: OptionValues) => {
        await this.exitIfLocked();
        const cmd = new SendListCommand(
          this.serviceContainer.sendService,
          this.serviceContainer.environmentService,
          this.serviceContainer.searchService,
          this.serviceContainer.accountService,
        );
        const response = await cmd.run(options);
        this.processResponse(response);
      });
  }

  private templateCommand(): Command {
    return new Command("template")
      .argument("<object>", "Valid objects are: send.text, text, send.file, file")
      .description("Get json templates for send objects")
      .action((object: string) => {
        this.processResponse(new SendTemplateCommand().run(object));
      });
  }

  private getCommand(): Command {
    return new Command("get")
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
      .action(async (id: string, options: OptionValues) => {
        await this.exitIfLocked();
        const cmd = new SendGetCommand(
          this.serviceContainer.sendService,
          this.serviceContainer.environmentService,
          this.serviceContainer.searchService,
          this.serviceContainer.encryptService,
          this.serviceContainer.apiService,
          this.serviceContainer.accountService,
        );
        const response = await cmd.run(id, options);
        this.processResponse(response);
      });
  }

  private createCommand(): Command {
    return new Command("create")
      .argument("[encodedJson]", "JSON object to upload. Can also be piped in through stdin.")
      .description("create a Send")
      .option("--file <path>", "file to Send. Can also be specified in parent's JSON.")
      .option("--text <text>", "text to Send. Can also be specified in parent's JSON.")
      .option("--hidden", "text hidden flag. Valid only with the --text option.")
      .on("--help", () => {
        writeLn("");
        writeLn("Note:");
        writeLn("  Options specified in JSON take precedence over command options");
        writeLn("", true);
      })
      .action(async (encodedJson: string, options: OptionValues, args: { parent: Command }) => {
        // subcommands inherit flags from their parent; they cannot override them
        const { fullObject = false, email = undefined, password = undefined } = args.parent.opts();
        const mergedOptions = {
          ...options,
          fullObject: fullObject,
          email,
          password,
        };

        const response = await this.runCreate(encodedJson, mergedOptions);
        this.processResponse(response);
      });
  }

  private editCommand(): Command {
    return new Command("edit")
      .argument(
        "[encodedJson]",
        "Updated JSON object to save. If not provided, encodedJson is read from stdin.",
      )
      .description("edit a Send")
      .option("--itemid <itemid>", "Overrides the itemId provided in [encodedJson]")
      .on("--help", () => {
        writeLn("");
        writeLn("Note:");
        writeLn("  You cannot update a File-type Send's file. Just delete and remake it");
        writeLn("", true);
      })
      .action(async (encodedJson: string, options: OptionValues, args: { parent: Command }) => {
        await this.exitIfLocked();
        const getCmd = new SendGetCommand(
          this.serviceContainer.sendService,
          this.serviceContainer.environmentService,
          this.serviceContainer.searchService,
          this.serviceContainer.encryptService,
          this.serviceContainer.apiService,
          this.serviceContainer.accountService,
        );
        const cmd = new SendEditCommand(
          this.serviceContainer.sendService,
          getCmd,
          this.serviceContainer.sendApiService,
          this.serviceContainer.billingAccountProfileStateService,
          this.serviceContainer.accountService,
        );

        // subcommands inherit flags from their parent; they cannot override them
        const { email = undefined, password = undefined } = args.parent.opts();
        const mergedOptions = {
          ...options,
          email,
          password,
        };

        const response = await cmd.run(encodedJson, mergedOptions);
        this.processResponse(response);
      });
  }

  private deleteCommand(): Command {
    return new Command("delete")
      .argument("<id>", "The id of the Send to delete.")
      .description("delete a Send")
      .action(async (id: string) => {
        await this.exitIfLocked();
        const cmd = new SendDeleteCommand(
          this.serviceContainer.sendService,
          this.serviceContainer.sendApiService,
        );
        const response = await cmd.run(id);
        this.processResponse(response);
      });
  }

  private removePasswordCommand(): Command {
    return new Command("remove-password")
      .argument("<id>", "The id of the Send to alter.")
      .description("removes the saved password from a Send.")
      .action(async (id: string) => {
        await this.exitIfLocked();
        const cmd = new SendRemovePasswordCommand(
          this.serviceContainer.sendService,
          this.serviceContainer.sendApiService,
          this.serviceContainer.environmentService,
          this.serviceContainer.accountService,
        );
        const response = await cmd.run(id);
        this.processResponse(response);
      });
  }

  private makeSendJson(data: string, options: OptionValues) {
    let sendFile = null;
    let sendText = null;
    let name = Utils.newGuid();
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

  private async runCreate(encodedJson: string, options: OptionValues) {
    await this.exitIfLocked();
    const cmd = new SendCreateCommand(
      this.serviceContainer.sendService,
      this.serviceContainer.environmentService,
      this.serviceContainer.sendApiService,
      this.serviceContainer.billingAccountProfileStateService,
      this.serviceContainer.accountService,
    );
    return await cmd.run(encodedJson, options);
  }
}
