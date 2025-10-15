import {
  combineLatest,
  concatMap,
  delay,
  EMPTY,
  map,
  Subject,
  Subscription,
  switchMap,
} from "rxjs";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { devFlagEnabled, devFlagValue } from "@bitwarden/common/platform/misc/flags";
import { ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";
import { TaskSchedulerService } from "@bitwarden/common/platform/scheduling/task-scheduler.service";

import { BrowserApi } from "../../../platform/browser/browser-api";

import { CDNPhishingService, ICloudPhishingDomainQuery } from "./cdn-phishing.service";
import { PhishingChecksumService } from "./phishing-checksum.service";
import { PhishingDataParserService } from "./phishing-data-parser.service";
import {
  CaughtPhishingDomain,
  isPhishingDetectionMessage,
  PhishingDetectionMessage,
  PhishingDetectionNavigationEvent,
  PhishingDetectionTabId,
} from "./phishing-detection.types";

export class PhishingDetectionService {
  private static readonly _UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private static readonly _RETRY_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static readonly _MAX_RETRIES = 3;
  private static readonly _STORAGE_KEY = "phishing_domains_cache";
  private static _logService: LogService;
  private static _storageService: AbstractStorageService;
  private static _taskSchedulerService: TaskSchedulerService;
  private static _cloudPhishingDomainQuery: ICloudPhishingDomainQuery | null;
  private static _checksumService: PhishingChecksumService | null;
  private static _parserService: PhishingDataParserService | null;
  private static _updateCacheSubscription: Subscription | null = null;
  private static _retrySubscription: Subscription | null = null;
  private static _navigationEventsSubject = new Subject<PhishingDetectionNavigationEvent>();
  private static _navigationEvents: Subscription | null = null;
  // Store bound listener references to remove them correctly during cleanup
  private static _onMessageHandler:
    | ((message: unknown, sender: chrome.runtime.MessageSender) => boolean)
    | null = null;
  private static _onReplacedHandler: ((newTabId: number, originalTabId: number) => boolean) | null =
    null;
  private static _onUpdatedHandler:
    | ((tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => boolean)
    | null = null;
  private static _knownPhishingDomains = new Set<string>();
  private static _caughtTabs: Map<PhishingDetectionTabId, CaughtPhishingDomain> = new Map();
  private static _isInitialized = false;
  private static _isUpdating = false;
  private static _retryCount = 0;
  private static _lastUpdateTime: number = 0;

  static initialize(
    accountService: AccountService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    configService: ConfigService,
    eventCollectionService: EventCollectionService,
    logService: LogService,
    storageService: AbstractStorageService,
    taskSchedulerService: TaskSchedulerService,
  ): void {
    this._logService = logService;
    this._storageService = storageService;
    this._taskSchedulerService = taskSchedulerService;

    // Initialize CDN services
    this._parserService = new PhishingDataParserService(logService);
    this._checksumService = new PhishingChecksumService(logService, storageService);
    this._cloudPhishingDomainQuery = new CDNPhishingService(
      logService,
      this._parserService!,
      this._checksumService!,
    );

    logService.info("[PhishingDetectionService] Initialize called. Checking prerequisites...");

    combineLatest([
      accountService.activeAccount$,
      configService.getFeatureFlag$(FeatureFlag.PhishingDetection),
    ])
      .pipe(
        switchMap(([account, featureEnabled]) => {
          if (!account) {
            logService.info("[PhishingDetectionService] No active account.");
            void this._cleanup();
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
            await this._cleanup();
          } else {
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
    void chrome.runtime.sendMessage({ command: PhishingDetectionMessage.Close });
  }

  /**
   * Sends a message to the phishing detection service to continue to the caught url
   */
  static requestContinueToDangerousUrl(): void {
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
    if (this._isInitialized) {
      this._logService.info("[PhishingDetectionService] Already initialized, skipping setup.");
      return;
    }

    this._isInitialized = true;
    this._setupListeners();

    // Register the update task
    this._taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.phishingDomainUpdate,
      async () => {
        try {
          // Fetch from CDN
          await this._fetchFromGitHubCDN();
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
    this._onMessageHandler = this._handleExtensionMessage.bind(this) as unknown as (
      message: unknown,
      sender: chrome.runtime.MessageSender,
    ) => boolean;
    this._onReplacedHandler = this._handleReplacementEvent.bind(this);
    this._onUpdatedHandler = this._handleNavigationEvent.bind(this);

    BrowserApi.addListener(chrome.runtime.onMessage, this._onMessageHandler as any);
    BrowserApi.addListener(chrome.tabs.onReplaced, this._onReplacedHandler as any);
    BrowserApi.addListener(chrome.tabs.onUpdated, this._onUpdatedHandler as any);

    // When a navigation event occurs, check if a replace event for the same tabId exists,
    // and call the replace handler before handling navigation.
    this._navigationEvents = this._navigationEventsSubject
      .pipe(
        delay(100), // Delay slightly to allow replace events to be caught
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
    this._checkTabForPhishing(tabId, new URL(tab.url));
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
    return !!hasRequestedContinue;
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

    const isPhishing = this.isPhishingDomain(url);
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
        this._lastUpdateTime = cachedData.timestamp || 0;
        this._handleTestUrls();
      }

      // If cache is empty or expired, trigger an immediate update
      if (
        this._knownPhishingDomains.size === 0 ||
        Date.now() - this._lastUpdateTime >= this._UPDATE_INTERVAL
      ) {
        // Fetch from CDN
        await this._fetchFromGitHubCDN();
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
   * Fetches the latest known phishing domains from GitHub CDN
   * Implements checksum-based updates
   */
  static async _fetchFromGitHubCDN(): Promise<void> {
    // Prevent concurrent updates
    if (this._isUpdating) {
      this._logService.warning(
        "[PhishingDetectionService] Update already in progress, skipping...",
      );
      return;
    }

    // Check for service initialization failures (non-transient errors)
    if (!this._cloudPhishingDomainQuery || !this._checksumService || !this._parserService) {
      this._logService.error(
        "[PhishingDetectionService] Services not initialized properly. Cannot fetch phishing domains.",
      );
      return; // Don't retry for initialization failures
    }

    try {
      this._logService.info(
        "[PhishingDetectionService] Starting phishing domains update from GitHub CDN...",
      );
      this._isUpdating = true;

      // 1. Get remote checksum first
      const remoteChecksum = await this._cloudPhishingDomainQuery.getRemoteChecksumAsync();
      if (!remoteChecksum) {
        throw new Error("Failed to get remote checksum from GitHub CDN");
      }

      // 2. Get current checksum
      const currentChecksum = await this._checksumService.getCurrentChecksum();

      // 3. Compare checksums
      if (this._checksumService.compareChecksums(currentChecksum, remoteChecksum)) {
        this._logService.info(
          `[PhishingDetectionService] Phishing domains list is up to date (checksum: ${currentChecksum}). Skipping update.`,
        );
        this._isUpdating = false;
        return;
      }

      this._logService.info(
        `[PhishingDetectionService] Checksums differ (current: ${currentChecksum}, remote: ${remoteChecksum}). Updating phishing domains from GitHub CDN.`,
      );

      // 4. Fetch and use domains only when checksum changed
      const fetchedDomains = await this._cloudPhishingDomainQuery.getPhishingDomainsAsync();
      if (!fetchedDomains || fetchedDomains.length === 0) {
        throw new Error("No valid domains found in the response from GitHub CDN");
      }

      // 5. Validate and filter domains
      const validDomains = this._parserService.validateAndFilterDomains(fetchedDomains);
      this._setKnownPhishingDomains(validDomains);

      // 6. Save domains and checksum
      this._lastUpdateTime = Date.now();
      await this._saveDomains();
      await this._checksumService.saveChecksum(remoteChecksum);

      this._resetRetry();
      this._isUpdating = false;

      this._logService.info(
        `[PhishingDetectionService] Successfully updated ${validDomains.length} phishing domains with checksum ${remoteChecksum}`,
      );
    } catch (error) {
      this._logService.error(
        "[PhishingDetectionService] Failed to fetch known phishing domains from GitHub CDN.",
        error,
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
        timestamp: this._lastUpdateTime || Date.now(),
      });
      this._logService.info(
        `[PhishingDetectionService] Updated phishing domains cache with ${this._knownPhishingDomains.size} domains`,
      );
    } catch (error) {
      this._logService.error(
        "[PhishingDetectionService] Failed to save known phishing domains.",
        error,
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
  }

  /**
   * Cleans up the phishing detection service
   * Unsubscribes from all subscriptions and clears caches
   * Waits for any ongoing update to complete before cleaning up
   */
  private static async _cleanup(): Promise<void> {
    // Wait for any ongoing update to complete before cleaning up
    if (this._isUpdating) {
      this._logService.warning(
        "[PhishingDetectionService] Cleanup called while update in progress, waiting for completion...",
      );

      // Wait up to 5 seconds for update to complete
      const maxWaitTime = 5000;
      const startTime = Date.now();

      while (this._isUpdating && Date.now() - startTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (this._isUpdating) {
        this._logService.warning(
          "[PhishingDetectionService] Update did not complete within timeout, forcing cleanup",
        );
        this._isUpdating = false;
      }
    }

    if (this._updateCacheSubscription) {
      this._updateCacheSubscription.unsubscribe();
      this._updateCacheSubscription = null;
    }
    if (this._retrySubscription) {
      this._retrySubscription.unsubscribe();
      this._retrySubscription = null;
    }
    if (this._navigationEvents) {
      this._navigationEvents.unsubscribe();
      this._navigationEvents = null;
    }
    this._knownPhishingDomains.clear();
    this._caughtTabs.clear();
    this._lastUpdateTime = 0;
    this._isUpdating = false;
    this._isInitialized = false;
    this._retryCount = 0;
    if (this._cloudPhishingDomainQuery) {
      this._cloudPhishingDomainQuery = null;
    }
    if (this._checksumService) {
      this._checksumService = null;
    }
    if (this._parserService) {
      this._parserService = null;
    }

    // Manually type cast to satisfy the listener signature due to the mixture
    // of static and instance methods in this class. To be fixed when refactoring
    // this class to be instance-based while providing a singleton instance in usage
    if (this._onMessageHandler) {
      BrowserApi.removeListener(
        chrome.runtime.onMessage,
        this._onMessageHandler as (...args: readonly unknown[]) => unknown,
      );
      this._onMessageHandler = null;
    }
    if (this._onReplacedHandler) {
      BrowserApi.removeListener(
        chrome.tabs.onReplaced,
        this._onReplacedHandler as (...args: readonly unknown[]) => unknown,
      );
      this._onReplacedHandler = null;
    }
    if (this._onUpdatedHandler) {
      BrowserApi.removeListener(
        chrome.tabs.onUpdated,
        this._onUpdatedHandler as (...args: readonly unknown[]) => unknown,
      );
      this._onUpdatedHandler = null;
    }
  }
}
