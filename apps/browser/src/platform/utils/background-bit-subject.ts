import { BrowserApi } from "../browser/browser-api";

import { BrowserBitSubject } from "./browser-bit-subject";

export class BackgroundBitSubject<T = never> extends BrowserBitSubject<T> {
  constructor(serviceObservableName: string, initializer: (obj: Required<T>) => T) {
    super(serviceObservableName, initializer);

    BrowserApi.messageListener(
      this.fromForegroundMessageName,
      (message: { command: string; data: Required<T> }) => {
        if (message.command !== this.fromForegroundMessageName) {
          return;
        }

        this.next(this.initializer(message.data));
      }
    );

    BrowserApi.messageListener(this.requestInitMessageName, (message, sender, response) => {
      if (message.command !== this.requestInitMessageName || !this._initialized) {
        return;
      }
      return response(this.value);
    });
  }

  override next(value: T): void {
    super.next(value);
    BrowserApi.sendMessage(this.fromBackgroundMessageName, { data: value });
  }
}
