import { CommandDefinition, CommandOutput } from "./command";

export interface NativeAutofillUserVerificationCommand extends CommandDefinition {
  name: "user-verification";
  input: NativeAutofillUserVerificationParams;
  output: NativeAutofillUserVerificationResult;
}

export type NativeAutofillUserVerificationParams = {
  /** base64 string representing native window handle */
  windowHandle: string;
  /** base64 string representing native transaction context */
  transactionContext: string;
  displayHint: string;
  username: string;
};


export type NativeAutofillUserVerificationResult = CommandOutput<{}>;
