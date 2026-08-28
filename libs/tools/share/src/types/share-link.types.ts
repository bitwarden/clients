export const ExpiryOption = Object.freeze({
  OneHour: 1,
  OneDay: 24,
  TwoDays: 48,
  ThreeDays: 72,
  SevenDays: 168,
  FourteenDays: 336,
  ThirtyDays: 720,
} as const);

export type ExpiryOption = (typeof ExpiryOption)[keyof typeof ExpiryOption];

export interface ExpiryChoice {
  label: string;
  value: ExpiryOption;
}
