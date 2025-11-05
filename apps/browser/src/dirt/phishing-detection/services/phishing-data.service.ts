import {
  catchError,
  EMPTY,
  first,
  firstValueFrom,
  map,
  retry,
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

export type PhishingData = {
  domains: string[];
  timestamp: number;
  checksum: string;

  /**
   * We store the application version to refetch the entire dataset on a new client release.
   * This counteracts daily appends updates not removing inactive or false positive domains.
   */
  applicationVersion: string;
};

export const PHISHING_DOMAINS_KEY = new KeyDefinition<PhishingData>(
  PHISHING_DETECTION_DISK,
  "phishingDomains",
  {
    deserializer: (value: PhishingData) =>
      value ?? { domains: [], timestamp: 0, checksum: "", applicationVersion: "" },
  },
);

/** Coordinates fetching, caching, and patching of known phishing domains */
export class PhishingDataService {
  private static readonly RemotePhishingDatabaseUrl =
    "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt";
  private static readonly RemotePhishingDatabaseChecksumUrl =
    "https://raw.githubusercontent.com/Phishing-Database/checksums/refs/heads/master/phishing-domains-ACTIVE.txt.md5";
  private static readonly RemotePhishingDatabaseTodayUrl =
    "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/refs/heads/master/phishing-domains-NEW-today.txt";

  private _testDomains = this.getTestDomains();
  private _cachedState = this.globalStateProvider.get(PHISHING_DOMAINS_KEY);
  private _domains$ = this._cachedState.state$.pipe(
    map(
      (state) =>
        new Set(
          (state?.domains?.filter((line) => line.trim().length > 0) ?? []).concat(
            this._testDomains,
          ),
        ),
    ),
  );

  // How often are new domains added to the remote?
  readonly UPDATE_INTERVAL_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private _triggerUpdate$ = new Subject<void>();
  update$ = this._triggerUpdate$.pipe(
    startWith(), // Always emit once
    tap(() => this.logService.info(`[PhishingDataService] Update triggered...`)),
    switchMap(() =>
      this._cachedState.state$.pipe(
        first(), // Only take the first value to avoid an infinite loop when updating the cache below
        switchMap(async (cachedState) => {
          const next = await this.getNextDomains(cachedState);
          if (next) {
            await this._cachedState.update(() => next);
            this.logService.info(`[PhishingDataService] cache updated`);
          }
        }),
        retry({
          count: 3,
          delay: (err, count) => {
            this.logService.error(
              `[PhishingDataService] Unable to update domains. Attempt ${count}.`,
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
              "[PhishingDataService] Retries unsuccessful. Unable to update domains.",
              err,
            );
            return EMPTY;
          },
        ),
      ),
    ),
  );

  constructor(
    private apiService: ApiService,
    private taskSchedulerService: TaskSchedulerService,
    private globalStateProvider: GlobalStateProvider,
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
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
   * Checks if the given URL is a known phishing domain
   *
   * @param url The URL to check
   * @returns True if the URL is a known phishing domain, false otherwise
   */
  async isPhishingDomain(url: URL): Promise<boolean> {
    const domains = await firstValueFrom(this._domains$);
    const result = domains.has(url.hostname);
    if (result) {
      this.logService.debug("[PhishingDataService] Caught phishing domain:", url.hostname);
      return true;
    }
    return false;
  }

  async getNextDomains(prev: PhishingData | null): Promise<PhishingData | null> {
    prev = prev ?? { domains: [], timestamp: 0, checksum: "", applicationVersion: "" };
    const timestamp = Date.now();
    const prevAge = timestamp - prev.timestamp;
    this.logService.info(`[PhishingDataService] Cache age: ${prevAge}`);

    const applicationVersion = await this.platformUtilsService.getApplicationVersion();

    // If checksum matches, return existing data with new timestamp & version
    const remoteChecksum = await this.fetchPhishingDomainsChecksum();
    if (remoteChecksum && prev.checksum === remoteChecksum) {
      this.logService.info(
        `[PhishingDataService] Remote checksum matches local checksum, updating timestamp only.`,
      );
      return { ...prev, timestamp, applicationVersion };
    }
    // Checksum is different, data needs to be updated.

    // Approach 1: Fetch only new domains and append
    const isOneDayOldMax = prevAge <= this.UPDATE_INTERVAL_DURATION;
    if (isOneDayOldMax && applicationVersion === prev.applicationVersion) {
      const dailyDomains: string[] = await this.fetchPhishingDomains(
        PhishingDataService.RemotePhishingDatabaseTodayUrl,
      );
      this.logService.info(
        `[PhishingDataService] ${dailyDomains.length} new phishing domains added`,
      );
      return {
        domains: prev.domains.concat(dailyDomains),
        checksum: remoteChecksum,
        timestamp,
        applicationVersion,
      };
    }

    // Approach 2: Fetch all domains
    const domains = await this.fetchPhishingDomains(PhishingDataService.RemotePhishingDatabaseUrl);
    return {
      domains,
      timestamp,
      checksum: remoteChecksum,
      applicationVersion,
    };
  }

  private async fetchPhishingDomainsChecksum() {
    const response = await this.apiService.nativeFetch(
      new Request(PhishingDataService.RemotePhishingDatabaseChecksumUrl),
    );
    if (!response.ok) {
      throw new Error(`[PhishingDataService] Failed to fetch checksum: ${response.status}`);
    }
    return response.text();
  }

  private async fetchPhishingDomains(url: string) {
    const response = await this.apiService.nativeFetch(new Request(url));

    if (!response.ok) {
      throw new Error(`[PhishingDataService] Failed to fetch domains: ${response.status}`);
    }

    return response.text().then((text) => text.split("\n"));
  }

  private getTestDomains() {
    const flag = devFlagEnabled("testPhishingUrls");
    if (!flag) {
      return [];
    }

    const domains = devFlagValue("testPhishingUrls") as unknown[];
    if (domains && domains instanceof Array) {
      this.logService.debug(
        "[PhishingDetectionService] Dev flag enabled for testing phishing detection. Adding test phishing domains:",
        domains,
      );
      return domains as string[];
    }
    return [];
  }
}
