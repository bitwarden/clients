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
  tap,
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
  /**
   * This is used to cache in-progress decryptions so that multiple simultaneous calls to collectionViews$
   * will not result in multiple duplicate decryptions. An observable is removed after decryption is complete and
   * decryptedState has been updated with the result.
   */
  private inProgressDecryptions = new Map<UserId, Observable<never>>();

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private i18nService: I18nService,
    protected stateProvider: StateProvider,
  ) {}

  /**
   * @returns a SingleUserState for encrypted collection data.
   */
  private encryptedState(userId: UserId) {
    return this.stateProvider.getUser(userId, ENCRYPTED_COLLECTION_DATA_KEY);
  }

  /**
   * @returns a SingleUserState for decrypted collection data.
   */
  private decryptedState(userId: UserId): SingleUserState<CollectionView[]> {
    return this.stateProvider.getUser(userId, DECRYPTED_COLLECTION_DATA_KEY);
  }

  encryptedCollections$(userId: UserId) {
    return this.encryptedState(userId).state$.pipe(
      map((collections) => {
        if (collections == null) {
          return [];
        }

        return Object.values(collections).map((c) => new Collection(c));
      }),
    );
  }

  decryptedCollections$(userId: UserId) {
    return this.decryptedState(userId).state$.pipe(
      switchMap((decryptedState) => {
        // If decrypted state is already populated, return that
        if (decryptedState?.length) {
          return of(decryptedState);
        }

        // If decrypted state is not populated but decryption is in progress,
        // return the observable that represents the decryption progress
        if (this.inProgressDecryptions.has(userId)) {
          return this.inProgressDecryptions.get(userId)!;
        }

        this.inProgressDecryptions.set(userId, this.initializeDecryptedState(userId));
        return this.inProgressDecryptions.get(userId)!;
      }),
    );
  }

  private initializeDecryptedState(userId: UserId) {
    return combineLatest([
      this.encryptedCollections$(userId),
      this.keyService.orgKeys$(userId).pipe(filter((orgKeys) => !!orgKeys)),
    ]).pipe(
      switchMap(([collections, orgKeys]) =>
        this.decryptMany$(collections, orgKeys).pipe(
          // delayWhen is basically used as an async tap here; wait for decryption to be finished
          delayWhen((collections) => this.setDecryptedCollections(collections, userId)),
          // once decrypted state has been set, we can remove ourselves from the internal map
          tap(() => this.inProgressDecryptions.delete(userId)),
        ),
      ),
      // setDecryptedCollections will trigger a new emission from decryptedState, which is ultimately what
      // the caller will receive as the first emission. Here we finish with NEVER so that this observable
      // never emits, and will be automatically unsubscribed by the outer switchMap when decryptedState emits.
      switchMap(() => NEVER),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  async upsert(toUpdate: CollectionData[], userId: UserId): Promise<void> {
    if (toUpdate == null) {
      return;
    }
    await this.encryptedState(userId).update((collections) => {
      if (collections == null) {
        collections = {};
      }
      toUpdate.forEach((c) => {
        collections[c.id] = c;
      });

      return collections;
    });

    const decryptedCollections = await firstValueFrom(
      this.keyService.orgKeys$(userId).pipe(
        filter((orgKeys) => !!orgKeys),
        switchMap((orgKeys) =>
          this.decryptMany$(
            toUpdate.map((c) => new Collection(c)),
            orgKeys,
          ),
        ),
      ),
    );

    await this.decryptedState(userId).update((collections) => {
      if (collections == null) {
        collections = [];
      }

      toUpdate.forEach((c) => {
        const decryptedCollection = decryptedCollections.find(
          (collection) => collection.id == c.id,
        );
        if (!decryptedCollection) {
          return;
        }

        const existingIndex = collections.findIndex((collection) => collection.id == c.id);
        if (existingIndex >= 0) {
          collections[existingIndex] = decryptedCollection;
        } else {
          collections.push(decryptedCollection);
        }
      });

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
    collections: Collection[],
    orgKeys: Record<OrganizationId, OrgKey>,
  ): Observable<CollectionView[]> {
    if (collections === null || collections.length === 0 || orgKeys === null) {
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
