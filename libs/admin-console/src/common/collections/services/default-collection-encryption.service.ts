import {
  Observable,
  catchError,
  concatMap,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  tap,
  throwError,
} from "rxjs";

import { Collection } from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";
import { DecryptCollectionListResult } from "@bitwarden/sdk-internal";

import { CollectionEncryptionService } from "../abstractions/collection-encryption.service";

export class DefaultCollectionEncryptionService implements CollectionEncryptionService {
  constructor(
    private sdkService: SdkService,
    private logService: LogService,
    private configService: ConfigService,
  ) {}

  decrypt(collection: Collection, userId: UserId): Observable<CollectionView> {
    return this.decryptMany([collection], userId).pipe(
      map((views) => {
        if (views.length === 0) {
          const error = new Error(`Failed to decrypt collection ${collection.id}`);
          this.logService.error(`Failed to decrypt collection: ${error}`);
          throw error;
        }
        return views[0];
      }),
    );
  }

  decryptMany(collections: Collection[], userId: UserId): Observable<CollectionView[]> {
    if (!collections || collections.length === 0) {
      return of([]);
    }

    return this.configService.getFeatureFlag$(FeatureFlag.CollectionBulkDecryptWithFailures).pipe(
      distinctUntilChanged(),
      switchMap((bulkDecryptEnabled) =>
        bulkDecryptEnabled
          ? this.decryptManyV2(collections, userId)
          : this.decryptManyV1(collections, userId),
      ),
    );
  }

  /**
   * V1 implementation: decrypts each collection individually via the SDK, one at a time.
   * A collection that fails to decrypt is logged and dropped rather than aborting the rest
   * of the batch.
   */
  private decryptManyV1(collections: Collection[], userId: UserId): Observable<CollectionView[]> {
    const startTime = performance.now();

    return this.sdkService.userClient$(userId).pipe(
      concatMap(async (sdk) => {
        using ref = sdk.take();

        const success: CollectionView[] = [];
        for (const collection of collections) {
          try {
            const sdkView = ref.value.vault().collections().decrypt(collection.toSdkCollection());
            success.push(CollectionView.fromSdkCollectionView(sdkView, collection));
          } catch (error: unknown) {
            this.logService.error(`Failed to decrypt collection ${collection.id}: ${error}`);
          }
        }

        return success;
      }),
      catchError((error: unknown) => {
        this.logService.error(`Failed to decrypt collections in batch: ${error}`);
        return throwError(() => (error instanceof Error ? error : new Error(String(error))));
      }),
      tap((result) => {
        this.logService.measure(
          startTime,
          "Admin Console",
          "DefaultCollectionEncryptionService",
          "decryptMany (v1, one at a time)",
          [
            ["Items", collections.length],
            ["Successes", result.length],
          ],
        );
      }),
    );
  }

  /**
   * V2 implementation using the SDK's `decrypt_list_with_failures` for batch performance with
   * per-item failure tolerance. The SDK natively separates successes from failures. Collections
   * that fail to decrypt are still returned to the caller as a placeholder view (empty `name`,
   * `decryptionFailure` set) rather than being dropped, so the item remains visible instead of
   * silently disappearing from the vault. Gated behind
   * {@link FeatureFlag.CollectionBulkDecryptWithFailures} until the SDK bindings have rolled out
   * everywhere this service is used.
   */
  private decryptManyV2(collections: Collection[], userId: UserId): Observable<CollectionView[]> {
    const startTime = performance.now();

    return this.sdkService.userClient$(userId).pipe(
      concatMap(async (sdk) => {
        using ref = sdk.take();

        const collectionsById = new Map<CollectionId, Collection>(
          collections.map((c) => [c.id, c]),
        );
        const sdkCollections = collections.map((c) => c.toSdkCollection());
        const result: DecryptCollectionListResult = ref.value
          .vault()
          .collections()
          .decrypt_list_with_failures(sdkCollections);

        const views: CollectionView[] = [];
        for (const sdkView of result.successes) {
          const collection = sdkView.id
            ? collectionsById.get(uuidAsString(sdkView.id) as CollectionId)
            : undefined;
          if (collection) {
            views.push(CollectionView.fromSdkCollectionView(sdkView, collection));
          }
        }

        for (const failed of result.failures) {
          const id = failed.id ? uuidAsString(failed.id) : "(unknown id)";
          const collection = failed.id
            ? collectionsById.get(uuidAsString(failed.id) as CollectionId)
            : undefined;
          this.logService.error(`Failed to decrypt collection ${id}: not returned by SDK`);
          if (collection) {
            views.push(CollectionView.fromFailedDecryption(collection));
          }
        }

        return views;
      }),
      catchError((error: unknown) => {
        this.logService.error(`Failed to decrypt collections in batch: ${error}`);
        return throwError(() => (error instanceof Error ? error : new Error(String(error))));
      }),
      tap((result) => {
        this.logService.measure(
          startTime,
          "Admin Console",
          "DefaultCollectionEncryptionService",
          "decryptMany (v2, decrypt_list_with_failures)",
          [
            ["Items", collections.length],
            ["Successes", result.filter((v) => !v.decryptionFailure).length],
            ["Failures", result.filter((v) => v.decryptionFailure).length],
          ],
        );
      }),
    );
  }
}
