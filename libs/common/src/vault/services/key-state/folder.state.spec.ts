import { mock } from "jest-mock-extended";

import { KeyService } from "../../../../../key-management/src/abstractions/key.service";
import { FolderService } from "../../abstractions/folder/folder.service.abstraction";
import { FolderData } from "../../models/data/folder.data";
import { Folder } from "../../models/domain/folder";
import { FolderView } from "../../models/view/folder.view";

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
  const folderService = mock<FolderService>();
  const sut = FOLDER_DECRYPTED_FOLDERS;
  let data: FolderData;

  beforeEach(() => {
    data = {
      id: "id",
      name: "encName",
      revisionDate: "2024-01-31T12:00:00.000Z",
    };
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
    const folderViewMock = new FolderView(new Folder(data));
    keyService.hasUserKey.mockResolvedValue(true);
    folderService.decryptFolders.mockResolvedValue([folderViewMock]);

    const encryptedFoldersState = { id: data };
    const derivedStateResult = await sut.derive(encryptedFoldersState, {
      folderService,
      keyService,
    });

    expect(derivedStateResult).toEqual([folderViewMock]);
  });
});
