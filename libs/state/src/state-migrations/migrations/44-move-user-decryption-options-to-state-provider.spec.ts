import { any, MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { UserDecryptionOptionsMigrator } from "./44-move-user-decryption-options-to-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["FirstAccount", "SecondAccount", "ThirdAccount"],
    FirstAccount: {
      decryptionOptions: {
        hasMasterPassword: true,
        trustedDeviceOption: {
          hasAdminApproval: false,
          hasLoginApprovingDevice: false,
          hasManageResetPasswordPermission: true,
        },
        keyConnectorOption: {
          keyConnectorUrl: "https://keyconnector.bitwarden.com",
        },
      },
      profile: {
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    SecondAccount: {
      decryptionOptions: {
        hasMasterPassword: false,
        trustedDeviceOption: {
          hasAdminApproval: true,
          hasLoginApprovingDevice: true,
          hasManageResetPasswordPermission: true,
        },
        keyConnectorOption: {
          keyConnectorUrl: "https://selfhosted.bitwarden.com",
        },
      },
      profile: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    user_FirstAccount_decryptionOptions_userDecryptionOptions: {
      hasMasterPassword: true,
      trustedDeviceOption: {
        hasAdminApproval: false,
        hasLoginApprovingDevice: false,
        hasManageResetPasswordPermission: true,
      },
      keyConnectorOption: {
        keyConnectorUrl: "https://keyconnector.bitwarden.com",
      },
    },
    user_SecondAccount_decryptionOptions_userDecryptionOptions: {
      hasMasterPassword: false,
      trustedDeviceOption: {
        hasAdminApproval: true,
        hasLoginApprovingDevice: true,
        hasManageResetPasswordPermission: true,
      },
      keyConnectorOption: {
        keyConnectorUrl: "https://selfhosted.bitwarden.com",
      },
    },
    user_ThirdAccount_decryptionOptions_userDecryptionOptions: {},
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["FirstAccount", "SecondAccount", "ThirdAccount"],
    FirstAccount: {
      decryptionOptions: {
        hasMasterPassword: true,
        trustedDeviceOption: {
          hasAdminApproval: false,
          hasLoginApprovingDevice: false,
          hasManageResetPasswordPermission: true,
        },
        keyConnectorOption: {
          keyConnectorUrl: "https://keyconnector.bitwarden.com",
        },
      },
      profile: {
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    SecondAccount: {
      decryptionOptions: {
        hasMasterPassword: false,
        trustedDeviceOption: {
          hasAdminApproval: true,
          hasLoginApprovingDevice: true,
          hasManageResetPasswordPermission: true,
        },
        keyConnectorOption: {
          keyConnectorUrl: "https://selfhosted.bitwarden.com",
        },
      },
      profile: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

describe("UserDecryptionOptionsMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: UserDecryptionOptionsMigrator;
  const keyDefinitionLike = {
    key: "decryptionOptions",
    stateDefinition: {
      name: "userDecryptionOptions",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 43);
      sut = new UserDecryptionOptionsMigrator(43, 44);
    });

    it("should remove decryptionOptions from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("FirstAccount", {
        profile: {
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("SecondAccount", {
        profile: {
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
    });

    it("should set decryptionOptions provider value for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("FirstAccount", keyDefinitionLike, {
        hasMasterPassword: true,
        trustedDeviceOption: {
          hasAdminApproval: false,
          hasLoginApprovingDevice: false,
          hasManageResetPasswordPermission: true,
        },
        keyConnectorOption: {
          keyConnectorUrl: "https://keyconnector.bitwarden.com",
        },
      });

      expect(helper.setToUser).toHaveBeenCalledWith("SecondAccount", keyDefinitionLike, {
        hasMasterPassword: false,
        trustedDeviceOption: {
          hasAdminApproval: true,
          hasLoginApprovingDevice: true,
          hasManageResetPasswordPermission: true,
        },
        keyConnectorOption: {
          keyConnectorUrl: "https://selfhosted.bitwarden.com",
        },
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 44);
      sut = new UserDecryptionOptionsMigrator(43, 44);
    });

    it.each(["FirstAccount", "SecondAccount", "ThirdAccount"])(
      "should null out new values",
      async (userId) => {
        await sut.rollback(helper);

        expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
      },
    );

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("FirstAccount", {
        decryptionOptions: {
          hasMasterPassword: true,
          trustedDeviceOption: {
            hasAdminApproval: false,
            hasLoginApprovingDevice: false,
            hasManageResetPasswordPermission: true,
          },
          keyConnectorOption: {
            keyConnectorUrl: "https://keyconnector.bitwarden.com",
          },
        },
        profile: {
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("SecondAccount", {
        decryptionOptions: {
          hasMasterPassword: false,
          trustedDeviceOption: {
            hasAdminApproval: true,
            hasLoginApprovingDevice: true,
            hasManageResetPasswordPermission: true,
          },
          keyConnectorOption: {
            keyConnectorUrl: "https://selfhosted.bitwarden.com",
          },
        },
        profile: {
          otherStuff: "otherStuff4",
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
