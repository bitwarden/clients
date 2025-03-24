// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, fromEvent, filter, map, takeUntil, defaultIfEmpty, Subject } from "rxjs";
import { Jsonify } from "type-fest";

import { BulkEncryptService } from "@bitwarden/common/key-management/crypto/abstractions/bulk-encrypt.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Decryptable } from "@bitwarden/common/platform/interfaces/decryptable.interface";
import { InitializerMetadata } from "@bitwarden/common/platform/interfaces/initializer-metadata.interface";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { getClassInitializer } from "@bitwarden/common/platform/services/cryptography/get-class-initializer";

// TTL (time to live) is not strictly required but avoids tying up memory resources if inactive
const workerTTL = 60000; // 1 minute
const maxWorkers = 8;
const minNumberOfItemsForMultithreading = 400;

export class BulkEncryptServiceImplementation implements BulkEncryptService {
  private workers: Worker[] = [];
  private timeout: any;

  private clear$ = new Subject<void>();

  constructor(
    protected cryptoFunctionService: CryptoFunctionService,
    protected logService: LogService,
  ) {}

  /**
   * Decrypts items using a web worker if the environment supports it.
   * Will fall back to the main thread if the window object is not available.
   */
  async decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (items == null || items.length < 1) {
      return [];
    }

    if (typeof window === "undefined") {
      this.logService.info("Window not available in BulkEncryptService, decrypting sequentially");
      const results = [];
      for (let i = 0; i < items.length; i++) {
        results.push(await items[i].decrypt(key));
      }
      return results;
    }

    const decryptedItems = await this.getDecryptedItemsFromWorkers(items, key);
    return decryptedItems;
  }

  /**
   * Sends items to a set of web workers to decrypt them. This utilizes multiple workers to decrypt items
   * faster without interrupting other operations (e.g. updating UI).
   */
  private async getDecryptedItemsFromWorkers<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]> {
    if (items == null || items.length < 1) {
      return [];
    }

    this.clearTimeout();

    const hardwareConcurrency = navigator.hardwareConcurrency || 1;
    let numberOfWorkers = Math.min(hardwareConcurrency, maxWorkers);
    if (items.length < minNumberOfItemsForMultithreading) {
      numberOfWorkers = 1;
    }

    this.logService.info(
      `Starting decryption using multithreading with ${numberOfWorkers} workers for ${items.length} items`,
    );

    if (this.workers.length == 0) {
      for (let i = 0; i < numberOfWorkers; i++) {
        this.workers.push(
          new Worker(
            new URL(
              /* webpackChunkName: 'encrypt-worker' */
              "@bitwarden/common/key-management/crypto/services/encrypt.worker.ts",
              import.meta.url,
            ),
          ),
        );
      }
    }

    const itemsPerWorker = Math.floor(items.length / this.workers.length);
    const results = [];

    for (const [i, worker] of this.workers.entries()) {
      const start = i * itemsPerWorker;
      const end = start + itemsPerWorker;
      const itemsForWorker = items.slice(start, end);

      // push the remaining items to the last worker
      if (i == this.workers.length - 1) {
        itemsForWorker.push(...items.slice(end));
      }

      const request = {
        id: Utils.newGuid(),
        items: itemsForWorker,
        key: key,
      };

      worker.postMessage(JSON.stringify(request));
      results.push(
        firstValueFrom(
          fromEvent(worker, "message").pipe(
            filter((response: MessageEvent) => response.data?.id === request.id),
            map((response) => JSON.parse(response.data.items)),
            map((items) =>
              items.map((jsonItem: Jsonify<T>) => {
                const initializer = getClassInitializer<T>(jsonItem.initializerKey);
                return initializer(jsonItem);
              }),
            ),
            takeUntil(this.clear$),
            defaultIfEmpty([]),
          ),
        ),
      );
    }

    const decryptedItems = (await Promise.all(results)).flat();
    this.logService.info(
      `Finished decrypting ${decryptedItems.length} items using ${numberOfWorkers} workers`,
    );

    this.restartTimeout();

    return decryptedItems;
  }

  private clear() {
    this.clear$.next();
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.clearTimeout();
  }

  private restartTimeout() {
    this.clearTimeout();
    this.timeout = setTimeout(() => this.clear(), workerTTL);
  }

  private clearTimeout() {
    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }
  }
}
