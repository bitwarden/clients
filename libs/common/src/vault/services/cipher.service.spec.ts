// eslint-disable-next-line no-restricted-imports
import { mock, mockReset } from "jest-mock-extended";

import { ApiService } from "../../abstractions/api.service";
import { SearchService } from "../../abstractions/search.service";
import { SettingsService } from "../../abstractions/settings.service";
import { UriMatchType, FieldType } from "../../enums";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { EncryptService } from "../../platform/abstractions/encrypt.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { StateService } from "../../platform/abstractions/state.service";
import { OrgKey, SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { CipherFileUploadService } from "../abstractions/file-upload/cipher-file-upload.service";
import { CipherRepromptType } from "../enums/cipher-reprompt-type";
import { CipherType } from "../enums/cipher-type";
import { CipherData } from "../models/data/cipher.data";
import { Cipher } from "../models/domain/cipher";
import { CipherCreateRequest } from "../models/request/cipher-create.request";
import { CipherPartialRequest } from "../models/request/cipher-partial.request";
import { CipherRequest } from "../models/request/cipher.request";

import { CipherService } from "./cipher.service";

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
  reprompt: CipherRepromptType.None,
  login: {
    uris: [{ uri: "EncryptedString", match: UriMatchType.Domain }],
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

describe("Cipher Service", () => {
  const cryptoService = mock<CryptoService>();
  const stateService = mock<StateService>();
  const settingsService = mock<SettingsService>();
  const apiService = mock<ApiService>();
  const cipherFileUploadService = mock<CipherFileUploadService>();
  const i18nService = mock<I18nService>();
  const searchService = mock<SearchService>();
  const encryptService = mock<EncryptService>();

  let cipherService: CipherService;
  let cipherObj: Cipher;

  beforeEach(() => {
    mockReset(apiService);
    mockReset(cryptoService);
    mockReset(stateService);
    mockReset(settingsService);
    mockReset(cipherFileUploadService);
    mockReset(i18nService);
    mockReset(searchService);
    mockReset(encryptService);

    cipherService = new CipherService(
      cryptoService,
      settingsService,
      apiService,
      i18nService,
      searchService,
      stateService,
      encryptService,
      cipherFileUploadService
    );

    cipherObj = new Cipher(cipherData);
  });
  describe("saveAttachmentRawWithServer()", () => {
    it("should upload encrypted file contents with save attachments", async () => {
      const fileName = "filename";
      const fileData = new Uint8Array(10);
      cryptoService.getOrgKey.mockReturnValue(
        Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey)
      );
      cryptoService.makeDataEncKey.mockReturnValue(
        Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)))
      );
      const spy = jest.spyOn(cipherFileUploadService, "upload");

      await cipherService.saveAttachmentRawWithServer(new Cipher(), fileName, fileData);

      expect(spy).toHaveBeenCalled();
    });
  });

  describe("createWithServer()", () => {
    it("should call apiService.postCipherAdmin when orgAdmin param is true and the cipher orgId != null", async () => {
      const spy = jest
        .spyOn(apiService, "postCipherAdmin")
        .mockImplementation(() => Promise.resolve<any>(cipherObj));
      cipherService.createWithServer(cipherObj, true);
      const expectedObj = new CipherCreateRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });
    it("should call apiService.postCipher when orgAdmin param is true and the cipher orgId is null", async () => {
      cipherObj.organizationId = null;
      const spy = jest
        .spyOn(apiService, "postCipher")
        .mockImplementation(() => Promise.resolve<any>(cipherObj));
      cipherService.createWithServer(cipherObj, true);
      const expectedObj = new CipherRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });

    it("should call apiService.postCipherCreate if collectionsIds != null", async () => {
      cipherObj.collectionIds = ["123"];
      const spy = jest
        .spyOn(apiService, "postCipherCreate")
        .mockImplementation(() => Promise.resolve<any>(cipherObj));
      cipherService.createWithServer(cipherObj);
      const expectedObj = new CipherCreateRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });

    it("should call apiService.postCipher when orgAdmin and collectionIds logic is false", async () => {
      const spy = jest
        .spyOn(apiService, "postCipher")
        .mockImplementation(() => Promise.resolve<any>(cipherObj));
      cipherService.createWithServer(cipherObj);
      const expectedObj = new CipherRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });
  });

  describe("updateWithServer()", () => {
    it("should call apiService.putCipherAdmin when orgAdmin and isNotClone params are true", async () => {
      const spy = jest
        .spyOn(apiService, "putCipherAdmin")
        .mockImplementation(() => Promise.resolve<any>(cipherObj));
      cipherService.updateWithServer(cipherObj, true, true);
      const expectedObj = new CipherRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(cipherObj.id, expectedObj);
    });

    it("should call apiService.putCipher if cipher.edit is true", async () => {
      cipherObj.edit = true;
      const spy = jest
        .spyOn(apiService, "putCipher")
        .mockImplementation(() => Promise.resolve<any>(cipherObj));
      cipherService.updateWithServer(cipherObj);
      const expectedObj = new CipherRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(cipherObj.id, expectedObj);
    });

    it("should call apiService.putPartialCipher when orgAdmin, isNotClone, and edit are false", async () => {
      cipherObj.edit = false;
      const spy = jest
        .spyOn(apiService, "putPartialCipher")
        .mockImplementation(() => Promise.resolve<any>(cipherObj));
      cipherService.updateWithServer(cipherObj);
      const expectedObj = new CipherPartialRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(cipherObj.id, expectedObj);
    });
  });
});
