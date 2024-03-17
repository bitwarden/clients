import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper, runMigrator } from "../migration-helper.spec";

import { AvatarColorMigrator } from "./37-move-avatar-color-to-state-providers";

function rollbackJSON() {
  return {
    authenticatedAccounts: ["user-1", "user-2"],
    "user_user-1_avatar_avatarColor": "#ff0000",
    "user_user-2_avatar_avatarColor": "#cccccc",
    "user-1": {
      settings: {
        extra: "data",
      },
      extra: "data",
    },
    "user-2": {
      settings: {
        extra: "data",
      },
      extra: "data",
    },
  };
}

describe("AvatarColorMigrator", () => {
  const migrator = new AvatarColorMigrator(36, 37);

  it("should migrate the avatarColor property from the account settings object to a user StorageKey", async () => {
    const output = await runMigrator(migrator, {
      authenticatedAccounts: ["user-1", "user-2"] as const,
      "user-1": {
        settings: {
          avatarColor: "#ff0000",
          extra: "data",
        },
        extra: "data",
      },
      "user-2": {
        settings: {
          avatarColor: "#cccccc",
          extra: "data",
        },
        extra: "data",
      },
    });

    expect(output).toEqual({
      authenticatedAccounts: ["user-1", "user-2"],
      "user_user-1_avatar_avatarColor": "#ff0000",
      "user_user-2_avatar_avatarColor": "#cccccc",
      "user-1": {
        settings: {
          extra: "data",
        },
        extra: "data",
      },
      "user-2": {
        settings: {
          extra: "data",
        },
        extra: "data",
      },
    });
  });

  it("should handle missing parts", async () => {
    const output = await runMigrator(migrator, {
      authenticatedAccounts: ["user-1", "user-2"],
      global: {
        extra: "data",
      },
      "user-1": {
        extra: "data",
        settings: {
          extra: "data",
        },
      },
      "user-2": null,
    });

    expect(output).toEqual({
      authenticatedAccounts: ["user-1", "user-2"],
      global: {
        extra: "data",
      },
      "user-1": {
        extra: "data",
        settings: {
          extra: "data",
        },
      },
      "user-2": null,
    });
  });

  describe("rollback", () => {
    let helper: MockProxy<MigrationHelper>;
    let sut: AvatarColorMigrator;

    const keyDefinitionLike = {
      key: "avatarColor",
      stateDefinition: {
        name: "avatar",
      },
    };

    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 37);
      sut = new AvatarColorMigrator(36, 37);
    });

    it("should null out the avatarColor user StorageKey for each account", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(2);
      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user-2", keyDefinitionLike, null);
    });

    it("should add the avatarColor property back to the account settings object", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          avatarColor: "#ff0000",
          extra: "data",
        },
        extra: "data",
      });
      expect(helper.set).toHaveBeenCalledWith("user-2", {
        settings: {
          avatarColor: "#cccccc",
          extra: "data",
        },
        extra: "data",
      });
    });
  });
});
