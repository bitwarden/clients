import {
  Observable,
  catchError,
  concatMap,
  distinctUntilChanged,
  map,
  of,
  switchMap,
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

  /** Decrypts each collection individually via the SDK, one at a time. */
  private decryptManyWithFailuresV1(
    collections: Collection[],
    userId: UserId,
  ): Observable<CollectionDecryptionResult> {
    return this.sdkService.userClient$(userId).pipe(
      concatMap(async (sdk) => {
        const startTime = performance.now();
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

        const result = { success, failure };
        this.measureDecrypt(startTime, "v1, one at a time", collections.length, result);
        return result;
      }),
      catchError((error: unknown) => {
        this.logService.error(`Failed to decrypt collections in batch: ${error}`);
        return throwError(() => (error instanceof Error ? error : new Error(String(error))));
      }),
    );
  }

  /** Decrypts the whole list in one SDK call via `decrypt_list_with_failures`. */
  private decryptManyWithFailuresV2(
    collections: Collection[],
    userId: UserId,
  ): Observable<CollectionDecryptionResult> {
    return this.sdkService.userClient$(userId).pipe(
      concatMap(async (sdk) => {
        const startTime = performance.now();
        using ref = sdk.take();

        const collectionMap = this.buildCollectionMap(collections);

        const sdkResult: DecryptCollectionListResult = ref.value
          .vault()
          .collections()
          .decrypt_list_with_failures(collections.map((c) => c.toSdkCollection()));

        const result = {
          success: this.mapDecryptedSuccesses(sdkResult.successes, collectionMap),
          failure: this.mapDecryptedFailures(sdkResult.failures),
        };
        this.measureDecrypt(
          startTime,
          "v2, decrypt_list_with_failures",
          collections.length,
          result,
        );
        return result;
      }),
      catchError((error: unknown) => {
        this.logService.error(`Failed to decrypt collections in batch: ${error}`);
        return throwError(() => (error instanceof Error ? error : new Error(String(error))));
      }),
    );
  }

  /** startTime must be captured inside concatMap since userClient$ can re-emit. */
  private measureDecrypt(
    startTime: DOMHighResTimeStamp,
    variant: string,
    itemCount: number,
    result: CollectionDecryptionResult,
  ): void {
    this.logService.measure(
      startTime,
      "Admin Console",
      "DefaultCollectionEncryptionService",
      `decryptManyWithFailures (${variant})`,
      [
        ["Items", itemCount],
        ["Successes", result.success.length],
        ["Failures", result.failure.length],
      ],
    );
  }

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
