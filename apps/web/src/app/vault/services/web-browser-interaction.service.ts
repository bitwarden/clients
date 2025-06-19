import { DestroyRef, inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, filter, fromEvent, map, race, take, tap, timer } from "rxjs";

import { ExtensionPageUrls } from "@bitwarden/common/vault/enums";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

/**
 * The amount of time in milliseconds to wait for a response from the browser extension.
 * NOTE: This value isn't computed by any means, it is just a reasonable timeout for the extension to respond.
 */
const MESSAGE_RESPONSE_TIMEOUT_MS = 1500;

@Injectable({
  providedIn: "root",
})
export class WebBrowserInteractionService {
  destroyRef = inject(DestroyRef);

  private _extensionInstalled$ = new BehaviorSubject<boolean | null>(null);

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
  openExtension = (page?: ExtensionPageUrls) => {
    return new Promise<void>((resolve, reject) => {
      if (this._extensionInstalled$.getValue() === false) {
        return reject("Extension is not installed");
      }

      race(
        this.messages$.pipe(
          filter((event) => event.data.command === VaultMessages.PopupOpened),
          map(() => true),
        ),
        timer(MESSAGE_RESPONSE_TIMEOUT_MS).pipe(map(() => false)),
      )
        .pipe(take(1))
        .subscribe((didOpen) => {
          if (!didOpen) {
            return reject("Failed to open the extension");
          }

          resolve();
        });

      window.postMessage({ command: VaultMessages.OpenBrowserExtensionToPage, page });
    });
  };

  /** Sends a message via the window object to check if the extension is installed */
  private checkForExtension(isExtensionInstalled: boolean | null) {
    if (isExtensionInstalled !== null) {
      return;
    }

    race(
      this.messages$.pipe(
        filter((event) => event.data.command === VaultMessages.HasBwInstalled),
        map(() => true),
      ),
      timer(MESSAGE_RESPONSE_TIMEOUT_MS).pipe(map(() => false)),
    )
      .pipe(take(1))
      .subscribe((installed) => {
        this._extensionInstalled$.next(installed);
      });

    window.postMessage({ command: VaultMessages.checkBwInstalled });
  }
}
