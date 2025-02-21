import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { KeyService } from "@bitwarden/key-management";

import { makeEncString } from "../../../../spec";
import { FakeAccountService, mockAccountServiceWith } from "../../../../spec/fake-account-service";
import { FakeSingleUserState } from "../../../../spec/fake-state";
import { FakeStateProvider } from "../../../../spec/fake-state-provider";
import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { Utils } from "../../../platform/misc/utils";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { CipherService } from "../../abstractions/cipher.service";
import { FolderData } from "../../models/data/folder.data";
import { FolderView } from "../../models/view/folder.view";
import { FolderService } from "../../services/folder/folder.service";
import { FOLDER_DECRYPTED_FOLDERS, FOLDER_ENCRYPTED_FOLDERS } from "../key-state/folder.state";

describe("Folder Service", () => {
  let folderService: FolderService;

  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let i18nService: MockProxy<I18nService>;
  let cipherService: MockProxy<CipherService>;
  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let folderState: FakeSingleUserState<Record<string, FolderData>>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    i18nService = mock<I18nService>();
    cipherService = mock<CipherService>();

    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    i18nService.collator = new Intl.Collator("en");
    i18nService.t.mockReturnValue("No Folder");

    keyService.userKey$.mockReturnValue(new BehaviorSubject("mockOriginalUserKey" as any));
    encryptService.decryptToUtf8.mockResolvedValue("DEC");

    folderService = new FolderService(
      keyService,
      encryptService,
      i18nService,
      cipherService,
      stateProvider,
    );

    folderState = stateProvider.singleUser.getFake(mockUserId, FOLDER_ENCRYPTED_FOLDERS);

    // Initial state
    folderState.nextState({ "1": folderData("1") });
  });

  describe("folders$", () => {
    it("emits encrypted folders from state", async () => {
      const folder1 = folderData("1");
      const folder2 = folderData("2");

      await stateProvider.setUserState(
        FOLDER_ENCRYPTED_FOLDERS,
        Object.fromEntries([folder1, folder2].map((f) => [f.id, f])),
        mockUserId,
      );

      const result = await firstValueFrom(folderService.folders$(mockUserId));

      expect(result.length).toBe(2);
      expect(result).toContainPartialObjects([
        { id: "1", name: makeEncString("ENC_STRING_1") },
        { id: "2", name: makeEncString("ENC_STRING_2") },
      ]);
    });
  });

  describe("folderView$", () => {
    it("emits decrypted folders from state", async () => {
      const folder1 = folderData("1");
      const folder2 = folderData("2");

      await stateProvider.setUserState(
        FOLDER_ENCRYPTED_FOLDERS,
        Object.fromEntries([folder1, folder2].map((f) => [f.id, f])),
        mockUserId,
      );

      const result = await firstValueFrom(folderService.folderViews$(mockUserId));

      expect(result.length).toBe(3);
      expect(result).toContainPartialObjects([
        { id: "1", name: "DEC" },
        { id: "2", name: "DEC" },
        { name: "No Folder" },
      ]);
    });
  });

  it("encrypt", async () => {
    const model = new FolderView();
    model.id = "2";
    model.name = "Test Folder";

    encryptService.encrypt.mockResolvedValue(new EncString("ENC"));

    const result = await folderService.encrypt(model, null);

    expect(result).toEqual({
      id: "2",
      name: {
        encryptedString: "ENC",
        encryptionType: 0,
      },
    });
  });

  describe("get", () => {
    it("exists", async () => {
      const result = await folderService.get("1", mockUserId);

      expect(result).toEqual({
        id: "1",
        name: makeEncString("ENC_STRING_" + 1),
        revisionDate: null,
      });
    });

    it("not exists", async () => {
      const result = await folderService.get("2", mockUserId);

      expect(result).toBe(undefined);
    });
  });

  it("upsert", async () => {
    await folderService.upsert(folderData("2"), mockUserId);

    expect(await firstValueFrom(folderService.folders$(mockUserId))).toEqual([
      {
        id: "1",
        name: makeEncString("ENC_STRING_" + 1),
        revisionDate: null,
      },
      {
        id: "2",
        name: makeEncString("ENC_STRING_" + 2),
        revisionDate: null,
      },
    ]);
  });

  it("replace", async () => {
    await folderService.replace({ "4": folderData("4") }, mockUserId);

    expect(await firstValueFrom(folderService.folders$(mockUserId))).toEqual([
      {
        id: "4",
        name: makeEncString("ENC_STRING_" + 4),
        revisionDate: null,
      },
    ]);
  });

  it("delete", async () => {
    await folderService.delete("1", mockUserId);

    expect((await firstValueFrom(folderService.folders$(mockUserId))).length).toBe(0);
  });

  describe("clearDecryptedFolderState", () => {
    it("null userId", async () => {
      await expect(folderService.clearDecryptedFolderState(null)).rejects.toThrow(
        "User ID is required.",
      );
    });

    it("userId provided", async () => {
      await folderService.clearDecryptedFolderState(mockUserId);

      expect((await firstValueFrom(folderService.folders$(mockUserId))).length).toBe(1);
      expect(
        (await firstValueFrom(stateProvider.getUserState$(FOLDER_DECRYPTED_FOLDERS, mockUserId)))
          .length,
      ).toBe(0);
    });
  });

  it("clear", async () => {
    await folderService.clear(mockUserId);

    expect((await firstValueFrom(folderService.folders$(mockUserId))).length).toBe(0);

    const folderViews = await firstValueFrom(folderService.folderViews$(mockUserId));
    expect(folderViews.length).toBe(1);
    expect(folderViews[0].id).toBeNull(); // Should be the "No Folder" folder
  });

  describe("getRotatedData", () => {
    const originalUserKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
    const newUserKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
    let encryptedKey: EncString;

    beforeEach(() => {
      encryptedKey = new EncString("Re-encrypted Folder");
      encryptService.encrypt.mockResolvedValue(encryptedKey);
    });

    it("returns re-encrypted user folders", async () => {
      const result = await folderService.getRotatedData(originalUserKey, newUserKey, mockUserId);

      expect(result[0]).toMatchObject({ id: "1", name: "Re-encrypted Folder" });
    });

    it("throws if the new user key is null", async () => {
      await expect(folderService.getRotatedData(originalUserKey, null, mockUserId)).rejects.toThrow(
        "New user key is required for rotation.",
      );
    });
  });

  function folderData(id: string) {
    const data = new FolderData({} as any);
    data.id = id;
    data.name = makeEncString("ENC_STRING_" + data.id).encryptedString;

    return data;
  }
});
