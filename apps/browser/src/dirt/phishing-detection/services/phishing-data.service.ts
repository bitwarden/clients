import {
  catchError,
  combineLatest,
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
  domains: string[];
  timestamp: number;
  checksum: string;

  /**
   * We store the application version to refetch the entire dataset on a new client release.
   * This counteracts daily appends updates not removing inactive or false positive domains.
   */
  applicationVersion: string;
};

export type PhishingExemptions = {
  domains: string[];
  timestamp: number;
};

export const PHISHING_DOMAINS_KEY = new KeyDefinition<PhishingData>(
  PHISHING_DETECTION_DISK,
  "phishingDomains",
  {
    deserializer: (value: PhishingData) =>
      value ?? { domains: [], timestamp: 0, checksum: "", applicationVersion: "" },
  },
);

export const PHISHING_EXEMPTIONS_KEY = new KeyDefinition<PhishingExemptions>(
  PHISHING_DETECTION_DISK,
  "phishingExemptions",
  {
    deserializer: (value: PhishingExemptions) => value ?? { domains: [], timestamp: 0 },
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

  // TODO: Replace with actual GitHub repository URL for exemptions list
  private static readonly RemotePhishingExemptionsUrl =
    "https://raw.githubusercontent.com/bitwarden/exemption-list/main/exemptions.txt";

  private _testDomains = this.getTestDomains();
  private _cachedState = this.globalStateProvider.get(PHISHING_DOMAINS_KEY);
  private _cachedExemptionsState = this.globalStateProvider.get(PHISHING_EXEMPTIONS_KEY);
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
  private _exemptions$ = this._cachedExemptionsState.state$.pipe(
    map(
      (state) =>
        new Set(
          (
            state?.domains?.filter(
              (line) => line.trim().length > 0 && !line.trim().startsWith("#"),
            ) ?? []
          ).concat(this._testDomains),
        ),
    ),
  );

  // How often are new domains added to the remote?
  readonly UPDATE_INTERVAL_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  readonly EXEMPTIONS_UPDATE_INTERVAL_DURATION = 60 * 60 * 1000; // 1 hour

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

  private _triggerExemptionsUpdate$ = new Subject<void>();
  exemptionsUpdate$ = this._triggerExemptionsUpdate$.pipe(
    startWith(undefined), // Always emit once
    tap(() => this.logService.info(`[PhishingDataService] Exemptions update triggered...`)),
    switchMap(() =>
      this._cachedExemptionsState.state$.pipe(
        first(), // Only take the first value to avoid an infinite loop when updating the cache below
        switchMap(async (cachedState) => {
          const next = await this.getNextExemptions(cachedState);
          if (next) {
            await this._cachedExemptionsState.update(() => next);
            this.logService.info(`[PhishingDataService] exemptions cache updated`);
          }
        }),
        retry({
          count: 3,
          delay: (err, count) => {
            this.logService.error(
              `[PhishingDataService] Unable to update exemptions. Attempt ${count}.`,
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
              "[PhishingDataService] Retries unsuccessful. Unable to update exemptions.",
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

    this.taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.phishingExemptionsUpdate,
      () => {
        this._triggerExemptionsUpdate$.next();
      },
    );
    this.taskSchedulerService.setInterval(
      ScheduledTaskNames.phishingExemptionsUpdate,
      this.EXEMPTIONS_UPDATE_INTERVAL_DURATION,
    );
  }

  /**
   * Checks if the given URL is a known phishing domain
   *
   * @param url The URL to check
   * @returns True if the URL is a known phishing domain, false otherwise
   */
  async isPhishingDomain(url: URL): Promise<boolean> {
    // Fetch both exemptions and phishing domains in a single async operation
    const [exemptions, domains] = await firstValueFrom(
      combineLatest([this._exemptions$, this._domains$]),
    );

    // Check exemptions first - if domain is exempted, it's not phishing
    if (this.isExempted(url.hostname, exemptions)) {
      this.logService.debug(`[PhishingDataService] Domain exemption match found`);
      return false;
    }

    // Check against phishing domains list
    return domains.has(url.hostname);
  }

  /**
   * Checks if a hostname matches any exemption pattern
   * Supports exact matches and subdomain wildcards (e.g., ".example.com" matches "app.example.com")
   *
   * @param hostname The hostname to check
   * @param exemptions Set of exemption patterns
   * @returns True if the hostname is exempted
   */
  private isExempted(hostname: string, exemptions: Set<string>): boolean {
    // Check for exact match
    if (exemptions.has(hostname)) {
      return true;
    }

    // Check for subdomain wildcard match
    // If ".example.com" is in exemptions, it should match "app.example.com", "www.example.com", etc.
    for (const exemption of exemptions) {
      if (exemption.startsWith(".")) {
        // Wildcard exemption: check if hostname ends with the exemption pattern
        if (hostname.endsWith(exemption) || hostname === exemption.substring(1)) {
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

  async getNextExemptions(prev: PhishingExemptions | null): Promise<PhishingExemptions | null> {
    prev = prev ?? { domains: [], timestamp: 0 };
    const timestamp = Date.now();
    const prevAge = timestamp - prev.timestamp;
    this.logService.info(`[PhishingDataService] Exemptions cache age: ${prevAge}`);

    try {
      const domains = await this.fetchPhishingExemptions();
      this.logService.info(`[PhishingDataService] Fetched ${domains.length} exemption domains`);
      return {
        domains,
        timestamp,
      };
    } catch (error) {
      this.logService.error(
        "[PhishingDataService] Failed to fetch exemptions, keeping previous cache",
        error,
      );
      // Return null to keep existing cache on error
      return null;
    }
  }

  private async fetchPhishingExemptions(): Promise<string[]> {
    const response = await this.apiService.nativeFetch(
      new Request(PhishingDataService.RemotePhishingExemptionsUrl),
    );

    if (!response.ok) {
      throw new Error(`[PhishingDataService] Failed to fetch exemptions: ${response.status}`);
    }

    return response.text().then((text) => {
      const lines = text.split("\n");

      // Clean and normalize domains - strip protocols, paths, and invalid characters
      return lines.map((line) => {
        let domain = line.trim();

        // Remove protocol if present (http://, https://, etc.)
        domain = domain.replace(/^[a-z]+:\/\//i, "");

        // Remove path, query, and fragment if present
        domain = domain.split("/")[0].split("?")[0].split("#")[0];

        return domain;
      });
    });
  }
}
