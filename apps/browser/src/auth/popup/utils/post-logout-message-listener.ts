import { filter, map, throwError, timeout } from "rxjs";

import { fromChromeEvent } from "../../../platform/browser/from-chrome-event";

/**
 * Listens to `switchAccountFinish` and `doneLoggingOut` messages and returns which message was heard.
 *
 * @example
 * ```ts
 * const messagePromise = firstValueFrom(postLogoutMessageListener$);
 * this.messagingService.send("logout");
 * const message = await messagePromise;
 * ```
 */
export const postLogoutMessageListener$ = fromChromeEvent<
  [message?: { command: "switchAccountFinish" | "doneLoggingOut" }]
>(chrome.runtime.onMessage).pipe(
  map(([message]) => message?.command),
  filter((command) => command === "switchAccountFinish" || command === "doneLoggingOut"),
  timeout({
    first: 60_000,
    with: () => throwError(() => new Error("Did not receive message from logout.")),
  }),
);
