import { runMigrator } from "../migration-helper.spec";

import { MigrateIncorrectFolderKey } from "./69-migrate-incorrect-folder-key";

function exampleJSON() {
  return {
    global_account_accounts: {
      user1: null as any,
      user2: null as any,
    },
    user_user1_folder_folder: {
      // Incorrect "folder" key
      folderId1: {
        id: "folderId1",
        name: "folder-name-1",
        revisionDate: "folder-revision-date-1",
      },
      folderId2: {
        id: "folderId2",
        name: "folder-name-2",
        revisionDate: "folder-revision-date-2",
      },
    },
    user_user2_folder_folder: null as any,
  };
}

describe("MigrateIncorrectFolderKey", () => {
  const sut = new MigrateIncorrectFolderKey(68, 69);
  it("migrates data", async () => {
    const output = await runMigrator(sut, exampleJSON());

    expect(output).toEqual({
      global_account_accounts: {
        user1: null,
        user2: null,
      },
      user_user1_folder_folders: {
        // Correct "folders" key
        folderId1: {
          id: "folderId1",
          name: "folder-name-1",
          revisionDate: "folder-revision-date-1",
        },
        folderId2: {
          id: "folderId2",
          name: "folder-name-2",
          revisionDate: "folder-revision-date-2",
        },
      },
    });
  });

  it("rolls back data", async () => {
    const output = await runMigrator(
      sut,
      {
        global_account_accounts: {
          user1: null,
          user2: null,
        },
        user_user1_folder_folders: {
          folderId1: {
            id: "folderId1",
            name: "folder-name-1",
            revisionDate: "folder-revision-date-1",
          },
          folderId2: {
            id: "folderId2",
            name: "folder-name-2",
            revisionDate: "folder-revision-date-2",
          },
        },
      },
      "rollback",
    );

    expect(output).toEqual({
      global_account_accounts: {
        user1: null,
        user2: null,
      },
      user_user1_folder_folder: {
        // Incorrect "folder" key
        folderId1: {
          id: "folderId1",
          name: "folder-name-1",
          revisionDate: "folder-revision-date-1",
        },
        folderId2: {
          id: "folderId2",
          name: "folder-name-2",
          revisionDate: "folder-revision-date-2",
        },
      },
    });
  });
});
