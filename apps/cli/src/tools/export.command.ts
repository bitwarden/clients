// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OptionValues } from "commander";
import * as inquirer from "inquirer";
import { firstValueFrom, switchMap } from "rxjs";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventType } from "@bitwarden/common/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { LogService } from "@bitwarden/logging";
import {
  ExportFormat,
  EXPORT_FORMATS,
  VaultExportServiceAbstraction,
  ExportedVault,
  ExportedVaultAsBlob,
} from "@bitwarden/vault-export-core";

import { Response } from "../models/response";
import { CliUtils } from "../utils";

export class ExportCommand {
  constructor(
    private exportService: VaultExportServiceAbstraction,
    private policyService: PolicyService,
    private eventCollectionService: EventCollectionService,
    private accountService: AccountService,
    private logService: LogService,
  ) {}

  async run(options: OptionValues): Promise<Response> {
    const policyApplies$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policyAppliesToUser$(PolicyType.DisablePersonalVaultExport, userId),
      ),
    );

    if (options.organizationid == null && (await firstValueFrom(policyApplies$))) {
      return Response.badRequest(
        "One or more organization policies prevents you from exporting your personal vault.",
      );
    }

    let password = options.password;

    // has password and format is 'json' => should have the same behaviour as 'encrypted_json'
    // format is 'undefined' => Defaults to 'csv'
    // Any other case => returns the options.format
    const format =
      password && options.format == "json" ? "encrypted_json" : (options.format ?? "csv");

    if (!this.isSupportedExportFormat(format)) {
      return Response.badRequest(
        `'${format}' is not a supported export format. Supported formats: ${EXPORT_FORMATS.join(
          ", ",
        )}.`,
      );
    }

    if (options.organizationid != null && !Utils.isGuid(options.organizationid)) {
      return Response.error("`" + options.organizationid + "` is not a GUID.");
    }

    let exportContent: ExportedVault = null;
    try {
      if (format === "encrypted_json") {
        const normalizedOptions = new Options(options);
        const passwordResult = await CliUtils.getPassword(
          password,
          normalizedOptions,
          this.logService,
        );

        if (passwordResult instanceof Response) {
          return passwordResult;
        } else {
          password = passwordResult;
        }
      }

      exportContent =
        options.organizationid == null
          ? await this.exportService.getExport(format, password)
          : await this.exportService.getOrganizationExport(
              options.organizationid,
              format,
              password,
            );

      const eventType = options.organizationid
        ? EventType.Organization_ClientExportedVault
        : EventType.User_ClientExportedVault;
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(eventType, null, true, options.organizationid);
    } catch (e) {
      return Response.error(e);
    }
    return await this.saveFile(exportContent, options);
  }

  private async saveFile(exportContent: ExportedVault, options: OptionValues): Promise<Response> {
    try {
      if (exportContent.type === "application/zip") {
        exportContent = exportContent as ExportedVaultAsBlob;
        const arrayBuffer = await exportContent.data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return await CliUtils.saveResultToFile(buffer, options.output, exportContent.fileName);
      }

      return await CliUtils.saveResultToFile(
        exportContent.data,
        options.output,
        exportContent.fileName,
      );
    } catch (e) {
      return Response.error(e.toString());
    }
  }

  private async promptPassword(password: string | boolean) {
    // boolean => flag set with no value, we need to prompt for password
    // string => flag set with value, use this value for password
    // undefined/null/false => account protect, not password, no password needed
    if (typeof password === "string") {
      return password;
    } else if (password) {
      const answer: inquirer.Answers = await inquirer.createPromptModule({
        output: process.stderr,
      })({
        type: "password",
        name: "password",
        message: "Export file password:",
      });
      return answer.password as string;
    }
    return null;
  }

  private isSupportedExportFormat(format: string): format is ExportFormat {
    return EXPORT_FORMATS.includes(format as ExportFormat);
  }
}

class Options {
  passwordEnv: string;
  passwordFile: string;

  constructor(passedOptions: Record<string, any>) {
    this.passwordEnv = passedOptions?.passwordenv || passedOptions?.passwordEnv;
    this.passwordFile = passedOptions?.passwordfile || passedOptions?.passwordFile;
  }
}
