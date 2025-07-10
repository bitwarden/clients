import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  ClientType,
  VAULT_TIMEOUT,
  VAULT_TIMEOUT_ACTION,
  VaultTimeoutSettingsServiceStateProviderMigrator,
} from "./62-migrate-vault-timeout-settings-svc-to-state-provider";

// Represents data in state service pre-migration
function preMigrationJson() {
  return {
    // desktop only global data format
    "global.vaultTimeout": -1,
    "global.vaultTimeoutAction": "lock",

    global: {
      vaultTimeout: 30,
      vaultTimeoutAction: "lock",
      otherStuff: "otherStuff",
    },

    global_account_accounts: {
      user1: {
        email: "user1@email.com",
        name: "User 1",
        emailVerified: true,
      },
      user2: {
        email: "user2@email.com",
        name: "User 2",
        emailVerified: true,
      },
      // create the same structure for user3, user4, user5, user6, user7 in the global_account_accounts
      user3: {
        email: "user3@email.com",
        name: "User 3",
        emailVerified: true,
      },
      user4: {
        email: "user4@email.com",
        name: "User 4",
        emailVerified: true,
      },
      user5: {
        email: "user5@email.com",
        name: "User 5",
        emailVerified: true,
      },
      user6: {
        email: "user6@email.com",
        name: "User 6",
        emailVerified: true,
      },
      user7: {
        email: "user7@email.com",
        name: "User 7",
        emailVerified: true,
      },
    },

    user1: {
      settings: {
        vaultTimeout: 30,
        vaultTimeoutAction: "lock",
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user2: {
      settings: {
        vaultTimeout: null as any,
        vaultTimeoutAction: "logOut",
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user3: {
      settings: {
        vaultTimeout: -1, // onRestart
        vaultTimeoutAction: "lock",
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user4: {
      settings: {
        vaultTimeout: -2, // onLocked
        vaultTimeoutAction: "logOut",
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user5: {
      settings: {
        vaultTimeout: -3, // onSleep
        vaultTimeoutAction: "lock",
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user6: {
      settings: {
        vaultTimeout: -4, // onIdle
        vaultTimeoutAction: "logOut",
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user7: {
      settings: {
        // no vault timeout data to migrate
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
  };
}

function rollbackJSON(cli: boolean = false) {
  const rollbackJson: any = {
    // User specific state provider data
    // use pattern user_{userId}_{stateDefinitionName}_{keyDefinitionKey} for user data

    // User1 migrated data
    user_user1_vaultTimeoutSettings_vaultTimeout: 30,
    user_user1_vaultTimeoutSettings_vaultTimeoutAction: "lock",

    // User2 migrated data
    user_user2_vaultTimeoutSettings_vaultTimeout: "never",
    user_user2_vaultTimeoutSettings_vaultTimeoutAction: "logOut",

    // User3 migrated data
    user_user3_vaultTimeoutSettings_vaultTimeout: "onRestart",
    user_user3_vaultTimeoutSettings_vaultTimeoutAction: "lock",

    // User4 migrated data
    user_user4_vaultTimeoutSettings_vaultTimeout: "onLocked",
    user_user4_vaultTimeoutSettings_vaultTimeoutAction: "logOut",

    // User5 migrated data
    user_user5_vaultTimeoutSettings_vaultTimeout: "onSleep",
    user_user5_vaultTimeoutSettings_vaultTimeoutAction: "lock",

    // User6 migrated data
    user_user6_vaultTimeoutSettings_vaultTimeout: "onIdle",
    user_user6_vaultTimeoutSettings_vaultTimeoutAction: "logOut",

    // User7 migrated data
    // user_user7_vaultTimeoutSettings_vaultTimeout: null as any,
    // user_user7_vaultTimeoutSettings_vaultTimeoutAction: null as any,

    // Global state provider data
    // use pattern global_{stateDefinitionName}_{keyDefinitionKey} for global data
    // Not migrating global data

    global: {
      // no longer has vault timeout data
      otherStuff: "otherStuff",
    },

    global_account_accounts: {
      user1: {
        email: "user1@email.com",
        name: "User 1",
        emailVerified: true,
      },
      user2: {
        email: "user2@email.com",
        name: "User 2",
        emailVerified: true,
      },
      // create the same structure for user3, user4, user5, user6, user7 in the global_account_accounts
      user3: {
        email: "user3@email.com",
        name: "User 3",
        emailVerified: true,
      },
      user4: {
        email: "user4@email.com",
        name: "User 4",
        emailVerified: true,
      },
      user5: {
        email: "user5@email.com",
        name: "User 5",
        emailVerified: true,
      },
      user6: {
        email: "user6@email.com",
        name: "User 6",
        emailVerified: true,
      },
      user7: {
        email: "user7@email.com",
        name: "User 7",
        emailVerified: true,
      },
    },

    user1: {
      settings: {
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user2: {
      settings: {
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user3: {
      settings: {
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user4: {
      settings: {
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user5: {
      settings: {
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user6: {
      settings: {
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
    user7: {
      settings: {
        otherStuff: "otherStuff",
      },
      otherStuff: "otherStuff",
    },
  };

  if (cli) {
    rollbackJson.user_user7_vaultTimeoutSettings_vaultTimeout = "never";
  }

  return rollbackJson;
}

describe("VaultTimeoutSettingsServiceStateProviderMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: VaultTimeoutSettingsServiceStateProviderMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(preMigrationJson(), 61);
      sut = new VaultTimeoutSettingsServiceStateProviderMigrator(61, 62);
    });

    it("should remove state service data from all accounts that have it", async () => {
      await sut.migrate(helper);

      // Global data
      expect(helper.set).toHaveBeenCalledWith("global", {
        // no longer has vault timeout data
        otherStuff: "otherStuff",
      });

      // Expect we removed desktop specially formatted global data
      expect(helper.remove).toHaveBeenCalledWith("global\\.vaultTimeout");
      expect(helper.remove).toHaveBeenCalledWith("global\\.vaultTimeoutAction");

      // User data
      expect(helper.set).toHaveBeenCalledWith("user1", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user2", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user3", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user4", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user5", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user6", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledTimes(7); // 6 users + 1 global
      expect(helper.set).not.toHaveBeenCalledWith("user7", any());
    });

    it("should migrate data to state providers for defined accounts that have the data", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user1", VAULT_TIMEOUT, 30);
      expect(helper.setToUser).toHaveBeenCalledWith("user1", VAULT_TIMEOUT_ACTION, "lock");

      expect(helper.setToUser).toHaveBeenCalledWith("user2", VAULT_TIMEOUT, "never");
      expect(helper.setToUser).toHaveBeenCalledWith("user2", VAULT_TIMEOUT_ACTION, "logOut");

      expect(helper.setToUser).toHaveBeenCalledWith("user3", VAULT_TIMEOUT, "onRestart");
      expect(helper.setToUser).toHaveBeenCalledWith("user3", VAULT_TIMEOUT_ACTION, "lock");

      expect(helper.setToUser).toHaveBeenCalledWith("user4", VAULT_TIMEOUT, "onLocked");
      expect(helper.setToUser).toHaveBeenCalledWith("user4", VAULT_TIMEOUT_ACTION, "logOut");

      expect(helper.setToUser).toHaveBeenCalledWith("user5", VAULT_TIMEOUT, "onSleep");
      expect(helper.setToUser).toHaveBeenCalledWith("user5", VAULT_TIMEOUT_ACTION, "lock");

      expect(helper.setToUser).toHaveBeenCalledWith("user6", VAULT_TIMEOUT, "onIdle");
      expect(helper.setToUser).toHaveBeenCalledWith("user6", VAULT_TIMEOUT_ACTION, "logOut");

      // Expect that we didn't migrate anything to user 7 or 8
      expect(helper.setToUser).not.toHaveBeenCalledWith("user7", VAULT_TIMEOUT, any());
      expect(helper.setToUser).not.toHaveBeenCalledWith("user7", VAULT_TIMEOUT_ACTION, any());
      expect(helper.setToUser).not.toHaveBeenCalledWith("user8", VAULT_TIMEOUT, any());
      expect(helper.setToUser).not.toHaveBeenCalledWith("user8", VAULT_TIMEOUT_ACTION, any());
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 62);
      sut = new VaultTimeoutSettingsServiceStateProviderMigrator(61, 62);
    });

    it("should null out newly migrated entries in state provider framework", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user1", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user1", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user2", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user2", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user3", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user3", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user4", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user4", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user5", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user5", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user6", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user6", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user7", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user7", VAULT_TIMEOUT_ACTION, null);
    });

    it("should add back data to all accounts that had migrated data (only user 1)", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("user1", {
        settings: {
          vaultTimeout: 30,
          vaultTimeoutAction: "lock",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user2", {
        settings: {
          vaultTimeout: null,
          vaultTimeoutAction: "logOut",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user3", {
        settings: {
          vaultTimeout: -1, // onRestart
          vaultTimeoutAction: "lock",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user4", {
        settings: {
          vaultTimeout: -2, // onLocked
          vaultTimeoutAction: "logOut",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user5", {
        settings: {
          vaultTimeout: -3, // onSleep
          vaultTimeoutAction: "lock",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user6", {
        settings: {
          vaultTimeout: -4, // onIdle
          vaultTimeoutAction: "logOut",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });
    });

    it("should not add back the global vault timeout data", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("global", any());
    });

    it("should not add data back if data wasn't migrated or acct doesn't exist", async () => {
      await sut.rollback(helper);

      // no data to add back for user7 (acct exists but no migrated data) and user8 (no acct)
      expect(helper.set).not.toHaveBeenCalledWith("user7", any());
      expect(helper.set).not.toHaveBeenCalledWith("user8", any());
    });
  });
});

describe("VaultTimeoutSettingsServiceStateProviderMigrator - CLI", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: VaultTimeoutSettingsServiceStateProviderMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(preMigrationJson(), 61, "general", ClientType.Cli);
      sut = new VaultTimeoutSettingsServiceStateProviderMigrator(61, 62);
    });

    it("should remove state service data from all accounts that have it", async () => {
      await sut.migrate(helper);

      // Global data
      expect(helper.set).toHaveBeenCalledWith("global", {
        // no longer has vault timeout data
        otherStuff: "otherStuff",
      });

      // User data
      expect(helper.set).toHaveBeenCalledWith("user1", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user2", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user3", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user4", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user5", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user6", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user7", {
        settings: {
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledTimes(8); // 7 users + 1 global
      expect(helper.set).not.toHaveBeenCalledWith("user8", any());
    });

    it("should migrate data to state providers for defined accounts that have the data with an exception for the vault timeout", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user1", VAULT_TIMEOUT, 30);
      expect(helper.setToUser).toHaveBeenCalledWith("user1", VAULT_TIMEOUT_ACTION, "lock");

      expect(helper.setToUser).toHaveBeenCalledWith("user2", VAULT_TIMEOUT, "never");
      expect(helper.setToUser).toHaveBeenCalledWith("user2", VAULT_TIMEOUT_ACTION, "logOut");

      expect(helper.setToUser).toHaveBeenCalledWith("user3", VAULT_TIMEOUT, "onRestart");
      expect(helper.setToUser).toHaveBeenCalledWith("user3", VAULT_TIMEOUT_ACTION, "lock");

      expect(helper.setToUser).toHaveBeenCalledWith("user4", VAULT_TIMEOUT, "onLocked");
      expect(helper.setToUser).toHaveBeenCalledWith("user4", VAULT_TIMEOUT_ACTION, "logOut");

      expect(helper.setToUser).toHaveBeenCalledWith("user5", VAULT_TIMEOUT, "onSleep");
      expect(helper.setToUser).toHaveBeenCalledWith("user5", VAULT_TIMEOUT_ACTION, "lock");

      expect(helper.setToUser).toHaveBeenCalledWith("user6", VAULT_TIMEOUT, "onIdle");
      expect(helper.setToUser).toHaveBeenCalledWith("user6", VAULT_TIMEOUT_ACTION, "logOut");

      // User7 has an undefined vault timeout, but we should still migrate it to "never"
      // b/c the CLI doesn't have a vault timeout
      expect(helper.setToUser).toHaveBeenCalledWith("user7", VAULT_TIMEOUT, "never");
      // Note: we don't have to worry about not migrating the vault timeout action b/c each client
      // has a default value for the vault timeout action when it is retrieved via the vault timeout settings svc.
      expect(helper.setToUser).not.toHaveBeenCalledWith("user7", VAULT_TIMEOUT_ACTION, any());

      // Expect that we didn't migrate anything to user 8 b/c it doesn't exist
      expect(helper.setToUser).not.toHaveBeenCalledWith("user8", VAULT_TIMEOUT, any());
      expect(helper.setToUser).not.toHaveBeenCalledWith("user8", VAULT_TIMEOUT_ACTION, any());
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(true), 62, "general", ClientType.Cli);
      sut = new VaultTimeoutSettingsServiceStateProviderMigrator(61, 62);
    });

    it("should null out newly migrated entries in state provider framework", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user1", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user1", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user2", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user2", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user3", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user3", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user4", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user4", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user5", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user5", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user6", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user6", VAULT_TIMEOUT_ACTION, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user7", VAULT_TIMEOUT, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user7", VAULT_TIMEOUT_ACTION, null);
    });

    it("should add back data to all accounts that had migrated data (only user 1)", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("user1", {
        settings: {
          vaultTimeout: 30,
          vaultTimeoutAction: "lock",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user2", {
        settings: {
          vaultTimeout: null,
          vaultTimeoutAction: "logOut",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user3", {
        settings: {
          vaultTimeout: -1, // onRestart
          vaultTimeoutAction: "lock",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user4", {
        settings: {
          vaultTimeout: -2, // onLocked
          vaultTimeoutAction: "logOut",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user5", {
        settings: {
          vaultTimeout: -3, // onSleep
          vaultTimeoutAction: "lock",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user6", {
        settings: {
          vaultTimeout: -4, // onIdle
          vaultTimeoutAction: "logOut",
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user7", {
        settings: {
          vaultTimeout: null,
          // vaultTimeoutAction: null, // not migrated
          otherStuff: "otherStuff",
        },
        otherStuff: "otherStuff",
      });
    });

    it("should not add back the global vault timeout data", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("global", any());
    });

    it("should not add data back if data wasn't migrated or acct doesn't exist", async () => {
      await sut.rollback(helper);

      // no data to add back for user8 (no acct)
      expect(helper.set).not.toHaveBeenCalledWith("user8", any());
    });
  });
});
