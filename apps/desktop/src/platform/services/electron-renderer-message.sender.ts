import { MessageSender, CommandDefinition } from "@bitwarden/common/platform/messaging";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { getCommand } from "@bitwarden/common/platform/messaging/internal";

export class ElectronRendererMessageSender implements MessageSender {
  send<T extends Record<string, unknown>>(
    commandDefinition: CommandDefinition<T> | string,
    payload: Record<string, unknown> | T = {},
  ): void {
    const command = getCommand(commandDefinition);
    ipc.platform.sendMessage(Object.assign({}, { command: command }, payload));
  }
}
