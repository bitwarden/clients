import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId, OrganizationId } from "@bitwarden/common/types/guid";

import { ExportedVault } from "../types";

import { IndividualVaultExportServiceAbstraction } from "./individual-vault-export.service.abstraction";
import { OrganizationVaultExportServiceAbstraction } from "./org-vault-export.service.abstraction";
import { ExportFormat, VaultExportServiceAbstraction } from "./vault-export.service.abstraction";

export class VaultExportService implements VaultExportServiceAbstraction {
  constructor(
    private individualVaultExportService: IndividualVaultExportServiceAbstraction,
    private organizationVaultExportService: OrganizationVaultExportServiceAbstraction,
    private accountService: AccountService,
  ) {}

  /** Creates an export of an individual vault (My vault). Based on the provided format it will either be unencrypted, encrypted or password protected
   * @param userId The userId of the account requesting the export
   * @param format The format of the export
   * @param password An optional password if the export should be password-protected
   * @returns The exported vault
   * @throws Error if the format is csv and a password is provided
   */
  async getExport(
    userId: UserId,
    format: ExportFormat = "csv",
    password: string = "",
  ): Promise<ExportedVault> {
    await this.checkForImpersonation(userId);

    if (!Utils.isNullOrWhitespace(password)) {
      if (format == "csv") {
        throw new Error("CSV does not support password protected export");
      }

      return this.individualVaultExportService.getPasswordProtectedExport(userId, password);
    }
    return this.individualVaultExportService.getExport(userId, format);
  }

  /** Creates an export of an organizational vault. Based on the provided format it will either be unencrypted, encrypted or password protected
   * @param userId The userId of the account requesting the export
   * @param organizationId The organization id
   * @param format The format of the export
   * @param password The password to protect the export
   * @param onlyManagedCollections If true only managed collections will be exported
   * @returns The exported vault
   * @throws Error if the format is csv and a password is provided
   * @throws Error if the format is zip and the environment does not support exporting attachments
   * @throws Error if the format is not supported
   * @throws Error if the organization id is not a valid guid
   * @throws Error if the organization policies prevent the export
   */
  async getOrganizationExport(
    userId: UserId,
    organizationId: OrganizationId,
    format: ExportFormat,
    password: string,
    onlyManagedCollections = false,
  ): Promise<ExportedVault> {
    await this.checkForImpersonation(userId);

    if (!Utils.isNullOrWhitespace(password)) {
      if (format == "csv") {
        throw new Error("CSV does not support password protected export");
      }

      return this.organizationVaultExportService.getPasswordProtectedExport(
        userId,
        organizationId,
        password,
        onlyManagedCollections,
      );
    }

    return this.organizationVaultExportService.getOrganizationExport(
      userId,
      organizationId,
      format,
      onlyManagedCollections,
    );
  }

  /** Checks if the provided userId matches the currently authenticated user
   * @param userId The userId to check
   * @throws Error if the userId does not match the currently authenticated user
   */
  private async checkForImpersonation(userId: UserId): Promise<void> {
    const currentUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (userId !== currentUserId) {
      throw new Error("UserId does not match the currently authenticated user");
    }
  }
}
