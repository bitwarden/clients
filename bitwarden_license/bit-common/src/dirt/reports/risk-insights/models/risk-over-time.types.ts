// TODO: Verify these values match the finalized server query parameter values
// when PM-28531 is implemented. Current values are from the proposed contract. [PM-28529]
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

// TODO: Verify these values match the finalized server query parameter values
// when PM-28531 is implemented. Current values are from the proposed contract. [PM-28529]
export const RiskOverTimeDataView = Object.freeze({
  Applications: "applications",
  Passwords: "passwords",
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
