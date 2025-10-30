import { RiskInsightsMetricsApi } from "../api/risk-insights-metrics.api";

export class RiskInsightsMetricsData {
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

  constructor(data?: RiskInsightsMetricsApi) {
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
}
