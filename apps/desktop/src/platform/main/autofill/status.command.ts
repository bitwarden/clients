import { CommandDefinition, CommandOutput } from "./command";

export interface NativeAutofillStatusCommand extends CommandDefinition {
  name: "status";
  input: NativeAutofillStatusParams;
  output: NativeAutofillStatusResult;
}

export type NativeAutofillStatusParams = Record<string, never>;

export type NativeAutofillStatusResult = CommandOutput<{
  support: {
    fido2: boolean;
    password: boolean;
    incrementalUpdates: boolean;
  };
  state: {
    enabled: boolean;
  };
}>;
