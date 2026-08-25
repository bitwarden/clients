import {
  catchError,
  combineLatest,
  distinctUntilChanged,
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
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Collection } from "@bitwarden/common/admin-console/models/collections/collection";
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";

import { CollectionAdminService, CollectionService } from "../abstractions";
import { CollectionEncryptionService } from "../abstractions/collection-encryption.service";
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
    private collectionEncryptionService: CollectionEncryptionService,
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

  private decryptMany(
    organizationId: string,
    userId: UserId,
    collections: CollectionResponse[] | CollectionAccessDetailsResponse[],
    orgKeys: Record<OrganizationId, OrgKey>,
  ): Observable<CollectionAdminView[]> {
    if (collections.length > 0 && collections.every(isCollectionAccessDetailsResponse)) {
      return this.configService.getFeatureFlag$(FeatureFlag.CollectionAdminBulkDecrypt).pipe(
        distinctUntilChanged(),
        switchMap((bulkDecryptEnabled) =>
          bulkDecryptEnabled
            ? this.decryptManyV2(collections as CollectionAccessDetailsResponse[], userId)
            : from(this.decryptManyV1(organizationId, collections, orgKeys)),
        ),
      );
    }

    return from(this.decryptManyV1(organizationId, collections, orgKeys));
  }

  private async decryptManyV1(
    organizationId: string,
    collections: CollectionResponse[] | CollectionAccessDetailsResponse[],
    orgKeys: Record<OrganizationId, OrgKey>,
  ): Promise<CollectionAdminView[]> {
    return Promise.all(
      collections.map((c) =>
        isCollectionAccessDetailsResponse(c)
          ? CollectionAdminView.fromCollectionAccessDetails(
              c,
              this.encryptService,
              orgKeys[organizationId as OrganizationId],
            )
          : CollectionAdminView.fromCollectionResponse(
              c,
              this.encryptService,
              orgKeys[organizationId as OrganizationId],
            ),
      ),
    );
  }

  /**
   * V2 implementation: delegates to `CollectionEncryptionService` and wraps results into
   * `CollectionAdminView`s. Gated behind {@link FeatureFlag.CollectionAdminBulkDecrypt}.
   *
   * Both per-collection and batch-level failures are caught and rendered as placeholder views
   * so admins can still see and manage collections that failed to decrypt.
   */
  private decryptManyV2(
    collections: CollectionAccessDetailsResponse[],
    userId: UserId,
  ): Observable<CollectionAdminView[]> {
    const responseMap = new Map(collections.map((c) => [c.id, c]));
    const collectionsToDecrypt = collections.map((c) =>
      Collection.fromCollectionAccessDetailsResponse(c),
    );

    return this.collectionEncryptionService
      .decryptManyWithFailures(collectionsToDecrypt, userId)
      .pipe(
        map((result) => [
          ...this.mapDecryptedSuccesses(result.success, responseMap),
          ...this.mapDecryptedFailures(result.failure, responseMap),
        ]),
        catchError((e: unknown) => {
          this.logService.error("[DefaultCollectionAdminService] Batch decryption failed", e);
          return of(
            collections.map((c) =>
              CollectionAdminView.fromCollectionAccessDetailsDecryptionFailure(c),
            ),
          );
        }),
      );
  }

  private mapDecryptedSuccesses(
    views: CollectionView[],
    responseMap: Map<string, CollectionAccessDetailsResponse>,
  ): CollectionAdminView[] {
    return views
      .map((view) => {
        const source = responseMap.get(view.id);
        return source ? CollectionAdminView.fromCollectionView(view, source) : undefined;
      })
      .filter((v): v is CollectionAdminView => v !== undefined);
  }

  private mapDecryptedFailures(
    failures: Collection[],
    responseMap: Map<string, CollectionAccessDetailsResponse>,
  ): CollectionAdminView[] {
    return failures
      .map((failure) => {
        const source = responseMap.get(failure.id);
        return source
          ? CollectionAdminView.fromCollectionAccessDetailsDecryptionFailure(source)
          : undefined;
      })
      .filter((v): v is CollectionAdminView => v !== undefined);
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
