/**
 * Risk metric types
 */
export const RiskMetricType = {
  Applications: "applications",
  Items: "items",
  Members: "members",
} as const;

export type RiskMetricType = (typeof RiskMetricType)[keyof typeof RiskMetricType];

/**
 * Time period selection
 */
export const TimePeriod = {
  ThreeMonths: "3months",
  SixMonths: "6months",
  TwelveMonths: "12months",
} as const;

export type TimePeriod = (typeof TimePeriod)[keyof typeof TimePeriod];

/**
 * Interface for risk over time data
 */
export interface RiskOverTimeData {
  /** Labels for x-axis (e.g., month names) */
  labels: string[];

  /** Data points for current period */
  currentPeriod: number[];

  /** Data points for previous period (last year) */
  previousPeriod: number[];

  /** The metric type this data represents */
  metricType: RiskMetricType;

  /** The time period this data represents */
  timePeriod: TimePeriod;
}

/**
 * Interface for API response containing risk over time data
 */
export interface RiskOverTimeApiResponse {
  applications?: RiskOverTimeData;
  items?: RiskOverTimeData;
  members?: RiskOverTimeData;
}
