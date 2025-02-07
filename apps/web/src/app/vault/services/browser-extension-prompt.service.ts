import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, fromEvent } from "rxjs";

import { AnonLayoutWrapperDataService } from "@bitwarden/auth/angular";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

export enum BrowserPromptState {
  Loading = "loading",
  Error = "error",
  Success = "success",
}

@Injectable({
  providedIn: "root",
})
export class BrowserExtensionPromptService {
  private _pageState$ = new BehaviorSubject<BrowserPromptState>(BrowserPromptState.Loading);

  /** Current state of the prompt page */
  pageState$ = this._pageState$.asObservable();

  /** Timeout identifier for extension check */
  private extensionCheckTimeout: number | undefined;

  constructor(
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private destroyRef: DestroyRef,
  ) {}

  start(): void {
    this.checkForBrowserExtension();
  }

  /** Post a message to the extension to open */
  openExtension() {
    window.postMessage({ command: VaultMessages.OpenPopup });
  }

  /** Send message checking for the browser extension */
  private checkForBrowserExtension() {
    fromEvent<MessageEvent>(window, "message")
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        void this.getMessages(event);
      });

    window.postMessage({ command: VaultMessages.checkBwInstalled });

    // Wait a second for the extension to respond and open, else show the error state
    this.extensionCheckTimeout = window.setTimeout(() => {
      this.setErrorState();
    }, 1000);
  }

  /** Handle window message events */
  private getMessages(event: any) {
    if (event.data.command === VaultMessages.HasBwInstalled) {
      this.openExtension();
    }

    if (event.data.command === VaultMessages.PopupOpened) {
      this.setSuccessState();
    }
  }

  /** Show the open extension success state */
  private setSuccessState() {
    this.clearExtensionCheckTimeout();
    this._pageState$.next(BrowserPromptState.Success);
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: {
        key: "openedExtension",
      },
    });
  }

  /** Show open extension error state */
  private setErrorState() {
    this._pageState$.next(BrowserPromptState.Error);
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: {
        key: "somethingWentWrong",
      },
    });
  }

  private clearExtensionCheckTimeout() {
    window.clearTimeout(this.extensionCheckTimeout);
    this.extensionCheckTimeout = undefined;
  }
}
