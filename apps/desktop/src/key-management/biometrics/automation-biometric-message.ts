import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus } from "@bitwarden/key-management";

export type AutomationBiometricRequestType = "authenticate" | "unlock";

export interface AutomationBiometricRequest {
  id: string;
  type: AutomationBiometricRequestType;
  userId?: UserId;
}

export const AutomationBiometricAction = Object.freeze({
  SetStatus: "setStatus",
  ListPending: "listPending",
  Approve: "approve",
  Deny: "deny",
} as const);
export type AutomationBiometricAction =
  (typeof AutomationBiometricAction)[keyof typeof AutomationBiometricAction];

export type AutomationBiometricMessage = {
  action: AutomationBiometricAction;
  status?: BiometricsStatus;
  id?: string;
};

export const AUTOMATION_BIOMETRIC_CHANNEL = "automation.biometric";

/** What happened to a request, pushed from the main process for visibility in the UI. */
export const AutomationBiometricEventType = Object.freeze({
  Requested: "requested",
  Approved: "approved",
  Denied: "denied",
} as const);
export type AutomationBiometricEventType =
  (typeof AutomationBiometricEventType)[keyof typeof AutomationBiometricEventType];

export type AutomationBiometricEvent = {
  type: AutomationBiometricEventType;
  request: AutomationBiometricRequest;
};

export const AUTOMATION_BIOMETRIC_EVENT_CHANNEL = "automation.biometric.event";
