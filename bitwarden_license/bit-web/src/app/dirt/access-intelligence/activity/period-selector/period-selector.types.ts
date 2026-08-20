/**
 * Time periods for the risk-over-time chart period selector.
 * Uses const object pattern per ADR-0025 (no TypeScript enums).
 */
export const TimePeriod = Object.freeze({
  PastMonth: "month",
  Past3Months: "3mo",
  Past6Months: "6mo",
  PastYear: "12mo",
  AllTime: "all",
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
  { value: TimePeriod.Past3Months, labelKey: "past3Months" },
  { value: TimePeriod.Past6Months, labelKey: "past6Months" },
  { value: TimePeriod.PastYear, labelKey: "pastYear" },
  { value: TimePeriod.AllTime, labelKey: "allTime" },
];
