import { firstValueFrom, map } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import {
  createNewSummaryData,
  validateAccessReportPayload,
  validateApplicationHealthReportDetailArray,
  validateOrganizationReportApplicationArray,
  validateOrganizationReportSummary,
} from "../../../../reports/risk-insights/helpers";
import {
  ApplicationHealthReportDetail,
  DecryptedReportData,
  MemberDetails,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "../../../../reports/risk-insights/models";
import { MemberRegistryEntryData, ApplicationHealthData } from "../../../models";
import {
  EncryptedDataWithKey,
  EncryptedReportData,
} from "../../abstractions/access-report-encryption.service";
import { isVersionEnvelope } from "../../abstractions/versioning.service";

/**
 * @deprecated V1 encryption service. Used only by the V1 orchestrator, V1 report service,
 * and the V1→V2 migration path. Will be deleted when the V1 code tree is removed.
 * For V2, use {@link DefaultAccessReportEncryptionService}.
 */
export class LegacyRiskInsightsEncryptionService {
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
    this.logService.info("[LegacyRiskInsightsEncryptionService] Encrypting risk insights report");
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
        "[LegacyRiskInsightsEncryptionService] Attempted to encrypt report data without org id",
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
      this.logService.error(
        "[LegacyRiskInsightsEncryptionService] Failed to get encryption key",
        error,
      );
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
        "[LegacyRiskInsightsEncryptionService] Encryption failed, encrypted strings are null",
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
    this.logService.info("[LegacyRiskInsightsEncryptionService] Decrypting risk insights report");

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
        "[LegacyRiskInsightsEncryptionService] Attempted to decrypt report data without org id",
      );
      throw new Error("Organization key not found");
    }

    const unwrappedEncryptionKey = await this.encryptService.unwrapSymmetricKey(wrappedKey, orgKey);
    if (!unwrappedEncryptionKey) {
      this.logService.error("[LegacyRiskInsightsEncryptionService] Encryption key not found");
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
      if (isVersionEnvelope(parsedData)) {
        this.logService.warning(
          "[LegacyRiskInsightsEncryptionService] V2 report detected in V1 path, running downgrade transform",
        );
        const payload = validateAccessReportPayload(parsedData.data);
        return this._convertV2ReportToV1(payload.reports, payload.memberRegistry);
      }

      // Normal V1 path: validate parsed data structure with runtime type guards
      return validateApplicationHealthReportDetailArray(parsedData);
    } catch (error: unknown) {
      // Log detailed error for debugging
      this.logService.error(
        "[LegacyRiskInsightsEncryptionService] Failed to decrypt report",
        error,
      );
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

      // Downgrade path: V2 summary blob is a VersionEnvelope wrapping the summary payload.
      // Extract the inner data before validating.
      if (isVersionEnvelope(parsedData)) {
        this.logService.warning(
          "[LegacyRiskInsightsEncryptionService] Versioned summary detected in legacy path, extracting payload",
        );
        return validateOrganizationReportSummary(parsedData.data);
      }

      return validateOrganizationReportSummary(parsedData);
    } catch (error: unknown) {
      // Log detailed error for debugging
      this.logService.error(
        "[LegacyRiskInsightsEncryptionService] Failed to decrypt report summary",
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

      // Downgrade path: V2 application blob is a VersionEnvelope wrapping an array.
      // Extract the array and convert reviewedDate: string|undefined → Date|null for V1 consumers.
      if (isVersionEnvelope(parsedData)) {
        this.logService.warning(
          "[LegacyRiskInsightsEncryptionService] V2 application format detected in V1 path, running downgrade transform",
        );
        return (parsedData.data as Record<string, unknown>[]).map((app) => ({
          applicationName: app["applicationName"] as string,
          isCritical: app["isCritical"] as boolean,
          reviewedDate:
            typeof app["reviewedDate"] === "string" ? new Date(app["reviewedDate"]) : null,
        }));
      }

      // Normal V1 path: validate parsed data structure with runtime type guards
      return validateOrganizationReportApplicationArray(parsedData);
    } catch (error: unknown) {
      // Log detailed error for debugging
      this.logService.error(
        "[LegacyRiskInsightsEncryptionService] Failed to decrypt report applications",
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
    reports: ApplicationHealthData[],
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
          userName: entry.userName ?? null, // V1 uses null; V2 uses undefined
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
