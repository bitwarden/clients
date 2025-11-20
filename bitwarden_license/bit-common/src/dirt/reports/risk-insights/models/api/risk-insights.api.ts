import { BaseResponse } from "@bitwarden/common/models/response/base.response";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsData } from "../data/risk-insights.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsights } from "../domain/risk-insights";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsView } from "../view/risk-insights.view";

/**
 * Converts a RiskInsights API response
 *
 * - See {@link RiskInsights} for domain model
 * - See {@link RiskInsightsData} for data model
 * - See {@link RiskInsightsView} from View Model
 */
// [TODO] To replace GetRiskInsightsReportResponse
export class RiskInsightsApi extends BaseResponse {
  id: string;
  organizationId: string;
  reports: string;
  applications: string;
  summary: string;
  creationDate: string;
  contentEncryptionKey: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }

    this.id = this.getResponseProperty("id");
    this.organizationId = this.getResponseProperty("organizationId");
    this.creationDate = this.getResponseProperty("creationDate");
    this.reports = this.getResponseProperty("reportData");
    this.applications = this.getResponseProperty("applicationData");
    this.summary = this.getResponseProperty("summaryData");
    this.contentEncryptionKey = this.getResponseProperty("contentEncryptionKey");

    // Use when individual values are encrypted
    // const summary = this.getResponseProperty("summaryData");
    // if (summary != null) {
    //   this.summary = new RiskInsightsSummaryApi(summary);
    // }

    // const reports = this.getResponseProperty("reportData");
    // if (reports != null) {
    //   this.reports = reports.map((r: any) => new RiskInsightsReportApi(r));
    // }
    // const applications = this.getResponseProperty("applicationData");
    // if (applications != null) {
    //   this.applications = applications.map((f: any) => new RiskInsightsApplicationApi(f));
    // }
  }
}
