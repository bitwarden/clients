import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsSummaryApi } from "../api/risk-insights-summary.api";
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
  totalMemberCount: number = 0;
  totalApplicationCount: number = 0;
  totalAtRiskMemberCount: number = 0;
  totalAtRiskApplicationCount: number = 0;
  totalCriticalApplicationCount: number = 0;
  totalCriticalMemberCount: number = 0;
  totalCriticalAtRiskMemberCount: number = 0;
  totalCriticalAtRiskApplicationCount: number = 0;

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

  static fromData(data: RiskInsightsSummaryData): RiskInsightsSummaryView {
    const view = new RiskInsightsSummaryView();
    view.totalMemberCount = data.totalMemberCount;
    view.totalApplicationCount = data.totalApplicationCount;
    view.totalAtRiskMemberCount = data.totalAtRiskMemberCount;
    view.totalAtRiskApplicationCount = data.totalAtRiskApplicationCount;
    view.totalCriticalApplicationCount = data.totalCriticalApplicationCount;
    view.totalCriticalMemberCount = data.totalCriticalMemberCount;
    view.totalCriticalAtRiskMemberCount = data.totalCriticalAtRiskMemberCount;
    view.totalCriticalAtRiskApplicationCount = data.totalCriticalAtRiskApplicationCount;
    return view;
  }

  static fromJSON(obj: Partial<DeepJsonify<RiskInsightsSummaryView>>): RiskInsightsSummaryView {
    return Object.assign(new RiskInsightsSummaryView(), obj);
  }

  // [TODO] SDK Mapping
  // toSdkRiskInsightsSummaryView(): SdkRiskInsightsSummaryView {}
  // static fromRiskInsightsSummaryView(obj?: SdkRiskInsightsSummaryView): RiskInsightsSummaryView | undefined {}
}
