import {
  catchError,
  concatMap,
  defer,
  EMPTY,
  exhaustMap,
  first,
  forkJoin,
  from,
  iif,
  map,
  Observable,
  of,
  retry,
  share,
  startWith,
  Subject,
  switchMap,
  tap,
  throwError,
  timer,
} from "rxjs";

import { devFlagEnabled, devFlagValue } from "@bitwarden/browser/platform/flags";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ScheduledTaskNames, TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import { LogService } from "@bitwarden/logging";
import { GlobalStateProvider, KeyDefinition, PHISHING_DETECTION_DISK } from "@bitwarden/state";

import { getPhishingResources, PhishingResourceType } from "../phishing-resources";

import { PhishingIndexedDbService } from "./phishing-indexeddb.service";

/**
 * Metadata about the phishing data set
 */
export type PhishingDataMeta = {
  /** The last known checksum of the phishing data set */
  checksum: string;
  /** The last time the data set was updated  */
  timestamp: number;
  /**
   * We store the application version to refetch the entire dataset on a new client release.
   * This counteracts daily appends updates not removing inactive or false positive web addresses.
   */
  applicationVersion: string;
};

/**
 * The phishing data blob is a string representation of the phishing web addresses
 */
export type PhishingDataBlob = string;
export type PhishingData = { meta: PhishingDataMeta; blob: PhishingDataBlob };

export const PHISHING_DOMAINS_META_KEY = new KeyDefinition<PhishingDataMeta>(
  PHISHING_DETECTION_DISK,
  "phishingDomainsMeta",
  {
    deserializer: (value: PhishingDataMeta) => {
      return {
        checksum: value?.checksum ?? "",
        timestamp: value?.timestamp ?? 0,
        applicationVersion: value?.applicationVersion ?? "",
      };
    },
  },
);

export const PHISHING_DOMAINS_BLOB_KEY = new KeyDefinition<string>(
  PHISHING_DETECTION_DISK,
  "phishingDomainsBlob",
  {
    deserializer: (value: string) => value ?? "",
  },
);

/** Coordinates fetching, caching, and patching of known phishing web addresses */
export class PhishingDataService {
  private _testWebAddresses = this.getTestWebAddresses().concat("phishing.testcategory.com"); // Included for QA to test in prod
  private _phishingMetaState = this.globalStateProvider.get(PHISHING_DOMAINS_META_KEY);

  private indexedDbService: PhishingIndexedDbService;

  // How often are new web addresses added to the remote?
  readonly UPDATE_INTERVAL_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private _backgroundUpdateTrigger$ = new Subject<PhishingDataMeta | null>();

  private _triggerUpdate$ = new Subject<void>();
  update$ = this._triggerUpdate$.pipe(
    startWith(undefined), // Always emit once
    switchMap(() =>
      this._phishingMetaState.state$.pipe(
        first(), // Only take the first value to avoid an infinite loop when updating the cache below
        tap((metaState) => {
          // Perform any updates in the background
          this._backgroundUpdateTrigger$.next(metaState);
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
    this.logService.debug("[PhishingDataService] Initializing service...");
    this.indexedDbService = new PhishingIndexedDbService(this.logService);
    this.taskSchedulerService.registerTaskHandler(ScheduledTaskNames.phishingDomainUpdate, () => {
      this._triggerUpdate$.next();
    });
    this.taskSchedulerService.setInterval(
      ScheduledTaskNames.phishingDomainUpdate,
      this.UPDATE_INTERVAL_DURATION,
    );
    this._backgroundUpdateTrigger$
      .pipe(
        exhaustMap((currentMeta) => {
          return this._backgroundUpdate(currentMeta);
        }),
      )
      .subscribe();
  }

  /**
   * Checks if the given URL is a known phishing web address
   *
   * @param url The URL to check
   * @returns True if the URL is a known phishing web address, false otherwise
   */
  async isPhishingWebAddress(url: URL): Promise<boolean> {
    // Quick check for QA/dev test addresses
    if (this._testWebAddresses.includes(url.hostname)) {
      return true;
    }

    const resource = getPhishingResources(this.resourceType);

    // If a custom matcher is provided, iterate stored entries and apply the matcher.
    if (resource && resource.match) {
      try {
        // TODO Check that load all urls actually has the cursor setup correctly
        const entries = await this.indexedDbService.loadAllUrls();
        for (const entry of entries) {
          if (resource.match(url, entry)) {
            return true;
          }
        }
      } catch (err) {
        this.logService.error("[PhishingDataService] Error running custom matcher", err);
      }
      return false;
    }

    // TODO Should default lookup happen first for quick match
    // Default lookup: check presence of hostname in IndexedDB
    try {
      return await this.indexedDbService.hasUrl(url.hostname);
    } catch (err) {
      this.logService.error("[PhishingDataService] IndexedDB lookup failed", err);
      return false;
    }
  }

  // [FIXME] Pull fetches into api service
  private async fetchPhishingChecksum(type: PhishingResourceType = PhishingResourceType.Domains) {
    const checksumUrl = getPhishingResources(type)!.checksumUrl;
    const response = await this.apiService.nativeFetch(new Request(checksumUrl));
    if (!response.ok) {
      throw new Error(`[PhishingDataService] Failed to fetch checksum: ${response.status}`);
    }
    return response.text();
  }

  // [FIXME] Pull fetches into api service
  private async fetchToday(url: string) {
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

  private _getUpdatedMeta(): Observable<PhishingDataMeta> {
    // Use defer to
    return defer(() => {
      const now = Date.now();

      // forkJoin kicks off both requests in parallel
      return forkJoin({
        applicationVersion: from(this.platformUtilsService.getApplicationVersion()),
        remoteChecksum: from(this.fetchPhishingChecksum(this.resourceType)),
      }).pipe(
        map(({ applicationVersion, remoteChecksum }) => {
          return {
            checksum: remoteChecksum,
            timestamp: now,
            applicationVersion,
          };
        }),
      );
    });
  }

  // Streams the full phishing data set and saves it to IndexedDB
  private _updateFullDataSet() {
    this.logService.info("[PhishingDataService] Starting FULL update...");
    const resource = getPhishingResources(this.resourceType);

    if (!resource?.remoteUrl) {
      return throwError(() => new Error("Invalid resource URL"));
    }

    return from(this.apiService.nativeFetch(new Request(resource.remoteUrl))).pipe(
      switchMap((response) => {
        if (!response.ok || !response.body) {
          return throwError(() => new Error(`Full fetch failed: ${response.statusText}`));
        }

        return from(this.indexedDbService.saveUrlsFromStream(response.body));
      }),
    );
  }

  private _updateDailyDataSet() {
    this.logService.info("[PhishingDataService] Starting DAILY update...");

    const todayUrl = getPhishingResources(this.resourceType)?.todayUrl;
    if (!todayUrl) {
      return throwError(() => new Error("Today URL missing"));
    }

    return from(this.fetchToday(todayUrl)).pipe(
      switchMap((lines) => from(this.indexedDbService.addUrls(lines))),
    );
  }

  private _backgroundUpdate(
    previous: PhishingDataMeta | null,
  ): Observable<PhishingDataMeta | null> {
    // Use defer to restart timer if retry is activated
    return defer(() => {
      const startTime = Date.now();
      this.logService.info(`[PhishingDataService] Update triggered...`);

      // Get updated meta info
      return this._getUpdatedMeta().pipe(
        // Update full data set if application version or checksum changed
        concatMap((newMeta) =>
          iif(
            () => {
              const appVersionChanged = newMeta.applicationVersion !== previous?.applicationVersion;
              const checksumChanged = newMeta.checksum !== previous?.checksum;
              return appVersionChanged || checksumChanged;
            },
            this._updateFullDataSet().pipe(map(() => newMeta)),
            of(newMeta),
          ),
        ),
        // Update daily data set if last update was more than UPDATE_INTERVAL_DURATION ago
        concatMap((newMeta) =>
          iif(
            () => {
              const isCacheExpired =
                Date.now() - (previous?.timestamp ?? 0) > this.UPDATE_INTERVAL_DURATION;
              return isCacheExpired;
            },
            this._updateDailyDataSet().pipe(map(() => newMeta)),
            of(newMeta),
          ),
        ),
        concatMap((newMeta) => {
          return from(this._phishingMetaState.update(() => newMeta)).pipe(
            tap(() => {
              const elapsed = Date.now() - startTime;
              this.logService.info(`[PhishingDataService] Updated in ${elapsed}ms`);
            }),
          );
        }),
        retry({
          count: 2, // Total 3 attempts (initial + 2 retries)
          delay: (error, retryCount) => {
            this.logService.error(
              `[PhishingDataService] Attempt ${retryCount} failed. Retrying in 5m...`,
              error,
            );
            return timer(5 * 60 * 1000); // Wait 5 mins before next attempt
          },
        }),
        catchError((err: unknown) => {
          const elapsed = Date.now() - startTime;
          this.logService.error(
            `[PhishingDataService] Retries unsuccessful after ${elapsed}ms.`,
            err,
          );
          return throwError(() => err);
        }),
      );
    });
  }
}
