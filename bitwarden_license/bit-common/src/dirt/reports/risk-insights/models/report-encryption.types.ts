import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  ApplicationHealthReportDetail,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "./report-models";

/*
 * After data is encrypted, it is returned with the
 * encryption key used to encrypt the data.
 */
export interface EncryptedDataWithKey {
  organizationId: OrganizationId;
  encryptedReportData: EncString;
  encryptedSummaryData: EncString;
  encryptedApplicationsData: EncString;
  contentEncryptionKey: EncString;
}

export interface DecryptedReportData {
  reportData: ApplicationHealthReportDetail[];
  summaryData: OrganizationReportSummary;
  applicationsData: OrganizationReportApplication[];
}

export interface EncryptedReportData {
  encryptedReportData: EncString;
  encryptedSummaryData: EncString;
  encryptedApplicationsData: EncString;
}
