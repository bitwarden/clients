/**
 * @deprecated instead use `AuthenticationStatuses` constants and `AuthenticationStatusValue` type over unsafe typescript enums
 **/
export enum AuthenticationStatus {
  LoggedOut = 0,
  Locked = 1,
  Unlocked = 2,
}

export const AuthenticationStatuses = {
  LoggedOut: 0,
  Locked: 1,
  Unlocked: 2,
} as const;

export type AuthenticationStatusValue =
  (typeof AuthenticationStatuses)[keyof typeof AuthenticationStatuses];
