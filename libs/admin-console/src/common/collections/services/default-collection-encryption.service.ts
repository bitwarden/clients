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
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
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
   * per-item failure tolerance. The SDK natively separates successes from failures, so collections
   * that fail to decrypt are logged and dropped without aborting the rest of the batch. Gated
   * behind {@link FeatureFlag.CollectionBulkDecryptWithFailures} until the SDK bindings have
   * rolled out everywhere this service is used.
   */
  private decryptManyV2(collections: Collection[], userId: UserId): Observable<CollectionView[]> {
    const startTime = performance.now();

    return this.sdkService.userClient$(userId).pipe(
      concatMap(async (sdk) => {
        using ref = sdk.take();

        const collectionMap = new Map<string, Collection>(
          collections.map((c) => [c.id as unknown as string, c]),
        );
        const sdkCollections = collections.map((c) => c.toSdkCollection());
        const result: DecryptCollectionListResult = ref.value
          .vault()
          .collections()
          .decrypt_list_with_failures(sdkCollections);

        const success: CollectionView[] = [];
        for (const sdkView of result.successes) {
          const id = sdkView.id as unknown as string;
          const collection = collectionMap.get(id);
          if (collection) {
            success.push(CollectionView.fromSdkCollectionView(sdkView, collection));
          }
        }

        for (const failed of result.failures) {
          this.logService.error(`Failed to decrypt collection ${failed.id}: not returned by SDK`);
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
          "decryptMany (v2, decrypt_list_with_failures)",
          [
            ["Items", collections.length],
            ["Successes", result.length],
          ],
        );
      }),
    );
  }
}
