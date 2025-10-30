import { Jsonify } from "type-fest";

import { View } from "@bitwarden/common/models/view/view";

import { RiskInsightsMetrics } from "../domain/risk-insights-metrics";

export class RiskInsightsMetricsView implements View {
  totalApplicationCount: number = 0;
  totalAtRiskApplicationCount: number = 0;
  totalCriticalApplicationCount: number = 0;
  totalCriticalAtRiskApplicationCount: number = 0;
  totalMemberCount: number = 0;
  totalAtRiskMemberCount: number = 0;
  totalCriticalMemberCount: number = 0;
  totalCriticalAtRiskMemberCount: number = 0;
  totalPasswordCount: number = 0;
  totalAtRiskPasswordCount: number = 0;
  totalCriticalPasswordCount: number = 0;
  totalCriticalAtRiskPasswordCount: number = 0;

  constructor(data?: RiskInsightsMetrics) {
    if (data == null) {
      return;
    }
    this.totalApplicationCount = data.totalApplicationCount;
    this.totalAtRiskApplicationCount = data.totalAtRiskApplicationCount;
    this.totalCriticalApplicationCount = data.totalCriticalApplicationCount;
    this.totalCriticalAtRiskApplicationCount = data.totalCriticalAtRiskApplicationCount;
    this.totalMemberCount = data.totalMemberCount;
    this.totalAtRiskMemberCount = data.totalAtRiskMemberCount;
    this.totalCriticalMemberCount = data.totalCriticalMemberCount;
    this.totalCriticalAtRiskMemberCount = data.totalCriticalAtRiskMemberCount;
    this.totalPasswordCount = data.totalPasswordCount;
    this.totalAtRiskPasswordCount = data.totalAtRiskPasswordCount;
    this.totalCriticalPasswordCount = data.totalCriticalPasswordCount;
    this.totalCriticalAtRiskPasswordCount = data.totalCriticalAtRiskPasswordCount;
  }

  toJSON() {
    return this;
  }

  static fromJSON(
    obj: Partial<Jsonify<RiskInsightsMetricsView>>,
  ): RiskInsightsMetricsView | undefined {
    return Object.assign(new RiskInsightsMetricsView(), obj);
  }

  // toSdkRiskInsightsMetricsView(): SdkRiskInsightsMetricsView {}

  // static fromRiskInsightsMetricsView(obj?: SdkRiskInsightsMetricsView): RiskInsightsMetricsView | undefined {}
}
