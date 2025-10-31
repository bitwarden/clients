import { RpcError } from "./error";
import { BatchCommand, deserializeSymbol, Response } from "./protocol";
import { ReferenceStore } from "./reference-store";

const PRIMITIVE_TYPES = ["string", "number", "boolean", "undefined"];

/**
 * Executes a batch of commands on the target object.
 *
 * The response depends on the return type of the last command in the batch.

 * - Return-by-value will be used if:
 *  - The last command returns a primitive value (string, number, boolean, null, undefined).
 *  - The last command was explicitly a 'transfer' command.
 * - Return-by-reference will be used for everything else.
 *
 * @param target The target object to execute commands on.
 * @param commands The array of commands to execute.
 * @returns A promise that resolves to the response of the batch execution.
 */
export async function executeBatchCommands(
  target: any,
  commands: BatchCommand[],
  referenceStore: ReferenceStore,
): Promise<Response> {
  if (commands.length === 0) {
    return {
      status: "error",
      error: new RpcError("Empty batch command list is not allowed."),
    };
  }

  let currentTarget = target;
  let lastResult: any;

  try {
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];

      if (command.method === "get" && "propertyName" in command) {
        lastResult = await currentTarget[command.propertyName];

        if (typeof lastResult === "function") {
          lastResult = lastResult.bind(currentTarget);
        }

        currentTarget = lastResult;
      } else if (command.method === "get" && "propertySymbol" in command) {
        const symbol = deserializeSymbol(command.propertySymbol);
        lastResult = await currentTarget[symbol];

        if (typeof lastResult === "function") {
          lastResult = lastResult.bind(currentTarget);
        }

        currentTarget = lastResult;
      } else if (command.method === "apply") {
        lastResult = await currentTarget(...command.args);
        currentTarget = lastResult;
      } else if (command.method === "transfer") {
        // For transfer, we just mark the last result as transferable.
        // Actual transfer logic would depend on the RPC implementation.
        lastResult = currentTarget;
        break;
      } else {
        throw new Error(`Unsupported command method: ${(command as any).method}`);
      }
    }
  } catch (error) {
    return { status: "error", error };
  }

  if (PRIMITIVE_TYPES.includes(typeof lastResult) || lastResult === null) {
    return { status: "success", result: { type: "value", value: lastResult } };
  }

  if (commands[commands.length - 1].method === "transfer") {
    return { status: "success", result: { type: "value", value: lastResult } };
  }

  return {
    status: "success",
    result: {
      type: "reference",
      referenceId: referenceStore.store(lastResult),
      objectType: lastResult?.constructor?.name,
    },
  };
}
