// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OptionValues } from "commander";
import { firstValueFrom } from "rxjs";

import {
  OrganizationService,
  getOrganizationById,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import {
  CredentialKind,
  ImportServiceAbstraction,
  ImportType,
  SdkImportCredentials,
} from "@bitwarden/importer-core";

import { Response } from "../models/response";
import { MessageResponse } from "../models/response/message.response";
import { CliUtils } from "../utils";

export class ImportCommand {
  constructor(
    private importService: ImportServiceAbstraction,
    private organizationService: OrganizationService,
    private syncService: SyncService,
    private accountService: AccountService,
    private logService: LogService,
    private i18nService: I18nService,
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
      return await this.import(format, filepath, organizationId, options);
    }
  }

  private async import(
    format: ImportType,
    filepath: string,
    organizationId: string,
    options: OptionValues,
  ) {
    if (format == null) {
      return Response.badRequest("`format` was not provided.");
    }
    if (filepath == null || filepath === "") {
      return Response.badRequest("`filepath` was not provided.");
    }

    // SDK-backed importers parse/encrypt/submit entirely in the SDK.
    if (this.importService.isSdkImporter(format)) {
      return await this.importWithSdk(format, filepath, organizationId, options);
    }

    // Lazy-load jsdom and polyfill DOMParser only when actually running an import.
    // jsdom is heavy and only needed by the XML/HTML importers; loading it eagerly
    // slows CLI startup for every other command.
    const { JSDOM } = await import("jsdom");
    global.DOMParser = new JSDOM().window.DOMParser;

    const promptForPassword_callback = () => this.resolveImportPassword(options);

    // The web UI exposes the Keeper method via a dropdown
    // The CLI infers it from the file extension when the user passes the unified `keeper` ID
    let resolvedFormat: ImportType = format;
    if (format === "keeper") {
      const lower = filepath.toLowerCase();
      if (lower.endsWith(".csv")) {
        resolvedFormat = "keepercsv";
      } else if (lower.endsWith(".json")) {
        resolvedFormat = "keeperjson";
      } else {
        return Response.badRequest("Cannot determine Keeper file type. Use a .csv or .json file.");
      }
    }

    const importer = await this.importService.getImporter(
      resolvedFormat,
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

  private async importWithSdk(
    format: ImportType,
    filepath: string,
    organizationId: string,
    options: OptionValues,
  ) {
    let file: Uint8Array;
    try {
      file = await CliUtils.readBinaryFile(filepath);
    } catch {
      return Response.badRequest(`Could not read file: ${filepath}`);
    }
    if (file == null || file.length === 0) {
      return Response.badRequest("Import file was empty.");
    }

    try {
      const credentials = await this.collectSdkCredentials(
        this.importService.credentialKindFor(format),
        options,
      );

      const summary = await this.importService.importWithSdk(
        format,
        file,
        credentials,
        organizationId,
        undefined,
        // run() already rejected callers without import permission for this org
        true,
      );
      const total = summary.ciphers.reduce((count, c) => count + c.count, 0);

      await this.syncService.fullSync(true);
      return Response.success(
        new MessageResponse(`Imported ${total} item(s) from ${filepath}`, null),
      );
    } catch (err) {
      const messageKey = this.importService.sdkErrorMessageKey(format, err);
      if (messageKey != null) {
        return Response.badRequest(this.i18nService.t(messageKey));
      }
      return Response.badRequest(err.message ?? err);
    }
  }

  /** Collects the credentials an SDK importer declared, from CLI flags/prompts. */
  private async collectSdkCredentials(
    kind: CredentialKind | undefined,
    options: OptionValues,
  ): Promise<SdkImportCredentials> {
    switch (kind) {
      case CredentialKind.password:
        return { kind: "password", password: await this.resolveImportPassword(options) };
      case CredentialKind.passwordWithKeyFile: {
        const password = await this.resolveImportPassword(options);
        // A key file may optionally protect the database in addition to the password.
        const keyFile = options.keyfile ? await CliUtils.readBinaryFile(options.keyfile) : null;
        return { kind: "passwordWithKeyFile", password, keyFile };
      }
      default:
        return { kind: "none" };
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

  private async resolveImportPassword(options: OptionValues): Promise<string> {
    const password = await CliUtils.getPassword(
      null,
      { passwordFile: options.passwordfile, passwordEnv: options.passwordenv },
      this.logService,
      "Import file password:",
    );
    if (password instanceof Response) {
      // BW_NOINTERACTION with no password source. Throwing surfaces as a badRequest via the
      // import() catch block (and aborts the importer's credentials callback).
      throw new Error(
        "Import file password is required. Provide --passwordfile or --passwordenv, or run interactively.",
      );
    }
    return password;
  }
}
