import { fromEventPattern, share } from "rxjs";

import { Message } from "@bitwarden/common/platform/messaging";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { tagAsExternal } from "@bitwarden/common/platform/messaging/internal";

/**
 * Creates an observable that when subscribed to will listen to messaging events through IPC.
 * @returns An observable stream of messages.
 */
export const fromIpcMessaging = () => {
  return fromEventPattern<Message<Record<string, unknown>>>(
    (handler) => ipc.platform.onMessage.addListener(handler),
    (handler) => ipc.platform.onMessage.removeListener(handler),
  ).pipe(tagAsExternal(), share());
};
