import { AutofillStatusCommand } from "./autofill-status.command";
import { AutofillSyncCommand } from "./autofill-sync.command";

export type AutofillCommandDefinition = {
  namespace: string;
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

export type AutofillCommandOutput<SuccessOutput> =
  | {
      type: "error";
      error: string;
    }
  | { type: "success"; value: SuccessOutput };

export type IpcCommandInvoker<C extends AutofillCommandDefinition> = (
  params: C["input"],
) => Promise<AutofillCommandOutput<C["output"]>>;

/** A list of all available commands */
export type AutofillCommand = AutofillSyncCommand | AutofillStatusCommand;
