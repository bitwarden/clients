import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
} from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
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

  /**
   * @returns a SingleUserState for encrypted collection data.
   */
  private encryptedState(userId: UserId) {
    return this.stateProvider.getUser(userId, ENCRYPTED_COLLECTION_DATA_KEY);
  }

  /**
   * @returns a SingleUserState for decrypted collection data.
   */
  private decryptedState(userId: UserId) {
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
      tap(() => this.decryptedState(userId).update(() => null)),
    );
  }

  decryptedCollections$(userId: UserId): Observable<CollectionView[]> {
    return combineLatest([
      this.encryptedCollections$(userId),
      this.keyService.orgKeys$(userId).pipe(filter((orgKeys) => !!orgKeys)),
    ]).pipe(
      switchMap(([collections, orgKeys]) => this.decryptMany$(collections, orgKeys, userId)),
      shareReplay({ refCount: false, bufferSize: 1 }),
    );
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

    // Invalidate decrypted state
    await this.decryptedState(userId).update(() => null);
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
  private decryptMany$(
    collections: Collection[],
    orgKeys: Record<OrganizationId, OrgKey>,
    userId: UserId,
  ): Observable<CollectionView[]> {
    return this.decryptedState(userId).state$.pipe(
      switchMap((decState) => {
        // This wont tell us if the state is stale, so we now invalidate the state when encrytpedState$ has an emission.
        if (decState?.length) {
          return of(decState);
        }
        if (collections === null || collections.length === 0 || orgKeys === null) {
          return of([]);
        }

        const decCollections = collections.map((c) =>
          c.decrypt(orgKeys[c.organizationId as OrganizationId]),
        );

        return combineLatest(decCollections).pipe(
          map((collections) => collections.sort(Utils.getSortFunction(this.i18nService, "name"))),
          tap((decCollections) => this.setDecryptedCollections(decCollections, userId)),
        );
      }),
    );
  }

  decryptManyStateless(
    collections: Collection[],
    orgKeys: Record<OrganizationId, OrgKey>,
  ): Observable<CollectionView[]> {
    return of();
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
