import {
  distinctUntilChanged,
  EMPTY,
  filter,
  firstValueFrom,
  map,
  merge,
  switchMap,
  tap,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
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
  // Tracks hostname:tabId pairs that should bypass phishing checks after "Continue to this site".
  // Entries persist for the lifetime of the background page (cleared on extension/browser restart).
  private _ignoredEntries = new Set<string>();
  private _didInit = false;

  constructor(
    logService: LogService,
    phishingDataService: PhishingDataService,
    phishingDetectionSettingsService: PhishingDetectionSettingsServiceAbstraction,
    messageListener: MessageListener,
    eventCollectionService: EventCollectionService,
    organizationService: OrganizationService,
    accountService: AccountService,
  ) {
    if (this._didInit) {
      logService.debug("[PhishingDetectionService] Initialize already called. Aborting.");
      return;
    }

    logService.debug("[PhishingDetectionService] Initialize called. Checking prerequisites...");

    const getOrgsToNotify = async (): Promise<Organization[]> => {
      const userId = await firstValueFrom(getUserId(accountService.activeAccount$));
      const orgs = await firstValueFrom(organizationService.organizations$(userId));
      return orgs.filter((o) => o.useEvents && o.usePhishingBlocker);
    };

    const recordEvents = async (
      eventType: EventType,
      uploadImmediately: boolean = false,
    ): Promise<void> => {
      try {
        const orgs = await getOrgsToNotify();
        // intentionally keeping this sequential
        // using Promise.all creates a race condition in eventCollectionService
        for (const org of orgs) {
          await eventCollectionService.collect(eventType, undefined, uploadImmediately, org.id);
        }
      } catch {
        logService.warning(`[PhishingDetectionService] Failed to record event: ${eventType}`);
      }
    };

    const onContinueCommand$ = messageListener.messages$(PHISHING_DETECTION_CONTINUE_COMMAND).pipe(
      tap((message) =>
        logService.debug(`[PhishingDetectionService] user selected continue for ${message.url}`),
      ),
      switchMap(async (message) => {
        await recordEvents(EventType.PhishingBlocker_Bypassed);
        const url = new URL(message.url);
        this._ignoredEntries.add(`${url.hostname}:${message.tabId}`);
        await BrowserApi.navigateTabToUrl(message.tabId, url);
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
      filter((details) => details.frameId === 0),
      filter(
        (details) =>
          !!details.url && !details.url.startsWith("about:") && !this._isExtensionPage(details.url),
      ),
      map((details) => {
        const url = new URL(details.url);
        return {
          tabId: details.tabId,
          url,
          ignored: this._ignoredEntries.has(`${url.hostname}:${details.tabId}`),
        };
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
        await recordEvents(EventType.PhishingBlocker_SiteAccessed);
        await BrowserApi.navigateTabToUrl(tabId, phishingWarningPage);
      }),
    );

    const onCancelCommand$ = messageListener.messages$(PHISHING_DETECTION_CANCEL_COMMAND).pipe(
      switchMap(async (message) => {
        await recordEvents(EventType.PhishingBlocker_SiteExited);
        await BrowserApi.closeTab(message.tabId);
      }),
    );

    const phishingDetectionActive$ = phishingDetectionSettingsService.on$;

    phishingDetectionActive$
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
  }

  private _isExtensionPage(url: string): boolean {
    // Check against all common extension protocols
    return (
      url.startsWith("chrome-extension://") ||
      url.startsWith("moz-extension://") ||
      url.startsWith("safari-extension://") ||
      url.startsWith("safari-web-extension://")
    );
  }
}
