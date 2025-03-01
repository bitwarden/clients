import { mock } from "jest-mock-extended";
import { BehaviorSubject, map, of } from "rxjs";

import { CipherDecryptionKeys, KeyService } from "@bitwarden/key-management";

import { FakeAccountService, mockAccountServiceWith } from "../../../spec/fake-account-service";
import { FakeStateProvider } from "../../../spec/fake-state-provider";
import { makeStaticByteArray } from "../../../spec/utils";
import { ApiService } from "../../abstractions/api.service";
import { SearchService } from "../../abstractions/search.service";
import { AutofillSettingsService } from "../../autofill/services/autofill-settings.service";
import { DomainSettingsService } from "../../autofill/services/domain-settings.service";
import { BulkEncryptService } from "../../key-management/crypto/abstractions/bulk-encrypt.service";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { UriMatchStrategy } from "../../models/domain/domain-service";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Utils } from "../../platform/misc/utils";
import { EncArrayBuffer } from "../../platform/models/domain/enc-array-buffer";
import { EncString } from "../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { ContainerService } from "../../platform/services/container.service";
import { CipherId, UserId } from "../../types/guid";
import { CipherKey, OrgKey, UserKey } from "../../types/key";
import { CipherFileUploadService } from "../abstractions/file-upload/cipher-file-upload.service";
import { FieldType } from "../enums";
import { CipherRepromptType } from "../enums/cipher-reprompt-type";
import { CipherType } from "../enums/cipher-type";
import { CipherData } from "../models/data/cipher.data";
import { Cipher } from "../models/domain/cipher";
import { CipherCreateRequest } from "../models/request/cipher-create.request";
import { CipherPartialRequest } from "../models/request/cipher-partial.request";
import { CipherRequest } from "../models/request/cipher.request";
import { CipherView } from "../models/view/cipher.view";
import { LoginUriView } from "../models/view/login-uri.view";

import { CipherService } from "./cipher.service";

const ENCRYPTED_TEXT = "This data has been encrypted";
function encryptText(clearText: string | Uint8Array) {
  return Promise.resolve(new EncString(`${clearText} has been encrypted`));
}
const ENCRYPTED_BYTES = mock<EncArrayBuffer>();

const cipherData: CipherData = {
  id: "id",
  organizationId: "orgId",
  folderId: "folderId",
  edit: true,
  viewPassword: true,
  organizationUseTotp: true,
  favorite: false,
  revisionDate: "2022-01-31T12:00:00.000Z",
  type: CipherType.Login,
  name: "EncryptedString",
  notes: "EncryptedString",
  creationDate: "2022-01-01T12:00:00.000Z",
  deletedDate: null,
  key: "EncKey",
  reprompt: CipherRepromptType.None,
  login: {
    uris: [
      { uri: "EncryptedString", uriChecksum: "EncryptedString", match: UriMatchStrategy.Domain },
    ],
    username: "EncryptedString",
    password: "EncryptedString",
    passwordRevisionDate: "2022-01-31T12:00:00.000Z",
    totp: "EncryptedString",
    autofillOnPageLoad: false,
  },
  passwordHistory: [{ password: "EncryptedString", lastUsedDate: "2022-01-31T12:00:00.000Z" }],
  attachments: [
    {
      id: "a1",
      url: "url",
      size: "1100",
      sizeName: "1.1 KB",
      fileName: "file",
      key: "EncKey",
    },
    {
      id: "a2",
      url: "url",
      size: "1100",
      sizeName: "1.1 KB",
      fileName: "file",
      key: "EncKey",
    },
  ],
  fields: [
    {
      name: "EncryptedString",
      value: "EncryptedString",
      type: FieldType.Text,
      linkedId: null,
    },
    {
      name: "EncryptedString",
      value: "EncryptedString",
      type: FieldType.Hidden,
      linkedId: null,
    },
  ],
};
const mockUserId = Utils.newGuid() as UserId;
let accountService: FakeAccountService;

describe("Cipher Service", () => {
  const keyService = mock<KeyService>();
  const stateService = mock<StateService>();
  const autofillSettingsService = mock<AutofillSettingsService>();
  const domainSettingsService = mock<DomainSettingsService>();
  const apiService = mock<ApiService>();
  const cipherFileUploadService = mock<CipherFileUploadService>();
  const i18nService = mock<I18nService>();
  const searchService = mock<SearchService>();
  const encryptService = mock<EncryptService>();
  const bulkEncryptService = mock<BulkEncryptService>();
  const configService = mock<ConfigService>();
  accountService = mockAccountServiceWith(mockUserId);
  const stateProvider = new FakeStateProvider(accountService);

  const userId = "TestUserId" as UserId;

  let cipherService: CipherService;
  let cipherObj: Cipher;

  beforeEach(() => {
    encryptService.encryptToBytes.mockReturnValue(Promise.resolve(ENCRYPTED_BYTES));
    encryptService.encrypt.mockReturnValue(Promise.resolve(new EncString(ENCRYPTED_TEXT)));

    (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);

    cipherService = new CipherService(
      keyService,
      domainSettingsService,
      apiService,
      i18nService,
      searchService,
      stateService,
      autofillSettingsService,
      encryptService,
      bulkEncryptService,
      cipherFileUploadService,
      configService,
      stateProvider,
      accountService,
    );

    cipherObj = new Cipher(cipherData);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("saveAttachmentRawWithServer()", () => {
    it("should upload encrypted file contents with save attachments", async () => {
      const fileName = "filename";
      const fileData = new Uint8Array(10);
      keyService.getOrgKey.mockReturnValue(
        Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey),
      );
      keyService.makeDataEncKey.mockReturnValue(
        Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32))),
      );

      configService.checkServerMeetsVersionRequirement$.mockReturnValue(of(false));
      configService.getFeatureFlag.mockResolvedValue(false);

      const spy = jest.spyOn(cipherFileUploadService, "upload");

      await cipherService.saveAttachmentRawWithServer(new Cipher(), fileName, fileData, userId);

      expect(spy).toHaveBeenCalled();
    });
  });

  describe("createWithServer()", () => {
    it("should call apiService.postCipherAdmin when orgAdmin param is true and the cipher orgId != null", async () => {
      const spy = jest
        .spyOn(apiService, "postCipherAdmin")
        .mockImplementation(() => Promise.resolve<any>(cipherObj.toCipherData()));
      await cipherService.createWithServer(cipherObj, true);
      const expectedObj = new CipherCreateRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });

    it("should call apiService.postCipher when orgAdmin param is true and the cipher orgId is null", async () => {
      cipherObj.organizationId = null;
      const spy = jest
        .spyOn(apiService, "postCipher")
        .mockImplementation(() => Promise.resolve<any>(cipherObj.toCipherData()));
      await cipherService.createWithServer(cipherObj, true);
      const expectedObj = new CipherRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });

    it("should call apiService.postCipherCreate if collectionsIds != null", async () => {
      cipherObj.collectionIds = ["123"];
      const spy = jest
        .spyOn(apiService, "postCipherCreate")
        .mockImplementation(() => Promise.resolve<any>(cipherObj.toCipherData()));
      await cipherService.createWithServer(cipherObj);
      const expectedObj = new CipherCreateRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });

    it("should call apiService.postCipher when orgAdmin and collectionIds logic is false", async () => {
      const spy = jest
        .spyOn(apiService, "postCipher")
        .mockImplementation(() => Promise.resolve<any>(cipherObj.toCipherData()));
      await cipherService.createWithServer(cipherObj);
      const expectedObj = new CipherRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });
  });

  describe("updateWithServer()", () => {
    it("should call apiService.putCipherAdmin when orgAdmin param is true", async () => {
      const spy = jest
        .spyOn(apiService, "putCipherAdmin")
        .mockImplementation(() => Promise.resolve<any>(cipherObj.toCipherData()));
      await cipherService.updateWithServer(cipherObj, true);
      const expectedObj = new CipherRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(cipherObj.id, expectedObj);
    });

    it("should call apiService.putCipher if cipher.edit is true", async () => {
      cipherObj.edit = true;
      const spy = jest
        .spyOn(apiService, "putCipher")
        .mockImplementation(() => Promise.resolve<any>(cipherObj.toCipherData()));
      await cipherService.updateWithServer(cipherObj);
      const expectedObj = new CipherRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(cipherObj.id, expectedObj);
    });

    it("should call apiService.putPartialCipher when orgAdmin, and edit are false", async () => {
      cipherObj.edit = false;
      const spy = jest
        .spyOn(apiService, "putPartialCipher")
        .mockImplementation(() => Promise.resolve<any>(cipherObj.toCipherData()));
      await cipherService.updateWithServer(cipherObj);
      const expectedObj = new CipherPartialRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(cipherObj.id, expectedObj);
    });
  });

  describe("encrypt", () => {
    let cipherView: CipherView;

    beforeEach(() => {
      cipherView = new CipherView();
      cipherView.type = CipherType.Login;

      encryptService.decryptToBytes.mockReturnValue(Promise.resolve(makeStaticByteArray(64)));
      configService.checkServerMeetsVersionRequirement$.mockReturnValue(of(true));
      keyService.makeCipherKey.mockReturnValue(
        Promise.resolve(new SymmetricCryptoKey(makeStaticByteArray(64)) as CipherKey),
      );
      encryptService.encrypt.mockImplementation(encryptText);

      jest.spyOn(cipherService as any, "getAutofillOnPageLoadDefault").mockResolvedValue(true);
    });

    describe("login encryption", () => {
      it("should add a uri hash to login uris", async () => {
        encryptService.hash.mockImplementation((value) => Promise.resolve(`${value} hash`));
        cipherView.login.uris = [
          { uri: "uri", match: UriMatchStrategy.RegularExpression } as LoginUriView,
        ];

        keyService.getOrgKey.mockReturnValue(
          Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey),
        );

        const domain = await cipherService.encrypt(cipherView, userId);

        expect(domain.login.uris).toEqual([
          {
            uri: new EncString("uri has been encrypted"),
            uriChecksum: new EncString("uri hash has been encrypted"),
            match: UriMatchStrategy.RegularExpression,
          },
        ]);
      });
    });

    describe("cipher.key", () => {
      it("is null when feature flag is false", async () => {
        configService.getFeatureFlag.mockResolvedValue(false);

        keyService.getOrgKey.mockReturnValue(
          Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey),
        );
        const cipher = await cipherService.encrypt(cipherView, userId);

        expect(cipher.key).toBeNull();
      });

      it("is defined when feature flag flag is true", async () => {
        configService.getFeatureFlag.mockResolvedValue(true);

        const cipher = await cipherService.encrypt(cipherView, userId);

        expect(cipher.key).toBeDefined();
      });
    });

    describe("encryptWithCipherKey", () => {
      beforeEach(() => {
        jest.spyOn<any, string>(cipherService, "encryptCipherWithCipherKey");
      });

      it("is not called when feature flag is false", async () => {
        configService.getFeatureFlag.mockResolvedValue(false);
        keyService.getOrgKey.mockReturnValue(
          Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey),
        );

        await cipherService.encrypt(cipherView, userId);

        expect(cipherService["encryptCipherWithCipherKey"]).not.toHaveBeenCalled();
      });

      it("is called when feature flag is true", async () => {
        configService.getFeatureFlag.mockResolvedValue(true);
        keyService.getOrgKey.mockReturnValue(
          Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey),
        );

        await cipherService.encrypt(cipherView, userId);

        expect(cipherService["encryptCipherWithCipherKey"]).toHaveBeenCalled();
      });
    });
  });

  describe("getRotatedData", () => {
    const originalUserKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
    const newUserKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
    let decryptedCiphers: BehaviorSubject<Record<CipherId, CipherView>>;
    let failedCiphers: BehaviorSubject<CipherView[]>;
    let encryptedKey: EncString;

    beforeEach(() => {
      configService.getFeatureFlag.mockResolvedValue(true);
      configService.checkServerMeetsVersionRequirement$.mockReturnValue(of(true));

      searchService.indexedEntityId$ = of(null);
      stateService.getUserId.mockResolvedValue(mockUserId);

      const keys = {
        userKey: originalUserKey,
      } as CipherDecryptionKeys;
      keyService.cipherDecryptionKeys$.mockReturnValue(of(keys));

      const cipher1 = new CipherView(cipherObj);
      cipher1.id = "Cipher 1";
      cipher1.organizationId = null;
      const cipher2 = new CipherView(cipherObj);
      cipher2.id = "Cipher 2";
      cipher2.organizationId = null;

      decryptedCiphers = new BehaviorSubject({
        Cipher1: cipher1,
        Cipher2: cipher2,
      });
      jest
        .spyOn(cipherService, "cipherViews$")
        .mockImplementation((userId: UserId) =>
          decryptedCiphers.pipe(map((ciphers) => Object.values(ciphers))),
        );

      failedCiphers = new BehaviorSubject<CipherView[]>([]);
      jest
        .spyOn(cipherService, "failedToDecryptCiphers$")
        .mockImplementation((userId: UserId) => failedCiphers);

      encryptService.decryptToBytes.mockResolvedValue(new Uint8Array(32));
      encryptedKey = new EncString("Re-encrypted Cipher Key");
      encryptService.encrypt.mockResolvedValue(encryptedKey);

      keyService.makeCipherKey.mockResolvedValue(
        new SymmetricCryptoKey(new Uint8Array(32)) as CipherKey,
      );
    });

    it("returns re-encrypted user ciphers", async () => {
      const result = await cipherService.getRotatedData(originalUserKey, newUserKey, mockUserId);

      expect(result[0]).toMatchObject({ id: "Cipher 1", key: "Re-encrypted Cipher Key" });
      expect(result[1]).toMatchObject({ id: "Cipher 2", key: "Re-encrypted Cipher Key" });
    });

    it("throws if the original user key is null", async () => {
      await expect(cipherService.getRotatedData(null, newUserKey, mockUserId)).rejects.toThrow(
        "Original user key is required to rotate ciphers",
      );
    });

    it("throws if the new user key is null", async () => {
      await expect(cipherService.getRotatedData(originalUserKey, null, mockUserId)).rejects.toThrow(
        "New user key is required to rotate ciphers",
      );
    });

    it("throws if the user has any failed to decrypt ciphers", async () => {
      const badCipher = new CipherView(cipherObj);
      badCipher.id = "Cipher 3";
      badCipher.organizationId = null;
      badCipher.decryptionFailure = true;
      failedCiphers.next([badCipher]);
      await expect(
        cipherService.getRotatedData(originalUserKey, newUserKey, mockUserId),
      ).rejects.toThrow("Cannot rotate ciphers when decryption failures are present");
    });
  });
});
