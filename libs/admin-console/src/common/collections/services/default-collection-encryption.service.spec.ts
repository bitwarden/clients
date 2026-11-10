import { firstValueFrom, of } from "rxjs";

import {
  Collection,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections/collection";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections/collection.view";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { DECRYPT_ERROR, EncString } from "@bitwarden/legacy-crypto";
import {
  Collection as SdkCollection,
  CollectionView as SdkCollectionView,
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

describe("DefaultCollectionEncryptionService", () => {
  let service: DefaultCollectionEncryptionService;

  const logService = {
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    write: jest.fn(),
    measure: jest.fn(),
    mark: jest.fn(),
  } as unknown as LogService;
  const sdkService = { userClient$: jest.fn() } as unknown as SdkService;
  const configService = {
    getFeatureFlag: jest.fn(),
    getFeatureFlag$: jest.fn(),
  } as unknown as ConfigService;

  let mockDecrypt: jest.Mock;
  let mockDecryptListWithFailures: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDecrypt = jest.fn();
    mockDecryptListWithFailures = jest.fn();

    const mockCollectionsClient = {
      decrypt: mockDecrypt,
      decrypt_list: jest.fn(),
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

  describe("when CollectionsDecryptListFailures is enabled", () => {
    beforeEach(() => {
      (configService.getFeatureFlag$ as jest.Mock).mockReturnValue(of(true));
    });

    describe("decryptMany", () => {
      it("checks the CollectionsDecryptListFailures feature flag", async () => {
        mockDecryptListWithFailures.mockReturnValue({
          successes: [makeSdkCollectionView()],
          failures: [],
        });

        await firstValueFrom(service.decryptMany([makeCollection()], userId));

        expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
          FeatureFlag.CollectionsDecryptListFailures,
        );
      });

      it("returns an empty array without calling the SDK for empty input", async () => {
        const result = await firstValueFrom(service.decryptMany([], userId));
        expect(result).toEqual([]);
        expect(mockDecryptListWithFailures).not.toHaveBeenCalled();
      });

      it("decrypts all collections via a single batch call and returns views", async () => {
        const collection1 = makeCollection();
        const collection2 = makeCollection({ id: collectionId2 });
        jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
        jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

        mockDecryptListWithFailures.mockReturnValue({
          successes: [
            makeSdkCollectionView({ id: collectionId as any, name: "Collection 1" }),
            makeSdkCollectionView({ id: collectionId2 as any, name: "Collection 2" }),
          ],
          failures: [],
        });

        const result = await firstValueFrom(
          service.decryptMany([collection1, collection2], userId),
        );

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe("Collection 1");
        expect(result[1].name).toBe("Collection 2");
      });

      it("logs and still returns a placeholder view for any collection the SDK returns as a failure", async () => {
        const collection1 = makeCollection();
        const collection2 = makeCollection({ id: collectionId2 });
        jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
        jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

        // SDK reports collection1 as a failure and returns only collection2.
        mockDecryptListWithFailures.mockReturnValue({
          successes: [makeSdkCollectionView({ id: collectionId2 as any, name: "Collection 2" })],
          failures: [{ id: collectionId as any }],
        });

        const result = await firstValueFrom(
          service.decryptMany([collection1, collection2], userId),
        );

        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining(`Failed to decrypt collection ${collection1.id}`),
        );

        expect(result).toHaveLength(2);
        const failedView = result.find((v) => v.id === collectionId)!;
        const successView = result.find((v) => v.id === collectionId2)!;
        expect(failedView.decryptionFailure).toBe(true);
        expect(failedView.name).toBe(DECRYPT_ERROR);
        expect(successView.decryptionFailure).toBe(false);
        expect(successView.name).toBe("Collection 2");
      });

      it("rejects when the batch SDK call throws", async () => {
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
        mockDecryptListWithFailures.mockImplementation(() => {
          throw new Error("batch failure");
        });

        await expect(firstValueFrom(service.decryptMany([collection], userId))).rejects.toThrow();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });

      it("preserves defaultUserCollectionEmail from the source collection", async () => {
        const email = "offboarded@example.com";
        const collection = makeCollection({
          defaultUserCollectionEmail: email,
          type: CollectionTypes.DefaultUserCollection,
        });
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
        mockDecryptListWithFailures.mockReturnValue({
          successes: [makeSdkCollectionView({ type: CollectionTypes.DefaultUserCollection })],
          failures: [],
        });

        const [result] = await firstValueFrom(service.decryptMany([collection], userId));

        expect(result.defaultUserCollectionEmail).toBe(email);
      });

      it("matches each decrypted view to its source collection by ID", async () => {
        const email = "offboarded@example.com";
        const collection1 = makeCollection({
          defaultUserCollectionEmail: email,
          type: CollectionTypes.DefaultUserCollection,
        });
        const collection2 = makeCollection({
          id: collectionId2,
          type: CollectionTypes.SharedCollection,
        });
        jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
        jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

        // Return views in reverse order to confirm ID-based matching, not index-based.
        mockDecryptListWithFailures.mockReturnValue({
          successes: [
            makeSdkCollectionView({
              id: collectionId2 as any,
              type: CollectionTypes.SharedCollection,
            }),
            makeSdkCollectionView({
              id: collectionId as any,
              type: CollectionTypes.DefaultUserCollection,
            }),
          ],
          failures: [],
        });

        const results = await firstValueFrom(
          service.decryptMany([collection1, collection2], userId),
        );

        const view1 = results.find((v) => v.id === collectionId);
        const view2 = results.find((v) => v.id === collectionId2);
        expect(view1?.defaultUserCollectionEmail).toBe(email);
        expect(view2?.defaultUserCollectionEmail).toBeUndefined();
      });

      // Pairing is by ID, so a view whose ID does not round-trip cannot be mapped back to its
      // source and drops out of the list - the one disappearance this path cannot represent.
      it("logs a decrypted view whose ID matches no source collection", async () => {
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
        mockDecryptListWithFailures.mockReturnValue({
          successes: [makeSdkCollectionView({ id: collectionId2 as any })],
          failures: [],
        });

        const results = await firstValueFrom(service.decryptMany([collection], userId));

        expect(results).toEqual([]);
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining(`Decrypted collection ${collectionId2} did not match`),
        );
      });

      it("logs the error and rejects when the SDK client is unavailable", async () => {
        (sdkService.userClient$ as jest.Mock).mockReturnValue(of(null));
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

        await expect(firstValueFrom(service.decryptMany([collection], userId))).rejects.toThrow();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });
    });

    describe("decrypt", () => {
      it("decrypts a single collection via the batch SDK call and maps the result", async () => {
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

        const sdkView = makeSdkCollectionView({ name: "Decrypted Name" });
        mockDecryptListWithFailures.mockReturnValue({ successes: [sdkView], failures: [] });

        const result = await firstValueFrom(service.decrypt(collection, userId));

        expect(mockDecryptListWithFailures).toHaveBeenCalledWith([stubSdkCollection]);
        expect(mockDecrypt).not.toHaveBeenCalled();
        expect(result).toBeInstanceOf(CollectionView);
        expect(result.name).toBe("Decrypted Name");
      });

      it("rejects when the batch call throws", async () => {
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
        mockDecryptListWithFailures.mockImplementation(() => {
          throw new Error("batch failure");
        });

        await expect(firstValueFrom(service.decrypt(collection, userId))).rejects.toThrow();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });

      it("logs the error and rejects when the SDK client is unavailable", async () => {
        (sdkService.userClient$ as jest.Mock).mockReturnValue(of(null));
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

        await expect(firstValueFrom(service.decrypt(collection, userId))).rejects.toThrow();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });
    });
  });

  describe("when CollectionsDecryptListFailures is disabled", () => {
    beforeEach(() => {
      (configService.getFeatureFlag$ as jest.Mock).mockReturnValue(of(false));
    });

    describe("decryptMany", () => {
      it("returns an empty array without calling the SDK for empty input", async () => {
        const result = await firstValueFrom(service.decryptMany([], userId));
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

        const result = await firstValueFrom(
          service.decryptMany([collection1, collection2], userId),
        );

        expect(mockDecryptListWithFailures).not.toHaveBeenCalled();
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe("Collection 1");
        expect(result[1].name).toBe("Collection 2");
      });

      it("logs and drops items that fail to decrypt without aborting the rest", async () => {
        const collection1 = makeCollection();
        const collection2 = makeCollection({ id: collectionId2 });
        jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
        jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

        mockDecrypt
          .mockImplementationOnce(() => {
            throw new Error("key not found");
          })
          .mockReturnValueOnce(makeSdkCollectionView({ name: "Collection 2" }));

        const result = await firstValueFrom(
          service.decryptMany([collection1, collection2], userId),
        );

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
        mockDecrypt.mockReturnValue(
          makeSdkCollectionView({ type: CollectionTypes.DefaultUserCollection }),
        );

        const [result] = await firstValueFrom(service.decryptMany([collection], userId));

        expect(result.defaultUserCollectionEmail).toBe(email);
      });

      it("logs the error and rejects when the SDK client is unavailable", async () => {
        (sdkService.userClient$ as jest.Mock).mockReturnValue(of(null));
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

        await expect(firstValueFrom(service.decryptMany([collection], userId))).rejects.toThrow();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });
    });

    describe("decrypt", () => {
      it("decrypts a single collection using the original per-item SDK call", async () => {
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
        mockDecrypt.mockReturnValue(makeSdkCollectionView({ name: "Decrypted Name" }));

        const result = await firstValueFrom(service.decrypt(collection, userId));

        expect(mockDecrypt).toHaveBeenCalledWith(stubSdkCollection);
        expect(mockDecryptListWithFailures).not.toHaveBeenCalled();
        expect(result).toBeInstanceOf(CollectionView);
        expect(result.name).toBe("Decrypted Name");
      });

      it("logs the error and rejects when the SDK client is unavailable", async () => {
        (sdkService.userClient$ as jest.Mock).mockReturnValue(of(null));
        const collection = makeCollection();
        jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);

        await expect(firstValueFrom(service.decrypt(collection, userId))).rejects.toThrow();
        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to decrypt collections in batch"),
        );
      });
    });
  });

  /**
   * The SDK bindings for these two calls are currently typed as synchronous, while the equivalent
   * cipher bindings return promises. Both call sites are awaited so the service behaves correctly
   * either way, and these specs pin that down: they hand the mocks a promise, which only produces
   * the right result if the `await` is present. Dropping either `await` makes the spec below fail
   * instead of silently returning an empty list.
   */
  describe("when the SDK bindings return promises", () => {
    it("awaits decrypt_list_with_failures and still separates successes from failures", async () => {
      (configService.getFeatureFlag$ as jest.Mock).mockReturnValue(of(true));

      const collection1 = makeCollection();
      const collection2 = makeCollection({ id: collectionId2 });
      jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
      jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

      mockDecryptListWithFailures.mockResolvedValue({
        successes: [makeSdkCollectionView({ id: collectionId2 as any, name: "Collection 2" })],
        failures: [{ id: collectionId as any }],
      });

      const result = await firstValueFrom(service.decryptMany([collection1, collection2], userId));

      expect(result).toHaveLength(2);
      expect(result.find((c) => c.id === collectionId2)?.name).toBe("Collection 2");
      expect(result.find((c) => c.id === collectionId)?.decryptionFailure).toBe(true);
    });

    it("awaits the per-item decrypt on the V1 path", async () => {
      (configService.getFeatureFlag$ as jest.Mock).mockReturnValue(of(false));

      const collection = makeCollection();
      jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
      mockDecrypt.mockResolvedValue(makeSdkCollectionView({ name: "Decrypted Name" }));

      const [result] = await firstValueFrom(service.decryptMany([collection], userId));

      expect(result).toBeInstanceOf(CollectionView);
      expect(result.name).toBe("Decrypted Name");
    });

    it("logs and drops an item whose per-item decrypt rejects, without aborting the rest", async () => {
      (configService.getFeatureFlag$ as jest.Mock).mockReturnValue(of(false));

      const collection1 = makeCollection();
      const collection2 = makeCollection({ id: collectionId2 });
      jest.spyOn(collection1, "toSdkCollection").mockReturnValue(stubSdkCollection);
      jest.spyOn(collection2, "toSdkCollection").mockReturnValue(stubSdkCollection);

      mockDecrypt
        .mockRejectedValueOnce(new Error("key not found"))
        .mockResolvedValueOnce(makeSdkCollectionView({ name: "Collection 2" }));

      const result = await firstValueFrom(service.decryptMany([collection1, collection2], userId));

      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to decrypt collection ${collection1.id}`),
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Collection 2");
    });

    it("rejects when a promise-returning decrypt_list_with_failures rejects", async () => {
      (configService.getFeatureFlag$ as jest.Mock).mockReturnValue(of(true));

      const collection = makeCollection();
      jest.spyOn(collection, "toSdkCollection").mockReturnValue(stubSdkCollection);
      mockDecryptListWithFailures.mockRejectedValue(new Error("batch failure"));

      await expect(firstValueFrom(service.decryptMany([collection], userId))).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to decrypt collections in batch"),
      );
    });
  });
});
