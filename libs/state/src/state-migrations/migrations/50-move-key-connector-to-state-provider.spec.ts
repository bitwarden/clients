import { MockProxy } from "jest-mock-extended";

import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { KeyConnectorMigrator } from "./50-move-key-connector-to-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["FirstAccount", "SecondAccount", "ThirdAccount"],
    FirstAccount: {
      profile: {
        usesKeyConnector: true,
        convertAccountToKeyConnector: false,
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    SecondAccount: {
      profile: {
        usesKeyConnector: true,
        convertAccountToKeyConnector: true,
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    user_FirstAccount_keyConnector_usesKeyConnector: true,
    user_FirstAccount_keyConnector_convertAccountToKeyConnector: false,
    user_SecondAccount_keyConnector_usesKeyConnector: true,
    user_SecondAccount_keyConnector_convertAccountToKeyConnector: true,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["FirstAccount", "SecondAccount", "ThirdAccount"],
    FirstAccount: {
      profile: {
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    SecondAccount: {
      profile: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

const usesKeyConnectorKeyDefinition: KeyDefinitionLike = {
  key: "usesKeyConnector",
  stateDefinition: {
    name: "keyConnector",
  },
};

const convertAccountToKeyConnectorKeyDefinition: KeyDefinitionLike = {
  key: "convertAccountToKeyConnector",
  stateDefinition: {
    name: "keyConnector",
  },
};

describe("KeyConnectorMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: KeyConnectorMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 50);
      sut = new KeyConnectorMigrator(49, 50);
    });

    it("should remove usesKeyConnector and convertAccountToKeyConnector from Profile", async () => {
      await sut.migrate(helper);

      // Set is called 2 times even though there are 3 accounts. Since the target properties don't exist in ThirdAccount, they are not set.
      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("FirstAccount", {
        profile: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.setToUser).toHaveBeenCalledWith(
        "FirstAccount",
        usesKeyConnectorKeyDefinition,
        true,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "FirstAccount",
        convertAccountToKeyConnectorKeyDefinition,
        false,
      );
      expect(helper.set).toHaveBeenCalledWith("SecondAccount", {
        profile: {
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
      expect(helper.setToUser).toHaveBeenCalledWith(
        "SecondAccount",
        usesKeyConnectorKeyDefinition,
        true,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "SecondAccount",
        convertAccountToKeyConnectorKeyDefinition,
        true,
      );
      expect(helper.setToUser).not.toHaveBeenCalledWith("ThirdAccount");
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 50);
      sut = new KeyConnectorMigrator(49, 50);
    });

    it("should null out new usesKeyConnector global value", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(4);
      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "FirstAccount",
        usesKeyConnectorKeyDefinition,
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "FirstAccount",
        convertAccountToKeyConnectorKeyDefinition,
        null,
      );
      expect(helper.set).toHaveBeenCalledWith("FirstAccount", {
        profile: {
          usesKeyConnector: true,
          convertAccountToKeyConnector: false,
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.setToUser).toHaveBeenCalledWith(
        "SecondAccount",
        usesKeyConnectorKeyDefinition,
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "SecondAccount",
        convertAccountToKeyConnectorKeyDefinition,
        null,
      );
      expect(helper.set).toHaveBeenCalledWith("SecondAccount", {
        profile: {
          usesKeyConnector: true,
          convertAccountToKeyConnector: true,
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
      expect(helper.setToUser).not.toHaveBeenCalledWith("ThirdAccount");
      expect(helper.set).not.toHaveBeenCalledWith("ThirdAccount");
    });
  });
});
