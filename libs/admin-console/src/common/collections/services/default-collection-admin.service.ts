import {
  catchError,
  combineLatest,
  concatMap,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  switchMap,
} from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionAccessSelectionView,
  CollectionAdminView,
  CollectionAccessDetailsResponse,
  CollectionDetailsResponse,
  CollectionResponse,
  CollectionData,
} from "@bitwarden/common/admin-console/models/collections";
import { Collection } from "@bitwarden/common/admin-console/models/collections/collection";
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { DecryptCollectionListResult } from "@bitwarden/sdk-internal";

import { CollectionAdminService, CollectionService } from "../abstractions";
import {
  BulkCollectionAccessRequest,
  BaseCollectionRequest,
  UpdateCollectionRequest,
  CreateCollectionRequest,
} from "../models";

export class DefaultCollectionAdminService implements CollectionAdminService {
  constructor(
    private apiService: ApiService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
    private sdkService: SdkService,
    private configService: ConfigService,
    private logService: LogService,
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

        return this.decryptMany(organizationId, userId, res.data, orgKeys);
      }),
    );
  }

  async update(
    collection: CollectionAdminView,
    userId: UserId,
  ): Promise<CollectionDetailsResponse> {
    const request = await this.encrypt(collection, userId, true);
    if (!BaseCollectionRequest.isUpdate(request)) {
      throw new Error("Cannot update collection with CreateCollectionRequest.");
    }

    const response = await this.apiService.putCollection(
      collection.organizationId,
      collection.id,
      request,
    );

    await this.updateLocalCollections(response, userId);

    return response;
  }

  async create(
    collection: CollectionAdminView,
    userId: UserId,
  ): Promise<CollectionDetailsResponse> {
    const request = await this.encrypt(collection, userId, false);
    if (BaseCollectionRequest.isUpdate(request)) {
      throw new Error("Cannot create collection with UpdateCollectionRequest.");
    }

    const response = await this.apiService.postCollection(collection.organizationId, request);
    collection.id = response.id;

    await this.updateLocalCollections(response, userId);

    return response;
  }

  async delete(organizationId: string, collectionId: string): Promise<void> {
    await this.apiService.deleteCollection(organizationId, collectionId);
  }

  private async updateLocalCollections(response: CollectionAccessDetailsResponse, userId: UserId) {
    response.assigned
      ? await this.collectionService.upsert(new CollectionData(response), userId)
      : await this.collectionService.delete([response.id as CollectionId], userId);
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
    userId: UserId,
    collections: CollectionResponse[] | CollectionAccessDetailsResponse[],
    orgKeys: Record<OrganizationId, OrgKey>,
  ): Promise<CollectionAdminView[]> {
    if (collections.length > 0 && collections.every(isCollectionAccessDetailsResponse)) {
      const bulkDecryptEnabled = await this.configService.getFeatureFlag(
        FeatureFlag.CollectionAdminBulkDecrypt,
      );

      if (bulkDecryptEnabled) {
        return this.decryptManyBulk(collections as CollectionAccessDetailsResponse[], userId);
      }
    }

    return this.decryptManyOriginal(organizationId, collections, orgKeys);
  }

  /**
   * Original implementation: decrypts each collection's name individually via `EncryptService`,
   * one at a time. A collection that fails to decrypt is shown with a placeholder name rather
   * than being dropped, since admins still need to see, manage, and delete it.
   */
  private async decryptManyOriginal(
    organizationId: string,
    collections: CollectionResponse[] | CollectionAccessDetailsResponse[],
    orgKeys: Record<OrganizationId, OrgKey>,
  ): Promise<CollectionAdminView[]> {
    const startTime = performance.now();

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

    const views = await Promise.all(promises);

    this.logService.measure(
      startTime,
      "Admin Console",
      "DefaultCollectionAdminService",
      "decryptMany (original, one at a time)",
      [
        ["Items", collections.length],
        ["Successes", views.length],
      ],
    );

    return views;
  }

  /**
   * Batched implementation using the SDK's `decrypt_list_with_failures`, which parallelizes
   * decryption of the whole list for better performance on large lists. Gated behind
   * {@link FeatureFlag.CollectionAdminBulkDecrypt} until this path has proven out in production.
   *
   * Unlike the personal-vault decryption path, a collection that fails to decrypt is never
   * silently dropped here: it's shown with a placeholder name so admins can still see, manage,
   * and delete it from the Admin Console.
   */
  private async decryptManyBulk(
    collections: CollectionAccessDetailsResponse[],
    userId: UserId,
  ): Promise<CollectionAdminView[]> {
    const startTime = performance.now();

    const responseMap = new Map<string, CollectionAccessDetailsResponse>();
    const sdkCollections = collections.map((c) => {
      if (responseMap.has(c.id)) {
        // See the analogous check in DefaultCollectionEncryptionService.decryptManyWithFailures:
        // decrypted views are re-associated with their source response by id below, so a
        // duplicate id would make that re-association ambiguous. Fail closed instead of guessing.
        throw new Error(`Duplicate collection id passed to decryptMany: ${c.id}`);
      }
      responseMap.set(c.id, c);

      const collection = new Collection({
        id: c.id as CollectionId,
        name: new EncString(c.name),
        organizationId: c.organizationId,
      });
      collection.externalId = c.externalId;
      collection.readOnly = c.readOnly;
      collection.hidePasswords = c.hidePasswords;
      collection.manage = c.manage;
      collection.type = c.type;
      collection.defaultUserCollectionEmail = c.defaultUserCollectionEmail;

      return collection.toSdkCollection();
    });

    const views = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();

          const result: DecryptCollectionListResult = ref.value
            .vault()
            .collections()
            .decrypt_list_with_failures(sdkCollections);

          const successViews = result.successes
            .map((sdkView) => {
              const id = sdkView.id ? uuidAsString(sdkView.id) : "";
              const source = responseMap.get(id);
              if (!source) {
                return null;
              }
              return CollectionAdminView.fromSdkCollectionViewWithAccessDetails(sdkView, source);
            })
            .filter((v): v is CollectionAdminView => v !== null);

          const failureViews = result.failures
            .map((sdkCollection) => {
              const id = sdkCollection.id ? uuidAsString(sdkCollection.id) : "";
              const source = responseMap.get(id);
              this.logService.error(`Failed to decrypt collection ${id}`);
              return source
                ? CollectionAdminView.fromCollectionAccessDetailsDecryptionFailure(source)
                : null;
            })
            .filter((v): v is CollectionAdminView => v !== null);

          return [...successViews, ...failureViews];
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to decrypt collections in batch: ${error}`);
          throw error;
        }),
      ),
    );

    this.logService.measure(
      startTime,
      "Admin Console",
      "DefaultCollectionAdminService",
      "decryptMany (bulk, decrypt_list_with_failures)",
      [
        ["Items", collections.length],
        ["Successes", views.length],
      ],
    );

    return views;
  }

  private async encrypt(
    model: CollectionAdminView,
    userId: UserId,
    editMode: boolean,
  ): Promise<UpdateCollectionRequest | CreateCollectionRequest> {
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

    if (editMode) {
      const org = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(model.organizationId)),
      );
      if (org == null) {
        throw new Error("No Organization found.");
      }
      return new UpdateCollectionRequest({
        name: model.canEditName(org)
          ? await this.encryptService.encryptString(model.name, key)
          : null,
        externalId: model.externalId,
        users,
        groups,
      });
    }

    return new CreateCollectionRequest({
      name: await this.encryptService.encryptString(model.name, key),
      externalId: model.externalId,
      users,
      groups,
    });
  }
}

function isCollectionAccessDetailsResponse(
  response: CollectionResponse | CollectionAccessDetailsResponse,
): response is CollectionAccessDetailsResponse {
  const anyResponse = response as any;

  return anyResponse?.groups instanceof Array && anyResponse?.users instanceof Array;
}
