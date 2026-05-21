import { map, share } from "rxjs";

import { Message, WEB_EXT_SENDER } from "@bitwarden/common/platform/messaging";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
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

      // Stamp the runtime-kernel-provided sender under a Symbol key. Symbols do
      // not survive structured-clone serialization, so a remote sender cannot
      // forge this attachment by including a `[WEB_EXT_SENDER]` property in
      // their payload — only this local adapter can write it. See invariant
      // §2.2 in personal/IMPL-extension-messaging-framework.md.
      (message as Record<PropertyKey, unknown>)[WEB_EXT_SENDER] = sender;

      return message;
    }),
    tagAsExternal<Message<Record<string, unknown>>>(),
    share(),
  );
};
