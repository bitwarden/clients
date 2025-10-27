import { mock, MockProxy } from "jest-mock-extended";
import { combineLatest, first, firstValueFrom, of, ReplaySubject, takeWhile } from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import {
  FakeStateProvider,
  makeEncString,
  makeSymmetricCryptoKey,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { CollectionData, CollectionView } from "../models";

import { DECRYPTED_COLLECTION_DATA_KEY, ENCRYPTED_COLLECTION_DATA_KEY } from "./collection.state";
import { DefaultCollectionService } from "./default-collection.service";

describe("DefaultCollectionService", () => {
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let i18nService: MockProxy<I18nService>;
  let stateProvider: FakeStateProvider;

  let userId: UserId;

  let cryptoKeys: ReplaySubject<Record<OrganizationId, OrgKey> | null>;

  let collectionService: DefaultCollectionService;

  beforeEach(() => {
    userId = Utils.newGuid() as UserId;

    keyService = mock();
    encryptService = mock();
    i18nService = mock();
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));

    cryptoKeys = new ReplaySubject(1);
    keyService.orgKeys$.mockReturnValue(cryptoKeys);

    // Set up mock decryption
    encryptService.decryptString
      .calledWith(expect.any(EncString), expect.any(SymmetricCryptoKey))
      .mockImplementation((encString, key) =>
        Promise.resolve(encString.data.replace("ENC_", "DEC_")),
      );

    (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);

    // Arrange i18nService so that sorting algorithm doesn't throw
    i18nService.collator = null;

    collectionService = new DefaultCollectionService(
      keyService,
      encryptService,
      i18nService,
      stateProvider,
    );
  });

  afterEach(() => {
    delete (window as any).bitwardenContainerService;
  });

  describe("decryptedCollections$", () => {
    it("emits decrypted collections from state", async () => {
      // Arrange test data
      const org1 = Utils.newGuid() as OrganizationId;
      const orgKey1 = makeSymmetricCryptoKey<OrgKey>(64, 1);
      const collection1 = collectionDataFactory(org1);

      const org2 = Utils.newGuid() as OrganizationId;
      const orgKey2 = makeSymmetricCryptoKey<OrgKey>(64, 2);
      const collection2 = collectionDataFactory(org2);

      // Arrange dependencies
      await setEncryptedState([collection1, collection2]);
      cryptoKeys.next({
        [org1]: orgKey1,
        [org2]: orgKey2,
      });

      const result = await firstValueFrom(collectionService.decryptedCollections$(userId));

      // Assert emitted values
      expect(result.length).toBe(2);
      expect(result).toContainPartialObjects([
        {
          id: collection1.id,
          name: "DEC_NAME_" + collection1.id,
        },
        {
          id: collection2.id,
          name: "DEC_NAME_" + collection2.id,
        },
      ]);

      // Assert that the correct org keys were used for each encrypted string
      // This should be replaced with decryptString when the platform PR (https://github.com/bitwarden/clients/pull/14544) is merged
      expect(encryptService.decryptString).toHaveBeenCalledWith(
        expect.objectContaining(new EncString(collection1.name)),
        orgKey1,
      );
      expect(encryptService.decryptString).toHaveBeenCalledWith(
        expect.objectContaining(new EncString(collection2.name)),
        orgKey2,
      );
    });

    it("emits decrypted collections from in-memory state when available", async () => {
      // Arrange test data
      const org1 = Utils.newGuid() as OrganizationId;
      const collection1 = collectionViewDataFactory(org1);

      const org2 = Utils.newGuid() as OrganizationId;
      const collection2 = collectionViewDataFactory(org2);

      await setDecryptedState([collection1, collection2]);

      const result = await firstValueFrom(collectionService.decryptedCollections$(userId));

      // Assert emitted values
      expect(result.length).toBe(2);
      expect(result).toContainPartialObjects([
        {
          id: collection1.id,
          name: "DEC_NAME_" + collection1.id,
        },
        {
          id: collection2.id,
          name: "DEC_NAME_" + collection2.id,
        },
      ]);

      // Ensure that the returned data came from the in-memory state, rather than from decryption.
      expect(encryptService.decryptString).not.toHaveBeenCalled();
    });

    it("handles null collection state", async () => {
      // Arrange dependencies
      await setEncryptedState(null);
      cryptoKeys.next({});

      const encryptedCollections = await firstValueFrom(
        collectionService.encryptedCollections$(userId),
      );

      expect(encryptedCollections).toBe(null);
    });

    it("handles undefined orgKeys", (done) => {
      // Arrange test data
      const org1 = Utils.newGuid() as OrganizationId;
      const collection1 = collectionDataFactory(org1);

      const org2 = Utils.newGuid() as OrganizationId;
      const collection2 = collectionDataFactory(org2);

      // Emit a non-null value after the first undefined value has propagated
      // This will cause the collections to emit, calling done()
      cryptoKeys.pipe(first()).subscribe((val) => {
        cryptoKeys.next({});
      });

      collectionService
        .decryptedCollections$(userId)
        .pipe(takeWhile((val) => val.length != 2))
        .subscribe({ complete: () => done() });

      // Arrange dependencies
      void setEncryptedState([collection1, collection2]).then(() => {
        // Act: emit undefined
        cryptoKeys.next(undefined);
        keyService.orgKeys$ = of(undefined);
      });
    });

    it("Decrypts one time for multiple simultaneous callers", async () => {
      const decryptedMock: CollectionView[] = [{ id: "col1" }] as CollectionView[];
      const decryptManySpy = jest
        .spyOn(collectionService, "decryptMany$")
        .mockReturnValue(of(decryptedMock));

      jest
        .spyOn(collectionService as any, "encryptedCollections$")
        .mockReturnValue(of([{ id: "enc1" }]));
      jest.spyOn(keyService, "orgKeys$").mockReturnValue(of({ key: "fake-key" }));

      // Simulate multiple subscribers
      const obs1 = collectionService.decryptedCollections$(userId);
      const obs2 = collectionService.decryptedCollections$(userId);
      const obs3 = collectionService.decryptedCollections$(userId);

      await firstValueFrom(combineLatest([obs1, obs2, obs3]));

      // Expect decryptMany$ to be called only once
      expect(decryptManySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("encryptedCollections$", () => {
    it("emits encrypted collections from state", async () => {
      // Arrange test data
      const collection1 = collectionDataFactory();
      const collection2 = collectionDataFactory();

      // Arrange dependencies
      await setEncryptedState([collection1, collection2]);

      const result = await firstValueFrom(collectionService.encryptedCollections$(userId));

      expect(result!.length).toBe(2);
      expect(result).toContainPartialObjects([
        {
          id: collection1.id,
          name: makeEncString("ENC_NAME_" + collection1.id),
        },
        {
          id: collection2.id,
          name: makeEncString("ENC_NAME_" + collection2.id),
        },
      ]);
    });

    it("handles null collection state", async () => {
      await setEncryptedState(null);

      const decryptedCollections = await firstValueFrom(
        collectionService.encryptedCollections$(userId),
      );
      expect(decryptedCollections).toBe(null);
    });
  });

  describe("upsert", () => {
    it("upserts to existing collections", async () => {
      const org1 = Utils.newGuid() as OrganizationId;
      const orgKey1 = makeSymmetricCryptoKey<OrgKey>(64, 1);
      const collection1 = collectionDataFactory(org1);

      await setEncryptedState([collection1]);
      cryptoKeys.next({
        [collection1.organizationId]: orgKey1,
      });

      const updatedCollection1 = Object.assign(new CollectionData({} as any), collection1, {
        name: makeEncString("UPDATED_ENC_NAME_" + collection1.id).encryptedString,
      });

      await collectionService.upsert(updatedCollection1, userId);

      const encryptedResult = await firstValueFrom(collectionService.encryptedCollections$(userId));

      expect(encryptedResult!.length).toBe(1);
      expect(encryptedResult).toContainPartialObjects([
        {
          id: collection1.id,
          name: makeEncString("UPDATED_ENC_NAME_" + collection1.id),
        },
      ]);

      const decryptedResult = await firstValueFrom(collectionService.decryptedCollections$(userId));
      expect(decryptedResult.length).toBe(1);
      expect(decryptedResult).toContainPartialObjects([
        {
          id: collection1.id,
          name: "UPDATED_DEC_NAME_" + collection1.id,
        },
      ]);
    });

    it("upserts to a null state", async () => {
      const org1 = Utils.newGuid() as OrganizationId;
      const orgKey1 = makeSymmetricCryptoKey<OrgKey>(64, 1);
      const collection1 = collectionDataFactory(org1);

      cryptoKeys.next({
        [collection1.organizationId]: orgKey1,
      });

      await setEncryptedState(null);

      await collectionService.upsert(collection1, userId);

      const encryptedResult = await firstValueFrom(collectionService.encryptedCollections$(userId));
      expect(encryptedResult!.length).toBe(1);
      expect(encryptedResult).toContainPartialObjects([
        {
          id: collection1.id,
          name: makeEncString("ENC_NAME_" + collection1.id),
        },
      ]);

      const decryptedResult = await firstValueFrom(collectionService.decryptedCollections$(userId));
      expect(decryptedResult.length).toBe(1);
      expect(decryptedResult).toContainPartialObjects([
        {
          id: collection1.id,
          name: "DEC_NAME_" + collection1.id,
        },
      ]);
    });
  });

  describe("replace", () => {
    it("replaces all collections", async () => {
      await setEncryptedState([collectionDataFactory(), collectionDataFactory()]);

      const newCollection3 = collectionDataFactory();
      await collectionService.replace(
        {
          [newCollection3.id]: newCollection3,
        },
        userId,
      );

      const result = await firstValueFrom(collectionService.encryptedCollections$(userId));
      expect(result!.length).toBe(1);
      expect(result).toContainPartialObjects([
        {
          id: newCollection3.id,
          name: makeEncString("ENC_NAME_" + newCollection3.id),
        },
      ]);
    });
  });

  describe("delete", () => {
    it("deletes a collection", async () => {
      const collection1 = collectionDataFactory();
      const collection2 = collectionDataFactory();
      await setEncryptedState([collection1, collection2]);

      await collectionService.delete([collection1.id], userId);

      const result = await firstValueFrom(collectionService.encryptedCollections$(userId));
      expect(result!.length).toEqual(1);
      expect(result![0]).toMatchObject({ id: collection2.id });
    });

    it("deletes several collections", async () => {
      const collection1 = collectionDataFactory();
      const collection2 = collectionDataFactory();
      const collection3 = collectionDataFactory();
      await setEncryptedState([collection1, collection2, collection3]);

      await collectionService.delete([collection1.id, collection3.id], userId);

      const result = await firstValueFrom(collectionService.encryptedCollections$(userId));
      expect(result!.length).toEqual(1);
      expect(result![0]).toMatchObject({ id: collection2.id });
    });

    it("handles null collections", async () => {
      const collection1 = collectionDataFactory();
      await setEncryptedState(null);

      await collectionService.delete([collection1.id], userId);

      const result = await firstValueFrom(collectionService.encryptedCollections$(userId));
      expect(result!.length).toEqual(0);
    });
  });

  describe("groupByOrganization", () => {
    it("groups collections by organization", () => {
      const org1 = { organizationId: "org1" } as CollectionView;
      org1.name = "Collection 1";

      const org2 = { organizationId: "org1" } as CollectionView;
      org2.name = "Collection 2";
      const org3 = { organizationId: "org2" } as CollectionView;
      org3.name = "Collection 3";
      const collections = [org1, org2, org3];

      const result = collectionService.groupByOrganization(collections);

      expect(result.size).toBe(2);
      expect(result.get(org1.organizationId)?.length).toBe(2);
      expect(result.get(org1.organizationId)).toContainPartialObjects([org1, org2]);
      expect(result.get(org3.organizationId)?.length).toBe(1);
      expect(result.get(org3.organizationId)).toContainPartialObjects([org3]);
    });
  });

  const setEncryptedState = (collectionData: CollectionData[] | null) =>
    stateProvider.setUserState(
      ENCRYPTED_COLLECTION_DATA_KEY,
      collectionData == null ? null : Object.fromEntries(collectionData.map((c) => [c.id, c])),
      userId,
    );

  const setDecryptedState = (collectionViews: CollectionView[] | null) =>
    stateProvider.setUserState(DECRYPTED_COLLECTION_DATA_KEY, collectionViews, userId);
});

const collectionDataFactory = (orgId?: OrganizationId) => {
  const collection = new CollectionData({} as any);
  collection.id = Utils.newGuid() as CollectionId;
  collection.organizationId = orgId ?? (Utils.newGuid() as OrganizationId);
  collection.name = makeEncString("ENC_NAME_" + collection.id).encryptedString ?? "";

  return collection;
};

function collectionViewDataFactory(orgId?: OrganizationId): CollectionView {
  const id = Utils.newGuid() as CollectionId;
  const collectionView = new CollectionView({
    id,
    organizationId: orgId ?? (Utils.newGuid() as OrganizationId),
    name: "DEC_NAME_" + id,
  });
  return collectionView;
}
