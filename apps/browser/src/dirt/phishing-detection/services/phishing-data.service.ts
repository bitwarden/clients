import {
  catchError,
  distinctUntilChanged,
  EMPTY,
  filter,
  finalize,
  first,
  firstValueFrom,
  from,
  of,
  retry,
  shareReplay,
  Subject,
  Subscription,
  switchMap,
  tap,
  timer,
} from "rxjs";

import { devFlagEnabled, devFlagValue } from "@bitwarden/browser/platform/flags";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ScheduledTaskNames, TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import { LogService } from "@bitwarden/logging";
import {
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
  PHISHING_DETECTION_DISK,
} from "@bitwarden/state";

import { getPhishingResources, PhishingResourceType } from "../phishing-resources";

export type PhishingData = {
  webAddresses: string[];
  timestamp: number;
  checksum: string;

  /**
   * We store the application version to refetch the entire dataset on a new client release.
   * This counteracts daily appends updates not removing inactive or false positive web addresses.
   */
  applicationVersion: string;
};

export const PHISHING_DOMAINS_KEY = new KeyDefinition<PhishingData>(
  PHISHING_DETECTION_DISK,
  "phishingDomains",
  {
    deserializer: (value: PhishingData) => {
      return value ?? { webAddresses: [], timestamp: 0, checksum: "", applicationVersion: "" };
    },
  },
);

/** Coordinates fetching, caching, and patching of known phishing web addresses */
export class PhishingDataService {
  // Static tracking to prevent interval accumulation across service instances (reload scenario)
  private static _intervalSubscription: Subscription | null = null;

  private _testWebAddresses = this.getTestWebAddresses();
  private _cachedPhishingDataStateInstance: GlobalState<PhishingData> | null = null;

  /**
   * Lazy getter for cached phishing data state. Only accesses storage when phishing detection is actually used.
   * This prevents blocking service worker initialization on extension reload for non-premium users.
   */
  private get _cachedPhishingDataState() {
    if (this._cachedPhishingDataStateInstance === null) {
      this.logService.debug("[PhishingDataService] Lazy-loading state from storage (first access)");
      this._cachedPhishingDataStateInstance = this.globalStateProvider.get(PHISHING_DOMAINS_KEY);
    }
    return this._cachedPhishingDataStateInstance;
  }

  constructor(
    private apiService: ApiService,
    private taskSchedulerService: TaskSchedulerService,
    private globalStateProvider: GlobalStateProvider,
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
    private resourceType: PhishingResourceType = PhishingResourceType.Links,
  ) {
    this.taskSchedulerService.registerTaskHandler(ScheduledTaskNames.phishingDomainUpdate, () => {
      this._triggerUpdate$.next();
    });

    // Clean up previous interval if it exists (prevents accumulation on service recreation)
    if (PhishingDataService._intervalSubscription) {
      PhishingDataService._intervalSubscription.unsubscribe();
      PhishingDataService._intervalSubscription = null;
    }
    // Store interval subscription statically to prevent accumulation on reload
    PhishingDataService._intervalSubscription = this.taskSchedulerService.setInterval(
      ScheduledTaskNames.phishingDomainUpdate,
      this.UPDATE_INTERVAL_DURATION,
    );
  }

  // In-memory cache to avoid expensive Set rebuilds and state rewrites
  private _cachedWebAddressesSet: Set<string> | null = null;
  private _cachedSetChecksum: string = "";
  private _lastCheckTime: number = 0; // Track check time in memory, not state

  // Lazy observable: only subscribes to state$ when actually needed (first URL check)
  // This prevents blocking service worker initialization on extension reload
  // Using a getter with caching to defer access to _cachedPhishingDataState until actually subscribed
  private _webAddresses$Instance: ReturnType<typeof this.createWebAddresses$> | null = null;
  private get _webAddresses$() {
    if (this._webAddresses$Instance === null) {
      this._webAddresses$Instance = this.createWebAddresses$();
    }
    return this._webAddresses$Instance;
  }

  private createWebAddresses$() {
    return this._cachedPhishingDataState.state$.pipe(
      // Only rebuild Set when checksum changes (actual data change)
      distinctUntilChanged((prev, curr) => prev?.checksum === curr?.checksum),
      switchMap((state) => {
        // Return cached Set if checksum matches
        if (this._cachedWebAddressesSet && state?.checksum === this._cachedSetChecksum) {
          this.logService.debug(
            `[PhishingDataService] Using cached Set (${this._cachedWebAddressesSet.size} entries, checksum: ${state?.checksum.substring(0, 8)}...)`,
          );
          return of(this._cachedWebAddressesSet);
        }
        // Build Set in chunks to avoid blocking UI
        this.logService.debug(
          `[PhishingDataService] Building Set from ${state?.webAddresses?.length ?? 0} entries`,
        );
        return from(this.buildSetInChunks(state?.webAddresses ?? [], state?.checksum ?? ""));
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  // How often are new web addresses added to the remote?
  readonly UPDATE_INTERVAL_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  // Minimum time between updates when triggered by account switch (5 minutes)
  private readonly MIN_UPDATE_INTERVAL = 5 * 60 * 1000;

  private _triggerUpdate$ = new Subject<void>();
  private _updateInProgress = false;

  /**
   * Observable that handles phishing data updates.
   *
   * Updates are triggered explicitly via triggerUpdateIfNeeded() or the 24-hour scheduler.
   * The observable includes safeguards to prevent redundant updates:
   * - Skips if an update is already in progress
   * - Skips if cache was updated within MIN_UPDATE_INTERVAL (5 min)
   *
   * Lazy getter with caching: Only accesses _cachedPhishingDataState when actually subscribed to prevent storage read on reload.
   */
  private _update$Instance: ReturnType<typeof this.createUpdate$> | null = null;
  get update$() {
    if (this._update$Instance === null) {
      this._update$Instance = this.createUpdate$();
    }
    return this._update$Instance;
  }

  private createUpdate$() {
    return this._triggerUpdate$.pipe(
      // Don't use startWith - initial update is handled by triggerUpdateIfNeeded()
      filter(() => {
        if (this._updateInProgress) {
          this.logService.debug("[PhishingDataService] Update already in progress, skipping");
          return false;
        }
        return true;
      }),
      tap(() => {
        this._updateInProgress = true;
      }),
      switchMap(async () => {
        // Get current state directly without subscribing to state$ observable
        // This avoids creating a subscription that stays active
        const cachedState = await firstValueFrom(
          this._cachedPhishingDataState.state$.pipe(first()),
        );

        // Early exit if we checked recently (using in-memory tracking)
        const timeSinceLastCheck = Date.now() - this._lastCheckTime;
        if (timeSinceLastCheck < this.MIN_UPDATE_INTERVAL) {
          this.logService.debug(
            `[PhishingDataService] Checked ${Math.round(timeSinceLastCheck / 1000)}s ago, skipping`,
          );
          return;
        }

        // Update last check time in memory (not state - avoids expensive write)
        this._lastCheckTime = Date.now();

        try {
          const result = await this.getNextWebAddresses(cachedState);

          // result is null when checksum matched - skip state update entirely
          if (result === null) {
            this.logService.debug("[PhishingDataService] Checksum matched, skipping state update");
            return;
          }

          if (result) {
            // Yield to event loop before state update
            await new Promise((resolve) => setTimeout(resolve, 0));
            await this._cachedPhishingDataState.update(() => result);
            this.logService.info(
              `[PhishingDataService] State updated with ${result.webAddresses?.length ?? 0} entries`,
            );
          }
        } catch (err) {
          this.logService.error("[PhishingDataService] Unable to update web addresses.", err);
          // Retry logic removed - let the 24-hour scheduler handle retries
          throw err;
        }
      }),
      retry({
        count: 3,
        delay: (err, count) => {
          this.logService.error(
            `[PhishingDataService] Unable to update web addresses. Attempt ${count}.`,
            err,
          );
          return timer(5 * 60 * 1000); // 5 minutes
        },
        resetOnSuccess: true,
      }),
      catchError(
        (
          err: unknown /** Eslint actually crashed if you remove this type: https://github.com/cartant/eslint-plugin-rxjs/issues/122 */,
        ) => {
          this.logService.error(
            "[PhishingDataService] Retries unsuccessful. Unable to update web addresses.",
            err,
          );
          return EMPTY;
        },
      ),
      // Use finalize() to ensure _updateInProgress is reset on success, error, OR completion
      // Per ADR: "Use finalize() operator to ensure cleanup code always runs"
      finalize(() => {
        this._updateInProgress = false;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  /**
   * Triggers an update if the cache is stale or empty.
   * Should be called when phishing detection is enabled for an account or on install/update.
   *
   * The lazy loading of _cachedPhishingDataState ensures that storage is only accessed
   * when the update$ observable chain actually executes (i.e., when there are subscribers).
   * If there are no subscribers, the chain doesn't execute and no storage access occurs.
   */
  triggerUpdateIfNeeded(): void {
    this._triggerUpdate$.next();
  }

  /**
   * Checks if the given URL is a known phishing web address
   *
   * @param url The URL to check
   * @returns True if the URL is a known phishing web address, false otherwise
   */
  async isPhishingWebAddress(url: URL): Promise<boolean> {
    // Lazy load: Only now do we subscribe to _webAddresses$ and trigger storage read + Set build
    // This ensures we don't block service worker initialization on extension reload
    this.logService.debug(`[PhishingDataService] Checking URL: ${url.href}`);
    const entries = await firstValueFrom(this._webAddresses$);

    const resource = getPhishingResources(this.resourceType);
    if (resource && resource.match) {
      for (const entry of entries) {
        if (resource.match(url, entry)) {
          this.logService.info(`[PhishingDataService] Match: ${url.href} matched entry: ${entry}`);
          return true;
        }
      }
      return false;
    }

    // Default/domain behavior: exact hostname match as a fallback
    return entries.has(url.hostname);
  }

  /**
   * Determines if the phishing data needs to be updated and fetches new data if necessary.
   *
   * The CHECKSUM is an MD5 hash of the phishing list file, hosted at:
   * For full url see: clients/apps/browser/src/dirt/phishing-detection/phishing-resources.ts
   * - Links: https://raw.githubusercontent.com/Phishing-Database/checksums/.../phishing-links-ACTIVE.txt.md5
   * - Domains: https://raw.githubusercontent.com/Phishing-Database/checksums/.../phishing-domains-ACTIVE.txt.md5
   *
   * PURPOSE: The checksum allows us to quickly check if the list has changed without
   * downloading the entire file (~63MB uncompressed). If checksums match, data is identical.
   *
   * FLOW:
   * 1. Fetch remote checksum (~62 bytes) - fast
   * 2. Compare to local cached checksum
   * 3. If match: return null (skip expensive state update)
   * 4. If different: fetch new data and update state
   *
   * @returns PhishingData if data changed, null if checksum matched (no update needed)
   */
  async getNextWebAddresses(prev: PhishingData | null): Promise<PhishingData | null> {
    prev = prev ?? { webAddresses: [], timestamp: 0, checksum: "", applicationVersion: "" };
    const timestamp = Date.now();
    const prevAge = timestamp - prev.timestamp;

    this.logService.debug(
      `[PhishingDataService] Cache: ${prev.webAddresses?.length ?? 0} entries, age ${Math.round(prevAge / 1000 / 60)}min`,
    );

    const applicationVersion = await this.platformUtilsService.getApplicationVersion();

    // STEP 1: Fetch the remote checksum (tiny file, ~32 bytes)
    const remoteChecksum = await this.fetchPhishingChecksum(this.resourceType);

    // STEP 2: Compare checksums
    if (remoteChecksum && prev.checksum === remoteChecksum) {
      this.logService.debug("[PhishingDataService] Checksum match, no update needed");
      return null; // Signal to skip state update - no UI blocking!
    }

    // STEP 3: Checksum different - data needs to be updated
    this.logService.info("[PhishingDataService] Checksum mismatch, fetching new data");

    // Approach 1: Fetch only today's new entries (if cache is less than 24h old)
    const isOneDayOldMax = prevAge <= this.UPDATE_INTERVAL_DURATION;
    if (
      isOneDayOldMax &&
      applicationVersion === prev.applicationVersion &&
      (prev.webAddresses?.length ?? 0) > 0
    ) {
      const webAddressesTodayUrl = getPhishingResources(this.resourceType)!.todayUrl;
      const dailyWebAddresses = await this.fetchPhishingWebAddresses(webAddressesTodayUrl);
      this.logService.info(
        `[PhishingDataService] Daily update: +${dailyWebAddresses.length} entries`,
      );
      return {
        webAddresses: (prev.webAddresses ?? []).concat(dailyWebAddresses),
        checksum: remoteChecksum,
        timestamp,
        applicationVersion,
      };
    }

    // Approach 2: Fetch entire list (cache is stale or empty)
    const remoteUrl = getPhishingResources(this.resourceType)!.remoteUrl;
    const remoteWebAddresses = await this.fetchPhishingWebAddresses(remoteUrl);
    this.logService.info(`[PhishingDataService] Full update: ${remoteWebAddresses.length} entries`);
    return {
      webAddresses: remoteWebAddresses,
      timestamp,
      checksum: remoteChecksum,
      applicationVersion,
    };
  }

  /**
   * Fetches the MD5 checksum of the phishing list from GitHub.
   * The checksum file is tiny (~32 bytes) and fast to fetch.
   * Used to detect if the phishing list has changed without downloading the full list.
   */
  private async fetchPhishingChecksum(type: PhishingResourceType = PhishingResourceType.Domains) {
    const checksumUrl = getPhishingResources(type)!.checksumUrl;
    this.logService.debug(`[PhishingDataService] Fetching checksum from: ${checksumUrl}`);
    const response = await this.apiService.nativeFetch(new Request(checksumUrl));
    if (!response.ok) {
      throw new Error(`[PhishingDataService] Failed to fetch checksum: ${response.status}`);
    }
    const checksum = await response.text();
    return checksum.trim(); // MD5 checksums are 32 hex characters
  }

  /**
   * Fetches phishing web addresses from the given URL.
   * Uses streaming to avoid loading the entire file into memory at once,
   * which can cause Firefox to freeze due to memory pressure.
   */
  private async fetchPhishingWebAddresses(url: string): Promise<string[]> {
    const response = await this.apiService.nativeFetch(new Request(url));

    if (!response.ok) {
      throw new Error(`[PhishingDataService] Failed to fetch web addresses: ${response.status}`);
    }

    // Stream the response to avoid loading entire file into memory at once
    // This prevents Firefox from freezing on large phishing lists (~63MB uncompressed)
    const reader = response.body?.getReader();
    if (!reader) {
      // Fallback for environments without streaming support
      this.logService.warning(
        "[PhishingDataService] Streaming not available, falling back to full load",
      );
      const text = await response.text();
      return text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    }

    const decoder = new TextDecoder();
    const addresses: string[] = [];
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || ""; // Keep incomplete last line in buffer

        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (trimmed.length > 0) {
            addresses.push(trimmed);
          }
        }
        // Yield after processing each network chunk to keep service worker responsive
        // This allows popup messages to be handled between chunks
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Process any remaining buffer content
      const remaining = buffer.trim();
      if (remaining.length > 0) {
        addresses.push(remaining);
      }
    } finally {
      // Ensure reader is released even if an error occurs
      reader.releaseLock();
    }

    this.logService.debug(`[PhishingDataService] Streamed ${addresses.length} addresses`);
    return addresses;
  }

  /**
   * Builds a Set from an array of web addresses in chunks to avoid blocking the UI.
   * Yields to the event loop every CHUNK_SIZE entries, keeping the UI responsive
   * even when processing 700K+ entries.
   *
   * @param addresses Array of web addresses to add to the Set
   * @param checksum The checksum to associate with this cached Set
   * @returns Promise that resolves to the built Set
   */
  private async buildSetInChunks(addresses: string[], checksum: string): Promise<Set<string>> {
    const CHUNK_SIZE = 50000; // Process 50K entries per chunk (fast, fewer iterations)
    const startTime = Date.now();
    const set = new Set<string>();

    this.logService.debug(`[PhishingDataService] Building Set (${addresses.length} entries)`);

    for (let i = 0; i < addresses.length; i += CHUNK_SIZE) {
      const chunk = addresses.slice(i, Math.min(i + CHUNK_SIZE, addresses.length));
      for (const addr of chunk) {
        if (addr) {
          // Skip empty strings
          set.add(addr);
        }
      }

      // Yield to event loop after each chunk
      if (i + CHUNK_SIZE < addresses.length) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // Add test addresses
    this._testWebAddresses.forEach((addr) => set.add(addr));
    set.add("phishing.testcategory.com"); // For QA testing

    // Cache for future use
    this._cachedWebAddressesSet = set;
    this._cachedSetChecksum = checksum;

    const buildTime = Date.now() - startTime;
    this.logService.debug(
      `[PhishingDataService] Set built: ${set.size} entries in ${buildTime}ms (checksum: ${checksum.substring(0, 8)}...)`,
    );

    return set;
  }

  private getTestWebAddresses() {
    const flag = devFlagEnabled("testPhishingUrls");
    if (!flag) {
      return [];
    }

    const webAddresses = devFlagValue("testPhishingUrls") as unknown[];
    if (webAddresses && webAddresses instanceof Array) {
      this.logService.debug(
        "[PhishingDataService] Dev flag enabled for testing phishing detection. Adding test phishing web addresses:",
        webAddresses,
      );
      return webAddresses as string[];
    }
    return [];
  }
}
