import { distinctUntilChanged, EMPTY, filter, map, merge, switchMap, tap } from "rxjs";

import { PhishingDetectionSettingsServiceAbstraction } from "@bitwarden/common/dirt/services/abstractions/phishing-detection-settings.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/messaging";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { fromChromeEvent } from "../../../platform/browser/from-chrome-event";

import { PhishingDataService } from "./phishing-data.service";

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
  private static _ignoredHostnames = new Set<string>();
  private static _didInit = false;

  static initialize(
    logService: LogService,
    phishingDataService: PhishingDataService,
    phishingDetectionSettingsService: PhishingDetectionSettingsServiceAbstraction,
    messageListener: MessageListener,
  ) {
    if (this._didInit) {
      logService.debug("[PhishingDetectionService] Initialize already called. Aborting.");
      return;
    }

    logService.debug("[PhishingDetectionService] Initialize called. Checking prerequisites...");

    const onContinueCommand$ = messageListener.messages$(PHISHING_DETECTION_CONTINUE_COMMAND).pipe(
      tap((message) =>
        logService.debug(`[PhishingDetectionService] user selected continue for ${message.url}`),
      ),
      switchMap(async (message) => {
        const url = new URL(message.url);
        this._ignoredHostnames.add(url.hostname);
        await BrowserApi.navigateTabToUrl(message.tabId, url);
        // One-time pass consumed — distinctUntilChanged would suppress the pipeline event
        this._ignoredHostnames.delete(url.hostname);
      }),
    );

    // onCommitted for successful navigations; onErrorOccurred for HTTP errors/DNS failures
    // where Chrome skips onCommitted. Firefox fires both, deduplicated by distinctUntilChanged.
    const onCommitted$ = fromChromeEvent(chrome.webNavigation.onCommitted).pipe(
      map(([details]) => details),
    );
    const onErrorOccurred$ = fromChromeEvent(chrome.webNavigation.onErrorOccurred).pipe(
      map(([details]) => details),
    );

    const onTabUpdated$ = merge(onCommitted$, onErrorOccurred$).pipe(
      filter((details) => details.frameId === 0), // main frame only
      filter((details) => !!details.url && !this._isExtensionPage(details.url)),
      map((details) => {
        const url = new URL(details.url);
        return { tabId: details.tabId, url, ignored: this._ignoredHostnames.has(url.hostname) };
      }),
      distinctUntilChanged(
        (prev, curr) => prev.url.toString() === curr.url.toString() && prev.tabId === curr.tabId,
      ),
      // switchMap cancels in-progress checks when a new navigation arrives
      switchMap(async ({ tabId, url, ignored }) => {
        if (ignored) {
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

    const initSub = phishingDetectionActive$
      .pipe(
        distinctUntilChanged(),
        switchMap((activeUserHasAccess) => {
          if (!activeUserHasAccess) {
            logService.debug(
              "[PhishingDetectionService] User does not have access to phishing detection service.",
            );
            return EMPTY;
          } else {
            logService.debug("[PhishingDetectionService] Enabling phishing detection service");
            return merge(
              phishingDataService.update$,
              onContinueCommand$,
              onTabUpdated$,
              onCancelCommand$,
            );
          }
        }),
      )
      .subscribe();

    this._didInit = true;
    return () => {
      // Dispose phishing data service resources
      phishingDataService.dispose();

      initSub.unsubscribe();
      this._didInit = false;
    };
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
