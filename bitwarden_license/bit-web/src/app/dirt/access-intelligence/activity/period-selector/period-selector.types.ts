/**
 * Time periods for the risk-over-time chart period selector.
 * Uses const object pattern per ADR-0025 (no TypeScript enums).
 */
export const TimePeriod = Object.freeze({
  PastMonth: "month",
  Last3Months: "3mo",
  Last6Months: "6mo",
  Last12Months: "12mo",
  All: "all",
} as const);

export type TimePeriod = (typeof TimePeriod)[keyof typeof TimePeriod];

/** Default period when no selection is provided */
export const DEFAULT_TIME_PERIOD: TimePeriod = TimePeriod.PastMonth;

/** Display configuration for each period option */
export interface PeriodOption {
  value: TimePeriod;
  labelKey: string;
}

/** Ordered list of period options for rendering */
export const PERIOD_OPTIONS: PeriodOption[] = [
  { value: TimePeriod.PastMonth, labelKey: "pastMonth" },
  { value: TimePeriod.Last3Months, labelKey: "last3Months" },
  { value: TimePeriod.Last6Months, labelKey: "last6Months" },
  { value: TimePeriod.Last12Months, labelKey: "last12Months" },
  { value: TimePeriod.All, labelKey: "all" },
];
