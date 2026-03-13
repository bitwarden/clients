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
import { getPhishingResources, PhishingResourceType } from "../phishing-resources";

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
   * Compute SHA256 hash of a string using Web Crypto API.
   * Returns lowercase hex string.
   */
  private async computeSha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Compute SHA256 of the full blocklist by loading all URLs from IndexedDB.
   */
  private async computeLocalHashes(): Promise<{ sha256: string; sortedSha256: string }> {
    const urls = await this.indexedDbService.loadAllUrls();
    const raw = urls.join("\n") + "\n";
    const sorted = [...urls].sort().join("\n") + "\n";
    return {
      sha256: await this.computeSha256(raw),
      sortedSha256: await this.computeSha256(sorted),
    };
  }

  /**
   * Fetch and parse manifest.json from assets.bitwarden.com.
   */
  private async fetchManifest(): Promise<PhishingManifest> {
    const resource = getPhishingResources(this.resourceType);
    if (!resource?.manifestUrl) {
      throw new Error("Manifest URL missing from phishing resources");
    }

    this.logService.info(
      `[PhishingDataService] Fetching manifest from ${resource.manifestUrl}`,
    );

    const response = await this.apiService.nativeFetch(
      new Request(resource.manifestUrl, {
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
    const resource = getPhishingResources(this.resourceType);
    if (!resource?.patchBaseUrl) {
      throw new Error("Patch base URL missing from phishing resources");
    }

    const url = resource.patchBaseUrl + patchPath;
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
      const patch = patchMap.get(localSha256);
      if (!patch) {
        this.logService.info(
          `[PhishingDataService] No patch found for sha256 ${localSha256.slice(0, 12)}... — falling back to full download`,
        );
        return null;
      }

      const { additions, removals } = await this.fetchPatch(patch.path);

      if (removals.length > 0) {
        await this.indexedDbService.removeUrls(removals);
      }
      if (additions.length > 0) {
        await this.indexedDbService.addUrls(additions);
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

  /**
   * Verify integrity of local blocklist after patch application.
   */
  private async verifyIntegrity(expectedSortedSha256: string): Promise<boolean> {
    const { sortedSha256 } = await this.computeLocalHashes();
    const match = sortedSha256 === expectedSortedSha256;

    if (!match) {
      this.logService.warning(
        `[PhishingDataService] Integrity check failed: local sorted_sha256 ${sortedSha256.slice(0, 12)}... !== expected ${expectedSortedSha256.slice(0, 12)}...`,
      );
    }

    return match;
  }

  private _backgroundUpdate(
    previous: PhishingDataMeta | null,
  ): Observable<PhishingDataMeta | null> {
    const startTime = Date.now();

    return defer(() => {
      return from(this._performDeltaSync(previous)).pipe(
        concatMap((result) => {
          if (result.updated) {
            return from(this._phishingMetaState.update(() => result.meta)).pipe(
              tap(() => {
                const elapsed = Date.now() - startTime;
                this.logService.info(
                  `[PhishingDataService] Update completed in ${elapsed}ms`,
                );
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
        const elapsed = Date.now() - startTime;
        this.logService.error(
          `[PhishingDataService] All update attempts failed after ${elapsed}ms:`,
          error,
        );
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
      this.logService.info(
        "[PhishingDataService] App version changed — performing full update",
      );
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
      this.logService.info(
        "[PhishingDataService] No local sha256 — performing full update",
      );
      return this._performFullUpdateWithManifest(manifest, applicationVersion);
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
      return this._performFullUpdateWithManifest(manifest, applicationVersion);
    }

    const integrityOk = await this.verifyIntegrity(manifest.full_list.sorted_sha256);

    if (!integrityOk) {
      this.logService.warning(
        "[PhishingDataService] Integrity check failed after patches — performing full update",
      );
      return this._performFullUpdateWithManifest(manifest, applicationVersion);
    }

    const { sha256, sortedSha256 } = await this.computeLocalHashes();

    return {
      meta: {
        checksum: previous?.checksum ?? "",
        timestamp: Date.now(),
        applicationVersion,
        sha256,
        sortedSha256,
      },
      updated: true,
    };
  }

  /**
   * Full update without manifest (app version change).
   */
  private async _performFullUpdate(
    applicationVersion: string,
  ): Promise<{ meta: PhishingDataMeta; updated: boolean }> {
    let manifest: PhishingManifest | null = null;
    try {
      manifest = await this.fetchManifest();
    } catch {
      // Manifest unavailable — proceed without verification
    }

    const resource = getPhishingResources(this.resourceType);
    if (!resource?.primaryUrl) {
      throw new Error("Primary URL missing from phishing resources");
    }

    this.logService.info(
      `[PhishingDataService] Starting FULL update using ${resource.primaryUrl}`,
    );

    const response = await this.apiService.nativeFetch(
      new Request(resource.primaryUrl, {
        headers: { "Accept-Encoding": "gzip" },
      }),
    );

    if (!response.ok || !response.body) {
      throw new Error(`Full update failed: ${response.status} ${response.statusText}`);
    }

    await this.indexedDbService.saveUrlsFromStream(response.body);

    const { sha256, sortedSha256 } = await this.computeLocalHashes();

    if (manifest && sha256 !== manifest.full_list.sha256) {
      this.logService.warning(
        `[PhishingDataService] Full download sha256 mismatch — may be timing issue`,
      );
    }

    return {
      meta: {
        checksum: "",
        timestamp: Date.now(),
        applicationVersion,
        sha256,
        sortedSha256,
      },
      updated: true,
    };
  }

  /**
   * Full update using manifest for SHA256 verification.
   */
  private async _performFullUpdateWithManifest(
    manifest: PhishingManifest,
    applicationVersion: string,
  ): Promise<{ meta: PhishingDataMeta; updated: boolean }> {
    const resource = getPhishingResources(this.resourceType);
    if (!resource?.primaryUrl) {
      throw new Error("Primary URL missing from phishing resources");
    }

    this.logService.info(
      `[PhishingDataService] Starting FULL update using ${resource.primaryUrl}`,
    );

    const response = await this.apiService.nativeFetch(
      new Request(resource.primaryUrl, {
        headers: { "Accept-Encoding": "gzip" },
      }),
    );

    if (!response.ok || !response.body) {
      throw new Error(`Full update failed: ${response.status} ${response.statusText}`);
    }

    await this.indexedDbService.saveUrlsFromStream(response.body);

    const { sha256, sortedSha256 } = await this.computeLocalHashes();

    if (sha256 !== manifest.full_list.sha256) {
      this.logService.warning(
        `[PhishingDataService] Full download sha256 mismatch: ${sha256.slice(0, 12)}... !== ${manifest.full_list.sha256.slice(0, 12)}...`,
      );
    }

    return {
      meta: {
        checksum: "",
        timestamp: Date.now(),
        applicationVersion,
        sha256,
        sortedSha256,
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
    const remoteChecksum = await this.fetchPhishingChecksum(this.resourceType);

    if (remoteChecksum === previous?.checksum) {
      return {
        meta: { ...previous!, timestamp: Date.now(), applicationVersion },
        updated: false,
      };
    }

    const resource = getPhishingResources(this.resourceType);
    if (!resource?.primaryUrl) {
      throw new Error("Primary URL missing from phishing resources");
    }

    this.logService.info(
      `[PhishingDataService] Legacy sync: checksum changed — full update from ${resource.primaryUrl}`,
    );

    const response = await this.apiService.nativeFetch(new Request(resource.primaryUrl));

    if (!response.ok || !response.body) {
      throw new Error(`Full update failed: ${response.status}`);
    }

    await this.indexedDbService.saveUrlsFromStream(response.body);

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
