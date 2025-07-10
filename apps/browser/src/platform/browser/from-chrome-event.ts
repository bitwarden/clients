// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { BrowserApi } from "./browser-api";

/**
 * Converts a Chrome event to an Observable stream.
 *
 * @typeParam T - The type of the event arguments.
 * @param event - The Chrome event to convert.
 * @returns An Observable stream of the event arguments.
 *
 * @remarks
 * This function creates an Observable stream that listens to a Chrome event and emits its arguments
 * whenever the event is triggered. If the event throws an error, the Observable will emit an error
 * notification with the error message.
 *
 * @example
 * ```typescript
 * const onMessage = fromChromeEvent(chrome.runtime.onMessage);
 * onMessage.subscribe((message) => console.log('Received message:', message));
 * ```
 */
export function fromChromeEvent<T extends unknown[]>(
  event: chrome.events.Event<(...args: T) => void>,
): Observable<T> {
  return new Observable<T>((subscriber) => {
    const handler = (...args: T) => {
      if (chrome.runtime.lastError) {
        subscriber.error(chrome.runtime.lastError);
        return;
      }

      subscriber.next(args);
    };

    BrowserApi.addListener(event, handler);
    return () => BrowserApi.removeListener(event, handler);
  });
}
