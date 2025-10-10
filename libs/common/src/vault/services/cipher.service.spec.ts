import { mock } from "jest-mock-extended";
import { BehaviorSubject, filter, firstValueFrom, map, of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CipherDecryptionKeys, KeyService } from "@bitwarden/key-management";
import { MessageSender } from "@bitwarden/messaging";
import { CipherListView } from "@bitwarden/sdk-internal";

import { FakeAccountService, mockAccountServiceWith } from "../../../spec/fake-account-service";
import { FakeStateProvider } from "../../../spec/fake-state-provider";
import { makeStaticByteArray, makeSymmetricCryptoKey } from "../../../spec/utils";
import { ApiService } from "../../abstractions/api.service";
import { AutofillSettingsService } from "../../autofill/services/autofill-settings.service";
import { DomainSettingsService } from "../../autofill/services/domain-settings.service";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../key-management/crypto/models/enc-string";
import { UriMatchStrategy } from "../../models/domain/domain-service";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { Utils } from "../../platform/misc/utils";
import { EncArrayBuffer } from "../../platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { ContainerService } from "../../platform/services/container.service";
import { CipherId, UserId, OrganizationId, CollectionId } from "../../types/guid";
import { CipherKey, OrgKey, UserKey } from "../../types/key";
import { CipherEncryptionService } from "../abstractions/cipher-encryption.service";
import { EncryptionContext } from "../abstractions/cipher.service";
import { CipherFileUploadService } from "../abstractions/file-upload/cipher-file-upload.service";
import { SearchService } from "../abstractions/search.service";
import { FieldType } from "../enums";
import { CipherRepromptType } from "../enums/cipher-reprompt-type";
import { CipherType } from "../enums/cipher-type";
import { CipherPermissionsApi } from "../models/api/cipher-permissions.api";
import { CipherData } from "../models/data/cipher.data";
import { Cipher } from "../models/domain/cipher";
import { CipherCreateRequest } from "../models/request/cipher-create.request";
import { CipherPartialRequest } from "../models/request/cipher-partial.request";
import { CipherRequest } from "../models/request/cipher.request";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { LoginUriView } from "../models/view/login-uri.view";

import { CipherService } from "./cipher.service";
import { ENCRYPTED_CIPHERS } from "./key-state/ciphers.state";

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
  permissions: new CipherPermissionsApi(),
  key: "EncKey",
  archivedDate: null,
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
    { id: "a1", url: "url", size: "1100", sizeName: "1.1 KB", fileName: "file", key: "EncKey" },
    { id: "a2", url: "url", size: "1100", sizeName: "1.1 KB", fileName: "file", key: "EncKey" },
  ],
  fields: [
    { name: "EncryptedString", value: "EncryptedString", type: FieldType.Text, linkedId: null },
    { name: "EncryptedString", value: "EncryptedString", type: FieldType.Hidden, linkedId: null },
  ],
};
const mockUserId = Utils.newGuid() as UserId;
let accountService: FakeAccountService;

describe("Cipher Service", () => {
  const keyService = mock<KeyService>();
  const autofillSettingsService = mock<AutofillSettingsService>();
  const domainSettingsService = mock<DomainSettingsService>();
  const apiService = mock<ApiService>();
  const cipherFileUploadService = mock<CipherFileUploadService>();
  const i18nService = mock<I18nService>();
  const searchService = mock<SearchService>();
  const encryptService = mock<EncryptService>();
  const configService = mock<ConfigService>();
  accountService = mockAccountServiceWith(mockUserId);
  const logService = mock<LogService>();
  const stateProvider = new FakeStateProvider(accountService);
  const cipherEncryptionService = mock<CipherEncryptionService>();
  const messageSender = mock<MessageSender>();

  const userId = "TestUserId" as UserId;
  const orgId = "4ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b2" as OrganizationId;

  let cipherService: CipherService;
  let encryptionContext: EncryptionContext;

  beforeEach(() => {
    encryptService.encryptFileData.mockReturnValue(Promise.resolve(ENCRYPTED_BYTES));
    encryptService.encryptString.mockReturnValue(Promise.resolve(new EncString(ENCRYPTED_TEXT)));

    // Mock i18nService collator
    i18nService.collator = {
      compare: jest.fn().mockImplementation((a: string, b: string) => a.localeCompare(b)),
      resolvedOptions: jest.fn().mockReturnValue({}),
    } as any;

    (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);

    cipherService = new CipherService(
      keyService,
      domainSettingsService,
      apiService,
      i18nService,
      searchService,
      autofillSettingsService,
      encryptService,
      cipherFileUploadService,
      configService,
      stateProvider,
      accountService,
      logService,
      cipherEncryptionService,
      messageSender,
    );

    encryptionContext = { cipher: new Cipher(cipherData), encryptedFor: userId };
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
      configService.getFeatureFlag
        .calledWith(FeatureFlag.CipherKeyEncryption)
        .mockResolvedValue(false);

      const spy = jest.spyOn(cipherFileUploadService, "upload");

      await cipherService.saveAttachmentRawWithServer(new Cipher(), fileName, fileData, userId);

      expect(spy).toHaveBeenCalled();
    });
  });

  describe("createWithServer()", () => {
    it("should call apiService.postCipherAdmin when orgAdmin param is true and the cipher orgId != null", async () => {
      const spy = jest
        .spyOn(apiService, "postCipherAdmin")
        .mockImplementation(() => Promise.resolve<any>(encryptionContext.cipher.toCipherData()));
      await cipherService.createWithServer(encryptionContext, true);
      const expectedObj = new CipherCreateRequest(encryptionContext);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });

    it("should call apiService.postCipher when orgAdmin param is true and the cipher orgId is null", async () => {
      encryptionContext.cipher.organizationId = null!;
      const spy = jest
        .spyOn(apiService, "postCipher")
        .mockImplementation(() => Promise.resolve<any>(encryptionContext.cipher.toCipherData()));
      await cipherService.createWithServer(encryptionContext, true);
      const expectedObj = new CipherRequest(encryptionContext);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });

    it("should call apiService.postCipherCreate if collectionsIds != null", async () => {
      encryptionContext.cipher.collectionIds = ["123"];
      const spy = jest
        .spyOn(apiService, "postCipherCreate")
        .mockImplementation(() => Promise.resolve<any>(encryptionContext.cipher.toCipherData()));
      await cipherService.createWithServer(encryptionContext);
      const expectedObj = new CipherCreateRequest(encryptionContext);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });

    it("should call apiService.postCipher when orgAdmin and collectionIds logic is false", async () => {
      const spy = jest
        .spyOn(apiService, "postCipher")
        .mockImplementation(() => Promise.resolve<any>(encryptionContext.cipher.toCipherData()));
      await cipherService.createWithServer(encryptionContext);
      const expectedObj = new CipherRequest(encryptionContext);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expectedObj);
    });
  });

  describe("updateWithServer()", () => {
    it("should call apiService.putCipherAdmin when orgAdmin param is true", async () => {
      const spy = jest
        .spyOn(apiService, "putCipherAdmin")
        .mockImplementation(() => Promise.resolve<any>(encryptionContext.cipher.toCipherData()));
      await cipherService.updateWithServer(encryptionContext, true);
      const expectedObj = new CipherRequest(encryptionContext);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(encryptionContext.cipher.id, expectedObj);
    });

    it("should call apiService.putCipher if cipher.edit is true", async () => {
      encryptionContext.cipher.edit = true;
      const spy = jest
        .spyOn(apiService, "putCipher")
        .mockImplementation(() => Promise.resolve<any>(encryptionContext.cipher.toCipherData()));
      await cipherService.updateWithServer(encryptionContext);
      const expectedObj = new CipherRequest(encryptionContext);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(encryptionContext.cipher.id, expectedObj);
    });

    it("should call apiService.putPartialCipher when orgAdmin, and edit are false", async () => {
      encryptionContext.cipher.edit = false;
      const spy = jest
        .spyOn(apiService, "putPartialCipher")
        .mockImplementation(() => Promise.resolve<any>(encryptionContext.cipher.toCipherData()));
      await cipherService.updateWithServer(encryptionContext);
      const expectedObj = new CipherPartialRequest(encryptionContext.cipher);

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(encryptionContext.cipher.id, expectedObj);
    });
  });

  describe("encrypt", () => {
    let cipherView: CipherView;

    beforeEach(() => {
      cipherView = new CipherView();
      cipherView.type = CipherType.Login;

      encryptService.unwrapSymmetricKey.mockResolvedValue(
        new SymmetricCryptoKey(makeStaticByteArray(64)),
      );
      configService.checkServerMeetsVersionRequirement$.mockReturnValue(of(true));
      keyService.makeCipherKey.mockReturnValue(
        Promise.resolve(new SymmetricCryptoKey(makeStaticByteArray(64)) as CipherKey),
      );
      encryptService.encryptString.mockImplementation(encryptText);
      encryptService.wrapSymmetricKey.mockResolvedValue(new EncString("Re-encrypted Cipher Key"));

      jest.spyOn(cipherService as any, "getAutofillOnPageLoadDefault").mockResolvedValue(true);
    });

    it("should call encrypt method of CipherEncryptionService when feature flag is true", async () => {
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM22136_SdkCipherEncryption)
        .mockResolvedValue(true);
      cipherEncryptionService.encrypt.mockResolvedValue(encryptionContext);

      const result = await cipherService.encrypt(cipherView, userId);

      expect(result).toEqual(encryptionContext);
      expect(cipherEncryptionService.encrypt).toHaveBeenCalledWith(cipherView, userId);
    });

    it("should call legacy encrypt when feature flag is false", async () => {
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM22136_SdkCipherEncryption)
        .mockResolvedValue(false);

      jest.spyOn(cipherService as any, "encryptCipher").mockResolvedValue(encryptionContext.cipher);

      const result = await cipherService.encrypt(cipherView, userId);

      expect(result).toEqual(encryptionContext);
      expect(cipherEncryptionService.encrypt).not.toHaveBeenCalled();
    });

    it("should call legacy encrypt when keys are provided", async () => {
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM22136_SdkCipherEncryption)
        .mockResolvedValue(true);

      jest.spyOn(cipherService as any, "encryptCipher").mockResolvedValue(encryptionContext.cipher);

      const encryptKey = new SymmetricCryptoKey(new Uint8Array(32));
      const decryptKey = new SymmetricCryptoKey(new Uint8Array(32));

      let result = await cipherService.encrypt(cipherView, userId, encryptKey);

      expect(result).toEqual(encryptionContext);
      expect(cipherEncryptionService.encrypt).not.toHaveBeenCalled();

      result = await cipherService.encrypt(cipherView, userId, undefined, decryptKey);
      expect(result).toEqual(encryptionContext);
      expect(cipherEncryptionService.encrypt).not.toHaveBeenCalled();

      result = await cipherService.encrypt(cipherView, userId, encryptKey, decryptKey);
      expect(result).toEqual(encryptionContext);
      expect(cipherEncryptionService.encrypt).not.toHaveBeenCalled();
    });

    it("should return the encrypting user id", async () => {
      keyService.getOrgKey.mockReturnValue(
        Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey),
      );

      const { encryptedFor } = await cipherService.encrypt(cipherView, userId);
      expect(encryptedFor).toEqual(userId);
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

        const { cipher } = await cipherService.encrypt(cipherView, userId);

        expect(cipher.login.uris).toEqual([
          {
            uri: new EncString("uri has been encrypted"),
            uriChecksum: new EncString("uri hash has been encrypted"),
            match: UriMatchStrategy.RegularExpression,
          },
        ]);
      });
    });

    describe("cipher.key", () => {
      beforeEach(() => {
        keyService.getOrgKey.mockReturnValue(
          Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey),
        );
      });

      it("is null when feature flag is false", async () => {
        configService.getFeatureFlag
          .calledWith(FeatureFlag.CipherKeyEncryption)
          .mockResolvedValue(false);
        const { cipher } = await cipherService.encrypt(cipherView, userId);

        expect(cipher.key).toBeNull();
      });

      describe("when feature flag is true", () => {
        beforeEach(() => {
          configService.getFeatureFlag
            .calledWith(FeatureFlag.CipherKeyEncryption)
            .mockResolvedValue(true);
        });

        it("is null when the cipher is not viewPassword", async () => {
          cipherView.viewPassword = false;

          const { cipher } = await cipherService.encrypt(cipherView, userId);

          expect(cipher.key).toBeNull();
        });

        it("is defined when the cipher is viewPassword", async () => {
          cipherView.viewPassword = true;

          const { cipher } = await cipherService.encrypt(cipherView, userId);

          expect(cipher.key).toBeDefined();
        });
      });
    });

    describe("encryptCipherForRotation", () => {
      beforeEach(() => {
        jest.spyOn<any, string>(cipherService, "encryptCipherWithCipherKey");
        keyService.getOrgKey.mockReturnValue(
          Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey),
        );
      });

      it("is not called when feature flag is false", async () => {
        configService.getFeatureFlag
          .calledWith(FeatureFlag.CipherKeyEncryption)
          .mockResolvedValue(false);

        await cipherService.encrypt(cipherView, userId);

        expect(cipherService["encryptCipherWithCipherKey"]).not.toHaveBeenCalled();
      });

      describe("when feature flag is true", () => {
        beforeEach(() => {
          configService.getFeatureFlag
            .calledWith(FeatureFlag.CipherKeyEncryption)
            .mockResolvedValue(true);
        });

        it("is called when cipher viewPassword is true", async () => {
          cipherView.viewPassword = true;

          await cipherService.encrypt(cipherView, userId);

          expect(cipherService["encryptCipherWithCipherKey"]).toHaveBeenCalled();
        });

        it("is not called when cipher viewPassword is false and original cipher has no key", async () => {
          cipherView.viewPassword = false;

          await cipherService.encrypt(cipherView, userId, undefined, undefined, new Cipher());

          expect(cipherService["encryptCipherWithCipherKey"]).not.toHaveBeenCalled();
        });

        it("is called when cipher viewPassword is false and original cipher has a key", async () => {
          cipherView.viewPassword = false;

          await cipherService.encrypt(
            cipherView,
            userId,
            undefined,
            undefined,
            encryptionContext.cipher,
          );

          expect(cipherService["encryptCipherWithCipherKey"]).toHaveBeenCalled();
        });
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
      configService.getFeatureFlag
        .calledWith(FeatureFlag.CipherKeyEncryption)
        .mockResolvedValue(true);
      configService.checkServerMeetsVersionRequirement$.mockReturnValue(of(true));

      searchService.indexedEntityId$.mockReturnValue(of(null));

      const keys = { userKey: originalUserKey } as CipherDecryptionKeys;
      keyService.cipherDecryptionKeys$.mockReturnValue(of(keys));

      const cipher1 = new CipherView(encryptionContext.cipher);
      cipher1.id = "Cipher 1" as CipherId;
      cipher1.organizationId = null;
      const cipher2 = new CipherView(encryptionContext.cipher);
      cipher2.id = "Cipher 2" as CipherId;
      cipher2.organizationId = null;

      decryptedCiphers = new BehaviorSubject({ [cipher1.id]: cipher1, [cipher2.id]: cipher2 });
      jest
        .spyOn(cipherService, "cipherViews$")
        .mockImplementation((userId: UserId) =>
          decryptedCiphers.pipe(map((ciphers) => Object.values(ciphers))),
        );

      failedCiphers = new BehaviorSubject<CipherView[]>([]);
      jest
        .spyOn(cipherService, "failedToDecryptCiphers$")
        .mockImplementation((userId: UserId) => failedCiphers);

      encryptService.unwrapSymmetricKey.mockResolvedValue(
        new SymmetricCryptoKey(new Uint8Array(32)),
      );
      encryptedKey = new EncString("Re-encrypted Cipher Key");
      encryptService.wrapSymmetricKey.mockResolvedValue(encryptedKey);

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
      await expect(cipherService.getRotatedData(null!, newUserKey, mockUserId)).rejects.toThrow(
        "Original user key is required to rotate ciphers",
      );
    });

    it("throws if the new user key is null", async () => {
      await expect(
        cipherService.getRotatedData(originalUserKey, null!, mockUserId),
      ).rejects.toThrow("New user key is required to rotate ciphers");
    });

    it("throws if the user has any failed to decrypt ciphers", async () => {
      const badCipher = new CipherView(encryptionContext.cipher);
      badCipher.id = "Cipher 3";
      badCipher.organizationId = null;
      badCipher.decryptionFailure = true;
      failedCiphers.next([badCipher]);
      await expect(
        cipherService.getRotatedData(originalUserKey, newUserKey, mockUserId),
      ).rejects.toThrow("Cannot rotate ciphers when decryption failures are present");
    });

    it("uses the sdk to re-encrypt ciphers when feature flag is enabled", async () => {
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM22136_SdkCipherEncryption)
        .mockResolvedValue(true);

      cipherEncryptionService.encryptCipherForRotation.mockResolvedValue({
        cipher: encryptionContext.cipher,
        encryptedFor: mockUserId,
      });

      const result = await cipherService.getRotatedData(originalUserKey, newUserKey, mockUserId);

      expect(result).toHaveLength(2);
      expect(cipherEncryptionService.encryptCipherForRotation).toHaveBeenCalledWith(
        expect.any(CipherView),
        mockUserId,
        newUserKey,
      );
    });

    it("sends overlay update when cipherViews$ emits", async () => {
      (cipherService.cipherViews$ as jest.Mock)?.mockRestore();

      const decryptedView = new CipherView(encryptionContext.cipher);
      jest.spyOn(cipherService, "getAllDecrypted").mockResolvedValue([decryptedView]);

      const sendSpy = jest.spyOn(messageSender, "send");

      await firstValueFrom(
        cipherService
          .cipherViews$(mockUserId)
          .pipe(filter((cipherViews): cipherViews is CipherView[] => cipherViews != null)),
      );
      expect(sendSpy).toHaveBeenCalledWith("updateOverlayCiphers");
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("decrypt", () => {
    it("should call decrypt method of CipherEncryptionService when feature flag is true", async () => {
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM19941MigrateCipherDomainToSdk)
        .mockResolvedValue(true);
      cipherEncryptionService.decrypt.mockResolvedValue(new CipherView(encryptionContext.cipher));

      const result = await cipherService.decrypt(encryptionContext.cipher, userId);

      expect(result).toEqual(new CipherView(encryptionContext.cipher));
      expect(cipherEncryptionService.decrypt).toHaveBeenCalledWith(
        encryptionContext.cipher,
        userId,
      );
    });

    it("should call legacy decrypt when feature flag is false", async () => {
      const mockUserKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM19941MigrateCipherDomainToSdk)
        .mockResolvedValue(false);
      cipherService.getKeyForCipherKeyDecryption = jest.fn().mockResolvedValue(mockUserKey);
      jest
        .spyOn(encryptionContext.cipher, "decrypt")
        .mockResolvedValue(new CipherView(encryptionContext.cipher));

      const result = await cipherService.decrypt(encryptionContext.cipher, userId);

      expect(result).toEqual(new CipherView(encryptionContext.cipher));
      expect(encryptionContext.cipher.decrypt).toHaveBeenCalledWith(mockUserKey);
    });
  });

  describe("getDecryptedAttachmentBuffer", () => {
    const mockEncryptedContent = new Uint8Array([1, 2, 3]);
    const mockDecryptedContent = new Uint8Array([4, 5, 6]);

    it("should use SDK when feature flag is enabled", async () => {
      const cipher = new Cipher(cipherData);
      const attachment = new AttachmentView(cipher.attachments![0]);
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM19941MigrateCipherDomainToSdk)
        .mockResolvedValue(true);

      jest.spyOn(cipherService, "ciphers$").mockReturnValue(of({ [cipher.id]: cipherData }));
      cipherEncryptionService.decryptAttachmentContent.mockResolvedValue(mockDecryptedContent);
      const mockResponse = {
        arrayBuffer: jest.fn().mockResolvedValue(mockEncryptedContent.buffer),
      } as unknown as Response;

      const result = await cipherService.getDecryptedAttachmentBuffer(
        cipher.id as CipherId,
        attachment,
        mockResponse,
        userId,
      );

      expect(result).toEqual(mockDecryptedContent);
      expect(cipherEncryptionService.decryptAttachmentContent).toHaveBeenCalledWith(
        cipher,
        attachment,
        mockEncryptedContent,
        userId,
      );
    });

    it("should use legacy decryption when feature flag is enabled", async () => {
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM19941MigrateCipherDomainToSdk)
        .mockResolvedValue(false);
      const cipher = new Cipher(cipherData);
      const attachment = new AttachmentView(cipher.attachments![0]);
      attachment.key = makeSymmetricCryptoKey(64);

      const mockResponse = {
        arrayBuffer: jest.fn().mockResolvedValue(mockEncryptedContent.buffer),
      } as unknown as Response;
      const mockEncBuf = {} as EncArrayBuffer;
      EncArrayBuffer.fromResponse = jest.fn().mockResolvedValue(mockEncBuf);
      encryptService.decryptFileData.mockResolvedValue(mockDecryptedContent);

      const result = await cipherService.getDecryptedAttachmentBuffer(
        cipher.id as CipherId,
        attachment,
        mockResponse,
        userId,
      );

      expect(result).toEqual(mockDecryptedContent);
      expect(encryptService.decryptFileData).toHaveBeenCalledWith(mockEncBuf, attachment.key);
    });
  });

  describe("shareWithServer()", () => {
    it("should use cipherEncryptionService to move the cipher when feature flag enabled", async () => {
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM22136_SdkCipherEncryption)
        .mockResolvedValue(true);

      apiService.putShareCipher.mockResolvedValue(new CipherResponse(cipherData));

      const expectedCipher = new Cipher(cipherData);
      expectedCipher.organizationId = orgId;
      const cipherView = new CipherView(expectedCipher);
      const collectionIds = ["collection1", "collection2"] as CollectionId[];

      cipherView.organizationId = undefined; // Ensure organizationId is undefined for this test

      cipherEncryptionService.moveToOrganization.mockResolvedValue({
        cipher: expectedCipher,
        encryptedFor: userId,
      });

      await cipherService.shareWithServer(cipherView, orgId, collectionIds, userId);

      // Expect SDK usage
      expect(cipherEncryptionService.moveToOrganization).toHaveBeenCalledWith(
        cipherView,
        orgId,
        userId,
      );
      // Expect collectionIds to be assigned
      expect(apiService.putShareCipher).toHaveBeenCalledWith(
        cipherView.id,
        expect.objectContaining({
          cipher: expect.objectContaining({ organizationId: orgId }),
          collectionIds: collectionIds,
        }),
      );
    });

    it("should use legacy encryption when feature flag disabled", async () => {
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM22136_SdkCipherEncryption)
        .mockResolvedValue(false);

      apiService.putShareCipher.mockResolvedValue(new CipherResponse(cipherData));

      const expectedCipher = new Cipher(cipherData);
      expectedCipher.organizationId = orgId;
      const cipherView = new CipherView(expectedCipher);
      const collectionIds = ["collection1", "collection2"] as CollectionId[];

      cipherView.organizationId = undefined; // Ensure organizationId is undefined for this test

      const oldEncryptSharedSpy = jest
        .spyOn(cipherService as any, "encryptSharedCipher")
        .mockResolvedValue({
          cipher: expectedCipher,
          encryptedFor: userId,
        });

      await cipherService.shareWithServer(cipherView, orgId, collectionIds, userId);

      // Expect no SDK usage
      expect(cipherEncryptionService.moveToOrganization).not.toHaveBeenCalled();
      expect(oldEncryptSharedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          collectionIds: collectionIds,
        } as unknown as CipherView),
        userId,
      );
    });
  });

  describe("decryptCiphers", () => {
    let mockCiphers: Cipher[];
    const cipher1_id = "11111111-1111-1111-1111-111111111111";
    const cipher2_id = "22222222-2222-2222-2222-222222222222";

    beforeEach(() => {
      const originalUserKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
      const orgKey = new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey;
      const keys = {
        userKey: originalUserKey,
        orgKeys: { [orgId]: orgKey },
      } as CipherDecryptionKeys;
      keyService.cipherDecryptionKeys$.mockReturnValue(of(keys));

      mockCiphers = [
        new Cipher({ ...cipherData, id: cipher1_id }),
        new Cipher({ ...cipherData, id: cipher2_id }),
      ];

      //// Mock the SDK response
      cipherEncryptionService.decryptManyWithFailures.mockResolvedValue([
        [{ id: mockCiphers[0].id, name: "Success 1" } as unknown as CipherListView],
        [mockCiphers[1]], // Mock failed cipher
      ]);
    });

    it("should use the SDK for decryption when SDK feature flag is enabled", async () => {
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM19941MigrateCipherDomainToSdk)
        .mockResolvedValue(true);

      // Set up expected results
      const expectedSuccessCipherViews = [
        { id: mockCiphers[0].id, name: "Success 1" } as unknown as CipherListView,
      ];

      const expectedFailedCipher = new CipherView(mockCiphers[1]);
      expectedFailedCipher.name = "[error: cannot decrypt]";
      expectedFailedCipher.decryptionFailure = true;
      const expectedFailedCipherViews = [expectedFailedCipher];

      // Execute
      const [successes, failures] = await (cipherService as any).decryptCiphers(
        mockCiphers,
        userId,
      );

      // Verify the SDK was used for decryption
      expect(cipherEncryptionService.decryptManyWithFailures).toHaveBeenCalledWith(
        mockCiphers,
        userId,
      );

      expect(successes).toEqual(expectedSuccessCipherViews);
      expect(failures).toEqual(expectedFailedCipherViews);
    });

    it("should use legacy decryption when SDK feature flag is disabled", async () => {
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM19941MigrateCipherDomainToSdk)
        .mockResolvedValue(false);

      // Execute
      const [successes, failures] = await (cipherService as any).decryptCiphers(
        mockCiphers,
        userId,
      );

      // Verify the SDK was not used for decryption
      expect(cipherEncryptionService.decryptManyWithFailures).toHaveBeenCalledTimes(0);

      expect(successes).toHaveLength(2);
      expect(failures).toHaveLength(0);
    });
  });

  describe("replace (no upsert)", () => {
    // In order to set up initial state we need to manually update the encrypted state
    // which will result in an emission. All tests will have this baseline emission.
    const TEST_BASELINE_EMISSIONS = 1;

    const makeCipher = (id: string): CipherData =>
      ({
        ...cipherData,
        id,
        name: `Enc ${id}`,
      }) as CipherData;

    const tick = async () => new Promise((r) => setTimeout(r, 0));

    const setEncryptedState = async (data: Record<CipherId, CipherData>, uid = userId) => {
      // Directly set the encrypted state, this will result in a single emission
      await stateProvider.getUser(uid, ENCRYPTED_CIPHERS).update(() => data);
      // match service’s “next tick” behavior so subscribers see it
      await tick();
    };

    it("emits and calls updateEncryptedCipherState when current state is empty and replace({}) is called", async () => {
      // Ensure empty state
      await setEncryptedState({});

      const emissions: Array<Record<CipherId, CipherData>> = [];
      const sub = cipherService.ciphers$(userId).subscribe((v) => emissions.push(v));
      await tick();

      const spy = jest.spyOn<any, any>(cipherService, "updateEncryptedCipherState");

      // Calling replace with empty object MUST still update to trigger init emissions
      await cipherService.replace({}, userId);
      await tick();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(emissions.length).toBeGreaterThanOrEqual(TEST_BASELINE_EMISSIONS + 1);

      sub.unsubscribe();
    });

    it("does NOT emit or call updateEncryptedCipherState when state is non-empty and identical", async () => {
      const A = makeCipher("A");
      await setEncryptedState({ [A.id as CipherId]: A });

      const emissions: Array<Record<CipherId, CipherData>> = [];
      const sub = cipherService.ciphers$(userId).subscribe((v) => emissions.push(v));
      await tick();

      const spy = jest.spyOn<any, any>(cipherService, "updateEncryptedCipherState");

      // identical snapshot → short-circuit path
      await cipherService.replace({ [A.id as CipherId]: A }, userId);
      await tick();

      expect(spy).not.toHaveBeenCalled();
      expect(emissions.length).toBe(TEST_BASELINE_EMISSIONS);

      sub.unsubscribe();
    });

    it("emits and calls updateEncryptedCipherState when the provided state differs from current", async () => {
      const A = makeCipher("A");
      await setEncryptedState({ [A.id as CipherId]: A });

      const emissions: Array<Record<CipherId, CipherData>> = [];
      const sub = cipherService.ciphers$(userId).subscribe((v) => emissions.push(v));
      await tick();

      const spy = jest.spyOn<any, any>(cipherService, "updateEncryptedCipherState");

      const B = makeCipher("B");
      await cipherService.replace({ [B.id as CipherId]: B }, userId);
      await tick();

      expect(spy).toHaveBeenCalledTimes(1);

      expect(emissions.length).toBeGreaterThanOrEqual(TEST_BASELINE_EMISSIONS + 1);

      sub.unsubscribe();
    });
  });

  describe("getCipherForUrl localData application", () => {
    beforeEach(() => {
      Object.defineProperty(autofillSettingsService, "autofillOnPageLoadDefault$", {
        value: of(true),
        writable: true,
      });
    });

    it("should apply localData to ciphers when getCipherForUrl is called via getLastLaunchedForUrl", async () => {
      const testUrl = "https://test-url.com";
      const cipherId = "test-cipher-id" as CipherId;
      const testLocalData = {
        lastLaunched: Date.now().valueOf(),
        lastUsedDate: Date.now().valueOf() - 1000,
      };

      jest.spyOn(cipherService, "localData$").mockReturnValue(of({ [cipherId]: testLocalData }));

      const mockCipherView = new CipherView();
      mockCipherView.id = cipherId;
      mockCipherView.localData = null;

      jest.spyOn(cipherService, "getAllDecryptedForUrl").mockResolvedValue([mockCipherView]);

      const result = await cipherService.getLastLaunchedForUrl(testUrl, userId, true);

      expect(result.localData).toEqual(testLocalData);
    });

    it("should apply localData to ciphers when getCipherForUrl is called via getLastUsedForUrl", async () => {
      const testUrl = "https://test-url.com";
      const cipherId = "test-cipher-id" as CipherId;
      const testLocalData = { lastUsedDate: Date.now().valueOf() - 1000 };

      jest.spyOn(cipherService, "localData$").mockReturnValue(of({ [cipherId]: testLocalData }));

      const mockCipherView = new CipherView();
      mockCipherView.id = cipherId;
      mockCipherView.localData = null;

      jest.spyOn(cipherService, "getAllDecryptedForUrl").mockResolvedValue([mockCipherView]);

      const result = await cipherService.getLastUsedForUrl(testUrl, userId, true);

      expect(result.localData).toEqual(testLocalData);
    });

    it("should not modify localData if it already matches in getCipherForUrl", async () => {
      const testUrl = "https://test-url.com";
      const cipherId = "test-cipher-id" as CipherId;
      const existingLocalData = {
        lastLaunched: Date.now().valueOf(),
        lastUsedDate: Date.now().valueOf() - 1000,
      };

      jest
        .spyOn(cipherService, "localData$")
        .mockReturnValue(of({ [cipherId]: existingLocalData }));

      const mockCipherView = new CipherView();
      mockCipherView.id = cipherId;
      mockCipherView.localData = existingLocalData;

      jest.spyOn(cipherService, "getAllDecryptedForUrl").mockResolvedValue([mockCipherView]);

      const result = await cipherService.getLastLaunchedForUrl(testUrl, userId, true);

      expect(result.localData).toBe(existingLocalData);
    });
  });
});
