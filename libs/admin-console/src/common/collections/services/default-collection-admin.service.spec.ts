import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  Collection,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections/collection-admin.view";
import {
  CollectionAccessDetailsResponse,
  CollectionResponse,
} from "@bitwarden/common/admin-console/models/collections/collection.response";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";

import { CollectionService } from "../abstractions";
import {
  CollectionDecryptionResult,
  CollectionEncryptionService,
} from "../abstractions/collection-encryption.service";

import { DefaultCollectionAdminService } from "./default-collection-admin.service";

const userId = "59fbbb44-8cc8-4279-ab40-afc5f68704f4" as UserId;
const orgId = "c5e9654f-6cc5-44c4-8e09-3d323522668c" as OrganizationId;
const collectionId1 = "bdc4ef23-1116-477e-ae73-247854af58cb";
const collectionId2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function makeAccessDetailsResponse(
  overrides: Partial<{
    id: string;
    name: string;
    externalId: string;
    assigned: boolean;
    unmanaged: boolean;
  }> = {},
): CollectionAccessDetailsResponse {
  return new CollectionAccessDetailsResponse({
    object: "collectionAccessDetails",
    id: overrides.id ?? collectionId1,
    organizationId: orgId,
    name: overrides.name ?? "2.abc123|def456==|ghi789==",
    externalId: overrides.externalId,
    readOnly: false,
    manage: true,
    hidePasswords: false,
    assigned: overrides.assigned ?? true,
    unmanaged: overrides.unmanaged ?? false,
    type: CollectionTypes.SharedCollection,
    groups: [],
    users: [],
  });
}

function makeCollectionView(id: string, overrides: Partial<CollectionView> = {}): CollectionView {
  const view = new CollectionView({
    id: id as any,
    organizationId: orgId,
    name: "Decrypted Name",
  });
  return Object.assign(view, overrides);
}

function makeResult(
  success: CollectionView[],
  failure: Collection[] = [],
): CollectionDecryptionResult {
  return { success, failure };
}

describe("DefaultCollectionAdminService", () => {
  let service: DefaultCollectionAdminService;

  let apiService: MockProxy<ApiService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let collectionService: MockProxy<CollectionService>;
  let organizationService: MockProxy<OrganizationService>;
  let collectionEncryptionService: MockProxy<CollectionEncryptionService>;
  let configService: MockProxy<ConfigService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    apiService = mock();
    keyService = mock();
    encryptService = mock();
    collectionService = mock();
    organizationService = mock();
    collectionEncryptionService = mock();
    configService = mock();
    logService = mock();

    keyService.orgKeys$.mockReturnValue(of({ [orgId]: {} as any }));

    service = new DefaultCollectionAdminService(
      apiService,
      keyService,
      encryptService,
      collectionService,
      organizationService,
      collectionEncryptionService,
      configService,
      logService,
    );
  });

  function mockApiResponse(collections: CollectionAccessDetailsResponse[]) {
    apiService.getManyCollectionsWithAccessDetails.mockResolvedValue(
      new ListResponse({ data: collections }, CollectionAccessDetailsResponse),
    );
  }

  describe("collectionAdminViews$", () => {
    it("checks the CollectionAdminBulkDecrypt feature flag", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));
      encryptService.decryptString.mockResolvedValue("Decrypted Name");
      mockApiResponse([makeAccessDetailsResponse()]);

      await firstValueFrom(service.collectionAdminViews$(orgId, userId));

      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.CollectionAdminBulkDecrypt,
      );
    });

    describe("when CollectionAdminBulkDecrypt is enabled", () => {
      beforeEach(() => {
        configService.getFeatureFlag$.mockReturnValue(of(true));
      });

      it("decrypts collections via CollectionEncryptionService", async () => {
        mockApiResponse([makeAccessDetailsResponse()]);
        collectionEncryptionService.decryptManyWithFailures.mockReturnValue(
          of(makeResult([makeCollectionView(collectionId1, { name: "Decrypted Name" })])),
        );

        const result = await firstValueFrom(service.collectionAdminViews$(orgId, userId));

        expect(collectionEncryptionService.decryptManyWithFailures).toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ id: collectionId1 })]),
          userId,
        );
        expect(encryptService.decryptString).not.toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Decrypted Name");
      });

      it("shows a placeholder view for a collection that fails to decrypt, without dropping it", async () => {
        const failing = makeAccessDetailsResponse({ id: collectionId1 });
        const succeeding = makeAccessDetailsResponse({ id: collectionId2 });
        mockApiResponse([failing, succeeding]);

        const failedCollection = new Collection({
          id: collectionId1 as any,
          organizationId: orgId,
          name: failing.name as any,
        });

        collectionEncryptionService.decryptManyWithFailures.mockReturnValue(
          of(
            makeResult(
              [makeCollectionView(collectionId2, { name: "Collection 2" })],
              [failedCollection],
            ),
          ),
        );

        const result = await firstValueFrom(service.collectionAdminViews$(orgId, userId));

        expect(result).toHaveLength(2);
        const failedView = result.find((v) => v.id === collectionId1);
        expect(failedView?.name).toBe("[error: cannot decrypt]");
      });
    });

    describe("when CollectionAdminBulkDecrypt is disabled", () => {
      beforeEach(() => {
        configService.getFeatureFlag$.mockReturnValue(of(false));
      });

      it("decrypts collections one at a time via EncryptService", async () => {
        mockApiResponse([makeAccessDetailsResponse()]);
        encryptService.decryptString.mockResolvedValue("Decrypted Name");

        const result = await firstValueFrom(service.collectionAdminViews$(orgId, userId));

        expect(collectionEncryptionService.decryptManyWithFailures).not.toHaveBeenCalled();
        expect(encryptService.decryptString).toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Decrypted Name");
      });

      it("still decrypts responses that carry no groups/users", async () => {
        // `ApiService` builds every element as a `CollectionAccessDetailsResponse`, whose
        // `groups`/`users` default to `[]`, so this shape does not occur on the current call
        // path. The cast below forces the plain `CollectionResponse` class to cover the
        // defensive `isCollectionAccessDetailsResponse` branch in `decryptManyV1`.
        apiService.getManyCollectionsWithAccessDetails.mockResolvedValue(
          new ListResponse(
            {
              data: [
                {
                  object: "collection",
                  id: collectionId1,
                  organizationId: orgId,
                  name: "2.abc123|def456==|ghi789==",
                },
              ],
            },
            CollectionResponse,
          ) as unknown as ListResponse<CollectionAccessDetailsResponse>,
        );
        encryptService.decryptString.mockResolvedValue("Decrypted Name");

        const fromResponse = jest.spyOn(CollectionAdminView, "fromCollectionResponse");
        const fromAccessDetails = jest.spyOn(CollectionAdminView, "fromCollectionAccessDetails");

        const result = await firstValueFrom(service.collectionAdminViews$(orgId, userId));

        // Both constructors yield the same name and an empty `groups`, so assert the branch
        // taken rather than the resulting shape.
        expect(fromResponse).toHaveBeenCalledTimes(1);
        expect(fromAccessDetails).not.toHaveBeenCalled();
        expect(collectionEncryptionService.decryptManyWithFailures).not.toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Decrypted Name");
      });
    });
  });
});
