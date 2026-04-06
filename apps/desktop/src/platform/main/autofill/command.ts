import { NativeAutofillStatusCommand } from "./status.command";
import { NativeAutofillSyncCommand } from "./sync.command";

export type CommandDefinition = {
  namespace: string;
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

export type CommandOutput<SuccessOutput> =
  | {
      type: "error";
      error: string;
    }
  | { type: "success"; value: SuccessOutput };

export type IpcCommandInvoker<C extends CommandDefinition> = (
  params: C["input"],
) => Promise<CommandOutput<C["output"]>>;

/** A list of all available commands */
export type Command = NativeAutofillSyncCommand | NativeAutofillStatusCommand;
