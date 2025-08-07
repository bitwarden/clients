// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { combineLatest, firstValueFrom, from, map, Observable, of, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { CollectionAdminService, CollectionService } from "../abstractions";
import {
  CollectionData,
  CollectionRequest,
  CollectionAccessDetailsResponse,
  CollectionDetailsResponse,
  CollectionResponse,
  BulkCollectionAccessRequest,
  CollectionAccessSelectionView,
  CollectionAdminView,
} from "../models";

export class DefaultCollectionAdminService implements CollectionAdminService {
  constructor(
    private apiService: ApiService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private collectionService: CollectionService,
  ) {}

  private orgKeyCache = new Map<UserId, Observable<Record<OrganizationId, OrgKey>>>();

  private orgKey$(userId: UserId): Observable<Record<OrganizationId, OrgKey>> {
    if (!this.orgKeyCache.get(userId)) {
      this.orgKeyCache.set(userId, this.keyService.orgKeys$(userId));
    }

    return this.orgKeyCache.get(userId);
  }

  collectionAdminViews$(organizationId: string, userId: UserId): Observable<CollectionAdminView[]> {
    return combineLatest([
      this.orgKey$(userId),
      from(this.apiService.getManyCollectionsWithAccessDetails(organizationId)),
    ]).pipe(
      switchMap(([orgKey, res]) => {
        if (res?.data == null || res.data.length === 0) {
          return of([]);
        }

        return this.decryptMany(organizationId, res.data, orgKey);
      }),
    );
  }

  async save(collection: CollectionAdminView, userId: UserId): Promise<CollectionDetailsResponse> {
    const request = await this.encrypt(collection, userId);

    let response: CollectionDetailsResponse;
    if (collection.id == null) {
      response = await this.apiService.postCollection(collection.organizationId, request);
      collection.id = response.id;
    } else {
      response = await this.apiService.putCollection(
        collection.organizationId,
        collection.id,
        request,
      );
    }

    if (response.assigned) {
      await this.collectionService.upsert(new CollectionData(response), userId);
    } else {
      await this.collectionService.delete([collection.id as CollectionId], userId);
    }

    return response;
  }

  async delete(organizationId: string, collectionId: string): Promise<void> {
    await this.apiService.deleteCollection(organizationId, collectionId);
  }

  async bulkAssignAccess(
    organizationId: string,
    collectionIds: string[],
    users: CollectionAccessSelectionView[],
    groups: CollectionAccessSelectionView[],
  ): Promise<void> {
    const request = new BulkCollectionAccessRequest();
    request.collectionIds = collectionIds;
    request.users = users.map(
      (u) => new SelectionReadOnlyRequest(u.id, u.readOnly, u.hidePasswords, u.manage),
    );
    request.groups = groups.map(
      (g) => new SelectionReadOnlyRequest(g.id, g.readOnly, g.hidePasswords, g.manage),
    );

    await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/collections/bulk-access`,
      request,
      true,
      false,
    );
  }

  private async decryptMany(
    organizationId: string,
    collections: CollectionResponse[] | CollectionAccessDetailsResponse[],
    orgKeys: Record<OrganizationId, OrgKey>,
  ): Promise<CollectionAdminView[]> {
    const promises = collections.map(async (c) => {
      const view = new CollectionAdminView();
      view.id = c.id;
      view.name = await this.encryptService.decryptString(
        new EncString(c.name),
        orgKeys[organizationId as OrganizationId],
      );
      view.externalId = c.externalId;
      view.organizationId = c.organizationId;

      if (isCollectionAccessDetailsResponse(c)) {
        view.groups = c.groups;
        view.users = c.users;
        view.assigned = c.assigned;
        view.readOnly = c.readOnly;
        view.hidePasswords = c.hidePasswords;
        view.manage = c.manage;
        view.unmanaged = c.unmanaged;
      }

      return view;
    });

    return await Promise.all(promises);
  }

  private async encrypt(model: CollectionAdminView, userId: UserId): Promise<CollectionRequest> {
    if (model.organizationId == null) {
      throw new Error("Collection has no organization id.");
    }
    const key = await firstValueFrom(
      this.orgKey$(userId).pipe(map((orgKeys) => orgKeys[model.organizationId] ?? null)),
    );
    if (key == null) {
      throw new Error("No key for this collection's organization.");
    }
    const collection = new CollectionRequest();
    collection.externalId = model.externalId;
    collection.name = (await this.encryptService.encryptString(model.name, key)).encryptedString;
    collection.groups = model.groups.map(
      (group) =>
        new SelectionReadOnlyRequest(group.id, group.readOnly, group.hidePasswords, group.manage),
    );
    collection.users = model.users.map(
      (user) =>
        new SelectionReadOnlyRequest(user.id, user.readOnly, user.hidePasswords, user.manage),
    );
    return collection;
  }
}

function isCollectionAccessDetailsResponse(
  response: CollectionResponse | CollectionAccessDetailsResponse,
): response is CollectionAccessDetailsResponse {
  const anyResponse = response as any;

  return anyResponse?.groups instanceof Array && anyResponse?.users instanceof Array;
}
