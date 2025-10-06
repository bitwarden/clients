import { firstValueFrom, map } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { DecryptedReportData, EncryptedReportData, EncryptedDataWithKey } from "../models";

export class RiskInsightsEncryptionService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private keyGeneratorService: KeyGenerationService,
  ) {}

  async encryptRiskInsightsReport(
    context: {
      organizationId: OrganizationId;
      userId: UserId;
    },
    data: DecryptedReportData,
    wrappedKey?: EncString,
  ): Promise<EncryptedDataWithKey> {
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
      throw new Error("Organization key not found");
    }

    let contentEncryptionKey: SymmetricCryptoKey;
    if (!wrappedKey) {
      // Generate a new key
      contentEncryptionKey = await this.keyGeneratorService.createKey(512);
    } else {
      // Unwrap the existing key
      contentEncryptionKey = await this.encryptService.unwrapSymmetricKey(wrappedKey, orgKey);
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
      throw new Error("Organization key not found");
    }

    const unwrappedEncryptionKey = await this.encryptService.unwrapSymmetricKey(wrappedKey, orgKey);
    if (!unwrappedEncryptionKey) {
      throw Error("Encryption key not found");
    }

    const { encryptedReportData, encryptedSummaryData, encryptedApplicationData } = encryptedData;
    if (!encryptedReportData || !encryptedSummaryData || !encryptedApplicationData) {
      throw new Error("Missing data");
    }

    // Decrypt the data
    const decryptedReportData = await this.encryptService.decryptString(
      encryptedReportData,
      unwrappedEncryptionKey,
    );
    const decryptedSummaryData = await this.encryptService.decryptString(
      encryptedSummaryData,
      unwrappedEncryptionKey,
    );
    const decryptedApplicationData = await this.encryptService.decryptString(
      encryptedApplicationData,
      unwrappedEncryptionKey,
    );

    if (!decryptedReportData || !decryptedSummaryData || !decryptedApplicationData) {
      throw new Error("Decryption failed, decrypted strings are null");
    }

    const decryptedReportDataJson = JSON.parse(decryptedReportData);
    const decryptedSummaryDataJson = JSON.parse(decryptedSummaryData);
    const decryptedApplicationDataJson = JSON.parse(decryptedApplicationData);

    const decryptedFullReport = {
      reportData: decryptedReportDataJson,
      summaryData: decryptedSummaryDataJson,
      applicationData: decryptedApplicationDataJson,
    };

    return decryptedFullReport;
  }
}
