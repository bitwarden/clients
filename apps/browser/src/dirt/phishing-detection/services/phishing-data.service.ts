import {
  catchError,
  combineLatest,
  EMPTY,
  first,
  firstValueFrom,
  map,
  share,
  startWith,
  Subject,
  switchMap,
  tap,
} from "rxjs";

import { devFlagEnabled, devFlagValue } from "@bitwarden/browser/platform/flags";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ScheduledTaskNames, TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import { LogService } from "@bitwarden/logging";
import { GlobalStateProvider, KeyDefinition, PHISHING_DETECTION_DISK } from "@bitwarden/state";

import { getPhishingResources, PhishingResourceType } from "../phishing-resources";

/** Stores the actual phishing web addresses (expensive to update - triggers Set rebuild) */
export type PhishingData = {
  webAddresses: string[];
};

/** Stores metadata about the cache (cheap to update - no Set rebuild) */
export type PhishingMetadata = {
  timestamp: number;
  checksum: string;
  /**
   * We store the application version to refetch the entire dataset on a new client release.
   * This counteracts daily appends updates not removing inactive or false positive web addresses.
   */
  applicationVersion: string;
};

export const PHISHING_DATA_KEY = new KeyDefinition<PhishingData>(
  PHISHING_DETECTION_DISK,
  "phishingData",
  {
    deserializer: (value: PhishingData) => value ?? { webAddresses: [] },
  },
);

export const PHISHING_METADATA_KEY = new KeyDefinition<PhishingMetadata>(
  PHISHING_DETECTION_DISK,
  "phishingMetadata",
  {
    deserializer: (value: PhishingMetadata) =>
      value ?? { timestamp: 0, checksum: "", applicationVersion: "" },
  },
);

/** Coordinates fetching, caching, and patching of known phishing web addresses */
export class PhishingDataService {
  private _testWebAddresses = this.getTestWebAddresses();

  // Split state: data (expensive) and metadata (cheap)
  private _dataState = this.globalStateProvider.get(PHISHING_DATA_KEY);
  private _metadataState = this.globalStateProvider.get(PHISHING_METADATA_KEY);

  // Only subscribes to data state - metadata updates won't trigger Set rebuild
  private _webAddresses$ = this._dataState.state$.pipe(
    map(
      (state) =>
        new Set(
          (state?.webAddresses?.filter((line) => line.trim().length > 0) ?? []).concat(
            this._testWebAddresses,
            "phishing.testcategory.com", // Included for QA to test in prod
          ),
        ),
    ),
  );

  // How often are new web addresses added to the remote?
  readonly UPDATE_INTERVAL_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private _triggerUpdate$ = new Subject<void>();
  update$ = this._triggerUpdate$.pipe(
    startWith(undefined), // Always emit once
    switchMap(() =>
      combineLatest([this._dataState.state$, this._metadataState.state$]).pipe(
        first(), // Only take the first value to avoid an infinite loop when updating the cache below
        tap(([data, metadata]) => {
          void this._backgroundUpdate(data, metadata);
        }),
        catchError((err: unknown) => {
          this.logService.error("[PhishingDataService] Background update failed to start.", err);
          return EMPTY;
        }),
      ),
    ),
    share(),
  );

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
    this.taskSchedulerService.setInterval(
      ScheduledTaskNames.phishingDomainUpdate,
      this.UPDATE_INTERVAL_DURATION,
    );
  }

  /**
   * Checks if the given URL is a known phishing web address
   *
   * @param url The URL to check
   * @returns True if the URL is a known phishing web address, false otherwise
   */
  async isPhishingWebAddress(url: URL): Promise<boolean> {
    // Use domain (hostname) matching for domain resources, and link matching for links resources
    const entries = await firstValueFrom(this._webAddresses$);

    const resource = getPhishingResources(this.resourceType);
    if (resource && resource.match) {
      for (const entry of entries) {
        if (resource.match(url, entry)) {
          return true;
        }
      }
      return false;
    }

    // Default/domain behavior: exact hostname match as a fallback
    return entries.has(url.hostname);
  }

  async getNextWebAddresses(
    prevData: PhishingData | null,
    prevMetadata: PhishingMetadata | null,
  ): Promise<{ metadata: PhishingMetadata; webAddresses?: string[] }> {
    const data = prevData ?? { webAddresses: [] };
    const metadata = prevMetadata ?? { timestamp: 0, checksum: "", applicationVersion: "" };

    const timestamp = Date.now();
    const prevAge = timestamp - metadata.timestamp;
    this.logService.info(`[PhishingDataService] Cache age: ${prevAge}`);

    const applicationVersion = await this.platformUtilsService.getApplicationVersion();
    const remoteChecksum = await this.fetchPhishingChecksum(this.resourceType);

    // If checksum fetch failed/empty, keep current checksum and skip data update
    if (!remoteChecksum) {
      this.logService.info(`[PhishingDataService] Checksum fetch returned empty, skipping update.`);
      return {
        metadata: { timestamp, checksum: metadata.checksum, applicationVersion },
      };
    }

    // If checksum matches, only update metadata (no data change needed)
    if (metadata.checksum === remoteChecksum) {
      this.logService.info(`[PhishingDataService] Checksum match, updating metadata only.`);
      return {
        metadata: { timestamp, checksum: remoteChecksum, applicationVersion },
      };
    }

    // Checksum is different, data needs to be updated.

    // Approach 1: Fetch only new web addresses and append
    const isOneDayOldMax = prevAge <= this.UPDATE_INTERVAL_DURATION;
    if (isOneDayOldMax && applicationVersion === metadata.applicationVersion) {
      const webAddressesTodayUrl = getPhishingResources(this.resourceType)!.todayUrl;
      const dailyWebAddresses: string[] =
        await this.fetchPhishingWebAddresses(webAddressesTodayUrl);
      this.logService.info(
        `[PhishingDataService] ${dailyWebAddresses.length} new phishing web addresses added`,
      );
      return {
        metadata: { timestamp, checksum: remoteChecksum, applicationVersion },
        webAddresses: data.webAddresses.concat(dailyWebAddresses),
      };
    }

    // Approach 2: Fetch all web addresses
    const remoteUrl = getPhishingResources(this.resourceType)!.remoteUrl;
    const remoteWebAddresses = await this.fetchPhishingWebAddresses(remoteUrl);
    return {
      metadata: { timestamp, checksum: remoteChecksum, applicationVersion },
      webAddresses: remoteWebAddresses,
    };
  }

  private async fetchPhishingChecksum(type: PhishingResourceType = PhishingResourceType.Domains) {
    const checksumUrl = getPhishingResources(type)!.checksumUrl;
    const response = await this.apiService.nativeFetch(new Request(checksumUrl));
    if (!response.ok) {
      throw new Error(`[PhishingDataService] Failed to fetch checksum: ${response.status}`);
    }
    return response.text();
  }

  private async fetchPhishingWebAddresses(url: string) {
    const response = await this.apiService.nativeFetch(new Request(url));

    if (!response.ok) {
      throw new Error(`[PhishingDataService] Failed to fetch web addresses: ${response.status}`);
    }

    return response.text().then((text) => text.split("\n"));
  }

  private getTestWebAddresses() {
    const flag = devFlagEnabled("testPhishingUrls");
    if (!flag) {
      return [];
    }

    const webAddresses = devFlagValue("testPhishingUrls") as unknown[];
    if (webAddresses && webAddresses instanceof Array) {
      this.logService.debug(
        "[PhishingDetectionService] Dev flag enabled for testing phishing detection. Adding test phishing web addresses:",
        webAddresses,
      );
      return webAddresses as string[];
    }
    return [];
  }

  // Runs the update flow in the background and retries up to 3 times on failure
  private async _backgroundUpdate(
    prevData: PhishingData | null,
    prevMetadata: PhishingMetadata | null,
  ): Promise<void> {
    this.logService.info(`[PhishingDataService] Update triggered...`);
    // Start time for logging performance of update
    const startTime = Date.now();
    const maxAttempts = 3;
    const delayMs = 5 * 60 * 1000; // 5 minutes

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.getNextWebAddresses(prevData, prevMetadata);

        // Always update metadata (cheap - no Set rebuild)
        await this._metadataState.update(() => result.metadata);

        // Only update data if webAddresses changed (expensive - triggers Set rebuild)
        if (result.webAddresses) {
          await this._dataState.update(() => ({ webAddresses: result.webAddresses! }));

          // Performance logging
          const elapsed = Date.now() - startTime;
          this.logService.info(`[PhishingDataService] cache updated in ${elapsed}ms`);
        }
        return;
      } catch (err) {
        this.logService.error(
          `[PhishingDataService] Unable to update web addresses. Attempt ${attempt}.`,
          err,
        );
        if (attempt < maxAttempts) {
          await new Promise((res) => setTimeout(res, delayMs));
        } else {
          const elapsed = Date.now() - startTime;
          this.logService.error(
            `[PhishingDataService] Retries unsuccessful after ${elapsed}ms. Unable to update web addresses.`,
            err,
          );
        }
      }
    }
  }
}
