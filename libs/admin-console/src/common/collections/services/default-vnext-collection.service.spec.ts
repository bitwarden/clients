import { mock, MockProxy } from "jest-mock-extended";
import { first, firstValueFrom, of, ReplaySubject, takeWhile } from "rxjs";

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

import { CollectionData } from "../models";

import { DefaultvNextCollectionService } from "./default-vnext-collection.service";
import { ENCRYPTED_COLLECTION_DATA_KEY } from "./vnext-collection.state";

describe("DefaultvNextCollectionService", () => {
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let i18nService: MockProxy<I18nService>;
  let stateProvider: FakeStateProvider;

  let userId: UserId;

  let cryptoKeys: ReplaySubject<Record<OrganizationId, OrgKey> | null>;

  let collectionService: DefaultvNextCollectionService;

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

    collectionService = new DefaultvNextCollectionService(
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

    it("handles null collection state", async () => {
      // Arrange dependencies
      await setEncryptedState(null);
      cryptoKeys.next({});

      const encryptedCollections = await firstValueFrom(
        collectionService.encryptedCollections$(userId),
      );

      expect(encryptedCollections.length).toBe(0);
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
        keyService.activeUserOrgKeys$ = of(undefined);
      });
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

      expect(result.length).toBe(2);
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
      expect(decryptedCollections.length).toBe(0);
    });
  });

  describe("upsert", () => {
    it("upserts to existing collections", async () => {
      const collection1 = collectionDataFactory();
      const collection2 = collectionDataFactory();

      await setEncryptedState([collection1, collection2]);

      const updatedCollection1 = Object.assign(new CollectionData({} as any), collection1, {
        name: makeEncString("UPDATED_ENC_NAME_" + collection1.id).encryptedString,
      });
      const newCollection3 = collectionDataFactory();

      await collectionService.upsert([updatedCollection1, newCollection3], userId);

      const result = await firstValueFrom(collectionService.encryptedCollections$(userId));
      expect(result.length).toBe(3);
      expect(result).toContainPartialObjects([
        {
          id: collection1.id,
          name: makeEncString("UPDATED_ENC_NAME_" + collection1.id),
        },
        {
          id: collection2.id,
          name: makeEncString("ENC_NAME_" + collection2.id),
        },
        {
          id: newCollection3.id,
          name: makeEncString("ENC_NAME_" + newCollection3.id),
        },
      ]);
    });

    it("upserts to a null state", async () => {
      const collection1 = collectionDataFactory();

      await setEncryptedState(null);

      await collectionService.upsert(collection1, userId);

      const result = await firstValueFrom(collectionService.encryptedCollections$(userId));
      expect(result.length).toBe(1);
      expect(result).toContainPartialObjects([
        {
          id: collection1.id,
          name: makeEncString("ENC_NAME_" + collection1.id),
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
      expect(result.length).toBe(1);
      expect(result).toContainPartialObjects([
        {
          id: newCollection3.id,
          name: makeEncString("ENC_NAME_" + newCollection3.id),
        },
      ]);
    });
  });

  it("clearDecryptedState", async () => {
    await setEncryptedState([collectionDataFactory(), collectionDataFactory()]);

    await collectionService.clearDecryptedState(userId);

    // Encrypted state remains
    const encryptedState = await firstValueFrom(collectionService.encryptedCollections$(userId));
    expect(encryptedState.length).toEqual(2);

    // Decrypted state is cleared
    const decryptedState = await firstValueFrom(collectionService.decryptedCollections$(userId));
    expect(decryptedState.length).toEqual(0);
  });

  it("clear", async () => {
    await setEncryptedState([collectionDataFactory(), collectionDataFactory()]);
    cryptoKeys.next({});

    await collectionService.clear(userId);

    // Encrypted state is cleared
    const encryptedState = await firstValueFrom(collectionService.encryptedCollections$(userId));
    expect(encryptedState.length).toEqual(0);

    // Decrypted state is cleared
    const decryptedState = await firstValueFrom(collectionService.decryptedCollections$(userId));
    expect(decryptedState.length).toEqual(0);
  });

  describe("delete", () => {
    it("deletes a collection", async () => {
      const collection1 = collectionDataFactory();
      const collection2 = collectionDataFactory();
      await setEncryptedState([collection1, collection2]);

      await collectionService.delete(collection1.id, userId);

      const result = await firstValueFrom(collectionService.encryptedCollections$(userId));
      expect(result.length).toEqual(1);
      expect(result[0]).toMatchObject({ id: collection2.id });
    });

    it("deletes several collections", async () => {
      const collection1 = collectionDataFactory();
      const collection2 = collectionDataFactory();
      const collection3 = collectionDataFactory();
      await setEncryptedState([collection1, collection2, collection3]);

      await collectionService.delete([collection1.id, collection3.id], userId);

      const result = await firstValueFrom(collectionService.encryptedCollections$(userId));
      expect(result.length).toEqual(1);
      expect(result[0]).toMatchObject({ id: collection2.id });
    });

    it("handles null collections", async () => {
      const collection1 = collectionDataFactory();
      await setEncryptedState(null);

      await collectionService.delete(collection1.id, userId);

      const result = await firstValueFrom(collectionService.encryptedCollections$(userId));
      expect(result.length).toEqual(0);
    });
  });

  const setEncryptedState = (collectionData: CollectionData[] | null) =>
    stateProvider.setUserState(
      ENCRYPTED_COLLECTION_DATA_KEY,
      collectionData == null ? null : Object.fromEntries(collectionData.map((c) => [c.id, c])),
      userId,
    );
});

const collectionDataFactory = (orgId?: OrganizationId) => {
  const collection = new CollectionData({} as any);
  collection.id = Utils.newGuid() as CollectionId;
  collection.organizationId = orgId ?? (Utils.newGuid() as OrganizationId);
  collection.name = makeEncString("ENC_NAME_" + collection.id).encryptedString;

  return collection;
};
