import {
  combineLatest,
  concatMap,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/messaging";

import { BrowserApi } from "../../../platform/browser/browser-api";

import { PhishingDataService } from "./phishing-data.service";

type PhishingDetectionNavigationEvent = {
  tabId: number;
  changeInfo: chrome.tabs.OnUpdatedInfo;
  tab: chrome.tabs.Tab;
};

/**
 * Sends a message to the phishing detection service to continue to the caught url
 */
export const PHISHING_DETECTION_CONTINUE_COMMAND = new CommandDefinition<{
  tabId: number;
  url: string;
}>("phishing-detection-continue");

/**
 * Sends a message to the phishing detection service to close the warning page
 */
export const PHISHING_DETECTION_CANCEL_COMMAND = new CommandDefinition<{
  tabId: number;
}>("phishing-detection-cancel");

export class PhishingDetectionService {
  private static _destroy$ = new Subject<void>();

  private static _logService: LogService;
  private static _phishingDataService: PhishingDataService;
  private static _messageListener: MessageListener;

  private static _tabUpdated$ = new Subject<PhishingDetectionNavigationEvent>();

  private static _ignoredHostnames = new Set<string>();

  static initialize$(
    accountService: AccountService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    configService: ConfigService,
    logService: LogService,
    phishingDataService: PhishingDataService,
    messageListener: MessageListener,
  ) {
    this._logService = logService;
    this._phishingDataService = phishingDataService;
    this._messageListener = messageListener;

    logService.debug("[PhishingDetectionService] Initialize called. Checking prerequisites...");

    return combineLatest([
      accountService.activeAccount$,
      configService.getFeatureFlag$(FeatureFlag.PhishingDetection),
    ]).pipe(
      switchMap(([account, featureEnabled]) => {
        if (!account) {
          logService.debug("[PhishingDetectionService] No active account.");
          this._cleanup();
          return EMPTY;
        }
        return billingAccountProfileStateService.hasPremiumFromAnySource$(account.id).pipe(
          map((hasPremium) => hasPremium && featureEnabled),
          distinctUntilChanged(), // Prevent re-triggering setup when switching between multiple accounts with access
        );
      }),
      concatMap(async (activeUserHasAccess) => {
        if (!activeUserHasAccess) {
          logService.debug(
            "[PhishingDetectionService] User does not have access to phishing detection service.",
          );
          this._cleanup();
        } else {
          logService.debug("[PhishingDetectionService] Enabling phishing detection service");
          await this._setup();
        }
      }),
    );
  }

  /**
   * Sets up listeners for messages from the web page and web navigation events
   */
  private static _setup(): void {
    this._phishingDataService.update$.pipe(takeUntil(this._destroy$)).subscribe();

    BrowserApi.addListener(chrome.tabs.onUpdated, this._handleTabUpdated.bind(this));

    this._messageListener
      .messages$(PHISHING_DETECTION_CONTINUE_COMMAND)
      .pipe(
        tap((message) =>
          this._logService.debug(
            `[PhishingDetectionService] user selected continue for ${message.url}`,
          ),
        ),
        concatMap(async (message) => {
          const url = new URL(message.url);
          this._ignoredHostnames.add(url.hostname);
          await BrowserApi.navigateTabToUrl(message.tabId, url);
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._tabUpdated$
      .pipe(
        filter(
          (navEvent) =>
            navEvent.changeInfo.status === "complete" &&
            !!navEvent.tab.url &&
            !this._isExtensionPage(navEvent.tab.url),
        ),
        tap((event) =>
          this._logService.debug(`[PhishingDetectionService] processing event:`, event),
        ),
        concatMap(async ({ tabId, tab }) => {
          if (!tab.url) {
            return;
          }
          const tabUrl = new URL(tab.url);
          if (this._ignoredHostnames.has(tabUrl.hostname)) {
            return;
          }
          const isPhishing = await this._phishingDataService.isPhishingDomain(tabUrl);
          if (!isPhishing) {
            return;
          }

          const phishingWarningPage = new URL(
            BrowserApi.getRuntimeURL("popup/index.html#/security/phishing-warning") +
              `?phishingUrl=${tabUrl.toString()}`,
          );
          await BrowserApi.navigateTabToUrl(tabId, phishingWarningPage);
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._messageListener
      .messages$(PHISHING_DETECTION_CANCEL_COMMAND)
      .pipe(
        switchMap((message) => BrowserApi.closeTab(message.tabId)),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  private static _handleTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab,
  ): boolean {
    this._tabUpdated$.next({ tabId, changeInfo, tab });

    // Return value for supporting BrowserApi event listener signature
    return true;
  }

  private static _isExtensionPage(url: string): boolean {
    // Check against all common extension protocols
    return (
      url.startsWith("chrome-extension://") ||
      url.startsWith("moz-extension://") ||
      url.startsWith("safari-extension://") ||
      url.startsWith("safari-web-extension://")
    );
  }

  /**
   * Cleans up the phishing detection service
   * Unsubscribes from all subscriptions and clears caches
   */
  private static _cleanup() {
    this._destroy$.next();
    this._destroy$.complete();
    this._destroy$ = new Subject<void>();

    this._ignoredHostnames.clear();

    // Manually type cast to satisfy the listener signature due to the mixture
    // of static and instance methods in this class. To be fixed when refactoring
    // this class to be instance-based while providing a singleton instance in usage
    BrowserApi.removeListener(
      chrome.tabs.onUpdated,
      PhishingDetectionService._handleTabUpdated as (...args: readonly unknown[]) => unknown,
    );
  }
}
