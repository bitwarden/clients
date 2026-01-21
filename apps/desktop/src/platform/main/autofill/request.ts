/**
 * Contains types for request/response messages from the host app to the provider over IPC.
 */
import { NativeAutofillUserVerificationRequest } from "./user-verification.request";

export type HostRequestDefinition = {
  namespace: string;
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

/** A list of all available host requests */
export type HostRequest = NativeAutofillUserVerificationRequest;