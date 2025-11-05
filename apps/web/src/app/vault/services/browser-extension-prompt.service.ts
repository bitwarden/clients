import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, fromEvent } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ExtensionPageUrls } from "@bitwarden/common/vault/enums";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { AnonLayoutWrapperDataService } from "@bitwarden/components";

import { WebBrowserInteractionService } from "./web-browser-interaction.service";

export const BrowserPromptState = {
  Loading: "loading",
  Error: "error",
  Success: "success",
  ManualOpen: "manualOpen",
  MobileBrowser: "mobileBrowser",
} as const;

export type BrowserPromptState = UnionOfValues<typeof BrowserPromptState>;

type PromptErrorStates = typeof BrowserPromptState.Error | typeof BrowserPromptState.ManualOpen;

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
    private platformUtilsService: PlatformUtilsService,
    private webBrowserInteractionService: WebBrowserInteractionService,
  ) {}

  start(): void {
    if (Utils.isMobileBrowser) {
      this.setMobileState();
      return;
    }

    // Firefox does not support automatically opening the extension,
    // it currently requires a user gesture within the context of the extension to open.
    // Show message to direct the user to manually open the extension.
    // Mozilla Bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1799344
    if (this.platformUtilsService.isFirefox()) {
      this.setErrorState(BrowserPromptState.ManualOpen);
      return;
    }
  }

  registerPopupUrl(url: string) {
    this.checkForBrowserExtension(url);
  }

  /** Post a message to the extension to open */
  async openExtension(url: string, setManualErrorTimeout = false) {
    if (url == VaultMessages.OpenAtRiskPasswords) {
      window.postMessage({ command: url });
    } else {
      await this.webBrowserInteractionService.openExtension(ExtensionPageUrls[url]);
    }
    // Optionally, configure timeout to show the manual open error state if
    // the extension does not open within one second.
    if (setManualErrorTimeout) {
      this.clearExtensionCheckTimeout();

      this.extensionCheckTimeout = window.setTimeout(() => {
        this.setErrorState(BrowserPromptState.ManualOpen);
      }, 750);
    }
  }

  /** Send message checking for the browser extension */
  private checkForBrowserExtension(url: string) {
    fromEvent<MessageEvent>(window, "message")
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        void this.getMessages(event, url);
      });

    window.postMessage({ command: VaultMessages.checkBwInstalled });

    // Wait a second for the extension to respond and open, else show the error state
    this.extensionCheckTimeout = window.setTimeout(() => {
      this.setErrorState();
    }, 1000);
  }

  /** Handle window message events */
  private async getMessages(event: any, url: string) {
    if (event.data.command === VaultMessages.HasBwInstalled) {
      await this.openExtension(url);
    }

    if (event.data.command === VaultMessages.PopupOpened) {
      this.setSuccessState();
    }
  }

  /** Show message that this page should be opened on a desktop browser */
  private setMobileState() {
    this.clearExtensionCheckTimeout();
    this._pageState$.next(BrowserPromptState.MobileBrowser);
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: {
        key: "desktopRequired",
      },
    });
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
  private setErrorState(errorState?: PromptErrorStates) {
    this.clearExtensionCheckTimeout();
    this._pageState$.next(errorState ?? BrowserPromptState.Error);
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
