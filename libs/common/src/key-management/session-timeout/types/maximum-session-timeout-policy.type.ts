import { SessionTimeoutAction, SessionTimeoutType } from "./session-timeout.type";

export interface MaximumSessionTimeoutPolicyData {
  type?: SessionTimeoutType;
  minutes: number;
  action?: SessionTimeoutAction;
}
