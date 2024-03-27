import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CollectionData } from "@bitwarden/common/vault/models/data/collection.data";
import { CollectionRequest } from "@bitwarden/common/vault/models/request/collection.request";
import {
  CollectionAccessDetailsResponse,
  CollectionDetailsResponse,
  CollectionResponse,
} from "@bitwarden/common/vault/models/response/collection.response";

import { CollectionAccessSelectionView } from "../../admin-console/organizations/core";

import { BulkCollectionAccessRequest } from "./bulk-collection-access.request";
import { CollectionAdminView } from "./views/collection-admin.view";

@Injectable()
export class CollectionAdminService {
  constructor(
    private apiService: ApiService,
    private cryptoService: CryptoService,
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

  async save(collection: CollectionAdminView): Promise<CollectionDetailsResponse> {
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
      await this.collectionService.upsert(new CollectionData(response));
    } else {
      await this.collectionService.delete(collection.id);
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
    const orgKey = await this.cryptoService.getOrgKey(organizationId);

    const promises = collections.map(async (c) => {
      const view = new CollectionAdminView();
      view.id = c.id;
      view.name = await this.cryptoService.decryptToUtf8(new EncString(c.name), orgKey);
      view.externalId = c.externalId;
      view.organizationId = c.organizationId;

      if (isCollectionAccessDetailsResponse(c)) {
        view.groups = c.groups;
        view.users = c.users;
        view.assigned = c.assigned;
        view.readOnly = c.readOnly;
        view.hidePasswords = c.hidePasswords;
        view.manage = c.manage;
      }

      return view;
    });

    return await Promise.all(promises);
  }

  private async encrypt(model: CollectionAdminView): Promise<CollectionRequest> {
    if (model.organizationId == null) {
      throw new Error("Collection has no organization id.");
    }
    const key = await this.cryptoService.getOrgKey(model.organizationId);
    if (key == null) {
      throw new Error("No key for this collection's organization.");
    }
    const collection = new CollectionRequest();
    collection.externalId = model.externalId;
    collection.name = (await this.cryptoService.encrypt(model.name, key)).encryptedString;
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
