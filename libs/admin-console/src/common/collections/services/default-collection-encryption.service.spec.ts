import { of } from "rxjs";

import {
  Collection,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  Collection as SdkCollection,
  CollectionView as SdkCollectionView,
} from "@bitwarden/sdk-internal";

import { DefaultCollectionEncryptionService } from "./default-collection-encryption.service";

const userId = "59fbbb44-8cc8-4279-ab40-afc5f68704f4" as UserId;
const collectionId = "bdc4ef23-1116-477e-ae73-247854af58cb" as CollectionId;
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
  type: "SharedCollection",
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
    type: "SharedCollection",
    ...overrides,
  };
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

  let mockDecrypt: jest.Mock;
  let mockEncrypt: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDecrypt = jest.fn();
    mockEncrypt = jest.fn();

    const mockCollectionsClient = {
      decrypt: mockDecrypt,
      decrypt_list: jest.fn(),
      encrypt: mockEncrypt,
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
    service = new DefaultCollectionEncryptionService(sdkService, logService);
  });

  describe("decrypt", () => {
    it("decrypts a single collection and maps the result", async () => {
      const collection = makeCollection();
      jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

      const sdkView = makeSdkCollectionView({ name: "Decrypted Name" });
      mockDecrypt.mockReturnValue(sdkView);

      const result = await service.decrypt(collection, userId);

      expect(mockDecrypt).toHaveBeenCalledWith(stubSdkCollection);
      expect(result).toBeInstanceOf(CollectionView);
      expect(result.name).toBe("Decrypted Name");
    });

    it("logs the error and rejects when the SDK throws", async () => {
      const collection = makeCollection();
      jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
      mockDecrypt.mockImplementation(() => {
        throw new Error("crypto failure");
      });

      await expect(service.decrypt(collection, userId)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(expect.stringContaining("Failed to decrypt"));
    });

    it("logs the error and rejects when the SDK client is unavailable", async () => {
      (sdkService.userClient$ as jest.Mock).mockReturnValue(of(null));
      const collection = makeCollection();
      jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

      await expect(service.decrypt(collection, userId)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(expect.stringContaining("Failed to decrypt"));
    });
  });

  describe("decryptMany", () => {
    it("returns an empty array without calling the SDK for empty input", async () => {
      const result = await service.decryptMany([], userId);
      expect(result).toEqual([]);
      expect(mockDecrypt).not.toHaveBeenCalled();
    });

    it("decrypts all collections and returns views", async () => {
      const collection1 = makeCollection();
      const collection2 = makeCollection({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as CollectionId,
      });
      jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
      jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

      mockDecrypt
        .mockReturnValueOnce(makeSdkCollectionView({ name: "Collection 1" }))
        .mockReturnValueOnce(makeSdkCollectionView({ name: "Collection 2" }));

      const result = await service.decryptMany([collection1, collection2], userId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Collection 1");
      expect(result[1].name).toBe("Collection 2");
    });

    it("skips a failed item and continues decrypting the rest", async () => {
      const collection1 = makeCollection();
      const collection2 = makeCollection({
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as CollectionId,
      });
      jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
      jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

      mockDecrypt
        .mockImplementationOnce(() => {
          throw new Error("key not found");
        })
        .mockReturnValueOnce(makeSdkCollectionView({ name: "Collection 2" }));

      const result = await service.decryptMany([collection1, collection2], userId);

      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to decrypt collection ${collection1.id}`),
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Collection 2");
    });

    it("preserves defaultUserCollectionEmail from the source collection", async () => {
      const email = "offboarded@example.com";
      const collection = makeCollection({
        defaultUserCollectionEmail: email,
        type: CollectionTypes.DefaultUserCollection,
      });
      jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
      mockDecrypt.mockReturnValue(makeSdkCollectionView({ type: "DefaultUserCollection" }));

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

  describe("encrypt", () => {
    it("encrypts a collection view and maps the result to a Collection", async () => {
      const view = new CollectionView({
        id: collectionId,
        organizationId: orgId,
        name: "My Collection",
      });
      jest.spyOn(view, "toSdkCollectionView").mockReturnValue({} as SdkCollectionView);
      mockEncrypt.mockReturnValue(stubSdkCollection);

      const result = await service.encrypt(view, userId);

      expect(mockEncrypt).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Collection);
    });

    it("logs the error and rejects when the SDK throws during encrypt", async () => {
      const view = new CollectionView({
        id: collectionId,
        organizationId: orgId,
        name: "My Collection",
      });
      jest.spyOn(view, "toSdkCollectionView").mockReturnValue({} as SdkCollectionView);
      mockEncrypt.mockImplementation(() => {
        throw new Error("encrypt failure");
      });

      await expect(service.encrypt(view, userId)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(expect.stringContaining("Failed to encrypt"));
    });
  });
});
