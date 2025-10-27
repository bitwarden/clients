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
  ApplicationHealthReportDetail,
  DecryptedReportData,
  EncryptedDataWithKey,
  EncryptedReportData,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "../../models";

import {
  validateApplicationHealthReportDetailArray,
  validateOrganizationReportApplicationArray,
  validateOrganizationReportSummary,
} from "./risk-insights-type-guards";

export class RiskInsightsEncryptionService {
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

      // Validate parsed data structure with runtime type guards
      return validateApplicationHealthReportDetailArray(parsedData);
    } catch (error: unknown) {
      this.logService.error("[RiskInsightsEncryptionService] Failed to decrypt report", error);
      // Re-throw validation errors as they indicate data corruption or tampering
      // Use generic message to avoid information disclosure
      if (error instanceof Error && error.message.includes("Invalid report data")) {
        throw new Error(
          "Report data validation failed. This may indicate data corruption or tampering.",
        );
      }
      throw error;
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
      this.logService.error(
        "[RiskInsightsEncryptionService] Failed to decrypt report summary",
        error,
      );
      // Re-throw validation errors as they indicate data corruption or tampering
      // Use generic message to avoid information disclosure
      if (error instanceof Error && error.message.includes("Invalid OrganizationReportSummary")) {
        throw new Error(
          "Summary data validation failed. This may indicate data corruption or tampering.",
        );
      }
      throw error;
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
      this.logService.error(
        "[RiskInsightsEncryptionService] Failed to decrypt report applications",
        error,
      );
      // Re-throw validation errors as they indicate data corruption or tampering
      // Use generic message to avoid information disclosure
      if (
        error instanceof Error &&
        (error.message.includes("Invalid application data") ||
          error.message.includes("Invalid date string"))
      ) {
        throw new Error(
          "Application data validation failed. This may indicate data corruption or tampering.",
        );
      }
      throw error;
    }
  }
}
