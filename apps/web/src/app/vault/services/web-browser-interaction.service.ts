import { DestroyRef, inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, filter, first, fromEvent, takeUntil, tap, timer } from "rxjs";

import { PopupPageUrls } from "@bitwarden/common/vault/enums";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

@Injectable({
  providedIn: "root",
})
export class WebBrowserInteractionService {
  destroyRef = inject(DestroyRef);

  private _extensionInstalled$ = new BehaviorSubject<boolean | null>(null);

  private checkForExtensionTimeout: number | undefined;

  private messages$ = fromEvent<MessageEvent>(window, "message").pipe(
    takeUntilDestroyed(this.destroyRef),
  );

  /** Emits the installation status of the extension. */
  extensionInstalled$ = this._extensionInstalled$.pipe(
    tap(this.checkForExtension.bind(this)),
    filter((installed) => installed !== null),
    takeUntilDestroyed(this.destroyRef),
  );

  /** Attempts to open the extension, rejects if the extension is not installed or it fails to open.  */
  openExtension = (page?: PopupPageUrls) => {
    return new Promise<void>((resolve, reject) => {
      if (this._extensionInstalled$.getValue() === false) {
        return reject("Extension is not installed");
      }

      this.messages$
        .pipe(
          filter((event) => event.data.command === VaultMessages.PopupOpened),
          first(),
          takeUntil(timer(1000)), // only wait a second for the extension to respond.
        )
        .subscribe({
          next: () => {
            resolve();
          },
          complete: () => {
            return reject("Extension failed to open");
          },
        });

      window.postMessage({ command: VaultMessages.OpenBrowserExtensionToPage, page });
    });
  };

  /** Sends a message via the window object to check if the extension is installed */
  private checkForExtension(isExtensionInstalled: boolean | null) {
    if (isExtensionInstalled !== null) {
      this.clearExtensionTimeout();
      return;
    }

    this.messages$
      .pipe(
        filter((event) => event.data.command === VaultMessages.HasBwInstalled),
        first(),
        takeUntil(timer(1000)), // Timeout after 1 second
      )
      .subscribe({
        next: () => {
          this._extensionInstalled$.next(true);
        },
        complete: () => {
          this._extensionInstalled$.next(false);
        },
      });

    window.postMessage({ command: VaultMessages.checkBwInstalled });
  }

  /** When populated, clears the check extension timeout and clears the value */
  private clearExtensionTimeout() {
    if (this.checkForExtensionTimeout) {
      window.clearTimeout(this.checkForExtensionTimeout);
      this.checkForExtensionTimeout = undefined;
    }
  }
}
