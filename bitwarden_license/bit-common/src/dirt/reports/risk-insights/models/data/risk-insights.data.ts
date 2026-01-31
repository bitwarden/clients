import { RiskInsightsApi } from "../api/risk-insights.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsights } from "../domain/risk-insights";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsView } from "../view/risk-insights.view";

/**
 * Serializable data model for member details in risk insights report
 *
 * - See {@link RiskInsights} for domain model
 * - See {@link RiskInsightsApi} for API model
 * - See {@link RiskInsightsView} from View Model
 */
export class RiskInsightsData {
  id: string;
  organizationId: string;
  reports: string;
  applications: string;
  summary: string;
  //  [TODO] Update types when individual values are encrypted instead of the entire object
  //  reports: RiskInsightsReportData[]; // Previously ApplicationHealthReportDetail Data type
  //  applications: RiskInsightsApplicationsData[]; // Previously OrganizationReportApplication Data type
  //  summary: RiskInsightsSummaryData; // Previously OrganizationReportSummary Data type
  creationDate: string;
  contentEncryptionKey: string;

  constructor(response?: RiskInsightsApi) {
    if (response == null) {
      return;
    }

    this.id = response.id;
    this.organizationId = response.organizationId;
    this.reports = response.reports;
    this.applications = response.applications;
    this.summary = response.summary;
    this.creationDate = response.creationDate;
    this.contentEncryptionKey = response.contentEncryptionKey;

    //  [TODO] Update types when individual values are encrypted instead of the entire object
    //  this.summary = new RiskInsightsSummaryData(response.summaryData);
    //  if (response.reports != null) {
    //    this.reports = response.reports.map((r) => new RiskInsightsReportData(r));
    //  }
    //  if (response.applications != null) {
    //    this.applications = response.applications.map((a) => new RiskInsightsApplicationData(a));
    //  }
  }
}
