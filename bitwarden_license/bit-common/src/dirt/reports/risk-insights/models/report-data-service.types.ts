import {
  ApplicationHealthReportDetail,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "./report-models";

export type ApplicationHealthReportDetailEnriched = ApplicationHealthReportDetail & {
  isMarkedAsCritical: boolean;
};
export interface RiskInsightsEnrichedData {
  reportData: ApplicationHealthReportDetailEnriched[];
  summaryData: OrganizationReportSummary;
  applicationData: OrganizationReportApplication[];
  creationDate: Date;
}
