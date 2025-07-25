import { any, MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  FORCE_SET_PASSWORD_REASON_DEFINITION,
  MASTER_KEY_ENCRYPTED_USER_KEY_DEFINITION,
  MASTER_KEY_HASH_DEFINITION,
  MoveMasterKeyStateToProviderMigrator,
} from "./55-move-master-key-state-to-provider";

function preMigrationState() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["FirstAccount", "SecondAccount", "ThirdAccount"],
    // prettier-ignore
    "FirstAccount": {
      profile: {
        forceSetPasswordReason: "FirstAccount_forceSetPasswordReason",
        keyHash: "FirstAccount_keyHash",
        otherStuff: "overStuff2",
      },
      keys: {
        masterKeyEncryptedUserKey: "FirstAccount_masterKeyEncryptedUserKey",
      },
      otherStuff: "otherStuff3",
    },
    // prettier-ignore
    "SecondAccount": {
      profile: {
        forceSetPasswordReason: "SecondAccount_forceSetPasswordReason",
        keyHash: "SecondAccount_keyHash",
        otherStuff: "otherStuff4",
      },
      keys: {
        masterKeyEncryptedUserKey: "SecondAccount_masterKeyEncryptedUserKey",
      },
      otherStuff: "otherStuff5",
    },
    // prettier-ignore
    "ThirdAccount": {
      profile: {
        otherStuff: "otherStuff6",
      },
    },
  };
}

function postMigrationState() {
  return {
    user_FirstAccount_masterPassword_forceSetPasswordReason: "FirstAccount_forceSetPasswordReason",
    user_FirstAccount_masterPassword_masterKeyHash: "FirstAccount_keyHash",
    user_FirstAccount_masterPassword_masterKeyEncryptedUserKey:
      "FirstAccount_masterKeyEncryptedUserKey",
    user_SecondAccount_masterPassword_forceSetPasswordReason:
      "SecondAccount_forceSetPasswordReason",
    user_SecondAccount_masterPassword_masterKeyHash: "SecondAccount_keyHash",
    user_SecondAccount_masterPassword_masterKeyEncryptedUserKey:
      "SecondAccount_masterKeyEncryptedUserKey",
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["FirstAccount", "SecondAccount"],
    // prettier-ignore
    "FirstAccount": {
      profile: {
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    // prettier-ignore
    "SecondAccount": {
      profile: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
    // prettier-ignore
    "ThirdAccount": {
      profile: {
        otherStuff: "otherStuff6",
      },
  },
  };
}

describe("MoveForceSetPasswordReasonToStateProviderMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: MoveMasterKeyStateToProviderMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(preMigrationState(), 54);
      sut = new MoveMasterKeyStateToProviderMigrator(54, 55);
    });

    it("should remove properties from existing accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("FirstAccount", {
        profile: {
          otherStuff: "overStuff2",
        },
        keys: {},
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("SecondAccount", {
        profile: {
          otherStuff: "otherStuff4",
        },
        keys: {},
        otherStuff: "otherStuff5",
      });
    });

    it("should set properties for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "FirstAccount",
        FORCE_SET_PASSWORD_REASON_DEFINITION,
        "FirstAccount_forceSetPasswordReason",
      );

      expect(helper.setToUser).toHaveBeenCalledWith(
        "FirstAccount",
        MASTER_KEY_HASH_DEFINITION,
        "FirstAccount_keyHash",
      );

      expect(helper.setToUser).toHaveBeenCalledWith(
        "FirstAccount",
        MASTER_KEY_ENCRYPTED_USER_KEY_DEFINITION,
        "FirstAccount_masterKeyEncryptedUserKey",
      );

      expect(helper.setToUser).toHaveBeenCalledWith(
        "SecondAccount",
        FORCE_SET_PASSWORD_REASON_DEFINITION,
        "SecondAccount_forceSetPasswordReason",
      );

      expect(helper.setToUser).toHaveBeenCalledWith(
        "SecondAccount",
        MASTER_KEY_HASH_DEFINITION,
        "SecondAccount_keyHash",
      );

      expect(helper.setToUser).toHaveBeenCalledWith(
        "SecondAccount",
        MASTER_KEY_ENCRYPTED_USER_KEY_DEFINITION,
        "SecondAccount_masterKeyEncryptedUserKey",
      );
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(postMigrationState(), 55);
      sut = new MoveMasterKeyStateToProviderMigrator(54, 55);
    });

    it.each(["FirstAccount", "SecondAccount"])("should null out new values", async (userId) => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        userId,
        FORCE_SET_PASSWORD_REASON_DEFINITION,
        null,
      );

      expect(helper.setToUser).toHaveBeenCalledWith(userId, MASTER_KEY_HASH_DEFINITION, null);
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("FirstAccount", {
        profile: {
          forceSetPasswordReason: "FirstAccount_forceSetPasswordReason",
          keyHash: "FirstAccount_keyHash",
          otherStuff: "overStuff2",
        },
        keys: {
          masterKeyEncryptedUserKey: "FirstAccount_masterKeyEncryptedUserKey",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("SecondAccount", {
        profile: {
          forceSetPasswordReason: "SecondAccount_forceSetPasswordReason",
          keyHash: "SecondAccount_keyHash",
          otherStuff: "otherStuff4",
        },
        keys: {
          masterKeyEncryptedUserKey: "SecondAccount_masterKeyEncryptedUserKey",
        },
        otherStuff: "otherStuff5",
      });
    });

    it("should not try to restore values to missing accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("ThirdAccount", any());
    });
  });
});
