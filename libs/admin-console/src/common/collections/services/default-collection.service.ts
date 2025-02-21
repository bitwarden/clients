// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { combineLatest, firstValueFrom, map, Observable, of, switchMap } from "rxjs";
import { Jsonify } from "type-fest";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  ActiveUserState,
  StateProvider,
  COLLECTION_DATA,
  DeriveDefinition,
  DerivedState,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { KeyService } from "@bitwarden/key-management";

import { CollectionService } from "../abstractions";
import { Collection, CollectionData, CollectionView } from "../models";

export const ENCRYPTED_COLLECTION_DATA_KEY = UserKeyDefinition.record<CollectionData, CollectionId>(
  COLLECTION_DATA,
  "collections",
  {
    deserializer: (jsonData: Jsonify<CollectionData>) => CollectionData.fromJSON(jsonData),
    clearOn: ["logout"],
  },
);

const DECRYPTED_COLLECTION_DATA_KEY = new DeriveDefinition<
  [Record<CollectionId, CollectionData>, Record<OrganizationId, OrgKey>],
  CollectionView[],
  { collectionService: DefaultCollectionService }
>(COLLECTION_DATA, "decryptedCollections", {
  deserializer: (obj) => obj.map((collection) => CollectionView.fromJSON(collection)),
  derive: async ([collections, orgKeys], { collectionService }) => {
    if (collections == null) {
      return [];
    }

    const data = Object.values(collections).map((c) => new Collection(c));
    return await collectionService.decryptMany(data, orgKeys);
  },
});

const NestingDelimiter = "/";

export class DefaultCollectionService implements CollectionService {
  private encryptedCollectionDataState: ActiveUserState<Record<CollectionId, CollectionData>>;
  encryptedCollections$: Observable<Collection[]>;
  private decryptedCollectionDataState: DerivedState<CollectionView[]>;
  decryptedCollections$: Observable<CollectionView[]>;

  decryptedCollectionViews$(ids: CollectionId[]): Observable<CollectionView[]> {
    return this.decryptedCollections$.pipe(
      map((collections) => collections.filter((c) => ids.includes(c.id as CollectionId))),
    );
  }

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private i18nService: I18nService,
    protected stateProvider: StateProvider,
  ) {
    this.encryptedCollectionDataState = this.stateProvider.getActive(ENCRYPTED_COLLECTION_DATA_KEY);

    this.encryptedCollections$ = this.encryptedCollectionDataState.state$.pipe(
      map((collections) => {
        if (collections == null) {
          return [];
        }

        return Object.values(collections).map((c) => new Collection(c));
      }),
    );

    const encryptedCollectionsWithKeys = this.encryptedCollectionDataState.combinedState$.pipe(
      switchMap(([userId, collectionData]) =>
        combineLatest([of(collectionData), this.keyService.orgKeys$(userId)]),
      ),
    );

    this.decryptedCollectionDataState = this.stateProvider.getDerived(
      encryptedCollectionsWithKeys,
      DECRYPTED_COLLECTION_DATA_KEY,
      { collectionService: this },
    );

    this.decryptedCollections$ = this.decryptedCollectionDataState.state$;
  }

  async clearActiveUserCache(): Promise<void> {
    await this.decryptedCollectionDataState.forceValue(null);
  }

  async encrypt(model: CollectionView): Promise<Collection> {
    if (model.organizationId == null) {
      throw new Error("Collection has no organization id.");
    }
    const key = await this.keyService.getOrgKey(model.organizationId);
    if (key == null) {
      throw new Error("No key for this collection's organization.");
    }
    const collection = new Collection();
    collection.id = model.id;
    collection.organizationId = model.organizationId;
    collection.readOnly = model.readOnly;
    collection.externalId = model.externalId;
    collection.name = await this.encryptService.encrypt(model.name, key);
    return collection;
  }

  // TODO: this should be private and orgKeys should be required.
  // See https://bitwarden.atlassian.net/browse/PM-12375
  async decryptMany(
    collections: Collection[],
    orgKeys?: Record<OrganizationId, OrgKey>,
  ): Promise<CollectionView[]> {
    if (collections == null || collections.length === 0) {
      return [];
    }
    const decCollections: CollectionView[] = [];

    orgKeys ??= await firstValueFrom(this.keyService.activeUserOrgKeys$);

    const promises: Promise<any>[] = [];
    collections.forEach((collection) => {
      promises.push(
        collection
          .decrypt(orgKeys[collection.organizationId as OrganizationId])
          .then((c) => decCollections.push(c)),
      );
    });
    await Promise.all(promises);
    return decCollections.sort(Utils.getSortFunction(this.i18nService, "name"));
  }

  async get(id: string): Promise<Collection> {
    return (
      (await firstValueFrom(
        this.encryptedCollections$.pipe(map((cs) => cs.find((c) => c.id === id))),
      )) ?? null
    );
  }

  async getAll(): Promise<Collection[]> {
    return await firstValueFrom(this.encryptedCollections$);
  }

  async getAllDecrypted(): Promise<CollectionView[]> {
    return await firstValueFrom(this.decryptedCollections$);
  }

  async getAllNested(collections: CollectionView[] = null): Promise<TreeNode<CollectionView>[]> {
    if (collections == null) {
      collections = await this.getAllDecrypted();
    }
    const nodes: TreeNode<CollectionView>[] = [];
    collections.forEach((c) => {
      const collectionCopy = new CollectionView();
      collectionCopy.id = c.id;
      collectionCopy.organizationId = c.organizationId;
      const parts = c.name != null ? c.name.replace(/^\/+|\/+$/g, "").split(NestingDelimiter) : [];
      ServiceUtils.nestedTraverse(nodes, 0, parts, collectionCopy, null, NestingDelimiter);
    });
    return nodes;
  }

  /**
   * @deprecated August 30 2022: Moved to new Vault Filter Service
   * Remove when Desktop and Browser are updated
   */
  async getNested(id: string): Promise<TreeNode<CollectionView>> {
    const collections = await this.getAllNested();
    return ServiceUtils.getTreeNodeObjectFromList(collections, id) as TreeNode<CollectionView>;
  }

  async upsert(toUpdate: CollectionData | CollectionData[]): Promise<void> {
    if (toUpdate == null) {
      return;
    }
    await this.encryptedCollectionDataState.update((collections) => {
      if (collections == null) {
        collections = {};
      }
      if (Array.isArray(toUpdate)) {
        toUpdate.forEach((c) => {
          collections[c.id] = c;
        });
      } else {
        collections[toUpdate.id] = toUpdate;
      }
      return collections;
    });
  }

  async replace(collections: Record<CollectionId, CollectionData>, userId: UserId): Promise<void> {
    await this.stateProvider
      .getUser(userId, ENCRYPTED_COLLECTION_DATA_KEY)
      .update(() => collections);
  }

  async clear(userId?: UserId): Promise<void> {
    if (userId == null) {
      await this.encryptedCollectionDataState.update(() => null);
      await this.decryptedCollectionDataState.forceValue(null);
    } else {
      await this.stateProvider.getUser(userId, ENCRYPTED_COLLECTION_DATA_KEY).update(() => null);
    }
  }

  async delete(id: CollectionId | CollectionId[]): Promise<any> {
    await this.encryptedCollectionDataState.update((collections) => {
      if (collections == null) {
        collections = {};
      }
      if (typeof id === "string") {
        delete collections[id];
      } else {
        (id as CollectionId[]).forEach((i) => {
          delete collections[i];
        });
      }
      return collections;
    });
  }
}
