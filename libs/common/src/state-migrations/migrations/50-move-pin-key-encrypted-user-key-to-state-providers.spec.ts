import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper, runMigrator } from "../migration-helper.spec";

import { PinKeyEncryptedUserKeyMigrator } from "./50-move-pin-key-encrypted-user-key-to-state-providers";

function rollbackJSON() {
  return {
    authenticatedAccounts: ["user-1", "user-2"],
    "user_user-1_crypto_pinKeyEncryptedUserKey": "example1",
    "user_user-2_crypto_pinKeyEncryptedUserKey": "example2",
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

describe("PinKeyEncryptedUserKeyMigrator", () => {
  const migrator = new PinKeyEncryptedUserKeyMigrator(49, 50);

  it("should migrate the pinKeyEncryptedUserKey property from the account settings object to a user StorageKey", async () => {
    const output = await runMigrator(migrator, {
      authenticatedAccounts: ["user-1", "user-2"] as const,
      "user-1": {
        settings: {
          pinKeyEncryptedUserKey: "example1",
          extra: "data",
        },
        extra: "data",
      },
      "user-2": {
        settings: {
          pinKeyEncryptedUserKey: "example2",
          extra: "data",
        },
        extra: "data",
      },
    });

    expect(output).toEqual({
      authenticatedAccounts: ["user-1", "user-2"],
      "user_user-1_crypto_pinKeyEncryptedUserKey": "example1",
      "user_user-2_crypto_pinKeyEncryptedUserKey": "example2",
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
    let sut: PinKeyEncryptedUserKeyMigrator;

    const keyDefinitionLike = {
      key: "pinKeyEncryptedUserKey",
      stateDefinition: {
        name: "crypto",
      },
    };

    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 50);
      sut = new PinKeyEncryptedUserKeyMigrator(49, 50);
    });

    it("should null out the pinKeyEncryptedUserKey user StorageKey for each account", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(2);
      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user-2", keyDefinitionLike, null);
    });

    it("should add the pinKeyEncryptedUserKey property back to the account settings object", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          pinKeyEncryptedUserKey: "example1",
          extra: "data",
        },
        extra: "data",
      });
      expect(helper.set).toHaveBeenCalledWith("user-2", {
        settings: {
          pinKeyEncryptedUserKey: "example2",
          extra: "data",
        },
        extra: "data",
      });
    });
  });
});
