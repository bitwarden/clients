import { DestroyRef, inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  concat,
  filter,
  fromEvent,
  interval,
  map,
  Observable,
  of,
  race,
  shareReplay,
  switchMap,
  take,
  takeWhile,
  tap,
  timer,
} from "rxjs";

import { ExtensionPageUrls } from "@bitwarden/common/vault/enums";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

/**
 * The amount of time in milliseconds to wait for a response from the browser extension. A longer duration is
 * used to allow for the extension to open and then emit to the message.
 * NOTE: This value isn't computed by any means, it is just a reasonable timeout for the extension to respond.
 */
const OPEN_RESPONSE_TIMEOUT_MS = 2000;

/**
 * Timeout for checking if the extension is installed.
 *
 * A shorter timeout is used to avoid waiting for too long for the extension. The listener for
 * checking the installation runs in the background scripts so the response should be relatively quick.
 */
const CHECK_FOR_EXTENSION_TIMEOUT_MS = 25;

@Injectable({
  providedIn: "root",
})
export class WebBrowserInteractionService {
  destroyRef = inject(DestroyRef);

  private messages$ = fromEvent<MessageEvent>(window, "message").pipe(
    takeUntilDestroyed(this.destroyRef),
  );

  /** Emits the installation status of the extension. */
  extensionInstalled$: Observable<boolean> = this.checkForExtension().pipe(
    switchMap((installed) => {
      if (installed) {
        return of(true);
      }

      return concat(
        of(false),
        interval(2500).pipe(
          switchMap(() => this.checkForExtension()),
          takeWhile((installed) => !installed, true),
          filter((installed) => installed),
        ),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Attempts to open the extension, rejects if the extension is not installed or it fails to open.  */
  openExtension = (url?: ExtensionPageUrls) => {
    return new Promise<void>((resolve, reject) => {
      race(
        this.messages$.pipe(
          filter((event) => event.data.command === VaultMessages.PopupOpened),
          map(() => true),
        ),
        timer(OPEN_RESPONSE_TIMEOUT_MS).pipe(map(() => false)),
      )
        .pipe(take(1))
        .subscribe((didOpen) => {
          if (!didOpen) {
            return reject("Failed to open the extension");
          }

          resolve();
        });

      window.postMessage({ command: VaultMessages.OpenBrowserExtensionToUrl, url });
    });
  };

  /** Sends a message via the window object to check if the extension is installed */
  private checkForExtension(): Observable<boolean> {
    const checkForExtension$ = race(
      this.messages$.pipe(
        filter((event) => event.data.command === VaultMessages.HasBwInstalled),
        map(() => true),
      ),
      timer(CHECK_FOR_EXTENSION_TIMEOUT_MS).pipe(map(() => false)),
    ).pipe(
      tap({
        subscribe: () => {
          window.postMessage({ command: VaultMessages.checkBwInstalled });
        },
      }),
      take(1),
    );

    return checkForExtension$;
  }
}
