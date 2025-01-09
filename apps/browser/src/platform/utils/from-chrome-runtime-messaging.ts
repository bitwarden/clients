import { map, share } from "rxjs";

import { Message } from "@bitwarden/common/platform/messaging";
import { tagAsExternal } from "@bitwarden/common/platform/messaging/internal";

import { fromChromeEvent } from "../browser/from-chrome-event";

/**
 * Creates an observable that listens to messages through `chrome.runtime.onMessage`.
 * @returns An observable stream of messages.
 */
export const fromChromeRuntimeMessaging = () => {
  return fromChromeEvent(chrome.runtime.onMessage).pipe(
    map(([message, sender]) => {
      message ??= {};

      // Force the sender onto the message as long as we won't overwrite anything
      if (!("webExtSender" in message)) {
        message.webExtSender = sender;
      }

      return message;
    }),
    tagAsExternal<Message<Record<string, unknown>>>(),
    share(),
  );
};
