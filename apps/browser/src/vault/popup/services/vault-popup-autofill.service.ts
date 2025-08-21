// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  debounceTime,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  Subject,
  switchMap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { isUrlInList } from "@bitwarden/common/autofill/utils";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { ToastService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import {
  AutofillService,
  PageDetail,
} from "../../../autofill/services/abstractions/autofill.service";
import { InlineMenuFieldQualificationService } from "../../../autofill/services/inline-menu-field-qualification.service";
import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { closeViewVaultItemPopout, VaultPopoutType } from "../utils/vault-popout-window";

@Injectable({
  providedIn: "root",
})
export class VaultPopupAutofillService {
  private _refreshCurrentTab$ = new Subject<void>();
  private senderTabId$: Observable<number | undefined> = this.route.queryParams.pipe(
    map((params) => (params?.senderTabId ? parseInt(params.senderTabId, 10) : undefined)),
  );
  /**
   * Observable that contains the current tab to be considered for autofill.
   * This can be the tab from the current window if opened in a Popup OR
   * the sending tab when opened the single action Popout (specified by the senderTabId route query parameter)
   */
  currentAutofillTab$: Observable<chrome.tabs.Tab | null> = combineLatest([
    this.senderTabId$,
    this._refreshCurrentTab$.pipe(startWith(null)),
  ]).pipe(
    switchMap(async ([senderTabId]) => {
      if (senderTabId) {
        return await BrowserApi.getTab(senderTabId);
      }

      if (BrowserPopupUtils.inPopout(window)) {
        return null;
      }
      return await BrowserApi.getTabFromCurrentWindow();
    }),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  currentTabIsOnBlocklist$: Observable<boolean> = combineLatest([
    this.domainSettingsService.blockedInteractionsUris$,
    this.currentAutofillTab$,
  ]).pipe(
    map(([blockedInteractionsUrls, currentTab]) => {
      if (blockedInteractionsUrls && currentTab) {
        return isUrlInList(currentTab?.url, blockedInteractionsUrls);
      }

      return false;
    }),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  showCurrentTabIsBlockedBanner$: Observable<boolean> = combineLatest([
    this.domainSettingsService.blockedInteractionsUris$,
    this.currentAutofillTab$,
  ]).pipe(
    map(([blockedInteractionsUrls, currentTab]) => {
      if (blockedInteractionsUrls && currentTab?.url?.length) {
        const tabHostname = Utils.getHostname(currentTab.url);

        if (!tabHostname) {
          return false;
        }

        const tabIsBlocked = isUrlInList(currentTab.url, blockedInteractionsUrls);

        const showScriptInjectionIsBlockedBanner =
          tabIsBlocked && !blockedInteractionsUrls[tabHostname]?.bannerIsDismissed;

        return showScriptInjectionIsBlockedBanner;
      }

      return false;
    }),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  async dismissCurrentTabIsBlockedBanner() {
    try {
      const currentTab = await firstValueFrom(this.currentAutofillTab$);
      const currentTabHostname = currentTab?.url.length && Utils.getHostname(currentTab.url);

      if (!currentTabHostname) {
        return;
      }

      const blockedURLs = await firstValueFrom(this.domainSettingsService.blockedInteractionsUris$);

      let tabIsBlocked = false;
      if (blockedURLs && currentTab?.url?.length) {
        tabIsBlocked = isUrlInList(currentTab.url, blockedURLs);
      }

      if (tabIsBlocked) {
        void this.domainSettingsService.setBlockedInteractionsUris({
          ...blockedURLs,
          [currentTabHostname as string]: { bannerIsDismissed: true },
        });
      }
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      throw new Error(
        "There was a problem dismissing the blocked interaction URL notification banner",
      );
    }
  }

  /**
   * Observable that indicates whether autofill is allowed in the current context.
   * Autofill is allowed when there is a current tab and the popup is not in a popout window.
   */
  autofillAllowed$: Observable<boolean> = this.currentAutofillTab$.pipe(map((tab) => !!tab));

  private _currentPageDetails$: Observable<PageDetail[]> = this.currentAutofillTab$.pipe(
    switchMap((tab) => {
      if (!tab) {
        return of([]);
      }

      return this.domainSettingsService.blockedInteractionsUris$.pipe(
        switchMap((blockedURLs) => {
          if (blockedURLs && tab?.url?.length) {
            const tabIsBlocked = isUrlInList(tab.url, blockedURLs);

            if (tabIsBlocked) {
              return of([]);
            }
          }

          return this.autofillService.collectPageDetailsFromTab$(tab);
        }),
      );
    }),
    debounceTime(50),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  nonLoginCipherTypesOnPage$: Observable<{
    [CipherType.Card]: boolean;
    [CipherType.Identity]: boolean;
  }> = this._currentPageDetails$.pipe(
    map((pageDetails) => {
      let pageHasCardFields = false;
      let pageHasIdentityFields = false;

      try {
        if (!pageDetails) {
          throw Error("No page details were provided");
        }

        for (const details of pageDetails) {
          for (const field of details.details.fields) {
            if (!pageHasCardFields) {
              pageHasCardFields = this.inlineMenuFieldQualificationService.isFieldForCreditCardForm(
                field,
                details.details,
              );
            }

            if (!pageHasIdentityFields) {
              pageHasIdentityFields =
                this.inlineMenuFieldQualificationService.isFieldForIdentityForm(
                  field,
                  details.details,
                );
            }
          }
        }
      } catch (error) {
        // no-op on failure; do not show extra cipher types
        this.logService.warning(error.message);
      }

      return { [CipherType.Card]: pageHasCardFields, [CipherType.Identity]: pageHasIdentityFields };
    }),
  );

  constructor(
    private autofillService: AutofillService,
    private domainSettingsService: DomainSettingsService,
    private i18nService: I18nService,
    private toastService: ToastService,
    private platformUtilService: PlatformUtilsService,
    private passwordRepromptService: PasswordRepromptService,
    private cipherService: CipherService,
    private messagingService: MessagingService,
    private route: ActivatedRoute,
    private accountService: AccountService,
    private logService: LogService,
    private inlineMenuFieldQualificationService: InlineMenuFieldQualificationService,
  ) {
    this._currentPageDetails$.subscribe();
  }

  private async _internalDoAutofill(
    cipher: CipherView,
    tab: chrome.tabs.Tab,
    pageDetails: PageDetail[],
  ): Promise<boolean> {
    if (
      cipher.reprompt !== CipherRepromptType.None &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      return false;
    }

    if (tab == null || pageDetails.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("autofillError"),
      });
      return false;
    }

    try {
      const totpCode = await this.autofillService.doAutoFill({
        tab,
        cipher,
        pageDetails,
        doc: window.document,
        fillNewPassword: true,
        allowTotpAutofill: true,
      });

      if (totpCode != null) {
        this.platformUtilService.copyToClipboard(totpCode, { window: window });
      }
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("autofillError"),
      });
      return false;
    }

    return true;
  }

  private async _closePopup(cipher: CipherView, tab: chrome.tabs.Tab | null) {
    if (BrowserPopupUtils.inSingleActionPopout(window, VaultPopoutType.viewVaultItem) && tab.id) {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("autoFillSuccess"),
      });
      setTimeout(async () => {
        await BrowserApi.focusTab(tab.id);
        await closeViewVaultItemPopout(`${VaultPopoutType.viewVaultItem}_${cipher.id}`);
      }, 1000);

      return;
    }

    if (!BrowserPopupUtils.inPopup(window)) {
      return;
    }

    if (this.platformUtilService.isFirefox() || this.platformUtilService.isSafari()) {
      BrowserApi.closePopup(window);
      return;
    }

    // Slight delay to fix bug in Chromium browsers where popup closes without copying totp to clipboard
    setTimeout(() => BrowserApi.closePopup(window), 50);
  }

  /**
   * Re-fetch the current tab
   */
  refreshCurrentTab() {
    this._refreshCurrentTab$.next(null);
  }

  /**
   * Attempts to autofill the given cipher. Returns true if the autofill was successful, false otherwise.
   * Will copy any TOTP code to the clipboard if available after successful autofill.
   * @param cipher
   * @param closePopup If true, will close the popup window after successful autofill. Defaults to true.
   */
  async doAutofill(cipher: CipherView, closePopup = true): Promise<boolean> {
    const tab = await firstValueFrom(this.currentAutofillTab$);
    const pageDetails = await firstValueFrom(this._currentPageDetails$);

    const didAutofill = await this._internalDoAutofill(cipher, tab, pageDetails);

    if (didAutofill && closePopup) {
      await this._closePopup(cipher, tab);
    }

    return didAutofill;
  }

  /**
   * Attempts to autofill the given cipher and, upon successful autofill, saves the URI to the cipher.
   * Will copy any TOTP code to the clipboard if available after successful autofill.
   * @param cipher The cipher to autofill and save. Only Login ciphers are supported.
   * @param closePopup If true, will close the popup window after successful autofill.
   * If false, will show a success toast instead. Defaults to true.
   */
  async doAutofillAndSave(cipher: CipherView, closePopup = true): Promise<boolean> {
    // We can only save URIs for login ciphers
    if (cipher.type !== CipherType.Login) {
      return false;
    }

    const pageDetails = await firstValueFrom(this._currentPageDetails$);
    const tab = await firstValueFrom(this.currentAutofillTab$);

    const didAutofill = await this._internalDoAutofill(cipher, tab, pageDetails);

    if (!didAutofill) {
      return false;
    }

    const didSaveUri = await this._saveNewUri(cipher, tab);

    if (!didSaveUri) {
      return false;
    }

    if (closePopup) {
      await this._closePopup(cipher, tab);
    } else {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("autoFillSuccessAndSavedUri"),
      });
    }

    return true;
  }

  /**
   * Saves the current tab's URL as a new URI for the given cipher. If the cipher already has a URI for the tab,
   * this method does nothing and returns true.
   * @private
   */
  private async _saveNewUri(cipher: CipherView, tab: chrome.tabs.Tab): Promise<boolean> {
    cipher.login.uris ??= [];

    if (cipher.login.uris.some((uri) => uri.uri === tab.url)) {
      // Cipher already has a URI for this tab
      return true;
    }

    const loginUri = new LoginUriView();
    loginUri.uri = tab.url;
    cipher.login.uris.push(loginUri);

    try {
      const activeUserId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      const encCipher = await this.cipherService.encrypt(cipher, activeUserId);
      await this.cipherService.updateWithServer(encCipher);
      this.messagingService.send("editedCipher");
      return true;
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("unexpectedError"),
      });
      return false;
    }
  }
}
