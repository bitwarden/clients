import { defaultIfEmpty, filter, firstValueFrom, fromEvent, map, Subject, takeUntil } from "rxjs";
import { Jsonify } from "type-fest";

import { Utils } from "../../../platform/misc/utils";
import { Decryptable } from "../../interfaces/decryptable.interface";
import { InitializerMetadata } from "../../interfaces/initializer-metadata.interface";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";

import { EncryptServiceImplementation } from "./encrypt.service.implementation";
import { getClassInitializer } from "./get-class-initializer";

// TTL (time to live) is not strictly required but avoids tying up memory resources if inactive
const workerTTL = 60000; // 1 minute
const maxWorkers = 16;
const minNumberOfItemsForMultithreading = 500;

export class MultithreadEncryptServiceImplementation extends EncryptServiceImplementation {
  private workers: Worker[] = [];
  private timeout: any;

  private clear$ = new Subject<void>();

  /**
   * Sends items to a web worker to decrypt them.
   * This utilises multithreading to decrypt items faster without interrupting other operations (e.g. updating UI).
   */
  async decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]> {
    if (items == null || items.length < 1) {
      return [];
    }

    let numberOfWorkers = Math.min(navigator.hardwareConcurrency, maxWorkers);
    if (items.length < minNumberOfItemsForMultithreading) {
      numberOfWorkers = 1;
    }

    this.logService.info(
      "Starting decryption using multithreading with " + numberOfWorkers + " workers",
    );

    if (this.workers.length == 0) {
      for (let i = 0; i < numberOfWorkers; i++) {
        this.workers.push(
          new Worker(
            new URL(
              /* webpackChunkName: 'encrypt-worker' */
              "@bitwarden/common/platform/services/cryptography/encrypt.worker.ts",
              import.meta.url,
            ),
          ),
	      );
      }
    }

    this.restartTimeout();

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
