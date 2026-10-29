import { mock } from "jest-mock-extended";
import { BehaviorSubject, Observable, filter, firstValueFrom, map, of, throwError } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CipherDecryptionKeys, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  EncArrayBuffer,
  EncryptService,
  EncString,
  LegacyCompatKeyService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
import { Measurement } from "@bitwarden/logging";
import { MessageSender } from "@bitwarden/messaging";
import { CipherListView } from "@bitwarden/sdk-internal";

import { FakeAccountService, mockAccountServiceWith } from "../../../spec/fake-account-service";
import { FakeStateProvider } from "../../../spec/fake-state-provider";
import { makeStaticByteArray, makeSymmetricCryptoKey } from "../../../spec/utils";
import { ApiService } from "../../abstractions/api.service";
import { AutofillSettingsService } from "../../autofill/services/autofill-settings.service";
import { DomainSettingsService } from "../../autofill/services/domain-settings.service";
import { UriMatchStrategy } from "../../models/domain/domain-service";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { LogService } from "../../platform/abstractions/log.service";
import { FileUploadType } from "../../platform/enums";
import { Utils } from "../../platform/misc/utils";
import { ContainerService } from "../../platform/services/container.service";
import { CipherId, UserId, OrganizationId, CollectionId } from "../../types/guid";
import { OrgKey, UserKey } from "../../types/key";
import { CipherEncryptionService } from "../abstractions/cipher-encryption.service";
import { CipherSdkService } from "../abstractions/cipher-sdk.service";
import { EncryptionContext, RestrictedCipherWriteError } from "../abstractions/cipher.service";
import { CipherFileUploadService } from "../abstractions/file-upload/cipher-file-upload.service";
import { FieldType } from "../enums";
import { CipherRepromptType } from "../enums/cipher-reprompt-type";
import { CipherType } from "../enums/cipher-type";
import { CipherPermissionsApi } from "../models/api/cipher-permissions.api";
import { CipherData } from "../models/data/cipher.data";
import { LocalData } from "../models/data/local.data";
import { Cipher } from "../models/domain/cipher";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { LoginView } from "../models/view/login.view";

import { CipherService } from "./cipher.service";
import { ENCRYPTED_CIPHERS } from "./key-state/ciphers.state";

const ENCRYPTED_TEXT = "This data has been encrypted";
function encryptText(clearText: string | Uint8Array) {
  return Promise.resolve(new EncString(`${clearText} has been encrypted`));
}
const ENCRYPTED_BYTES = mock<EncArrayBuffer>();

const cipherData: CipherData = {
  id: "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId,
  organizationId: "4ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b21" as OrganizationId,
  folderId: "6ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b23",
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
  const legacyCompatKeyService = mock<LegacyCompatKeyService>();
  const autofillSettingsService = mock<AutofillSettingsService>();
  const domainSettingsService = mock<DomainSettingsService>();
  const apiService = mock<ApiService>();
  const cipherFileUploadService = mock<CipherFileUploadService>();
  const i18nService = mock<I18nService>();
  const encryptService = mock<EncryptService>();
  const configService = mock<ConfigService>();
  accountService = mockAccountServiceWith(mockUserId);
  const logService = mock<LogService>({ startMeasurement: () => mock<Measurement>() });
  const stateProvider = new FakeStateProvider(accountService);
  const cipherEncryptionService = mock<CipherEncryptionService>();
  const messageSender = mock<MessageSender>();
  const cipherSdkService = mock<CipherSdkService>();

  const userId = "TestUserId" as UserId;
  const orgId = "4ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b21" as OrganizationId;

  let cipherService: CipherService;
  let encryptionContext: EncryptionContext;

  beforeEach(() => {
    encryptService.encryptFileData.mockReturnValue(Promise.resolve(ENCRYPTED_BYTES));
    encryptService.encryptString.mockReturnValue(Promise.resolve(new EncString(ENCRYPTED_TEXT)));
    keyService.orgKeys$.mockReturnValue(of({ [orgId]: makeSymmetricCryptoKey(32) as OrgKey }));
    keyService.userKey$.mockReturnValue(of(makeSymmetricCryptoKey(64) as UserKey));

    // Mock i18nService collator
    i18nService.collator = {
      compare: jest.fn().mockImplementation((a: string, b: string) => a.localeCompare(b)),
      resolvedOptions: jest.fn().mockReturnValue({}),
    } as any;

    (window as any).bitwardenContainerService = new ContainerService(
      keyService,
      encryptService,
      legacyCompatKeyService,
    );

    cipherService = new CipherService(
      keyService,
      legacyCompatKeyService,
      domainSettingsService,
      apiService,
      i18nService,
      autofillSettingsService,
      encryptService,
      cipherFileUploadService,
      configService,
      stateProvider,
      accountService,
      logService,
      cipherEncryptionService,
      messageSender,
      cipherSdkService,
    );

    encryptionContext = { cipher: new Cipher(cipherData), encryptedFor: userId };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("saveAttachmentRawWithServer()", () => {
    it("routes through SDK createAttachment + uploadPrepared (non-admin)", async () => {
      const fileName = "filename";
      const fileData = new Uint8Array(10);
      const testCipher = new Cipher(cipherData);

      legacyCompatKeyService.makeDataEncKey.mockResolvedValue([
        new SymmetricCryptoKey(new Uint8Array(32)),
        new EncString("2.encryptedKey"),
      ] as any);
      encryptService.encryptString.mockResolvedValue(new EncString("2.encryptedFileName"));
      encryptService.encryptFileData.mockResolvedValue({ buffer: new Uint8Array(10) } as any);

      cipherSdkService.createAttachment.mockResolvedValue({
        attachmentId: "newatt",
        uploadUrl: "https://example.com/upload",
        fileUploadType: "Direct",
        cipher: undefined,
      } as any);
      cipherFileUploadService.uploadPrepared.mockResolvedValue(undefined);

      const getSpy = jest.spyOn(cipherService, "get").mockResolvedValue(testCipher);

      await cipherService.saveAttachmentRawWithServer(testCipher, fileName, fileData, userId);

      expect(cipherSdkService.createAttachment).toHaveBeenCalledWith(
        testCipher.id,
        expect.objectContaining({
          lastKnownRevisionDate: testCipher.revisionDate.toISOString(),
        }),
        userId,
        false,
      );
      expect(cipherFileUploadService.uploadPrepared).toHaveBeenCalledWith(
        testCipher.id,
        "newatt",
        "https://example.com/upload",
        FileUploadType.Direct,
        expect.any(EncString),
        expect.anything(),
        userId,
        false,
        undefined,
      );
      expect(getSpy).toHaveBeenCalledWith(testCipher.id, userId);
    });

    it("returns SDK-provided cipher and skips state fetch when admin", async () => {
      const fileName = "filename";
      const fileData = new Uint8Array(10);
      const testCipher = new Cipher(cipherData);

      legacyCompatKeyService.makeDataEncKey.mockResolvedValue([
        new SymmetricCryptoKey(new Uint8Array(32)),
        new EncString("2.encryptedKey"),
      ] as any);
      encryptService.encryptString.mockResolvedValue(new EncString("2.encryptedFileName"));
      encryptService.encryptFileData.mockResolvedValue({ buffer: new Uint8Array(10) } as any);

      const sdkCipher = { id: testCipher.id } as any;
      const fromSdkSpy = jest
        .spyOn(Cipher, "fromSdkCipher")
        .mockReturnValue(new Cipher(cipherData));

      cipherSdkService.createAttachment.mockResolvedValue({
        attachmentId: "newatt",
        uploadUrl: "https://example.com/upload",
        fileUploadType: "Azure",
        cipher: sdkCipher,
      } as any);
      cipherFileUploadService.uploadPrepared.mockResolvedValue(undefined);

      const getSpy = jest.spyOn(cipherService, "get");

      await cipherService.saveAttachmentRawWithServer(testCipher, fileName, fileData, userId, true);

      expect(cipherSdkService.createAttachment).toHaveBeenCalledWith(
        testCipher.id,
        expect.not.objectContaining({ asAdmin: expect.anything() }),
        userId,
        true,
      );
      expect(cipherFileUploadService.uploadPrepared).toHaveBeenCalledWith(
        testCipher.id,
        "newatt",
        "https://example.com/upload",
        FileUploadType.Azure,
        expect.any(EncString),
        expect.anything(),
        userId,
        true,
        undefined,
      );
      expect(fromSdkSpy).toHaveBeenCalledWith(sdkCipher);
      expect(getSpy).not.toHaveBeenCalled();
    });
  });

  describe("createWithServer()", () => {
    beforeEach(() => {
      jest.spyOn(cipherService, "encrypt").mockResolvedValue(encryptionContext);
      jest.spyOn(cipherService, "decrypt").mockImplementation(async (cipher) => {
        return new CipherView(cipher);
      });
    });

    it("should delegate to cipherSdkService", async () => {
      const cipherView = new CipherView(encryptionContext.cipher);
      const expectedResult = new CipherView(encryptionContext.cipher);

      const cipherSdkServiceSpy = jest
        .spyOn(cipherSdkService, "createWithServer")
        .mockResolvedValue(expectedResult);

      const clearCacheSpy = jest.spyOn(cipherService, "clearCache");

      const result = await cipherService.createWithServer(cipherView, userId);

      expect(cipherSdkServiceSpy).toHaveBeenCalledWith(cipherView, userId, undefined);
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
      expect(result).toBeInstanceOf(CipherView);
    });
  });

  describe("updateWithServer()", () => {
    beforeEach(() => {
      jest.spyOn(cipherService, "encrypt").mockResolvedValue(encryptionContext);
      jest.spyOn(cipherService, "decrypt").mockImplementation(async (cipher) => {
        return new CipherView(cipher);
      });
      jest.spyOn(cipherService, "upsert").mockResolvedValue({
        [cipherData.id as CipherId]: cipherData,
      });
    });

    it("should delegate to cipherSdkService", async () => {
      const testCipher = new Cipher(cipherData);
      const cipherView = new CipherView(testCipher);
      const expectedResult = new CipherView(testCipher);

      const cipherSdkServiceSpy = jest
        .spyOn(cipherSdkService, "updateWithServer")
        .mockResolvedValue(expectedResult);

      const clearCacheSpy = jest.spyOn(cipherService, "clearCache");

      const result = await cipherService.updateWithServer(cipherView, userId);

      expect(cipherSdkServiceSpy).toHaveBeenCalledWith(cipherView, userId, undefined, undefined);
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
      expect(result).toBeInstanceOf(CipherView);
    });

    it("should delegate to cipherSdkService with orgAdmin", async () => {
      const testCipher = new Cipher(cipherData);
      const cipherView = new CipherView(testCipher);
      const originalCipherView = new CipherView(testCipher);
      const expectedResult = new CipherView(testCipher);

      const cipherSdkServiceSpy = jest
        .spyOn(cipherSdkService, "updateWithServer")
        .mockResolvedValue(expectedResult);

      const clearCacheSpy = jest.spyOn(cipherService, "clearCache");

      const result = await cipherService.updateWithServer(
        cipherView,
        userId,
        originalCipherView,
        true,
      );

      expect(cipherSdkServiceSpy).toHaveBeenCalledWith(
        cipherView,
        userId,
        originalCipherView,
        true,
      );
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
      expect(result).toBeInstanceOf(CipherView);
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
      encryptService.encryptString.mockImplementation(encryptText);
      encryptService.wrapSymmetricKey.mockResolvedValue(new EncString("Re-encrypted Cipher Key"));

      jest.spyOn(cipherService as any, "getAutofillOnPageLoadDefault").mockResolvedValue(true);

      cipherEncryptionService.encrypt.mockResolvedValue(encryptionContext);
    });

    it("should call encrypt method of CipherEncryptionService", async () => {
      cipherEncryptionService.encrypt.mockResolvedValue(encryptionContext);

      const result = await cipherService.encrypt(cipherView, userId);

      expect(result).toEqual(encryptionContext);
      expect(cipherEncryptionService.encrypt).toHaveBeenCalledWith(cipherView, userId);
    });

    it("should return the encrypting user id", async () => {
      keyService.getOrgKey.mockReturnValue(
        Promise.resolve<any>(new SymmetricCryptoKey(new Uint8Array(32)) as OrgKey),
      );

      const { encryptedFor } = await cipherService.encrypt(cipherView, userId);
      expect(encryptedFor).toEqual(userId);
    });
  });

  describe("getRotatedData", () => {
    const originalUserKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
    const newUserKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
    let decryptedCiphers: BehaviorSubject<Record<CipherId, CipherView>>;
    let failedCiphers: BehaviorSubject<CipherView[]>;
    let encryptedKey: EncString;

    beforeEach(() => {
      configService.checkServerMeetsVersionRequirement$.mockReturnValue(of(true));

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

      cipherEncryptionService.encryptCipherForRotation.mockImplementation((cipher: CipherView) =>
        Promise.resolve({
          cipher: Object.assign(new Cipher(cipherData), {
            id: cipher.id as CipherId,
            key: encryptedKey,
          }),
          encryptedFor: mockUserId,
        }),
      );
    });

    it("returns re-encrypted user ciphers", async () => {
      const result = await cipherService.getRotatedData(originalUserKey, newUserKey, mockUserId);

      expect(result[0]).toMatchObject({ id: "Cipher 1", key: "Re-encrypted Cipher Key" });
      expect(result[1]).toMatchObject({ id: "Cipher 2", key: "Re-encrypted Cipher Key" });
    });

    it("excludes partial (PAM-gated) ciphers from rotation", async () => {
      // The real cipherViews$ chain is what drops partials, so undo the beforeEach's mock.
      (cipherService.cipherViews$ as jest.Mock).mockRestore();
      stateProvider.singleUser
        .getFake(mockUserId, ENCRYPTED_CIPHERS)
        .nextState({ [cipherData.id]: cipherData } as Record<CipherId, CipherData>);

      const normal = new CipherView(encryptionContext.cipher);
      normal.id = "normal" as CipherId;
      normal.organizationId = null;
      normal.partial = false;

      const partial = new CipherView(encryptionContext.cipher);
      partial.id = "partial" as CipherId;
      partial.organizationId = null;
      partial.partial = true;

      jest
        .spyOn(cipherService as any, "getAllDecryptedIncludingRestricted")
        .mockResolvedValue([normal, partial]);

      const result = await cipherService.getRotatedData(originalUserKey, newUserKey, mockUserId);

      // Rotating a partial would overwrite its suppressed fields with blanks.
      expect(cipherEncryptionService.encryptCipherForRotation).toHaveBeenCalledTimes(1);
      expect(cipherEncryptionService.encryptCipherForRotation).toHaveBeenCalledWith(
        normal,
        mockUserId,
        newUserKey,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "normal" });
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

    it("uses the sdk to re-encrypt ciphers", async () => {
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
      stateProvider.singleUser
        .getFake(mockUserId, ENCRYPTED_CIPHERS)
        .nextState({ [cipherData.id]: cipherData } as Record<CipherId, CipherData>);

      const decryptedView = new CipherView(encryptionContext.cipher);
      jest
        .spyOn(cipherService as any, "getAllDecryptedIncludingRestricted")
        .mockResolvedValue([decryptedView]);

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
    it("should call decrypt method of CipherEncryptionService", async () => {
      cipherEncryptionService.decrypt.mockResolvedValue(new CipherView(encryptionContext.cipher));

      const result = await cipherService.decrypt(encryptionContext.cipher, userId);

      expect(result).toEqual(new CipherView(encryptionContext.cipher));
      expect(cipherEncryptionService.decrypt).toHaveBeenCalledWith(
        encryptionContext.cipher,
        userId,
      );
    });
  });

  describe("cipherView$", () => {
    let cipher1: CipherView;
    let cipher2: CipherView;

    beforeEach(() => {
      cipher1 = new CipherView(encryptionContext.cipher);
      cipher1.id = "cipher-1" as CipherId;
      cipher2 = new CipherView(encryptionContext.cipher);
      cipher2.id = "cipher-2" as CipherId;

      jest
        .spyOn(cipherService, "cipherViews$")
        .mockReturnValue(of([cipher1, cipher2]) as Observable<CipherView[]>);
    });

    it("emits the decrypted cipher matching the given id", async () => {
      const result = await firstValueFrom(
        cipherService.cipherView$(mockUserId, "cipher-2" as CipherId),
      );

      expect(result).toBe(cipher2);
    });

    it("emits undefined when no cipher matches the given id", async () => {
      const result = await firstValueFrom(
        cipherService.cipherView$(mockUserId, "missing" as CipherId),
      );

      expect(result).toBeUndefined();
    });

    it("does not emit while cipherViews$ is null", async () => {
      (cipherService.cipherViews$ as jest.Mock).mockReturnValue(
        of(null) as unknown as Observable<CipherView[]>,
      );

      const emitted = jest.fn();
      const subscription = cipherService
        .cipherView$(mockUserId, "cipher-1" as CipherId)
        .subscribe(emitted);

      expect(emitted).not.toHaveBeenCalled();
      subscription.unsubscribe();
    });
  });

  describe("partial (PAM-gated) cipher filtering", () => {
    let normal: CipherView;
    let partial: CipherView;

    beforeEach(() => {
      normal = new CipherView(encryptionContext.cipher);
      normal.id = "normal" as CipherId;
      normal.partial = false;

      partial = new CipherView(encryptionContext.cipher);
      partial.id = "partial" as CipherId;
      partial.partial = true;

      (cipherService as any).cipherViewsIncludingRestricted$ = jest
        .fn()
        .mockReturnValue(of([normal, partial]));
    });

    it("cipherViews$ excludes partial ciphers", async () => {
      const result = await firstValueFrom(cipherService.cipherViews$(mockUserId));

      expect(result).toEqual([normal]);
    });

    it("cipherViews$ passes a null (decryption-in-progress) emission through unchanged", async () => {
      (cipherService as any).cipherViewsIncludingRestricted$ = jest.fn().mockReturnValue(of(null));

      const result = await firstValueFrom(cipherService.cipherViews$(mockUserId));

      expect(result).toBeNull();
    });

    describe("list views", () => {
      const normalListView = { id: "normal", partial: false } as unknown as CipherListView;
      const partialListView = { id: "partial", partial: true } as unknown as CipherListView;

      beforeEach(() => {
        stateProvider.singleUser
          .getFake(mockUserId, ENCRYPTED_CIPHERS)
          .nextState({ [cipherData.id]: cipherData } as Record<CipherId, CipherData>);
        keyService.cipherDecryptionKeys$.mockReturnValue(of({} as CipherDecryptionKeys));
        jest
          .spyOn(cipherService as any, "decryptCiphersWithSdk")
          .mockResolvedValue([[normalListView, partialListView], []]);
      });

      it("cipherListViews$ excludes partial ciphers", async () => {
        const result = await firstValueFrom(cipherService.cipherListViews$(mockUserId));

        expect(result).toEqual([normalListView]);
      });

      it("cipherListViewsIncludingRestricted$ retains partial ciphers", async () => {
        const result = await firstValueFrom(
          cipherService.cipherListViewsIncludingRestricted$(mockUserId),
        );

        expect(result).toEqual([normalListView, partialListView]);
      });

      it("keeps list views decrypted after a cache clear that finishes late", async () => {
        const emitted: unknown[] = [];
        const subscription = cipherService
          .cipherListViewsIncludingRestricted$(mockUserId)
          .subscribe((views) => emitted.push(views));
        await new Promise((resolve) => setTimeout(resolve));

        // Clearing writes state first, which is slow while the background is busy decrypting.
        let finishStateClear!: () => void;
        jest
          .spyOn(cipherService as any, "clearDecryptedCiphersState")
          .mockReturnValue(new Promise<void>((resolve) => (finishStateClear = resolve)));
        const clearing = cipherService.clearCache(mockUserId);

        // A decrypt of the latest ciphers completes while the clear is still running.
        stateProvider.singleUser
          .getFake(mockUserId, ENCRYPTED_CIPHERS)
          .nextState({ [cipherData.id]: cipherData } as Record<CipherId, CipherData>);
        await new Promise((resolve) => setTimeout(resolve));
        finishStateClear();
        await clearing;

        expect(emitted.at(-1)).toEqual([normalListView, partialListView]);
        subscription.unsubscribe();
      });

      it("joins localData onto the views without decrypting again, as every autofill writes it", async () => {
        const decrypt = jest.spyOn(cipherService as any, "decryptCiphersWithSdk");
        const localData$ = new BehaviorSubject<Record<CipherId, LocalData>>({});
        jest.spyOn(cipherService, "localData$").mockReturnValue(localData$);
        const views$ = cipherService.cipherListViewsIncludingRestricted$(mockUserId);
        await firstValueFrom(views$);

        localData$.next({ ["normal" as CipherId]: { lastUsedDate: 1_000 } });
        const [view] = await firstValueFrom(views$);

        expect(view.localData?.lastUsedDate).toEqual(new Date(1_000).toISOString());
        expect(decrypt).toHaveBeenCalledTimes(1);
      });
    });

    it("getAllDecrypted excludes partial ciphers (all imperative consumers: export, reports, autofill, CLI...)", async () => {
      jest
        .spyOn(cipherService as any, "getAllDecryptedIncludingRestricted")
        .mockResolvedValue([normal, partial]);

      const result = await cipherService.getAllDecrypted(mockUserId);

      expect(result).toEqual([normal]);
    });

    it("getAllDecryptedCiphersOfType excludes partial ciphers (autofill card/identity suggestions)", async () => {
      const card = { type: { card: {} } };
      (cipherService as any).cipherListViewsIncludingRestricted$ = jest.fn().mockReturnValue(
        of([
          { ...card, id: "card-normal", partial: false },
          { ...card, id: "card-partial", partial: true },
          { type: { login: {} }, id: "login", partial: false },
        ]),
      );
      const normalCard = new CipherView(encryptionContext.cipher);
      const decryptIds = jest
        .spyOn(cipherService as any, "decryptIds")
        .mockResolvedValue([normalCard]);

      const result = await (cipherService as any).getAllDecryptedCiphersOfType(
        [CipherType.Card],
        mockUserId,
      );

      // Only the matching, non-partial cipher is fully decrypted.
      expect(decryptIds).toHaveBeenCalledWith(mockUserId, ["card-normal"]);
      expect(result).toEqual([normalCard]);
    });
  });

  describe("updateWithServer() routing", () => {
    const cipherId = cipherData.id as CipherId;
    const restrictedData = { ...cipherData, partialData: "{}" } as CipherData;
    const sdkResult = new CipherView();

    /** A decrypted view of the cipher: the request, the stored copy, or a supplied original. */
    const view = (overrides: Partial<CipherView> = {}): CipherView =>
      Object.assign(new CipherView(), {
        id: cipherId,
        type: CipherType.Login,
        name: "name",
        login: new LoginView(),
        edit: true,
        favorite: false,
        ...overrides,
      });

    const store = (data: CipherData) =>
      stateProvider.singleUser.getFake(userId, ENCRYPTED_CIPHERS).nextState({ [cipherId]: data });

    const expectNoSdkWrite = () => {
      expect(cipherSdkService.updateWithServer).not.toHaveBeenCalled();
      expect(cipherSdkService.updateUserFieldsWithServer).not.toHaveBeenCalled();
      expect(cipherSdkService.updateWithRevealedOriginal).not.toHaveBeenCalled();
    };

    beforeEach(() => {
      cipherSdkService.updateWithServer.mockResolvedValue(sdkResult);
      cipherSdkService.updateUserFieldsWithServer.mockResolvedValue(sdkResult);
      cipherSdkService.updateWithRevealedOriginal.mockResolvedValue(sdkResult);
      // The stored copy of a restricted cipher decrypts to a restricted view.
      jest.spyOn(cipherService, "decrypt").mockImplementation(async () => view({ partial: true }));
    });

    it("keeps the admin path for an admin edit, restricted or not (row 0)", async () => {
      store(restrictedData);
      const request = view({ partial: true, name: "changed" });
      const original = view();

      await cipherService.updateWithServer(request, userId, original, true);

      expect(cipherSdkService.updateWithServer).toHaveBeenCalledWith(
        request,
        userId,
        original,
        true,
      );
    });

    it("saves user fields of a restricted view when only they changed (row 1)", async () => {
      store(restrictedData);
      const request = view({ partial: true, favorite: true, folderId: cipherData.folderId });
      const clearCacheSpy = jest.spyOn(cipherService, "clearCache");

      const result = await cipherService.updateWithServer(request, userId);

      expect(cipherSdkService.updateUserFieldsWithServer).toHaveBeenCalledWith(request, userId);
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
      expect(cipherSdkService.updateWithServer).not.toHaveBeenCalled();
      expect(result).toBe(sdkResult);
    });

    it("refuses any other change to a restricted view, with no network call (row 1)", async () => {
      store(restrictedData);

      await expect(
        cipherService.updateWithServer(view({ partial: true, name: "changed" }), userId),
      ).rejects.toThrow(RestrictedCipherWriteError);

      expectNoSdkWrite();
    });

    it("refuses a restricted view with no stored copy to compare against (row 1)", async () => {
      stateProvider.singleUser.getFake(userId, ENCRYPTED_CIPHERS).nextState({});

      await expect(
        cipherService.updateWithServer(view({ partial: true, favorite: true }), userId),
      ).rejects.toThrow(RestrictedCipherWriteError);

      expectNoSdkWrite();
    });

    it("saves user fields when the user cannot edit the item (row 2)", async () => {
      store(cipherData);
      const request = view({ edit: false, favorite: true });

      await cipherService.updateWithServer(request, userId);

      expect(cipherSdkService.updateUserFieldsWithServer).toHaveBeenCalledWith(request, userId);
      expect(cipherSdkService.updateWithServer).not.toHaveBeenCalled();
    });

    it("edits against the stored original when it is full (row 3)", async () => {
      store(cipherData);
      const request = view({ name: "changed" });
      const original = view();

      await cipherService.updateWithServer(request, userId, original);

      expect(cipherSdkService.updateWithServer).toHaveBeenCalledWith(
        request,
        userId,
        original,
        undefined,
      );
      expect(cipherSdkService.updateWithRevealedOriginal).not.toHaveBeenCalled();
    });

    it("edits a restricted stored cipher against the supplied full original (row 3)", async () => {
      store(restrictedData);
      const request = view({ name: "changed" });
      const original = view();
      const clearCacheSpy = jest.spyOn(cipherService, "clearCache");

      const result = await cipherService.updateWithServer(request, userId, original);

      expect(cipherSdkService.updateWithRevealedOriginal).toHaveBeenCalledWith(
        request,
        original,
        userId,
      );
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
      expect(cipherSdkService.updateWithServer).not.toHaveBeenCalled();
      expect(result).toBe(sdkResult);
    });

    it.each([
      ["no original", undefined],
      ["a restricted original", view({ partial: true })],
      ["an original of another cipher", view({ id: "6ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b29" })],
    ])("refuses a restricted stored cipher given %s (row 3)", async (_, original) => {
      store(restrictedData);

      await expect(
        cipherService.updateWithServer(view({ name: "changed" }), userId, original),
      ).rejects.toThrow(RestrictedCipherWriteError);

      expectNoSdkWrite();
    });

    it("sends deletes and restores of a restricted cipher to the server unchecked", async () => {
      store(restrictedData);

      await cipherService.deleteWithServer(cipherId, userId);
      await cipherService.softDeleteWithServer(cipherId, userId);
      await cipherService.restoreWithServer(cipherId, userId);

      expect(cipherSdkService.deleteWithServer).toHaveBeenCalledWith(cipherId, userId, false);
      expect(cipherSdkService.softDeleteWithServer).toHaveBeenCalledWith(cipherId, userId, false);
      expect(cipherSdkService.restoreWithServer).toHaveBeenCalledWith(cipherId, userId, false);
    });
  });

  describe("getDecryptedAttachmentBuffer", () => {
    const mockEncryptedContent = new Uint8Array([1, 2, 3]);
    const mockDecryptedContent = new Uint8Array([4, 5, 6]);

    it("should use SDK to decrypt", async () => {
      const cipher = new Cipher(cipherData);
      const attachment = new AttachmentView(cipher.attachments![0]);

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
  });

  describe("shareWithServer()", () => {
    it("should delegate to cipherSdkService", async () => {
      const expectedCipher = new Cipher(cipherData);
      expectedCipher.organizationId = orgId;
      const cipherView = new CipherView(expectedCipher);
      cipherView.organizationId = null; // Ensure organizationId is null for this test
      const collectionIds = ["collection1", "collection2"] as CollectionId[];

      const sdkCipherView = new CipherView(expectedCipher);
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "shareWithServer")
        .mockResolvedValue(sdkCipherView);
      cipherEncryptionService.encrypt.mockResolvedValue({
        cipher: expectedCipher,
        encryptedFor: userId,
      });
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      const result = await cipherService.shareWithServer(cipherView, orgId, collectionIds, userId);

      expect(sdkServiceSpy).toHaveBeenCalledWith(
        cipherView,
        orgId,
        collectionIds,
        userId,
        undefined,
      );
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedCipher);
    });

    it("should pass originalCipherView to cipherSdkService", async () => {
      const expectedCipher = new Cipher(cipherData);
      const cipherView = new CipherView(expectedCipher);
      cipherView.organizationId = null;
      const originalCipherView = new CipherView(expectedCipher);
      originalCipherView.name = "Original Cipher";
      const collectionIds = ["collection1"] as CollectionId[];

      const sdkCipherView = new CipherView(expectedCipher);
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "shareWithServer")
        .mockResolvedValue(sdkCipherView);
      cipherEncryptionService.encrypt.mockResolvedValue({
        cipher: expectedCipher,
        encryptedFor: userId,
      });

      await cipherService.shareWithServer(
        cipherView,
        orgId,
        collectionIds,
        userId,
        originalCipherView,
      );

      expect(sdkServiceSpy).toHaveBeenCalledWith(
        cipherView,
        orgId,
        collectionIds,
        userId,
        originalCipherView,
      );
    });

    it("should throw when cipher already has organization", async () => {
      const expectedCipher = new Cipher(cipherData);
      expectedCipher.organizationId = orgId;
      const cipherView = new CipherView(expectedCipher);
      cipherView.organizationId = orgId; // Cipher already has organization
      const collectionIds = ["collection1"] as CollectionId[];

      await expect(
        cipherService.shareWithServer(cipherView, orgId, collectionIds, userId),
      ).rejects.toThrow("Cipher is already associated with an organization.");
    });
  });

  describe("shareManyWithServer()", () => {
    it("should delegate to cipherSdkService", async () => {
      const cipherView1 = new CipherView(new Cipher(cipherData));
      cipherView1.organizationId = null;
      const cipherView2 = new CipherView(new Cipher(cipherData));
      cipherView2.organizationId = null;
      const collectionIds = ["collection1"] as CollectionId[];

      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "shareManyWithServer")
        .mockResolvedValue([]);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      await cipherService.shareManyWithServer(
        [cipherView1, cipherView2],
        orgId,
        collectionIds,
        userId,
      );

      expect(sdkServiceSpy).toHaveBeenCalledWith(
        [cipherView1, cipherView2],
        orgId,
        collectionIds,
        userId,
      );
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
    });

    it("should throw when any cipher already has organization", async () => {
      const cipherView1 = new CipherView(new Cipher(cipherData));
      cipherView1.organizationId = null;
      const cipherView2 = new CipherView(new Cipher(cipherData));
      cipherView2.organizationId = orgId; // Second cipher already has organization
      const collectionIds = ["collection1"] as CollectionId[];

      await expect(
        cipherService.shareManyWithServer([cipherView1, cipherView2], orgId, collectionIds, userId),
      ).rejects.toThrow("Cipher is already associated with an organization.");
    });
  });

  describe("decryptCiphersWithSdk", () => {
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
    });

    it("should use the SDK for decryption and mark failures", async () => {
      const successListView = { id: cipher1_id, name: "Success 1" } as unknown as CipherListView;
      cipherEncryptionService.decryptManyWithFailures.mockResolvedValue([
        [successListView],
        [mockCiphers[1]],
      ]);

      const [successes, failures] = await (cipherService as any).decryptCiphersWithSdk(
        mockCiphers,
        userId,
      );

      expect(cipherEncryptionService.decryptManyWithFailures).toHaveBeenCalledWith(
        mockCiphers,
        userId,
      );
      expect(successes).toEqual([successListView]);
      expect(failures).toHaveLength(1);
      expect(failures[0].id).toBe(cipher2_id);
      expect(failures[0].decryptionFailure).toBe(true);
    });

    it("excludes ciphers with no key for their org before calling into the SDK", async () => {
      const missingOrgId = "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as OrganizationId;
      const orphanedCipher = new Cipher({
        ...cipherData,
        id: "33333333-3333-3333-3333-333333333333",
        organizationId: missingOrgId,
      });
      cipherEncryptionService.decryptManyWithFailures.mockResolvedValue([[], []]);

      await (cipherService as any).decryptCiphersWithSdk([...mockCiphers, orphanedCipher], userId);

      // The orphaned cipher is dropped before the SDK is ever asked to decrypt it.
      expect(cipherEncryptionService.decryptManyWithFailures).toHaveBeenCalledWith(
        mockCiphers,
        userId,
      );
    });

    it("passes PAM-gated ciphers through the SDK like any other cipher", async () => {
      const gatedCipher = new Cipher({ ...cipherData, id: cipher1_id, organizationId: orgId });
      gatedCipher.partialData = '{"Name":"enc-name"}';
      const normalCipher = new Cipher({ ...cipherData, id: cipher2_id, organizationId: orgId });
      cipherEncryptionService.decryptManyWithFailures.mockResolvedValue([
        [
          { id: cipher1_id, name: "Gated item", partial: true } as unknown as CipherListView,
          { id: cipher2_id, name: "Normal item" } as unknown as CipherListView,
        ],
        [],
      ]);

      const [successes] = await (cipherService as any).decryptCiphersWithSdk(
        [gatedCipher, normalCipher],
        userId,
      );

      expect(cipherEncryptionService.decryptManyWithFailures).toHaveBeenCalledWith(
        [gatedCipher, normalCipher],
        userId,
      );
      expect(successes.map((c: CipherListView) => c.name)).toEqual(["Gated item", "Normal item"]);
    });
  });

  describe("softDelete", () => {
    it("clears archivedDate when soft deleting", async () => {
      const cipherId = "cipher-id-1" as CipherId;
      const archivedCipher = {
        ...cipherData,
        id: cipherId,
        archivedDate: "2024-01-01T12:00:00.000Z",
      } as CipherData;

      const ciphers = { [cipherId]: archivedCipher } as Record<CipherId, CipherData>;
      stateProvider.singleUser.getFake(mockUserId, ENCRYPTED_CIPHERS).nextState(ciphers);

      await cipherService.softDelete(cipherId, mockUserId);

      const result = await firstValueFrom(
        stateProvider.singleUser.getFake(mockUserId, ENCRYPTED_CIPHERS).state$,
      );
      expect(result[cipherId].archivedDate).toEqual("2024-01-01T12:00:00.000Z");
      expect(result[cipherId].deletedDate).toBeDefined();
    });
  });

  describe("deleteWithServer()", () => {
    const testCipherId = "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId;

    it("should use SDK to delete cipher", async () => {
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "deleteWithServer")
        .mockResolvedValue(undefined);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      await cipherService.deleteWithServer(testCipherId, userId, false);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testCipherId, userId, false);
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
    });

    it("should use SDK admin delete when asAdmin is true", async () => {
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "deleteWithServer")
        .mockResolvedValue(undefined);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      await cipherService.deleteWithServer(testCipherId, userId, true);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testCipherId, userId, true);
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
    });
  });

  describe("deleteManyWithServer()", () => {
    const testCipherIds = [
      "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId,
      "6ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b23" as CipherId,
    ];

    it("should use SDK to delete multiple ciphers", async () => {
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "deleteManyWithServer")
        .mockResolvedValue(undefined);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      await cipherService.deleteManyWithServer(testCipherIds, userId, false);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testCipherIds, userId, false, undefined);
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
    });

    it("should use SDK admin delete many when asAdmin is true", async () => {
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "deleteManyWithServer")
        .mockResolvedValue(undefined);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      await cipherService.deleteManyWithServer(testCipherIds, userId, true, orgId);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testCipherIds, userId, true, orgId);
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
    });
  });

  describe("deleteAttachmentWithServer()", () => {
    const testCipherId = "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId;
    const testAttachmentId = "a1";

    it("should clearCache and use SDK", async () => {
      const updatedCipher = new Cipher(cipherData);
      updatedCipher.revisionDate = new Date("2026-04-23T12:00:00.000Z");

      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "deleteAttachmentWithServer")
        .mockResolvedValue(updatedCipher);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      const result = await cipherService.deleteAttachmentWithServer(
        testCipherId,
        testAttachmentId,
        userId,
      );

      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
      expect(sdkServiceSpy).toHaveBeenCalledWith(testCipherId, testAttachmentId, userId, false);
      expect(result).toEqual(updatedCipher.toCipherData());
    });

    it("should clearCache and use SDK admin path when admin is true", async () => {
      const updatedCipher = new Cipher(cipherData);
      updatedCipher.revisionDate = new Date("2026-04-23T12:00:00.000Z");

      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "deleteAttachmentWithServer")
        .mockResolvedValue(updatedCipher);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      const result = await cipherService.deleteAttachmentWithServer(
        testCipherId,
        testAttachmentId,
        userId,
        true,
      );

      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
      expect(sdkServiceSpy).toHaveBeenCalledWith(testCipherId, testAttachmentId, userId, true);
      expect(result).toEqual(updatedCipher.toCipherData());
    });
  });

  describe("upgradeOldCipherAttachments()", () => {
    it("should return cipher unchanged when there are no old attachments", async () => {
      const view = new CipherView(new Cipher(cipherData));
      view.attachments = [];

      const apiSpy = jest.spyOn(apiService, "getAttachmentData");

      const result = await cipherService.upgradeOldCipherAttachments(view, userId);

      expect(result).toBe(view);
      expect(apiSpy).not.toHaveBeenCalled();
    });

    it("routes each legacy attachment through upgradeAttachment", async () => {
      const view = new CipherView(new Cipher(cipherData));
      const legacyAttachment = new AttachmentView();
      legacyAttachment.id = "legacy-attachment-id";
      legacyAttachment.fileName = "legacy.txt";
      legacyAttachment.key = null;
      view.attachments = [legacyAttachment];

      // The SDK returns the decrypted, post-upgrade view.
      const upgradedView = new CipherView(new Cipher(cipherData));
      cipherSdkService.upgradeAttachment.mockResolvedValue(upgradedView);

      jest.spyOn(cipherService, "get").mockResolvedValue(new Cipher(cipherData));
      const decryptSpy = jest.spyOn(cipherService, "decrypt");

      const apiSpy = jest.spyOn(apiService, "getAttachmentData");

      const result = await cipherService.upgradeOldCipherAttachments(view, userId);

      expect(cipherSdkService.upgradeAttachment).toHaveBeenCalledWith(
        view.id,
        "legacy-attachment-id",
        userId,
      );
      // Returns the SDK's view directly — no re-fetch/re-decrypt round-trip.
      expect(result).toBe(upgradedView);
      expect(decryptSpy).not.toHaveBeenCalled();
      // The SDK owns the re-upload and the legacy delete; the client does not upload.
      expect(cipherFileUploadService.uploadPrepared).not.toHaveBeenCalled();
      expect(apiSpy).not.toHaveBeenCalled();
    });
  });

  describe("softDeleteWithServer()", () => {
    const testCipherId = "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId;

    it("should use SDK to soft delete cipher", async () => {
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "softDeleteWithServer")
        .mockResolvedValue(undefined);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      await cipherService.softDeleteWithServer(testCipherId, userId, false);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testCipherId, userId, false);
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
    });

    it("should use SDK admin soft delete when asAdmin is true", async () => {
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "softDeleteWithServer")
        .mockResolvedValue(undefined);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      await cipherService.softDeleteWithServer(testCipherId, userId, true);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testCipherId, userId, true);
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
    });
  });

  describe("softDeleteManyWithServer()", () => {
    const testCipherIds = [
      "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId,
      "6ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b23" as CipherId,
    ];

    it("should use SDK to soft delete multiple ciphers", async () => {
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "softDeleteManyWithServer")
        .mockResolvedValue(undefined);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      await cipherService.softDeleteManyWithServer(testCipherIds, userId, false);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testCipherIds, userId, false, undefined);
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
    });

    it("should use SDK admin soft delete many when asAdmin is true", async () => {
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "softDeleteManyWithServer")
        .mockResolvedValue(undefined);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      await cipherService.softDeleteManyWithServer(testCipherIds, userId, true, orgId);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testCipherIds, userId, true, orgId);
      expect(clearCacheSpy).toHaveBeenCalledWith(userId);
    });
  });

  describe("getAllFromApiForOrganization()", () => {
    const testOrgId = "4ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b21" as OrganizationId;

    it("should use SDK to list organization ciphers", async () => {
      const mockCipher1 = new Cipher(cipherData);
      const mockCipher2 = new Cipher(cipherData);

      const mockCipherView1 = new CipherView();
      mockCipherView1.name = "Test Cipher 1";
      const mockCipherView2 = new CipherView();
      mockCipherView2.name = "Test Cipher 2";

      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "getAllFromApiForOrganization")
        .mockResolvedValue([[mockCipher1, mockCipher2], []]);

      cipherEncryptionService.decryptManyLegacy.mockResolvedValue([
        [mockCipherView1, mockCipherView2],
        [],
      ]);

      const result = await cipherService.getAllFromApiForOrganization(testOrgId, true);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testOrgId, mockUserId, true);
      expect(cipherEncryptionService.decryptManyLegacy).toHaveBeenCalledWith(
        [mockCipher1, mockCipher2],
        mockUserId,
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(CipherView);
      expect(result[1]).toBeInstanceOf(CipherView);
    });

    it("should use SDK with includeMemberItems=false when not provided", async () => {
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "getAllFromApiForOrganization")
        .mockResolvedValue([[], []]);

      cipherEncryptionService.decryptManyLegacy.mockResolvedValue([[], []]);

      await cipherService.getAllFromApiForOrganization(testOrgId);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testOrgId, mockUserId, false);
    });
  });

  describe("getManyFromApiForOrganization()", () => {
    const testOrgId = "4ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b21" as OrganizationId;

    it("should use SDK to list assigned organization ciphers", async () => {
      const mockCipher1 = new Cipher(cipherData);
      const mockCipher2 = new Cipher(cipherData);

      const mockCipherView1 = new CipherView();
      mockCipherView1.name = "Test Cipher 1";
      const mockCipherView2 = new CipherView();
      mockCipherView2.name = "Test Cipher 2";

      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "getManyFromApiForOrganization")
        .mockResolvedValue([[mockCipher1, mockCipher2], []]);

      cipherEncryptionService.decryptManyLegacy.mockResolvedValue([
        [mockCipherView1, mockCipherView2],
        [],
      ]);

      const apiSpy = jest.spyOn(apiService, "send");

      const result = await cipherService.getManyFromApiForOrganization(testOrgId);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testOrgId, mockUserId);
      expect(apiSpy).not.toHaveBeenCalled();
      expect(cipherEncryptionService.decryptManyLegacy).toHaveBeenCalledWith(
        [mockCipher1, mockCipher2],
        mockUserId,
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(CipherView);
      expect(result[1]).toBeInstanceOf(CipherView);
    });

    it("should return empty array when SDK throws", async () => {
      jest
        .spyOn(cipherSdkService, "getManyFromApiForOrganization")
        .mockRejectedValue(new Error("SDK error"));

      const result = await cipherService.getManyFromApiForOrganization(testOrgId);

      expect(result).toEqual([]);
    });
  });

  describe("getCiphersOrganizationLogins()", () => {
    const testOrgId = "4ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b21" as OrganizationId;

    it("should return sorted successes and failures from the SDK", async () => {
      const cipherViewB = new CipherView();
      cipherViewB.name = "B Login";
      const cipherViewA = new CipherView();
      cipherViewA.name = "A Login";
      const failedCipherView = new CipherView();
      failedCipherView.decryptionFailure = true;

      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "getOrganizationLoginCiphers")
        .mockResolvedValue({ successes: [cipherViewB, cipherViewA], failures: [failedCipherView] });
      const apiSpy = jest.spyOn(apiService, "send");

      const result = await cipherService.getCiphersOrganizationLogins(testOrgId);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testOrgId, mockUserId);
      expect(apiSpy).not.toHaveBeenCalled();
      expect(result.successes.map((c) => c.name)).toEqual(["A Login", "B Login"]);
      expect(result.failures).toEqual([failedCipherView]);
    });

    it("should propagate SDK errors", async () => {
      jest
        .spyOn(cipherSdkService, "getOrganizationLoginCiphers")
        .mockRejectedValue(new Error("SDK error"));

      await expect(cipherService.getCiphersOrganizationLogins(testOrgId)).rejects.toThrow(
        "SDK error",
      );
    });
  });

  describe("bulkUpdateCollectionsWithServer()", () => {
    const testOrgId = "4ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b21" as OrganizationId;
    const testCipherIds = [
      "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId,
      "6ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b23" as CipherId,
    ];
    const testCollectionIds = ["7ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b24" as CollectionId];

    it("should use SDK to bulk update collections", async () => {
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "bulkUpdateCollectionsWithServer")
        .mockResolvedValue(undefined);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");
      const apiSpy = jest.spyOn(apiService, "send");

      await cipherService.bulkUpdateCollectionsWithServer(
        testOrgId,
        mockUserId,
        testCipherIds,
        testCollectionIds,
        true,
      );

      expect(sdkServiceSpy).toHaveBeenCalledWith(
        testOrgId,
        mockUserId,
        testCipherIds,
        testCollectionIds,
        true,
      );
      expect(clearCacheSpy).toHaveBeenCalledWith(mockUserId);
      expect(apiSpy).not.toHaveBeenCalled();
    });
  });

  describe("moveManyWithServer()", () => {
    const testCipherIds = [
      "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22",
      "6ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b23",
    ];
    const testFolderId = "7ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b24";

    it("should use SDK to move ciphers", async () => {
      const sdkServiceSpy = jest
        .spyOn(cipherSdkService, "moveManyWithServer")
        .mockResolvedValue(undefined);
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      await cipherService.moveManyWithServer(testCipherIds, testFolderId, mockUserId);

      expect(sdkServiceSpy).toHaveBeenCalledWith(testCipherIds, testFolderId, mockUserId);
      expect(clearCacheSpy).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe("getAllDecrypted()", () => {
    it("should use SDK to list and decrypt ciphers", async () => {
      const mockCipherView1 = new CipherView();
      mockCipherView1.name = "Test Cipher 1";
      const mockCipherView2 = new CipherView();
      mockCipherView2.name = "Test Cipher 2";

      const sdkServiceSpy = jest.spyOn(cipherSdkService, "decryptAll").mockResolvedValue({
        successes: [mockCipherView1, mockCipherView2],
        failures: [],
      });

      const result = await cipherService.getAllDecrypted(mockUserId);

      // The encrypted ciphers in state are what the SDK decrypts.
      const [decrypted] = sdkServiceSpy.mock.calls[0];
      const inState = Object.keys(await firstValueFrom(cipherService.ciphers$(mockUserId)));
      expect(decrypted.map((cipher) => cipher.id)).toEqual(inState);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(CipherView);
      expect(result[1]).toBeInstanceOf(CipherView);
    });

    it("decrypts on every call", async () => {
      cipherSdkService.decryptAll.mockResolvedValue({
        successes: [new CipherView()],
        failures: [],
      });

      await cipherService.getAllDecrypted(mockUserId);
      await cipherService.getAllDecrypted(mockUserId);

      expect(cipherSdkService.decryptAll).toHaveBeenCalledTimes(2);
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

  describe("getAllDecrypted (SDK path) localData hydration", () => {
    beforeEach(() => {});

    it("re-attaches localData to SDK-decrypted ciphers", async () => {
      const cipherId = "test-cipher-id" as CipherId;
      const testLocalData = {
        lastLaunched: Date.now().valueOf(),
        lastUsedDate: Date.now().valueOf() - 1000,
      };
      jest.spyOn(cipherService, "localData$").mockReturnValue(of({ [cipherId]: testLocalData }));

      const sdkView = new CipherView();
      sdkView.id = cipherId;
      sdkView.localData = undefined;
      cipherSdkService.decryptAll.mockResolvedValue({ successes: [sdkView], failures: [] });

      const [result] = await cipherService.getAllDecrypted(userId);

      expect(result.localData).toEqual(testLocalData);
    });

    it("still returns ciphers when localData retrieval fails", async () => {
      const cipherId = "test-cipher-id" as CipherId;
      jest
        .spyOn(cipherService, "localData$")
        .mockReturnValue(throwError(() => new Error("localData unavailable")));

      const sdkView = new CipherView();
      sdkView.id = cipherId;
      cipherSdkService.decryptAll.mockResolvedValue({ successes: [sdkView], failures: [] });

      const result = await cipherService.getAllDecrypted(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(cipherId);
    });
  });

  describe("decrypting only the ciphers needed", () => {
    const otherId = "other-cipher-id" as CipherId;
    const id = cipherData.id as CipherId;
    const viewOf = (viewId: string, partial = false) =>
      Object.assign(new CipherView(), { id: viewId, partial });

    beforeEach(() => {
      stateProvider.singleUser.getFake(mockUserId, ENCRYPTED_CIPHERS).nextState({
        [id]: cipherData,
        [otherId]: { ...cipherData, id: otherId },
      } as Record<CipherId, CipherData>);
      keyService.cipherDecryptionKeys$.mockReturnValue(of({} as CipherDecryptionKeys));
      (cipherService as any).cipherListViewsIncludingRestricted$ = jest
        .fn()
        .mockReturnValue(of([{ id }, { id: otherId }]));
    });

    it("getAllDecryptedForUrl fully decrypts the matching ciphers only, never the whole vault", async () => {
      jest.spyOn(cipherService, "filterCiphersForUrl").mockResolvedValue([{ id } as any]);
      cipherSdkService.decryptAll.mockResolvedValue({ successes: [viewOf(id)], failures: [] });
      const wholeVault = jest.spyOn(cipherService as any, "getAllDecryptedIncludingRestricted");

      const result = await cipherService.getAllDecryptedForUrl("https://example.com", mockUserId);

      const [decrypted] = cipherSdkService.decryptAll.mock.calls[0];
      expect(decrypted.map((cipher) => cipher.id)).toEqual([id]);
      expect(result.map((cipher) => cipher.id)).toEqual([id]);
      expect(wholeVault).not.toHaveBeenCalled();
    });

    it("getAllDecryptedForIds keeps the requested order and drops partial ciphers", async () => {
      cipherSdkService.decryptAll.mockResolvedValue({
        successes: [viewOf(id, true), viewOf(otherId)],
        failures: [],
      });

      const result = await cipherService.getAllDecryptedForIds(mockUserId, [otherId, id]);

      expect(result.map((cipher) => cipher.id)).toEqual([otherId]);
    });
  });

  describe("getCipherForUrl localData freshness", () => {
    beforeEach(() => {
      Object.defineProperty(autofillSettingsService, "autofillOnPageLoadDefault$", {
        value: of(true),
        writable: true,
      });
    });

    it("re-hydrates localData at call time so the launch flow selects the correct cipher", async () => {
      const cipherId = "test-cipher-id" as CipherId;
      const freshLocalData = {
        lastLaunched: Date.now().valueOf(),
        lastUsedDate: Date.now().valueOf() - 1000,
      };
      jest.spyOn(cipherService, "localData$").mockReturnValue(of({ [cipherId]: freshLocalData }));

      // Simulate a view whose localData has not yet propagated through cipherViews$.
      const staleView = new CipherView();
      staleView.id = cipherId;
      staleView.localData = null;
      jest.spyOn(cipherService, "getAllDecryptedForUrl").mockResolvedValue([staleView]);

      const result = await cipherService.getLastLaunchedForUrl("https://example.com", userId, true);

      expect(result.localData).toEqual(freshLocalData);
    });
  });

  describe("saveCollectionsWithServerAdmin()", () => {
    const collectionIds = ["col-id-1", "col-id-2"];
    let cipher: Cipher;

    beforeEach(() => {
      cipher = new Cipher(cipherData);
      cipher.collectionIds = collectionIds;
    });

    it("should delegate to cipherSdkService", async () => {
      const sdkCipherView = new CipherView(cipher);
      const encryptedCipher = new Cipher(cipherData);

      jest
        .spyOn(cipherSdkService, "saveCollectionsWithServerAdmin")
        .mockResolvedValue(sdkCipherView);
      cipherEncryptionService.encrypt.mockResolvedValue({
        cipher: encryptedCipher,
        encryptedFor: mockUserId,
      });
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      const result = await cipherService.saveCollectionsWithServerAdmin(cipher);

      expect(cipherSdkService.saveCollectionsWithServerAdmin).toHaveBeenCalledWith(
        cipher.id,
        collectionIds,
        mockUserId,
      );
      expect(clearCacheSpy).toHaveBeenCalledWith(mockUserId);
      expect(cipherEncryptionService.encrypt).toHaveBeenCalledWith(sdkCipherView, mockUserId);
      expect(result).toBe(encryptedCipher);
    });
  });

  describe("saveCollectionsWithServer()", () => {
    const collectionIds = ["col-id-1", "col-id-2"];
    let cipher: Cipher;

    beforeEach(() => {
      cipher = new Cipher(cipherData);
      cipher.collectionIds = collectionIds;
    });

    it("should delegate to cipherSdkService", async () => {
      const sdkCipherView = new CipherView(cipher);
      const encryptedCipher = new Cipher(cipherData);

      jest.spyOn(cipherSdkService, "saveCollectionsWithServer").mockResolvedValue(sdkCipherView);
      cipherEncryptionService.encrypt.mockResolvedValue({
        cipher: encryptedCipher,
        encryptedFor: mockUserId,
      });
      const clearCacheSpy = jest.spyOn(cipherService as any, "clearCache");

      const result = await cipherService.saveCollectionsWithServer(cipher, mockUserId);

      expect(cipherSdkService.saveCollectionsWithServer).toHaveBeenCalledWith(
        cipher.id,
        collectionIds,
        mockUserId,
      );
      expect(clearCacheSpy).toHaveBeenCalledWith(mockUserId);
      expect(cipherEncryptionService.encrypt).toHaveBeenCalledWith(sdkCipherView, mockUserId);
      expect(result).toBe(encryptedCipher);
    });

    it("should delete the cipher locally and return undefined when it is no longer available", async () => {
      jest.spyOn(cipherSdkService, "saveCollectionsWithServer").mockResolvedValue(undefined);
      const deleteSpy = jest.spyOn(cipherService, "delete").mockResolvedValue(undefined);

      const result = await cipherService.saveCollectionsWithServer(cipher, mockUserId);

      expect(deleteSpy).toHaveBeenCalledWith(cipher.id, mockUserId);
      expect(cipherEncryptionService.encrypt).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });
});
