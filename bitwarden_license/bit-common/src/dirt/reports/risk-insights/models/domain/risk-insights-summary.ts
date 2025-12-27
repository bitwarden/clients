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
  totalMemberCount: number;
  totalApplicationCount: number;
  totalAtRiskMemberCount: number;
  totalAtRiskApplicationCount: number;
  totalCriticalApplicationCount: number;
  totalCriticalMemberCount: number;
  totalCriticalAtRiskMemberCount: number;
  totalCriticalAtRiskApplicationCount: number;

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
