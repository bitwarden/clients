import { RiskOverTimeDataView } from "../risk-over-time.types";

/**
 * Mock risk-over-time response data for UI development.
 *
 * TODO: Remove this file when PM-28531 server endpoint is deployed and
 * getRiskOverTime$ is wired to the real API. [PM-28529]
 */

/**
 * Returns a mock risk-over-time API response matching the proposed
 * server contract from PM-28531. Always returns 6 data points with
 * timestamps and counts that vary by dataView for visual distinction.
 */
export function getMockRiskOverTimeResponse(
  timeframe: string,
  dataView: string,
): Record<string, unknown> {
  const now = new Date();
  const intervals = getIntervalMs(timeframe);
  const scale = getDataViewScale(dataView);

  const dataPoints = Array.from({ length: 6 }, (_, i) => {
    const timestamp = new Date(now.getTime() - intervals * (5 - i));
    const baseAtRisk = scale.baseAtRisk + Math.round(Math.sin(i * 0.8) * scale.variance);
    const baseTotal = scale.baseTotal + i * scale.growth;
    return {
      timestamp: timestamp.toISOString(),
      atRisk: Math.max(0, baseAtRisk),
      total: baseTotal,
    };
  });

  return {
    timeframe: getResponseTimeframe(timeframe),
    dataView,
    dataPoints,
  };
}

function getIntervalMs(timeframe: string): number {
  const day = 86_400_000;
  switch (timeframe) {
    case "month":
      return 5 * day; // ~5 days between points
    case "3mo":
      return 15 * day; // ~2 weeks between points
    case "6mo":
      return 30 * day; // ~1 month between points
    case "12mo":
      return 60 * day; // ~2 months between points
    case "all":
      return 90 * day; // ~3 months between points
    default:
      return 30 * day;
  }
}

function getResponseTimeframe(timeframe: string): string {
  switch (timeframe) {
    case "month":
      return "past_month";
    case "3mo":
      return "past_3_months";
    case "6mo":
      return "past_6_months";
    case "12mo":
      return "past_12_months";
    case "all":
      return "all_time";
    default:
      return timeframe;
  }
}

function getDataViewScale(dataView: string): {
  baseAtRisk: number;
  baseTotal: number;
  variance: number;
  growth: number;
} {
  switch (dataView) {
    case RiskOverTimeDataView.Applications:
      return { baseAtRisk: 48, baseTotal: 150, variance: 8, growth: 3 };
    case RiskOverTimeDataView.Passwords:
      return { baseAtRisk: 156, baseTotal: 580, variance: 25, growth: 12 };
    case RiskOverTimeDataView.Members:
      return { baseAtRisk: 18, baseTotal: 52, variance: 4, growth: 2 };
    default:
      return { baseAtRisk: 50, baseTotal: 200, variance: 10, growth: 5 };
  }
}
