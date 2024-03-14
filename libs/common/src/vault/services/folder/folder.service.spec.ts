import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { makeStaticByteArray } from "../../../../spec";
import { FakeAccountService, mockAccountServiceWith } from "../../../../spec/fake-account-service";
import { FakeActiveUserState } from "../../../../spec/fake-state";
import { FakeStateProvider } from "../../../../spec/fake-state-provider";
import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../platform/abstractions/encrypt.service";
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
import { FOLDER_ENCRYPTED_FOLDERS } from "../key-state/folder.state";

describe("Folder Service", () => {
  let folderService: FolderService;

  let cryptoService: MockProxy<CryptoService>;
  let encryptService: MockProxy<EncryptService>;
  let i18nService: MockProxy<I18nService>;
  let cipherService: MockProxy<CipherService>;
  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let folderState: FakeActiveUserState<Record<string, FolderData>>;

  beforeEach(() => {
    cryptoService = mock<CryptoService>();
    encryptService = mock<EncryptService>();
    i18nService = mock<I18nService>();
    cipherService = mock<CipherService>();

    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    i18nService.collator = new Intl.Collator("en");

    cryptoService.hasUserKey.mockResolvedValue(true);
    cryptoService.getUserKeyWithLegacySupport.mockResolvedValue(
      new SymmetricCryptoKey(makeStaticByteArray(32)) as UserKey,
    );
    encryptService.decryptToUtf8.mockResolvedValue("DEC");

    folderService = new FolderService(cryptoService, i18nService, cipherService, stateProvider);

    folderState = stateProvider.activeUser.getFake(FOLDER_ENCRYPTED_FOLDERS);

    // Initial state
    folderState.nextState({ "1": folderData("1", "test") });
  });

  it("encrypt", async () => {
    const model = new FolderView();
    model.id = "2";
    model.name = "Test Folder";

    cryptoService.encrypt.mockResolvedValue(new EncString("ENC"));

    const result = await folderService.encrypt(model);

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
      const result = await folderService.get("1");

      expect(result).toEqual({
        id: "1",
        name: {
          encryptedString: "test",
          encryptionType: 0,
        },
        revisionDate: null,
      });
    });

    it("not exists", async () => {
      const result = await folderService.get("2");

      expect(result).toBe(undefined);
    });
  });

  it("upsert", async () => {
    await folderService.upsert(folderData("2", "test 2"));

    expect(await firstValueFrom(folderService.folders$)).toEqual([
      {
        id: "1",
        name: {
          encryptedString: "test",
          encryptionType: 0,
        },
        revisionDate: null,
      },
      {
        id: "2",
        name: {
          encryptedString: "test 2",
          encryptionType: 0,
        },
        revisionDate: null,
      },
    ]);
  });

  it("replace", async () => {
    await folderService.replace({ "2": folderData("2", "test 2") });

    expect(await firstValueFrom(folderService.folders$)).toEqual([
      {
        id: "2",
        name: {
          encryptedString: "test 2",
          encryptionType: 0,
        },
        revisionDate: null,
      },
    ]);
  });

  it("delete", async () => {
    await folderService.delete("1");

    expect((await firstValueFrom(folderService.folders$)).length).toBe(0);
  });

  it("clearCache", async () => {
    await folderService.clearCache();

    expect((await firstValueFrom(folderService.folders$)).length).toBe(1);
    expect((await firstValueFrom(folderService.folderViews$)).length).toBe(0);
  });

  describe("clear", () => {
    it("null userId", async () => {
      await folderService.clear();

      expect((await firstValueFrom(folderService.folders$)).length).toBe(0);
      expect((await firstValueFrom(folderService.folderViews$)).length).toBe(0);
    });

    /**
     * TODO: Fix this test to address the problem where the fakes for the active user state is not
     * updated as expected
     */
    // it("matching userId", async () => {
    //   stateService.getUserId.mockResolvedValue("1");
    //   await folderService.clear("1" as UserId);

    //   expect((await firstValueFrom(folderService.folders$)).length).toBe(0);
    // });

    /**
     * TODO: Fix this test to address the problem where the fakes for the active user state is not
     * updated as expected
     */
    // it("mismatching userId", async () => {
    //   await folderService.clear("12" as UserId);

    //   expect((await firstValueFrom(folderService.folders$)).length).toBe(1);
    //   expect((await firstValueFrom(folderService.folderViews$)).length).toBe(2);
    // });
  });

  function folderData(id: string, name: string) {
    const data = new FolderData({} as any);
    data.id = id;
    data.name = name;

    return data;
  }
});
