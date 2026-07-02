import { fromEventPattern, share } from "rxjs";

import { Message, tagAsExternal } from "@bitwarden/messaging";

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
