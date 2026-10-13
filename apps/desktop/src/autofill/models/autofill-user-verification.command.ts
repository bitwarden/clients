import { AutofillCommandDefinition, AutofillCommandOutput } from "./autofill-command";

export interface AutofillUserVerificationCommand extends AutofillCommandDefinition {
  name: "userVerification";
  input: AutofillUserVerificationParams;
  output: AutofillUserVerificationResult;
}

export type AutofillUserVerificationParams =
  WindowsAutofillUserVerificationParams | MacOsAutofillUserVerificationParams;

export type WindowsAutofillUserVerificationParams = {
  /** Base64 encoded bytes of the handle of the window to attach the prompt to. */
  windowHandle: string;
  /** Opaque context binding the prompt to the WebAuthn operation that needs it. */
  transactionContext: string;
  displayHint: string;
  username: string;
};

export type MacOsAutofillUserVerificationParams = {
  displayHint: string;
  username: string;
};

/**
 * Whether the user completed verification or dismissed the prompt.
 *
 * Dismissal is reported as a successful command with a `cancelled` outcome so
 * that callers don't have to recognize platform-specific error strings.
 */
export type AutofillUserVerificationOutcome = "verified" | "cancelled";

export type AutofillUserVerificationResult = AutofillCommandOutput<{
  outcome: AutofillUserVerificationOutcome;
}>;
