import { firstValueFrom, map } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { createNewSummaryData } from "../../helpers";
import {
  validateAccessReportPayload,
  validateApplicationHealthReportDetailArray,
  validateOrganizationReportApplicationArray,
  validateOrganizationReportSummary,
} from "../../helpers/type-guards/risk-insights-type-guards";
import {
  ApplicationHealthReportDetail,
  DecryptedReportData,
  EncryptedDataWithKey,
  EncryptedReportData,
  MemberDetails,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "../../models";
import {
  MemberRegistryEntryData,
  RiskInsightsReportData,
} from "../../models/data/risk-insights-report.data";

export class RiskInsightsEncryptionService {
  /**
   * Sentinel value for MemberDetails.cipherId in downgraded V2→V1 reports.
   * V2 does not store per-cipher member associations (that mapping was already lossy in V1
   * due to email-based deduplication — see report-data-model-evolution.md). An empty string
   * fails isBoundedString, and using the userId risks confusion, so we use the nil UUID.
   */
  private readonly _nilCipherId = "00000000-0000-0000-0000-000000000000" as CipherId;

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private keyGeneratorService: KeyGenerationService,
    private logService: LogService,
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

    // Encrypt the data
    const encryptedReportData = await this.encryptService.encryptString(
      JSON.stringify(reportData),
      contentEncryptionKey,
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
      const decryptedData = await this.encryptService.decryptString(encryptedData, key);
      const parsedData = JSON.parse(decryptedData);

      // Downgrade path: V2 blob detected in V1 context (feature flag was reverted).
      // Validate and reconstruct V1 structure from V2 payload using the member registry.
      if (typeof parsedData === "object" && parsedData !== null && "version" in parsedData) {
        this.logService.warning(
          "[RiskInsightsEncryptionService] V2 report detected in V1 path, running downgrade transform",
        );
        const payload = validateAccessReportPayload(parsedData);
        return this._convertV2ReportToV1(payload.reports, payload.memberRegistry);
      }

      // Normal V1 path: validate parsed data structure with runtime type guards
      return validateApplicationHealthReportDetailArray(parsedData);
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
   * Reconstructs a V1 ApplicationHealthReportDetail[] from a V2 report payload.
   * Used when a V2-format blob is encountered during V1 decryption (feature flag downgrade).
   */
  private _convertV2ReportToV1(
    reports: RiskInsightsReportData[],
    memberRegistry: Record<string, MemberRegistryEntryData>,
  ): ApplicationHealthReportDetail[] {
    return reports.map((report) => {
      const cipherIds = Object.keys(report.cipherRefs) as CipherId[];
      const atRiskCipherIds = Object.entries(report.cipherRefs)
        .filter(([, isAtRisk]) => isAtRisk)
        .map(([id]) => id as CipherId);

      const toMemberDetails = (userId: string): MemberDetails | null => {
        const entry = memberRegistry[userId];
        if (!entry) {
          return null;
        }
        return {
          userGuid: entry.id,
          userName: entry.userName,
          email: entry.email,
          cipherId: this._nilCipherId,
        };
      };

      const memberDetails = Object.keys(report.memberRefs)
        .map(toMemberDetails)
        .filter((m): m is MemberDetails => m !== null);

      const atRiskMemberDetails = Object.entries(report.memberRefs)
        .filter(([, isAtRisk]) => isAtRisk)
        .map(([userId]) => toMemberDetails(userId))
        .filter((m): m is MemberDetails => m !== null);

      return {
        applicationName: report.applicationName,
        passwordCount: report.passwordCount,
        atRiskPasswordCount: report.atRiskPasswordCount,
        memberCount: report.memberCount,
        atRiskMemberCount: report.atRiskMemberCount,
        cipherIds,
        atRiskCipherIds,
        memberDetails,
        atRiskMemberDetails,
      };
    });
  }
}
