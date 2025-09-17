import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  DEVICE_KEY,
  DeviceTrustServiceStateProviderMigrator,
  SHOULD_TRUST_DEVICE,
} from "./53-migrate-device-trust-svc-to-state-providers";

// Represents data in state service pre-migration
function preMigrationJson() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user1", "user2", "user3"],
    user1: {
      keys: {
        deviceKey: {
          keyB64: "user1_deviceKey",
        },
        otherStuff: "overStuff2",
      },
      settings: {
        trustDeviceChoiceForDecryption: true,
        otherStuff: "overStuff3",
      },
      otherStuff: "otherStuff4",
    },
    user2: {
      keys: {
        // no device key
        otherStuff: "otherStuff5",
      },
      settings: {
        // no trust device choice
        otherStuff: "overStuff6",
      },
      otherStuff: "otherStuff7",
    },
  };
}

function rollbackJSON() {
  return {
    // use pattern user_{userId}_{stateDefinitionName}_{keyDefinitionKey} for each user
    // User1 migrated data
    user_user1_deviceTrust_deviceKey: {
      keyB64: "user1_deviceKey",
    },
    user_user1_deviceTrust_shouldTrustDevice: true,

    // User2 does not have migrated data

    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user1", "user2", "user3"],
    user1: {
      keys: {
        otherStuff: "overStuff2",
      },
      settings: {
        otherStuff: "overStuff3",
      },
      otherStuff: "otherStuff4",
    },
    user2: {
      keys: {
        otherStuff: "otherStuff5",
      },
      settings: {
        otherStuff: "overStuff6",
      },
      otherStuff: "otherStuff6",
    },
  };
}

describe("DeviceTrustServiceStateProviderMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: DeviceTrustServiceStateProviderMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(preMigrationJson(), 52);
      sut = new DeviceTrustServiceStateProviderMigrator(52, 53);
    });

    // it should remove deviceKey and trustDeviceChoiceForDecryption from all accounts
    it("should remove deviceKey and trustDeviceChoiceForDecryption from all accounts that have it", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user1", {
        keys: {
          otherStuff: "overStuff2",
        },
        settings: {
          otherStuff: "overStuff3",
        },
        otherStuff: "otherStuff4",
      });

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).not.toHaveBeenCalledWith("user2", any());
      expect(helper.set).not.toHaveBeenCalledWith("user3", any());
    });

    it("should migrate deviceKey and trustDeviceChoiceForDecryption to state providers for accounts that have the data", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user1", DEVICE_KEY, {
        keyB64: "user1_deviceKey",
      });
      expect(helper.setToUser).toHaveBeenCalledWith("user1", SHOULD_TRUST_DEVICE, true);

      expect(helper.setToUser).not.toHaveBeenCalledWith("user2", DEVICE_KEY, any());
      expect(helper.setToUser).not.toHaveBeenCalledWith("user2", SHOULD_TRUST_DEVICE, any());

      expect(helper.setToUser).not.toHaveBeenCalledWith("user3", DEVICE_KEY, any());
      expect(helper.setToUser).not.toHaveBeenCalledWith("user3", SHOULD_TRUST_DEVICE, any());
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 53);
      sut = new DeviceTrustServiceStateProviderMigrator(52, 53);
    });

    it("should null out newly migrated entries in state provider framework", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user1", DEVICE_KEY, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user1", SHOULD_TRUST_DEVICE, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user2", DEVICE_KEY, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user2", SHOULD_TRUST_DEVICE, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user3", DEVICE_KEY, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user3", SHOULD_TRUST_DEVICE, null);
    });

    it("should add back deviceKey and trustDeviceChoiceForDecryption to all accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("user1", {
        keys: {
          deviceKey: {
            keyB64: "user1_deviceKey",
          },
          otherStuff: "overStuff2",
        },
        settings: {
          trustDeviceChoiceForDecryption: true,
          otherStuff: "overStuff3",
        },
        otherStuff: "otherStuff4",
      });
    });

    it("should not add data back if data wasn't migrated or acct doesn't exist", async () => {
      await sut.rollback(helper);

      // no data to add back for user2 (acct exists but no migrated data) and user3 (no acct)
      expect(helper.set).not.toHaveBeenCalledWith("user2", any());
      expect(helper.set).not.toHaveBeenCalledWith("user3", any());
    });
  });
});
