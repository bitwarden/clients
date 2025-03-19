// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { combineLatest, filter, firstValueFrom, map } from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider, DerivedState } from "@bitwarden/common/platform/state";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { KeyService } from "@bitwarden/key-management";

import { vNextCollectionService } from "../abstractions/vnext-collection.service";
import { Collection, CollectionData, CollectionView } from "../models";

import {
  DECRYPTED_COLLECTION_DATA_KEY,
  ENCRYPTED_COLLECTION_DATA_KEY,
} from "./vnext-collection.state";

const NestingDelimiter = "/";

export class DefaultvNextCollectionService implements vNextCollectionService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private i18nService: I18nService,
    protected stateProvider: StateProvider,
  ) {}

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
    return this.decryptedState(userId).state$.pipe(map((collections) => collections ?? []));
  }

  async upsert(toUpdate: CollectionData | CollectionData[], userId: UserId): Promise<void> {
    if (toUpdate == null) {
      return;
    }
    await this.encryptedState(userId).update((collections) => {
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
    await this.encryptedState(userId).update(() => collections);
  }

  async clearDecryptedState(userId: UserId): Promise<void> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }

    await this.decryptedState(userId).forceValue([]);
  }

  async clear(userId: UserId): Promise<void> {
    await this.encryptedState(userId).update(() => null);
    // This will propagate from the encrypted state update, but by doing it explicitly
    // the promise doesn't resolve until the update is complete.
    await this.decryptedState(userId).forceValue([]);
  }

  async delete(id: CollectionId | CollectionId[], userId: UserId): Promise<any> {
    await this.encryptedState(userId).update((collections) => {
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
    orgKeys?: Record<OrganizationId, OrgKey> | null,
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
   * @returns a SingleUserState for encrypted collection data.
   */
  private encryptedState(userId: UserId) {
    return this.stateProvider.getUser(userId, ENCRYPTED_COLLECTION_DATA_KEY);
  }

  /**
   * @returns a SingleUserState for decrypted collection data.
   */
  private decryptedState(userId: UserId): DerivedState<CollectionView[]> {
    const encryptedCollectionsWithKeys$ = combineLatest([
      this.encryptedCollections$(userId),
      // orgKeys$ can emit null during brief moments on unlock and lock/logout, we want to ignore those intermediate states
      this.keyService.orgKeys$(userId).pipe(filter((orgKeys) => orgKeys != null)),
    ]);

    return this.stateProvider.getDerived(
      encryptedCollectionsWithKeys$,
      DECRYPTED_COLLECTION_DATA_KEY,
      {
        collectionService: this,
      },
    );
  }
}
