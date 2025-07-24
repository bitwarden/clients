import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  OLD_PIN_KEY_ENCRYPTED_MASTER_KEY,
  PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
  USER_KEY_ENCRYPTED_PIN,
  PinStateMigrator,
} from "./61-move-pin-state-to-providers";

function preMigrationState() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    global_account_accounts: {
      // prettier-ignore
      "AccountOne": {
        email: "account-one@email.com",
        name: "Account One",
      },
      // prettier-ignore
      "AccountTwo": {
        email: "account-two@email.com",
        name: "Account Two",
      },
    },
    // prettier-ignore
    "AccountOne": {
      settings: {
        pinKeyEncryptedUserKey: "AccountOne_pinKeyEncryptedUserKeyPersistent",
        protectedPin: "AccountOne_userKeyEncryptedPin", // note the name change
        pinProtected: {
          encrypted: "AccountOne_oldPinKeyEncryptedMasterKey", // note the name change
        },
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    // prettier-ignore
    "AccountTwo": {
      settings: {
        otherStuff: "otherStuff4",
      },
    },
  };
}

function postMigrationState() {
  return {
    user_AccountOne_pinUnlock_pinKeyEncryptedUserKeyPersistent:
      "AccountOne_pinKeyEncryptedUserKeyPersistent",
    user_AccountOne_pinUnlock_userKeyEncryptedPin: "AccountOne_userKeyEncryptedPin",
    user_AccountOne_pinUnlock_oldPinKeyEncryptedMasterKey: "AccountOne_oldPinKeyEncryptedMasterKey",
    authenticatedAccounts: ["AccountOne", "AccountTwo"],
    global: {
      otherStuff: "otherStuff1",
    },
    global_account_accounts: {
      // prettier-ignore
      "AccountOne": {
        email: "account-one@email.com",
        name: "Account One",
      },
      // prettier-ignore
      "AccountTwo": {
        email: "account-two@email.com",
        name: "Account Two",
      },
    },
    // prettier-ignore
    "AccountOne": {
      settings: {
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    // prettier-ignore
    "AccountTwo": {
      settings: {
        otherStuff: "otherStuff4",
      },
    },
  };
}

describe("PinStateMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: PinStateMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(preMigrationState(), 61);
      sut = new PinStateMigrator(60, 61);
    });

    it("should remove properties (pinKeyEncryptedUserKey, protectedPin, pinProtected) from existing accounts", async () => {
      await sut.migrate(helper);

      expect(helper.set).toHaveBeenCalledWith("AccountOne", {
        settings: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });

      expect(helper.set).not.toHaveBeenCalledWith("AccountTwo");
    });

    it("should set the properties (pinKeyEncryptedUserKeyPersistent, userKeyEncryptedPin, oldPinKeyEncryptedMasterKey) under the new key definitions", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "AccountOne",
        PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
        "AccountOne_pinKeyEncryptedUserKeyPersistent",
      );

      expect(helper.setToUser).toHaveBeenCalledWith(
        "AccountOne",
        USER_KEY_ENCRYPTED_PIN,
        "AccountOne_userKeyEncryptedPin",
      );

      expect(helper.setToUser).toHaveBeenCalledWith(
        "AccountOne",
        OLD_PIN_KEY_ENCRYPTED_MASTER_KEY,
        "AccountOne_oldPinKeyEncryptedMasterKey",
      );

      expect(helper.setToUser).not.toHaveBeenCalledWith("AccountTwo");
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(postMigrationState(), 61);
      sut = new PinStateMigrator(60, 61);
    });

    it("should null out the previously migrated values (pinKeyEncryptedUserKeyPersistent, userKeyEncryptedPin, oldPinKeyEncryptedMasterKey)", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "AccountOne",
        PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith("AccountOne", USER_KEY_ENCRYPTED_PIN, null);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "AccountOne",
        OLD_PIN_KEY_ENCRYPTED_MASTER_KEY,
        null,
      );
    });

    it("should set back the original account properties (pinKeyEncryptedUserKey, protectedPin, pinProtected)", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("AccountOne", {
        settings: {
          pinKeyEncryptedUserKey: "AccountOne_pinKeyEncryptedUserKeyPersistent",
          protectedPin: "AccountOne_userKeyEncryptedPin",
          pinProtected: {
            encrypted: "AccountOne_oldPinKeyEncryptedMasterKey",
          },
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });
  });
});
