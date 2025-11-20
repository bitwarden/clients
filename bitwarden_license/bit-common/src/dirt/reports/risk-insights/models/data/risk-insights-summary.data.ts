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
  totalMemberCount: number;
  totalApplicationCount: number;
  totalAtRiskMemberCount: number;
  totalAtRiskApplicationCount: number;
  totalCriticalApplicationCount: number;
  totalCriticalMemberCount: number;
  totalCriticalAtRiskMemberCount: number;
  totalCriticalAtRiskApplicationCount: number;

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
