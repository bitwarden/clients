import {
  combineLatest,
  delayWhen,
  filter,
  firstValueFrom,
  from,
  map,
  NEVER,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SingleUserState, StateProvider } from "@bitwarden/common/platform/state";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { KeyService } from "@bitwarden/key-management";

import { CollectionService } from "../abstractions/collection.service";
import { Collection, CollectionData, CollectionView } from "../models";

import { DECRYPTED_COLLECTION_DATA_KEY, ENCRYPTED_COLLECTION_DATA_KEY } from "./collection.state";

const NestingDelimiter = "/";

export class DefaultCollectionService implements CollectionService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private i18nService: I18nService,
    protected stateProvider: StateProvider,
  ) {}

  private collectionViewCache = new Map<UserId, Observable<CollectionView[]>>();

  /**
   * @returns a SingleUserState for encrypted collection data.
   */
  private encryptedState(
    userId: UserId,
  ): SingleUserState<Record<CollectionId, CollectionData | null>> {
    return this.stateProvider.getUser(userId, ENCRYPTED_COLLECTION_DATA_KEY);
  }

  /**
   * @returns a SingleUserState for decrypted collection data.
   */
  private decryptedState(userId: UserId): SingleUserState<CollectionView[] | null> {
    return this.stateProvider.getUser(userId, DECRYPTED_COLLECTION_DATA_KEY);
  }

  encryptedCollections$(userId: UserId): Observable<Collection[] | null> {
    return this.encryptedState(userId).state$.pipe(
      map((collections) => {
        if (collections == null) {
          return null;
        }

        return Object.values(collections).map((c) => new Collection(c));
      }),
    );
  }

  decryptedCollections$(userId: UserId): Observable<CollectionView[]> {
    const cachedResult = this.collectionViewCache.get(userId);
    if (cachedResult) {
      return cachedResult;
    }

    const result$ = this.decryptedState(userId).state$.pipe(
      switchMap((decryptedState) => {
        // If decrypted state is already populated, return that
        if (decryptedState !== null) {
          return of(decryptedState ?? []);
        }

        return this.initializeDecryptedState(userId).pipe(switchMap(() => NEVER));
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.collectionViewCache.set(userId, result$);
    return result$;
  }

  private initializeDecryptedState(userId: UserId): Observable<CollectionView[]> {
    return combineLatest([
      this.encryptedCollections$(userId),
      this.keyService.orgKeys$(userId).pipe(filter((orgKeys) => !!orgKeys)),
    ]).pipe(
      switchMap(([collections, orgKeys]) =>
        this.decryptMany$(collections, orgKeys).pipe(
          delayWhen((collections) => this.setDecryptedCollections(collections, userId)),
        ),
      ),
    );
  }

  async upsert(toUpdate: CollectionData, userId: UserId): Promise<void> {
    if (toUpdate == null) {
      return;
    }
    await this.encryptedState(userId).update((collections) => {
      if (collections == null) {
        collections = {};
      }
      collections[toUpdate.id] = toUpdate;

      return collections;
    });

    const decryptedCollections = await firstValueFrom(
      this.keyService.orgKeys$(userId).pipe(
        switchMap((orgKeys) => {
          if (!orgKeys) {
            throw new Error("No key for this collection's organization.");
          }
          return this.decryptMany$([new Collection(toUpdate)], orgKeys);
        }),
      ),
    );

    await this.decryptedState(userId).update((collections) => {
      if (collections == null) {
        collections = [];
      }

      if (!decryptedCollections?.length) {
        return collections;
      }

      const decryptedCollection = decryptedCollections[0];
      const existingIndex = collections.findIndex((collection) => collection.id == toUpdate.id);
      if (existingIndex >= 0) {
        collections[existingIndex] = decryptedCollection;
      } else {
        collections.push(decryptedCollection);
      }

      return collections;
    });
  }

  async replace(collections: Record<CollectionId, CollectionData>, userId: UserId): Promise<void> {
    await this.encryptedState(userId).update(() => collections);
    await this.decryptedState(userId).update(() => null);
  }

  async delete(ids: CollectionId[], userId: UserId): Promise<any> {
    await this.encryptedState(userId).update((collections) => {
      if (collections == null) {
        collections = {};
      }
      ids.forEach((i) => {
        delete collections[i];
      });
      return collections;
    });

    await this.decryptedState(userId).update((collections) => {
      if (collections == null) {
        collections = [];
      }
      ids.forEach((i) => {
        if (collections?.length) {
          collections = collections.filter((c) => c.id != i) ?? [];
        }
      });
      return collections;
    });
  }

  async encrypt(model: CollectionView, userId: UserId): Promise<Collection> {
    if (model.organizationId == null) {
      throw new Error("Collection has no organization id.");
    }

    const key = await firstValueFrom(
      this.keyService.orgKeys$(userId).pipe(
        filter((orgKeys) => !!orgKeys),
        map((k) => k[model.organizationId as OrganizationId]),
      ),
    );

    const collection = new Collection();
    collection.id = model.id;
    collection.organizationId = model.organizationId;
    collection.readOnly = model.readOnly;
    collection.externalId = model.externalId;
    collection.name = await this.encryptService.encryptString(model.name, key);
    return collection;
  }

  // TODO: this should be private.
  // See https://bitwarden.atlassian.net/browse/PM-12375
  decryptMany$(
    collections: Collection[] | null,
    orgKeys: Record<OrganizationId, OrgKey>,
  ): Observable<CollectionView[]> {
    if (collections === null || collections.length == 0 || orgKeys === null) {
      return of([]);
    }

    const decCollections: Observable<CollectionView>[] = [];

    collections.forEach((collection) => {
      decCollections.push(
        from(collection.decrypt(orgKeys[collection.organizationId as OrganizationId])),
      );
    });

    return combineLatest(decCollections).pipe(
      map((collections) => collections.sort(Utils.getSortFunction(this.i18nService, "name"))),
    );
  }

  getAllNested(collections: CollectionView[]): TreeNode<CollectionView>[] {
    const nodes: TreeNode<CollectionView>[] = [];
    collections.forEach((c) => {
      const collectionCopy = new CollectionView();
      collectionCopy.id = c.id;
      collectionCopy.organizationId = c.organizationId;
      const parts = c.name != null ? c.name.replace(/^\/+|\/+$/g, "").split(NestingDelimiter) : [];
      ServiceUtils.nestedTraverse(nodes, 0, parts, collectionCopy, undefined, NestingDelimiter);
    });
    return nodes;
  }

  /**
   * @deprecated August 30 2022: Moved to new Vault Filter Service
   * Remove when Desktop and Browser are updated
   */
  getNested(collections: CollectionView[], id: string): TreeNode<CollectionView> {
    const nestedCollections = this.getAllNested(collections);
    return ServiceUtils.getTreeNodeObjectFromList(
      nestedCollections,
      id,
    ) as TreeNode<CollectionView>;
  }

  /**
   * Sets the decrypted collections state for a user.
   * @param collections the decrypted collections
   * @param userId the user id
   */
  private async setDecryptedCollections(
    collections: CollectionView[],
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider.setUserState(DECRYPTED_COLLECTION_DATA_KEY, collections, userId);
  }
}
