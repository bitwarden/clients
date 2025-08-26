import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { FolderMigrator } from "./15-move-folder-state-to-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        folders: {
          encrypted: {
            "folder-id-1": {
              id: "folder-id-1",
              name: "folder-name-1",
              revisionDate: "folder-revision-date-1",
            },
            "folder-id-2": {
              id: "folder-id-2",
              name: "folder-name-2",
              revisionDate: "folder-revision-date-2",
            },
          },
        },
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      data: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    "user_user-1_folder_folders": {
      "folder-id-1": {
        id: "folder-id-1",
        name: "folder-name-1",
        revisionDate: "folder-revision-date-1",
      },
      "folder-id-2": {
        id: "folder-id-2",
        name: "folder-name-2",
        revisionDate: "folder-revision-date-2",
      },
    },
    "user_user-2_folder_folders": null as any,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      data: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

describe("FolderMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: FolderMigrator;
  const keyDefinitionLike = {
    key: "folders",
    stateDefinition: {
      name: "folder",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 14);
      sut = new FolderMigrator(14, 15);
    });

    it("should remove folders from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set folders value for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, {
        "folder-id-1": {
          id: "folder-id-1",
          name: "folder-name-1",
          revisionDate: "folder-revision-date-1",
        },
        "folder-id-2": {
          id: "folder-id-2",
          name: "folder-name-2",
          revisionDate: "folder-revision-date-2",
        },
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 15);
      sut = new FolderMigrator(14, 15);
    });

    it.each(["user-1", "user-2"])("should null out new values", async (userId) => {
      await sut.rollback(helper);
      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          folders: {
            encrypted: {
              "folder-id-1": {
                id: "folder-id-1",
                name: "folder-name-1",
                revisionDate: "folder-revision-date-1",
              },
              "folder-id-2": {
                id: "folder-id-2",
                name: "folder-name-2",
                revisionDate: "folder-revision-date-2",
              },
            },
          },
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should not try to restore values to missing accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("user-3", any());
    });
  });
});
