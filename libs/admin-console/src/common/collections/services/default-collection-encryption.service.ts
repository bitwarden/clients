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
import { UserId } from "@bitwarden/common/types/guid";
import { DecryptCollectionListResult } from "@bitwarden/sdk-internal";

import {
  CollectionDecryptionResult,
  CollectionEncryptionService,
} from "../abstractions/collection-encryption.service";

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
    return this.decryptManyWithFailures(collections, userId).pipe(map((result) => result.success));
  }

  decryptManyWithFailures(
    collections: Collection[],
    userId: UserId,
  ): Observable<CollectionDecryptionResult> {
    if (!collections || collections.length === 0) {
      return of({ success: [], failure: [] });
    }

    return this.configService.getFeatureFlag$(FeatureFlag.CollectionBulkDecryptWithFailures).pipe(
      distinctUntilChanged(),
      switchMap((bulkDecryptEnabled) =>
        bulkDecryptEnabled
          ? this.decryptManyWithFailuresV2(collections, userId)
          : this.decryptManyWithFailuresV1(collections, userId),
      ),
    );
  }

  /**
   * V1 implementation: decrypts each collection individually via the SDK, one at a time.
   * A collection that fails to decrypt is logged and returned in `failure` instead of aborting
   * the rest of the batch.
   */
  private decryptManyWithFailuresV1(
    collections: Collection[],
    userId: UserId,
  ): Observable<CollectionDecryptionResult> {
    const startTime = performance.now();

    return this.sdkService.userClient$(userId).pipe(
      concatMap(async (sdk) => {
        using ref = sdk.take();

        const success: CollectionView[] = [];
        const failure: Collection[] = [];
        for (const collection of collections) {
          try {
            const sdkView = ref.value.vault().collections().decrypt(collection.toSdkCollection());
            success.push(CollectionView.fromSdkCollectionView(sdkView, collection));
          } catch (error: unknown) {
            this.logService.error(`Failed to decrypt collection ${collection.id}: ${error}`);
            failure.push(collection);
          }
        }

        return { success, failure };
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
          "decryptManyWithFailures (v1, one at a time)",
          [
            ["Items", collections.length],
            ["Successes", result.success.length],
            ["Failures", result.failure.length],
          ],
        );
      }),
    );
  }

  /**
   * V2 implementation using the SDK's `decrypt_list_with_failures`, which parallelizes
   * decryption of the whole list for better performance on large lists. Gated behind
   * {@link FeatureFlag.CollectionBulkDecryptWithFailures} until the SDK bindings that expose
   * this method have rolled out everywhere this service is used.
   */
  private decryptManyWithFailuresV2(
    collections: Collection[],
    userId: UserId,
  ): Observable<CollectionDecryptionResult> {
    const startTime = performance.now();

    return this.sdkService.userClient$(userId).pipe(
      concatMap(async (sdk) => {
        using ref = sdk.take();

        const collectionMap = this.buildCollectionMap(collections);

        const result: DecryptCollectionListResult = ref.value
          .vault()
          .collections()
          .decrypt_list_with_failures(collections.map((c) => c.toSdkCollection()));

        return {
          success: this.mapDecryptedSuccesses(result.successes, collectionMap),
          failure: this.mapDecryptedFailures(result.failures),
        };
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
          "decryptManyWithFailures (v2, decrypt_list_with_failures)",
          [
            ["Items", collections.length],
            ["Successes", result.success.length],
            ["Failures", result.failure.length],
          ],
        );
      }),
    );
  }

  /**
   * Builds a lookup of source `Collection`s by id, used to re-associate decrypted SDK views with
   * their source (needed to preserve `defaultUserCollectionEmail`, which gates the security
   * restriction in `CollectionView.canEditName()`). Duplicate ids collapse to the last entry,
   * which is the same collection either way.
   */
  private buildCollectionMap(collections: Collection[]): Map<string, Collection> {
    return new Map(collections.map((c) => [c.id, c]));
  }

  private mapDecryptedSuccesses(
    sdkViews: DecryptCollectionListResult["successes"],
    collectionMap: Map<string, Collection>,
  ): CollectionView[] {
    return sdkViews
      .map((sdkView) => {
        const original = sdkView.id ? collectionMap.get(uuidAsString(sdkView.id)) : undefined;
        return original ? CollectionView.fromSdkCollectionView(sdkView, original) : undefined;
      })
      .filter((v): v is CollectionView => v !== undefined);
  }

  private mapDecryptedFailures(
    sdkCollections: DecryptCollectionListResult["failures"],
  ): Collection[] {
    const failures = sdkCollections.map((sdkCollection) =>
      Collection.fromSdkCollection(sdkCollection),
    );

    if (failures.length > 0) {
      this.logService.error(
        `Failed to decrypt ${failures.length} collection(s): ${failures.map((f) => f.id).join(", ")}`,
      );
    }

    return failures;
  }
}
