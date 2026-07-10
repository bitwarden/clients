import { catchError, concatMap, firstValueFrom } from "rxjs";

import { Collection } from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";

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
    if (!collections || collections.length === 0) {
      return [];
    }

    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();

          const views: CollectionView[] = [];
          for (const collection of collections) {
            try {
              const sdkView = ref.value.vault().collections().decrypt(collection.toSdkCollection());
              views.push(CollectionView.fromSdkCollectionView(sdkView, collection));
            } catch (error: unknown) {
              this.logService.error(`Failed to decrypt collection ${collection.id}: ${error}`);
            }
          }
          return views;
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to decrypt collections in batch: ${error}`);
          throw error;
        }),
      ),
    );
  }
}
