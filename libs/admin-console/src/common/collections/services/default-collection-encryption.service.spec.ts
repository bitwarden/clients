import { of } from "rxjs";

import {
  Collection,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  Collection as SdkCollection,
  CollectionView as SdkCollectionView,
  DecryptCollectionListResult,
} from "@bitwarden/sdk-internal";

import { DefaultCollectionEncryptionService } from "./default-collection-encryption.service";

const userId = "59fbbb44-8cc8-4279-ab40-afc5f68704f4" as UserId;
const collectionId = "bdc4ef23-1116-477e-ae73-247854af58cb" as CollectionId;
const collectionId2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as CollectionId;
const orgId = "c5e9654f-6cc5-44c4-8e09-3d323522668c" as OrganizationId;

const stubSdkCollection: SdkCollection = {
  id: collectionId as any,
  organizationId: orgId as any,
  name: "2.stub|stub|stub" as any,
  externalId: undefined,
  hidePasswords: false,
  readOnly: false,
  manage: false,
  defaultUserCollectionEmail: undefined,
  type: CollectionTypes.SharedCollection,
};

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  const c = new Collection({
    id: collectionId,
    organizationId: orgId,
    name: new EncString("2.abc123|def456==|ghi789=="),
  });
  return Object.assign(c, overrides);
}

function makeSdkCollectionView(overrides: Partial<SdkCollectionView> = {}): SdkCollectionView {
  return {
    id: collectionId as any,
    organizationId: orgId as any,
    name: "Decrypted Name",
    externalId: undefined,
    hidePasswords: false,
    readOnly: false,
    manage: true,
    type: CollectionTypes.SharedCollection,
    ...overrides,
  };
}

function makeResult(
  successes: SdkCollectionView[],
  failures: SdkCollection[] = [],
): DecryptCollectionListResult {
  return { successes, failures };
}

describe("DefaultCollectionEncryptionService", () => {
  let service: DefaultCollectionEncryptionService;

  const logService = {
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  } as unknown as LogService;
  const sdkService = { userClient$: jest.fn() } as unknown as SdkService;
  const configService = { getFeatureFlag: jest.fn() } as unknown as ConfigService;

  let mockDecrypt: jest.Mock;
  let mockDecryptListWithFailures: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDecrypt = jest.fn();
    mockDecryptListWithFailures = jest.fn();

    const mockCollectionsClient = {
      decrypt: mockDecrypt,
      decrypt_list_with_failures: mockDecryptListWithFailures,
      encrypt: jest.fn(),
      encrypt_list: jest.fn(),
      get_collection_tree: jest.fn(),
    };
    const mockRef = {
      value: {
        vault: jest.fn().mockReturnValue({
          collections: jest.fn().mockReturnValue(mockCollectionsClient),
        }),
      },
      [Symbol.dispose]: jest.fn(),
    };
    const mockSdk = { take: jest.fn().mockReturnValue(mockRef) };

    (sdkService.userClient$ as jest.Mock).mockReturnValue(of(mockSdk));
    service = new DefaultCollectionEncryptionService(sdkService, logService, configService);
  });

  describe("decryptManyWithFailures", () => {
    it("checks the CollectionBulkDecryptWithFailures feature flag", async () => {
      (configService.getFeatureFlag as jest.Mock).mockResolvedValue(false);
      mockDecrypt.mockReturnValue(makeSdkCollectionView());

      await service.decryptManyWithFailures([makeCollection()], userId);

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.CollectionBulkDecryptWithFailures,
      );
    });
  });

  describe("when CollectionBulkDecryptWithFailures is enabled", () => {
    beforeEach(() => {
      (configService.getFeatureFlag as jest.Mock).mockResolvedValue(true);
    });

    describe("decrypt", () => {
      it("decrypts a single collection and maps the result", async () => {
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

        const sdkView = makeSdkCollectionView({ name: "Decrypted Name" });
        mockDecryptListWithFailures.mockReturnValue(makeResult([sdkView]));

        const result = await service.decrypt(collection, userId);

        expect(mockDecryptListWithFailures).toHaveBeenCalledWith([stubSdkCollection]);
        expect(mockDecrypt).not.toHaveBeenCalled();
        expect(result).toBeInstanceOf(CollectionView);
        expect(result.name).toBe("Decrypted Name");
      });

      it("logs the error and rejects when the SDK throws", async () => {
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
        mockDecryptListWithFailures.mockImplementation(() => {
          throw new Error("crypto failure");
        });

        await expect(service.decrypt(collection, userId)).rejects.toThrow();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });

      it("logs the error and rejects when the SDK client is unavailable", async () => {
        (sdkService.userClient$ as jest.Mock).mockReturnValue(of(null));
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

        await expect(service.decrypt(collection, userId)).rejects.toThrow();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });
    });

    describe("decryptMany", () => {
      it("returns an empty array without calling the SDK for empty input", async () => {
        const result = await service.decryptMany([], userId);
        expect(result).toEqual([]);
        expect(mockDecryptListWithFailures).not.toHaveBeenCalled();
      });

      it("decrypts all collections and returns views", async () => {
        const collection1 = makeCollection();
        const collection2 = makeCollection({ id: collectionId2 });
        jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
        jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

        mockDecryptListWithFailures.mockReturnValue(
          makeResult([
            makeSdkCollectionView({ id: collectionId2 as any, name: "Collection 2" }),
            makeSdkCollectionView({ id: collectionId as any, name: "Collection 1" }),
          ]),
        );

        const result = await service.decryptMany([collection1, collection2], userId);

        expect(result).toHaveLength(2);
        expect(result.map((v) => v.name)).toEqual(
          expect.arrayContaining(["Collection 1", "Collection 2"]),
        );
      });

      it("returns failures separately without dropping successes", async () => {
        const collection1 = makeCollection();
        const collection2 = makeCollection({ id: collectionId2 });
        jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
        jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

        const failedSdkCollection: SdkCollection = {
          ...stubSdkCollection,
          id: collectionId as any,
        };
        mockDecryptListWithFailures.mockReturnValue(
          makeResult(
            [makeSdkCollectionView({ id: collectionId2 as any, name: "Collection 2" })],
            [failedSdkCollection],
          ),
        );

        const [views, failures] = await service.decryptManyWithFailures(
          [collection1, collection2],
          userId,
        );

        expect(views).toHaveLength(1);
        expect(views[0].name).toBe("Collection 2");
        expect(failures).toHaveLength(1);
        expect(failures[0].id).toBe(collectionId);
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining(`Failed to decrypt collection ${collectionId}`),
        );
      });

      it("preserves defaultUserCollectionEmail from the source collection", async () => {
        const email = "offboarded@example.com";
        const collection = makeCollection({
          defaultUserCollectionEmail: email,
          type: CollectionTypes.DefaultUserCollection,
        });
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
        mockDecryptListWithFailures.mockReturnValue(
          makeResult([makeSdkCollectionView({ type: CollectionTypes.DefaultUserCollection })]),
        );

        const [result] = await service.decryptMany([collection], userId);

        expect(result.defaultUserCollectionEmail).toBe(email);
      });

      it("fails closed instead of mismatching security-sensitive metadata when input ids collide", async () => {
        // Regression test: `defaultUserCollectionEmail` (which gates CollectionView.canEditName())
        // is re-attached to decrypted views by looking up the source Collection by id. If two
        // input collections shared an id, the wrong source (and its permissions/email) could get
        // paired with a decrypted view. This must throw rather than silently mismatch.
        const collection1 = makeCollection({
          defaultUserCollectionEmail: "offboarded@example.com",
          type: CollectionTypes.DefaultUserCollection,
        });
        const collection2 = makeCollection({
          // same id as collection1, but no defaultUserCollectionEmail
          type: CollectionTypes.SharedCollection,
        });
        jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
        jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

        await expect(service.decryptMany([collection1, collection2], userId)).rejects.toThrow(
          /Duplicate collection id/,
        );
        expect(mockDecryptListWithFailures).not.toHaveBeenCalled();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });

      it("logs the error and rejects when the SDK client is unavailable", async () => {
        (sdkService.userClient$ as jest.Mock).mockReturnValue(of(null));
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

        await expect(service.decryptMany([collection], userId)).rejects.toThrow();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });
    });
  });

  describe("when CollectionBulkDecryptWithFailures is disabled", () => {
    beforeEach(() => {
      (configService.getFeatureFlag as jest.Mock).mockResolvedValue(false);
    });

    describe("decrypt", () => {
      it("decrypts a single collection using the original per-item SDK call", async () => {
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
        mockDecrypt.mockReturnValue(makeSdkCollectionView({ name: "Decrypted Name" }));

        const result = await service.decrypt(collection, userId);

        expect(mockDecrypt).toHaveBeenCalledWith(stubSdkCollection);
        expect(mockDecryptListWithFailures).not.toHaveBeenCalled();
        expect(result).toBeInstanceOf(CollectionView);
        expect(result.name).toBe("Decrypted Name");
      });

      it("logs the error and rejects when the SDK client is unavailable", async () => {
        (sdkService.userClient$ as jest.Mock).mockReturnValue(of(null));
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

        await expect(service.decrypt(collection, userId)).rejects.toThrow();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });
    });

    describe("decryptMany", () => {
      it("returns an empty array without calling the SDK for empty input", async () => {
        const result = await service.decryptMany([], userId);
        expect(result).toEqual([]);
        expect(mockDecrypt).not.toHaveBeenCalled();
      });

      it("decrypts all collections one at a time and returns views", async () => {
        const collection1 = makeCollection();
        const collection2 = makeCollection({ id: collectionId2 });
        jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
        jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

        mockDecrypt
          .mockReturnValueOnce(makeSdkCollectionView({ name: "Collection 1" }))
          .mockReturnValueOnce(makeSdkCollectionView({ name: "Collection 2" }));

        const result = await service.decryptMany([collection1, collection2], userId);

        expect(mockDecryptListWithFailures).not.toHaveBeenCalled();
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe("Collection 1");
        expect(result[1].name).toBe("Collection 2");
      });

      it("logs and returns a failure for an item that fails to decrypt, without dropping the rest", async () => {
        const collection1 = makeCollection();
        const collection2 = makeCollection({ id: collectionId2 });
        jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
        jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

        mockDecrypt
          .mockImplementationOnce(() => {
            throw new Error("key not found");
          })
          .mockReturnValueOnce(makeSdkCollectionView({ name: "Collection 2" }));

        const [views, failures] = await service.decryptManyWithFailures(
          [collection1, collection2],
          userId,
        );

        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining(`Failed to decrypt collection ${collection1.id}`),
        );
        expect(views).toHaveLength(1);
        expect(views[0].name).toBe("Collection 2");
        expect(failures).toHaveLength(1);
        expect(failures[0]).toBe(collection1);
      });

      it("preserves defaultUserCollectionEmail from the source collection", async () => {
        const email = "offboarded@example.com";
        const collection = makeCollection({
          defaultUserCollectionEmail: email,
          type: CollectionTypes.DefaultUserCollection,
        });
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
        mockDecrypt.mockReturnValue(
          makeSdkCollectionView({ type: CollectionTypes.DefaultUserCollection }),
        );

        const [result] = await service.decryptMany([collection], userId);

        expect(result.defaultUserCollectionEmail).toBe(email);
      });

      it("logs the error and rejects when the SDK client is unavailable", async () => {
        (sdkService.userClient$ as jest.Mock).mockReturnValue(of(null));
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

        await expect(service.decryptMany([collection], userId)).rejects.toThrow();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });
    });
  });
});
