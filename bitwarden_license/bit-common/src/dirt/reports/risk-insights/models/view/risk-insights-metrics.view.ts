import { Jsonify } from "type-fest";

import { View } from "@bitwarden/common/models/view/view";

import { RiskInsightsMetrics } from "../domain/risk-insights-metrics";

export class RiskInsightsMetricsView implements View {
  totalApplicationCount: number;
  totalAtRiskApplicationCount: number;
  totalCriticalApplicationCount: number;
  totalCriticalAtRiskApplicationCount: number;
  totalMemberCount: number;
  totalAtRiskMemberCount: number;
  totalCriticalMemberCount: number;
  totalCriticalAtRiskMemberCount: number;
  totalPasswordCount: number;
  totalAtRiskPasswordCount: number;
  totalCriticalPasswordCount: number;
  totalCriticalAtRiskPasswordCount: number;

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
