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
  encryptedApplicationData: EncString;
  contentEncryptionKey: EncString;
}

/**
 * @deprecated V1 decrypted report container. Superseded by {@link DecryptedAccessReportData}.
 * Used only by the legacy encryption service and the V1→V2 migration path.
 * Will be removed when V1 code is deleted.
 */
export interface DecryptedReportData {
  reportData: ApplicationHealthReportDetail[];
  summaryData: OrganizationReportSummary;
  applicationData: OrganizationReportApplication[];
}

// TODO Move encryption models to correct location
export interface EncryptedReportData {
  encryptedReportData: EncString;
  encryptedSummaryData: EncString;
  encryptedApplicationData: EncString;
}
