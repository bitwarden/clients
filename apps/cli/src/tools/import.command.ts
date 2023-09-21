import * as program from "commander";
import * as inquirer from "inquirer";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ImportServiceAbstraction, ImportType } from "@bitwarden/importer";

import { Response } from "../models/response";
import { MessageResponse } from "../models/response/message.response";
import { CliUtils } from "../utils";

export class ImportCommand {
  constructor(
    private importService: ImportServiceAbstraction,
    private organizationService: OrganizationService,
    private syncService: SyncService
  ) {}

  async run(
    format: ImportType,
    filepath: string,
    options: program.OptionValues
  ): Promise<Response> {
    const organizationId = options.organizationid;
    if (organizationId != null) {
      const organization = await this.organizationService.getFromState(organizationId);

      if (organization == null) {
        return Response.badRequest(
          `You do not belong to an organization with the ID of ${organizationId}. Check the organization ID and sync your vault.`
        );
      }

      if (!organization.canAccessImportExport) {
        return Response.badRequest(
          "You are not authorized to import into the provided organization."
        );
      }
    }

    if (options.formats || false) {
      return await this.list();
    } else {
      return await this.import(format, filepath, organizationId);
    }
  }

  private async import(format: ImportType, filepath: string, organizationId: string) {
    if (format == null) {
      return Response.badRequest("`format` was not provided.");
    }
    if (filepath == null || filepath === "") {
      return Response.badRequest("`filepath` was not provided.");
    }
    const promptForPassword_callback = async () => {
      return await this.promptPassword();
    };
    const importer = await this.importService.getImporter(
      format,
      promptForPassword_callback,
      organizationId
    );
    if (importer === null) {
      return Response.badRequest("Proper importer type required.");
    }

    try {
      let contents;
      if (format === "1password1pux" && filepath.endsWith(".1pux")) {
        contents = await CliUtils.extractZipContent(filepath, "export.data");
      } else if (format === "protonpass" && filepath.endsWith(".zip")) {
        contents = await CliUtils.extractZipContent(filepath, "Proton Pass/data.json");
      } else {
        contents = await CliUtils.readFile(filepath);
      }

      if (contents === null || contents === "") {
        return Response.badRequest("Import file was empty.");
      }

      const response = await this.importService.import(importer, contents, organizationId);
      if (response.success) {
        this.syncService.fullSync(true);
        return Response.success(new MessageResponse("Imported " + filepath, null));
      }
    } catch (err) {
      if (err.message) {
        return Response.badRequest(err.message);
      }
      return Response.badRequest(err);
    }
  }

  private async list() {
    const options = this.importService
      .getImportOptions()
      .sort((a, b) => {
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      })
      .map((option) => option.id)
      .join("\n");
    const res = new MessageResponse("Supported input formats:", options);
    res.raw = options;
    return Response.success(res);
  }

  private async promptPassword() {
    const answer: inquirer.Answers = await inquirer.createPromptModule({
      output: process.stderr,
    })({
      type: "password",
      name: "password",
      message: "Import file password:",
    });
    return answer.password;
  }
}
