import { DestroyRef, inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, filter, fromEvent, tap } from "rxjs";

import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

@Injectable()
export class WebBrowserInteractionService {
  destroyRef = inject(DestroyRef);

  private _extensionInstalled$ = new BehaviorSubject<boolean | null>(null);

  private checkForExtensionTimeout: number | undefined;

  constructor() {
    fromEvent<MessageEvent>(window, "message")
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        void this.processMessages(event);
      });
  }

  extensionInstalled$ = this._extensionInstalled$.pipe(
    tap(this.checkForExtension.bind(this)),
    filter((installed) => installed !== null),
    takeUntilDestroyed(this.destroyRef),
  );

  /** Sends a message via the window object to check if the extension is installed */
  private checkForExtension(isExtensionInstalled: boolean | null) {
    if (isExtensionInstalled !== null) {
      this.clearExtensionTimeout();
      return;
    }

    window.postMessage({ command: VaultMessages.checkBwInstalled });

    this.clearExtensionTimeout();
    this.checkForExtensionTimeout = window.setTimeout(() => {
      this._extensionInstalled$.next(false);
      this.clearExtensionTimeout();
    }, 1000);
  }

  /** Process window message events */
  private processMessages(event: any) {
    if (event.data.command === VaultMessages.HasBwInstalled) {
      this._extensionInstalled$.next(true);
    }
  }

  /** When populated, clears the check extension timeout and clears the value */
  private clearExtensionTimeout() {
    if (this.checkForExtensionTimeout) {
      window.clearTimeout(this.checkForExtensionTimeout);
      this.checkForExtensionTimeout = undefined;
    }
  }
}
