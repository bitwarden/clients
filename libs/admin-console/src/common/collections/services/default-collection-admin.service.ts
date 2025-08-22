import { combineLatest, firstValueFrom, from, map, Observable, of, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
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

  collectionAdminViews$(organizationId: string, userId: UserId): Observable<CollectionAdminView[]> {
    return combineLatest([
      this.keyService.orgKeys$(userId),
      from(this.apiService.getManyCollectionsWithAccessDetails(organizationId)),
    ]).pipe(
      switchMap(([orgKeys, res]) => {
        if (res?.data == null || res.data.length === 0) {
          return of([]);
        }
        if (orgKeys == null) {
          throw new Error("No org keys found.");
        }

        return this.decryptMany(organizationId, res.data, orgKeys);
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
      if (isCollectionAccessDetailsResponse(c)) {
        return CollectionAdminView.fromCollectionAccessDetails(
          c,
          this.encryptService,
          orgKeys[organizationId as OrganizationId],
        );
      }

      return await CollectionAdminView.fromCollectionResponse(
        c,
        this.encryptService,
        orgKeys[organizationId as OrganizationId],
      );
    });

    return await Promise.all(promises);
  }

  private async encrypt(model: CollectionAdminView, userId: UserId): Promise<CollectionRequest> {
    if (!model.organizationId) {
      throw new Error("Collection has no organization id.");
    }

    const key = await firstValueFrom(
      this.keyService.orgKeys$(userId).pipe(
        map((orgKeys) => {
          if (!orgKeys) {
            throw new Error("No keys for the provided userId.");
          }

          const key = orgKeys[model.organizationId];

          if (key == null) {
            throw new Error("No key for this collection's organization.");
          }

          return key;
        }),
      ),
    );

    const groups = model.groups.map(
      (group) =>
        new SelectionReadOnlyRequest(group.id, group.readOnly, group.hidePasswords, group.manage),
    );

    const users = model.users.map(
      (user) =>
        new SelectionReadOnlyRequest(user.id, user.readOnly, user.hidePasswords, user.manage),
    );

    const collectionRequest = new CollectionRequest({
      name: await this.encryptService.encryptString(model.name, key),
      externalId: model.externalId,
      users,
      groups,
    });

    return collectionRequest;
  }
}

function isCollectionAccessDetailsResponse(
  response: CollectionResponse | CollectionAccessDetailsResponse,
): response is CollectionAccessDetailsResponse {
  const anyResponse = response as any;

  return anyResponse?.groups instanceof Array && anyResponse?.users instanceof Array;
}
