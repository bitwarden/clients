import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  ApplicationHealthReportDetail,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "./report-models";

/**
 * Encrypted report data with its encryption key.
 *
 * V2C format (current): All data is compressed then encrypted as EncStrings.
 * V1 format (legacy): Data encrypted without compression.
 */
export interface EncryptedDataWithKey {
  organizationId: OrganizationId;
  encryptedReportData: EncString;
  encryptedSummaryData: EncString;
  encryptedApplicationData: EncString;
  contentEncryptionKey: EncString;
}

export interface DecryptedReportData {
  reportData: ApplicationHealthReportDetail[];
  summaryData: OrganizationReportSummary;
  applicationData: OrganizationReportApplication[];
}

export interface EncryptedReportData {
  encryptedReportData: EncString;
  encryptedSummaryData: EncString;
  encryptedApplicationData: EncString;
}
