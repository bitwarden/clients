import {
  defaultIfEmpty,
  filter,
  firstValueFrom,
  fromEvent,
  map,
  Observable,
  takeUntil,
} from "rxjs";
import { Jsonify } from "type-fest";

import { Utils } from "../../../platform/misc/utils";
import { CryptoFunctionService } from "../../abstractions/crypto-function.service";
import { LogService } from "../../abstractions/log.service";
import { StateService } from "../../abstractions/state.service";
import { Decryptable } from "../../interfaces/decryptable.interface";
import { InitializerMetadata } from "../../interfaces/initializer-metadata.interface";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";

import { EncryptServiceImplementation } from "./encrypt.service.implementation";
import { getClassInitializer } from "./get-class-initializer";

/**
 * A variant of EncryptService which uses multithreading when decrypting multiple items.
 * This significantly speeds up decryption time and avoids blocking the main thread, which freezes the UI.
 * Multithreading in browsers is implemented using the Web Workers API. For more information, see:
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
 */
export class MultithreadEncryptServiceImplementation extends EncryptServiceImplementation {
  private worker: Worker;
  private terminateWorker$: Observable<boolean>;

  constructor(
    cryptoFunctionService: CryptoFunctionService,
    logService: LogService,
    stateService: StateService,
    logMacFailures: boolean
  ) {
    super(cryptoFunctionService, logService, logMacFailures);

    // Terminate the worker if the active account is locked or logged out
    // The intention here is to err on the safe side of cleaning up memory given that decryption operations
    // may be running when this occurs
    this.terminateWorker$ = stateService.activeAccountUnlocked$.pipe(
      filter((unlocked) => !unlocked)
    );

    this.terminateWorker$.subscribe(() => {
      if (this.worker == null) {
        return;
      }

      // This aborts the current script and any queued tasks in the worker:
      // https://html.spec.whatwg.org/multipage/workers.html#terminate-a-worker
      this.worker?.terminate();
      this.worker = null;
      this.logService.info("EncryptWorker terminated");
    });
  }

  async decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey
  ): Promise<T[]> {
    if (items == null || items.length < 1) {
      return [];
    }

    this.logService.info("Starting decryption using multithreading");

    this.worker ??= new Worker(
      new URL(
        // This is required to get a consistent webpack chunk name. This is particularly important for Safari
        // which needs a consistent file name to include in its bundle. Do not change the next line.
        /* webpackChunkName: 'encrypt-worker' */
        "@bitwarden/common/platform/services/cryptography/encrypt.worker.ts",
        import.meta.url
      )
    );

    const request = {
      id: Utils.newGuid(),
      items: items,
      key: key,
    };

    this.worker.postMessage(JSON.stringify(request));

    return await firstValueFrom(
      fromEvent(this.worker, "message").pipe(
        filter((response: MessageEvent) => response.data?.id === request.id),
        map((response) => JSON.parse(response.data.items)),
        map((items) =>
          items.map((jsonItem: Jsonify<T>) => {
            const initializer = getClassInitializer<T>(jsonItem.initializerKey);
            return initializer(jsonItem);
          })
        ),
        takeUntil(this.terminateWorker$),
        defaultIfEmpty(null)
      )
    );
  }
}
