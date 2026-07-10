import { catchError, concatMap, firstValueFrom } from "rxjs";

import { Collection } from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DecryptCollectionListResult } from "@bitwarden/sdk-internal";

import { CollectionEncryptionService } from "../abstractions/collection-encryption.service";

export class DefaultCollectionEncryptionService implements CollectionEncryptionService {
  constructor(
    private sdkService: SdkService,
    private logService: LogService,
    private configService: ConfigService,
  ) {}

  async decrypt(collection: Collection, userId: UserId): Promise<CollectionView> {
    const results = await this.decryptMany([collection], userId);
    if (results.length === 0) {
      const error = new Error(`Failed to decrypt collection ${collection.id}`);
      this.logService.error(`Failed to decrypt collection: ${error}`);
      throw error;
    }
    return results[0];
  }

  async decryptMany(collections: Collection[], userId: UserId): Promise<CollectionView[]> {
    return (await this.decryptManyWithFailures(collections, userId))[0];
  }

  async decryptManyWithFailures(
    collections: Collection[],
    userId: UserId,
  ): Promise<[CollectionView[], Collection[]]> {
    if (!collections || collections.length === 0) {
      return [[], []];
    }

    const bulkDecryptEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.CollectionBulkDecryptWithFailures,
    );

    return bulkDecryptEnabled
      ? this.decryptManyWithFailuresBulk(collections, userId)
      : this.decryptManyWithFailuresOriginal(collections, userId);
  }

  /**
   * Original implementation: decrypts each collection individually via the SDK, one at a time.
   * A collection that fails to decrypt is logged and returned in the failures array instead of
   * aborting the rest of the batch.
   */
  private async decryptManyWithFailuresOriginal(
    collections: Collection[],
    userId: UserId,
  ): Promise<[CollectionView[], Collection[]]> {
    const startTime = performance.now();

    const result = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();

          const views: CollectionView[] = [];
          const failures: Collection[] = [];
          for (const collection of collections) {
            try {
              const sdkView = ref.value.vault().collections().decrypt(collection.toSdkCollection());
              views.push(CollectionView.fromSdkCollectionView(sdkView, collection));
            } catch (error: unknown) {
              this.logService.error(`Failed to decrypt collection ${collection.id}: ${error}`);
              failures.push(collection);
            }
          }

          return [views, failures] as [CollectionView[], Collection[]];
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to decrypt collections in batch: ${error}`);
          throw error;
        }),
      ),
    );

    this.logService.measure(
      startTime,
      "Admin Console",
      "DefaultCollectionEncryptionService",
      "decryptManyWithFailures (original, one at a time)",
      [
        ["Items", collections.length],
        ["Successes", result[0].length],
        ["Failures", result[1].length],
      ],
    );

    return result;
  }

  /**
   * Batched implementation using the SDK's `decrypt_list_with_failures`, which parallelizes
   * decryption of the whole list for better performance on large lists. Gated behind
   * {@link FeatureFlag.CollectionBulkDecryptWithFailures} until the SDK bindings that expose
   * this method have rolled out everywhere this service is used.
   */
  private async decryptManyWithFailuresBulk(
    collections: Collection[],
    userId: UserId,
  ): Promise<[CollectionView[], Collection[]]> {
    const startTime = performance.now();

    const result = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();

          const collectionMap = new Map<string, Collection>();
          for (const collection of collections) {
            if (collectionMap.has(collection.id)) {
              // Decrypted views are re-associated with their source `Collection` by id below
              // (needed to preserve `defaultUserCollectionEmail`, which gates the security
              // restriction in `CollectionView.canEditName()`). A duplicate id would make that
              // re-association ambiguous and could silently attach the wrong collection's
              // metadata to a decrypted view, so fail closed instead of guessing.
              throw new Error(
                `Duplicate collection id passed to decryptManyWithFailures: ${collection.id}`,
              );
            }
            collectionMap.set(collection.id, collection);
          }

          const result: DecryptCollectionListResult = ref.value
            .vault()
            .collections()
            .decrypt_list_with_failures(collections.map((c) => c.toSdkCollection()));

          const views = result.successes
            .map((sdkView) => {
              const id = sdkView.id ? uuidAsString(sdkView.id) : "";
              const original = collectionMap.get(id);
              if (!original) {
                return null;
              }
              return CollectionView.fromSdkCollectionView(sdkView, original);
            })
            .filter((v): v is CollectionView => v !== null);

          const failedCollections = result.failures.map((sdkCollection) =>
            Collection.fromSdkCollection(sdkCollection),
          );

          for (const failure of failedCollections) {
            this.logService.error(`Failed to decrypt collection ${failure.id}`);
          }

          return [views, failedCollections] as [CollectionView[], Collection[]];
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to decrypt collections in batch: ${error}`);
          throw error;
        }),
      ),
    );

    this.logService.measure(
      startTime,
      "Admin Console",
      "DefaultCollectionEncryptionService",
      "decryptManyWithFailures (bulk, decrypt_list_with_failures)",
      [
        ["Items", collections.length],
        ["Successes", result[0].length],
        ["Failures", result[1].length],
      ],
    );

    return result;
  }
}
