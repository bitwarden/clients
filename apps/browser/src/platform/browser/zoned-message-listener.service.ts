// FIXME (PM-22628): angular imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { Injectable, NgZone } from "@angular/core";
import { Observable } from "rxjs";

import { BrowserApi } from "./browser-api";
import { runInsideAngular } from "./run-inside-angular.operator";

/**
 * This service is used for listening to messages from the background script.
 * It automatically runs all callbacks inside the Angular zone.
 * This should be used instead of `BrowserApi.messageListener` in all popup-components.
 * Not needed for services running in the background script.
 */
@Injectable({ providedIn: "root" })
export class ZonedMessageListenerService {
  constructor(private ngZone: NgZone) {}

  messageListener(
    name: string,
    callback: (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: any,
    ) => boolean | void,
  ) {
    BrowserApi.messageListener(name, (message, sender, sendResponse) => {
      return this.ngZone.run(() => callback(message, sender, sendResponse));
    });
  }

  messageListener$(): Observable<unknown> {
    return BrowserApi.messageListener$().pipe(runInsideAngular(this.ngZone));
  }
}
