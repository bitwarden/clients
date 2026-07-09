import { catchError, concatMap, firstValueFrom } from "rxjs";


import { Collection } from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DecryptCollectionListResult } from "@bitwarden/sdk-internal";

import { CollectionEncryptionService } from "../abstractions/collection-encryption.service";

export class DefaultCollectionEncryptionService implements CollectionEncryptionService {
  constructor(
    private sdkService: SdkService,
    private logService: LogService,
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

    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();

          const collectionMap = new Map<string, Collection>(collections.map((c) => [c.id, c]));

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
  }
}
