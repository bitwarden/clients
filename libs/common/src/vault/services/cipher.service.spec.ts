import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { makeStaticByteArray } from "../../../spec/utils";
import { ApiService } from "../../abstractions/api.service";
import { SearchService } from "../../abstractions/search.service";
import { AutofillSettingsService } from "../../autofill/services/autofill-settings.service";
import { DomainSettingsService } from "../../autofill/services/domain-settings.service";
import { UriMatchStrategy } from "../../models/domain/domain-service";
import { ConfigServiceAbstraction } from "../../platform/abstractions/config/config.service.abstraction";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { EncryptService } from "../../platform/abstractions/encrypt.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { StateService } from "../../platform/abstractions/state.service";
import { EncArrayBuffer } from "../../platform/models/domain/enc-array-buffer";
import { EncString } from "../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { ContainerService } from "../../platform/services/container.service";
import { CipherKey, OrgKey } from "../../types/key";
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

describe("Cipher Service", () => {
  const cryptoService = mock<CryptoService>();
  const stateService = mock<StateService>();
  const autofillSettingsService = mock<AutofillSettingsService>();
  const domainSettingsService = mock<DomainSettingsService>();
  const apiService = mock<ApiService>();
  const cipherFileUploadService = mock<CipherFileUploadService>();
  const i18nService = mock<I18nService>();
  const searchService = mock<SearchService>();
  const encryptService = mock<EncryptService>();
  const configService = mock<ConfigServiceAbstraction>();

  let cipherService: CipherService;
  let cipherObj: Cipher;

  beforeEach(() => {
    encryptService.encryptToBytes.mockReturnValue(Promise.resolve(ENCRYPTED_BYTES));
    encryptService.encrypt.mockReturnValue(Promise.resolve(new EncString(ENCRYPTED_TEXT)));

    (window as any).bitwardenContainerService = new ContainerService(cryptoService, encryptService);

    cipherService = new CipherService(
      cryptoService,
      domainSettingsService,
      apiService,
      i18nService,
      searchService,
      stateService,
      autofillSettingsService,
      encryptService,
      cipherFileUploadService,
      configService,
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
      cryptoService.getOrgKey.mockReturnValue(
        Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey),
      );
      cryptoService.makeDataEncKey.mockReturnValue(
        Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32))),
      );

      configService.checkServerMeetsVersionRequirement$.mockReturnValue(of(false));
      setEncryptionKeyFlag(false);

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
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      cipherService.createWithServer(cipherObj);
      const expectedObj = new CipherCreateRequest(cipherObj);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });

    it("should call apiService.postCipher when orgAdmin and collectionIds logic is false", async () => {
      const spy = jest
        .spyOn(apiService, "postCipher")
        .mockImplementation(() => Promise.resolve<any>(cipherObj));
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      cipherService.updateWithServer(cipherObj);
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
      cryptoService.makeCipherKey.mockReturnValue(
        Promise.resolve(new SymmetricCryptoKey(makeStaticByteArray(64)) as CipherKey),
      );
      cryptoService.encrypt.mockImplementation(encryptText);

      jest.spyOn(cipherService as any, "getAutofillOnPageLoadDefault").mockResolvedValue(true);
    });

    describe("login encryption", () => {
      it("should add a uri hash to login uris", async () => {
        encryptService.hash.mockImplementation((value) => Promise.resolve(`${value} hash`));
        cipherView.login.uris = [
          { uri: "uri", match: UriMatchStrategy.RegularExpression } as LoginUriView,
        ];

        const domain = await cipherService.encrypt(cipherView);

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
      it("is null when enableCipherKeyEncryption flag is false", async () => {
        setEncryptionKeyFlag(false);

        const cipher = await cipherService.encrypt(cipherView);

        expect(cipher.key).toBeNull();
      });

      it("is defined when enableCipherKeyEncryption flag is true", async () => {
        setEncryptionKeyFlag(true);

        const cipher = await cipherService.encrypt(cipherView);

        expect(cipher.key).toBeDefined();
      });
    });

    describe("encryptWithCipherKey", () => {
      beforeEach(() => {
        jest.spyOn<any, string>(cipherService, "encryptCipherWithCipherKey");
      });

      it("is not called when enableCipherKeyEncryption is false", async () => {
        setEncryptionKeyFlag(false);

        await cipherService.encrypt(cipherView);

        expect(cipherService["encryptCipherWithCipherKey"]).not.toHaveBeenCalled();
      });

      it("is called when enableCipherKeyEncryption is true", async () => {
        setEncryptionKeyFlag(true);

        await cipherService.encrypt(cipherView);

        expect(cipherService["encryptCipherWithCipherKey"]).toHaveBeenCalled();
      });
    });
  });
});

function setEncryptionKeyFlag(value: boolean) {
  process.env.FLAGS = JSON.stringify({
    enableCipherKeyEncryption: value,
  });
}
