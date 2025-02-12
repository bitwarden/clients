// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OptionValues } from "commander";
import * as inquirer from "inquirer";
import { firstValueFrom } from "rxjs";

import {
  OrganizationService,
  getOrganizationById,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ImportServiceAbstraction, ImportType } from "@bitwarden/importer-core";

import { Response } from "../models/response";
import { MessageResponse } from "../models/response/message.response";
import { CliUtils } from "../utils";

export class ImportCommand {
  constructor(
    private importService: ImportServiceAbstraction,
    private organizationService: OrganizationService,
    private syncService: SyncService,
    private accountService: AccountService,
  ) {}

  async run(format: ImportType, filepath: string, options: OptionValues): Promise<Response> {
    const organizationId = options.organizationid;
    if (organizationId != null) {
      const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
      if (!userId) {
        return Response.badRequest("No user found.");
      }
      const organization = await firstValueFrom(
        this.organizationService.organizations$(userId).pipe(getOrganizationById(organizationId)),
      );

      if (organization == null) {
        return Response.badRequest(
          `You do not belong to an organization with the ID of ${organizationId}. Check the organization ID and sync your vault.`,
        );
      }

      if (!organization.canAccessImport) {
        return Response.badRequest(
          "You are not authorized to import into the provided organization.",
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
      organizationId,
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
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
