import { MockProxy } from "jest-mock-extended";

import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { KdfConfigMigrator } from "./59-move-kdf-config-to-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["FirstAccount", "SecondAccount"],
    FirstAccount: {
      profile: {
        kdfIterations: 3,
        kdfMemory: 64,
        kdfParallelism: 5,
        kdfType: 1,
        otherStuff: "otherStuff1",
      },
      otherStuff: "otherStuff2",
    },
    SecondAccount: {
      profile: {
        kdfIterations: 600_001,
        kdfMemory: null as number,
        kdfParallelism: null as number,
        kdfType: 0,
        otherStuff: "otherStuff3",
      },
      otherStuff: "otherStuff4",
    },
  };
}

function rollbackJSON() {
  return {
    user_FirstAccount_kdfConfig_kdfConfig: {
      iterations: 3,
      memory: 64,
      parallelism: 5,
      kdfType: 1,
    },
    user_SecondAccount_kdfConfig_kdfConfig: {
      iterations: 600_001,
      memory: null as number,
      parallelism: null as number,
      kdfType: 0,
    },
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["FirstAccount", "SecondAccount"],
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

const kdfConfigKeyDefinition: KeyDefinitionLike = {
  key: "kdfConfig",
  stateDefinition: {
    name: "kdfConfig",
  },
};

describe("KdfConfigMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: KdfConfigMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 59);
      sut = new KdfConfigMigrator(58, 59);
    });

    it("should remove kdfType and kdfConfig from Account.Profile", async () => {
      await sut.migrate(helper);

      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("FirstAccount", {
        profile: {
          otherStuff: "otherStuff1",
        },
        otherStuff: "otherStuff2",
      });
      expect(helper.set).toHaveBeenCalledWith("SecondAccount", {
        profile: {
          otherStuff: "otherStuff3",
        },
        otherStuff: "otherStuff4",
      });
      expect(helper.setToUser).toHaveBeenCalledWith("FirstAccount", kdfConfigKeyDefinition, {
        iterations: 3,
        memory: 64,
        parallelism: 5,
        kdfType: 1,
      });
      expect(helper.setToUser).toHaveBeenCalledWith("SecondAccount", kdfConfigKeyDefinition, {
        iterations: 600_001,
        memory: null as number,
        parallelism: null as number,
        kdfType: 0,
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 59);
      sut = new KdfConfigMigrator(58, 59);
    });

    it("should null out new KdfConfig account value and set account.profile", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(2);
      expect(helper.setToUser).toHaveBeenCalledWith("FirstAccount", kdfConfigKeyDefinition, null);
      expect(helper.setToUser).toHaveBeenCalledWith("SecondAccount", kdfConfigKeyDefinition, null);
      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("FirstAccount", {
        profile: {
          kdfIterations: 3,
          kdfMemory: 64,
          kdfParallelism: 5,
          kdfType: 1,
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("SecondAccount", {
        profile: {
          kdfIterations: 600_001,
          kdfMemory: null as number,
          kdfParallelism: null as number,
          kdfType: 0,
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
    });
  });
});
