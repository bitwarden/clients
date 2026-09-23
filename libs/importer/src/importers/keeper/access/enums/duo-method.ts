export const DuoMethod = Object.freeze({
  Push: 1,
  Sms: 2,
  Voice: 3,
  Passcode: 4,
} as const);
export type DuoMethod = (typeof DuoMethod)[keyof typeof DuoMethod];
