import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsSummaryApi } from "../api/risk-insights-summary.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsSummaryData } from "../data/risk-insights-summary.data";
import { RiskInsightsSummary } from "../domain/risk-insights-summary";

/**
 * View model for Report Summary in Risk Insights containing decrypted properties
 *
 * - See {@link RiskInsightsSummary} for domain model
 * - See {@link RiskInsightsSummaryData} for data model
 * - See {@link RiskInsightsSummaryApi} for API model
 */
export class RiskInsightsSummaryView implements View {
  totalMemberCount: number;
  totalApplicationCount: number;
  totalAtRiskMemberCount: number;
  totalAtRiskApplicationCount: number;
  totalCriticalApplicationCount: number;
  totalCriticalMemberCount: number;
  totalCriticalAtRiskMemberCount: number;
  totalCriticalAtRiskApplicationCount: number;

  constructor(obj?: RiskInsightsSummary) {
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

  toJSON() {
    return this;
  }

  static fromJSON(obj: Partial<DeepJsonify<RiskInsightsSummaryView>>): RiskInsightsSummaryView {
    return Object.assign(new RiskInsightsSummaryView(), obj);
  }

  // [TODO] SDK Mapping
  // toSdkRiskInsightsSummaryView(): SdkRiskInsightsSummaryView {}
  // static fromRiskInsightsSummaryView(obj?: SdkRiskInsightsSummaryView): RiskInsightsSummaryView | undefined {}
}
