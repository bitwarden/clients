// Client-side timeframe options for the risk-over-time widget.
// These are NOT sent to the server — they are converted to startDate/endDate
// via timeframeToDateRange() before calling the summary endpoint.
export const RiskOverTimeTimeframe = Object.freeze({
  Month: "month",
  ThreeMonths: "3mo",
  SixMonths: "6mo",
  TwelveMonths: "12mo",
  All: "all",
} as const);

export type RiskOverTimeTimeframe =
  (typeof RiskOverTimeTimeframe)[keyof typeof RiskOverTimeTimeframe];

/**
 * Type guard: validates a raw value is a valid RiskOverTimeTimeframe.
 * Use at system boundaries (user input, deserialization).
 */
export function isRiskOverTimeTimeframe(value: string): value is RiskOverTimeTimeframe {
  return Object.values(RiskOverTimeTimeframe).includes(value as RiskOverTimeTimeframe);
}

// Client-side data view options for the risk-over-time widget.
// These are NOT sent to the server — they determine which metric pair
// (atRisk/total) to extract from decrypted OrganizationReportSummary data.
export const RiskOverTimeDataView = Object.freeze({
  Applications: "applications",
  Members: "members",
} as const);

export type RiskOverTimeDataView = (typeof RiskOverTimeDataView)[keyof typeof RiskOverTimeDataView];

/**
 * Type guard: validates a raw value is a valid RiskOverTimeDataView.
 * Use at system boundaries (user input, deserialization).
 */
export function isRiskOverTimeDataView(value: string): value is RiskOverTimeDataView {
  return Object.values(RiskOverTimeDataView).includes(value as RiskOverTimeDataView);
}

/**
 * Converts a UI timeframe selection into a startDate/endDate range
 * for the server's summary-by-date-range endpoint.
 *
 * The server endpoint is: GET /reports/organizations/{orgId}/data/summary?startDate=...&endDate=...
 * It returns up to 6 evenly-spaced encrypted summary entries within the range.
 */
export function timeframeToDateRange(timeframe: RiskOverTimeTimeframe): {
  startDate: Date;
  endDate: Date;
} {
  const endDate = new Date();
  const startDate = new Date();

  switch (timeframe) {
    case RiskOverTimeTimeframe.Month:
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case RiskOverTimeTimeframe.ThreeMonths:
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case RiskOverTimeTimeframe.SixMonths:
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case RiskOverTimeTimeframe.TwelveMonths:
      startDate.setMonth(startDate.getMonth() - 12);
      break;
    case RiskOverTimeTimeframe.All:
      // Use a far-back date to capture all available data
      startDate.setFullYear(startDate.getFullYear() - 5);
      break;
  }

  return { startDate, endDate };
}
