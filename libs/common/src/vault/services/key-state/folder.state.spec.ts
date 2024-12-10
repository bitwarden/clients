import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";

import { KeyService } from "../../../../../key-management/src/abstractions/key.service";
import { FolderData } from "../../models/data/folder.data";

import { FOLDER_DECRYPTED_FOLDERS, FOLDER_ENCRYPTED_FOLDERS } from "./folder.state";

describe("encrypted folders", () => {
  const sut = FOLDER_ENCRYPTED_FOLDERS;

  it("should deserialize encrypted folders", async () => {
    const inputObj = {
      id: {
        id: "id",
        name: "encName",
        revisionDate: "2024-01-31T12:00:00.000Z",
      },
    };

    const expectedFolderData = {
      id: { id: "id", name: "encName", revisionDate: "2024-01-31T12:00:00.000Z" },
    };

    const result = sut.deserializer(JSON.parse(JSON.stringify(inputObj)));

    expect(result).toEqual(expectedFolderData);
  });
});

describe("derived decrypted folders", () => {
  const keyService = mock<KeyService>();
  const encryptService = mock<EncryptService>();
  const i18nService = mock<I18nService>();
  const mockUserId = Utils.newGuid() as UserId;
  const sut = FOLDER_DECRYPTED_FOLDERS;
  let data: FolderData;

  beforeEach(() => {
    data = {
      id: "id",
      name: "encName",
      revisionDate: "2024-01-31T12:00:00.000Z",
    };

    keyService.userKey$.mockReturnValue(new BehaviorSubject("mockOriginalUserKey" as any));

    i18nService.collator = new Intl.Collator("en");
    i18nService.t.mockReturnValue("No Folder");

    encryptService.decryptToUtf8.mockResolvedValue("DEC");
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should deserialize encrypted folders", async () => {
    const inputObj = [data];

    const expectedFolderView = {
      id: "id",
      name: "encName",
      revisionDate: new Date("2024-01-31T12:00:00.000Z"),
    };

    const result = sut.deserialize(JSON.parse(JSON.stringify(inputObj)));

    expect(result).toEqual([expectedFolderView]);
  });

  it("should derive encrypted folders", async () => {
    const encryptedFoldersState: [UserId, Record<string, FolderData>] = [mockUserId, { id: data }];

    const derivedStateResult = await sut.derive(encryptedFoldersState, {
      encryptService,
      i18nService,
      keyService,
    });

    expect(derivedStateResult).toHaveLength(2);
    expect(derivedStateResult[0]).toMatchObject({
      id: "id",
      name: "DEC",
    });
    expect(derivedStateResult[1]).toMatchObject({
      id: null,
      name: "No Folder",
    });
  });

  it("should return empty array when no folder data", async () => {
    const encryptedFoldersState: [UserId, Record<string, FolderData>] = [mockUserId, null];

    const derivedStateResult = await sut.derive(encryptedFoldersState, {
      encryptService,
      i18nService,
      keyService,
    });

    expect(derivedStateResult).toEqual([]);
  });

  it("should return empty array when no user key", async () => {
    keyService.userKey$.mockReturnValue(new BehaviorSubject(null));

    const encryptedFoldersState: [UserId, Record<string, FolderData>] = [mockUserId, { id: data }];

    const derivedStateResult = await sut.derive(encryptedFoldersState, {
      encryptService,
      i18nService,
      keyService,
    });

    expect(derivedStateResult).toEqual([]);
  });
});
