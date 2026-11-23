import { ipcMain } from "electron";
import { fromEventPattern, share } from "rxjs";

import { Message } from "@bitwarden/common/platform/messaging";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { tagAsExternal } from "@bitwarden/common/platform/messaging/internal";

const MESSAGING_SERVICE_CHANNEL = "messagingService";

/**
 * Creates an observable of the messages the renderer sends main over the same `messagingService`
 * IPC channel {@link MessagingMain} already listens on.
 */
export const fromIpcMainMessaging = () => {
  return fromEventPattern<Message<Record<string, unknown>>>(
    (handler) => {
      const listener = (_event: unknown, message: Message<Record<string, unknown>>) =>
        handler(message);
      ipcMain.on(MESSAGING_SERVICE_CHANNEL, listener);
      return listener;
    },
    (listener) => ipcMain.removeListener(MESSAGING_SERVICE_CHANNEL, listener),
  ).pipe(tagAsExternal(), share());
};
