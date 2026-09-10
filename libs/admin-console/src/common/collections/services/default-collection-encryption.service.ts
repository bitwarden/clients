import { Observable, catchError, concatMap, distinctUntilChanged, map, of, switchMap } from "rxjs";

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
    return this.sdkService.userClient$(userId).pipe(
      // `userClient$` re-emits whenever the client is replaced (unlock, key re-emission), so the
      // clock has to start per emission — a single start time would fold the idle time between
      // emissions into every measurement after the first.
      concatMap(async (sdk) => {
        const startTime = performance.now();
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

        this.logService.measure(
          startTime,
          "Admin Console",
          "DefaultCollectionEncryptionService",
          "decryptMany (v1, one at a time)",
          [
            ["Items", collections.length],
            ["Successes", success.length],
          ],
        );

        return success;
      }),
      catchError((error: unknown) => {
        this.logService.error(`Failed to decrypt collections in batch: ${error}`);
        throw error;
      }),
    );
  }

  /**
   * V2 implementation using the SDK's `decrypt_list_with_failures` for batch performance with
   * per-item failure tolerance. The SDK natively separates successes from failures. Collections
   * that fail to decrypt are still returned to the caller as a placeholder view (`name` replaced
   * by the decrypt-error placeholder, `decryptionFailure` set) rather than being dropped, so the
   * item remains visible instead of silently disappearing from the vault. Gated behind
   * {@link FeatureFlag.CollectionBulkDecryptWithFailures} until the SDK bindings have rolled out
   * everywhere this service is used.
   */
  private decryptManyV2(collections: Collection[], userId: UserId): Observable<CollectionView[]> {
    return this.sdkService.userClient$(userId).pipe(
      // See `decryptManyV1` — the client observable re-emits, so time each emission separately.
      concatMap(async (sdk) => {
        const startTime = performance.now();
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
          const id = sdkView.id ? uuidAsString(sdkView.id) : undefined;
          const collection = id ? collectionsById.get(id as CollectionId) : undefined;
          if (!collection) {
            // Views are paired to their source by ID, so an ID that does not round-trip drops the
            // collection from the list entirely. Log it rather than let it disappear unremarked -
            // that silent disappearance is what this method exists to prevent.
            this.logService.error(
              `Decrypted collection ${id ?? "(unknown id)"} did not match a source collection`,
            );
            continue;
          }
          views.push(CollectionView.fromSdkCollectionView(sdkView, collection));
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

        this.logService.measure(
          startTime,
          "Admin Console",
          "DefaultCollectionEncryptionService",
          "decryptMany (v2, decrypt_list_with_failures)",
          [
            ["Items", collections.length],
            ["Successes", views.filter((v) => !v.decryptionFailure).length],
            ["Failures", views.filter((v) => v.decryptionFailure).length],
          ],
        );

        return views;
      }),
      catchError((error: unknown) => {
        this.logService.error(`Failed to decrypt collections in batch: ${error}`);
        throw error;
      }),
    );
  }
}
