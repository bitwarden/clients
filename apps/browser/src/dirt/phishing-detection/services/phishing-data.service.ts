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
  takeUntil,
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
  // Cursor-based search is disabled due to performance (6+ minutes on large databases)
  // Enable when performance is optimized via indexing or other improvements
  private static readonly USE_CUSTOM_MATCHER = false;

  // While background scripts do not necessarily need destroying,
  // processes in PhishingDataService are memory intensive.
  // We are adding the destroy to guard against accidental leaks.
  private _destroy$ = new Subject<void>();

  private _testWebAddresses = this.getTestWebAddresses();
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
    takeUntil(this._destroy$),
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
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  dispose(): void {
    // Signal all pipelines to stop and unsubscribe stored subscriptions
    this._destroy$.next();
    this._destroy$.complete();
  }

  /**
   * Checks if the given URL is a known phishing web address
   *
   * @param url The URL to check
   * @returns True if the URL is a known phishing web address, false otherwise
   */
  async isPhishingWebAddress(url: URL): Promise<boolean> {
    // Skip non-http(s) protocols - phishing database only contains web URLs
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    // Quick check for QA/dev test addresses
    if (this._testWebAddresses.includes(url.href)) {
      this.logService.info("[PhishingDataService] Found test web address: " + url.href);
      return true;
    }

    const resource = getPhishingResources(this.resourceType);

    try {
      // Quick lookup: check direct presence of href in IndexedDB
      // Also check without trailing slash since browsers add it but DB entries may not have it
      const urlHref = url.href;
      const urlWithoutTrailingSlash = urlHref.endsWith("/") ? urlHref.slice(0, -1) : null;

      let hasUrl = await this.indexedDbService.hasUrl(urlHref);

      if (!hasUrl && urlWithoutTrailingSlash) {
        hasUrl = await this.indexedDbService.hasUrl(urlWithoutTrailingSlash);
      }

      if (hasUrl) {
        this.logService.info("[PhishingDataService] Found phishing URL: " + urlHref);
        return true;
      }
    } catch (err) {
      this.logService.error("[PhishingDataService] IndexedDB lookup failed", err);
    }

    // Custom matcher is disabled for performance (see USE_CUSTOM_MATCHER)
    if (resource && resource.match && PhishingDataService.USE_CUSTOM_MATCHER) {
      try {
        const found = await this.indexedDbService.findMatchingUrl((entry) =>
          resource.match(url, entry),
        );

        if (found) {
          this.logService.info("[PhishingDataService] Found phishing URL via matcher: " + url.href);
        }
        return found;
      } catch (err) {
        this.logService.error("[PhishingDataService] Custom matcher failed", err);
        return false;
      }
    }

    return false;
  }

  // [FIXME] Pull fetches into api service
  private async fetchPhishingChecksum(type: PhishingResourceType = PhishingResourceType.Domains) {
    const checksumUrl = getPhishingResources(type)!.checksumUrl;
    this.logService.debug(`[PhishingDataService] Fetching checksum from: ${checksumUrl}`);

    try {
      const response = await this.apiService.nativeFetch(new Request(checksumUrl));
      if (!response.ok) {
        throw new Error(
          `[PhishingDataService] Failed to fetch checksum: ${response.status} ${response.statusText}`,
        );
      }

      return await response.text();
    } catch (error) {
      this.logService.error(
        `[PhishingDataService] Checksum fetch failed from ${checksumUrl}`,
        error,
      );
      throw error;
    }
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
    // Normalize URLs by converting to URL object and back to ensure consistent format (e.g., trailing slashes)
    const testWebAddresses: string[] = [
      new URL("http://phishing.testcategory.com").href,
      new URL("https://phishing.testcategory.com").href,
      new URL("https://phishing.testcategory.com/block").href,
    ];
    if (!flag) {
      return testWebAddresses;
    }

    const webAddresses = devFlagValue("testPhishingUrls") as unknown[];
    if (webAddresses && webAddresses instanceof Array) {
      this.logService.debug(
        "[PhishingDataService] Dev flag enabled for testing phishing detection. Adding test phishing web addresses:",
        webAddresses,
      );
      // Normalize dev flag URLs as well, filtering out invalid ones
      const normalizedDevAddresses = (webAddresses as string[])
        .filter((addr) => {
          try {
            new URL(addr);
            return true;
          } catch {
            this.logService.warning(
              `[PhishingDataService] Invalid test URL in dev flag, skipping: ${addr}`,
            );
            return false;
          }
        })
        .map((addr) => new URL(addr).href);
      return testWebAddresses.concat(normalizedDevAddresses);
    }
    return testWebAddresses;
  }

  private _getUpdatedMeta(): Observable<PhishingDataMeta> {
    return defer(() => {
      const now = Date.now();

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
    const resource = getPhishingResources(this.resourceType);

    if (!resource?.remoteUrl) {
      return throwError(() => new Error("Invalid resource URL"));
    }

    this.logService.info(`[PhishingDataService] Starting FULL update using ${resource.remoteUrl}`);
    return from(this.apiService.nativeFetch(new Request(resource.remoteUrl))).pipe(
      switchMap((response) => {
        if (!response.ok || !response.body) {
          return throwError(
            () =>
              new Error(
                `[PhishingDataService] Full fetch failed: ${response.status}, ${response.statusText}`,
              ),
          );
        }

        return from(this.indexedDbService.saveUrlsFromStream(response.body));
      }),
      catchError((err: unknown) => {
        this.logService.error(
          `[PhishingDataService] Full dataset update failed using primary source ${err}`,
        );
        this.logService.warning(
          `[PhishingDataService] Falling back to: ${resource.fallbackUrl} (Note: Fallback data may be less up-to-date)`,
        );
        // Try fallback URL
        return from(this.apiService.nativeFetch(new Request(resource.fallbackUrl))).pipe(
          switchMap((fallbackResponse) => {
            if (!fallbackResponse.ok || !fallbackResponse.body) {
              return throwError(
                () =>
                  new Error(
                    `[PhishingDataService] Fallback fetch failed: ${fallbackResponse.status}, ${fallbackResponse.statusText}`,
                  ),
              );
            }

            return from(this.indexedDbService.saveUrlsFromStream(fallbackResponse.body));
          }),
          catchError((fallbackError: unknown) => {
            this.logService.error(`[PhishingDataService] Fallback source failed`);
            return throwError(() => fallbackError);
          }),
        );
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

              this.logService.info(
                `[PhishingDataService] Checking if full update is needed: appVersionChanged=${appVersionChanged}, checksumChanged=${checksumChanged}`,
              );
              return appVersionChanged || checksumChanged;
            },
            this._updateFullDataSet().pipe(map(() => ({ meta: newMeta, updated: true }))),
            of({ meta: newMeta, updated: false }),
          ),
        ),
        // Update daily data set if last update was more than UPDATE_INTERVAL_DURATION ago
        concatMap((result) =>
          iif(
            () => {
              const isCacheExpired =
                Date.now() - (previous?.timestamp ?? 0) > this.UPDATE_INTERVAL_DURATION;
              return isCacheExpired;
            },
            this._updateDailyDataSet().pipe(map(() => ({ meta: result.meta, updated: true }))),
            of(result),
          ),
        ),
        concatMap((result) => {
          if (!result.updated) {
            this.logService.debug(`[PhishingDataService] No update needed, metadata unchanged`);
            return of(previous);
          }

          this.logService.debug(`[PhishingDataService] Updated phishing meta data:`, result.meta);
          return from(this._phishingMetaState.update(() => result.meta)).pipe(
            tap(() => {
              const elapsed = Date.now() - startTime;
              this.logService.info(`[PhishingDataService] Updated data set in ${elapsed}ms`);
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
          return of(previous);
        }),
      );
    });
  }
}
