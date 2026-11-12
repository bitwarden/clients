import { Observable, catchError, concatMap, map, of } from "rxjs";

import { Collection } from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";
import { DecryptCollectionListResult } from "@bitwarden/sdk-internal";

import { CollectionEncryptionService } from "../abstractions/collection-encryption.service";

export class DefaultCollectionEncryptionService implements CollectionEncryptionService {
  constructor(
    private sdkService: SdkService,
    private logService: LogService,
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

    return this.sdkService.userClient$(userId).pipe(
      concatMap(async (sdk) => {
        const startTime = performance.now();
        using ref = sdk.take();

        const collectionsById = new Map<CollectionId, Collection>(
          collections.map((c) => [c.id, c]),
        );
        const sdkCollections = collections.map((c) => c.toSdkCollection());
        const result: DecryptCollectionListResult = await ref.value
          .vault()
          .collections()
          .decrypt_list_with_failures(sdkCollections);

        const views: CollectionView[] = [];
        for (const sdkView of result.successes) {
          const id = sdkView.id ? uuidAsString(sdkView.id) : undefined;
          const collection = id ? collectionsById.get(id as CollectionId) : undefined;
          if (!collection) {
            // This means the decrypted collection doesn't have an ID, or wasn't present in the
            // source collections. This should never happen, but handle and log it just in case.
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
          "decryptMany",
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
