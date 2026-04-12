/** A preset duration (in hours) for deletion. */
export const DatePreset = Object.freeze({
  /** One-hour duration. */
  OneHour: 1,
  /** One-day duration (24 hours). */
  OneDay: 24,
  /** Two-day duration (48 hours). */
  TwoDays: 48,
  /** Three-day duration (72 hours). */
  ThreeDays: 72,
  /** Seven-day duration (168 hours). */
  SevenDays: 168,
  /** Fourteen-day duration (336 hours). */
  FourteenDays: 336,
  /** Thirty-day duration (720 hours). */
  ThirtyDays: 720,
} as const);

/** A preset duration (in hours) for deletion. */
export type DatePreset = (typeof DatePreset)[keyof typeof DatePreset];

export interface DatePresetSelectOption {
  name: string;
  value: DatePreset | string;
}

const namesByDatePreset = new Map<DatePreset, keyof typeof DatePreset>(
  Object.entries(DatePreset).map(([k, v]) => [v as DatePreset, k as keyof typeof DatePreset]),
);

/**
 * Runtime type guard to verify a value is a valid DatePreset.
 */
export function isDatePreset(value: unknown): value is DatePreset {
  return namesByDatePreset.has(value as DatePreset);
}

/**
 * Safe converter to DatePreset (numeric preset), returns undefined for invalid inputs.
 */
export function asDatePreset(value: unknown): DatePreset | undefined {
  return isDatePreset(value) ? (value as DatePreset) : undefined;
}
