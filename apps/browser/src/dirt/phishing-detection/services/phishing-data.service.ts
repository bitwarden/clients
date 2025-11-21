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

export type PhishingData = {
  domains: string[]; // Note: Despite the name, this now stores full phishing URLs/links
  timestamp: number;
  checksum: string;

  /**
   * We store the application version to refetch the entire dataset on a new client release.
   * This counteracts daily appends updates not removing inactive or false positive links.
   */
  applicationVersion: string;
};

export const PHISHING_DOMAINS_KEY = new KeyDefinition<PhishingData>(
  PHISHING_DETECTION_DISK,
  "phishingDomains", // Key name kept for backward compatibility with existing cached data
  {
    deserializer: (value: PhishingData) =>
      value ?? { domains: [], timestamp: 0, checksum: "", applicationVersion: "" },
  },
);

/** Coordinates fetching, caching, and patching of known phishing links */
export class PhishingDataService {
  private static readonly RemotePhishingDatabaseUrl =
    "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-links-ACTIVE.txt";
  private static readonly RemotePhishingDatabaseChecksumUrl =
    "https://raw.githubusercontent.com/Phishing-Database/checksums/refs/heads/master/phishing-links-ACTIVE.txt.md5";
  private static readonly RemotePhishingDatabaseTodayUrl =
    "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/refs/heads/master/phishing-links-NEW-today.txt";

  private _testLinks = this.getTestLinks();
  private _cachedState = this.globalStateProvider.get(PHISHING_DOMAINS_KEY);
  private _links$ = this._cachedState.state$.pipe(
    map(
      (state) =>
        new Set(
          (state?.domains?.filter((line) => line.trim().length > 0) ?? [])
            .map((line) => line.toLowerCase().replace(/\/$/, "")) // Normalize URLs
            .concat(
              this._testLinks,
              "http://phishing.testcategory.com", // Included for QA to test in prod
            ),
        ),
    ),
  );

  // How often are new links added to the remote?
  readonly UPDATE_INTERVAL_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private _triggerUpdate$ = new Subject<void>();
  update$ = this._triggerUpdate$.pipe(
    startWith(undefined), // Always emit once
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
    share(),
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
   * Checks if the given URL is a known phishing link
   *
   * @param url The URL to check
   * @returns True if the URL is a known phishing link, false otherwise
   */
  async isPhishingDomain(url: URL): Promise<boolean> {
    const links = await firstValueFrom(this._links$);

    // Normalize the URL for comparison (remove trailing slash, convert to lowercase)
    const normalizedUrl = url.href.toLowerCase().replace(/\/$/, "");

    // Strategy: Check for prefix matches to catch URLs with additional path segments
    // For example, if database has "http://phish.com/login", we want to match:
    // - "http://phish.com/login" (exact match)
    // - "http://phish.com/login/oauth" (subpath match)
    // - "http://phish.com/login?param=value" (with query params)

    for (const link of links) {
      // Exact match (handles trailing slash differences)
      if (link === normalizedUrl || link === normalizedUrl + "/") {
        return true;
      }

      // Prefix match: Check if the current URL starts with the phishing link
      // This handles cases where the user visits a subpath of a known phishing URL
      if (normalizedUrl.startsWith(link + "/") || normalizedUrl.startsWith(link + "?")) {
        return true;
      }

      // Also check if the link in database has a trailing slash
      if (link.endsWith("/")) {
        const linkWithoutSlash = link.slice(0, -1);
        if (
          normalizedUrl === linkWithoutSlash ||
          normalizedUrl.startsWith(linkWithoutSlash + "/")
        ) {
          return true;
        }
      }
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
    const remoteChecksum = await this.fetchPhishingLinksChecksum();
    if (remoteChecksum && prev.checksum === remoteChecksum) {
      this.logService.info(
        `[PhishingDataService] Remote checksum matches local checksum, updating timestamp only.`,
      );
      return { ...prev, timestamp, applicationVersion };
    }
    // Checksum is different, data needs to be updated.

    // Approach 1: Fetch only new links and append
    const isOneDayOldMax = prevAge <= this.UPDATE_INTERVAL_DURATION;
    if (isOneDayOldMax && applicationVersion === prev.applicationVersion) {
      const dailyLinks: string[] = await this.fetchPhishingLinks(
        PhishingDataService.RemotePhishingDatabaseTodayUrl,
      );
      this.logService.info(`[PhishingDataService] ${dailyLinks.length} new phishing links added`);
      return {
        domains: prev.domains.concat(dailyLinks),
        checksum: remoteChecksum,
        timestamp,
        applicationVersion,
      };
    }

    // Approach 2: Fetch all links
    const links = await this.fetchPhishingLinks(PhishingDataService.RemotePhishingDatabaseUrl);
    return {
      domains: links,
      timestamp,
      checksum: remoteChecksum,
      applicationVersion,
    };
  }

  private async fetchPhishingLinksChecksum() {
    const response = await this.apiService.nativeFetch(
      new Request(PhishingDataService.RemotePhishingDatabaseChecksumUrl),
    );
    if (!response.ok) {
      throw new Error(`[PhishingDataService] Failed to fetch checksum: ${response.status}`);
    }
    return response.text();
  }

  private async fetchPhishingLinks(url: string) {
    const response = await this.apiService.nativeFetch(new Request(url));

    if (!response.ok) {
      throw new Error(`[PhishingDataService] Failed to fetch links: ${response.status}`);
    }

    return response.text().then((text) => text.split("\n"));
  }

  private getTestLinks() {
    const flag = devFlagEnabled("testPhishingUrls");
    if (!flag) {
      return [];
    }

    const links = devFlagValue("testPhishingUrls") as unknown[];
    if (links && links instanceof Array) {
      this.logService.debug(
        "[PhishingDetectionService] Dev flag enabled for testing phishing detection. Adding test phishing links:",
        links,
      );
      return links as string[];
    }
    return [];
  }
}
