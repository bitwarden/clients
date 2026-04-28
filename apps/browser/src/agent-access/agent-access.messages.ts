import { CommandDefinition } from "@bitwarden/common/platform/messaging";

/** Popup → Background: request to perform an agent-access operation. */
export const AGENT_ACCESS_COMMAND = new CommandDefinition<{
  requestId: string;
  type: string;
  [key: string]: any;
}>("agentAccessCommand");

/** Background → Popup: result of an agent-access operation. */
export const AGENT_ACCESS_RESULT = new CommandDefinition<{
  requestId: string;
  result?: any;
  error?: string;
}>("agentAccessResult");

/** Background → Popup: event broadcast from the WASM UserClient event loop. */
export const AGENT_ACCESS_EVENT = new CommandDefinition<{ event: any }>("agentAccessEvent");
