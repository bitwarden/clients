import { firstValueFrom } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { SecretsManagerPortingApiService } from "@bitwarden/bit-common/secrets-manager/settings/services/sm-porting-api.service";
import { Response } from "@bitwarden/cli/models/response";
import { MessageResponse } from "@bitwarden/cli/models/response/message.response";
import { StringResponse } from "@bitwarden/cli/models/response/string.response";
import { CliUtils } from "@bitwarden/cli/utils";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ServiceContainer } from "../../service-container";
import { SmExportResponse } from "../models/sm-export.response";
import { resolveSmOrganization, smErrorResponse } from "../sm-command.utils";

export type SmExportOptions = {
  output?: string;
  /** Master password supplied directly, e.g. in the `bw serve` request body. */
  password?: string;
  passwordFile?: string;
  passwordEnv?: string;
};

export class SmExportCommand {
  constructor(
    private portingApiService: SecretsManagerPortingApiService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private userVerificationService: UserVerificationService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private logService: LogService,
  ) {}

  async run(organizationId: string, options: SmExportOptions = {}): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
    if (!org.organization.isAdmin) {
      return Response.error("Only organization owners and admins can export Secrets Manager data.");
    }

    const verificationError = await this.verifyMasterPassword(options);
    if (verificationError) {
      return verificationError;
    }

    let exportJson: string;
    try {
      exportJson = await this.portingApiService.export(org.organizationId);
    } catch (e) {
      return smErrorResponse(e, "organization");
    }

    // `bw serve` returns the export in the response body rather than writing a file on the host.
    if (process.env.BW_SERVE === "true") {
      return Response.success(new SmExportResponse(JSON.parse(exportJson)));
    }

    if (options.output == null || options.output === "") {
      return Response.success(new StringResponse(exportJson));
    }

    try {
      const filePath = await CliUtils.saveFile(exportJson, options.output, exportFileName());
      const res = new MessageResponse("Saved " + filePath, null);
      res.raw = filePath;
      return Response.success(res);
    } catch (e) {
      return Response.error(String(e));
    }
  }

  /**
   * Re-verifies the master password, as the web vault does before a Secrets Manager export.
   * Returns an error response when verification is not possible or fails.
   *
   * This protects the bulk export only. As in the web vault, individual secret values remain
   * readable without re-verification through the secret list and get commands and routes.
   */
  private async verifyMasterPassword(options: SmExportOptions): Promise<Response | undefined> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const hasMasterPassword = await firstValueFrom(
      this.userDecryptionOptionsService.hasMasterPasswordById$(userId),
    );
    if (!hasMasterPassword) {
      return Response.badRequest(
        "Exporting Secrets Manager data requires a master password. Use the web vault to export.",
      );
    }

    let password: string;
    if (process.env.BW_SERVE === "true") {
      if (Utils.isNullOrEmpty(options.password)) {
        return Response.badRequest(
          "Master password is required. Provide it as `password` in the request body.",
        );
      }
      password = options.password;
    } else {
      let passwordResult: string | Response;
      try {
        passwordResult = await CliUtils.getPassword(
          options.password,
          { passwordFile: options.passwordFile, passwordEnv: options.passwordEnv },
          this.logService,
        );
      } catch {
        return Response.error("Could not read the master password file.");
      }
      if (passwordResult instanceof Response) {
        return passwordResult;
      }
      password = passwordResult;
    }

    try {
      const verified = await this.userVerificationService.verifyUser({
        type: VerificationType.MasterPassword,
        secret: password,
      });
      if (!verified) {
        return Response.error("Invalid master password.");
      }
    } catch (e) {
      return Response.error(e instanceof Error ? e.message : "Invalid master password.");
    }
    return undefined;
  }

  static create(serviceContainer: ServiceContainer) {
    return new SmExportCommand(
      serviceContainer.secretsManagerPortingApiService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
      serviceContainer.userVerificationService,
      serviceContainer.userDecryptionOptionsService,
      serviceContainer.logService,
    );
  }
}

/**
 * Matches the file name the web vault uses for Secrets Manager exports.
 */
function exportFileName(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timestamp =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  return "bitwarden_export_" + timestamp + ".json";
}
