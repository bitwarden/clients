import { RiskInsightsSummaryApi } from "../api/risk-insights-summary.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsSummary } from "../domain/risk-insights-summary";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsSummaryView } from "../view/risk-insights-summary.view";

/**
 * Serializable data model for report summary in risk insights report
 *
 * - See {@link RiskInsightsSummary} for domain model
 * - See {@link RiskInsightsSummaryApi} for API model
 * - See {@link RiskInsightsSummaryView} from View Model
 */
export class RiskInsightsSummaryData {
  totalMemberCount: number = 0;
  totalApplicationCount: number = 0;
  totalAtRiskMemberCount: number = 0;
  totalAtRiskApplicationCount: number = 0;
  totalCriticalApplicationCount: number = 0;
  totalCriticalMemberCount: number = 0;
  totalCriticalAtRiskMemberCount: number = 0;
  totalCriticalAtRiskApplicationCount: number = 0;

  constructor(data?: RiskInsightsSummaryApi) {
    if (data == null) {
      return;
    }

    this.totalMemberCount = data.totalMemberCount;
    this.totalApplicationCount = data.totalApplicationCount;
    this.totalAtRiskMemberCount = data.totalAtRiskMemberCount;
    this.totalAtRiskApplicationCount = data.totalAtRiskApplicationCount;
    this.totalCriticalApplicationCount = data.totalCriticalApplicationCount;
    this.totalCriticalMemberCount = data.totalCriticalMemberCount;
    this.totalCriticalAtRiskMemberCount = data.totalCriticalAtRiskMemberCount;
    this.totalCriticalAtRiskApplicationCount = data.totalCriticalAtRiskApplicationCount;
  }
}
