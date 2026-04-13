import { EMPTY, catchError, concatMap, firstValueFrom } from "rxjs";

import { Collection } from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";

import { CollectionEncryptionService } from "../abstractions/collection-encryption.service";

export class DefaultCollectionEncryptionService implements CollectionEncryptionService {
  constructor(
    private sdkService: SdkService,
    private logService: LogService,
  ) {}

  async decrypt(collection: Collection, userId: UserId): Promise<CollectionView> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          const sdkCollectionView = ref.value
            .vault()
            .collections()
            .decrypt(collection.toSdkCollection());

          return CollectionView.fromSdkCollectionView(sdkCollectionView, collection);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to decrypt collection: ${error}`);
          return EMPTY;
        }),
      ),
    );
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

          const collectionById = new Map<CollectionId, Collection>(
            collections.map((c) => [c.id, c]),
          );

          const sdkCollectionViews = ref.value
            .vault()
            .collections()
            .decrypt_list(collections.map((c) => c.toSdkCollection()));

          return sdkCollectionViews.map((sdkView) => {
            const originalCollection = sdkView.id
              ? collectionById.get(sdkView.id as unknown as CollectionId)
              : undefined;
            return CollectionView.fromSdkCollectionView(sdkView, originalCollection);
          });
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to decrypt collections in batch: ${error}`);
          return EMPTY;
        }),
      ),
    );
  }
}
