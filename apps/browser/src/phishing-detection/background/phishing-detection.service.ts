import { mergeMap, Subscription } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { devFlagEnabled, devFlagValue } from "@bitwarden/common/platform/misc/flags";
import { ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";
import { TaskSchedulerService } from "@bitwarden/common/platform/scheduling/task-scheduler.service";

import { BrowserApi } from "../../platform/browser/browser-api";

import {
  CaughtPhishingDomain,
  isPhishingDetectionMessage,
  PhishingDetectionMessage,
  PhishingDetectionTabId,
} from "./phishing-detection.types";

export class PhishingDetectionService {
  private static readonly _UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private static readonly _RETRY_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static readonly _MAX_RETRIES = 3;
  private static readonly _STORAGE_KEY = "phishing_domains_cache";
  private static _auditService: AuditService;
  private static _logService: LogService;
  private static _storageService: AbstractStorageService;
  private static _taskSchedulerService: TaskSchedulerService;
  private static _updateCacheSubscription: Subscription | null = null;
  private static _retrySubscription: Subscription | null = null;
  private static _knownPhishingDomains = new Set<string>();
  private static _caughtTabs: Map<PhishingDetectionTabId, CaughtPhishingDomain> = new Map();
  private static _isUpdating = false;
  private static _retryCount = 0;
  private static _lastUpdateTime: number = 0;

  static initialize(
    configService: ConfigService,
    auditService: AuditService,
    logService: LogService,
    storageService: AbstractStorageService,
    taskSchedulerService: TaskSchedulerService,
    eventCollectionService: EventCollectionService,
  ): void {
    this._auditService = auditService;
    this._logService = logService;
    this._storageService = storageService;
    this._taskSchedulerService = taskSchedulerService;

    logService.info("[PhishingDetectionService] Initialize called");

    configService
      .getFeatureFlag$(FeatureFlag.PhishingDetection)
      .pipe(
        mergeMap(async (enabled) => {
          if (!enabled) {
            logService.info(
              "[PhishingDetectionService] Phishing detection feature flag is disabled.",
            );
            this._cleanup();
          } else {
            // Enable phishing detection service
            logService.info("[PhishingDetectionService] Enabling phishing detection service");
            await this._setup();
          }
        }),
      )
      .subscribe();
  }

  /**
   * Checks if the given URL is a known phishing domain
   *
   * @param url The URL to check
   * @returns True if the URL is a known phishing domain, false otherwise
   */
  static isPhishingDomain(url: URL): boolean {
    const result = this._knownPhishingDomains.has(url.hostname);
    if (result) {
      this._logService.debug("[PhishingDetectionService] Caught phishing domain:", url.hostname);
      return true;
    }
    return false;
  }

  /**
   * Sends a message to the phishing detection service to close the warning page
   */
  static requestClosePhishingWarningPage(): void {
    // [FIXME] User BrowserApi to handle memory leaks in safari but currently causes error
    // await BrowserApi.sendMessage(PhishingDetectionMessage.Close);
    void chrome.runtime.sendMessage({ command: PhishingDetectionMessage.Close });
  }

  /**
   * Sends a message to the phishing detection service to continue to the caught url
   */
  static async requestContinueToDangerousUrl() {
    // [FIXME] User BrowserApi to handle memory leaks in safari but currently causes error
    // await BrowserApi.sendMessage(PhishingDetectionMessage.Continue);
    void chrome.runtime.sendMessage({ command: PhishingDetectionMessage.Continue });
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
   * Initializes the phishing detection service, setting up listeners and registering tasks
   */
  private static async _setup(): Promise<void> {
    this._setupListeners();

    // Register the update task
    this._taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.phishingDomainUpdate,
      async () => {
        try {
          await this._fetchKnownPhishingDomains();
        } catch (error) {
          this._logService.error(
            "[PhishingDetectionService] Failed to update phishing domains in task handler:",
            error,
          );
        }
      },
    );

    // Initial load of cached domains
    await this._loadCachedDomains();

    // Set up periodic updates every 24 hours
    this._setupPeriodicUpdates();

    this._logService.debug("[PhishingDetectionService] Phishing detection feature is initialized.");
  }

  /**
   * Sets up listeners for messages from the web page and web navigation events
   */
  private static _setupListeners(): void {
    // Setup listeners from web page/content script
    BrowserApi.addListener(chrome.runtime.onMessage, this._handleExtensionMessage.bind(this));
    BrowserApi.addListener(
      chrome.webNavigation.onCompleted,
      this._handleNavigationEvent.bind(this),
    );
  }

  private static _handleExtensionMessage(message: unknown, sender: chrome.runtime.MessageSender) {
    if (!isPhishingDetectionMessage(message)) {
      return;
    }
    const isValidSender = sender && sender.tab && sender.tab.id;
    const senderTabId = isValidSender ? sender.tab.id : null;

    // Only process messages from tab navigation
    if (senderTabId == null) {
      return;
    }

    // Handle Dangerous Continue to Phishing Domain
    if (message.command === PhishingDetectionMessage.Continue) {
      this._logService.debug(
        "[PhishingDetectionService] User requested continue to phishing domain on tab: ",
        senderTabId,
      );

      this._setCaughtTabContinue(senderTabId);
      void this._continueToDangerousUrl(senderTabId);
    }

    // Handle Close Phishing Warning Page
    if (message.command === PhishingDetectionMessage.Close) {
      this._logService.debug(
        "[PhishingDetectionService] User requested to close phishing warning page on tab: ",
        senderTabId,
      );

      void BrowserApi.closeTab(senderTabId);
      this._removeCaughtTab(senderTabId);
    }
  }

  private static _handleNavigationEvent(
    details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
  ): void {
    const currentUrl = new URL(details.url);

    this._checkTabForPhishing(details.tabId, currentUrl);
    this._handleTabNavigation(details.tabId);
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
    this._logService.debug("[PhishingDetectionService] Tracking new tab:", newTab);

    this._caughtTabs.set(tabId, newTab);
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
    this._caughtTabs.set(tabId, {
      ...caughtTab,
      requestedContinue: true,
    });
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
  private static _checkTabForPhishing(tabId: PhishingDetectionTabId, url: URL) {
    // Check if the tab already being tracked
    const caughtTab = this._caughtTabs.get(tabId);

    // Do nothing if the tab is going to the phishing warning page
    if (caughtTab && caughtTab.warningPageUrl.href === url.href) {
      return;
    }

    this._logService.debug("[PhishingDetectionService] Checking for phishing url on tab:", tabId);
    const isPhishing = this.isPhishingDomain(url);

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
  private static _handleTabNavigation(tabId: PhishingDetectionTabId): void {
    const caughtTab = this._caughtTabs.get(tabId);

    if (caughtTab && !this._continueToCaughtDomain(tabId)) {
      this._redirectToWarningPage(tabId);
    }
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
  private static _redirectToWarningPage(tabId: number) {
    const tabToRedirect = this._caughtTabs.get(tabId);

    if (tabToRedirect) {
      this._logService.info("[PhishingDetectionService] Redirecting to warning page");
      void BrowserApi.navigateTabToUrl(tabId, tabToRedirect.warningPageUrl);
    } else {
      this._logService.warning("[PhishingDetectionService] No caught tab found for redirection");
    }
  }

  /**
   * Sets up periodic updates for phishing domains
   */
  private static _setupPeriodicUpdates() {
    // Clean up any existing subscriptions
    if (this._updateCacheSubscription) {
      this._updateCacheSubscription.unsubscribe();
    }
    if (this._retrySubscription) {
      this._retrySubscription.unsubscribe();
    }

    this._updateCacheSubscription = this._taskSchedulerService.setInterval(
      ScheduledTaskNames.phishingDomainUpdate,
      this._UPDATE_INTERVAL,
    );
  }

  /**
   * Schedules a retry for updating phishing domains if the update fails
   */
  private static _scheduleRetry() {
    // If we've exceeded max retries, stop retrying
    if (this._retryCount >= this._MAX_RETRIES) {
      this._logService.warning(
        `[PhishingDetectionService] Max retries (${this._MAX_RETRIES}) reached for phishing domain update. Will try again in ${this._UPDATE_INTERVAL / (1000 * 60 * 60)} hours.`,
      );
      this._retryCount = 0;
      if (this._retrySubscription) {
        this._retrySubscription.unsubscribe();
        this._retrySubscription = null;
      }
      return;
    }

    // Clean up existing retry subscription if any
    if (this._retrySubscription) {
      this._retrySubscription.unsubscribe();
    }

    // Increment retry count
    this._retryCount++;

    // Schedule a retry in 5 minutes
    this._retrySubscription = this._taskSchedulerService.setInterval(
      ScheduledTaskNames.phishingDomainUpdate,
      this._RETRY_INTERVAL,
    );

    this._logService.info(
      `[PhishingDetectionService] Scheduled retry ${this._retryCount}/${this._MAX_RETRIES} for phishing domain update in ${this._RETRY_INTERVAL / (1000 * 60)} minutes`,
    );
  }

  /**
   * Handles adding test phishing URLs from dev flags for testing purposes
   */
  private static _handleTestUrls() {
    if (devFlagEnabled("testPhishingUrls")) {
      const testPhishingUrls = devFlagValue("testPhishingUrls");
      this._logService.debug(
        "[PhishingDetectionService] Dev flag enabled for testing phishing detection. Adding test phishing domains:",
        testPhishingUrls,
      );
      if (testPhishingUrls && testPhishingUrls instanceof Array) {
        testPhishingUrls.forEach((domain) => {
          if (domain && typeof domain === "string") {
            this._knownPhishingDomains.add(domain);
          }
        });
      }
    }
  }

  /**
   * Loads cached phishing domains from storage
   * If no cache exists or it is expired, fetches the latest domains
   */
  private static async _loadCachedDomains() {
    try {
      const cachedData = await this._storageService.get<{ domains: string[]; timestamp: number }>(
        this._STORAGE_KEY,
      );
      if (cachedData) {
        this._logService.info("[PhishingDetectionService] Phishing cachedData exists");
        const phishingDomains = cachedData.domains || [];

        this._setKnownPhishingDomains(phishingDomains);
        this._handleTestUrls();
      }

      // If cache is empty or expired, trigger an immediate update
      if (
        this._knownPhishingDomains.size === 0 ||
        Date.now() - this._lastUpdateTime >= this._UPDATE_INTERVAL
      ) {
        await this._fetchKnownPhishingDomains();
      }
    } catch (error) {
      this._logService.error(
        "[PhishingDetectionService] Failed to load cached phishing domains:",
        error,
      );
      this._handleTestUrls();
    }
  }

  /**
   * Fetches the latest known phishing domains from the audit service
   * Updates the cache and handles retries if necessary
   */
  static async _fetchKnownPhishingDomains(): Promise<void> {
    let domains: string[] = [];

    // Prevent concurrent updates
    if (this._isUpdating) {
      this._logService.warning(
        "[PhishingDetectionService] Update already in progress, skipping...",
      );
      return;
    }

    try {
      this._logService.info("[PhishingDetectionService] Starting phishing domains update...");
      this._isUpdating = true;
      domains = await this._auditService.getKnownPhishingDomains();
      this._setKnownPhishingDomains(domains);

      await this._saveDomains();

      this._resetRetry();
      this._isUpdating = false;

      this._logService.info("[PhishingDetectionService] Successfully fetched domains");
    } catch (error) {
      this._logService.error(
        "[PhishingDetectionService] Failed to fetch known phishing domains",
        error.message,
      );

      this._scheduleRetry();
      this._isUpdating = false;

      throw error;
    }
  }

  /**
   * Saves the known phishing domains to storage
   * Caches the updated domains and updates the last update time
   */
  private static async _saveDomains() {
    try {
      // Cache the updated domains
      await this._storageService.save(this._STORAGE_KEY, {
        domains: Array.from(this._knownPhishingDomains),
        timestamp: this._lastUpdateTime,
      });
      this._logService.info(
        `[PhishingDetectionService] Updated phishing domains cache with ${this._knownPhishingDomains.size} domains`,
      );
    } catch (error) {
      this._logService.error(
        "[PhishingDetectionService] Failed to save known phishing domains",
        error.message,
      );
      this._scheduleRetry();
      throw error;
    }
  }

  /**
   * Resets the retry count and clears the retry subscription
   */
  private static _resetRetry(): void {
    this._logService.info(
      `[PhishingDetectionService] Resetting retry count and clearing retry subscription.`,
    );
    // Reset retry count and clear retry subscription on success
    this._retryCount = 0;
    if (this._retrySubscription) {
      this._retrySubscription.unsubscribe();
      this._retrySubscription = null;
    }
  }

  /**
   * Adds phishing domains to the known phishing domains set
   * Clears old domains to prevent memory leaks
   *
   * @param domains Array of phishing domains to add
   */
  private static _setKnownPhishingDomains(domains: string[]): void {
    this._logService.debug(
      `[PhishingDetectionService] Tracking ${domains.length} phishing domains`,
    );

    // Clear old domains to prevent memory leaks
    this._knownPhishingDomains.clear();

    domains.forEach((domain: string) => {
      if (domain) {
        this._knownPhishingDomains.add(domain);
      }
    });
    this._lastUpdateTime = Date.now();
  }

  /**
   * Cleans up the phishing detection service
   * Unsubscribes from all subscriptions and clears caches
   */
  private static _cleanup() {
    if (this._updateCacheSubscription) {
      this._updateCacheSubscription.unsubscribe();
      this._updateCacheSubscription = null;
    }
    if (this._retrySubscription) {
      this._retrySubscription.unsubscribe();
      this._retrySubscription = null;
    }
    this._knownPhishingDomains.clear();
    this._caughtTabs.clear();
    this._lastUpdateTime = 0;
    this._isUpdating = false;
    this._retryCount = 0;
    // [FIXME] BrowserApi remove listeners when enabled
    BrowserApi.removeListener(chrome.runtime.onMessage, this._handleExtensionMessage.bind(this));
    BrowserApi.removeListener(
      chrome.webNavigation.onCompleted,
      this._handleNavigationEvent.bind(this),
    );
  }
}
