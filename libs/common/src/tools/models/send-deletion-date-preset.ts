/** A preset duration (in hours) for Send deletion. */
export const SendDeletionDatePreset = Object.freeze({
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
export type SendDeletionDatePreset =
  (typeof SendDeletionDatePreset)[keyof typeof SendDeletionDatePreset];

export interface DatePresetSelectOption {
  name: string;
  value: SendDeletionDatePreset | string;
}

const namesByDatePreset = new Map<SendDeletionDatePreset, keyof typeof SendDeletionDatePreset>(
  Object.entries(SendDeletionDatePreset).map(([k, v]) => [
    v as SendDeletionDatePreset,
    k as keyof typeof SendDeletionDatePreset,
  ]),
);

/**
 * Runtime type guard to verify a value is a valid SendDeletionDatePreset.
 */
export function isDatePreset(value: unknown): value is SendDeletionDatePreset {
  return namesByDatePreset.has(value as SendDeletionDatePreset);
}

/**
 * Safe converter to SendDeletionDatePreset (numeric preset), returns undefined for invalid inputs.
 */
export function asDatePreset(value: unknown): SendDeletionDatePreset | undefined {
  return isDatePreset(value) ? value : undefined;
}
