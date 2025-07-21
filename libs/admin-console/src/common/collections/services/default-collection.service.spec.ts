import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
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

import {
  DefaultCollectionService,
  ENCRYPTED_COLLECTION_DATA_KEY,
} from "./default-collection.service";

describe("DefaultCollectionService", () => {
  afterEach(() => {
    delete (window as any).bitwardenContainerService;
  });

  describe("decryptedCollections$", () => {
    it("emits decrypted collections from state", async () => {
      // Arrange test collections
      const org1 = Utils.newGuid() as OrganizationId;
      const org2 = Utils.newGuid() as OrganizationId;

      const collection1 = collectionDataFactory(org1);
      const collection2 = collectionDataFactory(org2);

      // Arrange state provider
      const fakeStateProvider = mockStateProvider();
      await fakeStateProvider.setUserState(ENCRYPTED_COLLECTION_DATA_KEY, {
        [collection1.id]: collection1,
        [collection2.id]: collection2,
      });

      // Arrange cryptoService - orgKeys and mock decryption
      const cryptoService = mockCryptoService();
      cryptoService.orgKeys$.mockReturnValue(
        of({
          [org1]: makeSymmetricCryptoKey<OrgKey>(),
          [org2]: makeSymmetricCryptoKey<OrgKey>(),
        }),
      );

      const collectionService = new DefaultCollectionService(
        cryptoService,
        mock<EncryptService>(),
        mockI18nService(),
        fakeStateProvider,
      );

      const result = await firstValueFrom(collectionService.decryptedCollections$);
      expect(result.length).toBe(2);
      expect(result[0]).toMatchObject({
        id: collection1.id,
        name: "DECRYPTED_STRING",
      });
      expect(result[1]).toMatchObject({
        id: collection2.id,
        name: "DECRYPTED_STRING",
      });
    });

    it("handles null collection state", async () => {
      // Arrange test collections
      const org1 = Utils.newGuid() as OrganizationId;
      const org2 = Utils.newGuid() as OrganizationId;

      // Arrange state provider
      const fakeStateProvider = mockStateProvider();
      await fakeStateProvider.setUserState(ENCRYPTED_COLLECTION_DATA_KEY, null);

      // Arrange cryptoService - orgKeys and mock decryption
      const cryptoService = mockCryptoService();
      cryptoService.orgKeys$.mockReturnValue(
        of({
          [org1]: makeSymmetricCryptoKey<OrgKey>(),
          [org2]: makeSymmetricCryptoKey<OrgKey>(),
        }),
      );

      const collectionService = new DefaultCollectionService(
        cryptoService,
        mock<EncryptService>(),
        mockI18nService(),
        fakeStateProvider,
      );

      const decryptedCollections = await firstValueFrom(collectionService.decryptedCollections$);
      expect(decryptedCollections.length).toBe(0);

      const encryptedCollections = await firstValueFrom(collectionService.encryptedCollections$);
      expect(encryptedCollections.length).toBe(0);
    });
  });
});

const mockI18nService = () => {
  const i18nService = mock<I18nService>();
  i18nService.collator = null; // this is a mock only, avoid use of this object
  return i18nService;
};

const mockStateProvider = () => {
  const userId = Utils.newGuid() as UserId;
  return new FakeStateProvider(mockAccountServiceWith(userId));
};

const mockCryptoService = () => {
  const keyService = mock<KeyService>();
  const encryptService = mock<EncryptService>();
  encryptService.decryptString
    .calledWith(expect.any(EncString), expect.anything())
    .mockResolvedValue("DECRYPTED_STRING");

  (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);

  return keyService;
};

const collectionDataFactory = (orgId: OrganizationId) => {
  const collection = new CollectionData({} as any);
  collection.id = Utils.newGuid() as CollectionId;
  collection.organizationId = orgId;
  collection.name = makeEncString("ENC_STRING").encryptedString;

  return collection;
};
