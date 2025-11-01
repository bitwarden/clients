import { combineLatest, concatMap, delay, EMPTY, map, Subject, switchMap, takeUntil } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BrowserApi } from "../../../platform/browser/browser-api";

import { PhishingDataService } from "./phishing-data.service";
import {
  CaughtPhishingDomain,
  isPhishingDetectionMessage,
  PhishingDetectionMessage,
  PhishingDetectionNavigationEvent,
  PhishingDetectionTabId,
} from "./phishing-detection.types";

export class PhishingDetectionService {
  private static _destroy$ = new Subject<void>();

  private static _logService: LogService;
  private static _phishingDataService: PhishingDataService;

  private static _navigationEventsSubject = new Subject<PhishingDetectionNavigationEvent>();
  private static _caughtTabs: Map<PhishingDetectionTabId, CaughtPhishingDomain> = new Map();

  static initialize(
    accountService: AccountService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    configService: ConfigService,
    logService: LogService,
    phishingDataService: PhishingDataService,
  ): void {
    this._logService = logService;
    this._phishingDataService = phishingDataService;

    logService.info("[PhishingDetectionService] Initialize called. Checking prerequisites...");

    combineLatest([
      accountService.activeAccount$,
      configService.getFeatureFlag$(FeatureFlag.PhishingDetection),
    ])
      .pipe(
        switchMap(([account, featureEnabled]) => {
          if (!account) {
            logService.info("[PhishingDetectionService] No active account.");
            this._cleanup();
            return EMPTY;
          }
          return billingAccountProfileStateService
            .hasPremiumFromAnySource$(account.id)
            .pipe(map((hasPremium) => ({ hasPremium, featureEnabled })));
        }),
        concatMap(async ({ hasPremium, featureEnabled }) => {
          if (!hasPremium || !featureEnabled) {
            logService.info(
              "[PhishingDetectionService] User does not have access to phishing detection service.",
            );
            this._cleanup();
          } else {
            logService.info("[PhishingDetectionService] Enabling phishing detection service");
            await this._setup();
          }
        }),
      )
      .subscribe();
  }

  /**
   * Sends a message to the phishing detection service to close the warning page
   */
  static async requestClosePhishingWarningPage() {
    await chrome.runtime.sendMessage({ command: PhishingDetectionMessage.Close });
  }

  /**
   * Sends a message to the phishing detection service to continue to the caught url
   */
  static async requestContinueToDangerousUrl() {
    await chrome.runtime.sendMessage({ command: PhishingDetectionMessage.Continue });
  }

  /**
   * Continues to the dangerous URL if the user has requested it
   *
   * @param tabId The ID of the tab to continue to the dangerous URL
   */
  static async _continueToDangerousUrl(tabId: PhishingDetectionTabId): Promise<void> {
    const caughtTab = this._caughtTabs.get(tabId);
    if (caughtTab) {
      this._logService.info(
        "[PhishingDetectionService] Continuing to known phishing domain: ",
        caughtTab,
        caughtTab.url.href,
      );
      await BrowserApi.navigateTabToUrl(tabId, caughtTab.url);
    } else {
      this._logService.warning("[PhishingDetectionService] No caught domain to continue to");
    }
  }

  /**
   * Sets up listeners for messages from the web page and web navigation events
   */
  private static _setup(): void {
    this._phishingDataService.update$.pipe(takeUntil(this._destroy$)).subscribe();

    // Setup listeners from web page/content script
    BrowserApi.addListener(chrome.runtime.onMessage, this._handleExtensionMessage.bind(this));
    BrowserApi.addListener(chrome.tabs.onReplaced, this._handleReplacementEvent.bind(this));
    BrowserApi.addListener(chrome.tabs.onUpdated, this._handleNavigationEvent.bind(this));

    // When a navigation event occurs, check if a replace event for the same tabId exists,
    // and call the replace handler before handling navigation.
    this._navigationEventsSubject
      .pipe(
        delay(100), // Delay slightly to allow replace events to be caught
        takeUntil(this._destroy$),
      )
      .subscribe(({ tabId, changeInfo, tab }) => {
        void this._processNavigation(tabId, changeInfo, tab);
      });
  }

  /**
   * Handles messages from the phishing warning page
   *
   * @returns true if the message was handled, false otherwise
   */
  private static _handleExtensionMessage(
    message: unknown,
    sender: chrome.runtime.MessageSender,
  ): boolean {
    if (!isPhishingDetectionMessage(message)) {
      return false;
    }
    const isValidSender = sender && sender.tab && sender.tab.id;
    const senderTabId = isValidSender ? sender?.tab?.id : null;

    // Only process messages from tab navigation
    if (senderTabId == null) {
      return false;
    }

    // Handle Dangerous Continue to Phishing Domain
    if (message.command === PhishingDetectionMessage.Continue) {
      this._logService.debug(
        "[PhishingDetectionService] User requested continue to phishing domain on tab: ",
        senderTabId,
      );

      this._setCaughtTabContinue(senderTabId);
      void this._continueToDangerousUrl(senderTabId);
      return true;
    }

    // Handle Close Phishing Warning Page
    if (message.command === PhishingDetectionMessage.Close) {
      this._logService.debug(
        "[PhishingDetectionService] User requested to close phishing warning page on tab: ",
        senderTabId,
      );

      void BrowserApi.closeTab(senderTabId);
      this._removeCaughtTab(senderTabId);
      return true;
    }

    return false;
  }

  /**
   * Filter out navigation events that are to warning pages or not complete, check for phishing domains,
   * then handle the navigation appropriately.
   */
  private static async _processNavigation(
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab,
  ): Promise<void> {
    if (changeInfo.status !== "complete" || !tab.url) {
      // Not a complete navigation or no URL to check
      return;
    }
    // Check if navigating to a warning page to ignore
    const isWarningPage = this._isWarningPage(tabId, tab.url);
    if (isWarningPage) {
      this._logService.debug(
        `[PhishingDetectionService] Ignoring navigation to warning page for tab ${tabId}: ${tab.url}`,
      );
      return;
    }

    // Check if tab is navigating to a phishing url and handle navigation
    await this._checkTabForPhishing(tabId, new URL(tab.url));
    await this._handleTabNavigation(tabId);
  }

  private static _handleNavigationEvent(
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab,
  ): boolean {
    this._navigationEventsSubject.next({ tabId, changeInfo, tab });

    // Return value for supporting BrowserApi event listener signature
    return true;
  }

  /**
   * Handles a replace event in Safari when redirecting to a warning page
   *
   * @returns true if the replacement was handled, false otherwise
   */
  private static _handleReplacementEvent(newTabId: number, originalTabId: number): boolean {
    if (this._caughtTabs.has(originalTabId)) {
      this._logService.debug(
        `[PhishingDetectionService] Handling original tab ${originalTabId} changing to new tab ${newTabId}`,
      );

      // Handle replacement
      const originalCaughtTab = this._caughtTabs.get(originalTabId);
      if (originalCaughtTab) {
        this._caughtTabs.set(newTabId, originalCaughtTab);
        this._caughtTabs.delete(originalTabId);
      } else {
        this._logService.debug(
          `[PhishingDetectionService] Original caught tab not found, ignoring replacement.`,
        );
      }
      return true;
    }
    return false;
  }

  /**
   * Adds a tab to the caught tabs map with the requested continue status set to false
   *
   * @param tabId The ID of the tab that was caught
   * @param url The URL of the tab that was caught
   * @param redirectedTo The URL that the tab was redirected to
   */
  private static _addCaughtTab(tabId: PhishingDetectionTabId, url: URL) {
    const redirectedTo = this._createWarningPageUrl(url);
    const newTab = { url, warningPageUrl: redirectedTo, requestedContinue: false };

    this._caughtTabs.set(tabId, newTab);
    this._logService.debug("[PhishingDetectionService] Tracking new tab:", tabId, newTab);
  }

  /**
   * Removes a tab from the caught tabs map
   *
   * @param tabId The ID of the tab to remove
   */
  private static _removeCaughtTab(tabId: PhishingDetectionTabId) {
    this._logService.debug("[PhishingDetectionService] Removing tab from tracking: ", tabId);
    this._caughtTabs.delete(tabId);
  }

  /**
   * Sets the requested continue status for a caught tab
   *
   * @param tabId The ID of the tab to set the continue status for
   */
  private static _setCaughtTabContinue(tabId: PhishingDetectionTabId) {
    const caughtTab = this._caughtTabs.get(tabId);
    if (caughtTab) {
      this._caughtTabs.set(tabId, {
        url: caughtTab.url,
        warningPageUrl: caughtTab.warningPageUrl,
        requestedContinue: true,
      });
    }
  }

  /**
   * Checks if the tab should continue to a dangerous domain
   *
   * @param tabId Tab to check if a domain was caught
   * @returns True if the user requested to continue to the phishing domain
   */
  private static _continueToCaughtDomain(tabId: PhishingDetectionTabId) {
    const caughtDomain = this._caughtTabs.get(tabId);
    const hasRequestedContinue = caughtDomain?.requestedContinue;
    return caughtDomain && hasRequestedContinue;
  }

  /**
   * Checks if the tab is going to a phishing domain and updates the caught tabs map
   *
   * @param tabId Tab to check for phishing domain
   * @param url URL of the tab to check
   */
  private static async _checkTabForPhishing(tabId: PhishingDetectionTabId, url: URL) {
    // Check if the tab already being tracked
    const caughtTab = this._caughtTabs.get(tabId);

    const isPhishing = await this._phishingDataService.isPhishingDomain(url);
    this._logService.debug(
      `[PhishingDetectionService] Checking for phishing url. Result: ${isPhishing} on ${url}`,
    );

    // Add a new caught tab
    if (!caughtTab && isPhishing) {
      this._addCaughtTab(tabId, url);
    }

    // The tab was caught before but has an updated url
    if (caughtTab && caughtTab.url.href !== url.href) {
      if (isPhishing) {
        this._logService.debug(
          "[PhishingDetectionService] Caught tab going to a new phishing domain:",
          caughtTab.url,
        );
        // The tab can be treated as a new tab, clear the old one and reset
        this._removeCaughtTab(tabId);
        this._addCaughtTab(tabId, url);
      } else {
        this._logService.debug(
          "[PhishingDetectionService] Caught tab navigating away from a phishing domain",
        );
        // The tab is safe
        this._removeCaughtTab(tabId);
      }
    }
  }

  /**
   * Handles a phishing tab for redirection to a warning page if the user has not requested to continue
   *
   * @param tabId Tab to handle
   * @param url URL of the tab
   */
  private static async _handleTabNavigation(tabId: PhishingDetectionTabId) {
    const caughtTab = this._caughtTabs.get(tabId);

    if (caughtTab && !this._continueToCaughtDomain(tabId)) {
      await this._redirectToWarningPage(tabId);
    }
  }

  private static _isWarningPage(tabId: number, url: string): boolean {
    const caughtTab = this._caughtTabs.get(tabId);
    return !!caughtTab && caughtTab.warningPageUrl.href === url;
  }

  /**
   * Constructs the phishing warning page URL with the caught URL as a query parameter
   *
   * @param caughtUrl The URL that was caught as phishing
   * @returns The complete URL to the phishing warning page
   */
  private static _createWarningPageUrl(caughtUrl: URL) {
    const phishingWarningPage = BrowserApi.getRuntimeURL(
      "popup/index.html#/security/phishing-warning",
    );
    const pageWithViewData = `${phishingWarningPage}?phishingHost=${caughtUrl.hostname}`;
    this._logService.debug(
      "[PhishingDetectionService] Created phishing warning page url:",
      pageWithViewData,
    );
    return new URL(pageWithViewData);
  }

  /**
   * Redirects the tab to the phishing warning page
   *
   * @param tabId The ID of the tab to redirect
   */
  private static async _redirectToWarningPage(tabId: number) {
    const tabToRedirect = this._caughtTabs.get(tabId);

    if (tabToRedirect) {
      this._logService.info("[PhishingDetectionService] Redirecting to warning page");
      await BrowserApi.navigateTabToUrl(tabId, tabToRedirect.warningPageUrl);
    } else {
      this._logService.warning("[PhishingDetectionService] No caught tab found for redirection");
    }
  }

  /**
   * Cleans up the phishing detection service
   * Unsubscribes from all subscriptions and clears caches
   */
  private static _cleanup() {
    this._destroy$.next();
    this._destroy$.complete();
    this._destroy$ = new Subject<void>();

    this._caughtTabs.clear();

    // Manually type cast to satisfy the listener signature due to the mixture
    // of static and instance methods in this class. To be fixed when refactoring
    // this class to be instance-based while providing a singleton instance in usage
    BrowserApi.removeListener(
      chrome.runtime.onMessage,
      PhishingDetectionService._handleExtensionMessage as (...args: readonly unknown[]) => unknown,
    );
    BrowserApi.removeListener(
      chrome.tabs.onReplaced,
      PhishingDetectionService._handleReplacementEvent as (...args: readonly unknown[]) => unknown,
    );
    BrowserApi.removeListener(
      chrome.tabs.onUpdated,
      PhishingDetectionService._handleNavigationEvent as (...args: readonly unknown[]) => unknown,
    );
  }
}
