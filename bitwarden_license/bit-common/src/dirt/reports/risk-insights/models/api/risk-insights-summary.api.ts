import { BaseResponse } from "@bitwarden/common/models/response/base.response";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsSummaryData } from "../data/risk-insights-summary.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsSummary } from "../domain/risk-insights-summary";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsSummaryView } from "../view/risk-insights-summary.view";

/**
 * Converts a RiskInsightsSummary API response
 *
 * - See {@link RiskInsightsSummary} for domain model
 * - See {@link RiskInsightsSummaryData} for data model
 * - See {@link RiskInsightsSummaryView} from View Model
 */
export class RiskInsightsSummaryApi extends BaseResponse {
  totalMemberCount: number;
  totalApplicationCount: number;
  totalAtRiskMemberCount: number;
  totalAtRiskApplicationCount: number;
  totalCriticalApplicationCount: number;
  totalCriticalMemberCount: number;
  totalCriticalAtRiskMemberCount: number;
  totalCriticalAtRiskApplicationCount: number;

  constructor(data: any) {
    super(data);

    this.totalMemberCount = this.getResponseProperty("totalMemberCount") || 0;
    this.totalApplicationCount = this.getResponseProperty("totalApplicationCount") || 0;
    this.totalAtRiskMemberCount = this.getResponseProperty("totalAtRiskMemberCount") || 0;
    this.totalAtRiskApplicationCount = this.getResponseProperty("totalAtRiskApplicationCount") || 0;
    this.totalCriticalApplicationCount =
      this.getResponseProperty("totalCriticalApplicationCount") || 0;
    this.totalCriticalMemberCount = this.getResponseProperty("totalCriticalMemberCount") || 0;
    this.totalCriticalAtRiskMemberCount =
      this.getResponseProperty("totalCriticalAtRiskMemberCount") || 0;
    this.totalCriticalAtRiskApplicationCount =
      this.getResponseProperty("totalCriticalAtRiskApplicationCount") || 0;
  }
}
