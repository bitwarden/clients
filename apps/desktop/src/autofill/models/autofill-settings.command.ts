import { AutofillCommandDefinition, AutofillCommandOutput } from "./autofill-command";

/** Asks the user to turn on the app as a credential provider. */
export interface AutofillRequestEnableCommand extends AutofillCommandDefinition {
  name: "requestEnable";
  input: Record<string, never>;
  output: AutofillRequestEnableResult;
}

/**
 * `supported` is false when the OS cannot prompt the user (Windows, and macOS before 15), in which
 * case `enabled` is meaningless.
 */
export type AutofillRequestEnableResult = AutofillCommandOutput<{
  supported: boolean;
  enabled: boolean;
}>;

/** Opens the OS settings for credential providers. */
export interface AutofillOpenSettingsCommand extends AutofillCommandDefinition {
  name: "openSettings";
  input: Record<string, never>;
  output: AutofillCommandOutput<Record<string, never>>;
}
