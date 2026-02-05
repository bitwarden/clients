import { firstValueFrom, map } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { createNewSummaryData } from "../../helpers";
import {
  validateApplicationHealthReportDetailArray,
  validateOrganizationReportApplicationArray,
  validateOrganizationReportSummary,
} from "../../helpers/type-guards/risk-insights-type-guards";
import {
  ApplicationHealthReportDetail,
  DecryptedReportData,
  EncryptedDataWithKey,
  EncryptedReportData,
  OrganizationReportApplication,
  OrganizationReportSummary,
  RiskInsightsReportVersion,
} from "../../models";

import { RiskInsightsCompressionService } from "./risk-insights-compression.service";

/**
 * Member registry entry for compact storage.
 * Stores unique member information once, referenced by ID in reports.
 */
export interface MemberRegistryEntry {
  email: string;
  userName?: string | null;
}

export class RiskInsightsEncryptionService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private keyGeneratorService: KeyGenerationService,
    private logService: LogService,
    private compressionService: RiskInsightsCompressionService,
  ) {}

  async encryptRiskInsightsReport(
    context: {
      organizationId: OrganizationId;
      userId: UserId;
    },
    data: DecryptedReportData,
    wrappedKey?: EncString,
  ): Promise<EncryptedDataWithKey> {
    this.logService.info("[RiskInsightsEncryptionService] Encrypting risk insights report");
    const { userId, organizationId } = context;
    const orgKey = await firstValueFrom(
      this.keyService
        .orgKeys$(userId)
        .pipe(
          map((organizationKeysById) =>
            organizationKeysById ? organizationKeysById[organizationId] : null,
          ),
        ),
    );

    if (!orgKey) {
      this.logService.warning(
        "[RiskInsightsEncryptionService] Attempted to encrypt report data without org id",
      );
      throw new Error("Organization key not found");
    }

    let contentEncryptionKey: SymmetricCryptoKey;
    try {
      if (!wrappedKey) {
        // Generate a new key
        contentEncryptionKey = await this.keyGeneratorService.createKey(512);
      } else {
        // Unwrap the existing key
        contentEncryptionKey = await this.encryptService.unwrapSymmetricKey(wrappedKey, orgKey);
      }
    } catch (error: unknown) {
      this.logService.error("[RiskInsightsEncryptionService] Failed to get encryption key", error);
      throw new Error("Failed to get encryption key");
    }

    const { reportData, summaryData, applicationData } = data;

    // Build member registry once for all reports to compact member storage
    const memberRegistry = this._buildMemberRegistry(reportData);

    this.logService.info(
      `[RiskInsightsEncryptionService] Using V2C: compress-then-encrypt for ${reportData.length} applications`,
    );

    // Build plain JSON payload
    const plainPayload = {
      version: RiskInsightsReportVersion.V2C,
      memberRegistry,
      reports: reportData.map((domain) => ({
        applicationName: domain.applicationName,
        cipherIds: domain.cipherIds,
        passwordCount: domain.passwordCount,
        memberIds: [...new Set(domain.memberDetails.map((m) => m.userGuid))],
        memberCount: domain.memberCount,
        atRiskCipherIds: domain.atRiskCipherIds,
        atRiskPasswordCount: domain.atRiskPasswordCount,
        atRiskMemberIds: [...new Set(domain.atRiskMemberDetails.map((m) => m.userGuid))],
        atRiskMemberCount: domain.atRiskMemberCount,
      })),
    };

    const plainJson = JSON.stringify(plainPayload);
    const plainSize = (plainJson.length / 1024 / 1024).toFixed(2);
    this.logService.info(
      `[RiskInsightsEncryptionService] V2C plain JSON serialized (${plainSize}MB), compressing...`,
    );

    // Compress plain JSON
    const compressedData = await this.compressionService.compressString(plainJson);
    const compressedSize = (compressedData.length / 1024 / 1024).toFixed(2);
    this.logService.info(
      `[RiskInsightsEncryptionService] V2C compressed to ${compressedSize}MB, encrypting...`,
    );

    // Encrypt the compressed string as ONE EncString
    const encryptedReportData = await this.encryptService.encryptString(
      compressedData,
      contentEncryptionKey,
    );

    this.logService.info(
      `[RiskInsightsEncryptionService] V2C encryption complete (${plainSize}MB → ${compressedSize}MB)`,
    );

    const encryptedSummaryData = await this.encryptService.encryptString(
      JSON.stringify(summaryData),
      contentEncryptionKey,
    );
    const encryptedApplicationData = await this.encryptService.encryptString(
      JSON.stringify(applicationData),
      contentEncryptionKey,
    );

    const wrappedEncryptionKey = await this.encryptService.wrapSymmetricKey(
      contentEncryptionKey,
      orgKey,
    );

    // Validate encryption results
    if (
      !encryptedReportData.encryptedString ||
      !encryptedSummaryData.encryptedString ||
      !encryptedApplicationData.encryptedString ||
      !wrappedEncryptionKey.encryptedString
    ) {
      this.logService.error(
        "[RiskInsightsEncryptionService] Encryption failed, encrypted strings are null",
      );
      throw new Error("Encryption failed, encrypted strings are null");
    }

    const encryptedDataPacket: EncryptedDataWithKey = {
      organizationId,
      encryptedReportData: encryptedReportData,
      encryptedSummaryData: encryptedSummaryData,
      encryptedApplicationData: encryptedApplicationData,
      contentEncryptionKey: wrappedEncryptionKey,
    };

    return encryptedDataPacket;
  }

  async decryptRiskInsightsReport(
    context: {
      organizationId: OrganizationId;
      userId: UserId;
    },
    encryptedData: EncryptedReportData,
    wrappedKey: EncString,
  ): Promise<DecryptedReportData> {
    this.logService.info("[RiskInsightsEncryptionService] Decrypting risk insights report");

    const { userId, organizationId } = context;
    const orgKey = await firstValueFrom(
      this.keyService
        .orgKeys$(userId)
        .pipe(
          map((organizationKeysById) =>
            organizationKeysById ? organizationKeysById[organizationId] : null,
          ),
        ),
    );

    if (!orgKey) {
      this.logService.warning(
        "[RiskInsightsEncryptionService] Attempted to decrypt report data without org id",
      );
      throw new Error("Organization key not found");
    }

    const unwrappedEncryptionKey = await this.encryptService.unwrapSymmetricKey(wrappedKey, orgKey);
    if (!unwrappedEncryptionKey) {
      this.logService.error("[RiskInsightsEncryptionService] Encryption key not found");
      throw Error("Encryption key not found");
    }

    const { encryptedReportData, encryptedSummaryData, encryptedApplicationData } = encryptedData;

    // Decrypt the data
    const decryptedReportData = await this._handleDecryptReport(
      encryptedReportData,
      unwrappedEncryptionKey,
    );
    const decryptedSummaryData = await this._handleDecryptSummary(
      encryptedSummaryData,
      unwrappedEncryptionKey,
    );
    const decryptedApplicationData = await this._handleDecryptApplication(
      encryptedApplicationData,
      unwrappedEncryptionKey,
    );

    const decryptedFullReport = {
      reportData: decryptedReportData,
      summaryData: decryptedSummaryData,
      applicationData: decryptedApplicationData,
    };

    return decryptedFullReport;
  }

  private async _handleDecryptReport(
    encryptedData: EncString | null,
    key: SymmetricCryptoKey,
  ): Promise<ApplicationHealthReportDetail[]> {
    if (encryptedData == null) {
      return [];
    }

    try {
      // Decrypt the EncString
      this.logService.info("[RiskInsightsEncryptionService] Decrypting report data");
      const decryptedData = await this.encryptService.decryptString(encryptedData, key);

      let parsedData: any;

      // Check if data is compressed (V2C format)
      if (this.compressionService.isCompressed(decryptedData)) {
        this.logService.info(
          "[RiskInsightsEncryptionService] Detected V2C format (compress-then-encrypt), decompressing...",
        );
        const decompressed = await this.compressionService.decompressString(decryptedData);
        parsedData = JSON.parse(decompressed);
      } else {
        // V1: Legacy format (no compression)
        this.logService.info(
          "[RiskInsightsEncryptionService] Detected V1 format (legacy, no compression)",
        );
        parsedData = JSON.parse(decryptedData);
      }

      // Check if this is V2C format
      if (parsedData.version === RiskInsightsReportVersion.V2C) {
        // V2C: Plain fields with compress-then-encrypt
        this.logService.info(
          "[RiskInsightsEncryptionService] Processing V2C format with member registry",
        );
        return parsedData.reports.map((report: any) => ({
          applicationName: report.applicationName,
          cipherIds: report.cipherIds,
          passwordCount: report.passwordCount,
          memberCount: report.memberCount,
          atRiskCipherIds: report.atRiskCipherIds,
          atRiskPasswordCount: report.atRiskPasswordCount,
          atRiskMemberCount: report.atRiskMemberCount,
          // Expand member IDs to MemberDetails using registry
          memberDetails: report.memberIds.map((id: string) => ({
            userGuid: id,
            email: parsedData.memberRegistry[id]?.email ?? "",
            userName: parsedData.memberRegistry[id]?.userName ?? null,
            cipherId: "", // Not stored in V2C format
          })),
          atRiskMemberDetails: report.atRiskMemberIds.map((id: string) => ({
            userGuid: id,
            email: parsedData.memberRegistry[id]?.email ?? "",
            userName: parsedData.memberRegistry[id]?.userName ?? null,
            cipherId: "", // Not stored in V2C format
          })),
        }));
      } else {
        // V1 format: Legacy full object storage
        this.logService.info(
          "[RiskInsightsEncryptionService] Processing V1 format (legacy full object storage)",
        );
        return validateApplicationHealthReportDetailArray(parsedData);
      }
    } catch (error: unknown) {
      // Log detailed error for debugging
      this.logService.error("[RiskInsightsEncryptionService] Failed to decrypt report", error);
      // Always throw generic message to prevent information disclosure
      // Original error with detailed validation info is logged, not exposed to caller
      throw new Error(
        "Report data validation failed. This may indicate data corruption or tampering.",
      );
    }
  }

  private async _handleDecryptSummary(
    encryptedData: EncString | null,
    key: SymmetricCryptoKey,
  ): Promise<OrganizationReportSummary> {
    if (encryptedData == null) {
      return createNewSummaryData();
    }

    try {
      const decryptedData = await this.encryptService.decryptString(encryptedData, key);
      const parsedData = JSON.parse(decryptedData);

      // Validate parsed data structure with runtime type guards
      return validateOrganizationReportSummary(parsedData);
    } catch (error: unknown) {
      // Log detailed error for debugging
      this.logService.error(
        "[RiskInsightsEncryptionService] Failed to decrypt report summary",
        error,
      );
      // Always throw generic message to prevent information disclosure
      // Original error with detailed validation info is logged, not exposed to caller
      throw new Error(
        "Summary data validation failed. This may indicate data corruption or tampering.",
      );
    }
  }

  private async _handleDecryptApplication(
    encryptedData: EncString | null,
    key: SymmetricCryptoKey,
  ): Promise<OrganizationReportApplication[]> {
    if (encryptedData == null) {
      return [];
    }

    try {
      const decryptedData = await this.encryptService.decryptString(encryptedData, key);
      const parsedData = JSON.parse(decryptedData);

      // Validate parsed data structure with runtime type guards
      return validateOrganizationReportApplicationArray(parsedData);
    } catch (error: unknown) {
      // Log detailed error for debugging
      this.logService.error(
        "[RiskInsightsEncryptionService] Failed to decrypt report applications",
        error,
      );
      // Always throw generic message to prevent information disclosure
      // Original error with detailed validation info is logged, not exposed to caller
      throw new Error(
        "Application data validation failed. This may indicate data corruption or tampering.",
      );
    }
  }

  /**
   * Builds a member registry from report data for compact V2 storage.
   * Extracts unique members once instead of duplicating across applications.
   * This achieves ~10x size reduction (50-100MB → 5-10MB).
   *
   * @param reportData - Array of application health reports
   * @returns Registry mapping member IDs to member information
   */
  private _buildMemberRegistry(
    reportData: ApplicationHealthReportDetail[],
  ): Record<string, MemberRegistryEntry> {
    const registry: Record<string, MemberRegistryEntry> = {};
    const seen = new Set<string>();

    for (const app of reportData) {
      // Collect from memberDetails
      for (const member of app.memberDetails) {
        if (!seen.has(member.userGuid)) {
          registry[member.userGuid] = {
            email: member.email,
            userName: member.userName,
          };
          seen.add(member.userGuid);
        }
      }
      // Also collect from atRiskMemberDetails (may have different members)
      for (const member of app.atRiskMemberDetails) {
        if (!seen.has(member.userGuid)) {
          registry[member.userGuid] = {
            email: member.email,
            userName: member.userName,
          };
          seen.add(member.userGuid);
        }
      }
    }

    this.logService.debug(
      `[RiskInsightsEncryptionService] Built member registry with ${Object.keys(registry).length} unique members`,
    );

    return registry;
  }
}
