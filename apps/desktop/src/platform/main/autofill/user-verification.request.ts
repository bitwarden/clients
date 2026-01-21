import { HostRequestDefinition } from "./request";

export interface NativeAutofillUserVerificationRequest extends HostRequestDefinition {
  name: "user-verification";
  input: NativeAutofillUserVerificationParams;
  output: NativeAutofillUserVerificationResult;
}

export type NativeAutofillUserVerificationParams = {
  // /** base64 string representing native window handle */
  // windowHandle: string;
  // /** base64 string representing native transaction context */
  transactionId: number;
  displayHint: string;
  username: string;
};

export type NativeAutofillUserVerificationResult = {
  /** Whether the user was verified. */
  userVerified: boolean
}