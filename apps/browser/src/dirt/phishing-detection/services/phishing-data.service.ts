import {
  catchError,
  concatMap,
  defer,
  EMPTY,
  exhaustMap,
  first,
  from,
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
  timer,
} from "rxjs";

import { devFlagEnabled, devFlagValue } from "@bitwarden/browser/platform/flags";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ScheduledTaskNames, TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import { LogService } from "@bitwarden/logging";
import { GlobalStateProvider, KeyDefinition, PHISHING_DETECTION_DISK } from "@bitwarden/state";

import { PhishingManifest } from "../phishing-manifest.types";
import {
  PHISHING_CHECKSUM_URL,
  PHISHING_MANIFEST_URL,
  PHISHING_PATCH_BASE_URL,
  PHISHING_PRIMARY_URL,
} from "../phishing-resources";

import { PhishingIndexedDbService } from "./phishing-indexeddb.service";

/**
 * Metadata about the phishing data set
 */
export type PhishingDataMeta = {
  /** The last known checksum of the phishing data set (legacy MD5, kept for backward compat) */
  checksum: string;
  /** The last time the data set was updated  */
  timestamp: number;
  /**
   * We store the application version to refetch the entire dataset on a new client release.
   * This counteracts daily appends updates not removing inactive or false positive web addresses.
   */
  applicationVersion: string;
  /** SHA256 of raw blocklist file (order-dependent), used for patch chaining */
  sha256?: string;
  /** SHA256 of sorted blocklist file (order-independent), used for integrity verification */
  sortedSha256?: string;
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
        sha256: value?.sha256,
        sortedSha256: value?.sortedSha256,
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

    try {
      // Quick lookup: check direct presence of href in IndexedDB
      // Also check without trailing slash since browsers add it but DB entries may not have it
      const urlHref = url.href;
      const urlWithoutTrailingSlash = urlHref.endsWith("/") ? urlHref.slice(0, -1) : null;

      let hasUrl = await this.indexedDbService.hasUrl(urlHref);

      if (!hasUrl && urlWithoutTrailingSlash) {
        hasUrl = await this.indexedDbService.hasUrl(urlWithoutTrailingSlash);
      }

      // Check alternate protocol: block list may have http:// but browser navigated to https:// (or vice versa)
      if (!hasUrl) {
        const alternateHref = this.swapProtocol(urlHref);
        if (alternateHref) {
          hasUrl = await this.indexedDbService.hasUrl(alternateHref);

          if (!hasUrl) {
            const alternateWithoutTrailingSlash = alternateHref.endsWith("/")
              ? alternateHref.slice(0, -1)
              : null;
            if (alternateWithoutTrailingSlash) {
              hasUrl = await this.indexedDbService.hasUrl(alternateWithoutTrailingSlash);
            }
          }
        }
      }

      if (hasUrl) {
        this.logService.info("[PhishingDataService] Found phishing URL: " + urlHref);
        return true;
      }
    } catch (err) {
      this.logService.error("[PhishingDataService] IndexedDB lookup failed", err);
    }

    return false;
  }

  /**
   * Swaps the protocol of a URL string between http:// and https://.
   * Returns null if the URL doesn't start with either protocol.
   */
  private swapProtocol(url: string): string | null {
    if (url.startsWith("https://")) {
      return "http://" + url.slice(8);
    }
    if (url.startsWith("http://")) {
      return "https://" + url.slice(7);
    }
    return null;
  }

  // [FIXME] Pull fetches into api service
  private async fetchPhishingChecksum() {
    this.logService.debug(`[PhishingDataService] Fetching checksum from: ${PHISHING_CHECKSUM_URL}`);

    try {
      const response = await this.apiService.nativeFetch(new Request(PHISHING_CHECKSUM_URL));
      if (!response.ok) {
        throw new Error(
          `[PhishingDataService] Failed to fetch checksum: ${response.status} ${response.statusText}`,
        );
      }

      return await response.text();
    } catch (error) {
      this.logService.error(
        `[PhishingDataService] Checksum fetch failed from ${PHISHING_CHECKSUM_URL}`,
        error,
      );
      throw error;
    }
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

  /**
   * Fetch and parse the phishing manifest.
   */
  private async fetchManifest(): Promise<PhishingManifest> {
    this.logService.info(`[PhishingDataService] Fetching manifest from ${PHISHING_MANIFEST_URL}`);

    const response = await this.apiService.nativeFetch(
      new Request(PHISHING_MANIFEST_URL, {
        headers: { "Accept-Encoding": "gzip" },
      }),
    );

    if (!response.ok) {
      throw new Error(`Manifest fetch failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as PhishingManifest;
  }

  /**
   * Fetch a patch file and parse into add/remove URL arrays.
   */
  private async fetchPatch(
    patchPath: string,
  ): Promise<{ additions: string[]; removals: string[] }> {
    const url = PHISHING_PATCH_BASE_URL + patchPath;
    this.logService.info(`[PhishingDataService] Fetching patch from ${url}`);

    const response = await this.apiService.nativeFetch(
      new Request(url, {
        headers: { "Accept-Encoding": "gzip" },
      }),
    );

    if (!response.ok) {
      throw new Error(`Patch fetch failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const additions: string[] = [];
    const removals: string[] = [];

    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("+")) {
        additions.push(trimmed.slice(1));
      } else if (trimmed.startsWith("-")) {
        removals.push(trimmed.slice(1));
      }
    }

    return { additions, removals };
  }

  /**
   * Apply a chain of patches to bring the local blocklist up to date.
   * Returns the final sha256 after all patches applied, or null if no valid chain found.
   */
  private async applyPatchChain(
    manifest: PhishingManifest,
    currentSha256: string,
  ): Promise<string | null> {
    const patchMap = new Map(manifest.patches.map((p) => [p.from_sha256, p]));

    let localSha256 = currentSha256;
    let patchesApplied = 0;

    while (localSha256 !== manifest.full_list.sha256) {
      if (patchesApplied >= manifest.patches.length) {
        this.logService.warning(
          `[PhishingDataService] Patch chain exceeded maximum iterations (${manifest.patches.length}) -- falling back to full download`,
        );
        return null;
      }

      const patch = patchMap.get(localSha256);
      if (!patch) {
        this.logService.info(
          `[PhishingDataService] No patch found for sha256 ${localSha256.slice(0, 12)}... — falling back to full download`,
        );
        return null;
      }

      const { additions, removals } = await this.fetchPatch(patch.path);

      if (removals.length > 0) {
        const removed = await this.indexedDbService.removeUrls(removals);
        if (!removed) {
          throw new Error(`Failed to remove ${removals.length} URLs during patch ${patch.date}`);
        }
      }
      if (additions.length > 0) {
        const added = await this.indexedDbService.addUrls(additions);
        if (!added) {
          throw new Error(`Failed to add ${additions.length} URLs during patch ${patch.date}`);
        }
      }

      localSha256 = patch.to_sha256;
      patchesApplied++;

      this.logService.info(
        `[PhishingDataService] Applied patch ${patch.date} (${additions.length} added, ${removals.length} removed)`,
      );
    }

    this.logService.info(
      `[PhishingDataService] Delta sync complete: ${patchesApplied} patch(es) applied`,
    );

    return localSha256;
  }

  private _backgroundUpdate(
    previous: PhishingDataMeta | null,
  ): Observable<PhishingDataMeta | null> {
    return defer(() => {
      const startTime = Date.now();
      return from(this._performDeltaSync(previous)).pipe(
        concatMap((result) => {
          if (result.updated) {
            return from(this._phishingMetaState.update(() => result.meta)).pipe(
              tap(() => {
                const elapsed = Date.now() - startTime;
                this.logService.info(`[PhishingDataService] Update completed in ${elapsed}ms`);
              }),
              map(() => result.meta),
            );
          }

          this.logService.info("[PhishingDataService] No update needed");
          return of(previous);
        }),
      );
    }).pipe(
      retry({
        count: 2,
        delay: (error, retryCount) => {
          this.logService.error(
            `[PhishingDataService] Error during update (attempt ${retryCount}/3):`,
            error,
          );
          return timer(5 * 60 * 1000);
        },
      }),
      catchError((error: unknown) => {
        this.logService.error(`[PhishingDataService] All update attempts failed:`, error);
        return of(previous);
      }),
    );
  }

  /**
   * Core delta sync logic.
   */
  private async _performDeltaSync(
    previous: PhishingDataMeta | null,
  ): Promise<{ meta: PhishingDataMeta; updated: boolean }> {
    const applicationVersion = await this.platformUtilsService.getApplicationVersion();

    if (applicationVersion !== previous?.applicationVersion) {
      this.logService.info("[PhishingDataService] App version changed — performing full update");
      return this._performFullUpdate(applicationVersion);
    }

    let manifest: PhishingManifest;
    try {
      manifest = await this.fetchManifest();
    } catch (e) {
      this.logService.warning(
        "[PhishingDataService] Failed to fetch manifest — falling back to legacy sync",
        e,
      );
      return this._performLegacySync(previous, applicationVersion);
    }

    const localSha256 = previous?.sha256;

    if (!localSha256) {
      this.logService.info("[PhishingDataService] No local sha256 — performing full update");
      return this._performFullUpdate(applicationVersion, manifest);
    }

    if (localSha256 === manifest.full_list.sha256) {
      this.logService.info("[PhishingDataService] Blocklist is up to date");
      return {
        meta: { ...previous, timestamp: Date.now(), applicationVersion },
        updated: false,
      };
    }

    const resultSha256 = await this.applyPatchChain(manifest, localSha256);

    if (resultSha256 === null) {
      return this._performFullUpdate(applicationVersion, manifest);
    }

    // Patch chain structure guarantees integrity via from_sha256 -> to_sha256 chaining.
    // addUrls/removeUrls failures throw inside applyPatchChain, triggering retry.
    return {
      meta: {
        checksum: previous?.checksum ?? "",
        timestamp: Date.now(),
        applicationVersion,
        sha256: manifest.full_list.sha256,
        sortedSha256: manifest.full_list.sorted_sha256,
      },
      updated: true,
    };
  }

  /**
   * Full update: download entire blocklist and verify against manifest if available.
   * When called from the app-version-change path, manifest is fetched internally.
   * When called from other paths, manifest is passed in.
   */
  private async _performFullUpdate(
    applicationVersion: string,
    manifest?: PhishingManifest | null,
  ): Promise<{ meta: PhishingDataMeta; updated: boolean }> {
    // If no manifest provided, try to fetch one for verification
    if (manifest === undefined) {
      try {
        manifest = await this.fetchManifest();
      } catch {
        manifest = null;
      }
    }

    this.logService.info(
      `[PhishingDataService] Starting FULL update using ${PHISHING_PRIMARY_URL}`,
    );

    const response = await this.apiService.nativeFetch(
      new Request(PHISHING_PRIMARY_URL, {
        headers: { "Accept-Encoding": "gzip" },
      }),
    );

    if (!response.ok || !response.body) {
      throw new Error(`Full update failed: ${response.status} ${response.statusText}`);
    }

    const streamSha256 = await this.indexedDbService.saveUrlsFromStream(response.body);

    if (!streamSha256) {
      throw new Error("Stream save failed: no SHA256 returned");
    }

    // Verify stream SHA256 against manifest if available
    if (manifest) {
      if (streamSha256 !== manifest.full_list.sha256) {
        throw new Error(
          `Full download SHA256 mismatch: ${streamSha256.slice(0, 12)}... !== ${manifest.full_list.sha256.slice(0, 12)}...`,
        );
      }
    }

    return {
      meta: {
        checksum: "",
        timestamp: Date.now(),
        applicationVersion,
        sha256: manifest?.full_list.sha256 ?? streamSha256 ?? undefined,
        sortedSha256: manifest?.full_list.sorted_sha256,
      },
      updated: true,
    };
  }

  /**
   * Legacy sync fallback when manifest is unavailable.
   */
  private async _performLegacySync(
    previous: PhishingDataMeta | null,
    applicationVersion: string,
  ): Promise<{ meta: PhishingDataMeta; updated: boolean }> {
    const remoteChecksum = await this.fetchPhishingChecksum();

    if (remoteChecksum === previous?.checksum) {
      return {
        meta: { ...previous!, timestamp: Date.now(), applicationVersion },
        updated: false,
      };
    }

    this.logService.info(
      `[PhishingDataService] Legacy sync: checksum changed — full update from ${PHISHING_PRIMARY_URL}`,
    );

    const response = await this.apiService.nativeFetch(
      new Request(PHISHING_PRIMARY_URL, {
        headers: { "Accept-Encoding": "gzip" },
      }),
    );

    if (!response.ok || !response.body) {
      throw new Error(`Full update failed: ${response.status}`);
    }

    const streamSha256 = await this.indexedDbService.saveUrlsFromStream(response.body);

    if (!streamSha256) {
      throw new Error("Legacy sync stream save failed: no SHA256 returned");
    }

    return {
      meta: {
        checksum: remoteChecksum,
        timestamp: Date.now(),
        applicationVersion,
      },
      updated: true,
    };
  }
}
