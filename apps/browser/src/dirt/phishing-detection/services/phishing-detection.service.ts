import {
  concatMap,
  delay,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  merge,
  of,
  Subject,
  Subscription,
  switchMap,
  tap,
} from "rxjs";

import { PhishingDetectionSettingsServiceAbstraction } from "@bitwarden/common/dirt/services/abstractions/phishing-detection-settings.service.abstraction";
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
  private static _tabUpdated$ = new Subject<PhishingDetectionNavigationEvent>();
  private static _ignoredHostnames = new Set<string>();
  private static _didInit = false;
  private static _triggerUpdateSub: Subscription | null = null;
  private static _boundTabHandler: ((...args: readonly unknown[]) => unknown) | null = null;

  static initialize(
    logService: LogService,
    phishingDataService: PhishingDataService,
    phishingDetectionSettingsService: PhishingDetectionSettingsServiceAbstraction,
    messageListener: MessageListener,
  ) {
    // If already initialized, clean up first to prevent memory leaks on service worker restart
    if (this._didInit) {
      logService.debug(
        "[PhishingDetectionService] Initialize already called. Cleaning up previous instance first.",
      );
      // Clean up previous state
      if (this._triggerUpdateSub) {
        this._triggerUpdateSub.unsubscribe();
        this._triggerUpdateSub = null;
      }
      if (this._boundTabHandler) {
        BrowserApi.removeListener(chrome.tabs.onUpdated, this._boundTabHandler);
        this._boundTabHandler = null;
      }
      // Clear accumulated state
      this._ignoredHostnames.clear();
      // Reset flag to allow re-initialization
      this._didInit = false;
    }

    this._boundTabHandler = this._handleTabUpdated.bind(this) as (
      ...args: readonly unknown[]
    ) => unknown;
    BrowserApi.addListener(chrome.tabs.onUpdated, this._boundTabHandler);

    const onContinueCommand$ = messageListener.messages$(PHISHING_DETECTION_CONTINUE_COMMAND).pipe(
      tap((message) =>
        logService.debug(`[PhishingDetectionService] User selected continue for ${message.url}`),
      ),
      concatMap(async (message) => {
        const url = new URL(message.url);
        this._ignoredHostnames.add(url.hostname);
        await BrowserApi.navigateTabToUrl(message.tabId, url);
      }),
    );

    const onTabUpdated$ = this._tabUpdated$.pipe(
      filter(
        (navEvent) =>
          navEvent.changeInfo.status === "complete" &&
          !!navEvent.tab.url &&
          !this._isExtensionPage(navEvent.tab.url),
      ),
      map(({ tab, tabId }) => {
        const url = new URL(tab.url!);
        return { tabId, url, ignored: this._ignoredHostnames.has(url.hostname) };
      }),
      distinctUntilChanged(
        (prev, curr) =>
          prev.url.toString() === curr.url.toString() &&
          prev.tabId === curr.tabId &&
          prev.ignored === curr.ignored,
      ),
      tap((event) =>
        logService.debug(`[PhishingDetectionService] Processing navigation event:`, event),
      ),
      concatMap(async ({ tabId, url, ignored }) => {
        if (ignored) {
          // The next time this host is visited, block again
          this._ignoredHostnames.delete(url.hostname);
          return;
        }
        const isPhishing = await phishingDataService.isPhishingWebAddress(url);
        if (!isPhishing) {
          return;
        }

        const phishingWarningPage = new URL(
          BrowserApi.getRuntimeURL("popup/index.html#/security/phishing-warning") +
            `?phishingUrl=${url.toString()}`,
        );
        await BrowserApi.navigateTabToUrl(tabId, phishingWarningPage);
      }),
    );

    const onCancelCommand$ = messageListener
      .messages$(PHISHING_DETECTION_CANCEL_COMMAND)
      .pipe(switchMap((message) => BrowserApi.closeTab(message.tabId)));

    const phishingDetectionActive$ = phishingDetectionSettingsService.on$;

    // CRITICAL: Only subscribe to update$ if phishing detection is available
    // This prevents storage access for non-premium users on extension reload
    // The subscription is created lazily when phishing detection becomes active
    let updateSub: Subscription | null = null;

    const initSub = phishingDetectionActive$
      .pipe(
        distinctUntilChanged(),
        switchMap((activeUserHasAccess) => {
          // Clean up previous trigger subscription if it exists
          // This prevents memory leaks when account access changes (switch, lock/unlock)
          if (this._triggerUpdateSub) {
            this._triggerUpdateSub.unsubscribe();
            this._triggerUpdateSub = null;
          }

          if (!activeUserHasAccess) {
            logService.debug(
              "[PhishingDetectionService] User does not have access to phishing detection service.",
            );
            // Unsubscribe from update$ if user loses access (e.g., account switch to non-premium)
            if (updateSub) {
              updateSub.unsubscribe();
              updateSub = null;
            }
            return EMPTY;
          } else {
            logService.debug("[PhishingDetectionService] Enabling phishing detection service");
            // Lazy subscription: Only subscribe to update$ when phishing detection becomes active
            // This prevents storage access for non-premium users on extension reload
            if (!updateSub) {
              updateSub = phishingDataService.update$.subscribe({
                next: () => {
                  logService.debug("[PhishingDetectionService] Update completed");
                },
                error: (err: unknown) => {
                  logService.error("[PhishingDetectionService] Update error", err);
                },
                complete: () => {
                  logService.debug("[PhishingDetectionService] Update subscription completed");
                },
              });
            }
            // Trigger cache update asynchronously using RxJS delay(0)
            // This defers to the next event loop tick, preventing UI blocking during account switch
            // CRITICAL: Store subscription to prevent memory leaks on account switches
            this._triggerUpdateSub = of(null)
              .pipe(delay(0))
              .subscribe(() => phishingDataService.triggerUpdateIfNeeded());
            // update$ removed from merge - popup no longer blocks waiting for update
            // The actual update runs via updateSub above
            return merge(onContinueCommand$, onTabUpdated$, onCancelCommand$);
          }
        }),
      )
      .subscribe();

    this._didInit = true;
    return () => {
      logService.debug("[PhishingDetectionService] Cleanup function called");
      if (updateSub) {
        updateSub.unsubscribe();
        updateSub = null;
      }
      initSub.unsubscribe();
      // Clean up trigger subscription to prevent memory leaks
      if (this._triggerUpdateSub) {
        this._triggerUpdateSub.unsubscribe();
        this._triggerUpdateSub = null;
      }
      this._didInit = false;

      if (this._boundTabHandler) {
        BrowserApi.removeListener(chrome.tabs.onUpdated, this._boundTabHandler);
        this._boundTabHandler = null;
      }

      // Clear accumulated state to prevent memory leaks
      this._ignoredHostnames.clear();
    };
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
}
