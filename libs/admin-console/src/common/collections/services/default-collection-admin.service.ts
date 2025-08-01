import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";
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
  Collection,
} from "../models";

export class DefaultCollectionAdminService implements CollectionAdminService {
  constructor(
    private apiService: ApiService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private collectionService: CollectionService,
  ) {}

  async getAll(organizationId: string): Promise<CollectionAdminView[]> {
    const collectionResponse =
      await this.apiService.getManyCollectionsWithAccessDetails(organizationId);

    if (collectionResponse?.data == null || collectionResponse.data.length === 0) {
      return [];
    }

    return await this.decryptMany(organizationId, collectionResponse.data);
  }

  async get(
    organizationId: string,
    collectionId: string,
  ): Promise<CollectionAdminView | undefined> {
    const collectionResponse = await this.apiService.getCollectionAccessDetails(
      organizationId,
      collectionId,
    );

    if (collectionResponse == null) {
      return undefined;
    }

    const [view] = await this.decryptMany(organizationId, [collectionResponse]);

    return view;
  }

  async save(collection: CollectionAdminView, userId: UserId): Promise<CollectionDetailsResponse> {
    const request = await this.encrypt(collection);

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
  ): Promise<CollectionAdminView[]> {
    const orgKey = await this.keyService.getOrgKey(organizationId);
    if (!orgKey) {
      throw new Error("No key for this collection's organization.");
    }

    const promises = collections.map(async (c) => {
      const cdr = new CollectionAccessDetailsResponse({
        id: c.id,
        name: await this.encryptService.decryptString(new EncString(c.name), orgKey),
        externalId: c.externalId,
        organizationId: c.organizationId,
      });

      if (isCollectionAccessDetailsResponse(c)) {
        cdr.groups = c.groups;
        cdr.users = c.users;
        cdr.assigned = c.assigned;
        cdr.readOnly = c.readOnly;
        cdr.hidePasswords = c.hidePasswords;
        cdr.manage = c.manage;
        cdr.unmanaged = c.unmanaged;
      }

      return new CollectionAdminView(cdr);
    });

    return await Promise.all(promises);
  }

  private async encrypt(model: CollectionAdminView): Promise<CollectionRequest> {
    if (model.organizationId == null) {
      throw new Error("Collection has no organization id.");
    }

    const key = await this.keyService.getOrgKey(model.organizationId);
    if (key == null) {
      throw new Error("No key for this collection's organization.");
    }

    const collectionRequest = new CollectionRequest(
      new Collection({
        ...model,
        name: await this.encryptService.encryptString(model.name, key),
      }),
    );

    collectionRequest.groups = model.groups.map(
      (group) =>
        new SelectionReadOnlyRequest(group.id, group.readOnly, group.hidePasswords, group.manage),
    );

    collectionRequest.users = model.users.map(
      (user) =>
        new SelectionReadOnlyRequest(user.id, user.readOnly, user.hidePasswords, user.manage),
    );

    return collectionRequest;
  }
}

function isCollectionAccessDetailsResponse(
  response: CollectionResponse | CollectionAccessDetailsResponse,
): response is CollectionAccessDetailsResponse {
  const anyResponse = response as any;

  return anyResponse?.groups instanceof Array && anyResponse?.users instanceof Array;
}
