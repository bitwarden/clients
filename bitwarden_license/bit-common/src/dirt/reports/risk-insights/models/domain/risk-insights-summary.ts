import Domain from "@bitwarden/common/platform/models/domain/domain-base";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsSummaryApi } from "../api/risk-insights-summary.api";
import { RiskInsightsSummaryData } from "../data/risk-insights-summary.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsSummaryView } from "../view/risk-insights-summary.view";

/**
 * Domain model for Member Details in Risk Insights containing encrypted properties
 *
 * - See {@link RiskInsightsSummaryApi} for API model
 * - See {@link RiskInsightsSummaryData} for data model
 * - See {@link RiskInsightsSummaryView} from View Model
 */
export class RiskInsightsSummary extends Domain {
  totalMemberCount: number = 0;
  totalApplicationCount: number = 0;
  totalAtRiskMemberCount: number = 0;
  totalAtRiskApplicationCount: number = 0;
  totalCriticalApplicationCount: number = 0;
  totalCriticalMemberCount: number = 0;
  totalCriticalAtRiskMemberCount: number = 0;
  totalCriticalAtRiskApplicationCount: number = 0;

  constructor(obj?: RiskInsightsSummaryData) {
    super();
    if (obj == null) {
      return;
    }

    this.totalMemberCount = obj.totalMemberCount;
    this.totalApplicationCount = obj.totalApplicationCount;
    this.totalAtRiskMemberCount = obj.totalAtRiskMemberCount;
    this.totalAtRiskApplicationCount = obj.totalAtRiskApplicationCount;
    this.totalCriticalApplicationCount = obj.totalCriticalApplicationCount;
    this.totalCriticalMemberCount = obj.totalCriticalMemberCount;
    this.totalCriticalAtRiskMemberCount = obj.totalCriticalAtRiskMemberCount;
    this.totalCriticalAtRiskApplicationCount = obj.totalCriticalAtRiskApplicationCount;
  }

  // [TODO] Domain level methods
  // static fromJSON(): RiskInsightsSummary {}
  // decrypt(): RiskInsightsSummaryView {}
  // toData(): RiskInsightsSummaryData {}

  // [TODO] SDK Mapping
  // toSdkRiskInsightsReport(): SdkRiskInsightsReport {}
  // static fromSdkRiskInsightsReport(obj?: SdkRiskInsightsReport): RiskInsightsReport | undefined {}
}
