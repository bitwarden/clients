import {
  catchError,
  EMPTY,
  first,
  firstValueFrom,
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
  private _phishingBlobState = this.globalStateProvider.get(PHISHING_DOMAINS_BLOB_KEY);

  // In-memory set loaded from blob for fast lookups without reading large storage repeatedly
  private _webAddressesSet: Set<string> | null = null;

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
    this.taskSchedulerService.registerTaskHandler(ScheduledTaskNames.phishingDomainUpdate, () => {
      this._triggerUpdate$.next();
    });
    this.taskSchedulerService.setInterval(
      ScheduledTaskNames.phishingDomainUpdate,
      this.UPDATE_INTERVAL_DURATION,
    );
    void this._loadBlobToMemory();
  }

  /**
   * Checks if the given URL is a known phishing web address
   *
   * @param url The URL to check
   * @returns True if the URL is a known phishing web address, false otherwise
   */
  async isPhishingWebAddress(url: URL): Promise<boolean> {
    if (!this._webAddressesSet) {
      this.logService.debug("[PhishingDataService] Set not loaded; skipping check");
      return false;
    }

    const set = this._webAddressesSet!;
    const resource = getPhishingResources(this.resourceType);

    // Custom matcher per resource
    if (resource && resource?.match) {
      for (const entry of set) {
        if (resource.match(url, entry)) {
          return true;
        }
      }
      return false;
    }

    // Default set-based lookup
    return set.has(url.hostname);
  }

  async getNextWebAddresses(
    previous: PhishingDataMeta | null,
  ): Promise<Partial<PhishingData> | null> {
    const prevMeta = previous ?? { timestamp: 0, checksum: "", applicationVersion: "" };
    const now = Date.now();

    // Updates to check
    const applicationVersion = await this.platformUtilsService.getApplicationVersion();
    const remoteChecksum = await this.fetchPhishingChecksum(this.resourceType);

    // Logic checks
    const appVersionChanged = applicationVersion !== prevMeta.applicationVersion;
    const masterChecksumChanged = remoteChecksum !== prevMeta.checksum;

    // Check for full updated
    if (masterChecksumChanged || appVersionChanged) {
      this.logService.info("[PhishingDataService] Checksum or version changed; Fetching ALL.");
      const remoteUrl = getPhishingResources(this.resourceType)!.remoteUrl;
      const blob = await this.fetchAndCompress(remoteUrl);
      return {
        blob,
        meta: { checksum: remoteChecksum, timestamp: now, applicationVersion },
      };
    }

    // Check for daily file
    const isCacheExpired = now - prevMeta.timestamp > this.UPDATE_INTERVAL_DURATION;

    if (isCacheExpired) {
      this.logService.info("[PhishingDataService] Daily cache expired; Fetching TODAY's");
      const url = getPhishingResources(this.resourceType)!.todayUrl;
      const newLines = await this.fetchText(url);
      const prevBlob = (await firstValueFrom(this._phishingBlobState.state$)) ?? "";
      const oldText = prevBlob ? await this._decompressString(prevBlob) : "";

      // Join the new lines to the existing list
      const combined = (oldText ? oldText + "\n" : "") + newLines.join("\n");

      return {
        blob: await this._compressString(combined),
        meta: {
          checksum: remoteChecksum,
          timestamp: now, // Reset the timestamp
          applicationVersion,
        },
      };
    }

    return null;
  }

  private async fetchPhishingChecksum(type: PhishingResourceType = PhishingResourceType.Domains) {
    const checksumUrl = getPhishingResources(type)!.checksumUrl;
    const response = await this.apiService.nativeFetch(new Request(checksumUrl));
    if (!response.ok) {
      throw new Error(`[PhishingDataService] Failed to fetch checksum: ${response.status}`);
    }
    return response.text();
  }
  private async fetchAndCompress(url: string): Promise<string> {
    const response = await this.apiService.nativeFetch(new Request(url));
    if (!response.ok) {
      throw new Error("Fetch failed");
    }

    const downloadStream = response.body!;
    // Pipe through CompressionStream while it's downloading
    const compressedStream = downloadStream.pipeThrough(new CompressionStream("gzip"));
    // Convert to ArrayBuffer
    const buffer = await new Response(compressedStream).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Return as Base64 for storage
    return (bytes as any).toBase64 ? (bytes as any).toBase64() : this._uint8ToBase64Fallback(bytes);
  }

  private async fetchText(url: string) {
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
          await this._phishingMetaState.update(() => next!.meta!);
        }
        if (next.blob) {
          await this._phishingBlobState.update(() => next!.blob!);
          await this._loadBlobToMemory();
        }

        // Performance logging
        const elapsed = Date.now() - startTime;
        this.logService.info(`[PhishingDataService] Phishing data cache updated in ${elapsed}ms`);
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

  // [FIXME] Move compression helpers to a shared utils library
  // to separate from phishing data service.
  // ------------------------- Blob and Compression Handling -------------------------
  private async _compressString(input: string): Promise<string> {
    try {
      const stream = new Blob([input]).stream().pipeThrough(new CompressionStream("gzip"));

      const compressedBuffer = await new Response(stream).arrayBuffer();
      const bytes = new Uint8Array(compressedBuffer);

      // Modern browsers support direct toBase64 conversion
      // For older support, use fallback
      return (bytes as any).toBase64
        ? (bytes as any).toBase64()
        : this._uint8ToBase64Fallback(bytes);
    } catch (err) {
      this.logService.error("[PhishingDataService] Compression failed", err);
      return btoa(encodeURIComponent(input));
    }
  }

  private async _decompressString(base64: string): Promise<string> {
    try {
      // Modern browsers support direct toBase64 conversion
      // For older support, use fallback
      const bytes = (Uint8Array as any).fromBase64
        ? (Uint8Array as any).fromBase64(base64)
        : this._base64ToUint8Fallback(base64);
      if (bytes == null) {
        throw new Error("Base64 decoding resulted in null");
      }
      const byteResponse = new Response(bytes);
      if (!byteResponse.body) {
        throw new Error("Response body is null");
      }
      const stream = byteResponse.body.pipeThrough(new DecompressionStream("gzip"));
      const streamResponse = new Response(stream);
      return await streamResponse.text();
    } catch (err) {
      this.logService.error("[PhishingDataService] Decompression failed", err);
      return decodeURIComponent(atob(base64));
    }
  }

  // Try to load compressed newline blob into an in-memory Set for fast lookups
  private async _loadBlobToMemory(): Promise<void> {
    this.logService.debug("[PhishingDataService] Loading data blob into memory...");
    try {
      const blobBase64 = await firstValueFrom(this._phishingBlobState.state$);
      if (!blobBase64) {
        return;
      }

      const text = await this._decompressString(blobBase64);
      // Split and filter
      const lines = text.split(/\r?\n/);
      const newWebAddressesSet = new Set(lines);

      // Add test addresses
      this._testWebAddresses.forEach((a) => newWebAddressesSet.add(a));
      this._webAddressesSet = new Set(newWebAddressesSet);
      this.logService.info(
        `[PhishingDataService] loaded ${this._webAddressesSet.size} addresses into memory from blob`,
      );
    } catch (err) {
      this.logService.error("[PhishingDataService] Failed to load blob into memory", err);
    }
  }
  private _uint8ToBase64Fallback(bytes: Uint8Array): string {
    const CHUNK_SIZE = 0x8000; // 32KB chunks
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, i + CHUNK_SIZE);
      binary += String.fromCharCode.apply(null, chunk as any);
    }
    return btoa(binary);
  }

  private _base64ToUint8Fallback(base64: string): Uint8Array {
    const binary = atob(base64);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  }
}
