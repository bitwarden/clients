import { catchError, EMPTY, first, share, startWith, Subject, switchMap, tap } from "rxjs";

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

  private _triggerUpdate$ = new Subject<void>();
  update$ = this._triggerUpdate$.pipe(
    startWith(undefined), // Always emit once
    switchMap(() =>
      this._phishingMetaState.state$.pipe(
        first(), // Only take the first value to avoid an infinite loop when updating the cache below
        tap((metaState) => {
          // Perform any updates in the background if needed
          void this._backgroundUpdate(metaState);
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

  /**
   * Determines the next set of web addresses to fetch based on previous metadata.
   *
   * @param previous Previous phishing data metadata
   * @returns Object containing either a stream for full update or lines for daily update, along with new metadata; or null if no update is needed
   */
  async getNextWebAddresses(previous: PhishingDataMeta | null): Promise<{
    meta?: PhishingDataMeta;
    stream?: ReadableStream<Uint8Array>;
    lines?: string[];
  } | null> {
    const prevMeta = previous ?? { timestamp: 0, checksum: "", applicationVersion: "" };
    const now = Date.now();

    // Updates to check
    const applicationVersion = await this.platformUtilsService.getApplicationVersion();
    const remoteChecksum = await this.fetchPhishingChecksum(this.resourceType);

    // Logic checks
    const appVersionChanged = applicationVersion !== prevMeta.applicationVersion;
    const masterChecksumChanged = remoteChecksum !== prevMeta.checksum;

    // Full update: return stream so caller can write to IndexedDB incrementally
    if (masterChecksumChanged || appVersionChanged) {
      this.logService.info("[PhishingDataService] Checksum or version changed; Fetching ALL.");
      const remoteUrl = getPhishingResources(this.resourceType)!.remoteUrl;
      const response = await this.apiService.nativeFetch(new Request(remoteUrl));
      if (!response.ok || !response.body) {
        throw new Error("Fetch failed");
      }
      return {
        stream: response.body!,
        meta: { checksum: remoteChecksum, timestamp: now, applicationVersion },
      };
    }

    // Check for daily file
    const isCacheExpired = now - prevMeta.timestamp > this.UPDATE_INTERVAL_DURATION;

    if (isCacheExpired) {
      this.logService.info("[PhishingDataService] Daily cache expired; Fetching TODAY's");
      const url = getPhishingResources(this.resourceType)!.todayUrl;
      const newLines = await this.fetchToday(url);

      return {
        lines: newLines,
        meta: {
          checksum: remoteChecksum,
          timestamp: now,
          applicationVersion,
        },
      };
    }

    return null;
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

  // Runs the update flow in the background and retries up to 3 times on failure
  private async _backgroundUpdate(previous: PhishingDataMeta | null): Promise<void> {
    this.logService.info(`[PhishingDataService] Update web addresses triggered...`);
    const phishingMeta: PhishingDataMeta = previous ?? {
      timestamp: 0,
      checksum: "",
      applicationVersion: "",
    };
    // Start time for logging performance of update
    const startTime = Date.now();
    const maxAttempts = 3;
    const delayMs = 5 * 60 * 1000; // 5 minutes

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const next = await this.getNextWebAddresses(phishingMeta);
        if (!next) {
          return; // No update needed
        }

        if (next.meta) {
          await this._phishingMetaState.update(() => next.meta!);
        }

        // If we received a stream, write it into IndexedDB incrementally
        if (next.stream) {
          await this.indexedDbService.saveUrlsFromStream(next.stream);
        } else if (next.lines) {
          await this.indexedDbService.saveUrls(next.lines);

          // TODO Check if any of this is needed or if saveUrls is sufficient
          // AI Updates but does not take into account that saving
          // to the indexedDB will merge entries and not create duplicates.
          // // For incremental daily updates we merge with existing set to preserve old entries
          // const existing = await this.indexedDbService.loadAllUrls();
          // const combinedSet = new Set<string>(existing);
          // for (const l of next.lines) {
          //   const trimmed = l.trim();
          //   if (trimmed) {
          //     combinedSet.add(trimmed);
          //   }
          // }
          // await this.indexedDbService.saveUrls(Array.from(combinedSet));
        }

        const elapsed = Date.now() - startTime;
        this.logService.info(`[PhishingDataService] Phishing data cache updated in ${elapsed}ms`);
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
