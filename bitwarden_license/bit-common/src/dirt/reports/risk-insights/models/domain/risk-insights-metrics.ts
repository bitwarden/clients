import Domain from "@bitwarden/common/platform/models/domain/domain-base";

import { RiskInsightsMetricsData } from "../data/risk-insights-metrics.data";

export class RiskInsightsMetrics extends Domain {
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

  constructor(data?: RiskInsightsMetricsData) {
    super();
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

  toRiskInsightsMetricsData(): RiskInsightsMetricsData {
    const m = new RiskInsightsMetricsData();
    m.totalApplicationCount = this.totalApplicationCount;
    m.totalAtRiskApplicationCount = this.totalAtRiskApplicationCount;
    m.totalCriticalApplicationCount = this.totalCriticalApplicationCount;
    m.totalCriticalAtRiskApplicationCount = this.totalCriticalAtRiskApplicationCount;
    m.totalMemberCount = this.totalMemberCount;
    m.totalAtRiskMemberCount = this.totalAtRiskMemberCount;
    m.totalCriticalMemberCount = this.totalCriticalMemberCount;
    m.totalCriticalAtRiskMemberCount = this.totalCriticalAtRiskMemberCount;
    m.totalPasswordCount = this.totalPasswordCount;
    m.totalAtRiskPasswordCount = this.totalAtRiskPasswordCount;
    m.totalCriticalPasswordCount = this.totalCriticalPasswordCount;
    m.totalCriticalAtRiskPasswordCount = this.totalCriticalAtRiskPasswordCount;

    return m;
  }
}
