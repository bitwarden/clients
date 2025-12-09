import {
  combineLatest,
  concatMap,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  merge,
  of,
  Subject,
  switchMap,
  tap,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ProductTierType } from "@bitwarden/common/billing/enums";
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
  private static _tabUpdated$ = new Subject<PhishingDetectionNavigationEvent>();
  private static _ignoredHostnames = new Set<string>();
  private static _didInit = false;

  static initialize(
    accountService: AccountService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    configService: ConfigService,
    logService: LogService,
    organizationService: OrganizationService,
    phishingDataService: PhishingDataService,
    messageListener: MessageListener,
  ) {
    if (this._didInit) {
      logService.debug("[PhishingDetectionService] Initialize already called. Aborting.");
      return;
    }

    logService.debug("[PhishingDetectionService] Initialize called. Checking prerequisites...");

    BrowserApi.addListener(chrome.tabs.onUpdated, this._handleTabUpdated.bind(this));

    const onContinueCommand$ = messageListener.messages$(PHISHING_DETECTION_CONTINUE_COMMAND).pipe(
      tap((message) =>
        logService.debug(`[PhishingDetectionService] user selected continue for ${message.url}`),
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
      tap((event) => logService.debug(`[PhishingDetectionService] processing event:`, event)),
      concatMap(async ({ tabId, url, ignored }) => {
        if (ignored) {
          // The next time this host is visited, block again
          this._ignoredHostnames.delete(url.hostname);
          return;
        }
        const isPhishing = await phishingDataService.isPhishingDomain(url);
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

    // The active account only has access if phishing detection is enabled in feature flags
    // The active account has access to the phishing detection through one of the following sources:
    // 1. Personal Premium subscription
    // 2. Member of a Family organization (ProductTierType.Families)
    // 3. Member of an Enterprise organization (ProductTierType.Enterprise) with usePhishingBlocker permission enabled
    const activeAccountHasAccess$ = combineLatest([
      accountService.activeAccount$,
      configService.getFeatureFlag$(FeatureFlag.PhishingDetection),
    ]).pipe(
      switchMap(([account, featureEnabled]) => {
        if (!account) {
          logService.debug("[PhishingDetectionService] No active account.");
          return of(false);
        }

        return combineLatest([
          billingAccountProfileStateService.hasPremiumPersonally$(account.id),
          organizationService.organizations$(account.id),
        ]).pipe(
          map(([hasPremium, organizations]) => {
            const hasAccessThroughOrg =
              organizations?.some((org) => {
                if (org.canAccess && org.isMember && org.usersGetPremium) {
                  // Check if the user is a member of a family organization
                  if (org.productTierType === ProductTierType.Families) {
                    return true;
                  }
                  // Check if the user is a member of a enterprise organization with phishing blocker enabled
                  if (
                    org.productTierType === ProductTierType.Enterprise &&
                    org.usePhishingBlocker
                  ) {
                    return true;
                  }
                }
                return false;
              }) ?? false;

            return featureEnabled && (hasPremium || hasAccessThroughOrg);
          }),
        );
      }),
    );

    const initSub = activeAccountHasAccess$
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
      initSub.unsubscribe();
      this._didInit = false;

      // Manually type cast to satisfy the listener signature due to the mixture
      // of static and instance methods in this class. To be fixed when refactoring
      // this class to be instance-based while providing a singleton instance in usage
      BrowserApi.removeListener(
        chrome.tabs.onUpdated,
        PhishingDetectionService._handleTabUpdated as (...args: readonly unknown[]) => unknown,
      );
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
