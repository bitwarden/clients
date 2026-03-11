import {
  ApplicationHealthReportDetail,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "./report-models";

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
