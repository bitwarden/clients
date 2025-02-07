import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, fromEvent } from "rxjs";

import { AnonLayoutWrapperDataService } from "@bitwarden/auth/angular";
import { VaultOnboardingMessages } from "@bitwarden/common/vault/enums/vault-onboarding.enum";

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
    window.postMessage({ command: "openPopup" });
  }

  /** Send message checking for the browser extension */
  private checkForBrowserExtension() {
    fromEvent<MessageEvent>(window, "message")
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        void this.getMessages(event);
      });

    window.postMessage({ command: VaultOnboardingMessages.checkBwInstalled });

    // Wait a second for the extension to respond and open, else show the error state
    this.extensionCheckTimeout = window.setTimeout(() => {
      this.setErrorState();
    }, 1000);
  }

  /** Handle window message events */
  private getMessages(event: any) {
    if (event.data.command === VaultOnboardingMessages.HasBwInstalled) {
      this.openExtension();
    }
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
