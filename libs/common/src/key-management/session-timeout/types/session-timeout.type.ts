export type SessionTimeoutAction = null | "lock" | "logOut";
export type SessionTimeoutType =
  | null
  | "never"
  | "onAppRestart"
  | "onSystemLock"
  | "immediately"
  | "custom";
