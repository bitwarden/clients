import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  Collection,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionAccessDetailsResponse } from "@bitwarden/common/admin-console/models/collections/collection.response";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

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

  const apiService = { getManyCollectionsWithAccessDetails: jest.fn() } as unknown as ApiService;
  const keyService = { orgKeys$: jest.fn() } as unknown as KeyService;
  const encryptService = { decryptString: jest.fn() } as unknown as EncryptService;
  const collectionService = {} as unknown as CollectionService;
  const organizationService = {} as unknown as OrganizationService;
  const collectionEncryptionService = {
    decryptManyWithFailures: jest.fn(),
  } as unknown as CollectionEncryptionService;
  const configService = {
    getFeatureFlag: jest.fn(),
    getFeatureFlag$: jest.fn(),
  } as unknown as ConfigService;
  const logService = {
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    write: jest.fn(),
    measure: jest.fn(),
    mark: jest.fn(),
  } as unknown as LogService;

  beforeEach(() => {
    jest.clearAllMocks();

    (keyService.orgKeys$ as jest.Mock).mockReturnValue(of({ [orgId]: {} as any }));

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
    (apiService.getManyCollectionsWithAccessDetails as jest.Mock).mockResolvedValue(
      new ListResponse({ data: collections }, CollectionAccessDetailsResponse),
    );
  }

  describe("collectionAdminViews$", () => {
    it("checks the CollectionAdminBulkDecrypt feature flag", async () => {
      (configService.getFeatureFlag$ as jest.Mock).mockReturnValue(of(false));
      (encryptService.decryptString as jest.Mock).mockResolvedValue("Decrypted Name");
      mockApiResponse([makeAccessDetailsResponse()]);

      await service.collectionAdminViews$(orgId, userId).toPromise();

      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.CollectionAdminBulkDecrypt,
      );
    });

    describe("when CollectionAdminBulkDecrypt is enabled", () => {
      beforeEach(() => {
        (configService.getFeatureFlag$ as jest.Mock).mockReturnValue(of(true));
      });

      it("decrypts collections via CollectionEncryptionService", async () => {
        mockApiResponse([makeAccessDetailsResponse()]);
        (collectionEncryptionService.decryptManyWithFailures as jest.Mock).mockReturnValue(
          of(makeResult([makeCollectionView(collectionId1, { name: "Decrypted Name" })])),
        );

        const result = await service.collectionAdminViews$(orgId, userId).toPromise();

        expect(collectionEncryptionService.decryptManyWithFailures).toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ id: collectionId1 })]),
          userId,
        );
        expect(encryptService.decryptString).not.toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result![0].name).toBe("Decrypted Name");
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

        (collectionEncryptionService.decryptManyWithFailures as jest.Mock).mockReturnValue(
          of(
            makeResult(
              [makeCollectionView(collectionId2, { name: "Collection 2" })],
              [failedCollection],
            ),
          ),
        );

        const result = await service.collectionAdminViews$(orgId, userId).toPromise();

        expect(result).toHaveLength(2);
        const failedView = result!.find((v) => v.id === collectionId1);
        expect(failedView?.name).toBe("[error: cannot decrypt]");
      });

      it("falls back to the original path when responses are not access-details responses", async () => {
        (apiService.getManyCollectionsWithAccessDetails as jest.Mock).mockResolvedValue(
          new ListResponse({ data: [] }, CollectionAccessDetailsResponse),
        );

        const result = await service.collectionAdminViews$(orgId, userId).toPromise();

        expect(result).toEqual([]);
      });
    });

    describe("when CollectionAdminBulkDecrypt is disabled", () => {
      beforeEach(() => {
        (configService.getFeatureFlag$ as jest.Mock).mockReturnValue(of(false));
      });

      it("decrypts collections one at a time via EncryptService", async () => {
        mockApiResponse([makeAccessDetailsResponse()]);
        (encryptService.decryptString as jest.Mock).mockResolvedValue("Decrypted Name");

        const result = await service.collectionAdminViews$(orgId, userId).toPromise();

        expect(collectionEncryptionService.decryptManyWithFailures).not.toHaveBeenCalled();
        expect(encryptService.decryptString).toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result![0].name).toBe("Decrypted Name");
      });
    });
  });
});
