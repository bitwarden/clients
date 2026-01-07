import {
  catchError,
  EMPTY,
  first,
  firstValueFrom,
  map,
  retry,
  share,
  startWith,
  Subject,
  switchMap,
  tap,
  timer,
} from "rxjs";

import { devFlagEnabled, devFlagValue } from "@bitwarden/browser/platform/flags";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ScheduledTaskNames, TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import { LogService } from "@bitwarden/logging";
import { GlobalStateProvider, KeyDefinition, PHISHING_DETECTION_DISK } from "@bitwarden/state";

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
    deserializer: (value: PhishingData) =>
      value ?? { webAddresses: [], timestamp: 0, checksum: "", applicationVersion: "" },
  },
);

/** Coordinates fetching, caching, and patching of known phishing web addresses */
export class PhishingDataService {
  private _testWebAddresses = this.getTestWebAddresses();
  private _cachedState = this.globalStateProvider.get(PHISHING_DOMAINS_KEY);
  private _webAddresses$ = this._cachedState.state$.pipe(
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
    tap(() => this.logService.info(`[PhishingDataService] Update triggered...`)),
    switchMap(() =>
      this._cachedState.state$.pipe(
        first(), // Only take the first value to avoid an infinite loop when updating the cache below
        switchMap(async (cachedState) => {
          const next = await this.getNextWebAddresses(cachedState);
          if (next) {
            await this._cachedState.update(() => next);
            this.logService.info(`[PhishingDataService] cache updated`);
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

  async getNextWebAddresses(prev: PhishingData | null): Promise<PhishingData | null> {
    prev = prev ?? { webAddresses: [], timestamp: 0, checksum: "", applicationVersion: "" };
    const timestamp = Date.now();
    const prevAge = timestamp - prev.timestamp;
    this.logService.info(`[PhishingDataService] Cache age: ${prevAge}`);

    const applicationVersion = await this.platformUtilsService.getApplicationVersion();

    // If checksum matches, return existing data with new timestamp & version
    const remoteChecksum = await this.fetchPhishingChecksum(this.resourceType);
    if (remoteChecksum && prev.checksum === remoteChecksum) {
      this.logService.info(
        `[PhishingDataService] Remote checksum matches local checksum, updating timestamp only.`,
      );
      return { ...prev, timestamp, applicationVersion };
    }
    // Checksum is different, data needs to be updated.

    // Approach 1: Fetch only new web addresses and append
    const isOneDayOldMax = prevAge <= this.UPDATE_INTERVAL_DURATION;
    if (isOneDayOldMax && applicationVersion === prev.applicationVersion) {
      const webAddressesTodayUrl = getPhishingResources(this.resourceType)!.todayUrl;
      const dailyWebAddresses: string[] =
        await this.fetchPhishingWebAddresses(webAddressesTodayUrl);
      this.logService.info(
        `[PhishingDataService] ${dailyWebAddresses.length} new phishing web addresses added`,
      );
      return {
        webAddresses: prev.webAddresses.concat(dailyWebAddresses),
        checksum: remoteChecksum,
        timestamp,
        applicationVersion,
      };
    }

    // Approach 2: Fetch all web addresses
    const remoteUrl = getPhishingResources(this.resourceType)!.remoteUrl;
    const remoteWebAddresses = await this.fetchPhishingWebAddresses(remoteUrl);
    return {
      webAddresses: remoteWebAddresses,
      timestamp,
      checksum: remoteChecksum,
      applicationVersion,
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
}
